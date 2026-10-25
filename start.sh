#!/bin/bash
# ARG Decoder — by Dmytro. Запуск из терминала (Linux и macOS): ./start.sh
# Terminal launcher (Linux and macOS). First run installs numpy and dictionaries.
cd "$(dirname "$0")" || exit 1
PY=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" tools/pycheck.py >/dev/null 2>&1; then PY="$cand"; break; fi
done
if [ -n "$PY" ]; then
  exec "$PY" launcher.py "$@"
fi
echo "Нужен Python 3.9+ (и пакет python3-venv на Debian/Ubuntu) / Python 3.9+ is needed (plus python3-venv on Debian/Ubuntu)."
echo "Открываю офлайн-версию / Opening the offline version."
(command -v xdg-open >/dev/null && xdg-open web/index.html) || open web/index.html
