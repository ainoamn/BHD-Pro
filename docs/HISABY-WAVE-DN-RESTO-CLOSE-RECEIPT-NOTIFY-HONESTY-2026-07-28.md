# موجة DN — صدق إيصال العميل عند إغلاق طلب المطعم مدفوعاً

**التاريخ:** 28 يوليو 2026

## الهدف

إغلاق طاولة نقداً/بطاقة كان ينشئ بيع كاشير دون ربط هاتف الضيف بجهة اتصال، فيتخطّى إشعار الإيصال، ودون إرجاع `customerNotify` للواجهة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` | إنشاء/ربط جهة اتصال من `guestPhone` قبل البيع · إرجاع `customerNotify` |
| `resto/page.tsx` · `orders/[id]` · `resto-copy` · `api.ts` | toast إغلاق + صدق قنوات الإيصال |

## سلوك

- ضيف بهاتف: يُنشأ/يُربط contact ثم مسار إشعار POS المعتاد
- toast حي/mock/جزئي/فشل بعد `closePaidOk`

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
