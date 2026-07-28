# موجة CY — صدق إشعار التاجر عند بلاغ العميل العام

**التاريخ:** 28 يوليو 2026

## الهدف

صفحة `/dispute/[code]` كانت تقول دائماً «The merchant will be notified» بعد الحفظ، بينما واتساب الشركة قد يكون off / mock / بلا أرقام — والـ API لا يعيد نتيجة الإشعار.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | تجميع نتائج واتساب → `companyNotify: { status, targets }` |
| `dispute/[code]/page.tsx` | رسالة نجاح حسب `ok` / `mock` / `fail` / `skipped` (عربي+إنجليزي) |

## سلوك

- البلاغ يُحفظ دائماً
- mock → لا ادّعاء تسليم · skipped → يظهر في لوحة البلاغات دون واتساب · live → إشعار تم

## التالي

Cloudflare / Sentry / OTP يدوياً.
