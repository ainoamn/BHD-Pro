# Hisaby POS & Security Roadmap

**Date:** 25 July 2026  
**Related:** [`HISABY-STATUS-AND-GAPS.md`](./HISABY-STATUS-AND-GAPS.md)

---

## Vision — Hisaby POS

World-class retail checkout for Gulf SMEs, usable on:

- **Phone / iPad / tablet** (PWA install + large touch targets)
- **Camera barcode** scanning (native `BarcodeDetector`, ZXing fallback)
- **Hardware scanners** (keyboard wedge into scan field — already supported)
- **Partner NFC / wallet payments** later (not in-app card vaulting)

POS lives at **`/pos`**, optionally linked to Accounting via shared login or technical key.

---

## Dual-control phases

| Phase | Methods | Status |
|-------|---------|--------|
| **1 — MVP** | `SELF_CONFIRM` (ADMIN/MANAGER), `PASSWORD` (other manager), `PIN` | Done |
| **2 — Async online** | `APPROVAL_REQUEST` — cashier creates request; manager decides on `/pos/approvals`; token consumed on action | Done (25 Jul 2026) |
| **3 — Messaging** | WhatsApp OTP to manager | Planned |
| **4 — Badge** | NFC / proximity token | Planned |

Sensitive actions covered today: `POS_VOID`, `POS_PRICE_OVERRIDE`, `STOCK_ADJUST`, `STOCK_TRANSFER`, `INVOICE_CANCEL`, `PAYMENT_REVERSE`.

Config: `companies.security_config` + `GET/PATCH /companies/me/security`.  
Async API: `POST/GET /dual-control/requests`, `POST .../decide`.  
Public flag: `asyncApprovals: true`.

---

## Done vs planned checklist

### Done
- [x] POS checkout shell + catalog + cart
- [x] Warehouse-aware stock at sale
- [x] Void with stock restore + GL reverse
- [x] Parked carts (`pos_drafts`) cross-device
- [x] Customer on sale, line discount, bank transfer
- [x] Dual-control MVP (self / password / PIN)
- [x] Async `ApprovalRequest` + manager queue UI
- [x] Camera barcode modal
- [x] PWA shortcuts (كاشير → `/pos`, المحاسبة → `/dashboard`)
- [x] Thermal-friendly 80mm receipt CSS

### Planned
- [ ] NFC badge method
- [x] Dedicated `CASHIER` role enum + UX
- [x] Shifts / cash drawer / Z-report
- [x] Partial refunds (credit note + stock restore)
- [x] WhatsApp OTP approval delivery (env-gated)
- [ ] Full offline queue + sync
- [ ] Real ESC/POS / raw printer bridge
- [ ] Partner NFC tap-to-pay
- [ ] Native wrapper (Capacitor) if PWA limits hit
- [ ] Multi-warehouse concurrent open shifts
- [ ] Line-qty picker UI for partial refunds

---

## Ops notes

1. Deploy migration `20260725160000_approval_requests`.
2. Managers open **Approvals** from POS header (`/pos/approvals`).
3. Camera needs HTTPS (or localhost) + user permission.
4. Receipt print remains browser print — ESC/POS is a later bridge.
