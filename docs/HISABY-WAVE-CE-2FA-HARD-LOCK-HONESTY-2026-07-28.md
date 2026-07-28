# موجة CE — صدق قفل 2FA بعد المهلة (soft vs hard)

**التاريخ:** 28 يوليو 2026

## الهدف

بانر الإعدادات كان يقول «التعديلات موقوفة» بعد انتهاء مهلة 2FA، بينما الـ API لا يمنع التعديلات إلا عند `REQUIRE_2FA_HARD_AFTER_GRACE=1` (الافتراضي off منذ موجة BO). هذا يضلّل المشغّل.

## التغييرات

| ملف | ماذا |
|-----|------|
| `auth.service.ts` | `hardAfterGrace` في `/auth/2fa/status` · `twoFactorHardAfterGrace` في الجلسة و`/auth/me` |
| `require-2fa-banner.tsx` | نص soft vs hard · لون وردي فقط عند القفل الصارم |
| `two-factor-settings.tsx` | تلميح بعد المهلة حسب الوضع |
| `ar.json` / `en.json` | `hardLockHint` / `softPastGraceHint` |
| `GO-LIVE-DOMAIN-CHECKLIST.md` | HARD اختياري + صدق الواجهة |

## سلوك

- soft (افتراضي): بانر تحذيري بعد المهلة — التعديلات مسموحة
- hard (`REQUIRE_2FA_HARD_AFTER_GRACE=1`): بانر أحمر + اعتراض API كما كان

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · أرشفة docs · (اختياري) صدق throttle Redis في بطاقة الربط.
