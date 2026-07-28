# موجة BT — صدق وضع mock للواتساب/البريد/SMS

**التاريخ:** 28 يوليو 2026

## الهدف

عدم إظهار «جاهز / تم الإرسال» عندما القناة في وضع `mock` (تسجيل سجلات فقط بدون وصول للعميل).

## التغييرات

| ملف | ماذا |
|-----|------|
| `whatsapp/email/sms-notify.service.ts` | إرجاع `mock: true` في وضع الاختبار |
| `customer-notify.service.ts` | حالة التسليم `mock` بدل `ok` |
| `messaging.controller.ts` | حقل `live` في `/messaging/status` |
| `integrations/page.tsx` | ثلاث حالات: جاهز / وضع اختبار / غير مضبوط |
| `pos/page.tsx` + `pos-copy.ts` | toast صريح عند mock |
| i18n | `mockMode` / `testMock` / … |

## تحقق

1. `EMAIL_MODE=mock` → التكاملات تظهر «وضع اختبار» وليس أخضر «جاهز».
2. إعادة إرسال واتساب/SMS في mock → toast يوضح عدم الإرسال للعميل.
3. إنتاج حقيقي (`whatsappMode: live`) → بدون تغيير سلوك التسليم الحقيقي.

## التالي

كاش Redis لكتالوج POS (اختياري عند `REDIS_URL`).
