# Integrations wave — OTA, messaging, S3, partner/terminal pay, AI HITL, offline, Capacitor

**آخر تحديث:** 29 يوليو 2026 · مرفوع على `main`  
**دليل المراسلات التفصيلي (عربي):** [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)  
**حادثة واتساب (تم الإرسال ولا يصل):** [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md)  
**واجهة المنتج:** `/integrations` → **اقرأني**

Messaging code is **live-ready**. WhatsApp Cloud API is **activated in production** (`live` + `pos_receipt`). Email/SMS/SoftPOS/OTA credentials remain optional until activated.

---

## Messaging (WhatsApp / Email / SMS)

| Channel | Programmed? | Auto-send without human? | Needs subscription/setup? |
|---------|-------------|---------------------------|----------------------------|
| **WhatsApp** | Yes — Meta Cloud API | Yes | **Done on prod** — keep template body aligned (5 vars) |
| **Email** | Yes — Resend or SMTP | Yes, after env keys | Optional: Resend or company SMTP |
| **SMS** | Yes — Twilio | Yes, after env keys | Optional: Twilio account |

**Today:** WhatsApp `live` with `WHATSAPP_RECEIPT_TEMPLATE=pos_receipt`. Email/SMS often still `off`. Without keys, channels stay `off` / `mock`.

**Accepted ≠ delivered:** UI `whatsapp: ok` means Meta accepted the Graph request. Confirm delivery in WhatsApp Manager (or future webhooks). See the Arabic delivery fix doc.

**Why built this way:** server-side delivery (not manual WhatsApp Web share), audit on invoice `delivery` JSON, same hooks for sale/void/refund/OTP/dispute alerts.

**How managed:** Render env vars + `/integrations` status/test + dual-control `whatsappNotifyPhones` + `autoSendPosReceipts` / email / sms toggles in security config.

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
# WhatsApp (production: live)
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_RECEIPT_TEMPLATE=pos_receipt
WHATSAPP_RECEIPT_TEMPLATE_LANG=ar

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

1. **Render** — Manual Deploy of latest `main` for `hisaby-api`.
2. **Vercel** — Latest `main` for frontend.
3. **DB:** `npx prisma migrate deploy` (or Dockerfile `db push` path as configured).

---

## Honest limits

- WhatsApp first outreach outside 24h **requires** an approved template matching Hisaby’s 5 body params.
- SoftPOS needs a vendor deep-link template; otherwise use hosted gateway.
- OTA live HTTP is a generic contract until the official Oman API path is mapped.
- Capacitor Android/iOS native folders are generated locally (`npx cap add`), not fully committed.
- Delivery webhooks are **not** wired yet — do not treat green POS toast as phone delivery proof.

---

## Next step (ops)

1. Align Meta `pos_receipt` body with the Arabic guide §3; retest from `/integrations` and POS resend.
2. Deploy the delivery-honesty code fix if not yet Live.
3. Follow [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md) §8 checklist.
