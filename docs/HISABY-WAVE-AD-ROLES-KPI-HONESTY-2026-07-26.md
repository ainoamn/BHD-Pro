# Hisaby — موجة AD: صلاحيات مالية + صدق KPIs (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AC  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صلاحيات Backend (ADMIN|MANAGER|ACCOUNTANT إلا حيث يُذكر)
- قيود اليومية: create / delete
- دليل الحسابات: create / update / delete
- حسابات بنكية: create / transfer / update / delete + أسطر كشف
- رواتب: create / status / delete
- معدلات ضريبة: create / update / set-default / delete + `UpdateTaxRateDto` (PartialType) بدل `Partial<>` الذي يتجاوز ValidationPipe
- **ربط POS/مطاعم activate:** ADMIN|MANAGER (أو RESTO_FLOOR_MGR للمطاعم) — كان مفتوحاً لأي دور

### 2) صدق واجهة
- **EOD:** تنبيهات الوردية `?` عند فشل/انتظار التحميل — لا «جاهز للإغلاق» كاذب
- **لوحة التحكم:** QuickActions لا تعرض أصفار مالية قبل نجاح البيانات
- **محاسبة:** إحصاءات الفواتير تظهر `—` + تنبيه عند فشل stats
- **ضريبة / مخزون:** شريط KPI يستبدل بـ QueryError عند فشل الإحصاء
- **صالة مطاعم:** فشل التحقق من وردية الصندوق يظهر تحذير + إعادة (بدل صمت)

---

## تحقق سريع

1. مستخدم CASHIER → 403 على POST `/journal` و `/bank-accounts/transfer` و `/payroll`.  
2. CASHIER → 403 على `POST /pos/link/activate`.  
3. أوقف API جزئياً على شاشة إغلاق وردية — تنبيهات تظهر `?`.  
4. فشل `invoice-stats` → بلاطات المدفوع/المستحق تظهر `—` لا أصفار.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
