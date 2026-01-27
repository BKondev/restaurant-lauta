#!/usr/bin/env bash
set -euo pipefail

DOMAIN="crystalautomation.eu"
MAIL_HOST="mail.crystalautomation.eu"
LE_LIVE_DIR="/etc/letsencrypt/live/${MAIL_HOST}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

TS="$(date +%s)"

backup() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cp -a "$path" "${path}.bak.${TS}"
  fi
}

backup /etc/postfix/main.cf
backup /etc/postfix/master.cf
backup /etc/dovecot/conf.d/10-mail.conf
backup /etc/dovecot/conf.d/10-ssl.conf
backup /etc/dovecot/conf.d/10-master.conf
backup /etc/opendkim.conf
backup /etc/default/opendkim

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

if grep -q '^SOCKET=' /etc/default/opendkim; then
  perl -pi -e 's|^SOCKET=.*$|SOCKET="local:/var/spool/postfix/opendkim/opendkim.sock"|g' /etc/default/opendkim
else
  echo 'SOCKET="local:/var/spool/postfix/opendkim/opendkim.sock"' >> /etc/default/opendkim
fi

postfix check

# Ensure Postfix chroot has resolver files (avoids warnings and helps name resolution)
mkdir -p /var/spool/postfix/etc
cp -a /etc/hosts /var/spool/postfix/etc/hosts
cp -a /etc/resolv.conf /var/spool/postfix/etc/resolv.conf
cp -a /etc/services /var/spool/postfix/etc/services

# Ensure mail logs exist so rsyslog can write them
install -o syslog -g adm -m 0640 /dev/null /var/log/mail.log || true
install -o syslog -g adm -m 0640 /dev/null /var/log/mail.err || true
systemctl restart rsyslog || true

# OpenDKIM can fail to restart if the socket was created by root; clean and restart safely
systemctl stop opendkim || true
rm -f /var/spool/postfix/opendkim/opendkim.sock || true
systemctl reset-failed opendkim || true
systemctl start opendkim

# Allow Postfix to connect to the OpenDKIM socket (socket group is opendkim)
usermod -aG opendkim postfix || true
systemctl restart postfix dovecot

echo "--- LISTENING PORTS ---"
ss -lntp | grep -E ':(25|587|993)\b' || true

echo "--- DKIM TXT (publish this) ---"
cat "/etc/opendkim/keys/${DOMAIN}/default.txt"
