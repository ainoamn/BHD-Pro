# موجة CM — صدق سجل تذكيرات الاشتراك (live vs mock)

**التاريخ:** 28 يوليو 2026

## الهدف

كرون التذكير اليومي كان يعدّ كل `ok` (بما فيها mock) كإرسال في السجل: `emails≈N` مضلّل عند `EMAIL_MODE=mock`.

## التغييرات

| ملف | ماذا |
|-----|------|
| `subscription-reminder.service.ts` | فصل `liveEmails` / `mockEmails` · لا يحدّث `subscriptionReminderSentAt` إلا بعد محاولة ناجحة (حية أو mock لتفادي السبام) |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
