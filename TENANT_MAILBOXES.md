# Tenant Mailboxes (Postfix + Dovecot + Roundcube)

Goal: Each restaurant tenant can have a real inbox on the same VPS.

This repo already supports sending order emails via generic SMTP (Nodemailer). This doc covers the *mailbox/inbox* side (receiving + webmail).

## What “one mailbox per tenant” means here

- We create **one Linux system user** per tenant (e.g. `bojole`).
- Dovecot stores mail as `~/Maildir` for that user.
- Postfix maps one or more addresses (e.g. `info@bojole.bg`, `no-reply@bojole.bg`) to that user via `virtual_alias_maps`.
- Roundcube provides webmail UI and logs in as that Linux user.

Key point:
- You do **not** need a separate inbox/user per email address.
- You can have many addresses (aliases) deliver into the same inbox (one login).

This is intentionally simple and works well for a small number of tenants.

---

## Prerequisites (on the VPS)

- Postfix + Dovecot IMAP working
- TLS certificate for your mail hostname
- Roundcube working at an HTTPS URL
- DNS for the domain you want to receive mail for:
  - `A` record: `mail.<tenant-domain>` → VPS IP (recommended)
  - `MX`: `<tenant-domain>` → `mail.<tenant-domain>`
  - SPF/DKIM/DMARC (deliverability)

If you haven’t installed the mail stack yet, start from:
- [CRYSTALAUTOMATION_MAIL_SERVER_RUNBOOK.md](CRYSTALAUTOMATION_MAIL_SERVER_RUNBOOK.md)

For a single-domain quick setup (current phase: only one tenant domain on the VPS), you can use:

```bash
sudo ./scripts/mail-setup-domain.sh --domain bojole.bg --mail-host mail.bojole.bg
```

---

## Create the first mailbox: bojole.bg

This creates **one mailbox** (Linux user `bojole`) and maps addresses into it (example: `noreply@bojole.bg`).

On the VPS:

```bash
cd /opt/resturant-website  # or wherever the repo is
sudo ./scripts/mail-create-tenant-mailbox.sh --domain bojole.bg --user bojole --addresses "noreply"
```

After that:
- Webmail login (Roundcube): username `bojole` + the password you set
- Any mail sent to `noreply@bojole.bg` should land in the inbox, **once MX/DNS is pointing correctly**.

If you also want aliases to land in the same inbox later (e.g. `info@bojole.bg`, `orders@bojole.bg`), re-run the script with multiple localparts:

```bash
sudo ./scripts/mail-create-tenant-mailbox.sh --domain bojole.bg --user bojole --addresses "noreply info orders"
```

Optional hardening (recommended once you add more tenants):

```bash
sudo ./scripts/mail-create-tenant-mailbox.sh --domain bojole.bg --user bojole --addresses "noreply" --enforce-sender-login-mismatch true
```

This prepares `sender_login_maps` so the authenticated SMTP login `bojole` can only send as the addresses you mapped.

---

## Hook it into the restaurant tenant

In the Admin panel for the Bojole tenant:
- Set **Order Notification Email** to `noreply@bojole.bg` (or any address you mapped).
- Optionally set **Site Content → Webmail URL** to your Roundcube URL (example: `https://mail.bojole.bg/roundcube`).

For outbound sending from the backend (SMTP):
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`/`SMTP_CREDENTIALS_FILE` on the server.
- For now (only Bojole), set `SMTP_FROM=noreply@bojole.bg`.

If you run multiple tenant instances on the same VPS:
- Give each instance its own SMTP login (`SMTP_USER`/`SMTP_PASS`) and its own `SMTP_FROM`.
- Example: Bojole instance uses login `bojole` and sends `noreply@bojole.bg`; CrystalAutomation instance uses login `crystal` and sends `noreply@crystalautomation.eu`.

---

## Notes / next step for true multi-tenant domains

- If you later want many tenant domains (e.g. `tenantA.bg`, `tenantB.bg`) on one server, you should avoid scripts that overwrite `/etc/opendkim/*` files and instead manage **multi-domain** OpenDKIM tables.
- Also, you’ll likely want per-tenant `SMTP_FROM` (the app currently uses a global `SMTP_FROM`).
