# Production hardening checklist — حسابي / BHD Pro

هذا الملف يجمع متطلبات الإطلاق العام بعد بيتا محدودة.

## قبل الإطلاق العام (Must)

1. **Cloudflare (أو WAF مكافئ) أمام النطاق**
   - Proxy برتقالي على `app.` و`api.` (أو نفس النطاق مع rewrite)
   - Bot Fight Mode / Super Bot Fight
   - WAF Managed Rules + Rate limiting على `/api/auth/login` و`/api/auth/register`
   - Challenge لـ countries/ASNs المشبوهة عند الحاجة
2. **Sentry DSN**
   - Backend: `SENTRY_DSN`
   - Frontend: `NEXT_PUBLIC_SENTRY_DSN`
   - راجع `/api/health` → `sentry: true`
3. **CI أخضر على `main`**
   - Workflow: `.github/workflows/ci.yml`
4. **Dependabot** مفعّل ومراجعة أسبوعية لـ PRs
5. **`NODE_ENV=production`** + أسرار قوية (`JWT_*`, `PAYMENT_SECRETS_KEY`)
6. **2FA** للأدوار الإدارية (`REQUIRE_2FA_ROLES=ADMIN,MANAGER`)
7. **Migrations** مطبّقة: `npx prisma migrate deploy`
8. **Penetration test** مختصر على auth / dual-control / webhooks قبل فتح التسجيل العام

## مستحسن (Should)

| البند | ملاحظة |
|-------|--------|
| Redis | **موجّه (Wave BA):** throttle موزّع + `/health/ready` ping عند وجود `REDIS_URL` |
| Object storage S3 | للمرفقات بدل data URLs |
| Playwright smoke | **موجّه (Wave BA):** `frontend/e2e/smoke.spec.ts` على `/login` في CI |
| مراقبة Uptime | خارج Render free cold-start |

## يمكن تأجيله (Could)

- Capacitor native build
- SoftPOS جهاز طرفي
- Prometheus/Grafana
- Terraform/Pulumi

## ما لا تضعه في الإنتاج

- قيم `.env.example` كما هي
- Swagger (`NODE_ENV=production` يعطّله)
- منافذ Postgres/Redis العامة
- `prisma:seed` على بيانات حقيقية

## مراجع

- [`SECURITY.md`](../SECURITY.md)
- [`HISABY-WAVE-AZ-PROD-HARDENING-CI-SENTRY-2026-07-27.md`](./HISABY-WAVE-AZ-PROD-HARDENING-CI-SENTRY-2026-07-27.md)
