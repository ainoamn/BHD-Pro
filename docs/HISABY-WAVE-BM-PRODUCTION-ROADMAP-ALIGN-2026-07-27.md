# موجة BM — مواءمة خطة الإنتاج + دليل 2FA

**التاريخ:** 27 يوليو 2026

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| خارطة | [`PRODUCTION-ROADMAP-4-6-WEEKS.md`](./PRODUCTION-ROADMAP-4-6-WEEKS.md) تُطابق خطة 4–6 أسابيع مع حالة الكود |
| 2FA | [`USER-GUIDE-2FA.md`](./USER-GUIDE-2FA.md) + توصية `ACCOUNTANT` في قائمة الإطلاق |
| تصحيح | الإبقاء على `.env.example` كقالب (لا حذفه من المستودع) |

## ماذا تفعل أنت الآن (المرحلة 1)

1. Cloudflare WAF — `GO-LIVE-DOMAIN-CHECKLIST.md` §5  
2. تدوير `JWT_*` / `PAYMENT_SECRETS_KEY` على Render  
3. لصق Sentry DSN (SDK جاهز)  
4. اختياري: `REQUIRE_2FA_ROLES=ADMIN,MANAGER,ACCOUNTANT`
