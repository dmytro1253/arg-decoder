#!/bin/bash
# ARG Decoder — by Dmytro. Двойной клик в Finder (первый раз: правый клик → «Открыть»).
# Double-click in Finder (the first time: right-click → Open).
# Первый запуск сам ставит numpy и словари, дальше программа запускается сразу.
cd "$(dirname "$0")" || exit 1
PY=""
for cand in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /Library/Frameworks/Python.framework/Versions/Current/bin/python3; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" tools/pycheck.py >/dev/null 2>&1; then PY="$cand"; break; fi
done
if [ -n "$PY" ]; then
  "$PY" launcher.py "$@" || { echo; echo "[!] Ошибка — подробности выше. Попробуй: ./Start-Mac.command --repair"; echo "[!] Error — see above. Try: ./Start-Mac.command --repair"; read -r -p "Enter…"; }
else
  echo "Нужен Python 3.9+: https://www.python.org/downloads/macos/ (установщик .pkg, потом снова двойной клик)."
  echo "Python 3.9+ is needed: https://www.python.org/downloads/macos/ (run the .pkg installer, then double-click again)."
  echo "Пока открываю офлайн-версию / Opening the offline version for now."
  open "web/index.html"
  read -r -p "Enter…"
fi
