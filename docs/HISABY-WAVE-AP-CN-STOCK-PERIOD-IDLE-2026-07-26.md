# Hisaby — موجة AP: عكس SC-OPEN/تحويل مخزون + إلغاء إشعار دائن + حماية (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AO  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) رصيد متجر افتتاحي (`SC-OPEN`)
- `reverseLastStoreCredit` يشمل `SC-OPEN:{contactId}`
- `reverseStoreCreditFunding` يقبل `SC-OPEN:`
- حذف اليومية يرفض `SC-OPEN:` ويوجّه للعكس عبر جهات الاتصال

### 2) إلغاء إشعار دائن (استرداد POS)
- عند `CANCELLED`: عكس حركات مخزون IN المرتبطة + خصم محفظة `[STORE_CREDIT]`
- استرداد POS يحدّث `reference` حركة المخزون إلى رقم إشعار الدائن لربط الإلغاء
- Idempotent عبر `{cnNumber}-CANCEL`

### 3) عكس تحويل مخزون
- مرجع تلقائي `XFER:{productId}:{ts}`
- `POST /products/:id/transfer/reverse-last` + dual `STOCK_TRANSFER`
- واجهة المخزون: زر «عكس آخر تحويل»

### 4) حماية حذف / Dual
- أصل بتكلفة/قيمة → تعطيل بدل حذف (مع رفض إن وُجد إهلاك)
- سعر صرف مستخدم في `FX-REV:YYYY-MM-DD` → رفض الحذف
- `PERIOD_UNLOCK` + موافقة مزدوجة على فتح الفترة (واجهة DualApproval)
- `POST /pos/idle-unlock` يفرض `POS_IDLE_UNLOCK` قبل فتح قفل الخمول

### 5) صدق واجهة
- محاسبة: حذف/حالة/تحويل عرض → `apiErrorMessage`
- مشتريات: 5 mutations → `apiErrorMessage`

---

## تحقق سريع

1. عميل برصيد افتتاحي → reverse-last → `REV-SC`.  
2. استرداد POS → إلغاء CN → مخزون ومحفظة يعودان.  
3. تحويل مستودع → reverse-last → الكميات تعود.  
4. فتح فترة مقفلة → modal موافقة.  
5. قفل خمول POS → unlock يمر عبر API.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
