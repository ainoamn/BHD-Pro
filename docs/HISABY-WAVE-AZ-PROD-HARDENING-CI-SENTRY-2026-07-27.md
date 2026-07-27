# موجة AZ — CI / Sentry / Dependabot / hardening إنتاج

**التاريخ:** 27 يوليو 2026

## الملخص

استجابة لتحليل الجاهزية للإنتاج (بيتا → إنتاج):

| البند | الحالة |
|-------|--------|
| GitHub Actions CI | `.github/workflows/ci.yml` — build backend + typecheck frontend + audit |
| Dependabot | `.github/dependabot.yml` — npm أسبوعي + GitHub Actions |
| Sentry | اختياري عبر `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (بدون DSN = no-op) |
| اختبارات دخان | `backend/test/module-permissions.spec.ts` |
| توثيق WAF | [`PRODUCTION-HARDENING.md`](./PRODUCTION-HARDENING.md) |

## تفعيل Sentry

1. أنشئ مشروعين في Sentry (Node + Browser).
2. ضع `SENTRY_DSN` على Render.
3. ضع `NEXT_PUBLIC_SENTRY_DSN` على Vercel.
4. تحقق من `/api/health` → `"sentry": true`.

## WAF

لا يُشحن داخل الكود. ضع Cloudflare (أو مكافئ) أمام النطاق العام وفعّل Bot Fight / WAF managed rules — التفاصيل في `PRODUCTION-HARDENING.md`.
