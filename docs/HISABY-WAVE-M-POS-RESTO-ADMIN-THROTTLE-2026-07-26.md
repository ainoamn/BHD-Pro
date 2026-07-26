# Hisaby — موجة M: POS/مطاعم + throttles منصة (26 يوليو 2026)

**الفرع:** `main` · بعد موجة L  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق أخطاء التحميل
- كاشير: مخزون + جهات اتصال — `isError` + إعادة محاولة
- مطاعم: وصفات + إعدادات — خطأ صادق بدل قائمة فارغة
- `/admin/gateways` — زر إعادة محاولة عبر `adminCopy`

### 2) أمن تشغيلي (`@Throttle`)
- منصة: tenants PATCH · users PATCH/DELETE/reset-password · offers · plans
- حماية مزدوجة: إنشاء طلب موافقة + قرار الموافقة

---

## تحقق سريع

1. أوقف API وافتح `/pos/inventory` أو `/pos/contacts` أو `/resto/recipes` — خطأ + إعادة.  
2. `/admin/gateways` — إعادة محاولة.  
3. قرارات موافقة متكررة أو تعديل مستأجر بسرعة يُحدّ بعد الحد.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
