# Hisaby — موجة Z: صدق وردية الشِل + throttles فواتير/ERP (26 يوليو 2026)

**الفرع:** `main` · بعد موجة Y  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة — كاشير
- `pos-shell`: فشل قراءة الوردية الحالية لا يصفّر حالة «مفتوحة» (لا يوحي بأن الصندوق مغلق)

### 2) أمن تشغيلي (`@Throttle`)
- فواتير: create/update 40 · delete 20
- حسابات بنكية: create 20 · update 30 · delete 15
- أصول: create 20 · update 30 · delete 15
- رواتب: create/delete 15
- مراكز تكلفة: seed 5 · create 30 · update 40 · delete 20
- مشاريع: create 30 · update 40 · delete 20

---

## تحقق سريع

1. افتح كاشير بوردية مفتوحة ثم عطّل API وأعد تحميل الشِل — مؤشر الوردية لا ينقلب فجأة إلى مغلق.  
2. إنشاء فاتورة / حساب بنكي / مشروع بسرعة متكررة يُحدّ بعد الحد.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
