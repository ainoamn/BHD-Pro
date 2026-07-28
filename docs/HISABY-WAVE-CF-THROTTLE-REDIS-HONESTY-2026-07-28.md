# موجة CF — صدق تخزين throttle (Redis vs memory)

**التاريخ:** 28 يوليو 2026

## الهدف

بطاقة Redis في صفحة الربط (موجة CD) أظهرت كاش POS/اللوحة فقط. مع `REDIS_URL` يصبح throttling موزّعاً عبر `ThrottlerStorageRedisService`؛ بدونه الحدود في ذاكرة كل instance — دون إفصاح للمشغّل.

## التغييرات

| ملف | ماذا |
|-----|------|
| `messaging.controller.ts` | `redis.throttleStorage: redis\|memory` + خطوة readme |
| `health.controller.ts` | `throttleStorage` في liveness و readiness |
| `integrations/page.tsx` | detail `throttle:redis\|memory` |
| `ar.json` / `en.json` | نصوص محدّثة |
| `GO-LIVE-DOMAIN-CHECKLIST.md` | تحقق `throttleStorage` |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
