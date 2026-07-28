# موجة DK — صدق إشعار جاهزية التسليم المؤجّل في الكاشير

**التاريخ:** 28 يوليو 2026

## الهدف

بيع مؤجّل التسليم (`deferredFulfillment`) كان يخصم المخزون عند «تسليم الآن» دون إشعار العميل ودون `customerNotify` للواجهة — بخلاف إيصال البيع واستلام takeaway.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | `notifyPosFulfill` + نص `fulfill` |
| `pos.service.ts` | انتظار الإشعار بعد التسليم · إرجاع `customerNotify` |
| `pos/page.tsx` | toast صدق عبر `toastPosCustomerNotify` |

## سلوك

- عميل معروف بقناة: «طلبك جاهز للاستلام» عبر واتساب/بريد/SMS ثم toast حي/mock/جزئي/فشل
- walk-in أو بدون قناة: `customerNotify: null`

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
