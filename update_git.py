"""Обновление клона git до подписанного релиза (вызывается из updater.py).

Клону не нужен архив: нужный коммит приходит через `git fetch` тега vX.Y.Z, а верят ему потому, что его
хеш записан в подписанном build.json релиза — git проверяет содержимое каждого объекта по хешу. Обновление
идёт только перемоткой вперёд (`merge --ff-only`) и только без незакоммиченных изменений; откат —
`reset --keep`, который не трогает чужие правки. Стандартная библиотека и программа git, больше ничего.
"""
import os
import re
import shutil
import subprocess

TIMEOUT = 180
COMMIT = re.compile(r"^[0-9a-f]{40}$")


class GitError(Exception):
    """Команда git не выполнилась; текст — понятная причина."""


def available(root):
    return (root / ".git").exists() and shutil.which("git") is not None


def run(root, *args):
    # Без вопросов о пароле и с английскими сообщениями: запускатор и сервер не интерактивны.
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", LC_ALL="C", LANG="C")
    try:
        out = subprocess.run(["git", "-c", "core.hooksPath=", *args], cwd=str(root), capture_output=True, text=True,
                             encoding="utf-8", errors="replace", timeout=TIMEOUT, env=env)
    except (OSError, subprocess.SubprocessError) as exc:
        raise GitError("git не запустился: %s" % exc) from None
    if out.returncode != 0:
        raise GitError((out.stderr or out.stdout or "git %s: код %d" % (args[0], out.returncode)).strip().splitlines()[-1][:300])
    return out.stdout.rstrip()   # только справа: у строк git status в начале значимый пробел (« M файл»)


def head(root):
    return run(root, "rev-parse", "HEAD")


def ready(root):
    """(True, '') — клон можно перематывать: есть ветка и нет незакоммиченных изменений отслеживаемых файлов."""
    try:
        run(root, "symbolic-ref", "-q", "HEAD")
    except GitError:
        return False, "клон git не на ветке (detached HEAD) — обнови вручную: git pull"
    try:
        dirty = run(root, "status", "--porcelain", "--untracked-files=no")
    except GitError as exc:
        return False, "git status не выполнился: %s" % exc
    if dirty:
        files = [line[3:] for line in dirty.splitlines()][:5]
        return False, "в клоне есть незакоммиченные изменения (%s) — закоммить или убери их (git stash), потом обнови" % ", ".join(files)
    return True, ""


def fetch_tag(root, tag):
    """Забирает тег релиза из origin и возвращает его коммит."""
    if not re.match(r"^v\d+\.\d+\.\d+$", tag):
        raise GitError("неверное имя тега %s" % tag)
    run(root, "fetch", "--no-tags", "origin", "+refs/tags/%s:refs/tags/%s" % (tag, tag))
    return run(root, "rev-parse", "%s^{commit}" % tag)


def is_ancestor(root, older, newer):
    try:
        run(root, "merge-base", "--is-ancestor", older, newer)
        return True
    except GitError:
        return False


def fast_forward(root, commit):
    run(root, "merge", "--ff-only", "--no-edit", commit)


def reset_keep(root, commit):
    run(root, "reset", "--keep", commit)


def changed(root, a, b):
    try:
        return [p for p in run(root, "diff", "--name-only", a, b).splitlines() if p]
    except GitError:
        return []
