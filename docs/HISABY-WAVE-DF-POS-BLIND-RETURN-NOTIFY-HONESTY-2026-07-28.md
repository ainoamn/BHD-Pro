# موجة DF — صدق إشعار إرجاع الكاشير بدون إيصال (blind return)

**التاريخ:** 28 يوليو 2026

## الهدف

إرجاع بلا إيصال كان ينشئ إشعار دائن دون إشعار العميل ودون `customerNotify` للواجهة، بخلاف بيع/إلغاء/استرجاع بعد DD–DE.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | `notifyPosBlindReturn` + نص رسالة `blind_return` |
| `pos.service.ts` | انتظار الإشعار بعد الإرجاع · إرجاع `customerNotify` |
| `pos/page.tsx` | toast صدق عبر `toastPosCustomerNotify` |

## سلوك

- عند عميل معروف بقناة تواصل: محاولة واتساب/بريد/SMS ثم toast حي/mock/جزئي/فشل
- walk-in أو بدون قناة: `customerNotify: null` — لا toast إضافي

## التالي

مزامنة طابور الكاشير دون اتصال: عرض `customerNotify` بعد flush · Cloudflare / Sentry / OTP يدوياً.
