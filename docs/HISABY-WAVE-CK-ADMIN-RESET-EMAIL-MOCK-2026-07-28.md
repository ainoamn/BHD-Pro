# موجة CK — صدق mock لإيميل إعادة تعيين كلمة المرور (منصة)

**التاريخ:** 28 يوليو 2026

## الهدف

موجة CJ أصلحت دعوات الشركة؛ إعادة تعيين كلمة المرور من `/admin/users` بقيت تعتبر `EMAIL_MODE=mock` إرسالاً حقيقياً فتخفي كلمة المرور المؤقتة عن المشغّل.

## التغييرات

| ملف | ماذا |
|-----|------|
| `admin.service.ts` | `emailSent = ok && !mock` · `emailMock` · إرجاع `temporaryPassword` إن لم يُسلَّم |
| `admin/users/page.tsx` | toast mock يعرض كلمة المرور |
| `admin-copy.ts` | `passwordMock` |

## التالي

Wave CL (Z-report email mock) · Cloudflare / Sentry يدوياً.
