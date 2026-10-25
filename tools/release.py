"""Сборка подписанного релиза программы для обновления у пользователей.

    python tools/release.py --keygen     создать ключ подписи (один раз; хранить в тайне и в резервной копии)
    python tools/release.py              собрать dist/arg-decoder-X.Y.Z.{zip,build.json,build.sig}
    python tools/release.py --publish    собрать и выложить релиз vX.Y.Z на GitHub (нужен gh)

Файлы берутся из коммита HEAD (`git archive`), а не из рабочей папки: дерево должно быть чистым,
версия в version.py, package.json и CHANGELOG.md — одна. Ключ: ARGDEC_SIGNING_KEY или
~/.argdec/release-signing.key. Его открытая половина должна быть в updater.TRUSTED_KEYS.
"""
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import ed25519_ref  # noqa: E402
import updater  # noqa: E402
from version import APP_VERSION  # noqa: E402

DIST = ROOT / "dist"
KEY_ID = "dmytro-2026"
DEFAULT_KEY = Path.home() / ".argdec" / "release-signing.key"


def git(*args, binary=False):
    out = subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf"] + list(args), cwd=str(ROOT),
                         capture_output=True, check=True)
    return out.stdout if binary else out.stdout.decode("utf-8").strip()


def key_path():
    return Path(os.environ.get("ARGDEC_SIGNING_KEY") or DEFAULT_KEY)


def keygen():
    path = key_path()
    if path.exists():
        sys.exit("Ключ уже есть: %s — новый не создаю, чтобы не потерять старый" % path)
    secret = os.urandom(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"key": KEY_ID, "secret": secret.hex(), "public": ed25519_ref.public_key(secret).hex()}), encoding="utf-8")
    if os.name != "nt":
        path.chmod(0o600)
    print("Ключ записан: %s\nОткрытый ключ для updater.TRUSTED_KEYS[%r]:\n%s" % (path, KEY_ID, ed25519_ref.public_key(secret).hex()))


def load_key():
    try:
        data = json.loads(key_path().read_text(encoding="utf-8"))
        secret = bytes.fromhex(data["secret"])
    except (OSError, ValueError, KeyError):
        sys.exit("Нет ключа подписи %s (python tools/release.py --keygen)" % key_path())
    public = ed25519_ref.public_key(secret).hex()
    if updater.TRUSTED_KEYS.get(data["key"]) != public:
        sys.exit("Открытый ключ %s не записан в updater.TRUSTED_KEYS — программа не примет такую подпись" % data["key"])
    return data["key"], secret


def check_tree():
    if git("status", "--porcelain"):
        sys.exit("В рабочей папке есть незакоммиченные изменения — релиз собирается из коммита")
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if pkg != APP_VERSION:
        sys.exit("Версия в package.json (%s) не совпадает с version.py (%s)" % (pkg, APP_VERSION))
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    if not re.search(r"^## %s\b" % re.escape(APP_VERSION), changelog, re.M):
        sys.exit("В CHANGELOG.md нет раздела ## %s" % APP_VERSION)


def release_notes():
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    m = re.search(r"^## %s\b.*?$(.*?)(?=^## |\Z)" % re.escape(APP_VERSION), text, re.M | re.S)
    return (m.group(1).strip() if m else "") + "\n\nThe update is signed; ARG Decoder 1.3.0+ offers it and installs it itself."


def collect():
    """(путь, байты, исполняемый) каждого файла коммита HEAD с концами строк по .gitattributes."""
    tar = tarfile.open(fileobj=io.BytesIO(git("archive", "--format=tar", "HEAD", binary=True)))
    files = []
    for m in tar.getmembers():
        if m.isfile():
            if not updater.safe_path(m.name):
                sys.exit("Файл %s нельзя положить в обновление (защищённая папка или имя)" % m.name)
            files.append((m.name, tar.extractfile(m).read(), bool(m.mode & 0o111)))
    return sorted(files)


def build():
    check_tree()
    key_id, secret = load_key()
    commit = git("rev-parse", "HEAD")
    date = git("show", "-s", "--format=%cI", "HEAD")
    files = collect()
    manifest = {"format": updater.MANIFEST_FORMAT, "app": updater.APP_ID, "repo": updater.repo(), "version": APP_VERSION,
                "commit": commit, "date": date, "key": key_id,
                "files": [{"path": p, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), **({"exec": True} if x else {})}
                          for p, b, x in files]}
    raw = (json.dumps(manifest, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    sig = updater.sign_text(secret, key_id, raw)
    updater.verify_manifest(raw, sig)
    name = "%s-%s" % (updater.APP_ID, APP_VERSION)
    DIST.mkdir(exist_ok=True)
    stamp = tuple(int(x) for x in re.findall(r"\d+", date)[:6])
    zpath = DIST / (name + ".zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path, data, executable in files + [(updater.BUILD_FILE, raw, False), (updater.BUILD_SIG, sig.encode("utf-8"), False)]:
            info = zipfile.ZipInfo("%s/%s" % (name, path), stamp)
            info.external_attr = (0o100755 if executable else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    (DIST / (name + ".build.json")).write_bytes(raw)
    (DIST / (name + ".build.sig")).write_bytes(sig.encode("utf-8"))   # байтами: без CRLF на Windows
    with tempfile.TemporaryDirectory() as tmp:   # проверяем своё же: архив проходит ту же проверку, что у пользователя
        updater.extract_verified(zpath, manifest, raw, sig, Path(tmp) / "staging")
    print("Собрано: %s (%d файлов, %.1f МБ), сборка %s, коммит %s" % (zpath, len(files), zpath.stat().st_size / 1048576, updater.build_id(raw), commit[:10]))
    return [zpath, DIST / (name + ".build.json"), DIST / (name + ".build.sig")]


def publish(assets):
    tag = "v" + APP_VERSION
    commit = git("rev-parse", "HEAD")
    if git("rev-parse", "origin/main") != commit:
        sys.exit("HEAD не совпадает с origin/main — сначала git push")
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as notes:
        notes.write(release_notes())
    subprocess.run(["gh", "release", "create", tag, "--repo", updater.repo(), "--target", commit, "--title", "ARG Decoder " + APP_VERSION,
                    "--notes-file", notes.name, "--latest"] + [str(a) for a in assets], check=True)
    os.unlink(notes.name)


if __name__ == "__main__":
    if "--keygen" in sys.argv:
        keygen()
    else:
        built = build()
        if "--publish" in sys.argv:
            publish(built)
