@echo off
setlocal

REM Double-click installer for the local printer agent (no manual console commands).
REM It will prompt for admin privileges (UAC) if needed.

set "ROOT=%~dp0"
set "WIZ=%ROOT%scripts\install-printer-agent-wizard.ps1"

if not exist "%WIZ%" (
  echo Missing: %WIZ%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%WIZ%"
exit /b %ERRORLEVEL%
