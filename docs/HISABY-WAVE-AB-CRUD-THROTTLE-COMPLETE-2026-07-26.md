# Hisaby — موجة AB: إكمال throttles CRUD + صدق تذييل الإيصال (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AA  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق واجهة
- **كاشير `/pos`:** فشل تحميل إعدادات الحوافز/تذييل الإيصال يظهر toast بدل صمت تام

### 2) أمن تشغيلي (`@Throttle`) — بقايا CRUD كانت بلا حد
مسح آلي لكل `@Post|Put|Patch|Delete` في controllers → **0 بلا throttle** بعد هذه الموجة.

| الوحدة | الحدود (طلب/دقيقة) |
|--------|---------------------|
| مفاتيح API | update 30 |
| التزامات | create 30 · update 40 · delete 20 |
| إشعارات تسليم | create 30 · delete 20 |
| مطالبات موظفين | delete 20 |
| أوامر شراء | create 30 · update 40 · delete 20 |
| فواتير مجدولة | create 30 · update 40 · delete 20 |
| كاشير مسودات معلّقة | patch 60 |
| إعدادات مطاعم (day-part) | put config 30 |
| جرد مخزون | create 20 · update lines 40 · delete 20 |

---

## تحقق سريع

1. أوقف API وافتح `/pos` — toast «تعذر التحميل» عند فشل إعدادات الحوافز.  
2. إنشاء/تعديل/حذف أمر شراء أو التزام أو جرد بسرعة متكررة يُحدّ (429).

---

## ملاحظة تغطية
تغطية `@Throttle` على مسارات التغيير في Nest controllers اكتملت لهذه الجولة. المتبقي خارج النطاق: WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
