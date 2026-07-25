# Integrations wave — OTA, messaging, S3, partner/terminal pay, AI HITL, offline, Capacitor

**آخر تحديث:** 25 يوليو 2026 · مرفوع على `main`  
**دليل المراسلات التفصيلي (عربي):** [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)  
**واجهة المنتج:** `/integrations` → **اقرأني**

Shipped as **config-ready**. Live Meta/Resend/Twilio/SoftPOS/OTA-authority credentials are optional until you activate them.

---

## Messaging (WhatsApp / Email / SMS)

| Channel | Programmed? | Auto-send without human? | Needs subscription/setup? |
|---------|-------------|---------------------------|----------------------------|
| **WhatsApp** | Yes — Meta Cloud API | Yes, after env keys | Yes later: Meta Business + token + Phone number ID |
| **Email** | Yes — Resend or SMTP | Yes, after env keys | Yes later: Resend or company SMTP |
| **SMS** | Yes — Twilio | Yes, after env keys | Optional: Twilio account |

**Today without keys:** channels stay `off` / `mock` — POS and dual-control still work; no real messages leave the server.

**Why built this way:** server-side delivery (not manual WhatsApp Web share), audit on invoice `delivery` JSON, same hooks for sale/void/refund/OTP/dispute alerts.

**How managed:** Render env vars + `/integrations` status/test + dual-control `whatsappNotifyPhones` + `autoSendPosReceipts` / email / sms toggles in security config.

**Deferred by product choice:** Meta signup and production templates — documented in the Arabic guide §8 for when you have time.

---

## What else landed (this wave)

| Area | Behavior |
|------|----------|
| **Terminal tap-to-pay** | `POST /pos/sales/:id/terminal-tap` — modes `mock` \| `hosted` \| `softpos` (`POS_TERMINAL_MODE`). **Not** NFC approval badge. |
| **Partner pay** | Hosted Thawani/Stripe/PayPal checkout from POS. |
| **OTA** | Company `zatcaConfig` mock \| sandbox \| live (`/vat`). |
| **S3 attachments** | `ATTACHMENT_STORAGE=s3` + keys (package optional/dynamic). |
| **AI HITL** | Rules + optional LLM note; propose → Management Alerts only. |
| **Offline** | Catalog/stock sync + sale queue + `clientSaleId` idempotency. |
| **Capacitor / BLE** | `mobile/` scaffold + BLE helper stubs. |

---

## Env cheat-sheet

```bash
# WhatsApp (activate later)
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Email
EMAIL_ENABLED=true
EMAIL_FROM=Hisaby <noreply@yourdomain.com>
RESEND_API_KEY=
# or SMTP_*

# SMS (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
TWILIO_MODE=mock

# Terminal SoftPOS
POS_TERMINAL_MODE=hosted
POS_SOFTPOS_DEEP_LINK_TEMPLATE=

# Attachments
ATTACHMENT_STORAGE=dataurl
# ATTACHMENT_STORAGE=s3 + S3_*

# LLM (optional summary only)
OPENAI_API_KEY=
```

---

## Deploy checklist

1. **Render** — Manual Deploy of latest `main` for `hisaby-api` (lockfile harden commits included).
2. **Vercel** — Latest `main` for frontend.
3. **DB:** `npx prisma migrate deploy` (or Dockerfile `db push` path as configured).

---

## Honest limits

- WhatsApp production often needs **approved templates** for first outreach outside the 24h session window.
- SoftPOS needs a vendor deep-link template; otherwise use hosted gateway.
- OTA live HTTP is a generic contract until the official Oman API path is mapped.
- Capacitor Android/iOS native folders are generated locally (`npx cap add`), not fully committed.

---

## Next step (ops)

1. Confirm Render deploy of current `main` is **Live** (not stuck on `53dc753`).
2. Keep messaging env empty until you are ready for Meta/Resend.
3. When ready: follow [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md) §8.
