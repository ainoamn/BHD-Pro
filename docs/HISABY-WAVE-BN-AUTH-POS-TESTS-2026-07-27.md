# موجة BN — توسيع اختبارات Auth/POS + smoke

**التاريخ:** 27 يوليو 2026

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| 2FA policy | استخراج `two-factor-policy.ts` (pure) + `two-factor-policy.spec.ts` |
| مستودع POS | استخراج `warehouse-role.ts` + `warehouse-role.spec.ts` |
| Auth | `auth.service` يستدعي سياسة 2FA المستخرجة |
| POS | `pos.service` يفوّض تبديل المستودع للمساعد المختبر |
| Playwright | smoke لـ `/register` و `/complete-profile` بدون دعوة |
| بناء | `nest build` + Jest للملفات الجديدة أخضر |

## ماذا تفعل أنت

لا إجراء نشر إضافي لهذه الموجة. تابع المرحلة 1 من [`PRODUCTION-ROADMAP-4-6-WEEKS.md`](./PRODUCTION-ROADMAP-4-6-WEEKS.md) (Cloudflare / أسرار / Sentry).

## الخطوة التالية المقترحة

Staging workflow · مهلة 2FA إن طُلبت · كاش Redis للمنتجات.
