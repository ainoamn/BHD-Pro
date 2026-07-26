# Hisaby — موجة AG: التزامات/جرد/تسليم/مجدولة + صدق بنوك تحصيل (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AF  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صلاحيات (ADMIN|MANAGER|ACCOUNTANT)
- التزامات دورية: create/update/pause/resume/delete + **run-due** (ترحيل GL)
- جرد مخزون: create/lines/complete/cancel/delete
- إشعارات تسليم: create/deliver/cancel/delete
- فواتير مجدولة: CRUD + process-due + generate + toggle-active

### 2) صدق واجهة بنوك
- مطالبات موظفين: شريط خطأ + إعادة عند فشل قائمة البنوك
- نافذة تحصيل فاتورة: نفس الصدق فوق اختيار الحساب البنكي

---

## ملاحظة إغلاق موجات الصلاحيات/الصدق
هذه الموجة تُغلق تقريباً مسار hardening للأدوار وصدق الأخطاء التشغيلية.  
**المتبقي منتجياً:** WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS

---

## تحقق سريع

1. CASHIER → 403 على `POST /commitments/run-due` و `POST /stock-counts/:id/complete`.  
2. فشل API البنوك أثناء تحصيل فاتورة يظهر تنبيه لا قائمة فارغة صامتة.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
