# موجة BV — كاش Redis لإحصاءات لوحة التحكم

**التاريخ:** 28 يوليو 2026

## الهدف

تخفيف ضغط Neon على `GET /dashboard` (عشرات الاستعلامات + إصلاح legacy عند كل قراءة) عبر كاش Redis قصير العمر عند توفر `REDIS_URL`.

## السلوك

- مفتاح: `hisaby:dashboard:stats:v1:{companyId}`
- TTL افتراضي 30 ثانية (`DASHBOARD_CACHE_TTL_SEC`، بين 5–120)
- الاستجابة تتضمن `cached: true|false`
- إصلاح `stalePaid` يعمل فقط عند **cache miss** (ليس في كل قراءة مكررة)
- بدون Redis: السلوك السابق دون تغيير

## الملفات

| ملف | ماذا |
|-----|------|
| `redis/redis.service.ts` | `dashboardStatsKey` / `dashboardStatsTtlSec` |
| `dashboard/dashboard.service.ts` | لفّ `getStats` بالكاش |
| `dashboard/dashboard.module.ts` | استيراد `RedisModule` |
| `/api/health` | `dashboardCache` + `dashboardCacheTtlSec` |

## تفعيل

```bash
REDIS_URL=redis://...
# اختياري:
DASHBOARD_CACHE_TTL_SEC=30
```

## ملاحظة

لا إبطال كتابي عبر الفواتير/المدفوعات في هذه الموجة — TTL القصير كافٍ لصدق المؤشرات دون سطح إبطال واسع.

## التالي

أرشفة docs · Cloudflare/Sentry يدوياً.
