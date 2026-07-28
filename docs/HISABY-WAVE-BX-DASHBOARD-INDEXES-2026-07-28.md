# موجة BX — فهارس مركّبة للوحة التحكم والكاشير

**التاريخ:** 28 يوليو 2026

## الهدف

تسريع استعلامات Dashboard و`syncCatalog` / `syncStock` على Neon عبر فهارس مركّبة، بعد كاش Redis (BU/BV).

## الفهارس

| جدول | فهرس | يخدم |
|------|------|------|
| `invoices` | `(company_id, type, date)` | مبيعات/مشتريات الشهر والتدفق |
| `invoices` | `(company_id, status, payment_status)` | تحصيل معلّق + إصلاح PAID |
| `invoices` | `(company_id, created_at)` | آخر الفواتير |
| `invoices` | `(company_id, type, is_cash, created_at)` | مبيعات/إلغاءات POS اليوم |
| `payments` | `(date)` | مدفوعات اليوم |
| `products` | `(company_id, is_active)` | كتالوج POS + عدّ المنتجات |
| `products` | `(company_id, updated_at)` | `syncStock?since=` |
| `contacts` | `(company_id, is_active, type)` | عدّ العملاء |

## النشر

`prisma migrate deploy` عند إقلاع Render (موجود في Dockerfile). الفهارس `IF NOT EXISTS` آمنة لإعادة التشغيل.

## التالي

Cloudflare/Sentry يدوياً · أرشفة docs.
