"""Тесты серверной части: python -m unittest discover -s tests -p "test_*.py" """
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import backend  # noqa: E402

try:
    import numpy  # noqa: F401
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

# Словари не хранятся в репозитории (скачиваются при первом запуске) — без них часть тестов пропускается.
HAS_DATA = (Path(__file__).resolve().parent.parent / "data" / "words_en.txt").exists()


class DiagnosticsTest(unittest.TestCase):
    def test_structure(self):
        d = backend.diagnostics()
        for key in ("app", "python", "libraries", "gpu", "engine", "data", "hashing", "models", "errors"):
            self.assertIn(key, d)
        if not HAS_DATA:
            return
        self.assertTrue(d["data"]["exists"], "нет папки data")
        names = {f["name"] for f in d["data"]["files"]}
        for need in ("words_en.txt", "words_ru.txt", "corpus_en.txt", "corpus_ru.txt"):
            self.assertIn(need, names)

    @unittest.skipUnless(HAS_DATA, "словари не скачаны")
    def test_hashing(self):
        backend.hash_data()
        self.assertEqual(backend.STATE["hashing"]["status"], "готово")
        self.assertEqual(len(backend.STATE["hashing"]["files"]["words_en.txt"]), 64)


@unittest.skipUnless(HAS_NUMPY and HAS_DATA, "нужны numpy и словари")
class VigenereJobTest(unittest.TestCase):
    def run_job(self, text, **params):
        job = backend.start_job(dict(text=text, gpu=False, **params))
        deadline = time.time() + 120
        status = backend.job_status(job["id"])
        while status["status"] == "идёт" and time.time() < deadline:
            time.sleep(0.5)
            status = backend.job_status(job["id"])
        return status

    def test_finds_key(self):
        s = self.run_job("mdw tuuk eizq a haf isecuufr mlewwf")
        self.assertEqual(s["status"], "готово")
        self.assertEqual(s["rows"][0]["key"], "mslan")

    def test_russian_full_dictionary(self):
        s = self.run_job("ыошл д щуабй ыкбоу кяязльй")
        self.assertEqual(s["rows"][0]["plain"], "карл у клары украл кораллы")

    def test_bad_input(self):
        with self.assertRaises(ValueError):
            backend.start_job({"text": "   "})

    def test_user_key_always_listed_and_visible(self):
        # Ключ, переданный явно, проверяется напрямую и не хоронится штрафом за длину ключа.
        s = self.run_job("lrot dq xeiefh", keys=["ENDERMITE"], mode="brute", max_len=3)
        rows = [r for r in s["rows"] if r["key"] == "endermite"]
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["user"])
        self.assertEqual(rows[0]["plain"], "help me please")
        self.assertEqual(s["rows"][0]["key"], "endermite")

    def test_python_engine_keeps_case(self):
        s = self.run_job("LMVCCIKB", keys=["LUCY"], mode="brute", max_len=4)
        plains = [r["plain"] for r in s["rows"] if r["key"] == "lucy"]
        self.assertEqual(plains, ["ASTEROID"])

    def test_truncated_input_is_reported(self):
        long_text = "abcdefghij" * (backend.MAX_TEXT // 10 + 20)
        job = backend.start_job(dict(text=long_text, gpu=False, mode="freq", max_len=2, restarts=1))
        self.assertEqual(job["truncated"]["to"], backend.MAX_TEXT)
        self.assertEqual(job["truncated"]["from"], len(long_text))
        backend.stop_job(job["id"])
        deadline = time.time() + 60
        while backend.job_status(job["id"])["status"] == "идёт" and time.time() < deadline:
            time.sleep(0.3)


class CaseTemplateTest(unittest.TestCase):
    @unittest.skipUnless(HAS_NUMPY, "numpy не установлен")
    def test_layout_render_restores_case(self):
        from vigenere import core
        alpha = core.get_alphabet("en-26")
        idx, tmpl = alpha.layout("Hello, World!")
        self.assertEqual(alpha.render(idx, tmpl), "Hello, World!")


class YoutubeStatusTest(unittest.TestCase):
    def test_403_is_denied_and_not_cached(self):
        import io
        import urllib.error
        from unittest import mock
        import server
        err = urllib.error.HTTPError("https://www.youtube.com/oembed", 403, "Forbidden", {}, io.BytesIO(b""))
        server.CACHE.pop("abcdefghijk", None)
        with mock.patch.object(server.urllib.request, "urlopen", side_effect=err):
            result = server.check_youtube("abcdefghijk")
        self.assertEqual(result["status"], "denied")
        self.assertNotIn("abcdefghijk", server.CACHE)
        err404 = urllib.error.HTTPError("https://www.youtube.com/oembed", 404, "Not Found", {}, io.BytesIO(b""))
        with mock.patch.object(server.urllib.request, "urlopen", side_effect=err404):
            self.assertEqual(server.check_youtube("abcdefghijl")["status"], "not_found")


if __name__ == "__main__":
    unittest.main()
