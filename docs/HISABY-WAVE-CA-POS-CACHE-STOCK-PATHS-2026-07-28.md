# موجة CA — إبطال كاش كتالوج POS عند جرد/تسليم/إلغاء إشعار دائن

**التاريخ:** 28 يوليو 2026

## الهدف

موجات BU/BZ كاشّت كتالوج POS وأبطلت عند منتجات/تعديل مخزون/بيع POS. بقيت مسارات مخزون أخرى تغيّر الكميات دون إبطال Redis — فيظهر للكاشير كمية قديمة حتى انتهاء TTL.

## التغييرات

| مسار | متى يُبطَل الكاش |
|------|------------------|
| جرد مخزون `complete` / `reverseCompleted` | بعد تطبيق/عكس فروقات الجرد |
| إشعار تسليم `deliver` / إلغاء بعد تسليم | بعد خصم/إرجاع المخزون |
| إلغاء إشعار دائن (فاتورة) | بعد `unwindCreditNoteSideEffects` إن وُجدت حركات مخزون |

## الملفات

- `stock-counts.module.ts` / `stock-counts.service.ts`
- `delivery-notes.module.ts` / `delivery-notes.service.ts`
- `invoices.service.ts` — `bumpPosCatalog` عند إلغاء CREDIT_NOTE

## سلوك

بدون `REDIS_URL`: لا أثر. مع Redis: مزامنة الكتالوج التالية بعد جرد/تسليم تعيد الجلب من Neon.

## التالي

Cloudflare / Sentry / قالب OTP واتساب يدوياً · أرشفة docs القديمة.
