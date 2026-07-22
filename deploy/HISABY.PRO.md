# ربط hisaby.pro

## ماذا تحتاج قبل البدء؟

1. سيرفر (VPS) بعنوان IP ثابت  
2. وصول DNS لمسجل الدومين `hisaby.pro`  
3. هذا المشروع على السيرفر (Git clone أو رفع الملفات)

---

## أ) إعداد DNS عند مسجّل الدومين

في لوحة DNS لـ **hisaby.pro** أضف:

| النوع | الاسم | القيمة | TTL |
|------|--------|--------|-----|
| **A** | `@` | `IP_السيرفر` | 300 أو Auto |
| **A** | `www` | `IP_السيرفر` | 300 أو Auto |

انتظر انتشار DNS (غالباً دقائق إلى ساعة). تحقق:

```bash
nslookup hisaby.pro
```

---

## ب) على السيرفر (موصى به)

```bash
# 1) ثبّت Docker + Nginx + Certbot (Ubuntu مثال)
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# 2) انسخ المشروع
cd /opt
git clone <YOUR_REPO_URL> hisaby
cd hisaby

# 3) ملف البيئة
cp .env.production.example .env.production
nano .env.production
# عبّئ: POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, PAYMENT_SECRETS_KEY, PLATFORM_ADMIN_EMAILS
# وتأكد:
#   CORS_ORIGIN=https://hisaby.pro
#   FRONTEND_URL=https://hisaby.pro
#   API_PUBLIC_URL=https://hisaby.pro

# 4) شغّل التطبيق (يعرّض 3000 و 3001 داخلياً — أو عدّل compose لنشر المنافذ)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# إن لم تستخدم Nginx داخل Docker، انشر المنافذ مؤقتاً في compose:
#   frontend ports: "3000:3000"
#   backend  ports: "3001:3001"
```

### Nginx + SSL

```bash
sudo cp deploy/nginx-hisaby.pro.conf /etc/nginx/sites-available/hisaby.pro
sudo ln -sf /etc/nginx/sites-available/hisaby.pro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# شهادة HTTPS
sudo certbot --nginx -d hisaby.pro -d www.hisaby.pro
```

بعدها افتح: **https://hisaby.pro**

---

## ج) متغيرات يجب أن تطابق الدومين

```env
NODE_ENV=production
CORS_ORIGIN=https://hisaby.pro
FRONTEND_URL=https://hisaby.pro
API_PUBLIC_URL=https://hisaby.pro
NEXT_PUBLIC_API_URL=/backend-api
```

هذه القيم تجعل:
- تسجيل الدخول والكوكيز تعمل
- روابط مشاركة الفواتير والـ QR تفتح على `hisaby.pro`
- بوابات الدفع ترجع لنطاقك

---

## د) Webhooks الدفع (لاحقاً)

بعد التفعيل:

- Thawani: `https://hisaby.pro/api/payments/webhooks/thawani`
- Stripe: `https://hisaby.pro/api/payments/webhooks/stripe`
- PayPal: `https://hisaby.pro/api/payments/webhooks/paypal`

---

## هـ) تحقق سريع بعد الربط

1. `https://hisaby.pro` يفتح الواجهة  
2. تسجيل الدخول يعمل  
3. إنشاء فاتورة وعرضها  
4. مسح QR من الهاتف يفتح المستند على الدومين  
5. لا يظهر `localhost` في أي رابط مشاركة  

---

## ملاحظة

ملفات جاهزة في المشروع:

- `.env.production.example`
- `docker-compose.prod.yml`
- `deploy/nginx-hisaby.pro.conf`

إذا أرسلت **IP السيرفر** ونوع الاستضافة (VPS / Cloudflare)، أضبط لك الأوامر حرفياً على بيئتك.
