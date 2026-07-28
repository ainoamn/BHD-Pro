# موجة DR — صدق إشعار عند إنشاء حجز من الطاقم

**التاريخ:** 28 يوليو 2026

## الهدف

حجز الطاقم كان يُنشأ `PENDING` بلا إشعار، رغم أن الطاقم أكّده فعلياً عند الإدخال؛ الضيف ينتظر تأكيداً يدوياً لاحقاً.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` | مصدر STAFF → `CONFIRMED` افتراضياً · إشعار CONFIRM عند `autoNotify` وهاتف · إرجاع `notify` |
| `reservations/page.tsx` · `api.ts` | toast تأكيد + صدق الإشعار |

## سلوك

- حجز عام (GUEST) يبقى كما هو (PENDING/CONFIRMED حسب `autoConfirm` + إشعاره الخاص)
- طاقم + هاتف + autoNotify: واتساب/SMS تأكيد + toast حي/mock/فشل/`no_phone`

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
