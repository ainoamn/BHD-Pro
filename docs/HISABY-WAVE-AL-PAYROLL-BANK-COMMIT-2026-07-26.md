# Hisaby — موجة AL: عكس صرف رواتب/تحويل بنكي/التزامات + صلاحيات (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AK  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) عكس صرف الرواتب
- `reversePayrollPayment` (`REV-PAYROLL-PAY:{id}`)
- `POST /payroll/:id/unpay` + dual-control `PAYROLL_PAY`
- رفض PAID بدون قيد صرف (رجوع لـ APPROVED)
- واجهة: عكس صرف + حذف مسودة/معتمدة

### 2) عكس التحويل البنكي الداخلي
- `reverseBankTransfer` (`REV-BANK-XFER:{journalId}`)
- `POST /bank-accounts/transfer/:journalId/reverse` + dual-control
- حذف قيد يومية يرفض `BANK-XFER:*` ويوجّه للعكس عبر البنك
- واجهة: زر عكس آخر تحويل بعد النجاح

### 3) عكس استحقاق الالتزامات
- `reverseCommitmentAccrual` عبر مراجع `COMMIT:{id}:*` / `REV-COMMIT:{journalId}`
- `POST /commitments/:id/reverse-last`
- حذف التزام مرفوض إن بقيت استحقاقات غير معكوسة
- واجهة: «عكس آخر ترحيل»

### 4) صلاحيات / حماية مزدوجة
- `POST /subscriptions/upgrade` → ADMIN فقط
- عكس دفعة مفردة يتطلب `PAYMENT_REVERSE` (مثل reverse-all)

### 5) PartialType + سلامة أوامر شراء
- `UpdateCommitmentDto` / `UpdateEmployeeClaimDto` عبر PartialType
- `updateStatus` لأمر الشراء: لا RECEIVED عبر patch · إلغاء من DRAFT/SENT فقط

### 6) صدق واجهة
- toast فشل تغيير دور المستخدم
- رسائل API أوضح على حذف/عكس الالتزامات

---

## تحقق سريع

1. مسيرة PAID → unpay → APPROVED + `REV-PAYROLL-PAY`.  
2. تحويل بنكي → reverse → أرصدة تعود.  
3. ترحيل التزام → reverse-last → قيد عكس.  
4. CASHIER → 403 على upgrade اشتراك.  
5. عكس دفعة فاتورة → موافقة مزدوجة.  

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
