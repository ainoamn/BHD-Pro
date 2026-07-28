# موجة DJ — صدق إشعار المبلّغ عند تحديث حالة بلاغ العميل

**التاريخ:** 28 يوليو 2026

## الهدف

تحديث حالة البلاغ من لوحة التاجر كان يحفظ فقط دون إبلاغ المبلّغ، ودون نتيجة صدق للواجهة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | واتساب للمبلّغ عند تغيّر الحالة · `reporterNotify` |
| `disputes/page.tsx` | toast حي/mock/فشل/تخطي |
| `ar.json` / `en.json` | مفاتيح `reporterNotify*` |

## سلوك

- بدون هاتف أو واتساب غير مهيأ: `skipped` + toast صريح
- عند الإرسال: ok / mock / fail كما في موجات الصدق السابقة

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
