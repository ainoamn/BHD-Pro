# موجة DX — صدق إشعار جاهزية طلب التوصيل

**التاريخ:** 28 يوليو 2026

## الهدف

عند اكتمال تحضير طلب توصيل في المطبخ (أو عند ضبط الحالة يدوياً إلى READY) لم يكن الضيف يُشعَر — بخلاف السفري الذي حصل على `TAKEAWAY_READY` في موجة DU.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | نوع `DELIVERY_READY` + نص الرسالة وعناوين واتساب |
| `resto.service.ts` → kitchen READY | قناة DELIVERY بنفس بوابة «آخر صنف» · `no_phone` إن لزم |
| `resto.service.ts` → delivery status | إشعار أيضاً عند الانتقال اليدوي إلى `READY` |

## سلوك

- مطبخ: آخر صنف READY لطلب توصيل → واتساب/SMS «جاهز للإرسال» + toast المطبخ الحالي
- صفحة التوصيل: READY / OUT / DELIVERED → إشعار مناسب + toast موجود
- بلا هاتف → `no_phone` بصراحة

## التالي

Cloudflare / Sentry / OTP يدوياً · لاحقاً: تذكير حجوزات تلقائي (cron) · waitlist NO_SHOW.
