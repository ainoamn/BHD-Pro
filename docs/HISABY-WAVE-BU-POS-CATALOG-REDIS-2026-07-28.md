# موجة BU — كاش Redis لكتالوج POS

**التاريخ:** 28 يوليو 2026

## الهدف

تسريع `syncCatalog` الكامل عند تعدد الكاشيرات / استجابة Neon الباردة، بدون كسر العمل عندما `REDIS_URL` غير مضبوط.

## السلوك

- مفتاح: `hisaby:pos:catalog:v1:{companyId}:{warehouseId|all}`
- TTL افتراضي 60 ثانية (`POS_CATALOG_CACHE_TTL_SEC`، بين 5–600)
- الاستجابة تتضمن `cached: true|false`
- الإبطال عند: تعديل/إنشاء/حذف منتج، تعديل/تحويل مخزون، حجز مخزون POS (بيع) وإرجاعه
- المزامنة التدريجية `syncStock?since=` **لا تُكاش** (تبقى من قاعدة البيانات)

## الملفات

| ملف | ماذا |
|-----|------|
| `redis/redis.service.ts` | `getJson` / `setJson` / `invalidatePosCatalog` |
| `pos/pos.service.ts` | قراءة/كتابة الكاش في `syncCatalog` |
| `products/products.service.ts` | إبطال عند CRUD/مخزون |
| `/api/health` | `posCatalogCache` + `posCatalogCacheTtlSec` |
| `.env.example` | توثيق المتغيرات |

## تفعيل على Render

```bash
REDIS_URL=redis://...
# اختياري:
POS_CATALOG_CACHE_TTL_SEC=60
```

بدون Redis يبقى السلوك كما كان (لا كاش).

## التالي

أرشفة docs الموجات القديمة · Cloudflare/Sentry يدوياً.
