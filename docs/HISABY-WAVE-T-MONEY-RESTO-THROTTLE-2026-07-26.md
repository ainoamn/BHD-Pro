# Hisaby — موجة T: throttles مالية/مطاعم/مشتريات + صدق عدّاد أوفلاين (26 يوليو 2026)

**الفرع:** `main` · بعد موجة S  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة — كاشير
- عدّاد طابور الأوفلاين: عند فشل قراءة IndexedDB يُحتفظ بالعدّاد السابق بدل تصفيره (لا يوحي بأن الطابور فارغ)

### 2) أمن تشغيلي (`@Throttle`)
- مطالبات موظفين: `POST :id/pay` — 20/دقيقة
- التزامات دورية: `POST run-due` — 10/دقيقة
- فواتير مجدولة: `POST process-due` — 10/دقيقة · `POST :id/generate` — 20/دقيقة
- أوامر شراء: `PATCH :id/status` — 30/دقيقة · `POST :id/convert` — 20/دقيقة
- فواتير: share-link / verify-link — 30/دقيقة · unsend — 30/دقيقة · convert-to-invoice — 20/دقيقة
- مطاعم: transfer / merge / split — 30/دقيقة لكلٍّ
- POS: terminal-tap confirm-mock — 30/دقيقة

---

## تحقق سريع

1. افتح كاشير مع طابور أوفلاين غير فارغ ثم عطّل IndexedDB مؤقتاً — العدّاد لا ينزل فجأة إلى صفر.  
2. تشغيل run-due / process-due / pay claim بسرعة متكررة يُحدّ بعد الحد.  
3. نقل/دمج/تقسيم طاولات بسرعة متكررة يُحدّ.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS  
مرشّح موجة تالية: kitchen status/rush throttles · resto loyalty attach · delivery cancel/stock-count cancel
