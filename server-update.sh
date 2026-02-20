#!/usr/bin/env bash
set -e

APP_DIR="${1:-/opt/resturant-website}"
SERVICE_NAME="${2:-restaurant}"

echo "== Server update =="
echo "Folder:  ${APP_DIR}"
echo "Service: ${SERVICE_NAME}"
echo

if [ ! -d "${APP_DIR}" ]; then
  echo "ERROR: Folder not found: ${APP_DIR}"
  echo "Run like: bash server-update.sh /path/to/app [serviceName]"
  exit 1
fi

cd "${APP_DIR}"

echo "1) Pull latest code"
# Keep it simple: pull current branch
git pull

echo
echo "2) Install production dependencies"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo
echo "3) Restart service"
restarted="no"

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service"; then
    sudo systemctl restart "${SERVICE_NAME}"
    restarted="yes (systemd)"
  fi
fi

if [ "${restarted}" = "no" ] && command -v pm2 >/dev/null 2>&1; then
  if pm2 list | grep -q "${SERVICE_NAME}"; then
    pm2 restart "${SERVICE_NAME}"
    restarted="yes (pm2)"
  fi
fi

if [ "${restarted}" = "no" ]; then
  echo "WARNING: Could not find a systemd service or pm2 process named '${SERVICE_NAME}'."
  echo "If you use systemd, try: sudo systemctl restart <serviceName>"
  echo "If you use pm2, try: pm2 restart <processName>"
else
  echo "Restarted: ${restarted}"
fi

echo
echo "Done."