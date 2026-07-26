# Hisaby — موجة AI: سلامة GL (مطالبات/رواتب/فواتير) + readiness (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AH  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) مطالبات الموظفين — عكس الاستحقاق عند الرفض
- **`reverseClaimAccrual`** في `GlPostingService` (مرجع `REV-CLAIM-ACC:{id}`)
- **`reject`:** إن كانت APPROVED ولها قيد استحقاق → عكس قبل REJECTED
- حذف مطالبة يرفض إن بقي `glAccrualJournalId`
- صلاحيات create/update/submit/delete → ADMIN|MANAGER|ACCOUNTANT

### 2) رواتب — لا حذف/انتقال يتيّم القيود
- **`reversePayrollAccrual`** (مرجع `REV-PAYROLL-ACC:{id}`)
- **حذف:** DRAFT أو APPROVED غير مدفوع فقط · يعكس الاستحقاق قبل الحذف · PAID مرفوض
- **تحديث الحالة:** مسارات APPROVED و PAID فقط · أي انتقال آخر → 400 (كان يسمح بتعيين حالة عشوائية دون عكس)

### 3) فواتير — منع انفصال الدفتر عن التحرير
- **`update`:** مسودة DRAFT فقط (بعد الإرسال: unsend ثم عدّل)
- **`recalcAfterPayments`:** عند إلغاء دفع مشتريات → **SENT** (كان يعيدها لـ DRAFT بينما GL ما زال مرحّلاً)
- واجهة **`canEditInvoice`:** DRAFT فقط

### 4) جاهزية التشغيل
- **`GET /health/ready`:** `SELECT 1` عبر Prisma · 503 عند فشل DB  
  (`GET /health` يبقى liveness بدون DB)

---

## تحقق سريع

1. وافق مطالبة (قيد استحقاق) ثم ارفضها → قيد `REV-CLAIM-ACC` و`glAccrualJournalId=null`.  
2. وافق رواتب ثم احذف → عكس ثم حذف · حاول `status=DRAFT` من APPROVED → 400.  
3. عدّل فاتورة SENT عبر API → 403 · بعد unsend يعمل.  
4. سجّل دفع شراء ثم اعكسه → الحالة SENT لا DRAFT.  
5. `GET /health/ready` → `{ status: "ready", database: "ok" }`.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
