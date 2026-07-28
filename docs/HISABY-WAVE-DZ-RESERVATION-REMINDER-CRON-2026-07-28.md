# موجة DZ — تذكير الحجوزات التلقائي (cron)

**التاريخ:** 28 يوليو 2026

## الهدف

تذكير الحجز كان يدوياً فقط من زر الطاقم؛ الحجوزات المؤكّدة لا تُذكَّر تلقائياً قبل الموعد رغم وجود `reminderSentAt` ونوع `REMINDER`.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` | إعداد `booking.remindMinutes` (افتراضي 120) · `processDueReservationReminders` · ختم `reminderSentAt` عند نجاح التذكير حتى في mock |
| `resto-reservation-reminder.service.ts` | Cron كل 15 دقيقة |
| `resto.module.ts` · DTO | تسجيل الخدمة + حقل API |
| إعدادات المطعم · `api.ts` · `resto-copy` | حقل «تذكير قبل الموعد» |

## سلوك

- حجوزات `CONFIRMED` بهاتف و`reminderSentAt` فارغ وداخل نافذة `remindMinutes`
- يتطلب `autoNotify` · `remindMinutes = 0` يعطّل التذكير التلقائي
- الحد الأقصى للمسح: 24 ساعة قادمة · حتى 300 صف لكل دورة

## التالي

Cloudflare / Sentry / OTP يدوياً · تأكد أن Render يشغّل الـ API مع ScheduleModule (موجود في `app.module`).
