"""Необязательная установка локального OCR RapidOCR (экспериментально).

Пакеты (config/ocr-models.json → packages) ставятся в отдельную папку runtime/ocr-python, а не в общий Python;
модели скачиваются в data/ocr и сверяются по SHA-256. Без этой установки OCR работает как раньше (tesseract.js).

    python setup_ocr.py                 установить пакеты и модели
    python setup_ocr.py --verify        только проверить (SHA-256 моделей, импорт пакетов)
    python setup_ocr.py --models DIR    взять модели из локальной папки (тоже со сверкой SHA-256)
    python setup_ocr.py --offline       ничего не скачивать
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import ocr_backend  # noqa: E402
import setup_data  # noqa: E402

say = setup_data.say
ru_en = setup_data.ru_en


def install_packages(manifest, offline):
    st = ocr_backend.status()["packages"]
    if st["ok"]:
        say("[✓] RapidOCR %s, ONNX Runtime %s" % (st.get("rapidocr"), st.get("onnxruntime")))
        return True
    if offline:
        say("[!] " + ru_en("Пакеты OCR не установлены, а режим без интернета включён", "OCR packages are missing and offline mode is on"))
        return False
    say("[*] " + ru_en("Ставлю RapidOCR и ONNX Runtime в runtime/ocr-python…", "Installing RapidOCR and ONNX Runtime into runtime/ocr-python…"))
    target = ocr_backend.PKG_DIR
    target.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, "-m", "pip", "install", "--no-warn-script-location", "--target", str(target)] + manifest["packages"]
    if subprocess.call(cmd) != 0:
        say("[!] " + ru_en("Установка пакетов не удалась (нужен интернет и pip)", "Package installation failed (needs internet and pip)"))
        return False
    ok = ocr_backend.status()["packages"]["ok"]
    say(("[✓] " if ok else "[!] ") + ru_en("пакеты OCR " + ("готовы" if ok else "не импортируются"), "OCR packages " + ("ready" if ok else "do not import")))
    return ok


def install_models(manifest, offline, source):
    ocr_backend.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    ok = True
    for item in manifest["models"]:
        target = ocr_backend.MODEL_DIR / item["name"]
        if target.is_file() and setup_data.sha256(target) == item["sha256"]:
            continue
        if source:
            src = Path(source) / item["name"]
            if src.is_file():
                shutil.copyfile(src, target)
        elif not offline:
            say("[*] " + ru_en("Скачиваю ", "Downloading ") + item["name"])
            setup_data.download(item["url"], target, item["bytes"])
        if not target.is_file() or setup_data.sha256(target) != item["sha256"]:
            say("[!] " + ru_en("Модель не прошла проверку SHA-256: ", "Model failed the SHA-256 check: ") + item["name"])
            target.unlink(missing_ok=True)
            ok = False
    if ok:
        say("[✓] " + ru_en("модели OCR проверены", "OCR models verified"))
    return ok


def main(argv):
    manifest = json.loads(ocr_backend.MANIFEST.read_text(encoding="utf-8"))
    offline = "--offline" in argv or "--verify" in argv
    source = argv[argv.index("--models") + 1] if "--models" in argv and argv.index("--models") + 1 < len(argv) else None
    ok = install_packages(manifest, offline) & install_models(manifest, offline, source)
    if "--verify" in argv:
        bad = [m["name"] for m in ocr_backend.models_status(full=True) if not m["ok"]]
        ok = ok and not bad
    say(("[✓] " if ok else "[!] ") + ru_en("OCR RapidOCR " + ("готов" if ok else "не готов"), "RapidOCR " + ("ready" if ok else "not ready")))
    return 0 if ok else 1


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    sys.exit(main(sys.argv[1:]))
