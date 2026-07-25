# Integrations wave — OTA, messaging, S3, partner pay, AI HITL, offline stock, Capacitor

Shipped as **config-ready / sandbox-ready**. Live OTA clearance and native BLE require real credentials / Capacitor build.

## What landed

| Area | Behavior |
|------|----------|
| **OTA** | Company `zatcaConfig` modes `mock` \| `sandbox` \| `live`. UI on `/vat`. Live queues `LIVE_PENDING` until official API contract. |
| **Partner pay** | POS button «دفع شريك» creates unpaid invoice + Thawani/Stripe/PayPal checkout. **Not** NFC badge dual-control. |
| **Offline stock** | `GET /pos/stock/sync?since=` merges deltas into IndexedDB catalog cache. |
| **S3** | `ATTACHMENT_STORAGE=s3` + `S3_*` (optional `@aws-sdk/client-s3`). |
| **AI HITL** | `/ai-analytics` rule engine; «إرسال للمراجعة» → Management Alerts. No auto-posting. |
| **WhatsApp + Email** | Cloud API / mock + Resend/SMTP/mock. Auto POS receipts. OTP via dual-control. Guide: `/integrations` → **اقرأني**. |
| **Capacitor / BLE** | `mobile/README.md` + `frontend/src/lib/capacitor-ble.ts` stubs. |

## Env (see `.env.example`)

- `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` (or `WHATSAPP_TOKEN=mock`)
- `EMAIL_MODE=mock` or `RESEND_API_KEY` / `SMTP_*`
- `ATTACHMENT_STORAGE=dataurl|local|s3` + `S3_*`

## Honest limits

- OTA **live** HTTP is gated until Oman OTA credentials/API are provided.
- Partner NFC tap-to-pay hardware is **not** implemented; partner pay uses hosted gateway checkout (card/wallet).
- Capacitor BLE is scaffold only until a native app is built.
