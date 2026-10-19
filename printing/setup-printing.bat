@echo off
setlocal EnableExtensions
title HSMLIS - label printing setup

rem Sets up silent label printing on this PC, in one double-click:
rem   1. installs QZ Tray (if it is not installed yet),
rem   2. makes QZ Tray trust HSMLIS (override.crt, next to this file),
rem   3. restarts QZ Tray.
rem Run it once per PC, and again only if the HSMLIS certificate is ever replaced.
rem For a PC without internet, put qz-tray-2.3.0-x86_64.exe next to this file.

set "QZ_VERSION=2.3.0"
set "HERE=%~dp0"
set "QZ_DIR=%ProgramFiles%\QZ Tray"

rem Installing and writing to Program Files need administrator rights: ask for them.
net session >nul 2>&1
if errorlevel 1 (
  echo Asking for administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

if not exist "%HERE%override.crt" goto no_certificate

if exist "%QZ_DIR%\qz-tray.exe" goto installed

set "ARCH=x86_64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
set "INSTALLER=%HERE%qz-tray-%QZ_VERSION%-%ARCH%.exe"
if exist "%INSTALLER%" goto install

set "INSTALLER=%TEMP%\qz-tray-%QZ_VERSION%-%ARCH%.exe"
echo Downloading QZ Tray %QZ_VERSION%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/qzind/tray/releases/download/v%QZ_VERSION%/qz-tray-%QZ_VERSION%-%ARCH%.exe' -OutFile '%INSTALLER%'"
if errorlevel 1 goto download_failed

:install
echo Installing QZ Tray %QZ_VERSION%...
start "" /wait "%INSTALLER%" /S
if not exist "%QZ_DIR%\qz-tray.exe" goto install_failed

:installed
echo Stopping QZ Tray...
powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like '*\QZ Tray\*' } | Stop-Process -Force"

echo Installing the HSMLIS certificate...
copy /Y "%HERE%override.crt" "%QZ_DIR%\override.crt" >nul
if errorlevel 1 goto copy_failed

echo Starting QZ Tray...
start "" "%QZ_DIR%\qz-tray.exe"

echo.
echo Done. HSMLIS can now print labels on this PC without asking.
echo Check that the label printer is installed in Windows, then press Print on a specimen label page.
pause
exit /b 0

:no_certificate
echo override.crt is missing. Put the HSMLIS certificate next to this file, named override.crt.
pause
exit /b 1

:download_failed
echo Could not download QZ Tray. Check the internet connection, or put
echo qz-tray-%QZ_VERSION%-%ARCH%.exe (from https://github.com/qzind/tray/releases) next to this file.
pause
exit /b 1

:install_failed
echo QZ Tray did not install. Run "%INSTALLER%" by hand, then run this file again.
pause
exit /b 1

:copy_failed
echo Could not copy override.crt into "%QZ_DIR%".
pause
exit /b 1
