# موجة DT — صدق إشعار إلغاء طلب المطعم (+ إصلاح توصيل)

**التاريخ:** 28 يوليو 2026

## الهدف

إلغاء الطلب من الطاقم كان يُغلق الطلب بلا إخبار الضيف، وبلا صدق في الواجهة. كذلك إشعار «في الطريق / تم التسليم» كان يشترط اسم الضيف صراحةً فيُسكت الإشعار عند وجود هاتف فقط.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | نوع `ORDER_CANCELLED` · خريطة عناوين واتساب بدل ternary متداخل |
| `resto.service.ts` → `cancelOrder` | إشعار الضيف بعد الإلغاء · `no_phone` · إرجاع `notify` |
| `resto.service.ts` → delivery status | اسم احتياطي من رقم الطلب · `no_phone` عند OUT/DELIVERED بلا هاتف |
| `resto.service.ts` → `ingestExternalOrder` | يمرّر `notify` من `openOrder` |
| `api.ts` · `resto/page.tsx` · `orders/[id]` · `resto-copy` | toast إلغاء حي/mock/`no_phone`/فشل |

## سلوك

- أي قناة + هاتف عند الإلغاء → واتساب/SMS + toast
- بلا هاتف → `notify.error = no_phone` + toast توضيحي
- توصيل OUT/DELIVERED: يعمل بالهاتف فقط (الاسم اختياري)

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
