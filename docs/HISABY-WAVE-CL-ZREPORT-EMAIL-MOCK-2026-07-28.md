# موجة CL — صدق mock لبريد تقرير Z عند إغلاق الوردية

**التاريخ:** 28 يوليو 2026

## الهدف

إغلاق الوردية كان يعدّ رسائل mock ضمن `zEmail.sent` فيظهر «أُرسل تقرير Z بالبريد» دون تسليم.

## التغييرات

| ملف | ماذا |
|-----|------|
| `pos.service.ts` | `emailZReportBestEffort` يفصل `sent` / `mocked` |
| `pos-shifts-view.tsx` | toast mock منفصل |
| `pos-copy.ts` | `zEmailMock` |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs · (اختياري) تذكيرات الاشتراك mock.
