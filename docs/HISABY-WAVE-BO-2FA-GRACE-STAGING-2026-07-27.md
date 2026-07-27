# موجة BO — مهلة 2FA + staging smoke

**التاريخ:** 27 يوليو 2026

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| مهلة | `REQUIRE_2FA_GRACE_DAYS` (افتراضي 7) + `REQUIRE_2FA_GRACE_FROM` اختياري |
| قفل | بعد المهلة: `Past2faGraceInterceptor` يمنع التعديلات (`REQUIRE_2FA_HARD_AFTER_GRACE`) |
| API | `/auth/me` و `/auth/2fa/status` وجلسة الدخول تعرض `twoFactorPastGrace` / `deadline` / `daysLeft` |
| UX | لافتة 2FA تعرض الأيام المتبقية أو انتهاء المهلة |
| CI | [`staging-smoke.yml`](../.github/workflows/staging-smoke.yml) — `workflow_dispatch` ضد URL |
| اختبارات | توسيع `two-factor-policy.spec.ts` |

## ماذا تفعل أنت على Render

عند توسيع الأدوار:

```
REQUIRE_2FA_ROLES=ADMIN,MANAGER,ACCOUNTANT
REQUIRE_2FA_GRACE_DAYS=7
REQUIRE_2FA_GRACE_FROM=<ISO اليوم>
REQUIRE_2FA_HARD_AFTER_GRACE=1
```

تشغيل smoke ضد الإنتاج/معاينة: GitHub → Actions → **Staging smoke** → أدخل `https://hisaby.pro`.

## الخطوة التالية

كاش Redis للمنتجات · أرشفة docs · Cloudflare/Sentry إن لم يُفعَّلا.
