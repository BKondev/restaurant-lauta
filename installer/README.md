# Printer Agent Installer (setup.exe)

This folder contains an **Inno Setup** script that builds a real Windows `setup.exe` installer for the local printer agent.

## What the installer does

- Installs the agent files to `C:\Program Files\RestaurantPrinterAgent` (default)
- Prompts for `apiBaseUrl`, `apiKey`, and printer settings during install:
  - `printerIp` (optional)
  - `printerPort` (default 9100)
  - `subnet` (optional, for autodiscovery)
  - `subnetMask` / `gateway` / `dhcpEnabled` (optional reference fields)
- Writes `printer-agent.config.json`
- Creates a Scheduled Task (`RestaurantPrinterAgent`) that starts on boot and runs as `NT AUTHORITY\\SYSTEM`
- Stores runtime files in `C:\ProgramData\RestaurantPrinterAgent`:
  - `printer-agent-state.json`
  - `printer-agent.log`

## Build (GUI, no commands)

1. Install **Inno Setup** (Inno Setup Compiler).
2. Open `installer\\RestaurantPrinterAgent.iss` in the compiler.
3. Click **Build > Compile**.
4. Your installer EXE will be created in `installer\\Output\\RestaurantPrinterAgentSetup.exe`.

## Build (optional CLI)

If `ISCC.exe` is installed, you can compile with:

- `ISCC.exe installer\\RestaurantPrinterAgent.iss`
