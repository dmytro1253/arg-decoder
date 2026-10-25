"""Локальный OCR: сборка строк по координатам без правки текста и честный статус без пакетов/моделей."""
import base64
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import ocr_backend  # noqa: E402


class GroupLines(unittest.TestCase):
    def test_short_lines_and_order_kept(self):
        blocks = [
            {"text": "007", "score": 0.99, "box": [10, 80, 40, 100]},
            {"text": "12345678901234567890", "score": 0.98, "box": [10, 10, 300, 30]},
            {"text": "42", "score": 0.97, "box": [10, 45, 30, 65]},
        ]
        lines = ocr_backend.group_lines(blocks)
        self.assertEqual([l["text"] for l in lines], ["12345678901234567890", "42", "007"])

    def test_blocks_on_one_line_joined_left_to_right_raw(self):
        blocks = [{"text": "Їжак", "score": 0.9, "box": [120, 10, 200, 30]}, {"text": "Ґанок", "score": 0.95, "box": [10, 12, 100, 31]}]
        lines = ocr_backend.group_lines(blocks)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["text"], "Ґанок Їжак")
        self.assertEqual(lines[0]["confidence"], 90.0)


class Status(unittest.TestCase):
    def test_status_reports_reason(self):
        st = ocr_backend.status()
        self.assertIn("ready", st)
        self.assertTrue(st["experimental"])
        if not st["ready"]:
            self.assertTrue(st["note"])

    def test_bad_language_and_base64_rejected(self):
        with self.assertRaises(ValueError):
            ocr_backend.recognize({"image": "", "lang": "xx"})
        with self.assertRaises(ValueError):
            ocr_backend.recognize({"image": "!!!", "lang": "en"})

    def test_manifest_pins_versions_and_hashes(self):
        m = ocr_backend.manifest()
        self.assertIn("rapidocr==3.10.0", m["packages"])
        for item in m["models"]:
            self.assertEqual(len(item["sha256"]), 64)
            self.assertTrue(item["url"].startswith("https://"))

    @unittest.skipUnless(ocr_backend.status()["ready"], "RapidOCR не установлен (python setup_ocr.py)")
    def test_real_png_digits(self):
        png = Path(__file__).resolve().parent / "fixtures" / "ocr-lines.png"
        if not png.exists():
            self.skipTest("нет tests/fixtures/ocr-lines.png")
        r = ocr_backend.recognize({"image": base64.b64encode(png.read_bytes()).decode(), "lang": "en"})
        self.assertEqual(r["status"], "ok")
        self.assertIn("42", r["text"].split("\n"))


if __name__ == "__main__":
    unittest.main()
