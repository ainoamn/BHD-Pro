# موجة DA — لوحة بلاغات العملاء للتاجر

**التاريخ:** 28 يوليو 2026

## الهدف

Wave CY ادّعت أن البلاغ «سيظهر في لوحة البلاغات» بينما لم يكن هناك API أو واجهة للمالك/المدير لعرض `customer_disputes` — البلاغات تُحفظ فقط.

## التغييرات

| ملف | ماذا |
|-----|------|
| `customer-notify.service.ts` | `listDisputes` · `updateDisputeStatus` |
| `disputes.controller.ts` | `GET /disputes` · `PATCH /disputes/:id/status` (ADMIN/MANAGER) |
| `disputes/page.tsx` | قائمة + تصفية حالة + أزرار مراجعة/حل/رفض |
| `sidebar` · `module-permissions` · i18n · `api.ts` | تنقّل وصلاحيات |
| `dispute/[code]/page.tsx` | نص skipped يشير إلى `/disputes` |

## سلوك

- البلاغ العام يُحفظ كما كان
- التاجر يرى البلاغات في `/disputes` ويحدّث الحالة

## التالي

Cloudflare / Sentry / OTP يدوياً.
