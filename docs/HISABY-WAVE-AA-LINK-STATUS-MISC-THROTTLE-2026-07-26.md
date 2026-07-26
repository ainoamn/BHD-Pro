# Hisaby — موجة AA: صدق حالة الربط + throttles مرفقات/ضريبة/قوالب (26 يوليو 2026)

**الفرع:** `main` · بعد موجة Z  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة
- **pos-shell / resto-shell:** فشل تحميل حالة الربط يظهر خطأ + إعادة بدل شريط «غير مربوط» كاذب

### 2) أمن تشغيلي (`@Throttle`) — وحدات كانت بلا حد
- مرفقات: create 40 · delete 30
- تنبيهات إدارة: resolve 40
- معدلات ضريبة: create 20 · update 30 · set-default/delete 15
- حقول مخصصة: create 30 · update 40 · delete 20
- قوالب مستندات: create 20 · update 30 · set-default/delete 15
- أسعار صرف: create 30 · update 40 · delete 20
- التزامات: pause/resume 30
- فواتير مجدولة: toggle-active 30
- مطالبات: create 30 · update 40 · submit 30

---

## تحقق سريع

1. أوقف API وافتح `/pos` أو `/resto` — شريط فشل الربط + إعادة لا «غير مربوط».  
2. رفع مرفق / حل تنبيه إدارة / تعيين ضريبة افتراضية بسرعة متكررة يُحدّ.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
