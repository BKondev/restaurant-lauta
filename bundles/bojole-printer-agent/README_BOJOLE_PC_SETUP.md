# Bojole Printer Agent (Windows PC)

This folder is meant to be copied as-is to the **Bojole restaurant PC**.

## 1) Prerequisites

- Windows 10/11
- Node.js installed (includes npm)
- PC is on the same LAN as the printer

## 2) Configure

Edit:

- `configs/printer-agent.config.bojole.json`

Set:

- `apiBaseUrl`: `https://bojole.bg/api`
- `apiKey`: your Bojole restaurant API key
- `printerIp`: printer LAN IP (example: `192.168.0.6`)
- `printerPort`: `9100`

Optional:

- `orderStatusesCsv`: keep as `approved`
- `allowReprintsWhenAutoPrintDisabled`: keep `true`

## 3) Install dependencies (one time)

Open PowerShell in this folder and run:

- `npm install`

## 4) Install to run on startup (recommended)

Double click:

- `INSTALL_PRINTER_AGENT.cmd`

This creates a Windows Scheduled Task to run the agent on boot.

## 5) Run manually (debug)

- `powershell -NoProfile -ExecutionPolicy Bypass -File .\printer-agent-run.ps1 -ConfigPath .\configs\printer-agent.config.bojole.json`

Logs:

- `printer-agent.log`

## 6) Uninstall

Double click:

- `UNINSTALL_PRINTER_AGENT.cmd`
