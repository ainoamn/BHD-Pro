# Hisaby — موجة AS: Dual عمولة POS + إلغاء ناعم للالتزامات + صدق قيود/أسعار (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AR  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) Dual صرف/عكس عمولة الكاشير (واجهة)
- الخادم كان يطلب `COMMISSION_PAYOUT` بينما شريحة POS ترسل بدون موافقة → طريق مسدود
- `payoutPosCommission` / `reversePosCommissionPayout` يقبلان `approval`
- `PosCommissionChip` يفتح `DualApprovalModal` قبل الصرف والعكس

### 2) إلغاء ناعم للالتزامات المتكررة
- `DELETE /commitments/:id` يضبط `status=CANCELLED` بدل حذف السجل
- يرفض الحذف إن بقيت استحقاقات غير معكوسة · يرفض إلغاء مكرر
- الواجهة تخفي أزرار التعديل/الحذف للملغى وتعرض toast إلغاء

### 3) صدق أخطاء الواجهة
- دفتر اليومية: `apiErrorMessage` على إنشاء/حذف (حراسة REV/INV تظهر للمستخدم)
- أسعار الصرف: `apiErrorMessage` على التحويل (ورفض حذف سعر مربوط بـ FX)

---

## تحقق سريع

1. كاشير ADMIN → صرف عمولة مع dual مفعّل → موافقة ثم نجاح.  
2. عكس صرف عمولة من السجل → موافقة.  
3. التزام مع استحقاقات معكوسة → حذف → CANCELLED يبقى في القائمة.  
4. حذف قيد `REV-*` من الواجهة → رسالة API واضحة.  
5. حذف سعر صرف يوم FX-REV → رسالة واضحة.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
