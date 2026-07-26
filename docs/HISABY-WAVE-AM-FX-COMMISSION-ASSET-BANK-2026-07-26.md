# Hisaby — موجة AM: عكس FX/عمولة/إهلاك + حماية بنوك (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AL  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) عكس إعادة تقييم العملات (FX)
- `reverseFxRevaluation` (`REV-FX:{journalId}`) — منع حذف قيود `FX-REV:*` مباشرة
- `POST /fx-revaluation/reverse` (journalId أو asOf) + dual-control `FX_REVALUATION`
- واجهة: زر عكس بجانب ترحيل القيد

### 2) عكس صرف عمولة الكاشير
- `PosIncentivesService.reversePayout` — قيد ADJUST + عكس حركة نقد/GL إن وُجدت
- `POST /pos/incentives/payout/:ledgerId/reverse` + dual-control `COMMISSION_PAYOUT`
- واجهة: زر «عكس» على صفوف PAYOUT في شريحة العمولة

### 3) عكس آخر إهلاك أصل
- `reverseLastDepreciation` (`REV-DEP` عبر `reverseAssetDepreciation`)
- `POST /assets/:id/reverse-last-depreciation`
- واجهة الأصول: زر عكس آخر إهلاك

### 4) حماية حذف الحساب البنكي
- رفض رصيد غير صفري أو روابط مدفوعات/رواتب/مطالبات/التزامات
- تعطيل ناعم عند وجود كشوف بدلاً من الحذف الصلب

### 5) صلاحيات / Dual / صدق
- شحن رصيد متجر POS → ADMIN|MANAGER|ACCOUNTANT
- إعدادات حماية مزدوجة: `FX_REVALUATION` · `COMMISSION_PAYOUT`
- `UpdateApiKeyDto` عبر PartialType · `whatsappNotifyPhones` `@IsArray`
- `erp-crud-page` يعرض رسالة API عند الخطأ

---

## تحقق سريع

1. ترحيل FX → reverse → قيد `REV-FX` · لا حذف يدوي لـ `FX-REV`.  
2. صرف عمولة → reverse من الشريحة → ADJUST + نقد يعود.  
3. إهلاك أصل → reverse-last → صافي القيمة الدفترية تعود.  
4. حذف بنك برصيد/روابط → 400 · كشف فقط → deactivate.  
5. CASHIER → 403 على top-up رصيد متجر.

---

## متبقٍ (منتج)

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
