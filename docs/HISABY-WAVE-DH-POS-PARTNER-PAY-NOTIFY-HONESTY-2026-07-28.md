# موجة DH — صدق إشعار إيصال الدفع الشريك / الطرفية

**التاريخ:** 28 يوليو 2026

## الهدف

بيع `partnerCheckout` كان يرسل إيصال «مدفوع» قبل اكتمال الدفع الشريك/الطرفية، بينما الواجهة تتجاهل toast. بعد التسوية لم يكن هناك مسار صدق لإشعار العميل.

## التغييرات

| ملف | ماذا |
|-----|------|
| `pos.service.ts` | لا إشعار تلقائي عند `partnerCheckout` |
| `customer-notify.service.ts` | `notifyPosPartnerPayOnce` (مرة واحدة + تخزين) |
| `terminal-tap.service.ts` | إشعار بعد mock capture · إرجاع `customerNotify` في session |
| `payments.service.ts` | إشعار بعد تسوية تحصيل فاتورة شريك |
| `pos/page.tsx` · `api.ts` | toast صدق بعد mock/poll |

## سلوك

- إنشاء بيع شريك: لا إيصال بعد
- بعد الدفع (mock / webhook / poll): إشعار مرة واحدة + toast حي/mock/جزئي/فشل

## التالي

Cloudflare / Sentry / OTP يدوياً · `prisma migrate deploy` على Render.
