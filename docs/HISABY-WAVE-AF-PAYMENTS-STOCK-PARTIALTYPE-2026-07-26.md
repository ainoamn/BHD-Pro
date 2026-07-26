# Hisaby — موجة AF: تحصيل/مخزون + PartialType + اشتراك (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AE  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) صلاحيات مالية / مخزون
- **فواتير:** تسجيل/عكس دفعات (فردي + دفعة + reverse-all) → ADMIN|MANAGER|ACCOUNTANT
- **منتجات:** create/update/delete + adjust/transfer → نفس الأدوار
- **مرفقات:** حذف → نفس الأدوار
- **اشتراك:** checkout + mock-confirm → ADMIN فقط
- **حقول مخصصة / قوالب مستندات:** create/update/delete(/set-default) → ADMIN|MANAGER

### 2) ValidationPipe — إنهاء `Partial<>` على PUT
`Update*Dto extends PartialType(...)` لـ:
BankAccount · Asset · Warehouse · Branch · Employee · Project · CostCenter · CustomField · DocumentTemplate

### 3) صدق واجهة (خفيف)
- التزامات: تنبيه عند فشل تحميل بنوك/حسابات في نموذج الإنشاء
- رواتب: تنبيه + إعادة عند فشل قائمة البنوك

---

## تحقق سريع

1. CASHIER → 403 على `POST /invoices/:id/payments` و `POST /products/:id/adjust`.  
2. غير ADMIN → 403 على `POST /payments/subscription/checkout`.  
3. PUT بنك بقيمة فارغة لـ name يُرفض بعد ValidationPipe.  
4. فشل API البنوك في شاشة الرواتب يظهر شريط خطأ لا قائمة فارغة صامتة.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
