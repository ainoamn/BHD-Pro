# خارطة إنتاج حسابي — 4–6 أسابيع (مواءمة مع الكود الحالي)

**التاريخ:** 27 يوليو 2026  
**المصدر:** خطة «من بيتا إلى إنتاج»  
**المستودع:** `main` · واجهة Vercel · API Render · Neon

هذا الملف يترجم الخطة إلى: **منجز** · **جاهز بالكود وينتظر تفعيل** · **إجراء يدوي عندك** · **مؤجّل**.

---

## ترتيب العمل الموصى به

| # | ماذا | من | لماذا |
|---|------|-----|--------|
| 1 | **Cloudflare WAF** (المرحلة 1.1) | أنت على لوحة Cloudflare | أعلى أثر أمني؛ لا يُشحن بالكود |
| 2 | **تدوير الأسرار** + تعطيل CORS previews (1.3) | أنت على Render/Vercel | دقائق؛ قائمة في `GO-LIVE-DOMAIN-CHECKLIST.md` |
| 3 | **Sentry DSN** (1.2) | أنت تنشئ المشروعين + تلصق DSN | SDK جاهز (Wave AZ) — `/api/health` → `sentry: true` |
| 4 | **2FA أوسع** (1.4) | Render env + إشعار للمستخدمين | الكود يدعم `REQUIRE_2FA_ROLES` |
| 5 | توسيع CI/اختبارات (المرحلة 2) | الكود + GitHub | CI أساسي موجود؛ التغطية الكاملة أسابيع |
| 6 | Redis/أداء/OTA/GDPR… | حسب الأولوية التجارية | بعد أمن الإطلاق |

**لا تحذف `.env.example` من المستودع** — يبقى قالباً بلا أسرار (ومستثنى من التجاهل عبر `!.env.example`). احذف فقط ملفات `.env` الحقيقية إن وُجدت في التاريخ.

---

## المرحلة 1 — أمن عاجل

| البند | الحالة |
|-------|--------|
| 1.1 Cloudflare WAF | **يدوي** — دليل: [`PRODUCTION-HARDENING.md`](./PRODUCTION-HARDENING.md) + [`GO-LIVE-DOMAIN-CHECKLIST.md`](./GO-LIVE-DOMAIN-CHECKLIST.md) §5 |
| 1.2 Sentry SDK | **جاهز** — `@sentry/node` / `@sentry/browser` · ينتظر DSN |
| 1.2 Session Replay / alerts | **جزئي / يدوي** — بعد تفعيل DSN من لوحة Sentry |
| 1.3 أسرار قوية | **يدوي** على Render |
| 1.3 Swagger إنتاج | **منجز** — لا يُفعّل إن `NODE_ENV=production` |
| 1.3 `CORS_ALLOW_VERCEL_PREVIEWS` | **آمن افتراضياً** — يعمل فقط إن =`1`/`true` |
| 1.4 2FA ADMIN/MANAGER | **منجز** — `REQUIRE_2FA_ROLES` افتراضي |
| 1.4 إضافة ACCOUNTANT + مهلة 7 أيام | **منجز بالكود (Wave BO)** — وسّع `REQUIRE_2FA_ROLES`؛ عيّن `REQUIRE_2FA_GRACE_FROM` عند التوسيع؛ إيميل جماعي يدوي |

---

## المرحلة 2 — CI/CD

| البند | الحالة |
|-------|--------|
| `ci.yml` build/typecheck/audit/smoke | **منجز** (Waves AZ/BA) |
| Dependabot | **منجز** (شهري) |
| Jest تغطية 70% + Playwright كامل | **ناقص** — smoke login موجود؛ التوسع موجات لاحقة |
| deploy-staging / deploy-prod workflows | **جزئي** — النشر push→Vercel/Render؛ `staging-smoke.yml` يفحص ready ثم Playwright (Wave BW) |

---

## المرحلة 3 — أداء

| البند | الحالة |
|-------|--------|
| Redis اختياري throttle/health | **منجز اختيارياً** (Wave BA) — فعّل `REDIS_URL` |
| كاش منتجات/Dashboard كامل | **جزئي** — كتالوج POS (BU) + Dashboard (BV) + إبطال عند الكتابة (BY) |
| Prisma N+1 / indexes | **جزئي** — فهارس مركّبة Dashboard/POS (Wave BX)؛ مراجعة N+1 لاحقاً |

---

## المرحلة 4–5 — امتثال وتشغيل

| البند | الحالة |
|-------|--------|
| OTA/ZATCA live | **خارج الكود** — اعتماد جهة |
| `/health` + `/health/ready` | **منجز** (+ email/whatsapp/sms flags) |
| Neon backups / UptimeRobot | **يدوي** |
| S3 مرفقات | **جاهز اختيارياً** (Wave BB) |

---

## المرحلة 6 — تنظيف docs

| البند | الحالة |
|-------|--------|
| أرشفة `HISABY-WAVE-*` | **مجدول** — لا يُحذف الآن (مرجع تدقيق) |
| README موحّد | تحسين لاحق |

---

## Checklist الإطلاق السريع (صادق)

```
□ Cloudflare WAF + Bot Fight          ← أنت
□ Sentry DSN على Render/Vercel        ← أنت (SDK جاهز)
□ JWT_* و PAYMENT_SECRETS_KEY قوية    ← أنت
□ CORS_ALLOW_VERCEL_PREVIEWS غير 1    ← تأكد على Render
□ REQUIRE_2FA_ROLES مضبوط             ← Render
□ prisma migrate deploy               ← Render Shell
□ CI أخضر على main                    ← موجود
□ Redis (اختياري)                     ← REDIS_URL
□ S3 مرفقات (اختياري)                 ← ATTACHMENT_STORAGE=s3
□ OTA live                            ← لاحقاً
```

---

## الخطوة التالية المقترحة

1. **أنت اليوم:** Cloudflare §1.1 + تدوير أسرار + لصق Sentry DSN.  
2. **الكود (Wave CE — منجز):** صدق قفل 2FA بعد المهلة (soft vs hard) — [`HISABY-WAVE-CE-2FA-HARD-LOCK-HONESTY-2026-07-28.md`](./HISABY-WAVE-CE-2FA-HARD-LOCK-HONESTY-2026-07-28.md).  
3. على Render: `REDIS_URL` اختياري؛ قالب OTP واتساب؛ `REQUIRE_2FA_HARD_AFTER_GRACE=1` عند الرغبة بقفل التعديلات.  
4. لاحقاً: أرشفة docs.
