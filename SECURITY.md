# Security policy

## Production security checklist (BHD Pro)

### Status

The codebase is hardened for a controlled production launch. Deployment must still fail closed unless the required secrets, HTTPS origins, platform owner, database migrations, Redis, S3, and monitoring settings are configured.

### Required before production

1. Set `NODE_ENV=production`.
2. Generate independent `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PAYMENT_SECRETS_KEY`, and `TOTP_SECRETS_KEY` values with `openssl rand -base64 48`.
3. Set `CORS_ORIGIN` and `FRONTEND_URL` to explicit HTTPS origins.
4. Set `PLATFORM_ADMIN_EMAILS` and one `PLATFORM_OWNER_EMAIL`; production has no hardcoded fallback administrators.
5. Configure payment webhook secrets; webhooks fail closed without them.
6. Terminate TLS at a reverse proxy and never publish Postgres/Redis ports.
7. Do not run `prisma:seed` in production. Apply migrations with `prisma migrate deploy`, never destructive `db push`.
8. Keep `ALLOW_PUBLIC_REGISTRATION=false` until onboarding is approved.
9. Configure private S3 attachment storage, Redis authentication, monitoring, backups, and tested restore.

### Hardened controls

| Area | Control |
|---|---|
| Registration/subscription | New tenants start on STARTER; paid upgrades use checkout only |
| Sessions | httpOnly cookies, hashed refresh sessions, rotation, revocation and CSRF token |
| Authorization | JWT re-check, central roles/modules, tenant-header boundary and scoped API keys |
| Secrets | Production fail-closed; AES-GCM v2, purpose separation, AAD, versions and rotation ring |
| Payments | Signed/bound webhooks, fixed gateway origins, atomic claim and unique idempotency key |
| Browser | XSS-safe printing, CSP, HSTS, frame/content/referrer/permissions policies |
| Attachments | size + MIME magic validation, active SVG denied, private encrypted S3 |
| Operations | non-root containers, one-shot migration job, authenticated Redis, CI regressions/audits |

### Earlier hardening retained

- Production has no wildcard Vercel CORS unless explicitly enabled.
- Swagger is disabled in production; auth and sensitive operations are rate-limited.
- `REQUIRE_2FA_ROLES`, grace policy, hard lock, Sentry, Redis health/cache, S3 removal, Dependabot and Playwright smoke remain supported.
- The SPA calls `/backend-api/*` so browser cookies remain same-site. A separate API domain requires HTTPS, `COOKIE_SAME_SITE=none`, and credentialed requests.
- Tokens may be returned for non-browser clients; the SPA does not persist them in localStorage.
- See [production hardening](./docs/PRODUCTION-HARDENING.md), [deployment](./docs/SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md), and [threat model](./docs/THREAT-MODEL.md).

### Historical hardening detail (preserved)

| Wave/date | Controls delivered |
|---|---|
| 25 Jul 2026 | Explicit CORS opt-in for Vercel previews, environment-only platform admins, 2MB attachment/MIME policy, POS camera permissions |
| Wave H — 26 Jul 2026 | Required-role 2FA policy, throttled setup/confirm/disable, dashboard enforcement UX, baseline CSP, dashboard error handling |
| Wave AZ — 27 Jul 2026 | GitHub Actions CI, Dependabot, optional Sentry, module-permission smoke tests and production-hardening docs |
| Wave BA/BB | Redis throttle/health/cache, private object storage support, and Playwright login smoke |

### Remaining external controls

- Put WAF/bot protection in front of login and public mutation routes.
- Run an independently authorized penetration test before opening public registration.
- Complete malware scanning/CDR for office attachments and independent compliance evidence where the market requires it.

## الإبلاغ المسؤول

لا تختبر بيانات أو حسابات لا تملكها، ولا تنشر تفاصيل قابلة للاستغلال قبل المعالجة. أرسل بلاغاً خاصاً إلى قناة الأمان المعتمدة لدى شركة بن حمود للتطوير متضمناً: المسار المتأثر، خطوات إعادة الإنتاج، الأثر المتوقع، ووسيلة تواصل آمنة. لا تضع أسراراً حقيقية في البلاغ.

## Supported versions

يدعم الفريق آخر إصدار إنتاجي فقط. تُعطى الأولوية للثغرات التي تؤثر في المصادقة، عزل الشركات، المدفوعات، أو كشف البيانات. لا تمثل الاستجابة أو هذه الوثيقة ادعاء شهادة PCI DSS أو SOC 2 أو ISO 27001.

## قواعد المطورين

- يمنع إدخال أسرار حقيقية في Git أو الاختبارات أو لقطات الخطأ.
- يجب أن يمر كل تغيير أمني باختبار regression ومراجعة مستقلة قبل الإنتاج.
- لا تُشغّل هجرات Prisma تلقائياً من كل نسخة تطبيق؛ استخدم release/migrate job واحداً.
- يجب تدوير السر فور الاشتباه، ثم إبطال الجلسات والمفاتيح المتأثرة ومراجعة سجل التدقيق المنقح.
