# BHD Pro — نظام المحاسبة الذكي العماني

**BHD Pro** منصة SaaS للمحاسبة والفوترة موجّهة للشركات في **سلطنة عُمان** ودول الخليج. تدعم العربية والإنجليزية، ضريبة القيمة المضافة 5%، بوابات الدفع الإلكتروني، وإدارة كاملة للإيرادات والمصروفات.

المستودع: [github.com/ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## المحتويات

- [نظرة عامة](#نظرة-عامة)
- [المميزات](#المميزات)
- [البنية التقنية](#البنية-التقنية)
- [هيكل المشروع](#هيكل-المشروع)
- [التشغيل المحلي](#التشغيل-المحلي)
- [متغيرات البيئة](#متغيرات-البيئة)
- [بوابات الدفع](#بوابات-الدفع)
- [واجهات API](#واجهات-api)
- [خطط الاشتراك](#خطط-الاشتراك)
- [الحساب التجريبي](#الحساب-التجريبي)
- [النشر](#النشر)
- [المساهمة](#المساهمة)
- [الترخيص](#الترخيص)

---

## نظرة عامة

BHD Pro يساعد الشركات الصغيرة والمتوسطة على:

- تسجيل **الإيرادات** (فواتير مبيعات) و**المصروفات** (فواتير مشتريات)
- إدارة **دفتر العناوين** (عملاء وموردين) مع أرصدة مستحقة
- **تحصيل المدفوعات** عبر بوابات الدفع (ثواني، Stripe، PayPal) — المال يصل مباشرة لحساب الشركة
- **دفع اشتراك** المنصة عبر بوابات الدفع
- **التقارير المالية**، **القيود اليومية**، **المخزون**، و**الفوترة الإلكترونية**
- **لوحة تحكم** مع إحصائيات اليوم والتدفق النقدي

---

## المميزات

### المحاسبة والفواتير

| الميزة | الوصف |
|--------|--------|
| مركز المحاسبة | تبويبات: نظرة عامة، مبيعات، مشتريات، كل المستندات |
| فواتير المبيعات | إنشاء، تعديل، إرسال، إلغاء، تحصيل |
| فواتير المشتريات | تسجيل المصروفات والموردين |
| إيصال / تحصيل | تسجيل دفعة (نقد، بنك، شيك…) مع إيصال سداد للطباعة |
| تحصيل متعدد | اختيار المنتفع، فواتيره من الأقدم، توزيع تلقائي أو يدوي |
| التراجع والتصحيح | تراجع عن الإرسال، عكس التحصيل (مبيعات ومشتريات) |
| ضريبة VAT | 5% عُمان — أسعار شاملة أو منفصلة من الإعدادات |
| طباعة وإرسال | طباعة PDF، بريد، واتساب |
| فلاتر وبحث | حسب الحالة، السداد، رقم الفاتورة، العميل |

### دفتر العناوين

- عملاء وموردين مع بحث وأرصدة (مدين / دائن)
- رمز الدولة للواتساب
- إضافة سريعة من شاشة الفاتورة

### بوابات الدفع

- **بوابة لكل شركة**: ربط مفاتيح ثواني / Stripe / PayPal في إعدادات الشركة — العميل يدفع والمال يصل **مباشرة** لحساب الشركة
- **بوابات المنصة**: لدفع **اشتراك BHD Pro** (مفاتيح في `.env`)
- صفحة دفع عامة للعميل: `/pay/[invoiceId]`
- Webhooks + Return URL للتأكيد التلقائي

### أخرى

- لوحة تحكم: إيرادات، مصروفات، ربح، آخر الفواتير، إجراءات سريعة
- تقارير: أرباح وخسائر، ميزانية، ميزان مراجعة، تدفق نقدي
- قيود يومية ودليل حسابات
- مخزون ومنتجات
- اشتراكات: Starter / Professional / Enterprise
- مستخدمون بصلاحيات (Admin, Accountant, Viewer, Manager)
- واجهة عربية (RTL) + إنجليزية

### التراجع وتصحيح الأخطاء

| الإجراء | متى يُستخدم | النتيجة |
|---------|-------------|---------|
| **تراجع عن الإرسال** | فاتورة مُرسَلة بدون تحصيل | تعود إلى مسودة — يمكن تعديلها |
| **عكس التحصيل** | تسجيل مبلغ بالخطأ | يُلغى التحصيل وتعود الفاتورة للتعديل |
| **عكس الكل** | عدة دفعات على فاتورة واحدة | إلغاء كل الدفعات دفعة واحدة |

يعمل على **فواتير المبيعات والمشتريات**. بعد عكس التحصيل يمكن **حذف** الفاتورة أو تعديلها.

---

## البنية التقنية

| الطبقة | التقنية |
|--------|---------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State | Zustand, TanStack Query |
| i18n | next-intl (ar / en) |
| Backend | NestJS 10, TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT (access + refresh) |
| Cache | Redis (Docker — جاهز للتوسع) |
| API Docs | Swagger على `/api/docs` |

---

## هيكل المشروع

```
BHD-Pro/
├── backend/                 # NestJS API
│   └── src/
│       ├── auth/            # تسجيل الدخول والتسجيل
│       ├── companies/       # إعدادات الشركة
│       ├── contacts/        # دفتر العناوين
│       ├── invoices/        # فواتير + تحصيل
│       ├── payments/        # بوابات الدفع + checkout + webhooks
│       ├── subscriptions/   # خطط الاشتراك
│       ├── dashboard/       # إحصائيات لوحة التحكم
│       ├── journal/         # القيود اليومية
│       ├── products/        # المخزون
│       ├── reports/         # التقارير المالية
│       ├── vat/             # الفوترة الإلكترونية
│       ├── ai/              # تحليلات AI
│       ├── users/           # إدارة المستخدمين
│       └── prisma/          # Schema + migrations + seed
├── frontend/                # Next.js App
│   └── src/
│       ├── app/             # صفحات (dashboard, accounting, pay, …)
│       ├── components/      # UI + accounting + invoices + payments
│       ├── i18n/            # ar.json, en.json
│       └── lib/             # API client, utils
├── docker-compose.yml       # PostgreSQL + Redis
├── .env.example
└── README.md
```

---

## التشغيل المحلي

### المتطلبات

- Node.js 20+
- Docker Desktop (لـ PostgreSQL)
- npm

### 1) قاعدة البيانات

```bash
docker compose up -d
```

### 2) Backend

```bash
cd backend
cp ../.env.example .env
# عدّل DATABASE_URL و JWT_SECRET في .env

npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run start:dev
```

الـ API: `http://localhost:3001/api`  
Swagger: `http://localhost:3001/api/docs`

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

الواجهة: `http://localhost:3000`

---

## متغيرات البيئة

انسخ `.env.example` إلى `backend/.env`:

| المتغير | الوصف |
|---------|--------|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | سر JWT (32+ حرف في الإنتاج) |
| `CORS_ORIGIN` | `http://localhost:3000` |
| `FRONTEND_URL` | رابط الواجهة للتحويل بعد الدفع |
| `API_PUBLIC_URL` | رابط الـ API العام (webhooks / return URL) |
| `STRIPE_*` / `THAWANI_*` / `PAYPAL_*` | بوابات دفع اشتراك المنصة |

Frontend (اختياري `.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## بوابات الدفع

### تحصيل فواتير عملائك (بوابة شركتك)

1. **إعدادات الشركة** → **بوابات الدفع**
2. اختر ثواني / Stripe / PayPal
3. أدخل المفاتيح من لوحة بوابة الدفع
4. فعّل البوابة
5. شارك رابط الدفع: `https://your-domain.com/pay/[invoice-id]`

### اشتراك BHD Pro (بوابة المنصة)

1. أضف مفاتيح البوابة في `.env` (انظر `.env.example`)
2. **الاشتراك** → اختر خطة → اختر بوابة → ادفع

### Webhooks

```
POST {API_PUBLIC_URL}/api/payments/webhooks/thawani
POST {API_PUBLIC_URL}/api/payments/webhooks/stripe
POST {API_PUBLIC_URL}/api/payments/webhooks/paypal
```

---

## واجهات API (أهم المسارات)

| Method | Path | الوصف |
|--------|------|--------|
| POST | `/auth/login` | تسجيل الدخول |
| POST | `/auth/register` | إنشاء شركة + مستخدم |
| GET | `/dashboard/stats` | إحصائيات لوحة التحكم |
| GET/POST | `/invoices` | فواتير CRUD |
| POST | `/invoices/:id/payments` | تسجيل تحصيل |
| POST | `/invoices/payments/batch` | تحصيل على عدة فواتير (FIFO / يدوي) |
| POST | `/invoices/:id/unsend` | تراجع عن الإرسال |
| DELETE | `/invoices/:id/payments/:paymentId` | عكس دفعة واحدة |
| POST | `/invoices/:id/payments/reverse-all` | عكس كل الدفعات |
| POST | `/invoices/:id/send` | إرسال / تعليم كمُرسَل |
| PATCH | `/invoices/:id/status` | تغيير الحالة (سداد، إلغاء) |
| GET | `/contacts` | دفتر العناوين |
| GET | `/payments/company-gateways` | بوابات الشركة |
| PATCH | `/payments/company-gateways/:slug` | إعداد بوابة الشركة |
| POST | `/payments/subscription/checkout` | checkout اشتراك |
| GET | `/payments/public/invoice/:id` | معلومات دفع عامة |
| POST | `/payments/public/invoice/:id/checkout` | checkout دفع فاتورة |
| GET | `/subscriptions/plans` | خطط الاشتراك |

---

## خطط الاشتراك

| الخطة | شهري (ر.ع) | سنوي (ر.ع) | فواتير/شهر | مستخدمين |
|-------|------------|------------|------------|----------|
| Starter | 5 | 48 | 50 | 2 |
| Professional | 15 | 144 | 500 | 10 |
| Enterprise | 35 | 336 | ∞ | ∞ |

---

## الحساب التجريبي

بعد `npm run prisma:seed`:

| الحقل | القيمة |
|-------|--------|
| البريد | `admin@bhd.om` |
| كلمة المرور | `Admin123!` |

---

## النشر

1. PostgreSQL مُدار (RDS, Supabase, …)
2. Backend: `npm run build` + `npm run start:prod`
3. Frontend: `npm run build` + `npm run start` أو Vercel
4. ضبط `CORS_ORIGIN`, `FRONTEND_URL`, `API_PUBLIC_URL`
5. تفعيل HTTPS لـ webhooks بوابات الدفع

---

## المساهمة

1. Fork المستودع
2. أنشئ فرعاً: `git checkout -b feature/my-feature`
3. Commit + Push + Pull Request

---

## الترخيص

© 2026 BHD Pro — [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro).  
جميع الحقوق محفوظة ما لم يُذكر خلاف ذلك.

---

## الدعم

للاستفسارات والدعم، افتح [Issue](https://github.com/ainoamn/BHD-Pro/issues) على GitHub.
