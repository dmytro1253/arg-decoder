"""Код выхода 0, если этот Python подходит программе (3.9+, 64 бита)."""
import struct
import sys

sys.exit(0 if sys.version_info >= (3, 9) and struct.calcsize("P") == 8 else 1)
