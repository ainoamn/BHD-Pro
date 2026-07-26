# Hisaby — موجة Y: صدق مستلم البقشيش + throttles قائمة/جهات/منتجات (26 يوليو 2026)

**الفرع:** `main` · بعد موجة X  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة — كاشير
- فشل تحميل قائمة مستلمي البقشيش (`getUsers`) يظهر خطأ + إعادة مع الإبقاء على المستخدم الحالي كاحتياطي

### 2) أمن تشغيلي (`@Throttle`)
- مطاعم: تحديث طلب 60 · محطات 20 · أقسام تعيين/تحرير 40
- مطاعم قائمة: station/allergens/dietary/day-parts/prices — 40 لكلٍّ
- جهات اتصال: create/put 40 · delete 20
- منتجات: create/put 40 · delete 20
- مخازن: create 20 · update 30 · delete 15
- موظفون: create 30 · update 40 · delete 20
- فروع: create 20 · update 30 · delete 15

---

## تحقق سريع

1. أوقف API وافتح كاشير مع بقشيش — رسالة فشل مستلمين + إعادة.  
2. تعديل محطة منتج / حساسية في القائمة بسرعة متكررة يُحدّ.  
3. إنشاء منتج أو جهة اتصال بسرعة متكررة يُحدّ.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
