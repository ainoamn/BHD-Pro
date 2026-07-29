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

Sensitive actions covered today: `POS_VOID`, `POS_PRICE_OVERRIDE`, `POS_LINE_DISCOUNT`, `POS_STOCK_OVERRIDE`, `POS_NO_SALE`, `POS_REFUND`, `POS_BLIND_RETURN`, `POS_IDLE_UNLOCK`, `STOCK_ADJUST`, `STOCK_TRANSFER`, `INVOICE_CANCEL`, `PAYMENT_REVERSE`, `SHIFT_CLOSE_VARIANCE`, `SHIFT_CASH_OUT`, `PAYROLL_PAY`, `CLAIM_PAY`, `BANK_INTERNAL_TRANSFER`.

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
- [x] Quick create customer from POS (name + **required phone** with dial code)
- [x] ESC/POS cash drawer kick (`openCashDrawer` / `tryOpenCashDrawer` + optional auto after cash)
- [x] Offline catalog cache keyed by warehouse + stale indicator (>30 min) + refresh
- [x] Require open shift before sale (`requireOpenShift` in `security_config`, default off; ADMIN toggle)
- [x] Share receipt via WhatsApp + mailto from last-sale card
- [x] **Auto WhatsApp POS receipt** after payment (server, best-effort) + dispute link for customer protection
- [x] Auto-notify customer on POS void / refund
- [x] Public dispute form `/dispute/[code]` → `POST /api/public/documents/c/:code/dispute` (`CustomerDispute`)
- [x] `autoSendPosReceipts` security toggle (default on when WhatsApp configured)
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
- [x] Cash in/out → GL (`postPosCashIn` / `postPosCashOut`; Dr/Cr 1100 ↔ 4290/5290; `journalId` on movement)
- [x] Soft-block checkout when cart qty exceeds on-hand stock (+ low-stock confirm)
- [x] Manager today-all-shifts board (`GET /pos/stats/shifts-today` + «ورديات اليوم» on `/pos/shifts`)
- [x] Customer recent purchases strip on checkout (`GET /pos/customers/:id/recent-sales`)
- [x] Share X/Z report via WhatsApp + email (`pos-receipt-share` text summary from `/pos/shifts`)
- [x] Split tender (multi-payment on one sale — `payments[]` sums to total; Cash+Card UI)
- [x] Parked cart notes (`pos_drafts.notes`, park/edit/recall → sale notes prefix)
- [x] Tip on sale (`tipAmount` → tax-free Tip / بقشيش line; presets 0 / 5% / 10% / custom)
- [x] **Cashier commission + customer loyalty points** (`incentives_config`, ledgers, compact header chip, `/pos/settings` toggles; accrue on sale / reverse on void)
- [x] **Kitchen + POS load perf** (`light` shift check, aggregate today-stats, capped contacts, SSE-first KDS) — [`HISABY-FIX-KITCHEN-POS-PERF-2026-07-29.md`](./HISABY-FIX-KITCHEN-POS-PERF-2026-07-29.md)

### Planned
- [ ] Hardware NFC tap-to-pay terminal (beyond hosted gateway checkout)
- [x] Partner gateway pay from POS (`PARTNER` + `POST /pos/sales/:id/partner-checkout`) — not badge dual-control
- [ ] Native Capacitor build (scaffold in `mobile/`)
- [ ] Reliable multi-vendor Web Bluetooth thermal (current BLE path is best-effort)
- [x] Optional dual-control for large cash-out (`SHIFT_CASH_OUT` above threshold)
- [x] Contacts store-credit wallet UI + GL-backed adjust (`POST /contacts/:id/store-credit-adjust` → 2130)
- [x] Full AR GL posting for store-credit (`PaymentMethod.STORE_CREDIT` → liability **2130** ائتمان عملاء; wallet `Contact.currentBalance` kept as operational balance)

### Done (Wave 6)

### Done (Wave 7 — Floor speed & trust)
- Keyboard F-keys (scan / park / receipt / cash / card)
- Parked cart inline edit + age/stale + customer auto-name
- Approvals history tab (`/dual-control/requests/history`)
- Variable-measure EAN-13 weight PLU (prefix `2`)
- Doc: [`UPGRADE-POS-WAVE7-2026-07.md`](./UPGRADE-POS-WAVE7-2026-07.md)

### Done (Wave 8 — Loyalty redeem & tender)
- Loyalty points redeem at checkout (atomic debit + `REDEEM` ledger)
- Split tender: Cash + Card + Bank + Store credit
- Custom POS receipt footer (browser + ESC/POS)
- Doc: [`UPGRADE-POS-WAVE8-2026-07.md`](./UPGRADE-POS-WAVE8-2026-07.md)

### Done (Wave 9 — Sync trust & multi-terminal)
- Offline queue continues past failed items; quarantine after 3 attempts + discard UI
- Cloud-synced POS favorites (`GET/PUT /pos/favorites`)
- Parked-cart TTL purge (24h) on draft list
- Keyboard `+/-` last-line quantity
- Doc: [`UPGRADE-POS-WAVE9-2026-07.md`](./UPGRADE-POS-WAVE9-2026-07.md)

### Done (Wave 10 — Scan recovery & close trust)
- Quick-create product on barcode miss (cart + catalog cache)
- Auto Z-report email on shift close (`autoEmailZReportOnClose` + `zReportNotifyEmails`)
- Pre-close EOD checklist (parked / variance / quarantine / anomalies)
- Doc: [`UPGRADE-POS-WAVE10-2026-07.md`](./UPGRADE-POS-WAVE10-2026-07.md)

### Done (Wave 11 — Scan audio & live ops)
- Scan beep grammar: success / low-stock warn / deny
- Independent WhatsApp / Email / SMS receipt toggles + manual SMS resend
- Shifts-today board: void counts, live pulse, 15s poll; dashboard KPI → `/pos/shifts`
- Doc: [`UPGRADE-POS-WAVE11-2026-07.md`](./UPGRADE-POS-WAVE11-2026-07.md)

### Done (Wave 12 — Price fairness & receipt speed)
- Cashier price override via dual-control (`POS_PRICE_OVERRIDE`)
- Recent receipts drawer (`GET /pos/sales/recent`, F7)
- Live void-threshold alert on POS shell (managers)
- Doc: [`UPGRADE-POS-WAVE12-2026-07.md`](./UPGRADE-POS-WAVE12-2026-07.md)

### Done (Wave 13 — Discount governance & tender speed)
- Line discount limits + `POS_LINE_DISCOUNT` dual-control (`maxLineDiscountAmount` / `maxLineDiscountPercent`)
- Bundled dual-control for price+discount on one sale (`assertApprovedForActions`)
- Cash tender touch keypad + Exact / round-up / denomination chips
- Offline queue detail sheet (attempts, errors, quarantine, discard one)
- Doc: [`UPGRADE-POS-WAVE13-2026-07.md`](./UPGRADE-POS-WAVE13-2026-07.md)

### Done (Wave 14 — Drawer audit, price check, stock override)
- Audited no-sale / open drawer (`POS_NO_SALE`, `NO_SALE` cash movement, F6)
- Price-check mode (F3) — scan shows price/stock without cart add
- Manager stock override (`POS_STOCK_OVERRIDE` + `allowNegativeStock`)
- Doc: [`UPGRADE-POS-WAVE14-2026-07.md`](./UPGRADE-POS-WAVE14-2026-07.md)

### Done (Wave 15 — Line notes, cashier KPI, reprint audit)
- Per-line cart notes → `invoice_items.notes` + receipt print
- Today stats: `mine` vs `store` (`cashierId=me`)
- Audited receipt reprint (`POST /pos/sales/:id/reprint` + count badge)
- Doc: [`UPGRADE-POS-WAVE15-2026-07.md`](./UPGRADE-POS-WAVE15-2026-07.md)

### Done (Wave 16 — Park find, cart restore, dup-sale warn)
- Parked-cart search (name / phone / notes) + contact phone on drafts
- Park age from `updatedAt` + suspend reason chips
- Active cart session restore after refresh (localStorage, 12h TTL)
- Duplicate-sale soft-warn (60s cart fingerprint)
- Doc: [`UPGRADE-POS-WAVE16-2026-07.md`](./UPGRADE-POS-WAVE16-2026-07.md)

### Done (Wave 17 — Receipt search, PIN keypad, customer display)
- Receipts drawer search by number / phone / amount (`GET /pos/sales/recent?q=`)
- Touch PIN keypad in dual-approval modal
- Customer second screen `/pos/display` via BroadcastChannel
- Doc: [`UPGRADE-POS-WAVE17-2026-07.md`](./UPGRADE-POS-WAVE17-2026-07.md)

### Done (Wave 18 — Park hold, approval reason, store-credit top-up)
- Parked-cart held tender (cash drawer IN) + remaining due on recall
- Required dual-approval reason (audit)
- In-POS store-credit top-up + shift-open notes UI
- Doc: [`UPGRADE-POS-WAVE18-2026-07.md`](./UPGRADE-POS-WAVE18-2026-07.md)

### Done (Wave 19 — Park reason, gift/refund, tip assignee)
- Required park suspend reason + closed/late shift banners
- Gift receipt reprint (no prices) + one-tap last-sale refund
- Tip assignee picker + tipsTotal / tipsByAssignee on X/Z
- Doc: [`UPGRADE-POS-WAVE19-2026-07.md`](./UPGRADE-POS-WAVE19-2026-07.md)

### Done (Wave 20 — Blind return, approval TTL, sold-by-weight)
- Blind / no-receipt return (`POST /pos/returns/blind` + `POS_BLIND_RETURN`)
- Approval expiry countdown on `/pos/approvals` + dual-approval waiting UX
- `Product.soldByWeight` + decimal kg keypad on POS floor
- Doc: [`UPGRADE-POS-WAVE20-2026-07.md`](./UPGRADE-POS-WAVE20-2026-07.md)

### Done (Wave 21 — Day-part pricing)
- `Product.dayPartPrices` JSON overrides; menu/addItem resolve effective price by company day-part
- Staff UI on `/resto/menu` + `PATCH /resto/menu/:id/day-part-prices`
- Docs: [`UPGRADE-POS-WAVE21-2026-07.md`](./UPGRADE-POS-WAVE21-2026-07.md), [`UPGRADE-RESTO-WORLD-CLASS-2026-07.md`](./UPGRADE-RESTO-WORLD-CLASS-2026-07.md)

### Done (Wave 22 — Idle lock, till count, training mode)
- Idle screen lock (`idleLockMinutes` + `POS_IDLE_UNLOCK`)
- Till denomination count on shift close → Z report + `closingDenominationJson`
- Training mode (simulated checkout, no stock/GL)
- Doc: [`UPGRADE-POS-WAVE22-2026-07.md`](./UPGRADE-POS-WAVE22-2026-07.md)

### Resto world-class (recent, same track)
- Public online booking `/reserve/[slug]` + guest notify + `/book/[token]`
- Guest QR seat picker; KDS station filter persistence; reservation `source`
- Master resto doc: [`UPGRADE-RESTO-WORLD-CLASS-2026-07.md`](./UPGRADE-RESTO-WORLD-CLASS-2026-07.md)

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
10. Deploy migration `20260725240000_pos_incentives` for commission/loyalty (`incentives_config`, `cashier_commission_ledger`, `loyalty_points_ledger`, `contacts.loyalty_points`). Enable via **POS Settings → Commission & loyalty**.
11. Creating an `ApprovalRequest` best-effort WhatsApps configured manager phones (or company phone) with a short Arabic/English ping to `/pos/approvals`.
12. Checkout strip: open shift → `/pos/shifts`; today totals from `GET /pos/stats/today` (Asia/Muscat day boundary).
13. Cash drawer: ESC `p 0 25 250` via Web Serial; auto-kick after cash when `preferCashDrawer` is on (defaults with prefer-thermal).
14. `requireOpenShift` (default **false**) blocks `POST /pos/sales` and checkout UI when no open shift; enable in Dual Control / POS settings.
15. Floor polish: qty keypad, scan beep (`hisaby-pos-mute-beep`), favorites (`hisaby-pos-favorites:{companyId}`), receipt WhatsApp/email share, refund reason chips, draft rename, `?` shortcuts help.
16. X-report: mid-shift live totals via `GET /pos/shifts/current/x-report?warehouseId=` (or `/pos/shifts/:id/x-report`); print from `/pos/shifts` without closing.
17. Bank internal transfer dual-control (`BANK_INTERNAL_TRANSFER`) + statement match suggestions UI on `/bank-reconciliation`.
18. Store-credit GL: `PaymentMethod.STORE_CREDIT` posts Dr/Cr liability **2130** against AR (not cash 1100); wallet `Contact.currentBalance` remains operational.
19. Management alerts polish: status tabs + acknowledge/dismiss/resolve + severity; commitments edit with GL accounts + attachments open.
20. Deploy migration `20260725200000_pos_cash_movements` for drawer paid-in/out audit; cash movements appear on current shift, X/Z print, and expected cash.
21. Customer recent sales: `GET /pos/customers/:id/recent-sales` (last 5) under POS customer select; tap to reprint.
22. Share X/Z: WhatsApp / email buttons on `/pos/shifts` using plain-text report summary (same pattern as receipt share).
23. Alert → invoice deep-link (`/accounting?open=`), dashboard/notifications open-alert count, journal attachments.
24. Deploy migration `20260725210000_pos_draft_notes`; split tender + tip on `POST /pos/sales`; Z-report aggregates payment amounts by method.
25. Deploy migration `20260725220000_pos_cash_movement_journal`; cash in/out posts GL (`postPosCashIn`/`postPosCashOut`, accounts 4290/5290 ↔ 1100); reason required for OUT.
26. Checkout soft-blocks when tracked qty > on-hand; confirms when stock would fall to/below `minQuantity`.
27. Manager today board: `GET /pos/stats/shifts-today` + «ورديات اليوم» table on `/pos/shifts` (ADMIN/MANAGER/ACCOUNTANT).
28. Customer phone-first: dial default from `company.country`; CUSTOMER create requires E.164 phone; POS/accounting quick-add uses dial+local.
29. Auto POS receipt WhatsApp (`CustomerNotifyService`) after sale + void/refund notify; dispute URL `/dispute/{publicVerifyCode}`; migration `20260725230000_customer_disputes`.
30. Next: Twilio SMS optional. Email receipts via Resend/SMTP when configured. Deploy `20260725240000_pos_incentives` after pull.
31. Deploy `20260726190000_product_day_part_prices` for resto day-part price overrides; configure on `/resto/menu`. Also apply recent resto migrations (`resto_guest_notify`, `resto_public_booking`) if not yet.

---

## Anti-tamper controls (cash & inventory)

Hardening already in product (keep these intact when changing POS):

| Control | Where |
|---------|--------|
| Dual-control on shift close when `\|variance\| > shiftVarianceLimit` | `SHIFT_CLOSE_VARIANCE` |
| Atomic stock decrement on sale / restore on void & refund | `PosService` + product movements |
| Commission payout → drawer `PosCashMovement` OUT (default) + GL `postPosCashOut` | `PosIncentivesService.payout` |
| Cash in/out movements post to GL and feed expected cash | `createCashMovement` + Z formula |
| Customer notify on void / refund (best-effort WhatsApp) | `CustomerNotifyService` |
| Audit-friendly ledgers (commission, cash movements, dual-control requests) | Prisma tables + security config |
| Rule-based AI shift anomaly flags (variance, voids, cash-out %, commission mismatch, refunds) | `GET /ai/shifts/:shiftId/anomalies` |

Z expected cash: `opening + cash sales − cash refunds + cash in − cash out` (commission drawer payouts are cash out).
