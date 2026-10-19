@echo off
setlocal EnableExtensions
title Label printing setup (HSMLIS / HealthSM)

rem Sets up silent printing through QZ Tray on this PC, in one double-click:
rem   1. installs QZ Tray (if it is not installed yet),
rem   2. makes QZ Tray trust our certificate (override.crt, next to this file),
rem   3. allows it in QZ Tray, so QZ Tray does not ask "Allow / Block",
rem   4. lets Chrome and Edge reach QZ Tray from the sites below without asking,
rem   5. restarts QZ Tray.
rem HSMLIS and HealthSM sign with the same certificate, so one run covers both.
rem Run it once per PC, and again only if the certificate is ever replaced.
rem For a PC without internet, put qz-tray-2.3.0-x86_64.exe next to this file.

set "QZ_VERSION=2.3.0"
rem The web addresses that print through QZ Tray, separated by spaces.
set "SITES=https://healthsm.healthsm.workers.dev"
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

echo Installing the certificate...
rem QZ Tray reads one override.crt. If another one is there, keep a copy before replacing it.
if exist "%QZ_DIR%\override.crt" (
  fc /b "%QZ_DIR%\override.crt" "%HERE%override.crt" >nul 2>&1 || copy /Y "%QZ_DIR%\override.crt" "%QZ_DIR%\override.crt.bak" >nul
)
copy /Y "%HERE%override.crt" "%QZ_DIR%\override.crt" >nul
if errorlevel 1 goto copy_failed

rem Pre-allows the certificate for this Windows user. If QZ Tray still asks once, tick
rem "Remember this decision" and press Allow.
if exist "%QZ_DIR%\qz-tray-console.exe" "%QZ_DIR%\qz-tray-console.exe" --allow "%QZ_DIR%\override.crt" >nul 2>&1

if not defined SITES goto start_qz
echo Letting Chrome and Edge reach QZ Tray from: %SITES%
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($site in '%SITES%'.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)) { $origin = ([Uri]$site).GetLeftPart([UriPartial]::Authority); foreach ($browser in 'Google\Chrome', 'Microsoft\Edge') { $key = 'HKLM:\SOFTWARE\Policies\' + $browser + '\LocalNetworkAccessAllowedForUrls'; if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; $item = Get-Item $key; $values = @($item.Property | ForEach-Object { $item.GetValue($_) }); if ($values -notcontains $origin) { $n = 1; while ($item.Property -contains [string]$n) { $n++ }; New-ItemProperty -Path $key -Name ([string]$n) -Value $origin -PropertyType String | Out-Null } } }"

:start_qz
echo Starting QZ Tray...
start "" "%QZ_DIR%\qz-tray.exe"

echo.
echo Done. This PC can now print labels without the print window.
echo Check that the printer is installed in Windows, restart the browser, then print a label.
pause
exit /b 0

:no_certificate
echo override.crt is missing. Put the certificate next to this file, named override.crt.
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
