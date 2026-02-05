#!/usr/bin/env bash
set -euo pipefail

# Creates a single Linux-user mailbox (Maildir) and maps one or more email
# addresses (virtual alias) to that mailbox via Postfix.
#
# Intended for multi-tenant setups where each restaurant gets a mailbox.
# Example (bojole.bg):
#   sudo ./scripts/mail-create-tenant-mailbox.sh --domain bojole.bg --user bojole --addresses "noreply"
#
# Notes:
# - This assumes Postfix + Dovecot are already installed and Dovecot is using system users.
# - For receiving mail from the Internet, you still must point MX for the domain to this server.

DOMAIN=""
LOCAL_USER=""
ADDRESSES_RAW=""
PASSWORD=""
ENFORCE_SENDER_LOGIN_MISMATCH="false"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/mail-create-tenant-mailbox.sh --domain <domain> --user <linux_user> --addresses "localpart1 localpart2" [--password <password>] [--enforce-sender-login-mismatch true|false]

Examples:
  sudo ./scripts/mail-create-tenant-mailbox.sh --domain bojole.bg --user bojole --addresses "noreply"

What it does:
  - Creates (or reuses) Linux user <linux_user>
  - Ensures ~/Maildir exists
  - Ensures Postfix is configured with virtual_alias_maps
  - Adds mappings like info@<domain> -> <linux_user>
  - Runs postmap and reloads postfix

Optional hardening:
  --enforce-sender-login-mismatch true
    Adds sender->login mappings (sender_login_maps) so the authenticated SMTP user is allowed
    to send only as the mapped addresses (prevents cross-tenant spoofing).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"; shift 2 ;;
    --user)
      LOCAL_USER="${2:-}"; shift 2 ;;
    --addresses)
      ADDRESSES_RAW="${2:-}"; shift 2 ;;
    --password)
      PASSWORD="${2:-}"; shift 2 ;;
    --enforce-sender-login-mismatch)
      ENFORCE_SENDER_LOGIN_MISMATCH="${2:-false}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

DOMAIN="$(echo "${DOMAIN}" | tr -d '\r' | xargs)"
LOCAL_USER="$(echo "${LOCAL_USER}" | tr -d '\r' | xargs)"
ADDRESSES_RAW="$(echo "${ADDRESSES_RAW}" | tr -d '\r' | xargs)"
ENFORCE_SENDER_LOGIN_MISMATCH="$(echo "${ENFORCE_SENDER_LOGIN_MISMATCH}" | tr -d '\r' | xargs | tr '[:upper:]' '[:lower:]')"

if [[ -z "${DOMAIN}" || -z "${LOCAL_USER}" || -z "${ADDRESSES_RAW}" ]]; then
  echo "Missing required args." >&2
  usage
  exit 1
fi

if [[ "${ENFORCE_SENDER_LOGIN_MISMATCH}" != "true" && "${ENFORCE_SENDER_LOGIN_MISMATCH}" != "false" ]]; then
  echo "Invalid --enforce-sender-login-mismatch value: ${ENFORCE_SENDER_LOGIN_MISMATCH} (expected true|false)" >&2
  exit 1
fi

if [[ ! "${DOMAIN}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Domain looks invalid: ${DOMAIN}" >&2
  exit 1
fi

if ! command -v postconf >/dev/null 2>&1; then
  echo "postconf not found. Install postfix first." >&2
  exit 1
fi

if ! command -v postmap >/dev/null 2>&1; then
  echo "postmap not found. Install postfix first." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found; this script assumes systemd." >&2
  exit 1
fi

# 1) Create or reuse Linux user
if id -u "${LOCAL_USER}" >/dev/null 2>&1; then
  echo "[OK] Linux user exists: ${LOCAL_USER}"
else
  echo "[DO] Creating Linux user: ${LOCAL_USER}"
  adduser --disabled-password --gecos "" "${LOCAL_USER}"
fi

# 2) Set password (needed for IMAP/Roundcube login)
if [[ -z "${PASSWORD}" ]]; then
  echo "Enter password for Linux user '${LOCAL_USER}' (will not echo):" >&2
  read -r -s PASSWORD
  echo >&2
fi

if [[ -z "${PASSWORD}" ]]; then
  echo "Empty password not allowed." >&2
  exit 1
fi

echo "${LOCAL_USER}:${PASSWORD}" | chpasswd
unset PASSWORD

echo "[OK] Password set for ${LOCAL_USER}"

# 3) Ensure Maildir exists
HOME_DIR="$(getent passwd "${LOCAL_USER}" | cut -d: -f6)"
if [[ -z "${HOME_DIR}" || ! -d "${HOME_DIR}" ]]; then
  echo "Home dir not found for ${LOCAL_USER}: ${HOME_DIR}" >&2
  exit 1
fi

MAILDIR="${HOME_DIR}/Maildir"
if [[ -d "${MAILDIR}" ]]; then
  echo "[OK] Maildir exists: ${MAILDIR}"
else
  echo "[DO] Creating Maildir: ${MAILDIR}"
  if command -v maildirmake.dovecot >/dev/null 2>&1; then
    sudo -u "${LOCAL_USER}" maildirmake.dovecot "${MAILDIR}"
  else
    sudo -u "${LOCAL_USER}" mkdir -p "${MAILDIR}/cur" "${MAILDIR}/new" "${MAILDIR}/tmp"
  fi
fi

# 4) Configure Postfix virtual aliases
VIRTUAL_FILE="/etc/postfix/virtual"

postconf -e "virtual_alias_maps = hash:${VIRTUAL_FILE}"

# Ensure the domain is in virtual_alias_domains.
EXISTING_DOMAINS="$(postconf -h virtual_alias_domains 2>/dev/null || true)"
EXISTING_DOMAINS="$(echo "${EXISTING_DOMAINS}" | tr -d '\r' | xargs)"

if [[ -z "${EXISTING_DOMAINS}" ]]; then
  postconf -e "virtual_alias_domains = ${DOMAIN}"
else
  if echo " ${EXISTING_DOMAINS} " | grep -q " ${DOMAIN} "; then
    echo "[OK] Domain already present in virtual_alias_domains"
  else
    postconf -e "virtual_alias_domains = ${EXISTING_DOMAINS} ${DOMAIN}"
  fi
fi

# Ensure the virtual file exists
if [[ ! -f "${VIRTUAL_FILE}" ]]; then
  touch "${VIRTUAL_FILE}"
  chmod 0644 "${VIRTUAL_FILE}"
fi

# Add mappings (idempotent)
added=0
for localpart in ${ADDRESSES_RAW}; do
  addr="${localpart}@${DOMAIN}"
  if grep -Eqs "^${addr}[[:space:]]+${LOCAL_USER}[[:space:]]*$" "${VIRTUAL_FILE}"; then
    echo "[OK] Mapping exists: ${addr} -> ${LOCAL_USER}"
  else
    echo "[DO] Adding mapping: ${addr} -> ${LOCAL_USER}"
    echo "${addr} ${LOCAL_USER}" >> "${VIRTUAL_FILE}"
    added=1
  fi
done

# Build /etc/postfix/virtual.db
postmap "${VIRTUAL_FILE}"

# Reload postfix
systemctl reload postfix

echo "[OK] Postfix reloaded"

# Quick lookup check
for localpart in ${ADDRESSES_RAW}; do
  addr="${localpart}@${DOMAIN}"
  resolved="$(postmap -q "${addr}" "hash:${VIRTUAL_FILE}" || true)"
  echo "[CHECK] ${addr} -> ${resolved}"
done

# 5) Optional: enforce sender/login mapping (prevents spoofing between tenants)
if [[ "${ENFORCE_SENDER_LOGIN_MISMATCH}" == "true" ]]; then
  SENDER_LOGIN_FILE="/etc/postfix/sender_login_maps"

  # Ensure file exists
  if [[ ! -f "${SENDER_LOGIN_FILE}" ]]; then
    touch "${SENDER_LOGIN_FILE}"
    chmod 0644 "${SENDER_LOGIN_FILE}"
  fi

  sender_added=0
  for localpart in ${ADDRESSES_RAW}; do
    addr="${localpart}@${DOMAIN}"
    if grep -Eqs "^${addr}[[:space:]]+${LOCAL_USER}[[:space:]]*$" "${SENDER_LOGIN_FILE}"; then
      echo "[OK] sender_login_maps exists: ${addr} -> ${LOCAL_USER}"
    else
      echo "[DO] Adding sender_login_maps: ${addr} -> ${LOCAL_USER}"
      echo "${addr} ${LOCAL_USER}" >> "${SENDER_LOGIN_FILE}"
      sender_added=1
    fi
  done

  postmap "${SENDER_LOGIN_FILE}"

  postconf -e "smtpd_sender_login_maps = hash:${SENDER_LOGIN_FILE}"

  echo "[NOTE] To enforce mismatch rejection, ensure Postfix has 'reject_sender_login_mismatch' in smtpd_sender_restrictions." >&2
  echo "       Example: postconf -e 'smtpd_sender_restrictions=reject_sender_login_mismatch,permit_sasl_authenticated,permit_mynetworks,reject_unauth_destination'" >&2

  systemctl reload postfix

  for localpart in ${ADDRESSES_RAW}; do
    addr="${localpart}@${DOMAIN}"
    resolved="$(postmap -q "${addr}" "hash:${SENDER_LOGIN_FILE}" || true)"
    echo "[CHECK] sender_login_maps ${addr} -> ${resolved}"
  done
fi

echo "Done. You can now log into Roundcube/IMAP as Linux user '${LOCAL_USER}'."
