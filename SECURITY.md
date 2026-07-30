# Production security checklist (BHD Pro)

## Status

The codebase is hardened for a controlled production launch. Deployment must still fail closed unless the required secrets, HTTPS origins, platform owner, database migrations, Redis, S3, and monitoring settings are configured.

## Required before production

1. Set `NODE_ENV=production`
2. Generate secrets (never use `.env.example` values):
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` / `PAYMENT_SECRETS_KEY` via `openssl rand -base64 48`
3. Set `CORS_ORIGIN` and `FRONTEND_URL` to your **HTTPS** frontend origin
4. Set `PLATFORM_ADMIN_EMAILS` and one `PLATFORM_OWNER_EMAIL`; production has no hardcoded fallback administrators
5. Configure payment webhook secrets (Stripe / Thawani / PayPal) — webhooks fail closed without them
6. Terminate TLS at a reverse proxy (Nginx / Caddy / Cloudflare) — do not expose Nest/Next on plain HTTP
7. Do not publish Postgres/Redis ports publicly; use private network + strong DB password
8. Do not run `prisma:seed` against production (the command now fails in production)
9. Keep `ALLOW_PUBLIC_REGISTRATION=false` until public onboarding is explicitly approved
10. Apply migrations with `prisma migrate deploy` only; never use `db push --accept-data-loss`

## What was hardened

| Area | Change |
|------|--------|
| Free plan upgrade | Disabled — paid checkout only |
| JWT secrets | Production boot fails if weak/missing |
| Refresh sessions | Hashed in DB, rotated on refresh, revoked on logout |
| JWT strategy | Re-checks user + company `isActive` |
| Helmet | Security headers on API |
| Rate limit | Global + stricter on auth |
| Swagger | Disabled when `NODE_ENV=production` |
| Webhooks | Stripe skew + Thawani/PayPal signature verification |
| Gateway secrets | AES-256-GCM at rest when `PAYMENT_SECRETS_KEY` set; admin UI masks secrets |
| Platform gateways | Restricted to `PLATFORM_ADMIN_EMAILS` |
| Registration | Disabled by default in production; when enabled it always starts on STARTER |
| API keys | ADMIN only; API keys cannot create more keys |
| Cookies httpOnly | Access + refresh in `bhd_access` / `bhd_refresh`; not stored in localStorage |
| Next.js | Security headers + `poweredByHeader: false` + `/backend-api` rewrite for cookie auth |
| Docker | Node 24, non-root app users, localhost-bound app ports, Redis and health checks |
| Dependencies | Production npm audits are enforced by CI and must report zero advisories |
| Attachments | MIME is required; active SVG is rejected |

## Remaining (recommended next)

- ~~Enforce 2FA for ADMIN/MANAGER~~ — **done (Wave H partial):** `REQUIRE_2FA_ROLES` (default `ADMIN,MANAGER`) + company `require2faForAdmins`; banner + disable blocked; set `REQUIRE_2FA_ROLES=off` to disable env policy
- ~~CI / Dependabot / optional Sentry SDK~~ — **done (Wave AZ):** `.github/workflows/ci.yml`, Dependabot, `@sentry/node` + `@sentry/browser` when DSN set
- WAF / bot protection in front of login (Cloudflare) — see [`docs/PRODUCTION-HARDENING.md`](./docs/PRODUCTION-HARDENING.md)
- ~~Wire Redis (`REDIS_URL`) for throttle storage + health ping~~ — **done (Wave BA):** optional; in-memory throttle when unset
- ~~Object storage (S3) for attachments~~ — **done (Wave BB):** `ATTACHMENT_STORAGE=s3` + delete on remove; falls back to dataurl/local
- Playwright login smoke in CI — **done (Wave BA):** `frontend/e2e/smoke.spec.ts`
- Narrow API-key scopes below full ACCOUNTANT where possible
- External penetration testing before changing `ALLOW_PUBLIC_REGISTRATION=true`

## Hardening — 27 Jul 2026 (Wave AZ)

| Area | Change |
|------|--------|
| CI | GitHub Actions build + typecheck + audit on `main` |
| Dependabot | Weekly npm + Actions updates |
| Sentry | Optional DSN bootstrap (API + browser beacon) |
| Tests | Backend smoke tests for module permissions |
| Docs | `docs/PRODUCTION-HARDENING.md` WAF/Sentry checklist |

## Hardening — 26 Jul 2026 (Wave H partial)

| Area | Change |
|------|--------|
| 2FA policy | Env `REQUIRE_2FA_ROLES` + company `require2faForAdmins` |
| 2FA throttle | setup/confirm/disable limited to 10/min |
| 2FA UX | Dashboard banner + cannot disable when required |
| CSP | Baseline `frame-ancestors` / `base-uri` / `form-action` / `object-src` on Next |
| Query errors | Dashboard/reports no longer infinite-spin on API failure |

## Hardening — 25 Jul 2026

| Area | Change |
|------|--------|
| CORS | No default `*.vercel.app`; opt-in via `CORS_ALLOW_VERCEL_PREVIEWS=1` |
| Platform admins | Production uses only environment-configured owner/operators |
| Attachments | Max ~2MB + mandatory explicit MIME allowlist; SVG is denied |
| Next Permissions-Policy | `camera=(self)` so POS barcode works |

- Browser sessions use **httpOnly** cookies (`bhd_access`, `bhd_refresh`).
- Frontend calls `/backend-api/*` (Next rewrite → Nest) so cookies are same-site.
- For a separate API domain, set `COOKIE_SAME_SITE=none`, HTTPS, and `NEXT_PUBLIC_API_URL` to the API origin with `credentials: true`.
- Tokens may still be returned in JSON for non-browser clients; the SPA does **not** persist them.