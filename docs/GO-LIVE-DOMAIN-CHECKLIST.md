# قائمة تحقق الإطلاق على الدومين — حسابي / BHD Pro

**التاريخ:** 27 يوليو 2026  
**النشر الحالي:** الواجهة → **Vercel** · الـ API → **Render** · القاعدة → **Neon**  
**روابط معروفة:**
- واجهة: `https://www.hisaby.pro` (أو `https://bhd-pro.vercel.app`)
- API: `https://hisaby-api.onrender.com`
- صحة API: `https://hisaby-api.onrender.com/api/health`
- جاهزية: `https://hisaby-api.onrender.com/api/health/ready`

طبّق البنود بالترتيب. ضع ✅ بعد كل بند.

---

## 0) قبل البدء (دقيقتان)

- [ ] تأكد أن آخر نشر Production على Vercel حالته **Ready** من فرع `main`.
- [ ] تأكد أن خدمة Render `hisaby-api` **Live** بعد آخر push.
- [ ] افتح نافذة خاصة (Incognito) للاختبار حتى لا تختلط الجلسات.

توليد أسرار قوية (من جهازك أو PowerShell):

```bash
openssl rand -base64 48
```

كرّر الأمر 3 مرات: `JWT_SECRET` · `JWT_REFRESH_SECRET` · `PAYMENT_SECRETS_KEY` (يجب أن تختلف).

---

## 1) Neon (قاعدة البيانات)

1. [ ] افتح مشروع Neon → **Connection details**.
2. [ ] انسخ **pooled** URL إلى `DATABASE_URL` على Render (يحتوي غالباً `-pooler`).
3. [ ] إن وُجد حقل `DIRECT_URL` على Render، ضع رابط **غير pooled** (بدون `-pooler`) للـ migrations.
4. [ ] لا تفتح منافذ Postgres للعامة؛ Neon يكفي عبر الـ URL فقط.

---

## 2) Render — متغيرات الـ API (إلزامي)

Dashboard → خدمتك → **Environment** → احفظ ثم **Manual Deploy** إن لزم.

| المتغير | قيمة مقترحة / ملاحظة |
|---------|----------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | رابط Neon pooled |
| `DIRECT_URL` | رابط Neon غير pooled (إن طُلب) |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | سر آخر مختلف |
| `PAYMENT_SECRETS_KEY` | سر ثالث ≥32 حرفاً |
| `CORS_ORIGIN` | `https://hisaby.pro,https://www.hisaby.pro,https://bhd-pro.vercel.app` |
| `FRONTEND_URL` | `https://www.hisaby.pro` |
| `API_PUBLIC_URL` | `https://hisaby-api.onrender.com` |
| `PLATFORM_ADMIN_EMAILS` | بريدك التشغيلي فقط (مثال `admin@hisaby.pro`) |
| `REQUIRE_2FA_ROLES` | `ADMIN,MANAGER` (أو اترك الافتراضي) |
| `COOKIE_SAME_SITE` | `none` إذا الواجهة والدومين مختلفان عن الـ API عبر كوكيز عبر المواقع؛ غالباً مع rewrite على Vercel يكفي `lax` — جرّب `lax` أولاً |

### Migrations (مهم جداً — بعد موجات الدعوات + المستودع الذكي BC)

1. [ ] Render → خدمتك → **Shell**.
2. [ ] نفّذ:

```bash
cd /opt/render/project/src/backend   # أو مجلد الـ backend حسب هيكل الخدمة
npx prisma migrate deploy
```

3. [ ] تأكد أن الـ migration التالي طُبّق (Wave BC):  
   `20260727133000_user_home_warehouse_pos_fulfillment`  
   (أعمدة: `users.default_warehouse_id` · `invoices.pos_warehouse_id` · `invoices.pos_fulfillment_status`)
4. [ ] إن فشل المسار، من جذر المشروع حيث يوجد `schema.prisma`:

```bash
npx prisma migrate deploy
```

5. [ ] بعد النجاح: من الواجهة → **المستخدمون** عيّن «مستودع الموظف» لكل كاشير (ولكاشير المطاعم اجعله = مخزن المطعم).
6. [ ] أعد تشغيل الخدمة إن طلب Render ذلك.

### تحقق فوري

- [ ] افتح: `https://hisaby-api.onrender.com/api/health` → `"status":"ok"`
- [ ] افتح: `https://hisaby-api.onrender.com/api/health/ready` → `"status":"ready"` و`"database":"ok"`

---

## 3) Vercel — متغيرات الواجهة (إلزامي)

Project `bhd-pro` → **Settings → Environment Variables** (Production):

| المتغير | قيمة مقترحة |
|---------|-------------|
| `BACKEND_URL` | `https://hisaby-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://www.hisaby.pro` |
| `NEXT_PUBLIC_API_URL` | `/backend-api` (مفضّل مع الـ rewrite) |

اختياري لاحقاً:
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (مع `GOOGLE_CLIENT_ID` على Render)

بعد حفظ المتغيرات:

1. [ ] **Deployments → Redeploy** لآخر نشر Production (أو push فارغ على `main`).
2. [ ] انتظر **Ready**.
3. [ ] Domains: `hisaby.pro` و`www.hisaby.pro` يجب أن يشيرا إلى المشروع (DNS عند Hostinger/Cloudflare).

---

## 4) DNS والدومين

- [ ] `www` → CNAME إلى Vercel (أو حسب ما تعرضه Vercel Domains).
- [ ] الجذر `hisaby.pro` → حسب توصية Vercel (A / ALIAS) — أزل سجلات A قديمة متعارضة.
- [ ] اختبر من الجوال وشبكة أخرى: `https://www.hisaby.pro` و`https://hisaby.pro` يفتحان بدون timeout.

إن انقطع `www` أحياناً بينما `bhd-pro.vercel.app` يعمل: المشكلة DNS وليست الكود.

---

## 5) Cloudflare (مستحسن بقوة قبل فتح التسجيل العام)

1. [ ] أضف النطاق إلى Cloudflare؛ غيّر Nameservers عند المسجّل.
2. [ ] Proxy برتقالي على سجلات الواجهة (وAPI إن كان تحت نطاقك).
3. [ ] **Security → WAF**: Managed Rules.
4. [ ] **Bot Fight Mode** (أو Super Bot Fight).
5. [ ] Rate limiting تقريبي على مسارات الدخول:
   - `/login` و`/api/auth/login`
   - `/register` و`/api/auth/register`
6. [ ] SSL/TLS: **Full (strict)** إذا الشهادة عند Vercel/Render صحيحة.

تفاصيل إضافية: [`PRODUCTION-HARDENING.md`](./PRODUCTION-HARDENING.md).

---

## 6) مستحسن خلال أسبوع (ليس مانع إطلاق بيتا)

### Sentry
- [ ] مشروع Node → `SENTRY_DSN` على Render.
- [ ] مشروع Browser → `NEXT_PUBLIC_SENTRY_DSN` على Vercel.
- [ ] تحقق: `/api/health` → `"sentry": true`.

### Redis (إن فعّلت أكثر من instance لاحقاً)
- [ ] Upstash أو Render Redis → `REDIS_URL` على Render.
- [ ] `/api/health/ready` → `"redis":"ok"`.

### مرفقات S3 / R2
- [ ] `ATTACHMENT_STORAGE=s3` + `S3_BUCKET` + المفاتيح على Render.
- [ ] `/api/health` → `"attachmentStorage":"s3","s3Configured":true`.

### إيميل / واتساب
- [ ] `RESEND_API_KEY` + `EMAIL_FROM=Hisaby <noreply@hisaby.pro>`
- [ ] أو SMTP.
- [ ] واتساب: `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` عند الجاهزية.
- [ ] اختبر **دعوة مستخدم** من الإعدادات (موجة AY) وتصل رسالة الإكمال.

### بوابات دفع
- [ ] ابدأ بوضع الاختبار (Thawani UAT / Stripe test).
- [ ] أضف webhook secrets قبل الإنتاج الحقيقي.

---

## 7) اختبار دخان على الدومين الحي (15 دقيقة)

من نافذة خاصة على `https://www.hisaby.pro`:

| # | السيناريو | ✅ |
|---|-----------|----|
| 1 | الصفحة الرئيسية تفتح | |
| 2 | تسجيل دخول مالك/مدير | |
| 3 | لوحة `/dashboard` تظهر بدون وميض أخطاء | |
| 4 | إنشاء فاتورة مسودة أو عميل | |
| 5 | فتح `/pos` وإتمام بيع تجريبي صغير | |
| 6 | فتح `/resto` (إن الباقة تسمح) | |
| 7 | دعوة مستخدم بالإيميل (إن الإيميل مضبوط) أو إنشاء مستخدم | |
| 8 | `/admin` يعمل لبريد المنصة فقط | |
| 9 | تسجيل خروج ثم دخول من جديد | |
| 10 | من الجوال: القائمة الجانبية/السفلية تعمل | |

فشل شائع سريع:

| العرض | السبب الأرجح | العلاج |
|-------|--------------|--------|
| Login 500 / CORS | `CORS_ORIGIN` ناقص | أضف نطاق الواجهة على Render |
| جاهزية حمراء | DB أو Redis أو S3 misconfigured | راجع `/health/ready` |
| Cold start بطيء | Render free ينام | انتظر 30–60ث أو خطة مدفوعة |
| دعوة مستخدم تفشل | لا إيميل / لا migration | Resend + `migrate deploy` |
| `www` timeout | DNS | راجع سجل A/CNAME؛ جرّب `bhd-pro.vercel.app` |

---

## 8) ما لا تفعله على الإنتاج

- لا تستخدم قيم `.env.example` كما هي.
- لا تشغّل `prisma:seed` على بيانات حقيقية.
- لا تضع Swagger مفتوحاً (`NODE_ENV=production` يعطّله أصلاً).
- لا تفتح Postgres/Redis للعامة.
- لا ترفع أسراراً إلى Git.

---

## 9) بعد الإطلاق — صيانة خفيفة

- [ ] راقب GitHub Actions **CI** على كل push لـ `main`.
- [ ] Dependabot شهري minor/patch فقط؛ لا تدمج majors بدون خطة.
- [ ] إن عاد ضجيج Dependabot: Actions → **Close Dependabot noise** → Run.
- [ ] نسخ احتياطي Neon مفعّل.
- [ ] قبل فتح التسجيل العام للجميع: اختبار اختراق مختصر على auth / dual-control / webhooks.

---

## ملخص أولوية اليوم

```text
1) أسرار Render + CORS/FRONTEND_URL
2) prisma migrate deploy
3) متغيرات Vercel + Redeploy
4) DNS يعمل على hisaby.pro / www
5) اختبار دخان الجدول أعلاه
6) Cloudflare WAF (نفس اليوم إن أمكن)
7) Sentry / إيميل / S3 خلال الأسبوع
```

الكود على `main` جاهز للبيتا؛ هذه القائمة هي ما يحوّل النشر إلى موقع دومين موثوق.
