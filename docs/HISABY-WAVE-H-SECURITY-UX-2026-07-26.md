# Hisaby — موجة H جزئية: أمن وإنتاج وتجربة (26 يوليو 2026)

**الفرع:** `main` · المستودع: [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن في هذه الموجة

### 1) إلزام 2FA (Wave H)
- بيئة: `REQUIRE_2FA_ROLES` — الافتراضي `ADMIN,MANAGER`؛ عطّلها بـ `off` أو `none`
- شركة: `securityConfig.require2faForAdmins` من إعدادات الحماية المزدوجة
- `/auth/me` يعيد `twoFactorEnabled` + `twoFactorRequired`
- لا يمكن إيقاف 2FA عند سريان السياسة
- شريط تنبيه في لوحة التحكم + رابط `/settings#two-factor`
- حد معدّل لـ setup/confirm/disable: 10/دقيقة

### 2) إصلاح دوران لا نهائي عند فشل API
- `QueryError` مع إعادة محاولة
- لوحة التحكم، التقارير، التحليلات، التكاملات، ملخص كتب الكاشير

### 3) Onboarding
- إخفاء القائمة يُحفظ في `localStorage` لكل شركة
- روابط أعمق: `#logo` · `#vat` · `#company`

### 4) صفحة رئيسية
- وصف المطاعم محدّث (KDS/صالة منجزة)
- نص الشعارات الفارغ لم يعد «قريباً»

### 5) CSP أساسي على Next
- `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`

---

## تحقق سريع

1. سجّل دخول كـ ADMIN بدون 2FA → يظهر شريط التنبيه.  
2. فعّل 2FA → يختفي الشريط؛ زر الإيقاف مخفي إن كانت السياسة سارية.  
3. أوقف API مؤقتاً وافتح `/dashboard` → رسالة خطأ + إعادة محاولة (لا دوران أبدي).  
4. أغلق قائمة البدء وحدّث الصفحة → تبقى مخفية.  
5. الصفحة الرئيسية: شهري/سنوي/مقارنة بدون ملاحظة «الأسعار من لوحة الباقات».

---

## ما تبقّى بعد هذه الموجة

| بند | ملاحظة |
|-----|--------|
| WAF / Cloudflare | تشغيلي أمام الدخول |
| Sentry كامل | يحتاج DSN |
| OTA live | اعتماد جهة |
| Capacitor / SoftPOS | لاحقاً |

راجع أيضاً: [`SECURITY.md`](../SECURITY.md) · [`HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md`](./HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md)
