"""Разработческий помощник тестов: декодирует JPEG/PNG в сырой RGBA (Pillow).
Формат файла: 4 байта ширина (LE), 4 байта высота (LE), затем RGBA. Использование:
    python decode.py <картинка> <выходной.rgba>
Браузерный код проекта от Pillow не зависит — это нужно только приёмочным тестам."""
import struct
import sys

from PIL import Image


def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert("RGBA")
    with open(dst, "wb") as f:
        f.write(struct.pack("<II", im.width, im.height))
        f.write(im.tobytes())


if __name__ == "__main__":
    main()
