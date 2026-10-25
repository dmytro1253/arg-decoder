"""Обновление ARG Decoder: точная сборка, проверка новых версий и безопасная установка.

Сборка релиза (tools/release.py) кладёт рядом с программой build.json — список всех файлов
программы с размерами и SHA-256, версию и коммит — и build.sig, подпись Ed25519 этого списка
ключом автора. Открытый ключ записан здесь, в TRUSTED_KEYS. Поэтому:

* точная сборка — версия, коммит и отпечаток build.json; изменённые и пропавшие файлы видны;
* новая версия ищется в релизах GitHub, но верят не GitHub, а подписи: чужой или повреждённый
  архив не установится, даже если его подсунут по сети или в релиз;
* архив распаковывается во временную папку, каждый файл сверяется с подписанным списком
  (лишние файлы, пути вида ../ и папки data/, runtime/ отклоняются);
* установка идёт при запуске (launcher.py), до старта сервера: заменённые и удалённые файлы
  сначала копируются в runtime/update/backup, при любой ошибке всё возвращается назад;
  прерванная установка откатывается при следующем запуске, `--rollback` возвращает прошлую версию.

Словари, проекты пользователя, runtime/ и .venv/ обновление не трогает. Клон git обновляется
командой `git pull`, а не архивом.
"""
import hashlib
import json
import os
import re
import shutil
import stat
import threading
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

import ed25519_ref
from version import APP_VERSION

ROOT = Path(__file__).resolve().parent
UPDATE_DIR = ROOT / "runtime" / "update"
BUILD_FILE = "build.json"
BUILD_SIG = "build.sig"
CONFIG = ROOT / "config" / "release.json"
APP_ID = "arg-decoder"
MANIFEST_FORMAT = 1
DEFAULT_REPO = "dmytro1253/arg-decoder"
# Открытые ключи автора (Ed25519). Новый ключ добавляется релизом, подписанным старым.
TRUSTED_KEYS = {
    "dmytro-2026": "a6f8f76a105e3c45cbea5740c8c0cbc0935e40608df65032e6f17277701a4735",
}
# Эти папки принадлежат пользователю и установке — обновление их не трогает.
PROTECTED = ("data", "runtime", ".venv", ".git", "dist", "node_modules")
RESTART_CODE = 75           # сервер просит запускатор установить обновление и запустить его снова
MAX_ZIP = 300 << 20
MAX_MANIFEST = 4 << 20
MAX_FILES = 5000
CHECK_TTL = 6 * 3600        # GitHub спрашиваем не чаще раза в 6 часов (если не просят явно)
KEEP_BACKUPS = 2
TIMEOUT = 30
CHUNK = 1 << 20
VERSION_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
BAD_CHARS = re.compile(r'[<>"|?*\x00-\x1f~]')
RESERVED = {"CON", "PRN", "AUX", "NUL"} | {"COM%d" % i for i in range(10)} | {"LPT%d" % i for i in range(10)}
MAX_UNPACKED = 1 << 30      # сумма распакованных файлов сборки

# Состояние фоновой загрузки — его читает интерфейс.
STATE = {"phase": "idle", "version": None, "done": 0, "total": 0, "error": None}
_lock = threading.Lock()


class UpdateError(Exception):
    """Понятная причина, по которой обновление не проверено или не установлено."""


def _set(**kw):
    with _lock:
        STATE.update(kw)


def state():
    with _lock:
        return dict(STATE)


def parse_version(text):
    m = VERSION_RE.match(str(text or "").strip())
    return tuple(int(x) for x in m.groups()) if m else None


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def repo():
    try:
        value = json.loads(CONFIG.read_text(encoding="utf-8")).get("repo", "")
    except (OSError, ValueError):
        value = ""
    return value if re.match(r"^[\w.-]+/[\w.-]+$", value or "") else DEFAULT_REPO


# --------------------------------------------------------------------------- #
#  Подписанный список файлов
# --------------------------------------------------------------------------- #
def safe_path(path):
    """Относительный путь внутри программы без выходов наружу и без пользовательских папок."""
    if not isinstance(path, str) or not path or len(path) > 300 or "\\" in path or ":" in path or "\0" in path:
        return False
    parts = path.split("/")
    if path.startswith("/") or any(p in ("", ".", "..") for p in parts):
        return False
    for part in parts:
        # Windows: «data.» и «data » — это data, CON/NUL — устройства, а регистр не различается.
        if part[-1] in ". " or BAD_CHARS.search(part) or part.split(".")[0].upper() in RESERVED:
            return False
    return parts[0].casefold() not in PROTECTED and path.casefold() not in (BUILD_FILE, BUILD_SIG)


def sign_text(secret, key_id, raw):
    return "%s:%s\n" % (key_id, ed25519_ref.sign(secret, raw).hex())


def verify_manifest(raw, sig_text):
    """Проверяет подпись и формат build.json. Возвращает разобранный список или бросает UpdateError."""
    if not isinstance(raw, bytes) or len(raw) > MAX_MANIFEST:
        raise UpdateError("список файлов сборки слишком большой или повреждён")
    key_id, _, sig_hex = str(sig_text or "").strip().partition(":")
    public = TRUSTED_KEYS.get(key_id)
    if not public or not re.match(r"^[0-9a-f]{64}$", public):
        raise UpdateError("подпись сделана неизвестным ключом «%s»" % key_id[:40])
    try:
        signature = bytes.fromhex(sig_hex)
    except ValueError:
        raise UpdateError("подпись повреждена") from None
    if not ed25519_ref.verify(bytes.fromhex(public), raw, signature):
        raise UpdateError("подпись не сходится — файл изменён или подделан")
    try:
        manifest = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise UpdateError("список файлов сборки не читается") from None
    _check_manifest(manifest, key_id)
    return manifest


def _check_manifest(m, key_id):
    if not isinstance(m, dict) or m.get("format") != MANIFEST_FORMAT or m.get("app") != APP_ID:
        raise UpdateError("это не сборка ARG Decoder или формат новее, чем понимает эта версия")
    if m.get("key") != key_id or not parse_version(m.get("version")):
        raise UpdateError("в сборке неверная версия или ключ")
    files = m.get("files")
    if not isinstance(files, list) or not files or len(files) > MAX_FILES:
        raise UpdateError("в сборке нет списка файлов")
    seen = set()
    for f in files:
        if not isinstance(f, dict) or not safe_path(f.get("path")):
            raise UpdateError("недопустимый путь в сборке: %r" % (f.get("path") if isinstance(f, dict) else f,))
        if not isinstance(f.get("bytes"), int) or f["bytes"] < 0 or not HEX64.match(str(f.get("sha256", ""))):
            raise UpdateError("неверный размер или хеш файла %s" % f["path"])
        key = f["path"].casefold()
        if key in seen:
            raise UpdateError("файл %s указан дважды" % f["path"])
        seen.add(key)


def build_id(raw):
    return hashlib.sha256(raw).hexdigest()[:12]


def _git_commit(root):
    """Коммит клона git без запуска git: .git/HEAD → ссылка → файл ссылки или packed-refs."""
    git = root / ".git"
    try:
        head = (git / "HEAD").read_text(encoding="utf-8").strip()
        if not head.startswith("ref:"):
            return head[:40]
        ref = head[4:].strip()
        if (git / ref).is_file():
            return (git / ref).read_text(encoding="utf-8").strip()[:40]
        for line in (git / "packed-refs").read_text(encoding="utf-8").splitlines():
            if line.endswith(" " + ref):
                return line.split(" ")[0][:40]
    except OSError:
        pass
    return None


def installed_manifest():
    """(manifest, raw, ошибка) установленной сборки; manifest None — сборка не из релиза или подпись не сошлась."""
    try:
        raw = (ROOT / BUILD_FILE).read_bytes()
    except OSError:
        return None, None, None
    try:
        sig = (ROOT / BUILD_SIG).read_text(encoding="utf-8")
        return verify_manifest(raw, sig), raw, None
    except (OSError, UpdateError) as exc:
        return None, raw, str(exc)


def build_info():
    """Что именно запущено: релиз с подписью, клон git или исходники без списка файлов."""
    manifest, raw, error = installed_manifest()
    if manifest:
        return {"kind": "release", "version": manifest["version"], "commit": manifest.get("commit"),
                "date": manifest.get("date"), "id": build_id(raw), "files": len(manifest["files"]),
                "signed": True, "key": manifest["key"], "code_version": APP_VERSION,
                "consistent": manifest["version"] == APP_VERSION}
    if raw is not None:
        return {"kind": "unverified", "version": APP_VERSION, "signed": False, "error": error, "id": build_id(raw)}
    if (ROOT / ".git").exists():
        return {"kind": "git", "version": APP_VERSION, "commit": _git_commit(ROOT), "signed": False}
    return {"kind": "source", "version": APP_VERSION, "signed": False}


def verify_install():
    """Сверяет каждый файл программы с подписанным списком сборки."""
    manifest, _, error = installed_manifest()
    if not manifest:
        return {"ok": False, "checked": 0, "modified": [], "missing": [],
                "reason": error or "у этой копии нет подписанного списка файлов (клон git или исходники)"}
    modified, missing = [], []
    for f in manifest["files"]:
        p = ROOT / f["path"]
        if not p.is_file():
            missing.append(f["path"])
        elif p.stat().st_size != f["bytes"] or sha256_file(p) != f["sha256"]:
            modified.append(f["path"])
    return {"ok": not modified and not missing, "checked": len(manifest["files"]), "modified": modified, "missing": missing,
            "version": manifest["version"]}


def install_mode():
    """Можно ли обновлять эту копию архивом: ('ok'|'git'|'readonly', пояснение)."""
    if (ROOT / ".git").exists():
        return "git", "это клон git — обнови командой git pull"
    try:
        UPDATE_DIR.mkdir(parents=True, exist_ok=True)
        probe = ROOT / ".update-write-test"
        probe.write_bytes(b"")
        probe.unlink()
    except OSError:
        return "readonly", "нет прав на запись в папку программы — скачай новую версию со страницы релиза"
    return "ok", ""


# --------------------------------------------------------------------------- #
#  Поиск новой версии
# --------------------------------------------------------------------------- #
def _request(url, accept="application/octet-stream"):
    return urllib.request.Request(url, headers={"User-Agent": "%s/%s" % (APP_ID, APP_VERSION), "Accept": accept})


def _asset_url_ok(url, name):
    return isinstance(url, str) and url.startswith("https://github.com/%s/releases/download/" % repo()) and url.endswith("/" + name)


def latest_release(releases):
    """Самый новый опубликованный релиз программы (vX.Y.Z) со всеми тремя файлами обновления."""
    best = None
    for rel in releases if isinstance(releases, list) else []:
        if not isinstance(rel, dict) or rel.get("draft") or rel.get("prerelease"):
            continue
        ver = parse_version(rel.get("tag_name"))
        if not ver or (best and ver <= best["ver"]):
            continue
        name = "%s-%d.%d.%d" % ((APP_ID,) + ver)
        assets = {a.get("name"): a.get("browser_download_url") for a in rel.get("assets") or [] if isinstance(a, dict)}
        urls = {k: assets.get(name + ext) for k, ext in (("zip", ".zip"), ("manifest", ".build.json"), ("sig", ".build.sig"))}
        if not all(_asset_url_ok(u, name + ext) for u, ext in zip(urls.values(), (".zip", ".build.json", ".build.sig"))):
            urls = None
        best = {"ver": ver, "version": "%d.%d.%d" % ver, "urls": urls, "page": rel.get("html_url"),
                "notes": str(rel.get("body") or "")[:6000], "published": rel.get("published_at")}
    return best


def check(force=False, fetch=None):
    """Есть ли новая версия. Ответ кэшируется на CHECK_TTL; без сети — честное «не удалось проверить»."""
    if os.environ.get("ARGDEC_OFFLINE") == "1":
        return {"status": "offline", "current": APP_VERSION}
    cache = UPDATE_DIR / "last-check.json"
    if not force:
        try:
            cached = json.loads(cache.read_text(encoding="utf-8"))
            if time.time() - cached.get("checked", 0) < CHECK_TTL and cached.get("current") == APP_VERSION:
                return cached
        except (OSError, ValueError):
            pass
    url = "https://api.github.com/repos/%s/releases?per_page=30" % repo()
    try:
        releases = fetch(url) if fetch else json.loads(_read_url(url, MAX_MANIFEST, accept="application/vnd.github+json"))
    except (OSError, ValueError, UpdateError) as exc:
        return {"status": "error", "current": APP_VERSION, "error": "не удалось связаться с GitHub: %s" % exc}
    rel = latest_release(releases)
    mode, reason = install_mode()
    result = {"status": "none", "current": APP_VERSION, "checked": time.time(), "repo": repo(), "mode": mode, "mode_reason": reason}
    if rel:
        newer = rel["ver"] > parse_version(APP_VERSION)
        result.update(status="update" if newer else "current", latest=rel["version"], page=rel["page"], notes=rel["notes"],
                      published=rel["published"], urls=rel["urls"],
                      can_install=bool(newer and rel["urls"] and mode == "ok"))
        if newer and not rel["urls"]:
            result["mode_reason"] = "в релизе нет подписанного архива обновления — скачай его со страницы релиза"
    try:
        UPDATE_DIR.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return result


def _read_url(url, limit, accept="application/octet-stream"):
    with urllib.request.urlopen(_request(url, accept), timeout=TIMEOUT) as r:
        data = r.read(limit + 1)
    if len(data) > limit:
        raise UpdateError("ответ больше допустимого")
    return data


def _download(url, target, limit):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(_request(url), timeout=TIMEOUT) as r, open(target, "wb") as out:
        total = int(r.headers.get("Content-Length") or 0)
        if total > limit:
            raise UpdateError("архив обновления больше допустимого (%d МБ)" % (limit >> 20))
        _set(done=0, total=total)
        done = 0
        for block in iter(lambda: r.read(CHUNK), b""):
            done += len(block)
            if done > limit:
                raise UpdateError("архив обновления больше допустимого (%d МБ)" % (limit >> 20))
            out.write(block)
            _set(done=done)


# --------------------------------------------------------------------------- #
#  Загрузка и проверка (сервер, в фоне)
# --------------------------------------------------------------------------- #
def extract_verified(zpath, manifest, raw, sig_text, dest):
    """Распаковывает архив сборки в dest, сверяя каждый файл с подписанным списком."""
    expected = {f["path"]: f for f in manifest["files"]}
    if sum(f["bytes"] for f in manifest["files"]) > MAX_UNPACKED:
        raise UpdateError("сборка больше допустимого размера")
    top = "%s-%s/" % (APP_ID, manifest["version"])
    found = set()
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            if not info.filename.startswith(top):
                raise UpdateError("файл вне папки сборки: %s" % info.filename[:120])
            rel = info.filename[len(top):]
            if rel in (BUILD_FILE, BUILD_SIG):
                if info.file_size > MAX_MANIFEST:
                    raise UpdateError("%s в архиве слишком большой" % rel)
                data = z.read(info)
                # Подпись сравнивается по значению: концы строк в текстовом файле могли смениться при выпуске.
                same = data == raw if rel == BUILD_FILE else data.decode("utf-8", "replace").strip() == sig_text.strip()
                if not same:
                    raise UpdateError("%s в архиве не совпадает с подписанным" % rel)
                (dest / rel).write_bytes(data)
                continue
            entry = expected.get(rel)
            if not entry:
                raise UpdateError("лишний файл в архиве: %s" % rel[:120])
            if rel in found or info.file_size != entry["bytes"]:
                raise UpdateError("неверный размер или повтор файла %s" % rel)
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            h = hashlib.sha256()
            with z.open(info) as src, open(target, "wb") as out:
                for block in iter(lambda: src.read(CHUNK), b""):
                    h.update(block)
                    out.write(block)
            if h.hexdigest() != entry["sha256"]:
                raise UpdateError("хеш файла %s не совпал" % rel)
            found.add(rel)
    missing = sorted(set(expected) - found)
    if missing:
        raise UpdateError("в архиве нет файлов: %s" % ", ".join(missing[:5]))
    if not (dest / BUILD_FILE).is_file():
        (dest / BUILD_FILE).write_bytes(raw)
        (dest / BUILD_SIG).write_bytes(sig_text.encode("utf-8"))


def stage(info, fetch_bytes=None, fetch_file=None):
    """Скачивает и проверяет обновление; готовое ждёт в runtime/update/staging до перезапуска."""
    mode, reason = install_mode()
    if mode != "ok":
        raise UpdateError(reason)
    urls = info.get("urls") or {}
    prefix = "https://github.com/%s/releases/download/" % repo()
    if not all(str(urls.get(k) or "").startswith(prefix) for k in ("zip", "manifest", "sig")):
        raise UpdateError("нет адресов файлов обновления")
    read = fetch_bytes or (lambda u: _read_url(u, MAX_MANIFEST))
    (UPDATE_DIR / "pending.json").unlink(missing_ok=True)
    _set(phase="verifying", version=info.get("latest"), error=None, done=0, total=0)
    raw = read(urls["manifest"])
    sig_text = read(urls["sig"]).decode("utf-8", "replace")
    manifest = verify_manifest(raw, sig_text)
    if manifest["version"] != info.get("latest") or parse_version(manifest["version"]) <= parse_version(APP_VERSION):
        raise UpdateError("подписанная сборка %s не новее установленной %s" % (manifest["version"], APP_VERSION))
    _set(phase="downloading")
    zpath = UPDATE_DIR / "download" / ("%s-%s.zip" % (APP_ID, manifest["version"]))
    zpath.parent.mkdir(parents=True, exist_ok=True)
    (fetch_file or (lambda u, t: _download(u, t, MAX_ZIP)))(urls["zip"], zpath)
    _set(phase="verifying")
    staging = UPDATE_DIR / "staging"
    try:
        extract_verified(zpath, manifest, raw, sig_text, staging)
    except (zipfile.BadZipFile, OSError) as exc:
        raise UpdateError("архив повреждён: %s" % exc) from None
    finally:
        zpath.unlink(missing_ok=True)
    pending = {"version": manifest["version"], "build": build_id(raw), "date": time.strftime("%Y-%m-%d %H:%M")}
    (UPDATE_DIR / "pending.json").write_text(json.dumps(pending), encoding="utf-8")
    _set(phase="ready")
    return pending


def stage_async(info):
    """Запускает загрузку в фоне; ход виден через state()."""
    with _lock:
        if STATE["phase"] in ("downloading", "verifying"):
            return dict(STATE)
        STATE.update(phase="verifying", version=info.get("latest"), error=None, done=0, total=0)

    def run():
        try:
            stage(info)
        except (UpdateError, OSError, ValueError, urllib.error.URLError) as exc:
            _set(phase="error", error=str(exc))
            shutil.rmtree(UPDATE_DIR / "staging", ignore_errors=True)
    threading.Thread(target=run, daemon=True).start()
    return state()


def pending():
    try:
        return json.loads((UPDATE_DIR / "pending.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


# --------------------------------------------------------------------------- #
#  Установка, откат и восстановление (запускатор, до старта сервера)
# --------------------------------------------------------------------------- #
def _journal_path():
    return UPDATE_DIR / "journal.json"


def _write_journal(journal):
    tmp = _journal_path().with_suffix(".tmp")
    tmp.write_text(json.dumps(journal, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, _journal_path())


def _read_journal():
    try:
        return json.loads(_journal_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _copy_atomic(src, dst, executable=False):
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.name + ".update-tmp")
    shutil.copyfile(src, tmp)
    if executable and os.name != "nt":
        tmp.chmod(tmp.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    os.replace(tmp, dst)


def _prune_empty_dirs(paths):
    for rel in paths:
        parent = (ROOT / rel).parent
        while parent != ROOT and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent


def apply_pending(log=print):
    """Устанавливает проверенное обновление. True — установлено, False — нечего ставить; ошибка — откат и UpdateError."""
    info = pending()
    staging = UPDATE_DIR / "staging"
    if not info:
        return False
    try:
        raw = (staging / BUILD_FILE).read_bytes()
        new = verify_manifest(raw, (staging / BUILD_SIG).read_text(encoding="utf-8"))
        if parse_version(new["version"]) <= parse_version(APP_VERSION):
            raise UpdateError("сборка %s не новее установленной %s" % (new["version"], APP_VERSION))
        for f in new["files"]:   # повторная сверка: между загрузкой и запуском файлы могли измениться
            p = staging / f["path"]
            if not p.is_file() or p.stat().st_size != f["bytes"] or sha256_file(p) != f["sha256"]:
                raise UpdateError("подготовленный файл %s изменился" % f["path"])
    except (OSError, UpdateError) as exc:
        discard_pending()
        raise UpdateError("подготовленное обновление отклонено: %s" % exc) from None
    log("[*] Устанавливаю обновление %s → %s / Installing update…" % (APP_VERSION, new["version"]))
    try:
        _apply(new, staging, log)
    finally:
        discard_pending()   # и после отката: иначе неудачная установка повторялась бы при каждом запуске
    log("[✓] Обновление %s установлено / Update installed" % new["version"])
    return True


def _apply(new, staging, log):
    old, _, _ = installed_manifest()
    new_paths = {f["path"]: f for f in new["files"]}
    changed = [p for p, f in new_paths.items()
               if not ((ROOT / p).is_file() and (ROOT / p).stat().st_size == f["bytes"] and sha256_file(ROOT / p) == f["sha256"])]
    # Удаляются только файлы из списка прошлой сборки; без него (исходники) лишнее остаётся на месте.
    removed = [f["path"] for f in old["files"] if f["path"] not in new_paths and (ROOT / f["path"]).is_file()] if old else []
    backup = UPDATE_DIR / "backup" / ("%s-%s" % (APP_VERSION, time.strftime("%Y%m%d-%H%M%S")))
    journal = {"state": "applying", "from": APP_VERSION, "to": new["version"], "backup": str(backup.relative_to(ROOT)).replace("\\", "/"),
               "replaced": [], "created": [], "removed": removed, "date": time.strftime("%Y-%m-%d %H:%M")}
    for rel in changed + [BUILD_FILE, BUILD_SIG]:
        (journal["replaced"] if (ROOT / rel).is_file() else journal["created"]).append(rel)
    for rel in journal["replaced"] + removed:
        dst = backup / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dst)
    _write_journal(journal)   # план и копии готовы до первого изменения — откат возможен с любого места
    try:
        for rel in changed:
            _copy_atomic(staging / rel, ROOT / rel, new_paths[rel].get("exec", False))
        for rel in removed:
            (ROOT / rel).unlink()
        _prune_empty_dirs(removed)
        for rel in (BUILD_FILE, BUILD_SIG):
            _copy_atomic(staging / rel, ROOT / rel)
        bad = [p for p, f in new_paths.items() if not (ROOT / p).is_file() or sha256_file(ROOT / p) != f["sha256"]]
        if bad:
            raise UpdateError("после установки не совпали файлы: %s" % ", ".join(bad[:5]))
    except (OSError, UpdateError) as exc:
        log("[!] Установка не удалась (%s) — возвращаю прошлую версию / rolling back" % exc)
        _restore(journal)
        _prune_backups()
        raise UpdateError("установка не удалась и отменена: %s" % exc) from None
    journal["state"] = "done"
    _write_journal(journal)
    log("    заменено %d, удалено %d файлов; копия прошлой версии: %s" % (len(changed), len(removed), journal["backup"]))
    _prune_backups()


def _journal_ok(journal):
    """Пути журнала — только файлы программы и папка копий внутри runtime/update/backup."""
    backup = str(journal.get("backup", ""))
    rels = [journal.get(k) for k in ("replaced", "created", "removed")]
    if not re.match(r"^runtime/update/backup/[\w.-]+$", backup) or not all(isinstance(r, list) for r in rels):
        return False
    return all(safe_path(p) or p in (BUILD_FILE, BUILD_SIG) for r in rels for p in r)


def _restore(journal):
    if not _journal_ok(journal):
        raise UpdateError("журнал обновления повреждён — откат невозможен, переустанови программу из релиза")
    backup = ROOT / journal["backup"]
    for rel in journal["replaced"] + journal["removed"]:
        if (backup / rel).is_file():
            _copy_atomic(backup / rel, ROOT / rel, os.access(backup / rel, os.X_OK))
    for rel in journal["created"]:
        (ROOT / rel).unlink(missing_ok=True)
    _prune_empty_dirs(journal["created"])
    journal["state"] = "rolled-back"
    _write_journal(journal)


def recover(log=print):
    """Прерванная установка (выключили компьютер, закрыли окно) откатывается при следующем запуске."""
    journal = _read_journal()
    if journal and journal.get("state") == "applying":
        log("[!] Прошлая установка обновления прервалась — возвращаю версию %s / restoring the previous version" % journal.get("from"))
        _restore(journal)
        return True
    return False


def rollback(log=print):
    """Вернуть версию, которая стояла до последнего обновления."""
    journal = _read_journal()
    if not journal or journal.get("state") != "done":
        raise UpdateError("нет установленного обновления, которое можно откатить")
    if not (ROOT / journal["backup"]).is_dir():
        raise UpdateError("копия прошлой версии не найдена: %s" % journal["backup"])
    _restore(journal)
    log("[✓] Возвращена версия %s / Restored version %s" % (journal["from"], journal["from"]))
    return journal["from"]


def discard_pending():
    (UPDATE_DIR / "pending.json").unlink(missing_ok=True)
    shutil.rmtree(UPDATE_DIR / "staging", ignore_errors=True)


def _prune_backups():
    root = UPDATE_DIR / "backup"
    dirs = sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime) if root.is_dir() else []
    for old in dirs[:-KEEP_BACKUPS]:
        shutil.rmtree(old, ignore_errors=True)


def status():
    """Всё для интерфейса: сборка, ход загрузки, подготовленное обновление, последняя установка."""
    mode, reason = install_mode()
    journal = _read_journal()
    return {"build": build_info(), "state": state(), "pending": pending(), "mode": mode, "mode_reason": reason,
            "launcher": os.environ.get("ARGDEC_LAUNCHER") == "1",
            "last": {k: journal.get(k) for k in ("state", "from", "to", "date")} if journal else None}
