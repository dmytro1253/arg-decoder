"""Собирает архив словарей и языковых моделей для релиза GitHub и манифест с хешами.

    python tools/make_data_zip.py            -> dist/arg-decoder-data-v1.zip и data.manifest.json

Папка data/ (~300 МБ) в репозиторий не попадает: при первом запуске программа скачивает этот
архив из релиза и проверяет SHA-256 каждого файла по data.manifest.json.
"""
import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DIST = ROOT / "dist"
VERSION = "v1"
ZIP_NAME = "arg-decoder-data-%s.zip" % VERSION
MANIFEST = ROOT / "data.manifest.json"
# Замер скорости конкретного компьютера в релиз не входит — он создаётся на месте.
EXCLUDE = {"calibration.json", ".gitkeep"}
CHUNK = 4 << 20


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def refresh_model_cache_names():
    """Кэш моделей называется по отпечатку данных; после смены формата отпечатка переименовываем."""
    sys.path.insert(0, str(ROOT))
    os.environ["VIGENERE_DATA"] = str(DATA)
    from vigenere import core
    for lang in ("en", "ru", "uk"):
        sig = core.data_signature(lang)
        for old in DATA.glob("model_%s_*.npz" % lang):
            prefix = "_".join(old.stem.split("_")[:3])
            new = DATA / ("%s_%s.npz" % (prefix, sig))
            if old != new:
                old.replace(new)


def data_files():
    return sorted(p for p in DATA.iterdir() if p.is_file() and p.name not in EXCLUDE)


def main():
    if not DATA.is_dir():
        sys.exit("Нет папки data/ — нечего упаковывать")
    refresh_model_cache_names()
    files = data_files()
    manifest = {"version": VERSION, "zip": ZIP_NAME, "files": []}
    for p in files:
        manifest["files"].append({"name": p.name, "bytes": p.stat().st_size, "sha256": sha256(p)})
        print("  %-40s %8.1f MB" % (p.name, p.stat().st_size / 1048576))
    DIST.mkdir(exist_ok=True)
    target = DIST / ZIP_NAME
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in files:
            z.write(p, "data/" + p.name)
    manifest["zip_bytes"] = target.stat().st_size
    manifest["zip_sha256"] = sha256(target)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Архив: %s (%.1f MB)" % (target, target.stat().st_size / 1048576))
    print("Манифест: %s" % MANIFEST)


if __name__ == "__main__":
    main()
