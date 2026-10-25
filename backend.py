"""Серверная часть ARG Decoder: встроенный подбор Виженера (CPU/CUDA), диагностика,
прогрев языковых моделей, хеши словарей и журнал ошибок.

Всё, что требует numpy/torch, импортируется лениво: без них сервер всё равно запускается,
а вкладка «Отладка» показывает, чего не хватает.
"""
import collections
import hashlib
import importlib
import json
import math
import os
import platform
import queue
import sys
import threading
import time
import traceback
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
os.environ.setdefault("VIGENERE_DATA", str(DATA_DIR))

from version import APP_VERSION  # noqa: E402 — одна версия на всю программу
STARTED = time.time()
WARM_ALPHABETS = ["en-26", "ru-33", "ru-32"]
HASH_CHUNK = 4 * 1024 * 1024
MAX_JOBS = 4
MAX_TEXT = 5000
MAX_USER_KEYS = 200           # ключей пользователя, проверяемых напрямую
MAX_USER_EXTRA = 20           # пользовательских строк сверх первых 50
MAX_RESTARTS = 100000
ABANDON_SECONDS = 60          # задача без опроса столько секунд останавливается
PUMP_INTERVAL = 0.25
ERRORS = collections.deque(maxlen=200)
_lock = threading.Lock()
_torch_lock = threading.Lock()
_model_lock = threading.Lock()
_torch_info = None

# Состояние фоновых работ — его показывает вкладка «Отладка».
STATE = {
    "hashing": {"status": "ожидает", "files": {}, "seconds": None},
    "models": {key: {"status": "ожидает"} for key in WARM_ALPHABETS},
    "engine": {"status": "не загружен", "error": None},
}
MODELS = {}
JOBS = {}


def log_error(where, exc=None, message=None):
    """Запоминает ошибку для вкладки «Отладка» и печатает её в консоль."""
    entry = {
        "time": time.strftime("%H:%M:%S"),
        "where": where,
        "message": message or (repr(exc) if exc else ""),
        "trace": traceback.format_exc() if exc else "",
    }
    with _lock:
        ERRORS.append(entry)
    sys.stdout.write("[ошибка] %s: %s\n" % (where, entry["message"]))


# --------------------------------------------------------------------------- #
#  Библиотеки
# --------------------------------------------------------------------------- #
def _module_info(name):
    try:
        mod = importlib.import_module(name)
        return {"ok": True, "version": getattr(mod, "__version__", "?")}
    except Exception as exc:  # noqa: BLE001 — показываем любую причину
        return {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)}


def _import_torch_quietly():
    """torch, собранный под NumPy 1.x, печатает при импорте длинное предупреждение.
    Движку оно не мешает (мост numpy↔torch не используется), поэтому ловим его и показываем кратко.
    Перехват stderr действует на весь процесс, поэтому импорт делается один раз и под замком."""
    global _torch_info
    with _torch_lock:
        if _torch_info is not None:
            return dict(_torch_info)
        import contextlib
        import io
        import warnings
        buf = io.StringIO()
        with warnings.catch_warnings(), contextlib.redirect_stderr(buf):
            warnings.simplefilter("ignore")
            info = _module_info("torch")
        if "compiled using NumPy 1.x" in buf.getvalue():
            info["note"] = "собран под NumPy 1.x — мост numpy↔torch выключен, движку это не мешает"
        _torch_info = info
        return dict(info)


def gpu_info():
    info = {"torch": _import_torch_quietly(), "cuda": False, "devices": []}
    if not info["torch"]["ok"]:
        info["hint"] = "PyTorch не установлен — перебор идёт на CPU. Для видеокарты NVIDIA запусти «Включить GPU»."
        return info
    try:
        import torch
        info["cuda"] = bool(torch.cuda.is_available())
        info["cuda_version"] = getattr(torch.version, "cuda", None)
        if info["cuda"]:
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                info["devices"].append({"name": props.name, "memory_mb": int(props.total_memory / 1048576)})
        else:
            info["hint"] = "PyTorch есть, но CUDA недоступна (сборка без CUDA, нет NVIDIA или драйвера)."
    except Exception as exc:  # noqa: BLE001
        info["error"] = repr(exc)
        log_error("GPU", exc)
    return info


def engine():
    """Импорт встроенного движка подбора Виженера; ошибка запоминается и не роняет сервер."""
    try:
        from vigenere import attack, core, i18n, langs
        STATE["engine"] = {"status": "загружен", "error": None}
        return attack, core, i18n, langs
    except Exception as exc:  # noqa: BLE001
        STATE["engine"] = {"status": "ошибка", "error": "%s: %s" % (type(exc).__name__, exc)}
        log_error("Импорт движка Виженера", exc)
        return None


# --------------------------------------------------------------------------- #
#  Словари: хеши и прогрев моделей
# --------------------------------------------------------------------------- #
def data_files():
    files = []
    if DATA_DIR.is_dir():
        for p in sorted(DATA_DIR.iterdir()):
            if p.is_file() and not p.name.startswith("."):
                files.append({"name": p.name, "bytes": p.stat().st_size})
    return files


def hash_data():
    """SHA-256 всех файлов данных — чтобы видеть, что словари целы и какие именно."""
    st = STATE["hashing"]
    st["status"] = "идёт"
    t0 = time.time()
    try:
        for f in data_files():
            h = hashlib.sha256()
            try:
                with open(DATA_DIR / f["name"], "rb") as fh:
                    for chunk in iter(lambda: fh.read(HASH_CHUNK), b""):
                        h.update(chunk)
            except FileNotFoundError:
                continue  # старый кэш модели удалили, пока считали
            st["files"][f["name"]] = h.hexdigest()
        st["status"] = "готово"
    except Exception as exc:  # noqa: BLE001
        st["status"] = "ошибка"
        log_error("Хеширование словарей", exc)
    st["seconds"] = round(time.time() - t0, 2)


def warm_models():
    """Загружает языковые модели заранее (из кэша .npz или строит из корпусов)."""
    _import_torch_quietly()  # заранее и без шума в консоли — дальше движок берёт его из кэша импорта
    parts = engine()
    if not parts:
        for key in WARM_ALPHABETS:
            STATE["models"][key] = {"status": "нет движка"}
        return
    _, core, _, _ = parts
    for key in WARM_ALPHABETS:
        st = {"status": "загружается"}
        STATE["models"][key] = st
        t0 = time.time()
        try:
            alpha = core.get_alphabet(key)
            sig = core.data_signature(alpha.lang)
            cache = DATA_DIR / ("model_%s_%s_%s.npz" % (alpha.lang, alpha.variant, sig))
            st["signature"] = sig
            st["cache"] = cache.name if cache.exists() else None
            model = get_model(core, key)
            st.update(status="готова", seconds=round(time.time() - t0, 2), words=len(model.words),
                      source="кэш" if st["cache"] else "построена из корпуса")
        except Exception as exc:  # noqa: BLE001
            st.update(status="ошибка", error="%s: %s" % (type(exc).__name__, exc))
            log_error("Модель " + key, exc)


def get_model(core, key):
    """Одна и та же модель не строится двумя потоками одновременно."""
    with _model_lock:
        if key not in MODELS:
            MODELS[key] = core.get_model(key)
        return MODELS[key]


def start_background():
    threading.Thread(target=hash_data, name="hash", daemon=True).start()
    threading.Thread(target=warm_models, name="models", daemon=True).start()


def _setup_info():
    """Отметка первой установки (runtime/setup-done.json): версия установки, OCR, CUDA, дата."""
    try:
        done = json.loads((ROOT / "runtime" / "setup-done.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"done": False}
    return {"done": True, "version": done.get("version"), "ocr": done.get("ocr"), "cuda": done.get("cuda"),
            "python_version": done.get("python_version"), "date": done.get("date")}


def _build_info():
    """Точная сборка (релиз с подписью, клон git или исходники) — из updater."""
    try:
        import updater
        return updater.build_info()
    except Exception as exc:  # noqa: BLE001 — диагностика не должна падать
        return {"kind": "unknown", "version": APP_VERSION, "error": str(exc)}


def _data_source():
    """Откуда данные: архив релиза (совпадает с манифестом), первоисточники (отметка) или неполная установка."""
    try:
        import setup_data
        manifest = setup_data.load_manifest()
        bad = setup_data.check_data(manifest, full=False) if manifest else []
        if manifest and not bad:
            return {"source": "release", "version": manifest.get("version"), "missing": []}
        if setup_data.sources_ready():
            return {"source": "sources", "version": None, "missing": []}
        return {"source": "incomplete", "version": manifest.get("version") if manifest else None, "missing": bad[:20]}
    except Exception as exc:  # noqa: BLE001 — диагностика не должна падать
        return {"source": "unknown", "error": str(exc), "missing": []}


def _ocr_status():
    try:
        import ocr_backend
        return ocr_backend.status()
    except Exception as exc:  # noqa: BLE001
        return {"ready": False, "note": "%s: %s" % (type(exc).__name__, exc), "models": [], "packages": {"ok": False}}


def diagnostics():
    return {
        "app": {"version": APP_VERSION, "uptime": round(time.time() - STARTED), "root": str(ROOT)},
        "python": {"version": sys.version.split()[0], "executable": sys.executable, "platform": platform.platform(),
                   "cpus": os.cpu_count(), "ok": sys.version_info >= (3, 9)},
        "libraries": {"numpy": _module_info("numpy")},
        "gpu": gpu_info(),
        "engine": STATE["engine"],
        "data": {"dir": str(DATA_DIR), "exists": DATA_DIR.is_dir(), "files": data_files()},
        "hashing": STATE["hashing"],
        "models": STATE["models"],
        "setup": _setup_info(),
        "build": _build_info(),
        "datasource": _data_source(),
        "ocr": _ocr_status(),
        "jobs": [{"id": j["id"], "status": j["status"]} for j in _jobs_snapshot()],
        "errors": list(ERRORS),
    }


# --------------------------------------------------------------------------- #
#  Задачи подбора ключа Виженера
# --------------------------------------------------------------------------- #
MODES = {"auto", "brute", "freq", "dict", "hill"}
VARIANTS = {"vigenere", "beaufort", "variant"}


def _jobs_snapshot():
    with _lock:
        return list(JOBS.values())


def _int(params, key, default, lo, hi):
    """Целое из запроса в границах; мусор — понятная ошибка 400, а не падение."""
    value = params.get(key, default)
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("Параметр %s должен быть числом" % key)
    try:
        number = int(float(value))
    except (TypeError, ValueError, OverflowError):
        raise ValueError("Параметр %s должен быть числом" % key)
    if not lo <= number <= hi:
        raise ValueError("Параметр %s должен быть от %d до %d" % (key, lo, hi))
    return number


def start_job(params):
    if not isinstance(params, dict):
        raise ValueError("Ожидался JSON-объект")
    if any(j["status"] == "идёт" for j in _jobs_snapshot()):
        raise ValueError("Уже идёт подбор ключа — дождись его или останови")
    parts = engine()
    if not parts:
        raise RuntimeError("Движок Виженера не загрузился: " + str(STATE["engine"]["error"]))
    attack, core, i18n, langs = parts
    full_text = str(params.get("text", ""))
    text = full_text[:MAX_TEXT]
    if not text.strip():
        raise ValueError("Пустой шифр")
    truncated = {"from": len(full_text), "to": MAX_TEXT} if len(full_text) > MAX_TEXT else None
    lang = params.get("lang", "auto")
    if lang not in ("en", "ru", "uk"):
        cyr = sum(1 for ch in text.lower() if "а" <= ch <= "я" or ch in "ёєіїґ")
        lat = sum(1 for ch in text.lower() if "a" <= ch <= "z")
        lang = ("uk" if any(ch in text.lower() for ch in "єіїґ") else "ru") if cyr > lat else "en"
    alphabet = params.get("alphabet", "auto")
    keys = langs.auto_keys(lang) if alphabet == "auto" else ["%s-%s" % (lang, alphabet)]
    mode = params.get("mode", "auto") if params.get("mode") in MODES else "auto"
    variant = params.get("variant", "vigenere") if params.get("variant") in VARIANTS else "vigenere"
    want_gpu = bool(params.get("gpu", True))
    use_gpu = want_gpu and attack.gpu_available()
    alpha_list = [(k, get_model(core, k)) for k in keys]
    if mode == "dict":
        dict_words = sorted(alpha_list[0][1].words | set(langs.builtin_words(lang)))
    else:
        dict_words = sorted(set(core.load_frequent_words(lang)) | set(langs.builtin_words(lang)))
    raw_keys = params.get("keys") or []
    extra = [w.strip().lower()[:40] for w in raw_keys[:2000] if isinstance(w, str) and w.strip()] if isinstance(raw_keys, list) else []
    dict_words = sorted(set(dict_words) | set(extra))
    user_rows = user_key_rows(text, alpha_list, variant, extra, core, attack)
    max_len = _int(params, "max_len", 20, 1, 40)
    min_len = _int(params, "min_len", 1, 1, max_len)
    restarts = _int(params, "restarts", 4000, 1, MAX_RESTARTS)
    cfg = dict(text=text, alpha_list=alpha_list, variant=variant, mode=mode, min_len=min_len, max_len=max_len,
               processes=max(1, (os.cpu_count() or 2) - 1), restarts=restarts,
               keylen_penalty=math.log(core.get_alphabet(keys[0]).M), dict_words=dict_words, dict_reversed=True,
               freq_seeds=320, use_gpu=use_gpu, gpu_batch=None, tr=i18n.Translator(params.get("ui") if params.get("ui") in i18n.UI_LANGS else "ru"))
    q = queue.Queue()
    eng = attack.Engine(cfg, q)
    job = {"id": uuid.uuid4().hex[:12], "status": "идёт", "engine": eng, "queue": q, "log": [], "rows": [],
           "progress": None, "started": time.time(), "gpu": use_gpu, "lang": lang, "alphabets": keys, "mode": mode,
           "polled": time.time(), "lock": threading.Lock(), "user_rows": user_rows, "truncated": truncated}
    if truncated:
        job["log"].append("Ввод обрезан до %d символов (было %d)" % (MAX_TEXT, truncated["from"]))
    if want_gpu and not use_gpu:
        job["log"].append("CUDA недоступна — считаю на CPU")
    with _lock:
        finished = [k for k, j in JOBS.items() if j["status"] != "идёт"]
        for k in finished[: max(0, len(JOBS) - MAX_JOBS + 1)]:
            JOBS.pop(k, None)
        JOBS[job["id"]] = job
    eng.start()
    threading.Thread(target=_pump, args=(job,), name="job-" + job["id"], daemon=True).start()
    return job_view(job)


def user_key_rows(text, alpha_list, variant, keys, core, attack):
    """Ключи, переданные пользователем, проверяются напрямую и без штрафа за длину ключа:
    подсказку нельзя хоронить ранжированием (аудит 2026-10-19). Их строки всегда попадают в ответ."""
    rows = []
    for aname, model in alpha_list:
        alpha = core.get_alphabet(aname)
        for key in keys[:MAX_USER_KEYS]:
            idx = [alpha.index.get(ch) for ch in key.lower()]
            if not idx or any(i is None for i in idx):
                continue
            found = attack.final_rank([(0.0, tuple(idx))], text, alpha, model, variant, limit=1,
                                      keylen_penalty=0.0, alpha_name=aname)
            for row in found:
                row["user"] = True
                rows.append(row)
    return rows


def merged_rows(job):
    """Строки движка + строки пользовательских ключей (они заменяют одноимённые и не обрезаются)."""
    by_key = {(r["key"], r["alpha"]): r for r in job["rows"]}
    for r in job.get("user_rows", []):
        by_key[(r["key"], r["alpha"])] = r
    rows = sorted(by_key.values(), key=lambda r: -r["final"])
    head = rows[:50]
    tail = [r for r in rows[50:] if r.get("user")][:MAX_USER_EXTRA]
    return head + tail


def _pump(job):
    """Постоянно разбирает очередь движка: иначе брошенная задача копила бы события в памяти."""
    while True:
        with job["lock"]:
            _drain(job)
            running = job["status"] == "идёт"
            eng = job["engine"]
        if not running:
            break
        if time.time() - job["polled"] > ABANDON_SECONDS and eng is not None:
            eng.request_stop()  # вкладку закрыли — не жжём процессор зря
        time.sleep(PUMP_INTERVAL)
    eng = job["engine"]
    if eng is not None:
        eng.join(timeout=30)
    with job["lock"]:
        _drain(job)
        job["engine"] = None  # отпускаем движок и словари на миллионы слов


def _drain(job):
    q = job["queue"]
    while True:
        try:
            ev = q.get_nowait()
        except queue.Empty:
            break
        kind = ev.get("type")
        if kind == "log":
            job["log"].append(ev.get("msg", ""))
            if "Traceback" in ev.get("msg", ""):
                log_error("Подбор Виженера", message=ev["msg"].splitlines()[0])
        elif kind == "progress":
            job["progress"] = {k: ev.get(k) for k in ("done", "total", "rate", "eta")}
        elif kind in ("interim", "results"):
            job["rows"] = ev.get("rows", [])
        elif kind == "done":
            job["status"] = "готово" if ev.get("ok") else "ошибка"
            if ev.get("stopped"):
                job["status"] = "остановлено"
            job["elapsed"] = ev.get("elapsed")
    eng = job["engine"]
    if job["status"] == "идёт" and (eng is None or not eng.is_alive()) and q.empty():
        job["status"] = "готово" if job["rows"] else "ошибка"


def job_view(job):
    with job["lock"]:
        _drain(job)
        return _view(job)


def _view(job):
    return {
        "id": job["id"], "status": job["status"], "gpu": job["gpu"], "lang": job["lang"], "mode": job["mode"],
        "alphabets": job["alphabets"], "progress": job["progress"], "log": job["log"][-60:],
        "rows": [{k: r.get(k) for k in ("key", "alpha", "keylen", "final", "words", "cov", "plain", "user")} for r in merged_rows(job)],
        "truncated": job.get("truncated"),
        "seconds": round(time.time() - job["started"], 1),
    }


def job_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        raise KeyError("Нет такой задачи")
    job["polled"] = time.time()
    return job_view(job)


def stop_job(job_id):
    job = JOBS.get(job_id)
    if not job:
        raise KeyError("Нет такой задачи")
    eng = job["engine"]
    if eng is not None:
        eng.request_stop()
    return job_view(job)
