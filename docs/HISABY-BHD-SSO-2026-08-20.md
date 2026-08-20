# حسابي — تثبيت دخول BHD الموحّد (20 أغسطس 2026)

**المرجع:** [`BHD-UNIFIED-LOGIN-AND-APPS.md`](./BHD-UNIFIED-LOGIN-AND-APPS.md) §0.7 و§4 و§4.9 · [`BHD-PRODUCT-SSO-ADMIN.md`](./BHD-PRODUCT-SSO-ADMIN.md)  
**Issuer:** `https://id.bhd-om.com` · **client_id:** `bhd-hisaby`

---

## ماذا طُبّق

| عنصر | التفاصيل |
|------|----------|
| عمود | `users.bhd_sub` (unique) — هجرة `20260820120000_bhd_identity_sub` |
| Nest | `GET /api/auth/bhd/start` · `callback` · `logout` · `GET /api/auth/admin-entry` |
| ربط مستخدم | `bhd_sub` ثم بريد موثّق مع الإبقاء على الدور؛ لا إنشاء شركة من الهوية |
| واجهة | مسارات Next `app/api/auth/bhd/*` و`admin-entry` تبروكسي Nest وتعيد `Set-Cookie` على منشأ الواجهة (لا تعتمد على rewrite وحده) |
| `/login` | غلاف → SSO؛ `?local=1` طوارئ فقط؛ `/admin` → `admin-entry` |
| `/register` | تحويل إلى `id.bhd-om.com/login` |
| بعد الدخول | `returnTo=/` من البوابة → `/dashboard` |
| جلسة | refresh/session 48 ساعة · كوكي `bhd_access` / `bhd_refresh` Host-only |

---

## أسرار Render / Vercel

```env
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-hisaby
BHD_OAUTH_CLIENT_SECRET=
# اختياري إن كان Host يمر عبر البروكسي:
# BHD_OAUTH_REDIRECT_URI=https://hisaby.bhd-om.com/api/auth/bhd/callback
FRONTEND_URL=https://hisaby.bhd-om.com
CORS_ORIGIN=https://hisaby.bhd-om.com,https://bhd-pro.vercel.app,https://www.hisaby.pro
JWT_REFRESH_EXPIRATION=48h
```

على الهوية: سجّل `redirect_uri` لكل منشأ مستخدم (hisaby.bhd-om.com، bhd-pro.vercel.app، localhost:3000).

---

## تحقق قبل قلب `mode=sso` في ONE-BHD

1. `curl -sI "https://<origin>/api/auth/bhd/start?returnTo=/"` → **302** إلى `id.bhd-om.com/oauth/authorize` + `Set-Cookie: bhd_oauth_state`
2. دخول هوية → callback → **`Set-Cookie: bhd_access`/`bhd_refresh` على نطاق الواجهة** → **`/dashboard`** (حتى لو `returnTo=/`) لمستخدم موجود بنفس البريد + `bhd_sub` مملوء
3. أدمن قديم بنفس البريد يبقى `ADMIN` / منصة
4. مستخدم هوية بلا صف حسابي → `?bhd=no_user` (دعوة مطلوبة)
5. `/api/auth/admin-entry` → SSO → `/admin`
6. بعد الدخول: `/backend-api/auth/me` يعيد 200 مع الكوكي (جلسة فعّالة)

ثم في ONE-BHD: `app/lib/bhd/apps.ts` عنصر حسابي `mode: "sso"`.

---

## نشر

1. `npx prisma migrate deploy` على API  
2. Deploy Render API + Vercel Frontend  
3. ضبط env أعلاه  
4. إبلاغ ONE-BHD لقلب الكتالوج

---

## عطل شائع (20 أغسطس 2026)

**العَرَض:** بعد دخول الهوية تُعاد إلى الصفحة الرئيسية ولا تبقى جلسة (لوحة التحكم تطلب دخولاً من جديد).

**السبب:** الاعتماد على `rewrites` في `next.config` نحو Render يسقط أو يُخطئ نطاق `Set-Cookie`؛ وجلسة الدخول المحلي كانت تعمل لأن التوكن يُحفظ في الذاكرة من JSON، بينما SSO يعتمد على الكوكي فقط. كما أن البوابة ترسل `returnTo=/`.

**الإصلاح:** مسارات App Router تبروكسي Nest وتعيد الكوكيز على منشأ الواجهة؛ و`returnTo=/` يُحوَّل إلى `/dashboard`.

**ملفات:** `frontend/src/lib/bhd-sso-proxy.ts` · `frontend/src/app/api/auth/bhd/*` · `frontend/src/app/api/auth/admin-entry/route.ts`
