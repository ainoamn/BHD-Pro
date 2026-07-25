# Integrations wave — OTA, messaging, S3, partner/terminal pay, AI HITL, offline, Capacitor

Shipped as **config-ready**. Live tax authority clearance and SoftPOS hardware still need real vendor credentials.

## What landed (this wave)

| Area | Behavior |
|------|----------|
| **Terminal tap-to-pay** | `POST /pos/sales/:id/terminal-tap` — modes `mock` \| `hosted` \| `softpos` (`POS_TERMINAL_MODE`). POS button «لمس / Terminal». **Not** NFC approval badge. |
| **Partner pay** | Existing hosted Thawani/Stripe/PayPal checkout. |
| **SMS (Twilio)** | `SmsNotifyService` + auto POS receipts + `POST /messaging/test` channel `sms`. |
| **OTA live HTTP** | Live mode POSTs to `apiBaseUrl` + `submitPath` (default `/v1/invoices`); queues `LIVE_PENDING` on 404/transport errors. |
| **AI LLM summary** | When `OPENAI_API_KEY` / `AI_LLM_API_KEY` set — enriches analytics with `llmNote` (HITL only, never auto-posts). |
| **Offline idempotency** | `clientSaleId` on `POST /pos/sales` + offline queue. |
| **Capacitor** | `mobile/package.json`, `capacitor.config.ts`, `www/`, BLE plugin dependency. |
| **BLE print** | Capacitor BLE write path + Web Serial / Web Bluetooth fallbacks. |

## Env

```bash
# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
TWILIO_MODE=mock   # optional log-only

# Terminal SoftPOS
POS_TERMINAL_MODE=hosted   # mock | hosted | softpos
POS_SOFTPOS_DEEP_LINK_TEMPLATE=   # optional, {invoiceId} {amount} {sessionId}

# OTA live secret fallback
OTA_CLIENT_SECRET=

# LLM (optional summary only)
OPENAI_API_KEY=
# or AI_LLM_API_KEY= + AI_LLM_BASE_URL= + AI_LLM_MODEL=

# Mobile shell
HISABY_MOBILE_SERVER_URL=https://bhd-pro.vercel.app/pos
```

## Deploy checklist

1. **Vercel** — Deploy latest `main` (do not Redeploy old failed commits).
2. **Render** — Manual Deploy of latest `main` for `hisaby-api` (apply Prisma migrations if prompted).

## Honest limits

- SoftPOS deep-link needs a vendor template; without it, hosted gateway checkout is used.
- OTA live path is a generic HTTP contract — map `submitPath` to the official Oman OTA API when issued.
- Capacitor Android/iOS project folders are created locally via `npx cap add` (not committed).
- BLE reliability varies by printer firmware; Web Serial remains the most reliable desktop path.
