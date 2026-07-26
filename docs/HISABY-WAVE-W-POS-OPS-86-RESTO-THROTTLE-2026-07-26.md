# Hisaby — موجة W: صدق شريط كاشير/86 + throttles صالة (26 يوليو 2026)

**الفرع:** `main` · بعد موجة V  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة
- **كاشير:** فشل تحميل شريط الوردية/إحصاءات اليوم يظهر خطأ + إعادة (بدل صمت)
- **قائمة مطاعم:** فشل تحميل قائمة 86 يظهر خطأ + إعادة بدل «فارغ»

### 2) أمن تشغيلي (`@Throttle`)
- POS/مطاعم: `link/warehouse` — 20/دقيقة
- مطاعم: floor/seed 5 · demo/seed 3 · demo/purge 3
- مطاعم: guest-tokens 10 · clear-call 60 · open order 60 · external ingest 40
- مطاعم: delivery status 40 · waitlist status 40 · reservation status 40

---

## تحقق سريع

1. أوقف API وافتح `/pos` — شريط العمليات بخطأ+إعادة.  
2. `/resto/menu` مع API متوقف — قسم 86 بخطأ لا «فارغ».  
3. فتح طلبات صالة / تحديث انتظار بسرعة متكررة يُحدّ بعد الحد.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
