# Hisaby — موجة X: صدق مخازن الورديات + throttles أصناف/حسابات (26 يوليو 2026)

**الفرع:** `main` · بعد موجة W  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة
- **ورديات الكاشير:** فشل تحميل المخازن يظهر خطأ + إعادة بدل إخفاء منتقي المخزن

### 2) أمن تشغيلي (`@Throttle`)
- مطاعم: zones 30 · tables 40 · modifiers 30
- مطاعم: add/update item 120 · remove item 60
- مطاعم: reservations create 30 · waitlist create 40
- مطاعم: recipes upsert 30 · delete 20
- قيود: delete 20
- دليل حسابات: create 30 · update 40 · delete 20
- Auth: logout 30

---

## تحقق سريع

1. `/pos/shifts` مع API متوقف — شريط خطأ للمخازن + إعادة.  
2. إضافة أصناف لطلب صالة بسرعة متكررة يُحدّ بعد الحد.  
3. إنشاء/حذف حساب في دليل الحسابات بسرعة متكررة يُحدّ.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
