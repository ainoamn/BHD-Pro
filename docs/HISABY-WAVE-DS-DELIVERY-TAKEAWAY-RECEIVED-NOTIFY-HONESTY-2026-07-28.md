# موجة DS — صدق إشعار استلام طلب توصيل/سفري

**التاريخ:** 28 يوليو 2026

## الهدف

فتح طلب DELIVERY أو TAKEAWAY من الطاقم كان يوجّه للطلب بلا إخبار الضيف أن الطلب وصل للمطعم، وبلا صدق في الواجهة إن فشل/mock الإشعار.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | أنواع `DELIVERY_RECEIVED` / `TAKEAWAY_RECEIVED` + نص الرسالة |
| `resto.service.ts` → `openOrder` | بعد إنشاء غير dine-in: إشعار الضيف عند وجود هاتف، وإلا `no_phone` · إرجاع `notify` |
| `api.ts` · `delivery/page.tsx` · `takeaway/page.tsx` · `resto-copy.ts` | toast حي/mock/`no_phone`/فشل |

## سلوك

- dine-in: بدون تغيير (لا `notify`)
- توصيل/سفري + هاتف: واتساب/SMS «تم استلام طلبك» + toast
- سفري بلا هاتف: `notify.error = no_phone` + toast توضيحي (التوصيل يطلب هاتفاً في الواجهة أصلاً)

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
