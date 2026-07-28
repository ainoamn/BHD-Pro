# موجة CD — صدق Redis في صفحة الربط + `/messaging/status`

**التاريخ:** 28 يوليو 2026

## الهدف

حالة كاش Redis (`posCatalogCache` / `dashboardCache` / TTL) كانت ظاهرة فقط في `/api/health`. المشغّل في لوحة الشركة يحتاج رؤية واضحة في صفحة التكاملات مثل قنوات الرسائل (موجة BT).

## التغييرات

| ملف | ماذا |
|-----|------|
| `notifications.module.ts` | استيراد `RedisModule` |
| `messaging.controller.ts` | حقل `redis` في `GET /messaging/status` + قسم readme |
| `integrations/page.tsx` | بطاقة Redis |
| `ar.json` / `en.json` | نصوص البطاقة |

## سلوك

- بدون `REDIS_URL`: البطاقة «غير مضبوط» + تلميح أن العمل طبيعي بدون كاش
- مع Redis: جاهز + TTL كتالوج/لوحة

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
