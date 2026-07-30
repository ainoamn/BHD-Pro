# Production release record — 30 Jul 2026

## Scope

This release prepares Hisaby/BHD Pro for a controlled production rollout across:

- NestJS API on Render
- Next.js frontend on Vercel
- PostgreSQL on Neon or the private Docker Compose database
- Redis for distributed throttling and dashboard/POS caches
- S3-compatible attachment storage

## Security changes

- Upgraded the production dependency graphs to versions with zero production npm advisories.
- Upgraded the runtime to Node.js 24 and run both application containers as non-root.
- Removed production hardcoded platform administrators. `PLATFORM_ADMIN_EMAILS` and
  `PLATFORM_OWNER_EMAIL` are now the only bootstrap sources.
- Disabled public password and Google tenant registration by default in production.
- Trust only the configured reverse-proxy hop and derive login/visit IP addresses from
  Express instead of client-submitted fields.
- Reject wildcard, malformed, localhost, and non-HTTPS production CORS origins.
- Reject weak placeholder encryption secrets and require HTTPS public URLs.
- Require an attachment MIME type and deny active SVG uploads.
- Strip authorization, cookies, IP addresses, query strings, and fragments from Sentry events.
- Reduced public health responses so they no longer expose integration configuration.
- Production startup applies Prisma migrations only and never falls back to destructive
  `db push`.
- CI now fails when either production dependency graph has a high or critical advisory.

## Performance changes

- Restaurant live-board closed metrics are aggregated in PostgreSQL with a dedicated index.
- Restaurant reports load only required columns, filter tip/service lines, use a tenant/date
  index, and cache identical summaries for 30 seconds.
- Dashboard monthly cash flow and low-stock counts are calculated in PostgreSQL.
- Accounting invoice lists use summary rows, lazy detail loading, deferred metadata requests,
  and debounced search.
- Journal lists are bounded and journal validation is batched.
- VAT lists are bounded and omit XML/signature payloads; VAT statistics are aggregated in SQL.
- Payment voucher lists are bounded.
- Cash-flow reports and product inventory statistics are aggregated in SQL.
- Admin visit rankings are limited to the latest 30 days.

## Required production environment

Start from `.env.production.example` and replace every placeholder. At minimum configure:

```text
NODE_ENV=production
DATABASE_URL=...
DIRECT_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PAYMENT_SECRETS_KEY=...
PLATFORM_ADMIN_EMAILS=...
PLATFORM_OWNER_EMAIL=...
ALLOW_PUBLIC_REGISTRATION=false
CORS_ORIGIN=https://hisaby.pro,https://www.hisaby.pro
FRONTEND_URL=https://www.hisaby.pro
API_PUBLIC_URL=https://hisaby.pro
TRUST_PROXY_HOPS=1
REDIS_URL=...
ATTACHMENT_STORAGE=s3
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
```

## Deployment gates

Run in this order:

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
npm test -- --runInBand
npm audit --omit=dev --audit-level=high
npx prisma migrate deploy

cd ../frontend
npm ci
npm run type-check
npm run build
npm test -- --runInBand
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Then verify:

1. `/api/health` returns HTTP 200.
2. `/api/health/ready` returns HTTP 200.
3. Password, Google, and 2FA login paths work.
4. Public registration is rejected while its flag is false.
5. Invoice, receipt, report, and QR PDFs render correctly.
6. Restaurant floor, kitchen, live board, and reports load correctly.
7. VAT, payment voucher, journal, and financial report pages load correctly.
8. S3 upload/delete and Sentry test events succeed.
9. Payment gateways are still in test mode until webhook verification is confirmed.

## Rollback

1. Roll back the frontend and API to the previous deployment image/commit.
2. Do not reverse a Prisma migration by `db push` or `--accept-data-loss`.
3. Restore the database from a verified snapshot only when a migration changed stored data.
4. Keep public registration disabled during rollback.
5. Re-run the health and authentication smoke checks before restoring traffic.

## Known external gates

Code cannot create production S3, Redis, Sentry, payment, Render, Vercel, or Neon credentials.
The release must not be promoted until those values are configured in the hosting dashboards
and a database snapshot has been verified.
