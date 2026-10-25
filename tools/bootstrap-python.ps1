# Windows без установленного Python: скачивает официальный встроенный Python (python.org)
# в runtime\python рядом с программой. Без прав администратора, без изменения PATH и реестра.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'runtime\python'
$downloads = Join-Path $root 'runtime\downloads'
$version = '3.12.10'
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$zipUrl = "https://www.python.org/ftp/python/$version/python-$version-embed-$arch.zip"
$pipUrl = 'https://bootstrap.pypa.io/get-pip.py'

New-Item -ItemType Directory -Force -Path $dir, $downloads | Out-Null
$zip = Join-Path $downloads "python-$version-embed-$arch.zip"
Write-Host "[*] Python not found - downloading embedded Python $version (~11 MB, once)"
Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing
if ((Get-Item $zip).Length -lt 5MB) { throw 'Downloaded Python archive is too small' }
Expand-Archive -Path $zip -DestinationPath $dir -Force

# В ._pth включаем site-packages и добавляем папку программы, иначе server.py не найдёт свои модули.
$pth = Get-ChildItem -Path $dir -Filter 'python*._pth' | Select-Object -First 1
$lines = Get-Content $pth.FullName | ForEach-Object { if ($_ -match '^#\s*import site') { 'import site' } else { $_ } }
if ($lines -notcontains '..\..') { $lines += '..\..' }
Set-Content -Path $pth.FullName -Value $lines -Encoding ASCII

$getPip = Join-Path $downloads 'get-pip.py'
Write-Host '[*] Installing pip'
Invoke-WebRequest -Uri $pipUrl -OutFile $getPip -UseBasicParsing
& (Join-Path $dir 'python.exe') $getPip --no-warn-script-location --disable-pip-version-check | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'pip installation failed' }
& (Join-Path $dir 'python.exe') -c "import sys; print('[OK] Python', sys.version.split()[0])"
Remove-Item $zip, $getPip -ErrorAction SilentlyContinue
