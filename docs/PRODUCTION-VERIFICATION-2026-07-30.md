# Production verification — 30 Jul 2026

## Release state

| Component | Expected commit | Observed state |
|---|---|---|
| GitHub `main` | `1053acd` | Pushed; CI passed |
| Vercel / `hisaby.pro` | `1053acd` | Production deployment completed |
| Render / `hisaby-api` | `1053acd` | **Not deployed**; still reports `0384917` |
| Database migrations | release migrations | Cannot verify until Render deploys and reports the new commit |

The frontend production promotion is complete. The backend production promotion is not
complete: after more than 14 minutes and two pushes to `main`, Render continued serving the
old commit. This indicates that Render auto-deploy is disabled, disconnected, or failing
before traffic cutover. No Render API key or deploy hook is available to this agent.

## Validation completed

- GitHub CI on the production merge:
  - backend build, tests, and production dependency audit passed
  - frontend type-check, browser smoke, and production dependency audit passed
- Vercel production status: successful.
- Backend local validation:
  - 7 suites and 31 tests passed
  - Nest production build passed
  - production npm audit: zero vulnerabilities
- Frontend local validation:
  - TypeScript passed
  - Next.js production build passed for 98 routes
  - Playwright smoke passed
  - production npm audit: zero vulnerabilities
- Public production route guards returned HTTP 401 in 42–65 ms for dashboard, restaurant
  reports, invoice summaries, product stats, and VAT stats.
- An untrusted `Origin` received no `Access-Control-Allow-Origin` header.

## Performance measurements

Measurements were taken from the cloud agent to production using five HTTP samples and
fresh Chromium pages. They are not a substitute for regional RUM/APM.

| Path | Before | After | Result |
|---|---:|---:|---|
| Landing warm HTTP TTFB | 2.63–2.79 s | 0.09–0.10 s | ~96% lower |
| Landing warm FCP | 2.75–2.81 s | 0.18–0.23 s | ~93% lower |
| Landing first cold FCP | 3.72 s observed | 1.02 s | materially improved |
| Public plans API | 2.31–2.47 s | backend fix not live | pending Render deploy |
| Login/resto/POS/accounting route warm navigation | — | 25–54 ms | healthy document response |
| Login/resto/POS/accounting first navigation | — | 237–478 ms | healthy public entry response |
| API liveness | — | 42–70 ms | healthy |
| API readiness, warm | — | 185–190 ms | old backend; Redis skipped |

The landing delay was caused by invalidating the plan catalog cache on every request. The
production frontend now statically serves the page with five-minute revalidation and a
bounded backend fetch. The backend cache correction is merged but will only affect the plans
API after Render deploys.

## What could not be honestly verified

Authenticated data-path timing and data freshness for these endpoints were not measured:

- dashboard statistics
- restaurant live board and reports
- POS catalog, current shift, and daily statistics
- accounting invoice summaries, journals, products, and VAT

The environment has no production test account/access token and no Neon connection URL.
Testing with guessed credentials or creating a tenant in production would be unsafe. Use
the committed `scripts/benchmark-production.mjs` with a dedicated read-only test tenant
after the backend deploy:

```bash
BENCHMARK_ACCESS_TOKEN='short-lived-token' \
BENCHMARK_ITERATIONS=5 \
node scripts/benchmark-production.mjs > production-benchmark.json
```

The script keeps the token in memory and tests dashboard, accounting, restaurant, and POS
read endpoints. Do not commit the generated output or token.

## Required Render completion

1. In Render, open `hisaby-api`.
2. Confirm the deploy branch is `main`.
3. Configure or verify:
   - `PLATFORM_ADMIN_EMAILS`
   - `PLATFORM_OWNER_EMAIL`
   - `ALLOW_PUBLIC_REGISTRATION=false`
   - `CORS_ORIGIN`, `FRONTEND_URL`, and `API_PUBLIC_URL`
   - `TRUST_PROXY_HOPS=1`
   - `DATABASE_URL` and `DIRECT_URL`
   - `REDIS_URL`
   - `ATTACHMENT_STORAGE=s3` and S3 credentials
   - `SENTRY_DSN`
4. Trigger **Manual Deploy → Deploy latest commit** for `1053acd`.
5. Confirm startup runs `prisma migrate deploy` and does not run `db push`.
6. Verify:

```bash
curl -fsS https://hisaby-api.onrender.com/api/health
curl -fsS https://hisaby-api.onrender.com/api/health/ready
```

The health response must report commit `1053acd` (or a later approved commit). The new
health response is intentionally minimal; use Render environment and Sentry/Redis/S3
dashboards for integration status.

## Post-deploy acceptance targets

Run the authenticated benchmark twice (cold then warm). Investigate when warm p95 exceeds:

| Area | Endpoint target |
|---|---:|
| Dashboard | 700 ms |
| Restaurant live board | 700 ms |
| Restaurant 7-day report | 1,200 ms |
| Invoice summary list | 700 ms |
| Journal list | 700 ms |
| Product/VAT stats | 700 ms |
| POS catalog | 1,000 ms |
| POS shift/today stats | 700 ms |

Also verify freshness behavior in two simultaneous sessions:

1. create/send a kitchen item and confirm SSE updates KDS without waiting for fallback polling;
2. close a restaurant order and confirm live-board totals update within its polling interval;
3. complete a POS sale and confirm stock and accounting totals update after query invalidation;
4. edit an invoice and confirm summary then detail views show the new values;
5. switch pages repeatedly and confirm no duplicate request waterfall in the browser network panel.

## Rollback

- Vercel: redeploy `d7b5a74` if the landing hotfix regresses.
- Render: retain the old healthy instance until `1053acd` passes readiness and authenticated
  smoke tests.
- Never use `prisma db push --accept-data-loss`.
- If a migration fails, stop the deploy, inspect the migration error, and restore from the
  verified snapshot only when data changes require it.
