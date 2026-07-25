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
| `PLATFORM_ADMIN_EMAILS` | بريدك مثل `admin@hisaby.pro` — **مطلوب** لفتح `/admin` |

## الأمان (الإنتاج)

| المتغير | مطلوب | ملاحظة |
|---------|--------|--------|
| `NODE_ENV=production` | نعم | يفعّل فحوصات الأمان |
| `DATABASE_URL` | نعم | PostgreSQL قوي |
| `JWT_SECRET` | نعم | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | نعم | قيمة مختلفة عن JWT_SECRET |
| `PAYMENT_SECRETS_KEY` | نعم | لتشفير مفاتيح البوابات |

لا تشغّل `prisma:seed` على الإنتاج بعد الإطلاق.

## ترحيل Prisma — حقول POS

بعد سحب كود Hisaby POS، طبّق مخطط قاعدة البيانات على الإنتاج حتى تظهر أعمدة الربط على `companies`:

| عمود Prisma | عمود DB | الغرض |
|-------------|---------|--------|
| `posLinkedAt` | `pos_linked_at` | وقت ربط المحاسبة ↔ الكاشير |
| `posIntegrationKeyHash` | `pos_integration_key_hash` | تجزئة مفتاح الربط التقني |
| `posIntegrationKeyPrefix` | `pos_integration_key_prefix` | بادئة المفتاح للعرض |

```bash
# من مجلد backend (أو داخل حاوية الـ API) — المفضّل على الإنتاج:
npx prisma migrate deploy

# بديل فقط للبيئات التجريبية بدون جدول _prisma_migrations:
# npx prisma db push
```

Migration ذات الصلة: `20260723183000_pos_link_and_product_uniques`  
(تضيف أعمدة `pos_*` وتعيد فهارس SKU/barcode لتكون فريدة لكل شركة).

Migration مخزون المستودعات: `20260723190000_warehouse_stocks`  
(تنشئ `warehouse_stocks` وتملأ الكميات الحالية لكل منتج من `products.quantity`).

Migration السلات المعلّقة متعددة الأجهزة: `20260725140000_pos_drafts`  
(تنشئ جدول `pos_drafts` لمزامنة السلات المعلّقة عبر الأجهزة بدل localStorage).

Migration الحماية المزدوجة (maker-checker): `20260725150000_company_security_config`  
(تضيف عمود `security_config` JSONB على `companies` لإعدادات dual-control: تفعيل عام، تبديل لكل إجراء حساس، وتجزئة PIN المشرف).

Migration طلبات الموافقة الأونلاين: `20260725160000_approval_requests`  
(تنشئ جدول `approval_requests` للموافقة غير المتزامنة من المدير خلال 15 دقيقة — consumable token عبر `APPROVAL_REQUEST`).

Migration دور الكاشير + الورديات + OTP: `20260725170000_cashier_shifts_otp`  
(تضيف `CASHIER` إلى `UserRole`، جدول `pos_shifts`، عمود `invoices.pos_shift_id`، وجدول `dual_control_otps`).

**Dual control:** عند تفعيل الحماية (الافتراضي عند غياب الإعداد)، تتطلب إجراءات مثل إلغاء بيع الكاشير، الاسترداد الجزئي، تجاوز السعر، تعديل/تحويل المخزون، إلغاء فاتورة، وعكس الدفعات موافقة:
- `SELF_CONFIRM` للمدير/ADMIN
- أو `PASSWORD` لمشرف آخر في نفس الشركة
- أو `PIN` إن وُجد
- أو **`APPROVAL_REQUEST`** — طلب أونلاين يوافق عليه المدير من `/pos/approvals` (جلسة المدير هي الموافقة؛ بدون كلمة مرور إضافية)

مرحلة لاحقة: WhatsApp OTP / NFC.

**كاميرا الباركود / PWA:** الواجهة تستخدم `BarcodeDetector` مع احتياطي `@zxing/browser`. الـ PWA يخزّن shell خفيف لـ `/pos` و`/dashboard` مع اختصارات كاشير/محاسبة في `manifest.webmanifest`. يتطلب HTTPS (أو localhost) لإذن الكاميرا.

**Keep-warm (Render Free):** workflow GitHub `.github/workflows/keep-warm.yml` ينادي `/api/health` كل 10 دقائق. يمكن ضبط السرّ `API_HEALTH_URL` إن اختلف عنوان الـ API.

**أكواد الخصم:** عروض `PlanOffer` من لوحة `/admin` تُطبَّق في `POST /payments/subscription/checkout` عبر `promoCode`.

عمليات الجرد أصبحت واعية بالمستودع (`WarehouseStock`) وواجهة التحويل بين المستودعات متاحة عبر `POST /products/:id/transfer` — لا حاجة لـ migration جديدة.

**قبل النشر:** إن وُجدت صفوف مكررة لنفس `(company_id, sku)` أو `(company_id, barcode)` ستفشل الـ migration — أصلح التكرار أولاً.

بدون هذه الأعمدة تفشل واجهات `/pos` وربط المفتاح في إعدادات الشركة.

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
| Hisaby POS (كاشير منفصل + ربط) | جاهز للبيتا — طبّق `migrate deploy` لحقول `pos_*` و`pos_drafts` و`approval_requests` و`cashier_shifts_otp` |
| مخزون لكل مستودع (`warehouse_stocks`) | جاهز — طبّق `20260723190000_warehouse_stocks` |
| سلات معلّقة متعددة الأجهزة (`pos_drafts`) | جاهز — طبّق `20260725140000_pos_drafts` |
| موافقات أونلاين (`approval_requests`) | جاهز — طبّق `20260725160000_approval_requests` |
| دور CASHIER + ورديات Z + استرداد جزئي | جاهز — طبّق `20260725170000_cashier_shifts_otp` |
| كاميرا باركود + اختصارات PWA | جاهز في الواجهة (HTTPS للكاميرا) |
| الفوترة الإلكترونية OTA | غير مكتملة |
| الشات الذكي | ردود ثابتة |

**التوصية:** اربط الدومين وشغّل بيتا، ثم اختبر الدفع على `hisaby.pro`.
