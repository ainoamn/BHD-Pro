# Production security checklist (BHD Pro)

## Status

After the hardening commit, the app is **closer to production-ready** for a controlled SaaS launch, but you must still configure secrets and HTTPS correctly before going live.

## Required before production

1. Set `NODE_ENV=production`
2. Generate secrets (never use `.env.example` values):
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` / `PAYMENT_SECRETS_KEY` via `openssl rand -base64 48`
3. Set `CORS_ORIGIN` and `FRONTEND_URL` to your **HTTPS** frontend origin
4. Set `PLATFORM_ADMIN_EMAILS` to the operator email(s) that may manage platform payment gateways
5. Configure payment webhook secrets (Stripe / Thawani / PayPal) — webhooks fail closed without them
6. Terminate TLS at a reverse proxy (Nginx / Caddy / Cloudflare) — do not expose Nest/Next on plain HTTP
7. Do not publish Postgres/Redis ports publicly; use private network + strong DB password
8. Do not run `prisma:seed` against production (demo admin credentials)

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
| Registration | Always STARTER; stronger password policy |
| API keys | ADMIN only; API keys cannot create more keys |
| Cookies httpOnly | Access + refresh in `bhd_access` / `bhd_refresh`; not stored in localStorage |
| Next.js | Security headers + `poweredByHeader: false` + `/backend-api` rewrite for cookie auth |
| Docker | Bind DB/Redis to `127.0.0.1` |

## Remaining (recommended next)

- Full 2FA for admins
- WAF / bot protection in front of login
- Dependency audit (`npm audit`) and lock Next.js to patched releases

## Cookie auth notes

- Browser sessions use **httpOnly** cookies (`bhd_access`, `bhd_refresh`).
- Frontend calls `/backend-api/*` (Next rewrite → Nest) so cookies are same-site.
- For a separate API domain, set `COOKIE_SAME_SITE=none`, HTTPS, and `NEXT_PUBLIC_API_URL` to the API origin with `credentials: true`.
- Tokens may still be returned in JSON for non-browser clients; the SPA does **not** persist them.