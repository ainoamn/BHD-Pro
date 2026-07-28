# موجة CQ — إيقاظ API عند صفحات الدخول (cold start)

**التاريخ:** 28 يوليو 2026

## الهدف

لوحة المنصة فقط كانت تستدعي `/backend-api/health` مبكراً. دخول المحاسبة/الكاشير/المطاعم كان ينتظر أول طلب مصادقة فيصطدم بـ cold start على Render.

## التغييرات

| ملف | ماذا |
|-----|------|
| `lib/wake-api.ts` | دالة مشتركة `wakeApi()` |
| `admin/layout.tsx` | تستخدم المشتركة |
| `login/page.tsx` · `pos/login` · `resto/login` | استدعاء عند التحميل |

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs.
