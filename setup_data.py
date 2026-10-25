"""Первая установка словарей и языковых моделей (работает на любом Python 3.9+, без numpy).

Порядок: проверить data/ по data.manifest.json -> скачать архив из релиза GitHub (с докачкой и
прогрессом) -> проверить SHA-256 архива и каждого файла -> распаковать. Если релиз недоступен,
скачать исходные словари и корпуса из их первоисточников (vigenere/download_data.py).

    python setup_data.py            установить или проверить данные
    python setup_data.py --verify   полная проверка SHA-256 всех файлов
Адрес архива: config/release.json или переменная окружения ARGDEC_DATA_URL.
"""
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
MANIFEST = ROOT / "data.manifest.json"
# Отметка установки из первоисточников: такие файлы законно отличаются от манифеста релиза (другие выгрузки,
# модели строятся на месте), поэтому их проверяют по списку того, что реально поставлено, а не по манифесту.
SOURCE_MARK = "installed-from-sources.json"
SOURCE_REQUIRED = ("words_en.txt", "words_ru.txt", "words_uk.txt", "corpus_en.txt", "corpus_ru.txt", "corpus_uk.txt")
CONFIG = ROOT / "config" / "release.json"
DOWNLOADS = ROOT / "runtime" / "downloads"
CHUNK = 1 << 20
RETRIES = 4
TIMEOUT = 60
USER_AGENT = "arg-decoder-setup"


def say(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:   # консоль в cp1251/cp866 без reconfigure: непечатаемое заменяем, а не падаем
        enc = getattr(sys.stdout, "encoding", None) or "ascii"
        print(msg.encode(enc, "replace").decode(enc), flush=True)


def ru_en(ru, en):
    return "%s / %s" % (ru, en)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(4 * CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def load_manifest():
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def data_url():
    env = os.environ.get("ARGDEC_DATA_URL", "").strip()
    if env:
        return env
    try:
        url = json.loads(CONFIG.read_text(encoding="utf-8")).get("data_url", "")
    except (OSError, ValueError):
        url = ""
    return "" if ("OWNER" in url or "REPO" in url) else url


def check_data(manifest, full):
    """Список проблемных файлов: нет, другой размер или (при full) другой SHA-256."""
    bad = []
    for f in manifest["files"]:
        p = DATA / f["name"]
        if not p.is_file() or p.stat().st_size != f["bytes"]:
            bad.append(f["name"])
        elif full and sha256(p) != f["sha256"]:
            bad.append(f["name"])
    return bad


def download(url, target, expected_bytes=None):
    """Скачивание с докачкой (.part + Range) и прогрессом; несколько попыток."""
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_suffix(target.suffix + ".part")
    for attempt in range(1, RETRIES + 1):
        have = part.stat().st_size if part.exists() else 0
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **({"Range": "bytes=%d-" % have} if have else {})})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                if have and r.status != 206:
                    have = 0  # сервер не умеет докачку — начинаем заново
                total = expected_bytes or (have + int(r.headers.get("Content-Length") or 0))
                started, last = time.time(), 0.0
                with open(part, "ab" if have else "wb") as out:
                    done = have
                    for block in iter(lambda: r.read(CHUNK), b""):
                        out.write(block)
                        done += len(block)
                        if time.time() - last > 0.5:
                            last = time.time()
                            speed = (done - have) / max(0.1, last - started) / 1048576
                            pct = 100.0 * done / total if total else 0
                            sys.stdout.write("\r    %5.1f%%  %6.1f / %.1f MB  %.1f MB/s   " % (pct, done / 1048576, (total or 0) / 1048576, speed))
                            sys.stdout.flush()
            sys.stdout.write("\n")
            part.replace(target)
            return True
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 404, 410):  # архива нет по адресу — повторять бессмысленно
                say("    " + ru_en("архив по адресу не найден (HTTP %d): релиз data-v1 ещё не опубликован или адрес неверный" % exc.code,
                                   "archive not found at the URL (HTTP %d): the data-v1 release is not published yet or the URL is wrong" % exc.code))
                return False
            say("\n    " + ru_en("попытка %d не удалась" % attempt, "attempt %d failed" % attempt) + ": %s" % exc)
            time.sleep(min(10, 2 * attempt))
        except (urllib.error.URLError, OSError, ValueError) as exc:
            say("\n    " + ru_en("попытка %d не удалась" % attempt, "attempt %d failed" % attempt) + ": %s" % exc)
            time.sleep(min(10, 2 * attempt))
    return False


def install_from_release(manifest, url):
    zpath = DOWNLOADS / manifest["zip"]
    if not (zpath.exists() and zpath.stat().st_size == manifest.get("zip_bytes")):
        say("[*] " + ru_en("Скачиваю словари и модели (%.0f МБ, один раз)…" % (manifest.get("zip_bytes", 0) / 1048576),
                           "Downloading dictionaries and models (%.0f MB, once)…" % (manifest.get("zip_bytes", 0) / 1048576)))
        if not download(url, zpath, manifest.get("zip_bytes")):
            return False
    say("[*] " + ru_en("Проверяю архив…", "Verifying the archive…"))
    if manifest.get("zip_sha256") and sha256(zpath) != manifest["zip_sha256"]:
        say("[!] " + ru_en("Архив повреждён — скачаю заново в следующий раз", "The archive is corrupt — it will be downloaded again next time"))
        zpath.unlink(missing_ok=True)
        return False
    say("[*] " + ru_en("Распаковываю…", "Unpacking…"))
    DATA.mkdir(exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            name = Path(info.filename).name
            if not info.filename.startswith("data/") or not name or name != info.filename[5:]:
                continue  # только плоские файлы внутри data/ — защита от путей вида ../
            with z.open(info) as src, open(DATA / name, "wb") as dst:
                shutil.copyfileobj(src, dst, CHUNK)
    bad = check_data(manifest, full=True)
    if bad:
        say("[!] " + ru_en("Не совпали хеши: ", "Hash mismatch: ") + ", ".join(bad))
        return False
    zpath.unlink(missing_ok=True)  # архив больше не нужен, данные проверены
    return True


def write_source_mark():
    """Запомнить, что и какого размера поставлено из первоисточников. False, если нужных файлов нет."""
    files = {p.name: p.stat().st_size for p in DATA.glob("*") if p.is_file() and p.name != SOURCE_MARK and (p.name.startswith("words_") or p.name.startswith("corpus_"))}
    if not all(name in files and files[name] > 0 for name in SOURCE_REQUIRED):
        return False
    (DATA / SOURCE_MARK).write_text(json.dumps({"source": "original sources", "date": time.strftime("%Y-%m-%d %H:%M"), "files": files}, indent=1), encoding="utf-8")
    return True


def sources_ready():
    """Данные из первоисточников на месте: отметка есть, и каждый отмеченный файл не пропал и не изменился в размере."""
    try:
        mark = json.loads((DATA / SOURCE_MARK).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    files = mark.get("files") or {}
    if not all(name in files for name in SOURCE_REQUIRED):
        return False
    return all((DATA / name).is_file() and (DATA / name).stat().st_size == size for name, size in files.items())


def data_ready(manifest, full=False):
    """Данные готовы: совпадают с манифестом релиза или поставлены из первоисточников и не повреждены."""
    if not manifest:
        return DATA.is_dir() and any(DATA.iterdir())
    return not check_data(manifest, full=full) or sources_ready()


def install_from_sources():
    """Запасной путь: скачать исходные словари и корпуса (модели потом построятся сами, это дольше)."""
    say("[*] " + ru_en("Релиз недоступен — качаю словари из первоисточников…", "Release unavailable — downloading dictionaries from the original sources…"))
    sys.path.insert(0, str(ROOT))
    os.environ["VIGENERE_DATA"] = str(DATA)
    try:
        from vigenere import download_data
        download_data.main(["en", "ru", "uk"])
    except (Exception, SystemExit) as exc:  # noqa: BLE001 — показываем любую причину
        say("[!] " + ru_en("Не удалось скачать словари: ", "Could not download dictionaries: ") + str(exc))
        return False
    if not write_source_mark():
        say("[!] " + ru_en("Словари из первоисточников неполные", "The dictionaries from the original sources are incomplete"))
        return False
    return True


def ensure_data(offline=False, full_verify=False):
    """True, если данные на месте и проверены. Без данных программа всё равно работает (хуже)."""
    manifest = load_manifest()
    if not manifest:
        say("[!] " + ru_en("Нет data.manifest.json — пропускаю проверку словарей", "No data.manifest.json — skipping dictionary check"))
        return DATA.is_dir() and any(DATA.iterdir())
    bad = check_data(manifest, full=full_verify)
    if not bad:
        return True
    if sources_ready():
        say("[✓] " + ru_en("Словари установлены из первоисточников и на месте", "Dictionaries from the original sources are in place"))
        return True
    if offline:
        say("[!] " + ru_en("Словарей нет, а режим без интернета включён", "Dictionaries are missing and offline mode is on"))
        return False
    url = data_url()
    if url and install_from_release(manifest, url):
        (DATA / SOURCE_MARK).unlink(missing_ok=True)   # теперь данные из релиза — проверка по манифесту
        return True
    return install_from_sources()


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    ok = ensure_data(offline="--offline" in sys.argv, full_verify="--verify" in sys.argv)
    say("[✓] " + ru_en("Словари готовы", "Dictionaries ready") if ok else "[!] " + ru_en("Словари не готовы", "Dictionaries not ready"))
    sys.exit(0 if ok else 1)
