# موجة BA — Redis اختياري + Playwright smoke

**التاريخ:** 27 يوليو 2026

## الملخص

استكمال hardening الإنتاج بعد موجة AZ:

| البند | الحالة |
|-------|--------|
| Redis اختياري | `REDIS_URL` → تخزين throttle موزّع + ping في `/health/ready` |
| بدون Redis | throttle في الذاكرة كما كان (آمن للتطوير وRender بدون Redis) |
| Playwright | `frontend/e2e/smoke.spec.ts` — صفحة `/login` تظهر حقل البريد |
| CI | وظيفة `smoke` بعد typecheck الواجهة |

## تفعيل Redis على الإنتاج

1. وفّر Redis خاص (Render Redis / Upstash / Docker).
2. ضع `REDIS_URL=redis://…` على الـ API.
3. تحقق: `GET /api/health/ready` → `"redis": "ok"`.

بدون `REDIS_URL` يبقى `"redis": "skipped"` والخدمة تعمل.

## تشغيل الـ smoke محلياً

```bash
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

ضد staging: `PLAYWRIGHT_BASE_URL=https://app.example.com npm run test:e2e`
