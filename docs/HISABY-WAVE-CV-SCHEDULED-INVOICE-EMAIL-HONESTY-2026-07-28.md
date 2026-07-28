# موجة CV — صدق بريد الفواتير المجدولة عند الإصدار

**التاريخ:** 28 يوليو 2026

## الهدف

`generateNow` / cron يستدعيان `invoices.send()` بعد إنشاء الفاتورة، لكن النتيجة تُرمى والواجهة تقول فقط «تم إنشاء فاتورة» — فيبدو أن العميل استلم بريداً حتى في mock أو بدون تهيئة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `scheduled-invoices.service.ts` | إرجاع `emailSent`/`emailMock`/`emailSkipped` · تجميعها في `processDueSchedules` |
| `procurement-page.tsx` | toast صادق عند الإصدار الفردي والجماعي |
| `ar.json` / `en.json` | نصوص `generatedEmailed` / Mock / Skipped · `processDueDoneHonest` |

## سلوك

- إصدار الآن: نجاح حي / 🧪 mock / ⚠️ تخطّي
- إصدار المستحق: إن وُجد mock أو تخطّي يُعرض تفصيل الأعداد

## التالي

Cloudflare / Sentry / OTP يدوياً.
