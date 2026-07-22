# دليل النشر — Hisaby (hisaby.pro)

الدومين المحجوز: **https://hisaby.pro**

راجع الدليل المفصّل: [`deploy/HISABY.PRO.md`](./deploy/HISABY.PRO.md)

## ملخص سريع

1. DNS: سجل **A** لـ `@` و `www` → IP السيرفر  
2. انسخ `.env.production.example` → `.env.production` وعبّئ الأسرار  
3. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`  
4. Nginx من `deploy/nginx-hisaby.pro.conf` + Certbot  
5. افتح `https://hisaby.pro`

## المتغيرات الإلزامية

| المتغير | قيمة hisaby.pro |
|---------|-----------------|
| `CORS_ORIGIN` | `https://hisaby.pro` |
| `FRONTEND_URL` | `https://hisaby.pro` |
| `API_PUBLIC_URL` | `https://hisaby.pro` |
| `PLATFORM_ADMIN_EMAILS` | بريدك مثل `admin@hisaby.pro` |

## الأمان (الإنتاج)

| المتغير | مطلوب | ملاحظة |
|---------|--------|--------|
| `NODE_ENV=production` | نعم | يفعّل فحوصات الأمان |
| `DATABASE_URL` | نعم | PostgreSQL قوي |
| `JWT_SECRET` | نعم | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | نعم | قيمة مختلفة عن JWT_SECRET |
| `PAYMENT_SECRETS_KEY` | نعم | لتشفير مفاتيح البوابات |

لا تشغّل `prisma:seed` على الإنتاج بعد الإطلاق.

## بوابات الدفع

- Webhooks:
  - `https://hisaby.pro/api/payments/webhooks/thawani`
  - `https://hisaby.pro/api/payments/webhooks/stripe`
  - `https://hisaby.pro/api/payments/webhooks/paypal`
- اختبر Test Mode قبل Live.

## ما يزال غير مكتمل للمنتج الكامل

| بند | الحالة |
|-----|--------|
| المحاسبة / الفواتير / الإيصالات | جاهز للبيتا على الدومين |
| الفوترة الإلكترونية OTA | غير مكتملة |
| الشات الذكي | ردود ثابتة |

**التوصية:** اربط الدومين وشغّل بيتا، ثم اختبر الدفع على `hisaby.pro`.
