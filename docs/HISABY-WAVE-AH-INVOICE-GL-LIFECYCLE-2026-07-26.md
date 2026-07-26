# Hisaby — موجة AH: سلامة GL للفواتير + صلاحيات دورة حياة (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AG  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) إصلاح أخطاء GL (حقيقي)
- **`unsend`:** يعكس قيد الفاتورة عبر `reverseInvoiceEntry` قبل إرجاعها لمسودة (كان يترك القيد معلّقاً)
- **`remove`:** حذف المسودات فقط · رفض المرسلة/المرحّلة/ذات دفعات — الإلغاء هو مسار عكس الدفتر

### 2) صلاحيات دورة حياة الفاتورة / أوامر الشراء
- فواتير: create/update/status/send/unsend/convert/delete → ADMIN|MANAGER|ACCOUNTANT  
  (يغلق تجاوز CASHIER عبر `PATCH status=PAID` دون بوابة التحصيل)
- أوامر شراء: create/update/status/convert/delete → نفس الأدوار

### 3) واجهة
- **`canDeleteInvoice`:** DRAFT فقط (يتوافق مع الـ API)
- **جهات اتصال — رصيد متجر:** خطأ تحميل البنوك + إعادة

---

## تحقق سريع

1. أرسل فاتورة (ترحيل GL) ثم «إلغاء إرسال» — يظهر قيد عكس ويُفرَّغ `glJournalId`.  
2. محاولة حذف فاتورة SENT → 400 مع رسالة الإلغاء بدل الحذف.  
3. CASHIER → 403 على create/status/delete فواتير وconvert أمر شراء.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
