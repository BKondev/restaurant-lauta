# bojole.bg – make the platform the “main” site

Goal: Customers use root URLs:
- https://bojole.bg/
- https://bojole.bg/checkout
- https://bojole.bg/admin
- https://bojole.bg/login

Without having to change the internal app mount path (can remain `BASE_PATH=/resturant-website`).

## 1) DNS (SuperHosting)

### Website
- `A` host `@` -> your VPS IP
- `A` host `www` -> your VPS IP

### Mail (if hosting mail on the VPS)
- `A` host `mail` -> your VPS IP
- Replace default MX records with:
  - `MX` host `@` -> `mail.bojole.bg` priority `10`
- `TXT` host `@` -> `v=spf1 mx a ip4:<VPS_IP> ~all`
- `TXT` host `_dmarc` -> `v=DMARC1; p=none; rua=mailto:dmarc@bojole.bg; adkim=s; aspf=s`
- `TXT` host `default._domainkey` -> `v=DKIM1; k=rsa; p=...` (from OpenDKIM)

## 2) Nginx

Use the provided config file:
- `nginx-bojole.conf`

Key idea:
- Nginx maps public `/...` -> upstream `/resturant-website/...`
- And also supports legacy `/resturant-website/...` URLs

## 3) TLS (Let’s Encrypt)

Once DNS points to the VPS:
- `sudo certbot --nginx -d bojole.bg -d www.bojole.bg`

## 4) App env for public links

If you send emails containing tracking links, set:
- `PUBLIC_BASE_URL=https://bojole.bg`
- `PUBLIC_BASE_PATH=` (empty)

This makes the tracking link come out like:
- `https://bojole.bg/track-order.html?id=...`

(while the app can still run internally at `BASE_PATH=/resturant-website`).

## 5) When onboarding a new restaurant

Recommended approach (simple cloning):
- Copy the folder (or repo) and run a second Node instance on a different port
- Give it its own `database.json` (or a different `DB_FILE_PATH`)
- Point a new domain to the VPS
- Add another nginx vhost mapping that domain’s `/` to that instance

You’ll end up with:
- Domain A -> port 3004 (bojole)
- Domain B -> port 3005 (new restaurant)
- etc.
