# موجة CU — ربط إرسال فاتورة الخادم من الواجهة + عدم خفض PAID

**التاريخ:** 28 يوليو 2026

## الهدف

Wave CN جعل `POST /invoices/:id/send` يرسل بريداً صادقاً، لكن الواجهة لم تستدعه — نافذة «إرسال» كانت تفتح بريد/واتساب الجهاز فقط. كذلك `send()` كان يفرض الحالة SENT حتى على الفواتير المدفوعة فيخفض PAID.

## التغييرات

| ملف | ماذا |
|-----|------|
| `invoices.service.ts` | رفض الملغاة · لا تغيّر حالة PAID · رسائل أوضح |
| `send-document-modal.tsx` | زر «إرسال من حسابي (خادم)» → `api.sendInvoice` + toast `emailSent`/`emailMock`/`emailSkipped` |
| `accounting-module.tsx` | `onServerSent` يحدّث قائمة الفواتير |
| `ar.json` / `en.json` | نصوص الزر ونتائج الخادم |

## سلوك

- جهاز: واتساب/بريد محلي (كما كان)
- خادم: mock → toast 🧪 · skipped → تحذير · live → نجاح · يوسم المسودة SENT دون لمس PAID

## التالي

Cloudflare / Sentry / قالب OTP · أرشفة docs.
