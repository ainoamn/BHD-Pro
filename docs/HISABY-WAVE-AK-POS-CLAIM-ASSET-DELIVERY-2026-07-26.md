# Hisaby — موجة AK: عكس نقد POS/صرف مطالبات + أصول/تسليم + صلاحيات (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AJ  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) عكس حركة نقد الكاشير
- `reversePosCashMovement` (مرجع `REV-POS-CASH:{id}`)
- `POST /pos/shifts/current/cash-movements/:id/reverse` — وردية مفتوحة فقط · dual-control لـ OUT فوق الحد
- واجهة الورديات: زر «عكس» لكل حركة

### 2) عكس صرف مطالبة موظف
- `reverseClaimPayment` + `POST :id/unpay` → APPROVED مع إبقاء استحقاق الاستحقاق
- dual-control `CLAIM_PAY` · زر عكس على الحالة PAID

### 3) أصول ثابتة
- ترحيل الإهلاك قبل تحديث القيمة · رفض إن فشل GL
- مرجع دوري `DEP:{id}:{YYYY-MM}` · منع إهلاك مزدوج لنفس الشهر
- حذف أصل مرفوض إن وُجدت قيود إهلاك

### 4) إلغاء إذن تسليم مسلَّم
- يعيد المخزن + حركة IN للتدقيق ثم CANCELLED

### 5) صلاحيات
- checkout فاتورة تحصيل · share-link / verify-link → ADMIN|MANAGER|ACCOUNTANT

### 6) دليل حسابات + صدق واجهة
- تعديل `openingBalance` لم يعد يمسح `currentBalance`
- `UpdateAccountDto` عبر `PartialType`
- toast فشل حذف جهات اتصال / أصناف

---

## تحقق سريع

1. إخراج نقد → عكس → `REV-POS-CASH` والحركة تُحذف من الورديات.  
2. صرف مطالبة → unpay → APPROVED + `REV-CLAIM-PAY`.  
3. إهلاك أصل مرتين في نفس الشهر → 400.  
4. تسليم إذن → إلغاء → كمية المخزن تعود.  
5. CASHIER → 403 على checkout وshare-link.  
6. تعديل رصيد افتتاحي لحساب بحركات → `currentBalance` لا يُصفَّر.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
