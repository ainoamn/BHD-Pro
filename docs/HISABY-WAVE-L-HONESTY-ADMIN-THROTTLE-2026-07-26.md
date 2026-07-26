# Hisaby — موجة L: صدق أخطاء + إدارة + throttles (26 يوليو 2026)

**الفرع:** `main` · بعد موجة K  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صدق أخطاء التحميل
- دليل الحسابات — `QueryError` بدل شجرة فارغة عند فشل API
- قائمة مطاعم + تقارير مطاعم — خطأ صادق + إعادة محاولة
- تنبيهات الإدارة — `QueryError` (و403 فقط يعرض «ممنوع»)
- موافقات الكاشير — خطأ + زر إعادة محاولة

### 2) لوحة المنصة
- `/admin/billing` — تحميل + خطأ + إعادة محاولة
- `/admin/plans` · `/admin/operators` · `/admin/settings` — نفس النمط
- مفاتيح `loadFailed` / `retry` / `paidAt` / `all` في `admin-copy`
- مستأجرون يستخدمون نصوص `adminCopy` للخطأ/إعادة المحاولة

### 3) أمن تشغيلي (`@Throttle`)
- مشغّلو المنصة: POST / PATCH / DELETE
- `PATCH /admin/settings/:key`
- `POST /vat/ota-config`
- `PUT /companies/me`

---

## تحقق سريع

1. أوقف API وافتح `/chart-of-accounts` أو `/resto/menu` أو `/resto/reports` — خطأ + إعادة.  
2. `/admin/billing` و `/admin/plans` و `/admin/settings` — نفس السلوك.  
3. تعديل إعدادات المنصة أو OTA بسرعة متكررة يُحدّ بعد الحد.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
