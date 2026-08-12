# نشر التقوية على Render — إكمال go-live (12 أغسطس 2026)

**GitHub `main`:** `209d2cb`+ (تقوية) · الحي سابقاً: `0384917`  
**الهدف:** نشر التقوية **بدون إسقاط** الخدمة الحالية (`dataurl` + بدون `TOTP_SECRETS_KEY`).

---

## 0) ماذا تغيّر لتسهيل النشر؟

| قبل | بعد (انتقال) |
|-----|----------------|
| إقلاع يفشل بلا `TOTP_SECRETS_KEY` | إقلاع مسموح مع تحذير؛ التشفير يرجع لمفتاح الدفع |
| إقلاع يفشل مع `ATTACHMENT_STORAGE=dataurl` | إقلاع مسموح مع تحذير حتى تفعّل S3 أو `ALLOW_INSECURE_DATAURL_STORAGE` |
| Docker بلا migrate عند start | سكربت `npm run start:prod:migrate` لنسخة Render الواحدة |

عند اكتمال الأسرار وS3: ضع `HARDENING_STRICT_BOOT=true`.

---

## 1) قبل Manual Deploy (دقيقتان على Render)

Environment على **`hisaby-api`** — أضف/راجع:

```env
# مستحسن صراحةً (الوضع الحي الحالي)
ALLOW_INSECURE_DATAURL_STORAGE=true
ATTACHMENT_STORAGE=dataurl

# لا تفعّل الصرامة قبل تجهيز TOTP + S3
# HARDENING_STRICT_BOOT=true

# CORS يشمل الواجهة الحية
CORS_ORIGIN=https://bhd-pro.vercel.app,https://www.hisaby.pro,https://hisaby.pro
FRONTEND_URL=https://bhd-pro.vercel.app
API_PUBLIC_URL=https://hisaby-api.onrender.com
```

**توليد TOTP جديد (مستحسن فوراً بعد أول Deploy ناجح):**

```powershell
# من أي جهاز فيه OpenSSL / Git Bash:
openssl rand -base64 48
```

ضع الناتج في `TOTP_SECRETS_KEY` (يجب أن يختلف عن `PAYMENT_SECRETS_KEY`) و`TOTP_SECRETS_KEY_ID=totp-2026-08`.

**Start Command المقترح لنسخة واحدة على Render Free:**

```bash
npm run start:prod:migrate
```

(يشغّل `prisma migrate deploy` ثم `node dist/main`. لنسخ متعددة: migration job منفصل ثم `npm run start:prod`.)

**Build Command** (إن لم يكن مضبوطاً):

```bash
npm ci && npx prisma generate --schema src/prisma/schema.prisma && npm run build
```

---

## 2) Deploy

1. Neon: snapshot / backup قبل الهجرة.  
2. Render → **Manual Deploy** → latest `main`.  
3. انتظر Live.  
4. تحقق:

```bash
curl -s https://hisaby-api.onrender.com/api/health
```

- `commit` ≠ `0384917`  
- `status: ok`  
- المرفقات قد تبقى `dataurl` مؤقتاً  

5. Vercel: تأكد أن الواجهة على أحدث `main` (عادة تلقائي).  
6. Smoke: دخول · كاشير · فاتورة · `/share/...` · نسيت كلمة المرور.

---

## 3) بعد الاستقرار (خلال أسبوع)

1. `TOTP_SECRETS_KEY` مميز + key id.  
2. S3 خاص أو الإبقاء على `ALLOW_INSECURE_DATAURL_STORAGE=true` موثّقاً.  
3. `HARDENING_STRICT_BOOT=true` ثم إعادة تشغيل.  
4. WhatsApp: Permanent token (إغلاق `#200`).  
5. Redis / Sentry عند الإمكان.

---

## 4) Rollback

- Render → redeploy الإصدار السابق المعروف.  
- لا تحذف أعمدة الهجرة على عجل؛ الرجوع بالكود فقط إن بقيت القاعدة متوافقة للأمام.

---

## مراجع

- [`SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md`](./SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md)  
- [`HISABY-SECURITY-HARDENING-APPLIED-2026-08-12.md`](./HISABY-SECURITY-HARDENING-APPLIED-2026-08-12.md)  
- [`HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md`](./HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md)  
- [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)
