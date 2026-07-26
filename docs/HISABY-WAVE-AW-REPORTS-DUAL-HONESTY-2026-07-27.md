# Hisaby — موجة AW: تقارير + Dual + صدق واجهة (27 يوليو 2026)

**الفرع:** `main` · بعد موجة AV  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) تقارير — RolesGuard
- `reports.controller.ts`: Jwt + RolesGuard · ADMIN/MANAGER/ACCOUNTANT
- سجل التدقيق (`audit-log`) مضيق إلى ADMIN|MANAGER

### 2) Dual — رفض مطالبة + صرف نقد POS كتب
- رفض مطالبة موظف يتطلب `CLAIM_PAY` + payload موافقة · واجهة Modal
- `/pos/books` مصروف نقد (`OUT`) يعيد المحاولة عبر `DualApprovalModal` / `SHIFT_CASH_OUT`

### 3) سلامة مخزون / فواتير
- حذف جرد مرفوض إن وُجد `completedAt` (حتى بعد عكس → CANCELLED)
- `canUnsendInvoice` يمنع unsend عند وجود دفعات · المحاسبة تمرّر `paymentCount`

### 4) عملة الجلسة و FX
- `restoreSession` يرفق `company` · ترحيل SAR→OMR على `user.company`
- أسعار الصرف وإعادة تقييم FX تقرأ من `company?.currency`

### 5) صدق حذف ناعم + تسوية بنك
- `ErpCrudPage` + `softDelete` → toast «تم التعطيل» · ضرائب / قوالب / حقول مخصصة
- اقتراح تسوية بنك: نص يوضح أن القبول يعلّم المسوّى فقط **بدون** ربط دفعة/قيد
- إخفاء حذف بند كشف إن كان مسوّى

---

## تحقق سريع

1. موظف بدون ACCOUNTANT → تقارير 403.  
2. رفض مطالبة مع Dual مفعّل → يطلب موافقة ثانية.  
3. مصروف نقد كتب فوق الحد → Modal ثم نجاح.  
4. حذف ضريبة → toast تعطيل.  
5. اقتراح تسوية بنك → نص «بدون ربط».

---

## متبقٍ (منتج / لاحق)

ربط حقيقي لاقتراح التسوية البنكية · Dual حذف قيد يومية · Dual `run-due` التزامات · WAF · Sentry كامل · OTA live · Capacitor · SoftPOS
