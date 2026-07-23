# تقرير جلسة Hisaby / BHD Pro

**الفترة:** 21–23 يوليو 2026  
**المستودع:** https://github.com/ainoamn/BHD-Pro (`main`)  
**آخر تحديث لوحة المنصة:** مسار `/admin` لإدارة الشركات والمستخدمين والاشتراكات والزيارات.

> للعمل من أكثر من جهاز: `git pull origin main` ثم اقرأ هذا الملف.

---

## لوحة تحكم المنصة `/admin`

- الرابط: `/admin` (مثل https://www.hisaby.pro/admin أو https://bhd-pro.vercel.app/admin)
- الدخول: حساب مسجّل بريده موجود في متغير Render: `PLATFORM_ADMIN_EMAILS=you@email.com,admin@bhd.om`
- الأقسام: مؤشرات · شركات · مستخدمون · مدفوعات اشتراك · باقات/عروض · زيارات/IP · بوابات دفع
- تتبع الزيارات: `POST /api/public/visits` + جداول `site_visits` / `plan_offers` / `platform_settings`

---

## الخلاصة

النظام **منشور ويعمل** عبر:

| الطبقة | الخدمة | الرابط |
|--------|--------|--------|
| واجهة | Vercel | https://bhd-pro.vercel.app |
| واجهة (مخصص) | Hostinger → Vercel | https://www.hisaby.pro (**متقطع**) |
| API | Render (Docker) | https://hisaby-api.onrender.com |
| قاعدة بيانات | Neon Postgres | `DATABASE_URL` + `DIRECT_URL` |

العطل المتقطع على `www.hisaby.pro` (`ERR_TIMED_OUT` / `ERR_CONNECTION_ABORTED`) **ليس فشل نشر للكود**؛ سببه مسار شبكة/DNS إلى عناوين Vercel، مع سجل A قديم على النطاق الجذر.

---

## 1) المراحل من البداية للنهاية

1. **فحص أولي** — مشروع Qootk Pro: واجهة Next.js قوية، خلفية ناقصة، أخطاء تشغيل محلي.
2. **إصلاح وتشغيل محلي** — بناء NestJS + Prisma، إصلاح ملفات ناقصة، Docker/Postgres (ومؤقتًا SQLite).
3. **تطوير المنتج** — فواتير، مدفوعات، عملات أجنبية، أمان، 2FA، قوالب مستندات، علامة تجارية Hisaby.
4. **نشر إنتاج** — Render + Neon + Vercel + نطاق `hisaby.pro`.
5. **Google Sign-In** — تسجيل/دخول عبر Google.
6. **QR والطباعة** — رموز قصيرة ثم صفحة HTML على الـ API + إصلاح توقف تحميل الإيصال.
7. **تشخيص الدومين** — توصية تحديث DNS في Hostinger.

---

## 2) البنية والربط

```
[هاتف/متصفح]
    → www.hisaby.pro  (أحيانًا timeout)
    → bhd-pro.vercel.app  (مستقر)
         ↕  /backend-api rewrite
    → hisaby-api.onrender.com  (NestJS)
         ↕
    → Neon PostgreSQL
```

### متغيرات مهمة

**Render**

- `DATABASE_URL` (pooler)
- `DIRECT_URL` (مباشر، بدون pooler)
- `CORS_ORIGIN` يشمل hisaby + www + vercel.app
- `FRONTEND_URL=https://www.hisaby.pro` (قيمة واحدة)
- `API_PUBLIC_URL=https://hisaby-api.onrender.com`
- `GOOGLE_CLIENT_ID` (يجب التأكد من وجوده)
- أسرار JWT

**Vercel / frontend**

- `NEXT_PUBLIC_APP_URL=https://www.hisaby.pro`
- `BACKEND_URL=https://hisaby-api.onrender.com`
- `NEXT_PUBLIC_API_URL=/backend-api`
- `NEXT_PUBLIC_API_PUBLIC_URL=https://hisaby-api.onrender.com`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`

### DNS الحالي (Hostinger)

| النوع | الاسم | القيمة | ملاحظة |
|-------|-------|--------|--------|
| A | `@` | `76.76.21.21` | **قديم** — Vercel توصي بـ `213.188.79.1` |
| CNAME | `www` | `*.vercel-dns-01.com` | Valid في Vercel |

---

## 3) أخطاء ومشاكل تم حلها

| المشكلة | السبب | الحل |
|---------|-------|------|
| فشل بناء Docker/Prisma | مسار schema خاطئ | نسخ من `src/prisma` |
| Prisma على Alpine + Neon | OpenSSL / اتصال | Debian slim + `DIRECT_URL` |
| جداول ناقصة على Neon | migrations غير مكتملة | `prisma db push` عند الإقلاع |
| الواجهة لا تصل للـ API على Vercel | `BACKEND_URL` | افتراضي Render في الإنتاج |
| Login 500 | CORS يرمي Error | السماح لـ `*.vercel.app` |
| إعدادات الشركة تفشل | email فارغ / Google | تخفيف validation + prefill |
| QR يفتح `www` ويفشل على الهاتف | دومين متقطع | QR → `/api/public/documents/c/:code/view` على Render |
| تحميل الإيصال يتوقف | `window.close()` بعد 400ms | إغلاق بعد `afterprint` فقط |
| سير الفاتورة فوق الهيدر | تصميم | شريط مراحل تحت اسم الشركة |

---

## 4) Google Sign-In

- كود: `POST /auth/google` + `@react-oauth/google` في الواجهة.
- Client ID موجود في `frontend/.env.production`.
- **تحقق يدوي:** وجود `GOOGLE_CLIENT_ID` في Render Environment.
- حسابات معروفة من الجلسة:
  - `admin@bhd.om` — كلمة مرور
  - `ameed95655200@gmail.com` / `ah@sfg.om` — Google فقط (بدون كلمة مرور)

---

## 5) ما أُنجز

- نظام محاسبة عربي SME متصل بقاعدة بيانات حقيقية.
- نشر ثلاثي: Vercel + Render + Neon مربوط على GitHub `main`.
- فواتير/إيصالات مع طباعة، علامة تجارية، QR تحقق.
- Google Sign-In.
- تحسينات أمان (cookies، حدود معدل، 2FA للمسؤول).
- عملات أجنبية وإعادة تقييم.
- آخر رفع Git يشمل صفحة HTML عامة للفاتورة من الـ API.

---

## 6) القائمة المحدّثة — ما تبقى الآن

### عاجل

- [ ] Hostinger: غيّر سجل **A** لـ `@` من `76.76.21.21` إلى **`213.188.79.1`**
- [ ] انتظر Deploy لـ `2d2a695` على Render و Vercel
- [ ] أعد طباعة فاتورة وامسح QR من الهاتف (يجب أن يفتح Render وليس www فقط)
- [ ] اختبر تحميل/طباعة الإيصال

### مهم

- [ ] تأكيد `GOOGLE_CLIENT_ID` على Render
- [ ] تدوير أسرار Neon/JWT إن ظهرت في الدردشة
- [ ] قرار: ترقية Render أو keep-warm لتقليل cold start (10–50 ثانية)
- [ ] إن استمر انقطاع www: Cloudflare Proxy أو متابعة مع Vercel/مزود الإنترنت

### لاحقًا

- [ ] اختبار شامل من جهاز ثانٍ (تسجيل، Google، فاتورة، دفع)
- [ ] صقل المنتج (AI الوهمي، حدود اشتراك صارمة)
- [ ] نسخ احتياطي Neon + مراقبة إنتاج

---

## 7) المراحل المتبقية المقترحة

| المرحلة | الهدف | أولوية |
|---------|--------|--------|
| أ — استقرار الوصول | DNS + QR من الهاتف | عاجلة |
| ب — تشغيل يومي | cold start + إيصال/طباعة | عالية |
| ج — أمان إنتاج | تدوير أسرار + مراجعة دفع/API | عالية |
| د — صقل منتج | AI حقيقي / حدود خطط | متوسطة |
| هـ — إطلاق تجاري | نسخ احتياطي + دعم عمان | لاحقة |

---

## 8) روابط سريعة للتحقق

- واجهة مستقرة: https://bhd-pro.vercel.app
- API صحة: https://hisaby-api.onrender.com/api (أو مسار health إن وُجد)
- مثال QR بعد النشر: `https://hisaby-api.onrender.com/api/public/documents/c/{CODE}/view`
- GitHub: https://github.com/ainoamn/BHD-Pro

---

*آخر تحديث: 23 يوليو 2026 — للمزامنة بين الأجهزة عبر Git.*
