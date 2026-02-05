# Bojole.bg DNS records (mail deliverability)

These records must be added at the DNS provider for `bojole.bg` (your NS are `redirns1.bgdns.net`, etc.).

## Required

### 1) MX
- **Type:** MX
- **Host/Name:** `@` (or `bojole.bg` depending on panel)
- **Priority:** `10`
- **Value/Target:** `mail.bojole.bg.`

### 2) Mail host A
- **Type:** A
- **Host/Name:** `mail`
- **Value:** `46.62.174.218`

### 3) SPF
Add an SPF record at the root.
- **Type:** TXT
- **Host/Name:** `@`
- **Value:** `v=spf1 mx -all`

If you later use an outbound relay (recommended if TCP/25 is blocked), SPF must be updated to include that relay.

### 4) DKIM (selector `default`)
- **Type:** TXT
- **Host/Name:** `default._domainkey`
- **Value:**

```
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxxJFUtGAU6X2564hEBZRQ1wWCr8xwDiYKsbwHf61hbtctT3DBnMGXyBV8qhc8nSyqPbidPHDyo6sl0QzqOtWRYq91XLFkezeSteszvqP3U/lLymuvAJPcZL6ntgJQl5EuPplcF1S3wF6zMFpxNW7xT4J3jPiW/2MxXyOzqCqa+pR46YxIICJg8zxb4jjxRL+m7jofw88cSDMeIYzACySoM8zyAFZU4TJJL4dMRx6QF4lClVgzZ4Up1R/uE00SPnSIQJZeFOQ0QsbkKSY6S7YwevWs6UK27+LyJFLlJsCdsb3WYu2YODUtL3iSenyc54SoAn0DPPkotrWK2HSdkOyDwIDAQAB
```

Notes:
- Some DNS panels require the full name: `default._domainkey.bojole.bg`.
- Some panels require removing spaces after semicolons; that’s fine.

### 5) DMARC
- **Type:** TXT
- **Host/Name:** `_dmarc`
- **Value:** `v=DMARC1; p=none; rua=mailto:postmaster@bojole.bg`

Start with `p=none`, then move to `quarantine`/`reject` once you confirm legit mail is passing.

## Verification commands
From any Linux box:
- `dig +short MX bojole.bg`
- `dig +short A mail.bojole.bg`
- `dig +short TXT bojole.bg`
- `dig +short TXT default._domainkey.bojole.bg`
- `dig +short TXT _dmarc.bojole.bg`

## Important: outbound email to Gmail may still fail
If the VPS cannot connect out on TCP port 25, mail to Gmail/most external domains will defer/timeout even with perfect SPF/DKIM/DMARC. In that case you must:
- request the provider to unblock outbound TCP/25, OR
- configure Postfix to relay outbound mail via an SMTP relay service.
