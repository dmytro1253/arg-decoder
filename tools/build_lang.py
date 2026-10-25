"""Собирает компактные языковые модели (квадграммы + частые слова) для веб-интерфейса.

Запуск: python tools/build_lang.py [путь_к_data] [--only uk]
По умолчанию берёт корпуса из папки data программы и пишет web/js/lang-data.js.
"""
import base64
import collections
import json
import math
import pathlib
import re
import sys

DATA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else pathlib.Path(__file__).resolve().parent.parent / "data"
OUT = pathlib.Path(__file__).resolve().parent.parent / "web" / "js" / "lang-data.js"
SINGLES = ("a", "i", "я", "в", "и", "с", "о", "к", "у", "і", "й", "з", "а")   # однобуквенные слова словаря
READ_LIMIT = 40_000_000  # символов корпуса на язык — хватает для устойчивых частот

LANGS = {
    "en": {"alphabet": "abcdefghijklmnopqrstuvwxyz", "corpus": "corpus_en.txt", "words": 20000},
    "ru": {"alphabet": "абвгдежзийклмнопрстуфхцчшщъыьэюя", "corpus": "corpus_ru.txt", "words": 30000},
    "uk": {"alphabet": "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя", "corpus": "corpus_uk.txt", "words": 30000},
    # Испанский — только для подсказок и оценки в браузере (Sombra и т. п.): ударения сводятся к базовой букве, ñ — своя.
    "es": {"alphabet": "abcdefghijklmnñopqrstuvwxyz", "corpus": "corpus_es.txt", "words": 20000, "singles": ("a", "y", "o", "e", "u"), "fold": {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u"}},
}


def build(lang, cfg):
    alpha = cfg["alphabet"]
    n = len(alpha)
    index = {c: i for i, c in enumerate(alpha)}
    text = (DATA / cfg["corpus"]).read_text(encoding="utf-8", errors="ignore")[:READ_LIMIT].lower()
    text = text.replace("ё", "е")
    for src, dst in cfg.get("fold", {}).items():
        text = text.replace(src, dst)

    words = collections.Counter(re.findall(f"[{alpha}]+", text))
    top_words = [w for w, _ in words.most_common(cfg["words"] * 2) if len(w) >= 2 or w in cfg.get("singles", SINGLES)]
    top_words = top_words[: cfg["words"]]

    counts = [0] * (n ** 4)
    letters = [index[c] for c in text if c in index]
    total = 0
    for i in range(len(letters) - 3):
        a, b, c, d = letters[i : i + 4]
        counts[((a * n + b) * n + c) * n + d] += 1
        total += 1
    floor = math.log10(0.01 / total)
    logs = [math.log10(c / total) if c else floor for c in counts]
    lo, hi = floor, max(logs)
    # Квантуем log10-вероятность в байт: 0 = floor, 255 = максимум.
    quant = bytes(round((v - lo) / (hi - lo) * 255) for v in logs)

    freq = collections.Counter(c for c in text if c in index)
    total_letters = sum(freq.values())
    mono = [freq[c] / total_letters for c in alpha]

    # Средняя квадграммная оценка на «нормальном» тексте — для нормировки 0..1.
    sample = letters[:200000]
    s = 0.0
    for i in range(len(sample) - 3):
        a, b, c, d = sample[i : i + 4]
        s += logs[((a * n + b) * n + c) * n + d]
    mean_norm = s / (len(sample) - 3)
    print(lang, "quadgrams total", total, "mean", round(mean_norm, 3), "floor", round(floor, 3), "words", len(top_words))
    return {
        "alphabet": alpha,
        "qMin": lo,
        "qMax": hi,
        "qMean": mean_norm,
        "quad": base64.b64encode(quant).decode(),
        "mono": mono,
        "words": top_words,
    }


def main():
    # --only uk: пересобрать один язык, остальные взять из готового файла (корпуса те же — результат тот же).
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    result = {}
    if only and OUT.exists():
        raw = OUT.read_text(encoding="utf-8")
        result = json.loads(raw[raw.index("=") + 1: raw.rstrip().rindex(";")])
    for lang, cfg in LANGS.items():
        if not only or lang in only:
            result[lang] = build(lang, cfg)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("// Сгенерировано tools/build_lang.py — не редактировать вручную.\nself.LANG_DATA = "
                   + json.dumps(result, ensure_ascii=False) + ";\n", encoding="utf-8")
    print("written", OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
