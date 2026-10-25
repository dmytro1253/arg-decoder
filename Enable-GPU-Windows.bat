@echo off
chcp 65001 >nul
title ARG Decoder - GPU (CUDA)
cd /d "%~dp0"
echo Будет установлен PyTorch с CUDA (около 2.5 ГБ). Нужна видеокарта NVIDIA и свежий драйвер. Это необязательно.
echo PyTorch with CUDA will be installed (~2.5 GB). Needs an NVIDIA GPU and a recent driver. This is optional.
pause
set "PY="
if exist "runtime\python\python.exe" set "PY=runtime\python\python.exe"
if not defined PY where py >nul 2>nul && py -3 tools\pycheck.py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && python tools\pycheck.py >nul 2>nul && set "PY=python"
if not defined PY (
    echo Сначала запусти Start-Windows.bat / Run Start-Windows.bat first
    pause
    goto :eof
)
%PY% launcher.py --gpu
if errorlevel 1 pause
