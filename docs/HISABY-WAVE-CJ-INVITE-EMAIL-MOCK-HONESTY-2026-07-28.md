# موجة CJ — صدق mock لدعوات البريد

**التاريخ:** 28 يوليو 2026

## الهدف

مع `EMAIL_MODE=mock` كانت دعوة المستخدم تُرجع `emailSent: true` والواجهة تقول «تم إرسال الدعوة» بينما الرسالة تُسجَّل في الخادم فقط.

## التغييرات

| ملف | ماذا |
|-----|------|
| `users.service.ts` | `emailSent` فقط عند تسليم حقيقي · `emailMock` عند mock |
| `users/page.tsx` | toast mock + نسخ رابط الدعوة |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
