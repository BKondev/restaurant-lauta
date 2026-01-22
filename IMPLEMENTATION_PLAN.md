# Implementation Plan (Checklist)

This document is the step-by-step checklist for implementing:
- Required customer email + pickup alert
- Unified order statuses (received → approved → delivering/ready → done)
- Automatic + manual emails via free SMTP (Brevo)
- Animated track-order stepper
- Admin Orders page (active + history) with full order editing

---

## 0) Definitions (single source of truth)

### Order status values (DB)
We store a single string on each order: `order.status`.

- `pending` → UI label: **Received**
- `approved` → UI label: **Approved / Preparing**
- `delivering` → UI label: **Delivering** (delivery only)
- `ready_for_pickup` → UI label: **Ready (waiting for customer)** (pickup only)
- `completed` → UI label: **Done** (delivered/picked up)

Back-compat mapping:
- Treat `confirmed` as `approved` in UI and emails.

### Delivery type field
Normalize to `order.deliveryType` with values:
- `delivery`
- `pickup`

Back-compat:
- If existing code uses `deliveryMethod`, map it to `deliveryType` when reading/writing.

### Email requirements
- Checkout requires a valid customer email.
- Sending emails: if email is missing/invalid, **skip sending** and do not fail the order flow.

### SMTP provider
- Use Brevo SMTP relay (free tier).
- Environment variables (server):
  - `SMTP_HOST=smtp-relay.brevo.com`
  - `SMTP_PORT=587`
  - `SMTP_USER=...`
  - `SMTP_PASS=...`
  - `SMTP_FROM=...` (verified sender)
  - Optional: `SMTP_SECURE=false`

---

## 1) Stage 1 — Unblockers (IDs + schema drift)

Goal: fix existing mismatches that will break later work.

- [ ] Fix order ID handling everywhere (IDs are strings like `order_...`)
  - [ ] Server delete endpoint must not `parseInt(orderId)`
  - [ ] Admin UI action handlers must quote/escape string order IDs

- [ ] Persist missing fields on create-order
  - [ ] Persist `deliveryType` (and/or map from `deliveryMethod`)
  - [ ] Persist `deliveryFee`
  - [ ] Persist delivery city/address fields (needed for tracking and admin)

- [ ] Single-restaurant fallback for `restaurantId`
  - [ ] If `restaurantId` missing and DB has exactly one restaurant, default to it
  - [ ] If DB has multiple restaurants and `restaurantId` missing, return 400 with a clear message

Acceptance:
- Can place an order successfully from checkout without 400
- Admin order actions work without JS errors
- Delete/update work for string order IDs

---

## 2) Stage 2 — Checkout UX (required email + pickup alert)

Files:
- `public/checkout.js`
- `public/checkout.html` (only if markup changes are needed)

Checklist:
- [ ] Make customer email required (UI + validation)
- [ ] Ensure create-order payload includes customer email
- [ ] Add pickup selection alert: “Pickup may take up to 1 hour.”

Acceptance:
- Checkout blocks submit if email invalid/missing
- Alert appears when switching to pickup

---

## 3) Stage 3 — Status model + transitions (server + admin + app)

Files:
- `server.js`
- `public/admin.js`

Checklist:
- [ ] Enforce allowed status values (`pending`, `approved`, `delivering`, `ready_for_pickup`, `completed`)
- [ ] Change admin “confirm/approve” action to set `approved`
- [ ] Add admin actions:
  - [ ] Set `delivering`
  - [ ] Set `ready_for_pickup`
  - [ ] Set `completed` (Done)
- [ ] Ensure mobile app endpoints can set these statuses too

Acceptance:
- Status transitions visible in admin and track-order
- “Done” available from admin and from app

---

## 4) Stage 4 — Emails (auto + manual)

Files:
- `package.json` (add `nodemailer`)
- `server.js`

Checklist:
- [ ] Add `nodemailer`
- [ ] Implement `sendEmail()` helper and transport creation from env vars
- [ ] Auto email on order placed
  - Subject: “Order placed successfully”
  - Content includes order ID + summary
- [ ] Auto email on transition to `approved`
  - Subject: “Order received and being prepared”
- [ ] Add manual admin email endpoint:
  - `POST /api/admin/orders/:orderId/email`
  - Body: `{ subject, message }`
- [ ] Never block API responses on email failures (log and continue)

Acceptance:
- Emails are sent when configured; system still works when SMTP not configured

---

## 5) Stage 5 — Track Order page (animated stepper)

Files:
- `public/track-order.html`
- `server.js` (tracking endpoint response fields if needed)

Checklist:
- [ ] Replace status display with animated stepper:
  - Received (pending)
  - Approved
  - Delivering or Ready for pickup (based on `deliveryType`)
  - Done (completed) with big green check
- [ ] Animate only on status changes
- [ ] Keep 2-hour expiry behavior
- [ ] Make API base URL dynamic (avoid hardcoded production domain)

Acceptance:
- Looks good on mobile
- Timeline updates automatically as statuses change

---

## 6) Stage 6 — Admin Orders page (active + history) + full editing

Files:
- `public/admin.html`
- `public/admin.js`
- `server.js`

Checklist:
- [ ] Implement “Orders” page with filters (status/date/type)
- [ ] Implement “History” view (completed orders)
- [ ] Full edit modal:
  - [ ] Customer (name/phone/email)
  - [ ] Delivery type + address/city
  - [ ] Notes
  - [ ] Items: add/remove/change qty, adjust per-item price (if allowed)
  - [ ] Discount
- [ ] Server recomputes totals from items on save
  - Decide pricing source:
    - [ ] Use order’s stored item prices as authoritative
    - [ ] OR recalc from current products (document choice)

Acceptance:
- Admin can edit and save an order end-to-end
- Totals remain consistent after edits

---

## Deployment notes

- Update server `.env` with Brevo SMTP vars.
- Restart PM2 after deploy.

---

## Work log

- (add dates/notes here as we implement)

- 2026-01-22: Implemented server-side required customer email validation on order creation and added one-time pickup delay alert in checkout.
- 2026-01-22: Fixed checkout order payload to include `customerInfo.city` and `deliveryType`, and require city+address for delivery.
- 2026-01-22: Normalized server-side status handling (confirmed→approved), added status validation, and updated admin "confirm" to send `approved`.
