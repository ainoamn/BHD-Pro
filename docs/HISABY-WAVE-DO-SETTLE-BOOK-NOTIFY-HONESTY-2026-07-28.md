# موجة DO — صدق إيصال دفع المقعد/التقسيم + إشعار المطعم عند تأكيد/إلغاء الحجز العام

**التاريخ:** 28 يوليو 2026

## الهدف

1. دفع مقعد / تقسيم متساوٍ كان يغلق الفاتورة عبر `closeOrder` دون toast صدق للإيصال.
2. تأكيد/إلغاء الضيف من رابط `/book/[token]` كان يحدّث الحالة فقط دون إبلاغ الطاقم.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` | `notifyFloorStaffAlert` موحّد · `companyNotify` على confirm/cancel العام |
| `resto/page.tsx` · `api.ts` | toast إغلاق + `customerNotify` بعد settle |
| `book/[token]/page.tsx` | رسالة صدق عن إشعار المطعم |

## سلوك

- settle: نفس مسار DN لإيصال العميل
- تأكيد/إلغاء عام: واتساب لأرقام إشعار الحماية المزدوجة عند التهيئة

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
