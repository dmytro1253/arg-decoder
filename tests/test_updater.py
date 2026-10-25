"""Тесты обновления: подпись Ed25519, проверка архива, установка с откатом, выбор релиза."""
import hashlib
import json
import os
import shutil
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import ed25519_ref  # noqa: E402
import updater  # noqa: E402

SECRET = bytes(range(32))
KEY_ID = "test-key"
REPO = "dmytro1253/arg-decoder"


def make_build(files, version, exec_paths=()):
    """Подписанный build.json и подпись для набора {путь: байты}."""
    manifest = {"format": 1, "app": "arg-decoder", "repo": REPO, "version": version, "commit": "c" * 40, "date": "2026-10-25",
                "key": KEY_ID, "files": [{"path": p, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
                                          **({"exec": True} if p in exec_paths else {})} for p, b in sorted(files.items())]}
    raw = (json.dumps(manifest, indent=1) + "\n").encode("utf-8")
    return manifest, raw, updater.sign_text(SECRET, KEY_ID, raw)


def make_zip(path, files, version, raw, sig, extra=None):
    top = "arg-decoder-%s/" % version
    with zipfile.ZipFile(path, "w") as z:
        for p, b in files.items():
            z.writestr(top + p, b)
        z.writestr(top + "build.json", raw)
        z.writestr(top + "build.sig", sig)
        for name, b in (extra or {}).items():
            z.writestr(name, b)
    return path


class Ed25519Test(unittest.TestCase):
    def test_rfc8032_vectors(self):
        sk = bytes.fromhex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb")
        pk = ed25519_ref.public_key(sk)
        self.assertEqual(pk.hex(), "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c")
        sig = ed25519_ref.sign(sk, b"\x72")
        self.assertEqual(sig.hex(), "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da"
                                    "085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00")
        self.assertTrue(ed25519_ref.verify(pk, b"\x72", sig))
        self.assertFalse(ed25519_ref.verify(pk, b"\x73", sig))
        self.assertFalse(ed25519_ref.verify(pk, b"\x72", sig[:-1] + bytes([sig[-1] ^ 1])))
        self.assertFalse(ed25519_ref.verify(pk, b"\x72", b"\0" * 64))


class UpdaterBase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.root = self.tmp / "app"
        self.root.mkdir()
        self.patches = mock.patch.multiple(updater, ROOT=self.root, UPDATE_DIR=self.root / "runtime" / "update",
                                           CONFIG=self.root / "config" / "release.json", APP_VERSION="1.3.0",
                                           TRUSTED_KEYS={KEY_ID: ed25519_ref.public_key(SECRET).hex()})
        self.patches.start()
        self.addCleanup(self.patches.stop)
        self.addCleanup(shutil.rmtree, self.tmp, True)
        updater.STATE.update(phase="idle", error=None)

    def install(self, files, version):
        """Установленная сборка: файлы программы, build.json/build.sig и данные пользователя."""
        for p, b in files.items():
            (self.root / p).parent.mkdir(parents=True, exist_ok=True)
            (self.root / p).write_bytes(b)
        _, raw, sig = make_build(files, version)
        (self.root / "build.json").write_bytes(raw)
        (self.root / "build.sig").write_text(sig, encoding="utf-8")
        (self.root / "data").mkdir(exist_ok=True)
        (self.root / "data" / "words_en.txt").write_bytes(b"user dictionary")

    def stage(self, files, version, exec_paths=()):
        manifest, raw, sig = make_build(files, version, exec_paths)
        zpath = make_zip(self.tmp / "u.zip", files, version, raw, sig)
        blobs = {"https://github.com/%s/releases/download/v%s/m" % (REPO, version): raw,
                 "https://github.com/%s/releases/download/v%s/s" % (REPO, version): sig.encode()}
        info = {"latest": version, "urls": {"manifest": list(blobs)[0], "sig": list(blobs)[1],
                                            "zip": "https://github.com/%s/releases/download/v%s/z.zip" % (REPO, version)}}
        return updater.stage(info, fetch_bytes=blobs.__getitem__, fetch_file=lambda u, t: shutil.copyfile(zpath, t))


OLD = {"launcher.py": b"old launcher", "web/app.js": b"old app", "web/old.js": b"removed later", "start.sh": b"#!/bin/sh\n"}
NEW = {"launcher.py": b"new launcher", "web/app.js": b"new app", "web/new/feature.js": b"added", "start.sh": b"#!/bin/sh\n"}


class ManifestTest(UpdaterBase):
    def test_signature_and_tampering(self):
        manifest, raw, sig = make_build({"a.txt": b"x"}, "1.4.0")
        self.assertEqual(updater.verify_manifest(raw, sig)["version"], "1.4.0")
        with self.assertRaisesRegex(updater.UpdateError, "подпись не сходится"):
            updater.verify_manifest(raw.replace(b"1.4.0", b"9.4.0"), sig)
        with self.assertRaisesRegex(updater.UpdateError, "неизвестным ключом"):
            updater.verify_manifest(raw, sig.replace(KEY_ID, "other"))
        other = updater.sign_text(bytes(32), KEY_ID, raw)   # подпись чужим секретом под тем же именем ключа
        with self.assertRaises(updater.UpdateError):
            updater.verify_manifest(raw, other)

    def test_unsafe_paths_rejected_even_when_signed(self):
        for bad in ("../evil.py", "/etc/passwd", "data/words_en.txt", "runtime/x", ".git/config", "a\\b.py", "C:/x", "a//b", "build.json"):
            self.assertFalse(updater.safe_path(bad), bad)
            _, raw, sig = make_build({bad: b"x"}, "1.4.0")
            with self.assertRaises(updater.UpdateError, msg=bad):
                updater.verify_manifest(raw, sig)
        _, raw, sig = make_build({"Web/A.js": b"1", "web/a.js": b"2"}, "1.4.0")
        with self.assertRaisesRegex(updater.UpdateError, "дважды"):
            updater.verify_manifest(raw, sig)

    def test_extract_rejects_extra_changed_and_escaping_files(self):
        files = {"a.txt": b"hello", "web/b.js": b"code"}
        manifest, raw, sig = make_build(files, "1.4.0")
        good = make_zip(self.tmp / "good.zip", files, "1.4.0", raw, sig)
        updater.extract_verified(good, manifest, raw, sig, self.tmp / "st")
        self.assertEqual((self.tmp / "st" / "web" / "b.js").read_bytes(), b"code")
        cases = {
            "лишний файл": make_zip(self.tmp / "x1.zip", dict(files, **{"evil.py": b"x"}), "1.4.0", raw, sig),
            "хеш": make_zip(self.tmp / "x2.zip", dict(files, **{"a.txt": b"HELLO"}), "1.4.0", raw, sig),
            "вне папки": make_zip(self.tmp / "x3.zip", files, "1.4.0", raw, sig, extra={"../escape.txt": b"x"}),
            "нет файлов": make_zip(self.tmp / "x4.zip", {"a.txt": b"hello"}, "1.4.0", raw, sig),
        }
        crlf = make_zip(self.tmp / "crlf.zip", files, "1.4.0", raw, sig.replace("\n", "\r\n"))   # подпись с CRLF из Windows
        updater.extract_verified(crlf, manifest, raw, sig, self.tmp / "st")
        for reason, zpath in cases.items():
            with self.assertRaisesRegex(updater.UpdateError, reason):
                updater.extract_verified(zpath, manifest, raw, sig, self.tmp / "st")
        self.assertFalse((self.tmp / "escape.txt").exists())


class InstallTest(UpdaterBase):
    def test_full_update_keeps_user_data_and_removes_only_old_build_files(self):
        self.install(OLD, "1.3.0")
        (self.root / "my-notes.txt").write_bytes(b"not part of the program")
        self.assertEqual(updater.build_info()["kind"], "release")
        self.assertTrue(updater.verify_install()["ok"])
        self.stage(NEW, "1.4.0", exec_paths=("start.sh",))
        self.assertEqual(updater.pending()["version"], "1.4.0")
        self.assertTrue(updater.apply_pending(log=lambda m: None))
        for p, b in NEW.items():
            self.assertEqual((self.root / p).read_bytes(), b, p)
        self.assertFalse((self.root / "web" / "old.js").exists())
        self.assertEqual((self.root / "data" / "words_en.txt").read_bytes(), b"user dictionary")
        self.assertEqual((self.root / "my-notes.txt").read_bytes(), b"not part of the program")
        self.assertIsNone(updater.pending())
        self.assertFalse((self.root / "runtime" / "update" / "staging").exists())
        with mock.patch.object(updater, "APP_VERSION", "1.4.0"):
            info = updater.build_info()
            self.assertEqual((info["kind"], info["version"], info["consistent"]), ("release", "1.4.0", True))
            self.assertTrue(updater.verify_install()["ok"])
            self.assertEqual(updater.rollback(log=lambda m: None), "1.3.0")
        for p, b in OLD.items():
            self.assertEqual((self.root / p).read_bytes(), b, p)
        self.assertFalse((self.root / "web" / "new").exists())
        self.assertTrue(updater.verify_install()["ok"])

    def test_failure_midway_rolls_back_everything(self):
        self.install(OLD, "1.3.0")
        self.stage(NEW, "1.4.0")
        real, calls = updater._copy_atomic, []

        def flaky(src, dst, executable=False):
            calls.append(dst)
            if len(calls) == 2:
                raise OSError("disk full")
            return real(src, dst, executable)
        with mock.patch.object(updater, "_copy_atomic", flaky):
            with self.assertRaisesRegex(updater.UpdateError, "disk full"):
                updater.apply_pending(log=lambda m: None)
        for p, b in OLD.items():
            self.assertEqual((self.root / p).read_bytes(), b, p)
        self.assertFalse((self.root / "web" / "new" / "feature.js").exists())
        self.assertTrue(updater.verify_install()["ok"])

    def test_interrupted_install_is_recovered_on_next_start(self):
        self.install(OLD, "1.3.0")
        self.stage(NEW, "1.4.0")
        real = updater._write_journal

        def crash_after_plan(journal):
            real(journal)
            if journal["state"] == "applying":
                (self.root / "launcher.py").write_bytes(b"half-written")
                raise KeyboardInterrupt   # «выключили компьютер» после записи плана
        with mock.patch.object(updater, "_write_journal", crash_after_plan), self.assertRaises(KeyboardInterrupt):
            updater.apply_pending(log=lambda m: None)
        self.assertTrue(updater.recover(log=lambda m: None))
        self.assertEqual((self.root / "launcher.py").read_bytes(), b"old launcher")
        self.assertTrue(updater.verify_install()["ok"])
        self.assertFalse(updater.recover(log=lambda m: None))

    def test_downgrade_and_tampered_staging_are_refused(self):
        self.install(OLD, "1.3.0")
        with self.assertRaisesRegex(updater.UpdateError, "не новее"):
            self.stage(NEW, "1.3.0")
        self.stage(NEW, "1.4.0")
        (self.root / "runtime" / "update" / "staging" / "web" / "app.js").write_bytes(b"new apX")
        with self.assertRaisesRegex(updater.UpdateError, "изменился"):
            updater.apply_pending(log=lambda m: None)
        self.assertEqual((self.root / "launcher.py").read_bytes(), b"old launcher")
        self.assertIsNone(updater.pending())

    def test_verify_install_reports_modified_and_missing(self):
        self.install(OLD, "1.3.0")
        (self.root / "web" / "app.js").write_bytes(b"old apX")
        (self.root / "start.sh").unlink()
        res = updater.verify_install()
        self.assertEqual((res["ok"], res["modified"], res["missing"]), (False, ["web/app.js"], ["start.sh"]))
        (self.root / "build.json").write_bytes((self.root / "build.json").read_bytes().replace(b"1.3.0", b"1.3.1"))
        self.assertEqual(updater.build_info()["kind"], "unverified")

    def test_git_checkout_is_not_updated_from_archive(self):
        (self.root / ".git").mkdir()
        (self.root / ".git" / "HEAD").write_text("ref: refs/heads/main\n")
        (self.root / ".git" / "refs" / "heads").mkdir(parents=True)
        (self.root / ".git" / "refs" / "heads" / "main").write_text("a" * 40 + "\n")
        self.assertEqual(updater.build_info(), {"kind": "git", "version": "1.3.0", "commit": "a" * 40, "signed": False})
        self.assertEqual(updater.install_mode()[0], "git")
        with self.assertRaisesRegex(updater.UpdateError, "git pull"):
            self.stage(NEW, "1.4.0")


def release(tag, assets=True, **kw):
    base = "https://github.com/%s/releases/download/%s/" % (REPO, tag)
    ver = tag.lstrip("v")
    names = ["arg-decoder-%s%s" % (ver, ext) for ext in (".zip", ".build.json", ".build.sig")] if assets else []
    return dict({"tag_name": tag, "html_url": "https://github.com/%s/releases/tag/%s" % (REPO, tag), "body": "notes " + tag,
                 "assets": [{"name": n, "browser_download_url": base + n} for n in names]}, **kw)


class CheckTest(UpdaterBase):
    def test_latest_release_ignores_data_drafts_prereleases(self):
        rels = [release("data-v1"), release("v1.3.0"), release("v1.5.0", draft=True), release("v1.6.0", prerelease=True), release("v1.4.2")]
        best = updater.latest_release(rels)
        self.assertEqual(best["version"], "1.4.2")
        self.assertTrue(best["urls"]["zip"].endswith("/v1.4.2/arg-decoder-1.4.2.zip"))
        foreign = release("v1.4.3")
        foreign["assets"][0]["browser_download_url"] = "https://evil.example/arg-decoder-1.4.3.zip"
        self.assertIsNone(updater.latest_release([foreign])["urls"])

    def test_check_statuses_and_cache(self):
        self.install(OLD, "1.3.0")
        res = updater.check(force=True, fetch=lambda url: [release("v1.4.0"), release("data-v1")])
        self.assertEqual((res["status"], res["latest"], res["can_install"]), ("update", "1.4.0", True))
        self.assertEqual(updater.check(fetch=lambda url: self.fail("cache must be used"))["latest"], "1.4.0")
        self.assertEqual(updater.check(force=True, fetch=lambda url: [release("v1.3.0")])["status"], "current")
        no_assets = updater.check(force=True, fetch=lambda url: [release("v1.4.0", assets=False)])
        self.assertEqual((no_assets["status"], no_assets["can_install"]), ("update", False))
        self.assertIn("нет подписанного архива", no_assets["mode_reason"])

        def offline(url):
            raise OSError("no network")
        self.assertEqual(updater.check(force=True, fetch=offline)["status"], "error")
        with mock.patch.dict(os.environ, {"ARGDEC_OFFLINE": "1"}):
            self.assertEqual(updater.check(force=True)["status"], "offline")


if __name__ == "__main__":
    unittest.main()
