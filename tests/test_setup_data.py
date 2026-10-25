"""Тесты первой установки словарей: проверка манифеста и безопасная распаковка."""
import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import setup_data  # noqa: E402


class SetupDataTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.data = self.tmp / "data"
        payload = b"hello dictionary\n"
        self.files = [{"name": "words_xx.txt", "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}]
        self.zip = self.tmp / "d.zip"
        with zipfile.ZipFile(self.zip, "w") as z:
            z.writestr("data/words_xx.txt", payload)
            z.writestr("data/../evil.txt", b"no")  # путь с выходом из папки должен игнорироваться
        self.manifest = {"version": "t", "zip": "d.zip", "files": self.files,
                         "zip_bytes": self.zip.stat().st_size, "zip_sha256": setup_data.sha256(self.zip)}

    def patched(self):
        return mock.patch.multiple(setup_data, DATA=self.data, DOWNLOADS=self.tmp, load_manifest=mock.MagicMock(return_value=self.manifest))

    def test_missing_files_detected(self):
        with self.patched():
            self.assertEqual(setup_data.check_data(self.manifest, full=True), ["words_xx.txt"])

    def test_install_from_release_verifies_and_extracts_safely(self):
        with self.patched(), mock.patch.object(setup_data, "download", return_value=True):
            self.assertTrue(setup_data.install_from_release(self.manifest, "http://example.invalid/d.zip"))
            self.assertEqual(setup_data.check_data(self.manifest, full=True), [])
            self.assertFalse((self.tmp / "evil.txt").exists())

    def test_corrupt_archive_rejected(self):
        bad = dict(self.manifest, zip_sha256="0" * 64)
        with self.patched():
            self.assertFalse(setup_data.install_from_release(bad, "http://example.invalid/d.zip"))

    def fake_sources(self, argv):
        """Подмена vigenere.download_data.main: «скачивает» словари, которые отличаются от манифеста."""
        self.data.mkdir(exist_ok=True)
        for name in setup_data.SOURCE_REQUIRED:
            (self.data / name).write_text("other export of " + name, encoding="utf-8")
        return 0

    def test_install_from_sources_is_accepted_on_next_launch(self):
        # Релиз отвечает 404 → данные из первоисточников; они не совпадают с манифестом, но следующий запуск их принимает.
        fake = mock.MagicMock(main=self.fake_sources)
        import vigenere
        with self.patched(), mock.patch.dict(sys.modules, {"vigenere.download_data": fake}),                 mock.patch.object(vigenere, "download_data", fake, create=True), mock.patch.object(setup_data, "data_url", return_value=""):
            self.assertTrue(setup_data.ensure_data())
            self.assertTrue(setup_data.check_data(self.manifest, full=False), "файлы и правда отличаются от манифеста")
            self.assertTrue(setup_data.sources_ready())
            self.assertTrue(setup_data.data_ready(self.manifest))
            with mock.patch.object(setup_data, "install_from_sources", side_effect=AssertionError("повторная загрузка")):
                self.assertTrue(setup_data.ensure_data())   # второй запуск ничего не качает
            (self.data / "words_en.txt").write_text("cut", encoding="utf-8")
            self.assertFalse(setup_data.data_ready(self.manifest), "изменённый файл — повторная установка")

    def test_release_install_drops_source_mark(self):
        with self.patched(), mock.patch.object(setup_data, "download", return_value=True),                 mock.patch.object(setup_data, "data_url", return_value="http://example.invalid/d.zip"):
            self.data.mkdir(exist_ok=True)
            (self.data / setup_data.SOURCE_MARK).write_text("{}", encoding="utf-8")
            self.assertTrue(setup_data.ensure_data())
            self.assertFalse((self.data / setup_data.SOURCE_MARK).exists())
            self.assertTrue(setup_data.data_ready(self.manifest, full=True))

    def test_placeholder_url_ignored(self):
        with mock.patch.dict("os.environ", {"ARGDEC_DATA_URL": ""}):
            cfg = self.tmp / "release.json"
            cfg.write_text(json.dumps({"data_url": "https://github.com/OWNER/REPO/x.zip"}), encoding="utf-8")
            with mock.patch.object(setup_data, "CONFIG", cfg):
                self.assertEqual(setup_data.data_url(), "")


if __name__ == "__main__":
    unittest.main()
