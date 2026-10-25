"""Локальный OCR RapidOCR (ONNX Runtime) для интерфейса — экспериментальная ветвь распознавания.

Пакеты ставятся отдельно от основного Python в runtime/ocr-python (python setup_ocr.py), модели — в data/ocr
по config/ocr-models.json с проверкой SHA-256. Изображение распознаётся локально и никуда не отправляется.
Ответ сохраняет сырой текст каждого найденного блока, его рамку и оценку: ничего не исправляется
(никаких O→0, I→1, Ґ→Г), строки собираются по координатам.
"""
import base64
import hashlib
import json
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PKG_DIR = ROOT / "runtime" / "ocr-python"
MODEL_DIR = ROOT / "data" / "ocr"
MANIFEST = ROOT / "config" / "ocr-models.json"
LANGS = {"en": "en_PP-OCRv5_rec_mobile.onnx", "cyrillic": "cyrillic_PP-OCRv5_rec_mobile.onnx"}
DET = "PP-OCRv6_det_small.onnx"
MAX_PIXELS = 4200 * 4200
LINE_OVERLAP = 0.5       # доля высоты, при которой два блока считаются одной строкой

_lock = threading.Lock()
_engines = {}
_state = {"checked": 0.0, "status": None}


def manifest():
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _import():
    # В конец пути: свои numpy и прочее основного Python важнее (на них работает движок Виженера),
    # из отдельной папки берётся только то, чего в основном Python нет.
    if PKG_DIR.is_dir() and str(PKG_DIR) not in sys.path:
        sys.path.append(str(PKG_DIR))
    import rapidocr  # noqa: F401  (проверка наличия)
    import onnxruntime
    return rapidocr, onnxruntime


def models_status(full=False):
    """Список моделей с отметкой: есть ли файл нужного размера (и при full — с верным SHA-256)."""
    m = manifest() or {"models": []}
    out = []
    for item in m.get("models", []):
        p = MODEL_DIR / item["name"]
        ok = p.is_file() and p.stat().st_size == item["bytes"]
        if ok and full:
            ok = hashlib.sha256(p.read_bytes()).hexdigest() == item["sha256"]
        out.append({"name": item["name"], "ok": ok, "bytes": item["bytes"]})
    return out


def status():
    """Готов ли RapidOCR: пакеты, модели и понятная причина, если нет."""
    try:
        rapidocr, ort = _import()
        packages = {"ok": True, "rapidocr": getattr(rapidocr, "__version__", "?"), "onnxruntime": ort.__version__}
    except Exception as exc:  # noqa: BLE001 — любая ошибка импорта = не установлено
        packages = {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)}
    models = models_status()
    missing = [x["name"] for x in models if not x["ok"]]
    ready = packages["ok"] and not missing and bool(models)
    note = "" if ready else ("Не установлен RapidOCR: запусти «python setup_ocr.py» (или Start с ключом --ocr)" if not packages["ok"]
                             else "Нет моделей OCR: " + ", ".join(missing) + " — запусти «python setup_ocr.py»")
    return {"ready": ready, "packages": packages, "models": models, "note": note, "experimental": True}


def _engine(lang):
    if lang in _engines:
        return _engines[lang]
    _import()
    from rapidocr import RapidOCR
    params = {
        "Global.log_level": "error",
        "Global.use_cls": False,
        "Det.model_path": str(MODEL_DIR / DET),
        "Rec.model_path": str(MODEL_DIR / LANGS[lang]),
        "EngineConfig.onnxruntime.intra_op_num_threads": 4,
        "EngineConfig.onnxruntime.inter_op_num_threads": 1,
    }
    from rapidocr import LangRec, ModelType, OCRVersion
    params["Rec.lang_type"] = LangRec.CYRILLIC if lang == "cyrillic" else LangRec.EN
    params["Rec.ocr_version"] = OCRVersion.PPOCRV5
    params["Rec.model_type"] = ModelType.MOBILE
    _engines[lang] = RapidOCR(params=params)
    return _engines[lang]


def group_lines(blocks):
    """Блоки → строки по вертикальному перекрытию, внутри строки слева направо. Сырые тексты не меняются."""
    items = sorted(blocks, key=lambda b: (b["box"][1], b["box"][0]))
    lines = []
    for b in items:
        y0, y1 = b["box"][1], b["box"][3]
        for line in lines:
            ly0, ly1 = line["box"][1], line["box"][3]
            overlap = min(y1, ly1) - max(y0, ly0)
            if overlap > LINE_OVERLAP * min(y1 - y0, ly1 - ly0):
                line["blocks"].append(b)
                line["box"] = [min(line["box"][0], b["box"][0]), min(ly0, y0), max(line["box"][2], b["box"][2]), max(ly1, y1)]
                break
        else:
            lines.append({"blocks": [b], "box": list(b["box"])})
    out = []
    for line in sorted(lines, key=lambda l: l["box"][1]):
        blocks_sorted = sorted(line["blocks"], key=lambda b: b["box"][0])
        out.append({
            "text": " ".join(b["text"] for b in blocks_sorted),
            "confidence": round(100 * min(b["score"] for b in blocks_sorted), 1),
            "bbox": {"x0": line["box"][0], "y0": line["box"][1], "x1": line["box"][2], "y1": line["box"][3]},
            "blocks": blocks_sorted,
        })
    return out


def recognize(body):
    """body: { image: dataURL/base64 PNG, lang: 'en'|'cyrillic' } → { text, lines, blocks, ms, engine }."""
    lang = body.get("lang", "en")
    if lang not in LANGS:
        raise ValueError("Неизвестный язык OCR: %s" % lang)
    data = str(body.get("image", ""))
    if "," in data[:100]:
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=True)
    except ValueError:
        raise ValueError("Изображение не в Base64")
    st = status()
    if not st["ready"]:
        return {"status": "unavailable", "note": st["note"]}
    import numpy as np
    import cv2
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Не удалось прочитать изображение")
    if img.shape[0] * img.shape[1] > MAX_PIXELS:
        raise ValueError("Слишком большое изображение для OCR")
    started = time.monotonic()
    with _lock:   # один движок ONNX на язык; запросы по очереди
        result = _engine(lang)(img, use_cls=False)
    blocks = []
    for box, text, score in zip(getattr(result, "boxes", None) if getattr(result, "boxes", None) is not None else [], result.txts or [], result.scores or []):
        xs = [float(p[0]) for p in box]
        ys = [float(p[1]) for p in box]
        blocks.append({"text": text, "score": round(float(score), 4), "box": [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]})
    lines = group_lines(blocks)
    return {
        "status": "ok",
        "text": "\n".join(l["text"] for l in lines),
        "lines": lines,
        "ms": round((time.monotonic() - started) * 1000),
        "engine": "rapidocr %s · %s · %s" % (st["packages"].get("rapidocr"), DET, LANGS[lang]),
    }
