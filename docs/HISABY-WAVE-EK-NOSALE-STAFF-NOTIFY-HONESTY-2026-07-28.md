# موجة EK — صدق تنبيه واتساب لفتح الدرج بلا بيع

**التاريخ:** 28 يوليو 2026

## الهدف

`NO_SALE` يُسجَّل في الوردية دون تنبيه واتساب للطاقم — فجوة بعد EH (حركات النقد) وEG (فتح/إغلاق الوردية).

## التغييرات

| ملف | ماذا |
|-----|------|
| `pos.service.ts` | `staffNotify` عبر `notifyStaffWhatsAppAlert` بعد `createNoSale` |
| `api.ts` · `pos/page.tsx` · `pos-copy` | toast حي/mock/فشل/تخطّي + `apiErrorMessage` عند الفشل |

## سلوك

- فتح درج بلا بيع → واتساب (مخزن، سبب، منفّذ) + toast صدق
- بلا أرقام → `skipped` بصراحة

## التالي

Cloudflare / Sentry / OTP يدوياً · هيّئ `whatsappNotifyPhones`.
