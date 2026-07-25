# ترقية Hisaby — POS Wave 5 (يوليو 2026)

## منجز

### 1) موافقة مزدوجة عند فارق إغلاق الوردية
- إجراء `SHIFT_CLOSE_VARIANCE` عند `|closingCash − expectedCash| > shiftVarianceLimit` (افتراضي 1.000).
- واجهة `/pos/shifts` تفتح `DualApprovalModal` قبل الإغلاق عند تجاوز الحد.
- الحد قابل للضبط من إعدادات الحماية.

### 2) شارة NFC للموافقة
- طريقة `NFC` + `badgeSecret` (bcrypt hashes في `securityConfig.nfcBadgeHashes`).
- قارئ Web NFC (`NDEFReader`) مع إدخال يدوي للاختبار على سطح المكتب.
- تسجيل/مسح الشارات من إعدادات الحماية.

### 3) كاش كتالوج POS أوفلاين
- `frontend/src/lib/pos-catalog-cache.ts` (IndexedDB).
- آخر بحث ناجح يُحفظ؛ البحث/الباركود يسقطان للكاش عند فشل الشبكة.

### 4) تشديد WhatsApp OTP
- إبطال OTP غير المستخدمة لنفس actor+action.
- حد 3 طلبات / 10 دقائق.
- أرقام الإشعار قابلة للضبط من الإعدادات.

## تشغيل
لا migration جديدة — يعتمد على `securityConfig` JSON وجدول OTP الموجود.
