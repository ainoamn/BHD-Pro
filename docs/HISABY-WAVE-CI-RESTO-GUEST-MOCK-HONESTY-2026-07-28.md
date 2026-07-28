# موجة CI — صدق mock لإشعارات ضيوف المطاعم (انتظار/حجز)

**التاريخ:** 28 يوليو 2026

## الهدف

مع `WHATSAPP_TOKEN=mock` أو SMS mock كانت واجهة الانتظار/الحجوزات تعرض «تم إرسال الإشعار»، وتُخزَّن `notifyResult: ok`، وتأكيد الحجز كان يضبط `CONFIRMED` / `reminderSentAt` على نجاح وهمي.

## التغييرات

| ملف | ماذا |
|-----|------|
| `whatsapp-notify.service.ts` | `sendGuestNotify` يمرّر `mock` |
| `resto-guest-notify.service.ts` | `notifyGuest` يُرجع `mock`/`mode` |
| `resto.service.ts` | انتظار: `notifyResult: mock` · حجز: لا تأكيد/تذكير إلا عند تسليم حقيقي |
| `waitlist/page.tsx` · `reservations/page.tsx` | toast mock |
| `resto-copy.ts` | `notifySentMock` |

## سلوك

- mock → toast تحذيري · صف الانتظار `mock` · الحالة CONFIRMED لا تُضبط تلقائياً (استخدم زر التأكيد يدوياً)
- live → كما كان

## التالي

Cloudflare / Sentry / OTP واتساب · صدق mock لدعوات المستخدمين · أرشفة docs.
