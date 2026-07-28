# موجة CH — صدق mock لـ WhatsApp OTP في الحماية المزدوجة

**التاريخ:** 28 يوليو 2026

## الهدف

موجة BT أظهرت صدق mock في اختبارات الرسائل/POS؛ مسار OTP للحماية المزدوجة بقي يقول «تم الإرسال عبر واتساب» حتى عندما `WHATSAPP_TOKEN=mock` والرسالة تُسجَّل في الخادم فقط.

## التغييرات

| ملف | ماذا |
|-----|------|
| `whatsapp-notify.service.ts` | `sendOtp` يمرّر `mock` |
| `dual-control.service.ts` | `requestWhatsappOtp` يُرجع `mock`/`mode` + تدقيق |
| `dual-approval-modal.tsx` | toast mock منفصل |

## التالي

Cloudflare / Sentry / قالب OTP واتساب يدوياً · أرشفة docs.
