#!/usr/bin/env bash
set -euo pipefail

# One-shot setup for Postfix + Dovecot + OpenDKIM for a single domain.
#
# WARNING (multi-domain):
# This script overwrites global OpenDKIM files (/etc/opendkim.conf, KeyTable,
# SigningTable, TrustedHosts) and Postfix main settings. It is intended for
# a SINGLE domain on the VPS for now (your current phase: only bojole.bg).
#
# Usage:
#   sudo ./scripts/mail-setup-domain.sh --domain bojole.bg --mail-host mail.bojole.bg
#
# Prereqs:
# - DNS A for mail-host points to VPS
# - You run certbot for the mail-host so LE files exist

DOMAIN=""
MAIL_HOST=""
INSTALL_PACKAGES="true"
ENABLE_ROUNDCUBE="false"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/mail-setup-domain.sh --domain <domain> --mail-host <mail-host> [--install-packages true|false] [--enable-roundcube true|false]

Example:
  sudo ./scripts/mail-setup-domain.sh --domain bojole.bg --mail-host mail.bojole.bg

Notes:
- Expects Let's Encrypt certs at /etc/letsencrypt/live/<mail-host>/
- For now this is single-domain only (overwrites OpenDKIM global config).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"; shift 2 ;;
    --mail-host)
      MAIL_HOST="${2:-}"; shift 2 ;;
    --install-packages)
      INSTALL_PACKAGES="${2:-true}"; shift 2 ;;
    --enable-roundcube)
      ENABLE_ROUNDCUBE="${2:-false}"; shift 2 ;;
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
MAIL_HOST="$(echo "${MAIL_HOST}" | tr -d '\r' | xargs)"
INSTALL_PACKAGES="$(echo "${INSTALL_PACKAGES}" | tr -d '\r' | xargs | tr '[:upper:]' '[:lower:]')"
ENABLE_ROUNDCUBE="$(echo "${ENABLE_ROUNDCUBE}" | tr -d '\r' | xargs | tr '[:upper:]' '[:lower:]')"

if [[ -z "${DOMAIN}" || -z "${MAIL_HOST}" ]]; then
  echo "Missing required args." >&2
  usage
  exit 1
fi

if [[ "${INSTALL_PACKAGES}" != "true" && "${INSTALL_PACKAGES}" != "false" ]]; then
  echo "Invalid --install-packages value (true|false expected)" >&2
  exit 1
fi

if [[ "${ENABLE_ROUNDCUBE}" != "true" && "${ENABLE_ROUNDCUBE}" != "false" ]]; then
  echo "Invalid --enable-roundcube value (true|false expected)" >&2
  exit 1
fi

LE_LIVE_DIR="/etc/letsencrypt/live/${MAIL_HOST}"
TS="$(date +%s)"

backup() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cp -a "$path" "${path}.bak.${TS}"
  fi
}

if [[ "${INSTALL_PACKAGES}" == "true" ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt update
  apt install -y postfix dovecot-imapd dovecot-core opendkim opendkim-tools certbot
  if [[ "${ENABLE_ROUNDCUBE}" == "true" ]]; then
    # Roundcube install can prompt depending on distro config.
    # This tries noninteractive; if it prompts, rerun without noninteractive.
    apt install -y nginx php-fpm php-intl php-mbstring php-xml php-curl roundcube roundcube-core roundcube-sqlite3 || true
  fi
fi

if [[ ! -d "${LE_LIVE_DIR}" ]]; then
  cat >&2 <<EOF
Let's Encrypt directory not found: ${LE_LIVE_DIR}

Run one of these first:
- certbot --nginx -d ${MAIL_HOST}
- certbot certonly --standalone -d ${MAIL_HOST}
EOF
  exit 1
fi

# Backups
backup /etc/postfix/main.cf
backup /etc/postfix/master.cf
backup /etc/dovecot/conf.d/10-mail.conf
backup /etc/dovecot/conf.d/10-ssl.conf
backup /etc/dovecot/conf.d/10-master.conf
backup /etc/opendkim.conf
backup /etc/default/opendkim
backup /etc/opendkim/KeyTable
backup /etc/opendkim/SigningTable
backup /etc/opendkim/TrustedHosts

# --- Postfix ---
postconf -e "myhostname = ${MAIL_HOST}"
postconf -e "mydomain = ${DOMAIN}"
postconf -e "myorigin = ${DOMAIN}"
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = all"
postconf -e "mydestination = ${MAIL_HOST}, localhost.${DOMAIN}, localhost, ${DOMAIN}"
postconf -e "home_mailbox = Maildir/"

# TLS (Let's Encrypt)
postconf -e "smtpd_tls_cert_file = ${LE_LIVE_DIR}/fullchain.pem"
postconf -e "smtpd_tls_key_file = ${LE_LIVE_DIR}/privkey.pem"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_tls_auth_only = yes"

# SASL via Dovecot
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated, permit_mynetworks, reject_unauth_destination"

# DKIM milter
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = unix:/opendkim/opendkim.sock"
postconf -e "non_smtpd_milters = unix:/opendkim/opendkim.sock"

# Enable submission on 587 (uncomment default block)
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/postfix/master.cf')
lines = p.read_text(encoding='utf-8').splitlines(True)
out = []
in_block = False
for line in lines:
    if line.startswith('#submission inet'):
        in_block = True
        out.append(line[1:])
        continue
    if in_block and line.startswith('#  -o '):
        out.append(line[1:])
        continue
    if in_block and line.strip() == '':
        in_block = False
        out.append(line)
        continue
    out.append(line)
p.write_text(''.join(out), encoding='utf-8')
PY

# --- Dovecot ---
perl -pi -e 's|^\s*#?\s*mail_location\s*=.*$|mail_location = maildir:~/Maildir|g' /etc/dovecot/conf.d/10-mail.conf

perl -pi -e 's|^\s*#?\s*ssl\s*=.*$|ssl = required|g' /etc/dovecot/conf.d/10-ssl.conf
perl -pi -e "s|^\s*#?\s*ssl_cert\s*=.*$|ssl_cert = <${LE_LIVE_DIR}/fullchain.pem|g" /etc/dovecot/conf.d/10-ssl.conf
perl -pi -e "s|^\s*#?\s*ssl_key\s*=.*$|ssl_key = <${LE_LIVE_DIR}/privkey.pem|g" /etc/dovecot/conf.d/10-ssl.conf

python3 - <<'PY'
from pathlib import Path
p = Path('/etc/dovecot/conf.d/10-master.conf')
text = p.read_text(encoding='utf-8')
if '/var/spool/postfix/private/auth' in text:
    raise SystemExit(0)
insert = """
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
"""
lines = text.splitlines(True)
out = []
in_auth = False
inserted = False
for line in lines:
    out.append(line)
    if line.strip() == 'service auth {':
        in_auth = True
        continue
    if in_auth and (not inserted) and (line.strip().startswith('unix_listener') or line.strip().startswith('#unix_listener')):
        out.append(insert)
        inserted = True
    if in_auth and line.strip() == '}':
        if not inserted:
            out.insert(len(out)-1, insert)
        in_auth = False
p.write_text(''.join(out), encoding='utf-8')
PY

# --- OpenDKIM ---
mkdir -p /var/spool/postfix/opendkim
chown opendkim:postfix /var/spool/postfix/opendkim
chmod 750 /var/spool/postfix/opendkim

mkdir -p /etc/opendkim/keys/${DOMAIN}
if [[ ! -f /etc/opendkim/keys/${DOMAIN}/default.private ]]; then
  opendkim-genkey -b 2048 -s default -d "${DOMAIN}" -D "/etc/opendkim/keys/${DOMAIN}"
  chown opendkim:opendkim "/etc/opendkim/keys/${DOMAIN}/default.private"
  chmod 600 "/etc/opendkim/keys/${DOMAIN}/default.private"
fi

cat > /etc/opendkim/KeyTable <<EOF
default._domainkey.${DOMAIN} ${DOMAIN}:default:/etc/opendkim/keys/${DOMAIN}/default.private
EOF

cat > /etc/opendkim/SigningTable <<EOF
*@${DOMAIN} default._domainkey.${DOMAIN}
EOF

cat > /etc/opendkim/TrustedHosts <<EOF
127.0.0.1
localhost
${MAIL_HOST}
EOF

cat > /etc/opendkim.conf <<'EOF'
Syslog                  yes
SyslogSuccess           yes
LogWhy                  yes

UMask                   002

Canonicalization        relaxed/simple
Mode                    sv
SubDomains              no
AutoRestart             yes
AutoRestartRate         10/1h
Background              yes
DNSTimeout              5
SignatureAlgorithm      rsa-sha256

ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                /etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable

Socket                  local:/var/spool/postfix/opendkim/opendkim.sock
EOF

if grep -q '^SOCKET=' /etc/default/opendkim 2>/dev/null; then
  perl -pi -e 's|^SOCKET=.*$|SOCKET="local:/var/spool/postfix/opendkim/opendkim.sock"|g' /etc/default/opendkim
else
  echo 'SOCKET="local:/var/spool/postfix/opendkim/opendkim.sock"' >> /etc/default/opendkim
fi

postfix check

# Ensure Postfix chroot has resolver files
mkdir -p /var/spool/postfix/etc
cp -a /etc/hosts /var/spool/postfix/etc/hosts
cp -a /etc/resolv.conf /var/spool/postfix/etc/resolv.conf
cp -a /etc/services /var/spool/postfix/etc/services

# Logs
install -o syslog -g adm -m 0640 /dev/null /var/log/mail.log || true
install -o syslog -g adm -m 0640 /dev/null /var/log/mail.err || true
systemctl restart rsyslog || true

# Restart services safely
systemctl stop opendkim || true
rm -f /var/spool/postfix/opendkim/opendkim.sock || true
systemctl reset-failed opendkim || true
systemctl start opendkim

usermod -aG opendkim postfix || true
systemctl restart postfix dovecot

echo "--- LISTENING PORTS ---"
ss -lntp | grep -E ':(25|587|993)\b' || true

echo "--- DKIM TXT (publish this) ---"
cat "/etc/opendkim/keys/${DOMAIN}/default.txt"

echo "Done. Next: create a mailbox login + alias with scripts/mail-create-tenant-mailbox.sh"
