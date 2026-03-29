#!/usr/bin/env node

const fs = require('fs');

function fail(msg) {
  process.stderr.write(String(msg || 'Failed') + '\n');
  process.exit(1);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJsonPretty(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function parseBool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
  return fallback;
}

function main() {
  const args = process.argv.slice(2);
  const dbPath = args[0];
  const restaurantId = args[1];
  const printerIp = args[2];
  const printerPort = Number(args[3] || 9100);

  if (!dbPath) fail('Missing dbPath');
  if (!restaurantId) fail('Missing restaurantId');
  if (!printerIp) fail('Missing printerIp');

  const enabled = parseBool(process.env.PRINTER_ENABLED, true);
  const autoPrintOnApproved = parseBool(process.env.PRINTER_AUTO, true);
  const printPickup = parseBool(process.env.PRINTER_PICKUP, true);
  const allowAutoDiscovery = parseBool(process.env.PRINTER_DISCOVERY, false);

  const db = readJson(dbPath);
  if (!db || !Array.isArray(db.restaurants)) fail('Invalid database: restaurants missing');

  let restaurant = null;
  for (const r of db.restaurants) {
    if (r && String(r.id) === String(restaurantId)) {
      restaurant = r;
      break;
    }
  }
  if (!restaurant) fail(`Restaurant not found: ${restaurantId}`);

  const existing = restaurant.printer && typeof restaurant.printer === 'object' ? restaurant.printer : {};
  restaurant.printer = {
    ...existing,
    enabled,
    ip: String(printerIp),
    port: Number.isFinite(printerPort) ? printerPort : 9100,
    autoPrintOnApproved,
    printPickup,
    allowAutoDiscovery
  };

  writeJsonPretty(dbPath, db);

  process.stdout.write(JSON.stringify({
    ok: true,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    printer: restaurant.printer
  }, null, 2) + '\n');
}

main();
