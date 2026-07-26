# Hisaby — موجة AQ: عكس تعديل مخزون/جرد + حماية قيود ومستخدمين (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AP  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) عكس تعديل المخزون
- مرجع تلقائي `ADJ:{productId}:{ts}` · ملاحظات `Adjust IN|OUT|SET from→to`
- `POST /products/:id/adjust/reverse-last` + dual `STOCK_ADJUST` · `REV-ADJ:{ref}`
- واجهة المخزون: زر «عكس آخر تعديل»

### 2) عكس جرد مكتمل
- `POST /stock-counts/:id/reverse-completed` يستعيد `systemQty` ويعلّم الجرد `CANCELLED`
- Idempotent عبر `{countNumber}-REV`
- واجهة: زر عكس للجرد المكتمل

### 3) حماية دفتر اليومية
- رفض حذف قيود بمراجع `REV-*` · `INV:` · `PAY:` · `PAYROLL-` · `CLAIM-` · `POS-CASH`

### 4) Dual إهلاك الأصول
- `ASSET_DEPRECIATE` على ترحيل/عكس الإهلاك
- واجهة الأصول عبر DualApprovalModal

### 5) Soft-delete / حراسة حذف
- حقول مخصصة → تعطيل بدل حذف
- سطر كشف بنكي مُسوّى → رفض الحذف
- أمر شراء: حذف DRAFT فقط (SENT يُلغى)

### 6) مستخدمون + صدق واجهة
- `GET /users` → ADMIN|MANAGER + Throttle
- `UpdateUserDto` عبر PartialType
- `erp-crud-page` يستخدم `apiErrorMessage`

---

## تحقق سريع

1. تعديل مخزون IN → reverse-last → الكمية تعود.  
2. جرد مكتمل → reverse-completed → كميات النظام + CANCELLED.  
3. حذف قيد `REV-PAY:…` → 400.  
4. إهلاك أصل → موافقة مزدوجة.  
5. CASHIER → 403 على قائمة المستخدمين.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
