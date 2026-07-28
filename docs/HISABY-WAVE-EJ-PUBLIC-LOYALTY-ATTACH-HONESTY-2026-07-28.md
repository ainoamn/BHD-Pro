# موجة EJ — صدق ربط الولاء من QR الضيف

**التاريخ:** 28 يوليو 2026

## الهدف

مسار `POST /public/resto/t/:token/loyalty` كان يربط جهة اتصال ويعيد نجاحاً حتى لو `customerEnabled: false`، والواجهة كانت تعد بنقاط عند الدفع بلا تحقق.

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto.service.ts` | رفض `publicAttachLoyalty` إذا الولاء غير مفعّل |
| `order/[token]/page.tsx` | رسالة خطأ/نجاح حسب التفعيل؛ لا وعد بنقاط عند التعطيل |
| `resto/page.tsx` | `apiErrorMessage` عند فشل ربط/فك ولاء الطاقم + toast نجاح الربط |
| `utils.ts` | خريطة عربية لـ Customer loyalty is not enabled |

## سلوك

- واجهة الضيف مخفية أصلاً عند التعطيل؛ طلب API مباشر → 400 صادق
- عند التفعيل → «تُحتسب النقاط عند الدفع»

## التالي

Cloudflare / Sentry / OTP يدوياً.
