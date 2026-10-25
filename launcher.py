"""Запускатор ARG Decoder (by Dmytro) для Windows, macOS и Linux.

Первый запуск: выбрать Python (с numpy и CUDA > с numpy > любой 3.9+; на Windows без Python —
встроенный runtime/python), поставить numpy, скачать и проверить словари, проверить движок,
записать runtime/setup-done.json. Следующие запуски сразу стартуют сервер.

    python launcher.py            запуск (при первом — установка)
    python launcher.py --repair   повторить установку и проверки
    python launcher.py --offline  не скачивать ничего из интернета
    python launcher.py --gpu      дополнительно поставить PyTorch с CUDA (≈2.5 ГБ)
    python launcher.py --check    только показать найденные Python и выйти
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
IS_WIN = os.name == "nt"
RUNTIME = ROOT / "runtime"
EMBED_PY = RUNTIME / "python" / "python.exe"
SETUP_DONE = RUNTIME / "setup-done.json"
SETUP_VERSION = 2   # 2: локальный OCR (RapidOCR) ставится вместе с программой
OWN_ARGS = ("--gpu", "--ocr", "--no-ocr", "--check", "--repair", "--offline")
# Короткая проверка движка: модель загружается и Виженер расшифровывает известный пример.
SELFTEST = (
    "import os,sys,json;sys.path.insert(0,os.getcwd())\n"
    "from vigenere import core\n"
    "a=core.get_alphabet('en-26');m=core.get_model('en-26')\n"
    "ok=core.decrypt_text('LMVCCIKB','LUCY',a).lower()=='asteroid'\n"
    "print(json.dumps({'vigenere':ok,'words':len(m.words)}))\n"
)
# Новые сборки PyTorch выходят под свежие версии CUDA — пробуем от новой к старой.
TORCH_CUDA_INDEXES = ["https://download.pytorch.org/whl/cu128", "https://download.pytorch.org/whl/cu126",
                      "https://download.pytorch.org/whl/cu124", "https://download.pytorch.org/whl/cu121"]
# Быстрая проба: torch только ищем (импорт долгий), CUDA проверяем у претендентов.
PROBE = (
    "import json,sys,importlib.util as u\n"
    "r={'version':list(sys.version_info[:3]),'exe':sys.executable,'numpy':False,'torch':False,'cuda':False}\n"
    "try:\n import numpy; r['numpy']=True\nexcept Exception: pass\n"
    "r['torch']=u.find_spec('torch') is not None\n"
    "if r['torch'] and FULL:\n"
    " try:\n  import io,contextlib,warnings; warnings.simplefilter('ignore')\n"
    "  with contextlib.redirect_stderr(io.StringIO()):\n   import torch\n  r['cuda']=bool(torch.cuda.is_available())\n"
    " except Exception: r['torch']=False\n"
    "print(json.dumps(r))\n"
)


def say(msg):
    print(msg, flush=True)


def venv_python():
    return VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")


def candidates():
    """Все интерпретаторы, которые удалось найти на этом компьютере."""
    found = []
    if EMBED_PY.exists():
        found.append(str(EMBED_PY))
    if venv_python().exists():
        found.append(str(venv_python()))
    found.append(sys.executable)
    if IS_WIN and shutil.which("py"):
        try:
            out = subprocess.run(["py", "-0p"], capture_output=True, text=True, timeout=15,
                                 encoding="utf-8", errors="replace").stdout
            for line in out.splitlines():
                match = re.search(r"([A-Za-z]:\\.*?\.exe)\s*$", line)
                if match:
                    found.append(match.group(1))
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    for name in ("python3", "python", "python3.13", "python3.12", "python3.11", "python3.10"):
        path = shutil.which(name)
        if path:
            found.append(path)
    if not IS_WIN:
        found += glob.glob("/opt/homebrew/bin/python3*") + glob.glob("/usr/local/bin/python3*")
    unique, seen = [], set()
    for path in found:
        key = os.path.normcase(os.path.realpath(path))
        if key not in seen and os.path.exists(path):
            seen.add(key)
            unique.append(path)
    return unique


def probe(path, full=False):
    try:
        code = ("FULL=%s\n" % full) + PROBE
        out = subprocess.run([path, "-c", code], capture_output=True, text=True, timeout=120,
                             encoding="utf-8", errors="replace")
        info = json.loads(out.stdout.strip().splitlines()[-1])
        info["path"] = path
        return info if tuple(info["version"]) >= (3, 9) else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return None


def rank(info):
    return (info["numpy"] and info["cuda"], info["numpy"], info["torch"], tuple(info["version"]))


def make_venv(base):
    say("[*] Ставлю numpy (один раз) / Installing numpy (once)…")
    try:
        # Встроенный Python (Windows без установленного Python) не умеет venv — ставим прямо в него.
        if os.path.normcase(str(base)) == os.path.normcase(str(EMBED_PY)):
            subprocess.check_call([base, "-m", "pip", "install", "--no-warn-script-location", "-r", str(ROOT / "requirements.txt")])
            return base
        subprocess.check_call([base, "-m", "venv", str(VENV)])
        py = str(venv_python())
        subprocess.call([py, "-m", "pip", "install", "--upgrade", "pip"], stdout=subprocess.DEVNULL)  # не обязательно
        subprocess.check_call([py, "-m", "pip", "install", "-r", str(ROOT / "requirements.txt")])
        return py
    except (OSError, subprocess.CalledProcessError) as exc:
        say("[!] Не получилось установить зависимости (%s). Программа запустится без полного движка Виженера." % exc)
        say("    Проверь интернет и запусти ещё раз — установка повторится.")
        if VENV.exists() and not venv_python().exists():
            shutil.rmtree(VENV, ignore_errors=True)
        return None


def install_gpu(py):
    if sys.platform == "darwin":
        say("[!] На Mac нет CUDA (это технология NVIDIA). Программа работает на процессоре.")
        return
    say("[*] Ставлю PyTorch с CUDA (около 2.5 ГБ, это надолго)…")
    for index in TORCH_CUDA_INDEXES:
        say("    пробую " + index)
        if subprocess.call([py, "-m", "pip", "install", "--upgrade", "torch", "--index-url", index]) == 0:
            say("[✓] PyTorch установлен. Проверь вкладку «Отладка» → CUDA.")
            return
    say("[!] Установка PyTorch не удалась. Нужен 64-битный Python и интернет; подробности выше.")


def read_setup():
    """Данные прошлой успешной установки, если они ещё действительны."""
    try:
        done = json.loads(SETUP_DONE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if done.get("version") != SETUP_VERSION or not os.path.exists(done.get("python", "")):
        return None
    sys.path.insert(0, str(ROOT))
    import setup_data
    manifest = setup_data.load_manifest()
    if not setup_data.data_ready(manifest, full=False):
        return None  # файлы словарей пропали или изменились — нужна повторная установка
    return done


def self_test(py):
    try:
        out = subprocess.run([py, "-c", SELFTEST], capture_output=True, text=True, timeout=300, cwd=str(ROOT),
                             encoding="utf-8", errors="replace", env=dict(os.environ, VIGENERE_DATA=str(ROOT / "data")))
        return json.loads(out.stdout.strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return {"vigenere": False}


def setup(args):
    """Первая установка: Python, numpy, словари, самопроверка. Возвращает путь к Python."""
    say("=" * 60)
    say("  ARG Decoder — первая настройка / first-time setup (один раз / once)")
    say("=" * 60)
    py = choose_python(args)
    sys.path.insert(0, str(ROOT))
    import setup_data
    data_ok = setup_data.ensure_data(offline="--offline" in args)
    info = probe(py, full=True) or {}
    test = self_test(py) if info.get("numpy") else {"vigenere": False, "skipped": "no numpy"}
    say("[%s] %s" % ("✓" if test.get("vigenere") else "!", "Самопроверка движка / engine self-test: " + ("OK" if test.get("vigenere") else "не прошла / failed")))
    RUNTIME.mkdir(exist_ok=True)
    ocr_ok = install_ocr(py, args)
    if data_ok and info.get("numpy") and test.get("vigenere"):
        SETUP_DONE.write_text(json.dumps({
            "version": SETUP_VERSION, "python": py, "python_version": info.get("version"), "numpy": True,
            "cuda": info.get("cuda", False), "data": data_ok, "selftest": test, "ocr": ocr_ok, "date": time.strftime("%Y-%m-%d %H:%M"),
        }, indent=2), encoding="utf-8")
        say("[✓] Готово! Дальше программа будет запускаться сразу / Done! Next launches start immediately.")
    else:
        say("[!] Установка не полная — программа всё равно откроется, недостающее докачается в следующий раз.")
        say("    Setup is incomplete — the app still opens; missing parts are retried next time.")
    return py


def install_ocr(py, args):
    """Локальный OCR (RapidOCR + модели) ставится вместе с программой. Неудача не мешает запуску:
    распознавание тогда идёт через tesseract.js, а повторить установку можно ключом --ocr."""
    if "--no-ocr" in args:
        say("[-] OCR RapidOCR пропущен (--no-ocr) / RapidOCR skipped (--no-ocr)")
        return None
    say("[*] Ставлю локальный OCR RapidOCR (~120 МБ, один раз) / Installing local OCR RapidOCR (~120 MB, once)…")
    code = subprocess.call([py, str(ROOT / "setup_ocr.py")] + (["--offline"] if "--offline" in args else []), cwd=str(ROOT))
    if code != 0:
        say("[!] RapidOCR не установился — OCR будет работать через tesseract.js. Повторить: python launcher.py --ocr")
        say("    RapidOCR was not installed — OCR falls back to tesseract.js. Retry with: python launcher.py --ocr")
    return code == 0


def choose_python(args):
    infos = [i for i in (probe(p) for p in candidates()) if i]
    # CUDA проверяем только у тех, у кого есть и numpy, и torch — это дорогой импорт.
    infos = [(probe(i["path"], full=True) or i) if i["numpy"] and i["torch"] else i for i in infos]
    infos.sort(key=rank, reverse=True)
    if "--check" in args:
        for i in infos:
            say("%s  Python %s  numpy=%s torch=%s cuda=%s" % (i["path"], ".".join(map(str, i["version"])), i["numpy"], i["torch"], i["cuda"]))
        return
    best = infos[0] if infos else {"path": sys.executable, "numpy": False, "cuda": False, "version": list(sys.version_info[:3])}
    py = best["path"]
    if not best["numpy"] and "--offline" not in args:
        py = make_venv(py) or py
    info = probe(py, full=True) or best
    say("[✓] Python %s: %s" % (".".join(map(str, info["version"])), py))
    say("    numpy: %s · PyTorch: %s · CUDA: %s" % tuple("да/yes" if info.get(k) else "нет/no" for k in ("numpy", "torch", "cuda")))
    return py


def main():
    # Консоль может быть в cp1251/cp866 — непечатаемые символы заменяем, а не падаем.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    args = set(sys.argv[1:])
    if sys.version_info < (3, 9):
        sys.exit("Нужен Python 3.9 или новее / Python 3.9+ is required: https://www.python.org/downloads/")
    if "--check" in args:
        choose_python(args | {"--check"})
        return
    done = None if ("--repair" in args or "--gpu" in args) else read_setup()
    py = done["python"] if done else setup(args)
    if "--gpu" in args:
        install_gpu(py)
    if "--ocr" in args and done:
        # Повторная установка RapidOCR (при первой настройке он уже ставится): пакеты в runtime/ocr-python, модели в data/ocr.
        install_ocr(py, args)
    env = dict(os.environ, PYTHONIOENCODING="utf-8", VIGENERE_DATA=str(ROOT / "data"))
    extra = [a for a in sys.argv[1:] if a not in OWN_ARGS]
    try:
        code = subprocess.call([py, str(ROOT / "server.py")] + extra, env=env, cwd=str(ROOT))
    except KeyboardInterrupt:
        code = 0
    sys.exit(code)


if __name__ == "__main__":
    main()
