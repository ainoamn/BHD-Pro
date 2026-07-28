# موجة CC — إبطال كاش اللوحة عند طفرات المخزون + صدق Redis في الإطلاق/smoke

**التاريخ:** 28 يوليو 2026

## الهدف

1. كاش Dashboard يخزّن `lowStockCount` / `productCount`؛ طفرات المخزون (منتجات/جرد/تسليم) كانت تبطل كتالوج POS فقط — فتبقى مؤشرات النواقص قديمة حتى TTL.
2. قائمة الإطلاق و`api-ready-smoke` لم تعكس TTL ولا حقل `redis` في الجاهزية بشكل صريح.

## التغييرات

| ملف | ماذا |
|-----|------|
| `products.service.ts` | `bumpPosCatalog` يبطل أيضاً `invalidateDashboardStats` |
| `stock-counts.service.ts` | نفس الشيء |
| `delivery-notes.service.ts` | نفس الشيء |
| `scripts/api-ready-smoke.sh` | يفرض `"redis":"ok"` أو `"skipped"` |
| `GO-LIVE-DOMAIN-CHECKLIST.md` | TTL + تحقق health/ready |
| `PRODUCTION-HARDENING.md` | صف Redis محدّث حتى موجة CC |

## سلوك

بدون Redis: لا أثر. مع Redis: جرد/تعديل/تسليم يفرّغ كاش اللوحة فوراً مثل مسار البيع في POS.

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs القديمة.
