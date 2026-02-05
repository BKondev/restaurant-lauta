# crystalautomation.eu Mail Server Runbook (Free)

Goal: Host working email for `crystalautomation.eu` on your VPS (`46.62.174.218`) so you can send system emails from `no-reply@crystalautomation.eu` (and optionally receive mail in real inboxes like `info@…`, `support@…`) using only free software and DNS changes.

Target OS: Ubuntu 24.04 LTS (Noble).

Note about the web app:
- The backend already supports sending mail via generic SMTP (Nodemailer) using `SMTP_HOST`, `SMTP_PORT`, etc.
- There is no first-party Brevo/Sendinblue API integration in this repo to “remove”; you just point SMTP to your own server.

---

## 0) Critical prerequisites (don’t skip)

### A) Reverse DNS / PTR (mandatory for deliverability)
Most email providers will spam/soft-reject mail if your server IP has no PTR or a mismatching PTR.

- Required: Set PTR for `46.62.174.218` → `mail.crystalautomation.eu`
- Where: In your VPS provider panel / support (NOT in SuperHosting).
- Verify after: `dig -x 46.62.174.218 +short`

### B) Make sure port 25 is not blocked
Many VPS providers block outbound TCP 25 by default.

- Check listening later: `ss -ltnp | grep -E ':25|:587|:993'`
- Check outbound from server: `nc -vz gmail-smtp-in.l.google.com 25`

If outbound 25 is blocked and the provider won’t open it, you’ll need an SMTP relay (often paid). This is the main “free” blocker.

### C) Pick the mail hostname
Use: `mail.crystalautomation.eu` (must exist in DNS as an A record).

---

## 1) DNS changes in SuperHosting (crystalautomation.eu)

In the domain DNS panel for `crystalautomation.eu`:

### A record
- Type: `A`
- Host: `mail`
- Value: `46.62.174.218`

### MX record (replace `mx2.bgdns.net`)
Remove existing MX entries pointing to `mx2.bgdns.net` and add:
- Type: `MX`
- Host: `@`
- Value: `mail.crystalautomation.eu`
- Priority: `10`

### SPF TXT record
- Type: `TXT`
- Host: `@`
- Value: `v=spf1 mx a ip4:46.62.174.218 ~all`

### DMARC TXT record (start safe)
- Type: `TXT`
- Host: `_dmarc`
- Value: `v=DMARC1; p=none; rua=mailto:dmarc@crystalautomation.eu; adkim=s; aspf=s`

(We will add DKIM TXT after generating keys.)

DNS propagation: 2–48 hours.

---

## 2) Server preflight checks (run on the VPS)

Run and record outputs:

- `ss -ltnp | grep -E ':80|:443|:25|:587|:993' || true`
- `ufw status || true`
- `hostname -f; hostnamectl`
- `timedatectl`

If nginx is using 80/443, TLS issuance should use the nginx method.

---

## 3) Install required packages (free)

On the VPS:

- `apt update`
- `apt install -y postfix dovecot-imapd dovecot-core opendkim opendkim-tools certbot`

Postfix wizard choices:
- Select: `Internet Site`
- System mail name: `mail.crystalautomation.eu`

---

## 4) Set hostname to match mail DNS

On the VPS:

- `hostnamectl set-hostname mail.crystalautomation.eu`

Ensure `/etc/hosts` has a stable local mapping. You typically want a line like:
- `127.0.1.1 mail.crystalautomation.eu mail`

Then reboot or re-login:
- `reboot`

---

## 5) Get a free TLS certificate (Let’s Encrypt)

### If nginx is running on 80/443
- `apt install -y python3-certbot-nginx`
- `certbot --nginx -d mail.crystalautomation.eu`

### If nginx is NOT running
- `certbot certonly --standalone -d mail.crystalautomation.eu`

Cert paths:
- `/etc/letsencrypt/live/mail.crystalautomation.eu/fullchain.pem`
- `/etc/letsencrypt/live/mail.crystalautomation.eu/privkey.pem`

---

## 6) Configure Postfix (SMTP + Submission)

You will configure:
- Port 25 for receiving mail
- Port 587 for authenticated sending
- TLS enabled with Let’s Encrypt cert

Key files:
- `/etc/postfix/main.cf`
- `/etc/postfix/master.cf`

High-level requirements:
- `myhostname = mail.crystalautomation.eu`
- `mydomain = crystalautomation.eu`
- TLS cert/key paths
- Enable submission service (587) with TLS + auth

---

## 7) Configure Dovecot (IMAP mailboxes)

Goal:
- IMAP over TLS: port 993
- Mail storage: Maildir
- Authentication: system users (pilot)

Key files:
- `/etc/dovecot/conf.d/10-mail.conf`
- `/etc/dovecot/conf.d/10-auth.conf`
- `/etc/dovecot/conf.d/10-master.conf`
- `/etc/dovecot/conf.d/10-ssl.conf`

High-level requirements:
- `mail_location = maildir:~/Maildir`
- `ssl = required`
- TLS cert/key paths set to Let’s Encrypt

---

## 7.5) Install Roundcube (Webmail UI)

Goal:
- Provide a browser-based email client (Roundcube) for your IMAP mailboxes.

Packages:
- `apt install -y roundcube roundcube-core roundcube-sqlite3 php-fpm php-intl php-mbstring php-xml php-curl`

During installation:
- If prompted by `dbconfig-common`, choose **Yes** and pick **sqlite3** for the simplest setup.

Expose Roundcube via nginx:
- Recommended: `https://mail.crystalautomation.eu/roundcube`

High-level nginx snippet (adjust PHP socket version if needed):

```nginx
location /roundcube {
  alias /var/lib/roundcube/;
  index index.php;
  try_files $uri $uri/ /roundcube/index.php;
}

location ~ ^/roundcube/(.+\.php)$ {
  alias /var/lib/roundcube/$1;
  include snippets/fastcgi-php.conf;
  fastcgi_pass unix:/run/php/php8.3-fpm.sock;
}
```

Roundcube config checks:
- Confirm IMAP/SMTP endpoints in `/etc/roundcube/config.inc.php` (typically IMAP `tls://127.0.0.1:993`).
- If you use a firewall, allow only `80/443` publicly; IMAP/SMTP should stay server-side unless you need external mail clients.

---

## 8) Configure DKIM signing (OpenDKIM)

Goal: Outgoing mail is DKIM-signed for `crystalautomation.eu`.

What happens:
1) Generate DKIM keys on the server (selector: `default`)
2) Publish the public key in SuperHosting DNS as a TXT record
3) Configure Postfix to pass mail through OpenDKIM

You’ll create:
- Private key file on server
- TXT record:
  - Host: `default._domainkey`
  - Value: `v=DKIM1; k=rsa; p=...`

---

## 9) Create mailboxes (free)

Recommended pilot mailboxes:
- `info@crystalautomation.eu`
- `support@crystalautomation.eu`
- `no-reply@crystalautomation.eu`

Simplest approach:
- Create Linux users: `info`, `support`, `noreply` (or alias `no-reply` to `info`)
- Use Postfix virtual alias maps to deliver addresses to those users

Then you can log in via IMAP in any mail client.

---

## 10) Verification / test checklist

From the VPS:

- Services listening:
  - `ss -ltnp | grep -E ':25|:587|:993'`

- Verify DNS:
  - `dig MX crystalautomation.eu +short`
  - `dig A mail.crystalautomation.eu +short`
  - `dig TXT crystalautomation.eu +short`
  - `dig TXT default._domainkey.crystalautomation.eu +short`
  - `dig TXT _dmarc.crystalautomation.eu +short`

In received email headers, confirm:
- SPF: pass
- DKIM: pass
- DMARC: pass (or none while `p=none`)

---

## 11) How the web app will use it (later)

Per instance `.env`:

- `SMTP_HOST=mail.crystalautomation.eu`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_FROM=no-reply@crystalautomation.eu`
- `SMTP_CREDENTIALS_FILE=/root/smtpapp-credentials.txt` (recommended on VPS instead of putting the password in PM2 env)
- `PUBLIC_BASE_URL=https://<this-instance-domain>`

Optional (Admin convenience):
- Set the Site Content → Webmail URL to something like `https://mail.crystalautomation.eu/roundcube` so admins can open Roundcube from the admin panel.

---

## Execution mode

We will execute step-by-step:
1) Preflight checks
2) DNS verification (as visible from server)
3) Package installation
4) Hostname alignment
5) TLS cert
6) Postfix/Dovecot/OpenDKIM configuration
7) Create mailboxes
8) Send test + verify headers

We will pause for any step that requires DNS changes or PTR changes outside the server.
