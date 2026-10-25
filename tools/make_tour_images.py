"""Образцы для примеров «Картинки и файлы» (нужен Pillow; программе он не нужен — образцы уже в web/samples).

    python tools/make_tour_images.py

* lsb-lighthouse.png — сообщение в младших битах R, G, B (старший бит первым, по строкам), затем нулевой байт;
* xor-a.png, xor-b.png — два шумовых кадра: по отдельности шум, XOR даёт число 7319;
* photo-logbook.png — PNG с текстовым чанком tEXt и ZIP-архивом, дописанным после IEND;
* vault.rar — копия tests/fixtures/archives/vault-lighthouse.rar (RAR5, пароль lighthouse, четыре части; см. SOURCE.md).
Всё детерминировано (свой ГПСЧ, фиксированные даты в ZIP).
"""
import base64
import io
import json
import random
import struct
import zipfile
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "web" / "samples"
LSB_MESSAGE = b"The password is NIGHTJAR. The keeper hid the logbook in the lighthouse.\x00"
XOR_TEXT = "7319"
ZIP_DATE = (2026, 10, 25, 12, 0, 0)
LOGBOOK = ("Day 11: fog again, no ships.\n"
           "Day 12: the keeper hid the brass key under the third step.\n"
           "Day 13: storm. Lamp checked at 02:00.\n")


def font(size):
    for name in ("DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def png_bytes(img, text_chunks=()):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=False)
    data = buf.getvalue()
    if not text_chunks:
        return data
    # tEXt вставляем сразу после IHDR (8 байт сигнатуры + 25 байт IHDR).
    head, tail = data[:33], data[33:]
    chunks = b""
    for key, value in text_chunks:
        body = key.encode("latin1") + b"\x00" + value.encode("latin1")
        chunks += struct.pack(">I", len(body)) + b"tEXt" + body + struct.pack(">I", zlib.crc32(b"tEXt" + body) & 0xFFFFFFFF)
    return head + chunks + tail


def lighthouse():
    """Плавная «закатная» картинка с маяком; сообщение в LSB первых пикселей."""
    w, h = 240, 160
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = (int(40 + 180 * y / h), int(30 + 90 * (1 - y / h) + 30 * x / w), int(120 - 60 * y / h))
    d = ImageDraw.Draw(img)
    d.rectangle([160, 60, 176, 140], fill=(235, 235, 225))
    d.polygon([(156, 60), (180, 60), (168, 44)], fill=(200, 40, 40))
    d.rectangle([0, 140, w, h], fill=(20, 40, 70))
    bits = "".join(format(b, "08b") for b in LSB_MESSAGE)
    flat = [c for y in range(h) for x in range(w) for c in px[x, y]]
    for i, bit in enumerate(bits):
        flat[i] = (flat[i] & ~1) | int(bit)
    img = Image.frombytes("RGB", (w, h), bytes(flat))
    return png_bytes(img)


def lsb_plane():
    """Та же картинка с маяком; в младшем бите красного канала нарисована надпись LOOK UP (глазом не видна)."""
    w, h = 240, 160
    base = Image.open(io.BytesIO(lighthouse_base())).convert("RGB")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((w // 2, h // 2), "LOOK UP", fill=255, font=font(40), anchor="mm")
    px, m = base.load(), mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            px[x, y] = ((r & ~1) | (1 if m[x, y] > 127 else 0), g, b)   # надпись — единицы, остальное — нули
    return png_bytes(base)


def lighthouse_base():
    w, h = 240, 160
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = (int(40 + 180 * y / h), int(30 + 90 * (1 - y / h) + 30 * x / w), int(120 - 60 * y / h))
    d = ImageDraw.Draw(img)
    d.rectangle([160, 60, 176, 140], fill=(235, 235, 225))
    d.polygon([(156, 60), (180, 60), (168, 44)], fill=(200, 40, 40))
    d.rectangle([0, 140, w, h], fill=(20, 40, 70))
    return png_bytes(img)


def xor_pair():
    w, h = 220, 90
    rnd = random.Random(7319)
    noise = bytes(rnd.getrandbits(8) for _ in range(w * h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((w // 2, h // 2), XOR_TEXT, fill=255, font=font(64), anchor="mm")
    m = mask.tobytes()
    a = Image.frombytes("L", (w, h), noise).convert("RGB")
    b = Image.frombytes("L", (w, h), bytes(n ^ (255 if v > 127 else 0) for n, v in zip(noise, m))).convert("RGB")
    return png_bytes(a), png_bytes(b)


def logbook_photo():
    img = Image.new("RGB", (180, 110), (24, 30, 38))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 160, 90], outline=(180, 160, 110), width=3)
    d.text((90, 55), "LOGBOOK", fill=(220, 200, 150), font=font(20), anchor="mm")
    png = png_bytes(img, [("Comment", "Not everything ends at IEND.")])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("logbook.txt", ZIP_DATE), LOGBOOK)
    archive = buf.getvalue()
    # Смещения в ZIP считаются от начала файла: пересобираем архив со сдвигом на длину PNG.
    out = io.BytesIO(png)
    out.seek(len(png))
    with zipfile.ZipFile(out, "a", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("logbook.txt", ZIP_DATE), LOGBOOK)
    data = out.getvalue()
    assert data.startswith(png) and len(data) > len(png) + len(archive) // 2
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.read("logbook.txt").decode() == LOGBOOK
    return data


def sample(sid, name, mime, data, comment):
    text = ("// %s\n// Сгенерирован tools/make_tour_images.py. Грузится по требованию, см. js/samples.js.\n"
            "(self.ArgSamples = self.ArgSamples || {})[%s] = { name: %s, mime: %s, data: '%s' };\n"
            % (comment, json.dumps(sid), json.dumps(name), json.dumps(mime), base64.b64encode(data).decode()))
    (SAMPLES / (sid + ".js")).write_text(text, encoding="utf-8", newline="\n")
    print(sid, len(data), "bytes")


def main():
    sample("lsb-lighthouse", "lighthouse.png", "image/png", lighthouse(), "LSB: сообщение в младших битах R, G, B")
    sample("lsb-plane", "lighthouse-plane.png", "image/png", lsb_plane(), "Надпись LOOK UP в младшем бите красного канала")
    a, b = xor_pair()
    sample("xor-a", "noise-a.png", "image/png", a, "XOR двух картинок, кадр A (шум)")
    sample("xor-b", "noise-b.png", "image/png", b, "XOR двух картинок, кадр B (шум, XOR с A даёт 7319)")
    sample("photo-logbook", "logbook.png", "image/png", logbook_photo(), "PNG с tEXt и ZIP после IEND (logbook.txt)")
    rar = (ROOT / "tests" / "fixtures" / "archives" / "vault-lighthouse.rar").read_bytes()
    sample("rar5-vault", "vault.rar", "application/vnd.rar", rar,
           "RAR5 с зашифрованными заголовками, пароль lighthouse, четыре части north/east/south/west")


if __name__ == "__main__":
    main()
