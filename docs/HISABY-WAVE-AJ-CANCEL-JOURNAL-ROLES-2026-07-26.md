# Hisaby — موجة AJ: إلغاء فاتورة/دفتر/مطاعم + صلاحيات + PartialType (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AI  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) إلغاء فاتورة يعكس دفعات GL أولاً
- `updateStatus(CANCELLED)` يستدعي `clearPaymentsForLifecycle` (عكس كل `REV-PAY` + حذف الدفعات) ثم `reverseInvoiceEntry`
- منع تغيير الحالة بعيداً عن مدفوع/جزئي دون عكس الدفعات أولاً
- `reversePaymentEntry`: idempotent عبر مرجع `REV-PAY:{id}`

### 2) حذف قيد يومية آمن
- رفض الحذف إن كان القيد مربوطاً بفاتورة/دفعة/رواتب/مطالبة/حركة كاشير
- عكس أرصدة الحسابات والبنوك قبل الحذف (كان يترك الأرصدة منحرفة)

### 3) إلغاء طلب مطعم + فاتورة دفع إلكتروني
- إن وُجدت فاتورة مدفوعة/جزئية → رفض
- وإلا → `invoices.updateStatus(CANCELLED)` ثم إلغاء الطلب

### 4) صلاحيات
- جهات اتصال: create/update/delete → ADMIN|MANAGER|ACCOUNTANT
- تنبيهات إدارة: PATCH → ADMIN|MANAGER
- مرفقات: POST → نفس أدوار DELETE

### 5) PartialType لأوامر الشراء والفواتير المجدولة
- `UpdatePurchaseOrderDto` / `UpdateScheduledInvoiceDto` يمتدان `PartialType`
- تحديث جزئي بدون إعادة إرسال `items` إلزامياً

### 6) صدق واجهة
- دفتر اليومية: toast عند فشل الحذف
- الالتزامات: toast عند فشل pause/resume/run/delete

---

## تحقق سريع

1. فاتورة SENT + دفعة → إلغاء → قيود `REV-PAY` و`REV-INV` والحالة CANCELLED بدون دفعات.  
2. حذف قيد مربوط بفاتورة → 400. حذف قيد يدوي → أرصدة الحساب تتراجع.  
3. طلب مطعم بفاتورة غير مدفوعة → cancel يلغي الفاتورة أيضاً.  
4. CASHIER → 403 على إنشاء جهة اتصال / رفع مرفق.  
5. PUT أمر شراء بحقل `notes` فقط → 200.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
