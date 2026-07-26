# Hisaby — موجة AR: Dual على التزامات/جرد/تسليم + FX/رصيد متجر (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AQ  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) Dual `COMMITMENT_REVERSE`
- إجراء جديد في إعدادات الموافقة المزدوجة + i18n
- `POST /commitments/:id/reverse-last` يتطلب `approval` عند تفعيل dual
- واجهة الالتزامات عبر `DualApprovalModal`

### 2) Dual حذف مسير الرواتب
- `DELETE /payroll/:id` مع جسم `{ approval }` و`PAYROLL_PAY`
- واجهة الموظفين تفتح الموافقة قبل الحذف

### 3) Dual جرد المخزون
- `complete` و`reverse-completed` يتطلبان `STOCK_ADJUST`
- واجهة الجرد: موافقة قبل الإكمال والعكس

### 4) Dual إشعارات التسليم
- `deliver` / `cancel` يتطلبان `STOCK_ADJUST`
- حذف المسودة فقط (DRAFT)
- واجهة التسليم عبر `DualApprovalModal`

### 5) Dual FX + رصيد المتجر (واجهة)
- ترحيل/عكس إعادة تقييم العملات يمرّ بموافقة `FX_REVALUATION`
- تعديل/عكس رصيد المتجر يمرّ بموافقة `STORE_CREDIT_ADJUST`

### 6) Soft-delete / حراسة
- قوالب المستندات → تعطيل (`isActive: false`) بدل حذف صلب
- فواتير مجدولة أُنشئت مسبقاً (`lastGeneratedAt`) → رفض الحذف (عطّل بدلاً منه)

---

## تحقق سريع

1. التزام → reverse-last → موافقة مزدوجة عند التفعيل.  
2. جرد DRAFT → complete → موافقة · COMPLETED → reverse → موافقة.  
3. إشعار تسليم DRAFT → deliver/cancel → موافقة.  
4. FX post/reverse و store-credit adjust → موافقة.  
5. حذف مسير رواتب → موافقة `PAYROLL_PAY`.  
6. حذف قالب مستند → يصبح غير نشط · حذف فاتورة مجدولة مولَّدة → 400.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
