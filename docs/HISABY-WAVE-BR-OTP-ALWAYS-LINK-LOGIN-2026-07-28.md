# موجة BR — OTP واتساب + ربط دائم عند الدخول

**التاريخ:** 28 يوليو 2026

## الهدف

1. ضمان ربط أنظمة المحاسبة / الكاشير / المطاعم عند كل جلسة دخول (بدون انتظار فتح شاشة الربط).
2. إرسال OTP للموافقات عبر قالب Meta اختياري (`WHATSAPP_OTP_TEMPLATE`) بدل الاعتماد على نص حر خارج نافذة 24 ساعة.
3. صدق حالة التكامل في `/messaging/status` و `/api/health`.

## التغييرات

| ملف | ماذا |
|-----|------|
| `backend/src/auth/auth.service.ts` | `ensureCompanyAppsLinked` عند `issueSession` (لا يُفشل الدخول) |
| `backend/src/notifications/whatsapp-notify.service.ts` | `otpTemplateName` + `sendOtp` يفضّل القالب ثم النص |
| `backend/src/dual-control/dual-control.service.ts` | يستخدم `sendOtp` |
| `backend/src/notifications/messaging.controller.ts` | `otpTemplate` + `apps.alwaysLinked` في status/readme |
| `backend/src/health.controller.ts` | `whatsappOtpTemplate` + `appsAlwaysLinked` |
| `frontend/.../integrations/page.tsx` | عرض قالب OTP وملاحظة الربط الدائم |
| `.env.example` + أدلة messaging | توثيق المتغيرات |

## تشغيل عندك (Render)

```bash
# بعد موافقة Meta على قالب OTP بمتغير {{1}}:
WHATSAPP_OTP_TEMPLATE=hisaby_otp
WHATSAPP_OTP_TEMPLATE_LANG=en
```

تحقق: `GET /api/health` → `whatsappOtpTemplate` و `appsAlwaysLinked: true`.

## التالي المقترح

- تفعيل Sentry DSN + Cloudflare WAF (يدوي).
- إخفاء وحدات عبر الباقات بوضوح أكبر في واجهة الاشتراك (خطة لاحقاً).
