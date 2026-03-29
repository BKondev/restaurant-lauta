# Printer Agent – new restaurant checklist

Use this when you want to reuse the same printer agent for a new restaurant (new domain/tenant).

## 1) Decide the restaurant identifiers

- **Restaurant ID** (in `database.json`), e.g. `rest_bojole_001`
- **Public domain** (where the restaurant site is hosted), e.g. `https://bojole.bg`
- **Agent API base URL** (must end with `/api`)
  - If nginx rewrites `/api` → `/resturant-website/api`, use: `https://<domain>/api`
  - Otherwise use: `https://<domain>/resturant-website/api`
- **Restaurant API key** (`x-api-key`) – unique per restaurant

## 2) Server-side setup (VPS)

These must be set correctly or the agent will fail with `401 Invalid API key` or won’t auto-print.

### A) Set/rotate the restaurant API key

From this repo you can use:

- `scripts/rotate-restaurant-api-key.js`

Command (run on the server):

- `sudo node scripts/rotate-restaurant-api-key.js /opt/resturant-website/database.json <restaurantId> <newApiKey>`

Example:

- `sudo node scripts/rotate-restaurant-api-key.js /opt/resturant-website/database.json rest_bojole_001 bojole_api_key_12345_CHANGE_THIS`

### B) Set printer settings for the restaurant

This controls **auto print** + the printer target the agent will use.

- `scripts/set-restaurant-printer-config.js`

Command:

- `sudo PRINTER_ENABLED=true PRINTER_AUTO=true PRINTER_PICKUP=true PRINTER_DISCOVERY=false node scripts/set-restaurant-printer-config.js /opt/resturant-website/database.json <restaurantId> <printerIp> <printerPort>`

Example:

- `sudo PRINTER_ENABLED=true PRINTER_AUTO=true PRINTER_PICKUP=true PRINTER_DISCOVERY=false node scripts/set-restaurant-printer-config.js /opt/resturant-website/database.json rest_bojole_001 192.168.0.6 9100`

### C) Update the web deployment restaurant config

Each deployed website copy has `public/restaurant-config.js` with:

- `id`
- `name`
- `apiKey`

Make sure it matches the same restaurant + API key you set in `database.json`.

Then restart service (if needed):

- `sudo systemctl restart restaurant.service`

## 3) Agent PC setup (Windows)

### Option A (recommended): double-click installer

- Run `INSTALL_PRINTER_AGENT.cmd`
- Fill in:
  - **API Base URL**: `https://<domain>/api` (or `/resturant-website/api`)
  - **Restaurant API key**
  - **Printer IP**: the printer LAN IP (e.g. `192.168.0.6`)
  - **Printer port**: `9100`
  - **Subnet** (optional, only for autodiscovery): e.g. `192.168.0`

### Option B: edit config JSON manually

Edit `printer-agent.config.json`:

- `apiBaseUrl`
- `apiKey`
- `printerIp` and `printerPort` (or set `printerName` for Windows spooler mode)
- `orderStatusesCsv` (optional): which order statuses to poll, e.g. `"approved"` or `"approved,completed"`
- `allowReprintsWhenAutoPrintDisabled` (optional, default true): keep manual “Print” working even if server-side `autoPrintOnApproved=false`
- `dryRun` (keep `false` for real printing)

### Multi-restaurant tip (same PC)

Use the saved presets in `configs/` and start with a specific config:

- `PowerShell -NoProfile -ExecutionPolicy Bypass -File .\printer-agent-run.ps1 -ConfigPath .\configs\printer-agent.config.bojole.json`

## 4) Smoke tests

- API auth: `GET https://<domain>/api/restaurants/me` with header `x-api-key: <apiKey>` should return `200`.
- Manual print button path:
  - `POST https://<domain>/api/orders/<orderId>/reprint` should return `200 {"success":true}`
  - Agent log should show `Connected to printer` + `Data sent to printer`
- Auto print path:
  - Create a new order → approve it → it should print without pressing reprint.

If you want manual prints from “Order History” (e.g. completed orders), set `orderStatusesCsv` to include those statuses, e.g. `approved,completed`.
