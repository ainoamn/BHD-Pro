# موجة DE — صدق إشعار العميل عند إلغاء/استرجاع بيع الكاشير

**التاريخ:** 28 يوليو 2026

## الهدف

بعد Wave DD أصبح بيع الكاشير يعيد `customerNotify`، بينما void/refund بقيَا fire-and-forget دون نتيجة للواجهة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | `notifyPosVoid` / `notifyPosRefund` يعيدان قنوات التسليم |
| `pos.service.ts` | انتظار الإشعار على void/refund · إرجاع `customerNotify` · حذف `fireCustomerNotify` |
| `pos/page.tsx` | `toastPosCustomerNotify` مشترك للبيع/الإلغاء/الاسترجاع |

## سلوك

- نفس toast الصدق (حي / mock / جزئي / فشل) بعد void وrefund عند وجود قنوات

## التالي

Cloudflare / Sentry / OTP يدوياً.
