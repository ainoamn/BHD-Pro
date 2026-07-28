# موجة DC — إشعار جاهزية طلب الاستلام (takeaway) بصدق

**التاريخ:** 28 يوليو 2026

## الهدف

طلبات الاستلام لم تُشعر الضيف عند اكتمال المطبخ، وصفحة takeaway لم تجمع هاتفاً — بينما التوصيل يُشعر عند OUT/DELIVERED (Wave CZ).

## التغييرات

| ملف | ماذا |
|-----|------|
| `resto-guest-notify.service.ts` | نوع `TAKEAWAY_READY` + نص |
| `resto.service.ts` | عند آخر بند → READY لقناة TAKEAWAY: إشعار + `notify` |
| `kitchen/page.tsx` | toast صادق لـ mock/حي |
| `takeaway/page.tsx` | حقول اسم/هاتف عند فتح الطلب + عرضها في القائمة |
| `api.ts` | نوع `notify` على حالة بند المطبخ |

## سلوك

- بدون هاتف: لا إشعار
- عند اكتمال كل البنود (لا SENT/PREPARING): إشعار مرة واحدة
- mock → 🧪 في المطبخ

## التالي

Cloudflare / Sentry / OTP يدوياً.
