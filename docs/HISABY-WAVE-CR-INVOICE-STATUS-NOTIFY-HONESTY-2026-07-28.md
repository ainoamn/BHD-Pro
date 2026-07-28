# موجة CR — صدق إشعار العميل عند وسم الفاتورة كمُرسلة/مسددة

**التاريخ:** 28 يوليو 2026

## الهدف

محاسبو الواجهة يستخدمون غالباً «وسم كمُرسلة» (`updateStatus` → SENT) وليس `POST /invoices/:id/send`. الـ backend كان يستدعي `notifyPosSale` بدون انتظار ويعيد الفاتورة دون `customerNotify`، فالواجهة لا تعرض mock/فشل/نجاح.

## التغييرات

| ملف | ماذا |
|-----|------|
| `invoices.service.ts` | `await notifyPosSale` عند SENT/PAID (غير POS) · إرجاع `customerNotify` أو `null` |
| `accounting-module.tsx` | `toastCustomerNotify` من نتيجة الحالة |
| `ar.json` / `en.json` | `sentNotifyOk` / `Mock` / `Partial` / `Fail` + توضيح `sentSuccess` |

## سلوك

- بدون جهة اتصال أو بدون قنوات: وسم فقط + `sentSuccess`
- كل القنوات mock: toast mock
- فشل فقط: toast فشل
- مزيج: toast جزئي
- live: toast نجاح الإشعار

## التالي

Wave CS (عرض `notifyResult` في قائمة انتظار المطاعم) · Cloudflare / Sentry يدوياً.
