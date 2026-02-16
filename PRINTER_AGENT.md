# Local Printer Agent

This agent is meant to run on a restaurant PC / Raspberry Pi that is **on the same LAN/Wi‑Fi as the printer**.

It polls the VPS for newly **approved** orders and prints them locally via ESC/POS TCP (usually port 9100). After a successful print it calls the VPS to mark the order as printed to avoid duplicates.

## Why this is needed

If the backend runs only on the VPS, it cannot reach LAN IPs like `192.168.x.x`, so the VPS cannot scan/test/print to a local network printer.

This agent runs inside the restaurant network, where the printer is reachable.

## Setup (restaurant PC / Raspberry Pi)

1. Install Node.js (Node 18+ recommended).
2. Copy/clone the backend repo folder so it contains:
   - `printer-agent.js`
   - `printer-service.js`
3. Set environment variables:

### Required

- `AGENT_API_BASE_URL` – example: `https://bojole.bg/api` (on bojole.bg this is rewritten to `/resturant-website/api` internally)
- `AGENT_API_KEY` – the restaurant API key (same as the mobile API key)

### Optional

- `AGENT_POLL_INTERVAL_MS` – default `5000`
- `AGENT_STATE_FILE` – default `./printer-agent-state.json`
- `AGENT_PRINTER_IP` – override saved printer IP (if you want to force it)
- `AGENT_PRINTER_PORT` – override port (default 9100)
- `AGENT_SUBNET` – used for auto-discovery when the saved IP is empty, example: `192.168.88`
- `AGENT_DRY_RUN` – set to `true` to test without printing

## Run

PowerShell example:

```powershell
$env:AGENT_API_BASE_URL = 'https://bojole.bg/resturant-website/api'
$env:AGENT_API_KEY = 'YOUR_RESTAURANT_API_KEY'
$env:AGENT_POLL_INTERVAL_MS = '5000'
node .\printer-agent.js
```

## Auto-start on boot (Windows)

Recommended: use `printer-agent.config.json` + Task Scheduler.

## True setup.exe (recommended for staff)

If you want a real Windows installer (`setup.exe`) with a wizard UI, use the Inno Setup project in:

- [installer/RestaurantPrinterAgent.iss](installer/RestaurantPrinterAgent.iss)

It prompts for:
- API URL + API key
- Printer IP / port (optional)
- Subnet (optional, for autodiscovery)
- (Optional reference fields) subnet mask / gateway / DHCP

It then writes `printer-agent.config.json`, creates the scheduled task, and stores logs/state in `C:\ProgramData\RestaurantPrinterAgent`.

### No-console installer (recommended)

On the restaurant PC you can install it with a **double-click installer** (no manual PowerShell commands):

1. Put the folder (this repo) somewhere permanent, for example `C:\Restaurant\printer-agent\`.
2. Double-click `INSTALL_PRINTER_AGENT.cmd`.
3. Approve the Windows admin (UAC) prompt.
4. Fill in:
  - API Base URL: `https://bojole.bg/resturant-website/api`
  - Restaurant API Key
  - Subnet (optional)
5. Click **Install & Start**.

It will:
- Create/update `printer-agent.config.json`
- Install the scheduled task `RestaurantPrinterAgent`
- Start it immediately

Logs (for debugging): `printer-agent.log` in the same folder.

To uninstall, double-click `UNINSTALL_PRINTER_AGENT.cmd`.

1. Copy the example config and fill it:

```powershell
Copy-Item .\printer-agent.config.json.example .\printer-agent.config.json
notepad .\printer-agent.config.json
```

2. Install the scheduled task (run PowerShell as Administrator):

```powershell
Set-Location C:\path\to\resturant-template
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-printer-agent-task.ps1
```

3. Start it immediately (optional):

```powershell
Start-ScheduledTask -TaskName RestaurantPrinterAgent
```

To uninstall:

```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uninstall-printer-agent-task.ps1
```

### Important Windows note (SYSTEM account)

The task runs as `NT AUTHORITY\\SYSTEM` so it starts even if nobody logs in.

For this to work reliably:
- Install Node.js **system-wide** (recommended), OR
- Set `nodePath` in `printer-agent.config.json` to a valid `node.exe` path.

## Notes

- The agent respects the restaurant printer settings saved on the VPS (`/api/restaurants/me`):
  - `enabled`
  - `ip`, `port`
  - `autoPrintOnApproved`
  - `printPickup`
  - `allowAutoDiscovery`
- Auto-discovery only works from the LAN (agent device).
- To auto-detect the printer on the same Wi‑Fi:
  - Set `allowAutoDiscovery=true`
  - Leave `ip` empty
  - (Optional) set `AGENT_SUBNET` (or `subnet` in `printer-agent.config.json`) like `192.168.88`
- If the printer IP changes due to DHCP, the agent will try auto-discovery again when the saved IP is unreachable.
