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

function main() {
  const args = process.argv.slice(2);
  const dbPath = args[0];
  const restaurantId = args[1];
  const newApiKey = args[2];

  if (!dbPath) fail('Missing dbPath');
  if (!restaurantId) fail('Missing restaurantId');
  if (!newApiKey) fail('Missing newApiKey');

  const db = readJson(dbPath);
  if (!db || !Array.isArray(db.restaurants)) fail('Invalid database: restaurants missing');

  let restaurant = null;
  for (const r of db.restaurants) {
    if (r && String(r.id) === String(restaurantId)) {
      restaurant = r;
      break;
    }
  }

  if (!restaurant) {
    fail(`Restaurant not found: ${restaurantId}`);
  }

  restaurant.apiKey = String(newApiKey);
  writeJsonPretty(dbPath, db);

  process.stdout.write(JSON.stringify({
    ok: true,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    apiKey: restaurant.apiKey
  }) + '\n');
}

main();
