# موجة BW — smoke جاهزية API (liveness + ready)

**التاريخ:** 28 يوليو 2026

## الهدف

لا يكتفي فحص الإنتاج/التسخين بـ `/api/health` (liveness). يجب أيضاً `/api/health/ready` حتى تفشل المهمة إذا Neon أو Redis أو إعداد S3 معطوب.

## التغييرات

| ملف | ماذا |
|-----|------|
| `scripts/api-ready-smoke.sh` | يفحص health ثم ready ويؤكد `status=ready` و`database=ok` |
| `.github/workflows/keep-warm.yml` | يستخدم السكربت كل 10 دقائق |
| `.github/workflows/staging-smoke.yml` | خطوة API جاهزية قبل Playwright + إدخال `api_health_url` |

## تشغيل محلي

```bash
chmod +x scripts/api-ready-smoke.sh
./scripts/api-ready-smoke.sh
# أو:
./scripts/api-ready-smoke.sh https://hisaby-api.onrender.com/api/health
```

## تشغيل يدوي على GitHub

Actions → **Staging smoke** → أدخل `base_url` للواجهة (واختياريًا `api_health_url`).

## التالي

فهارس Prisma مركّبة للوحة التحكم · Cloudflare/Sentry يدوياً · أرشفة docs.
