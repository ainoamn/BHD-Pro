# Production data latency — 2026-07-31

## Observed cause

- A cold request to the Render API took about 22 seconds.
- Warm liveness was about 58 ms; warm database readiness was about 346 ms.
- Production has no Redis configured, so dashboard and POS catalog caches are process-local.
- The GitHub keep-warm workflow is configured for five-minute intervals, but observed scheduled runs were separated by roughly one to three hours. It cannot guarantee that a free Render service stays awake.
- The frontend amplified cold and warm latency with duplicate session, subscription, link-status, security, notification, company, and analytics requests.

## Changes in this release

- Share concurrent session restoration instead of issuing multiple `/auth/me` calls.
- Remove the unsafe two-second auth loading override.
- Share subscription, POS/restaurant link status, and company security through TanStack Query.
- Stop POS shell data from refetching on every internal route.
- Initialize the POS warehouse from local storage and stop replaying the full POS bootstrap after warehouse resolution.
- Remove duplicate company and notification requests from Accounting.
- Defer non-critical notification, admin badge, analytics, and tip-staff requests.
- Request summary-only invoice rows for dashboard collection UI.
- Deduplicate concurrent JWT user validation and dashboard computation on the backend.
- Exclude company logo and private configuration blobs from `/auth/me`.
- Wake Render directly, with one in-flight wake request and a five-minute browser TTL.
- Keep the readiness smoke compatible with the hardened minimal health response.

## Verification

- Frontend TypeScript check: passed.
- Frontend production build: passed.
- Playwright smoke: 8/8 passed.
- Backend production build: passed.
- Backend tests: 31/31 passed.
- Live liveness/readiness smoke: passed.

## Required infrastructure action

Code removes request amplification but cannot prevent a free Render instance from sleeping. To remove the remaining first-request delay:

1. Move the Render API to an always-on instance.
2. Configure `REDIS_URL` for shared dashboard, POS catalog, and throttle caching.
3. Confirm Render deploys the current `main` commit; the API observed during this investigation was still serving commit `03849173bc4cbc677e247a54db7252c0b3b48cd6`.
4. Use the Neon pooled connection string with bounded connection parameters in `DATABASE_URL`.
