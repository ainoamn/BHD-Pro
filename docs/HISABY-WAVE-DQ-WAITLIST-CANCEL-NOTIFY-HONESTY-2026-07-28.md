# موجة DQ — صدق إشعار إلغاء قائمة الانتظار

**التاريخ:** 28 يوليو 2026

## الهدف

إلغاء ضيف من قائمة الانتظار كان يغيّر الحالة فقط دون إبلاغ الضيف ودون toast صدق.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | نوع `WAITLIST_CANCELLED` |
| `resto.service.ts` | `sendWaitlistCancelledNotify` عند `CANCELLED` · حفظ `notifyResult` |
| `waitlist/page.tsx` · `resto-copy` | toast إلغاء + صدق الإشعار |

## سلوك

- بهاتف: واتساب/SMS بإلغاء الانتظار ثم toast حي/mock/فشل
- بدون هاتف: toast إلغاء + `no_phone` بصراحة

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
