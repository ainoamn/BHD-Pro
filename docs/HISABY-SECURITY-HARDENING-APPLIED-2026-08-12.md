# تطبيق حزمة التقوية الأمنية — 12 أغسطس 2026

**المصدر:**  
`C:\Users\ahami\Documents\Codex\2026-08-11\new-chat\outputs\BHD-Pro-security-hardening-2026-08-11`  
وأيضاً نسخة العمل: `...\work\qootk-pro-complete-hardening`

**الأساس:** `main` @ `a4f4cef`  
**الفرع المحلي:** `security-hardening-2026-08-11`  
**طريقة التطبيق:** `git apply` لـ `PATCHES/security-hardening.patch` (تحقق `--check` ناجح، ثم تطبيق مع `--index`)

---

## 1) ماذا طُبّق؟

حزمة تغطي نتائج التدقيق P0/P1 تقريباً (انظر التقرير الكامل أدناه):

| مجال | أمثلة |
|------|--------|
| Audit | تنقيح متداخل (`audit-sanitizer`) |
| تفويض | `enforceModulePermission` داخل `JwtAuthGuard` + توسيع خريطة المسارات |
| XSS طباعة | `html-escape` + إصلاح `invoice-print` / مطبخ / تقارير |
| دفع | claim ذري + `idempotency_key` + اختبارات |
| SSRF Thawani | allowlist origins + رفض config مجهول |
| مستندات عامة | `select` ضيق / بدون UUID داخلي زائد |
| كلمات مرور | forgot / reset / change + صفحات واجهة |
| CSRF | middleware + cookie `bhd_csrf` + رأس في `api.ts` |
| تشفير | مفاتيح منفصلة PAYMENT / TOTP + key id / previous keys |
| أرقام مستندات | تسلسل ذري |
| Money | Decimal helpers في مسارات حساسة |
| مرفقات | magic bytes + إنتاج يتطلب S3 |
| ثقة/خصوصية | صفحات privacy / terms / security / forgot-password |
| CI/Docker | بوابات إضافية، فصل migrate عن start |

**تقرير التدقيق الكامل (نسخة محلية):**  
[`HISABY-TECHNICAL-SECURITY-AUDIT-2026-08-11-ar.md`](./HISABY-TECHNICAL-SECURITY-AUDIT-2026-08-11-ar.md)

**دليل النشر:** [`SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md`](./SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md)  
**ملاحظات الإصدار:** [`RELEASE-SECURITY-HARDENING-2026-08-11.md`](./RELEASE-SECURITY-HARDENING-2026-08-11.md)

---

## 2) تحقق محلي بعد التطبيق (12 أغسطس 2026)

| فحص | النتيجة |
|------|---------|
| `git apply --check` | ناجح |
| Backend `npm ci` | ناجح (تنبيهات audit متبقية: 4 high في وقت التشغيل) |
| `prisma generate` + `validate` | ناجح |
| Backend `tsc --noEmit` | ناجح |
| Backend Jest | **19 suites / 52 tests** كلها ناجحة |
| Frontend `npm ci` | ناجح |
| Frontend `tsc` | ناجح |
| Frontend Jest | **1** اختبار XSS ناجح |
| Frontend ESLint | 0 أخطاء · 9 تحذيرات hooks قديمة |
| Frontend `next build` | ناجح (صفحات جديدة: `/forgot-password` `/reset-password` `/privacy` `/terms` `/security`) |

**لم يُنفَّذ هنا:** `prisma migrate deploy` على إنتاج أو staging (مطلوب نسخة احتياطية أولاً حسب دليل النشر).

---

## 3) توافق مع الموقع الحي الحالي — منع التعطيل

الإنتاج الحالي (`hisaby-api.onrender.com` / `bhd-pro.vercel.app`) ما زال على commit قديم غالباً وبدون هذه الحزمة.  
**الفرع لم يُدمَج في `main` تلقائياً** حتى لا يُنشر كود يتطلب أسراراً/هجرة قبل التهيئة.

### مخاطر إن نُشرت الحزمة بدون إعداد

| خطر | الأثر | الإجراء قبل Deploy |
|-----|--------|-------------------|
| `TOTP_SECRETS_KEY` غير مضبوط أو = `PAYMENT_SECRETS_KEY` | **فشل إقلاع** API في الإنتاج | عيّن مفتاحين مختلفين قويين + `*_KEY_ID` |
| `ATTACHMENT_STORAGE=dataurl` (الوضع الحي حالياً) | **فشل إقلاع** إلا مع `ALLOW_INSECURE_DATAURL_STORAGE=true` أو S3 | إمّا S3 حقيقي أو override مؤقت موثّق |
| هجرة `20260811120000_security_hardening` | أعمدة API keys / password reset / document sequences / payment idempotency | Backup → `migrate deploy` مرة واحدة في release job |
| CSRF على طلبات cookie بدون Bearer | 403 إن غاب `bhd_csrf` | الواجهة المحدّثة ترسل الرأس؛ تأكد CORS يتضمن أصل الموقع و`X-CSRF-Token` |
| صلاحيات وحدات أوسع عبر JWT | مستخدمون بـ permissions ضيقة قد يحصلون 403 على مسارات كانت مفتوحة خطأً | اختبر ADMIN + ACCOUNTANT + VIEWER قبل تحويل الترافيك |
| روابط مشاركة عامة | JSON أضيق (مقصود أمنياً) | تحقق من صفحة `/share/[token]` بعد النشر |

### ما يبقى آمناً دون نشر

- الكود على فرع `security-hardening-2026-08-11` فقط.
- `main` الحي وRender/Vercel الحاليان **لا يتأثران** حتى الدمج + Deploy يدوي.
- دمج Frontend وحده مع API قديم: رؤوس CSRF زائدة عادةً بلا ضرر؛ مسارات forgot-password تفشل حتى يُنشر الـ API.

---

## 4) ترتيب النشر الآمن (مختصر)

1. Backup Neon + اختبار استعادة.  
2. Env على Render: `TOTP_SECRETS_KEY` مختلف، key ids، وS3 أو `ALLOW_INSECURE_DATAURL_STORAGE=true` مؤقتاً.  
3. دمج PR / push بعد مراجعة.  
4. `prisma migrate deploy` **مرة واحدة** (ليس في start كل replica).  
5. Deploy API ثم Frontend.  
6. Smoke: دخول، بيع POS، فاتورة، مشاركة عامة، دفع تجريبي، نسيت كلمة المرور، مستخدم بصلاحيات محدودة.

---

## 5) خلاصة الحكم بعد التطبيق محلياً

- الحزمة **تطبّق نظيفاً** على `a4f4cef` بلا تعارضات patch.  
- الاختبارات المحلية للحزمة **خضراء**.  
- **لا تعطيل للموقع السابق** طالما لم يُنشر الفرع للإنتاج دون الأسرار والهجرة.  
- التقييم الإداري من التقرير (≈5.1/10 كمنصة عالمية) يبقى صالحاً كهدف؛ الحزمة تغلق طبقة الشيفرة P0 الأساسية لكنها لا تستبدل Deploy/Redis/Sentry/pentest.
