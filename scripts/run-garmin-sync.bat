@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  Rung - Garmin auto-sync (Windows)
REM
REM  1. Edit the two values below.
REM  2. Double-click this file to test it (a window will open).
REM  3. To run it automatically, schedule this file in Task
REM     Scheduler - see scripts\AUTOMATION.md for click-by-click steps.
REM ============================================================

REM -- Your Rung account id.
REM    In the app: Settings -> Sync -> "Automate Garmin import" -> tap to copy.
set "RUNG_UID=PASTE_YOUR_UID_HERE"

REM -- Path to the Firebase service-account key you downloaded.
REM    Default assumes it sits next to this .bat file, named serviceAccount.json.
set "SERVICE_ACCOUNT=%~dp0serviceAccount.json"

REM -- How many days back to pull each run. 3 is plenty for a nightly job
REM    (re-runs are de-duplicated, so overlap is harmless).
set "DAYS=3"

REM ------------------------- do not edit below -------------------------

REM Prefer "python"; fall back to the Windows "py" launcher.
set "PY=python"
where python >nul 2>&1 || set "PY=py"

cd /d "%~dp0.."
set "LOG=%~dp0garmin-sync.log"

echo [%date% %time%] starting Garmin sync (days=%DAYS%)>> "%LOG%"
%PY% scripts\garmin-sync.py --days %DAYS% --firebase --service-account "%SERVICE_ACCOUNT%" --uid "%RUNG_UID%" >> "%LOG%" 2>&1
echo [%date% %time%] finished with exit code %errorlevel%>> "%LOG%"

endlocal
