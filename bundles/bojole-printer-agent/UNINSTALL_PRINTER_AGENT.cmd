@echo off
setlocal

REM Double-click uninstaller for the local printer agent scheduled task.
REM It will prompt for admin privileges (UAC) if needed.

set "ROOT=%~dp0"
set "WIZ=%ROOT%scripts\uninstall-printer-agent-wizard.ps1"

if not exist "%WIZ%" (
  echo Missing: %WIZ%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%WIZ%"
exit /b %ERRORLEVEL%
