# ترقية Hisaby — منصة وتشغيل (يوليو 2026 — دفعة 2)

## منجز في هذه الدفعة

### 1) أكواد الخصم في دفع الاشتراك
- حقل `promoCode` في `POST /payments/subscription/checkout`
- التحقق: `GET /payments/subscription/promo?plan=&billing=&code=`
- يطبّق نسبة الخصم أو أسعار العرض من `PlanOffer`
- واجهة الاشتراك: إدخال رمز + معاينة السعر قبل اختيار البوابة
- يُحفظ الرمز في `billingInvoice.metadataJson`

### 2) GeoIP للزيارات
- الخادم يفضّل `cf-ipcountry` / `x-vercel-ip-country`
- العميل لم يعد يرسل `country: "OM"` افتراضيًا

### 3) Keep-warm لـ Render
- `.github/workflows/keep-warm.yml` ينادي `/api/health` كل 10 دقائق
- اختياري: سرّ `API_HEALTH_URL` إن اختلف عنوان الـ API

### 4) حدود الاشتراك
- فرض الاشتراك النشط عند إنشاء منتج أو جهة اتصال
- فحص حد الفواتير مبكرًا في بيع الكاشير

### 5) إزالة AI التجريبي من الواجهة
- حذف ويدجت الدردشة الوهمية
- إزالة رابط `/ai-analytics` من الشريط الجانبي

### 6) موافقات أونلاين للكاشير + باركود كاميرا
- جدول `approval_requests` + API dual-control غير المتزامن
- صفحة `/pos/approvals` ومسح باركود عبر الكاميرا (`@zxing/browser`)

## تشغيل مطلوب على الإنتاج
1. `prisma migrate deploy` (يشمل `20260725160000_approval_requests`)
2. تفعيل workflow Keep warm على GitHub
3. `npm install` في frontend لـ `@zxing/browser`
