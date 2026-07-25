# ترقية Hisaby — حزمة تجربة الشركة + الأمان (يوليو 2026)

## ما تم تنفيذه

### 1) لوحة الشركة — مؤشرات ذكية
- مبيعات اليوم، مستحقات متأخرة، مخزون منخفض، فواتير بلا ربط ضريبي.
- مصدر البيانات: `GET /dashboard/stats` (حقول جديدة + `alerts` + `onboarding`).

### 2) قائمة إعداد أولية (Onboarding)
- قائمة تحقق تظهر حتى اكتمال إعداد الشركة (شعار، ضريبة، سجل، عنوان، هاتف، عميل، منتج، فاتورة).
- روابط مباشرة لكل خطوة من لوحة التحكم.

### 3) تنبيهات أذكى
- فواتير متأخرة / تحصيل معلّق / مشتريات متأخرة.
- مخزون منخفض وربط ضريبي معلّق.
- تنبيه انتهاء الاشتراك خلال 14 يومًا.

### 4) تصدير التقارير
- CSV + Excel (`.xls` SpreadsheetML) + PDF + طباعة من صفحات التقارير.
- الملفات: `export-report.ts` و`ExportButtons`.

### 5) PWA أساسي
- `manifest.webmanifest` مربوط بالميتاداتا.
- Service Worker خفيف (`/sw.js`) للتخزين المؤقت للواجهة.
- تسجيل تلقائي عبر `PwaRegister`.

### 6) حماية مزدوجة (Dual Control / Maker-Checker) — MVP
- عمود `security_config` على الشركات (migration `20260725150000_company_security_config`).
- موافقة مشرف لإجراءات حساسة: إلغاء POS، تجاوز السعر، تعديل/تحويل مخزون، إلغاء فاتورة، عكس دفعة.
- طرق: تأكيد ذاتي للمدير، كلمة مرور مشرف، PIN.
- إعدادات في `/settings` وإعدادات POS.
- لاحقًا: WhatsApp OTP / NFC وموافقات غير متزامنة.

## ملفات رئيسية
- `backend/src/dashboard/dashboard.service.ts`
- `backend/src/dual-control/*`
- `frontend/src/components/dashboard/smart-kpis.tsx`
- `frontend/src/components/dashboard/onboarding-checklist.tsx`
- `frontend/src/components/layout/notifications-button.tsx`
- `frontend/src/components/security/*`
- `frontend/src/lib/export-report.ts`
- `frontend/src/components/reports/export-buttons.tsx`
- `frontend/public/manifest.webmanifest`
- `frontend/public/sw.js`

## خارج هذه الحزمة (لاحقًا)
- فوترة إلكترونية كاملة لكل دولة، مطابقة بنكية حقيقية، صلاحيات فروع أدق، تكاملات متاجر، Sentry، تطبيقات جوال أصلية.
