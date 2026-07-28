# موجة EH — صدق تنبيه واتساب لحركات نقد الصندوق

**التاريخ:** 28 يوليو 2026

## الهدف

إيداع/صرف نقد (وعكس الحركة) كان يُسجَّل في الوردية وGL بلا تنبيه واتساب للطاقم — فجوة بعد موجة EG (فتح/إغلاق الوردية).

## التغييرات

| ملف | ماذا |
|-----|------|
| `pos.service.ts` | `staffNotify` عبر `notifyStaffWhatsAppAlert` بعد `createCashMovement` و`reverseCashMovement` |
| `api.ts` · `pos-shifts-view.tsx` · `pos-copy` | toast حي/mock/فشل/تخطّي لحركة النقد |

## سلوك

- صرف أو إيداع → واتساب (مخزن، مبلغ، سبب، منفّذ) + toast صدق
- عكس حركة → نفس النمط مع نوع/مبلغ الأصل
- بلا أرقام أو واتساب غير مهيأ → `skipped` بصراحة

## التالي

Cloudflare / Sentry / OTP يدوياً · هيّئ `whatsappNotifyPhones` في إعدادات الأمان.
