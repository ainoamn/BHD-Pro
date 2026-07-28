# موجة DV — صدق إشعار «الطاولة جاهزة» عند إجلاس الحجز

**التاريخ:** 28 يوليو 2026

## الهدف

زر «إجلاس» كان يفتح الطلب وينقل للطاولة بلا إشعار للضيف أن طاولته جاهزة، رغم وجود نوع `TABLE_READY` وزر إرسال يدوي — فجوة صدق مقارنة بتأكيد/إلغاء الحجز.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` → `updateReservationStatus` | عند `SEATED`: إشعار `TABLE_READY` إن `autoNotify` + هاتف · وإلا `no_phone` |
| نفس المسار | إلغاء/عدم حضور بلا هاتف → `no_phone` (كان يُسكت) |
| `reservations/page.tsx` · `resto-copy` | toast إجلاس + صدق الإشعار |

## سلوك

- إجلاس + هاتف + autoNotify → واتساب/SMS «الطاولة جاهزة» + toast
- إجلاس بلا هاتف → `no_phone` + toast توضيحي
- autoNotify معطّل → بلا إشعار تلقائي (الزر اليدوي يبقى)

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
