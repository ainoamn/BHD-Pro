# موجة CO — صدق mock لتقارير المدير الدورية

**التاريخ:** 28 يوليو 2026

## الهدف

`dispatchOne` كان يتجاهل نتيجة البريد/واتساب ويحدّث `lastSentAt` دائماً؛ زر «إرسال الآن» يقول «تم التشغيل» دون تمييز mock.

## التغييرات

| ملف | ماذا |
|-----|------|
| `manager-reports.service.ts` | عدّ live/mock لكل قناة · `sendNow` يُرجع الإحصاءات |
| `manager-digests/page.tsx` | toast حسب التسليم · عنوان فرعي أوضح |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
