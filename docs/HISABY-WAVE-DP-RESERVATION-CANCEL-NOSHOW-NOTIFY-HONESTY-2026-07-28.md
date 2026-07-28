# موجة DP — صدق إشعار الضيف عند إلغاء/عدم حضور الحجز

**التاريخ:** 28 يوليو 2026

## الهدف

إلغاء أو تسجيل عدم حضور من لوحة الطاقم كان يغيّر الحالة فقط دون إشعار الضيف ودون toast صدق.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | أنواع `RESERVATION_CANCELLED` / `RESERVATION_NO_SHOW` |
| `resto.service.ts` | إشعار تلقائي عند الإلغاء/عدم الحضور (مع `autoNotify`) · تخطي إشعار الضيف عند الإلغاء العام الذاتي |
| `reservations/page.tsx` · `resto-copy` | toast حالة + صدق الإشعار |

## سلوك

- طاقم يلغي / عدم حضور + هاتف + autoNotify: واتساب/SMS ثم toast
- ضيف يلغي من الرابط العام: إشعار المطعم فقط (موجة DO) دون رسالة إلغاء لنفسه

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
