# موجة CT — حفظ وعرض نتيجة إشعار حجوزات المطاعم

**التاريخ:** 28 يوليو 2026

## الهدف

قائمة الانتظار تعرض `notifyResult` (Wave CS)، بينما الحجوزات كانت تعتمد على toast لحظي فقط دون حقول دائمة — بعد إعادة التحميل يختفي أثر mock/فشل، و`reminderSentAt` يظهر فقط عند التسليم الحقيقي دون سياق القناة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `schema.prisma` + migration `20260728210000_…` | `notify_channel` / `notify_result` / `notify_attempts` على `resto_reservations` |
| `resto.service.ts` | حفظ نتيجة كل إشعار · `mapReservation` يعيدها |
| `reservations/page.tsx` | شارة قناة + نتيجة · وسم «تذكير مُسلَّم» عند `reminderSentAt` |
| `resto-copy.ts` | `resReminderSent` |

## سلوك

- كل إشعار (تأكيد/تذكير/طاولة جاهزة) يحدّث القناة والنتيجة حتى في mock/فشل
- CONFIRMED / `reminderSentAt` ما زالا فقط عند تسليم حي (كما Wave CI)
- بعد `prisma migrate deploy` تظهر الشارات في القائمة

## التالي

Cloudflare / Sentry / `REDIS_URL` / قالب OTP واتساب يدوياً.
