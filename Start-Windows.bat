@echo off
chcp 65001 >nul
title ARG Decoder - by Dmytro
cd /d "%~dp0"

rem Первый запуск всё ставит сам (Python при необходимости, numpy, словари), дальше - сразу запуск.
rem First run installs everything itself (Python if needed, numpy, dictionaries); later runs start at once.
set "PY="
if exist "runtime\python\python.exe" set "PY=runtime\python\python.exe"
if not defined PY where py >nul 2>nul && py -3 tools\pycheck.py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && python tools\pycheck.py >nul 2>nul && set "PY=python"
if not defined PY where python3 >nul 2>nul && python3 tools\pycheck.py >nul 2>nul && set "PY=python3"
if not defined PY call :bootstrap
if not defined PY goto :nopython

%PY% launcher.py %*
if errorlevel 1 (
    echo.
    echo [!] Программа завершилась с ошибкой - подробности выше. Запусти ещё раз; не помогло - Start-Windows.bat --repair
    echo [!] The program stopped with an error - see above. Run it again; if that fails - Start-Windows.bat --repair
    pause
)
goto :eof

:bootstrap
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\bootstrap-python.ps1"
if exist "runtime\python\python.exe" set "PY=runtime\python\python.exe"
exit /b 0

:nopython
echo [!] Не удалось получить Python (нет интернета?). Открываю офлайн-версию: работает всё, кроме проверки ссылок и полного подбора Виженера.
echo [!] Could not get Python (no internet?). Opening the offline version: everything works except link checks and the full Vigenere solver.
start "" "%~dp0web\index.html"
pause
