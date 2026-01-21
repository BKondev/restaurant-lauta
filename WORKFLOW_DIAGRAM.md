# Order Processing Workflow - Visual Guide

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER PLACES ORDER                        │
│                          (Web Application)                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Phone Validation      │
                    │  Format: +359XXXXXXXXX │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴───────────┐
                    │                        │
                    ▼ VALID                  ▼ INVALID
        ┌───────────────────┐    ┌──────────────────┐
        │ Create Order      │    │ Show Error       │
        │ Status: pending   │    │ Block Submission │
        │ ID: order_...     │    └──────────────────┘
        │ Track Expiry: +2h │
        └────────┬──────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Count Previous Orders  │
    │ by Phone Number        │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Redirect to Tracking   │
    │ /track-order.html?id=..│
    └────────────────────────┘




┌─────────────────────────────────────────────────────────────────────┐
│                    MOBILE APP - STAFF WORKFLOW                       │
│                      (Restaurant Staff Device)                       │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────┐
                      │ New Order Appears│
                      │ Status: pending  │
                      └────────┬─────────┘
                               │
              ┌────────────────┴────────────────┐
              │ If previousOrders > 0:          │
              │ Show "✓ Редовен клиент" badge   │
              └────────────────┬────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  STEP 1: ACCEPT      │
                    │  Button: "Приеми"    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Select Time         │
                    │  Options:            │
                    │  • 60 минути         │
                    │  • 65 минути         │
                    │  • 70 минути         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Button Disappears    │
                    │ Time Saved to Order  │
                    │ estimatedTime: 60-70 │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ STEP 2: CALL         │
                    │ Button: "1. 📞 Обади │
                    │         се"          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Open Phone Dialer    │
                    │ tel:+359XXXXXXXXX    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ User Makes Call      │
                    │ (Outside App)        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Return to App        │
                    │ callMadeAt: saved    │
                    │ Button → "✓ Обадено" │
                    │ (Disabled, Greyed)   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ STEP 3: APPROVE      │
                    │ Button: "2. ✓ Одобри"│
                    │ (NOW ENABLED)        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Confirmation Dialog  │
                    │ "Одобрете поръчка    │
                    │  от [Customer]?"     │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼ Confirm                     ▼ Cancel
    ┌───────────────────────┐    ┌──────────────────┐
    │ Send to Server        │    │ Return to Screen │
    │ PUT /api/orders/:id   │    └──────────────────┘
    │ status: "approved"    │
    │ estimatedTime: 60-70  │
    │ callMadeAt: timestamp │
    │ approvedAt: now       │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Server Processing     │
    └───────┬───────────────┘
            │
            ▼
    ┌───────────────────────┐
    │ Is Delivery Order?    │
    └───────┬───────────────┘
            │
    ┌───────┴────────┐
    │                │
    ▼ YES            ▼ NO
┌──────────────┐  ┌──────────────┐
│ Print Receipt│  │ No Printing  │
│ (Network     │  │              │
│  Printer)    │  │              │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 │
┌──────────────┐         │
│ Send to      │         │
│ Delivery API │         │
│ (Dispatcher) │         │
└──────┬───────┘         │
       │                 │
       └────────┬────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Success Response      │
    └───────┬───────────────┘
            │
            ▼
    ┌───────────────────────┐
    │ Remove from Pending   │
    │ List in Mobile App    │
    └───────────────────────┘




┌─────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER TRACKING VIEW                          │
│                       (Web Browser - 2 Hours)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────┐
                      │ Order Tracking   │
                      │ Page Loads       │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ GET /api/orders/ │
                      │ track/:id        │
                      └────────┬─────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼ Valid (<2h)                     ▼ Expired (>2h)
    ┌─────────────────┐            ┌──────────────────────┐
    │ Show Tracking   │            │ Show "Expired"       │
    │ Page:           │            │ Message              │
    │ • Order ID      │            │ 410 Gone Status      │
    │ • Status        │            └──────────────────────┘
    │ • Countdown     │
    │ • Progress Bar  │
    │ • Total Amount  │
    │ • Delivery Info │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Auto-Refresh    │
    │ Every 30 Sec    │
    └─────────────────┘
```

---

## Status Transitions

```
Order Lifecycle:

pending ──────────────────> approved ──────────> completed
   │                           │
   │                           │
   └──────> cancelled <────────┘


Status Meanings:

• pending   = Customer placed order, waiting for restaurant acceptance
• approved  = Restaurant accepted via mobile app (after call confirmed)
• confirmed = Optional web admin confirmation (legacy flow)
• completed = Order finished (ready/delivered)
• cancelled = Order rejected/cancelled
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│ User Action (Approve, Call, etc.)      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Try API Call   │
         └────────┬───────┘
                  │
     ┌────────────┴───────────┐
     │                        │
     ▼ Success                ▼ Error
┌────────────┐     ┌─────────────────────┐
│ Continue   │     │ Show Alert          │
│ Workflow   │     │ "⚠️ Системна грешка"│
└────────────┘     │ Block Further Steps │
                   │ hasError = true     │
                   └─────────────────────┘
                            │
                            ▼
                   ┌─────────────────────┐
                   │ User Actions:       │
                   │ • Check connection  │
                   │ • Contact support   │
                   │ • Retry later       │
                   └─────────────────────┘
```

---

## Printer Decision Logic

```
Order Status Change
        │
        ▼
┌───────────────┐
│ Is approved?  │
└───────┬───────┘
        │
        ├─────> NO ──> No action
        │
        └─────> YES
                 │
                 ▼
        ┌────────────────┐
        │ Is delivery?   │
        └────────┬───────┘
                 │
                 ├─────> NO ──> No printing
                 │
                 └─────> YES
                          │
                          ▼
                  ┌──────────────┐
                  │ PRINT RECEIPT│
                  └──────────────┘
```

---

## Timeline Example

```
Real-World Scenario:

10:00:00 ─ Customer places order
          Order ID: order_1703160000000_123
          Status: pending
          Tracking expires: 12:00:00

10:01:30 ─ Staff opens mobile app
          Sees order with "✓ Редовен клиент" badge

10:02:00 ─ Staff taps "Приеми"
          Selects "65 минути"
          estimatedTime: 65

10:03:00 ─ Staff taps "1. 📞 Обади се"
          Phone dialer opens: +359888123456
          callMadeAt: 2025-12-21T10:03:00Z

10:04:30 ─ Call completed, returns to app
          Button shows "✓ Обадено"

10:05:00 ─ Staff taps "2. ✓ Одобри"
          Confirms in dialog
          Status changes to: approved
          approvedAt: 2025-12-21T10:05:00Z
          
          [IF DELIVERY]:
          → Receipt prints to 192.168.1.100:9100
          → Sent to delivery API
          → deliveryServiceId: ABC123

10:05:03 ─ Order disappears from mobile app
          Customer tracking page updates:
          "Очаквано време: 60 минути"
          Countdown starts

11:10:00 ─ Estimated completion time reached
          Tracking page shows "Готово!"
          Progress bar: 100%

12:00:00 ─ Tracking expires (2 hours)
          Accessing link shows "Expired" message
```

---

## Button State Matrix

| Step | "Приеми" | Time Picker | "Обади се" | "Одобри" |
|------|----------|-------------|------------|----------|
| Initial | ✅ Visible | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| After Accept | ❌ Hidden | ✅ Visible | ❌ Hidden | ❌ Hidden |
| After Time Select | ❌ Hidden | ❌ Hidden | ✅ Enabled | ⚠️ Disabled |
| After Call | ❌ Hidden | ❌ Hidden | ✅ Disabled (✓) | ✅ Enabled |
| After Approve | Order removed from list |

Legend:
- ✅ = Active/Enabled
- ❌ = Hidden/Not Visible
- ⚠️ = Visible but Disabled
- ✓ = Marked Complete

---

## Data Flow Diagram

```
Customer Phone Input
        │
        ▼
   Validation
        │
        ├─ Invalid ──> Block & Show Error
        │
        └─ Valid ──> Create Order
                         │
                         ├─> previousOrders = COUNT(same phone)
                         ├─> trackingExpiry = now + 2h
                         └─> status = "pending"
                                 │
                                 ▼
                         Save to Database
                                 │
                                 ▼
                         Redirect to Tracking
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   Tracking Page       │
                     │   (Customer View)     │
                     └───────────────────────┘
                                 │
                                 │ Parallel Process
                                 │
                     ┌───────────┴───────────┐
                     │   Mobile App          │
                     │   (Staff View)        │
                     │   Auto-refresh 10s    │
                     └───────────┬───────────┘
                                 │
                                 ▼
                         Accept → Call → Approve
                                 │
                                 ▼
                         Update Database
                         status = "approved"
                                 │
                    ┌────────────┴───────────┐
                    │                        │
                    ▼ Delivery               ▼ Pickup
            ┌──────────────┐        ┌──────────────┐
            │ Print        │        │ No Print     │
            │ Send to API  │        │              │
            └──────────────┘        └──────────────┘
```

---

## Phone Format Validation

```
Input Examples:

❌ INVALID:
   0888123456        (missing +359 prefix)
   +35988812345      (only 8 digits)
   +3598881234567    (10 digits, too many)
   +359 888 123 456  (spaces not allowed)
   +359-888-123-456  (dashes not allowed)
   359888123456      (missing + sign)

✅ VALID:
   +359888123456     (correct format)
   +359877654321     (correct format)
   +359999000111     (correct format)

Regex: /^\+359\d{9}$/
```

---

**Version:** 2.0  
**Created:** December 21, 2025  
**For:** BOJOLE Restaurant Order Management System
