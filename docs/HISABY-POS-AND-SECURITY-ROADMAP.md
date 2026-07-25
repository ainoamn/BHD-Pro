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
| **3 — Messaging** | WhatsApp OTP to manager + notify on `ApprovalRequest` create | Done (env-gated OTP + best-effort create alert) |
| **4 — Badge** | NFC / proximity token (`NFC` + bcrypt `nfcBadgeHashes`) | Done (25 Jul 2026) — Web NFC on Android Chrome HTTPS; manual paste for desktop testing |

Sensitive actions covered today: `POS_VOID`, `POS_PRICE_OVERRIDE`, `POS_REFUND`, `STOCK_ADJUST`, `STOCK_TRANSFER`, `INVOICE_CANCEL`, `PAYMENT_REVERSE`, `SHIFT_CLOSE_VARIANCE`, `PAYROLL_PAY`, `CLAIM_PAY`, `BANK_INTERNAL_TRANSFER`.

Config: `companies.security_config` + `GET/PATCH /companies/me/security`.  
Async API: `POST/GET /dual-control/requests`, `POST .../decide`.  
Public flags: `asyncApprovals: true`, `nfcBadgesConfigured`, `shiftVarianceLimit`, `requireOpenShift`.

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
- [x] Dedicated `CASHIER` role (enum + POS ops + users UI; not an approver)
- [x] Partial POS refund (`POST /pos/sales/:id/refund` + credit note + stock IN + line-qty UI)
- [x] Shifts / cash drawer / Z-report (`pos_shifts`, `/pos/shifts`, printable Z on close)
- [x] Mid-shift X-report (`GET /pos/shifts/current/x-report` + `/pos/shifts/:id/x-report`, printable without closing)
- [x] Per-warehouse open shifts
- [x] ESC/POS Web Serial (+ browser thermal fallback) + explicit **طباعة حرارية** + prefer-thermal setting
- [x] Offline sale queue (IndexedDB) + sync on `online` + header pending badge / مزامنة
- [x] NFC badge dual-control (`addNfcBadgeSecret` / `clearNfcBadges`, method `NFC`)
- [x] Dual-control on shift close when cash variance exceeds `shiftVarianceLimit` (default 1.000)
- [x] Offline catalog snapshot cache (IndexedDB) + barcode fallback
- [x] Harden WhatsApp OTP (invalidate unused prior OTPs + max 3 / 10 min)
- [x] WhatsApp notify managers when `ApprovalRequest` is created (best-effort + audit `APPROVAL_REQUEST_NOTIFIED`)
- [x] Today POS stats strip (`GET /pos/stats/today`) + open-shift link on checkout
- [x] Quick create customer from POS (name + phone)
- [x] ESC/POS cash drawer kick (`openCashDrawer` / `tryOpenCashDrawer` + optional auto after cash)
- [x] Offline catalog cache keyed by warehouse + stale indicator (>30 min) + refresh
- [x] Require open shift before sale (`requireOpenShift` in `security_config`, default off; ADMIN toggle)
- [x] Share receipt via WhatsApp + mailto from last-sale card
- [x] Touch quantity keypad modal on cart lines
- [x] Scan success beep (Web Audio) + mute setting
- [x] Refund reason preset chips (AR/EN)
- [x] Parked cart rename (`PATCH /pos/drafts/:id`)
- [x] Product favorites strip (localStorage per company)
- [x] Shortcuts help overlay (`?` key + header button)
- [x] Store credit pay + void restore (`useStoreCredit`, atomic wallet debit, `Contact.currentBalance`)
- [x] Cash change-due tender modal (amount tendered → change → confirm)
- [x] Refund-by-receipt lookup (`GET /pos/sales/by-number?number=`)
- [x] Cash in / cash out on open shift (`pos_cash_movements`, `POST /pos/shifts/current/cash-movements`; expected cash = opening + cash sales − cash refunds + in − out)
- [x] Customer recent purchases strip on checkout (`GET /pos/customers/:id/recent-sales`)
- [x] Share X/Z report via WhatsApp + email (`pos-receipt-share` text summary from `/pos/shifts`)

### Planned
- [ ] Partner NFC tap-to-pay (gateway / wallet partners — not badge dual-control)
- [ ] Native wrapper (Capacitor) if PWA limits hit
- [ ] Reliable multi-vendor Web Bluetooth thermal (current BLE path is best-effort)
- [x] Contacts store-credit wallet UI + GL-backed adjust (POST /contacts/:id/store-credit-adjust → 2130)\n- [x] Full AR GL posting for store-credit (`PaymentMethod.STORE_CREDIT` → liability **2130** ائتمان عملاء; wallet `Contact.currentBalance` kept as operational balance)
- [ ] Split tender (multi-payment on one sale)

### Done (Wave 6)
- [x] Full catalog sync API `GET /pos/catalog/sync` + offline IDB per warehouse
- [x] Broader refunds + store-credit MVP (hardened debit / void restore / UI)
- [x] Cash change due + receipt number lookup for refunds
- [x] Dashboard POS today / pending approvals / open shifts
- [x] WhatsApp notify on approval request (best-effort)

---

## Ops notes

1. Deploy migration `20260725170000_cashier_shifts_otp` (adds `CASHIER`, `pos_shifts`, `invoice.pos_shift_id`, dual-control OTP table).
2. Also ensure prior migrations including `20260725160000_approval_requests` are applied.
3. Managers open **Approvals** from POS header (`/pos/approvals`).
4. Staff open **Shift** from POS header (`/pos/shifts`) — one open shift per warehouse.
5. Camera needs HTTPS (or localhost) + user permission.
6. Receipt print tries Web Serial ESC/POS (then best-effort BLE) when prefer-thermal is on; **طباعة حرارية** forces thermal; otherwise browser 80mm print.
7. Offline sales queue in IndexedDB flushes when the browser goes online; header shows pending count + Sync.
8. NFC badge registration is ADMIN-only in Security settings; hashes live in `security_config` JSON (no new migration). Web NFC = Android Chrome + HTTPS.
9. Closing a shift with `|closingCash − expectedCash| > shiftVarianceLimit` requires dual-control (`SHIFT_CLOSE_VARIANCE`).
10. Creating an `ApprovalRequest` best-effort WhatsApps configured manager phones (or company phone) with a short Arabic/English ping to `/pos/approvals`.
11. Checkout strip: open shift → `/pos/shifts`; today totals from `GET /pos/stats/today` (Asia/Muscat day boundary).
12. Cash drawer: ESC `p 0 25 250` via Web Serial; auto-kick after cash when `preferCashDrawer` is on (defaults with prefer-thermal).
13. `requireOpenShift` (default **false**) blocks `POST /pos/sales` and checkout UI when no open shift; enable in Dual Control / POS settings.
14. Floor polish: qty keypad, scan beep (`hisaby-pos-mute-beep`), favorites (`hisaby-pos-favorites:{companyId}`), receipt WhatsApp/email share, refund reason chips, draft rename, `?` shortcuts help.
15. X-report: mid-shift live totals via `GET /pos/shifts/current/x-report?warehouseId=` (or `/pos/shifts/:id/x-report`); print from `/pos/shifts` without closing.
16. Bank internal transfer dual-control (`BANK_INTERNAL_TRANSFER`) + statement match suggestions UI on `/bank-reconciliation`.
17. Store-credit GL: `PaymentMethod.STORE_CREDIT` posts Dr/Cr liability **2130** against AR (not cash 1100); wallet `Contact.currentBalance` remains operational.
18. Management alerts polish: status tabs + acknowledge/dismiss/resolve + severity; commitments edit with GL accounts + attachments open.
19. Deploy migration `20260725200000_pos_cash_movements` for drawer paid-in/out audit; cash movements appear on current shift, X/Z print, and expected cash.
20. Customer recent sales: `GET /pos/customers/:id/recent-sales` (last 5) under POS customer select; tap to reprint.
21. Share X/Z: WhatsApp / email buttons on `/pos/shifts` using plain-text report summary (same pattern as receipt share).
22. Alert → invoice deep-link (`/accounting?open=`), dashboard/notifications open-alert count, journal attachments.
