# موجة CN — صدق إرسال فاتورة المحاسبة بالبريد

**التاريخ:** 28 يوليو 2026

## الهدف

`POST /invoices/:id/send` كان يضع الحالة SENT ويعيد «sent to {email}» دون استدعاء أي مُرسل بريد. الفواتير المجدولة ترث نفس الادعاء.

## التغييرات

| ملف | ماذا |
|-----|------|
| `invoices.service.ts` | حقن `EmailNotifyService` + `DocumentShareService` · إرسال بريد برابط مشاركة · `emailSent` / `emailMock` / رسائل صادقة |
| `ar.json` / `en.json` | `sentSuccess` أوضح |

## سلوك

- بدون بريد على جهة الاتصال: وسم SENT فقط
- بريد غير مضبوط: SENT + `emailSkipped`
- mock: SENT + `emailMock` (لم يُسلَّم)
- live: SENT + `emailSent`

## التالي

Wave CO (تقارير المدير) · Cloudflare / Sentry يدوياً.
