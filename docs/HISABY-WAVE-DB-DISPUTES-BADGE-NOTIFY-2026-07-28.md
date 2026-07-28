# موجة DB — شارة بلاغات العملاء المفتوحة في التنقّل والإشعارات

**التاريخ:** 28 يوليو 2026

## الهدف

لوحة `/disputes` (Wave DA) موجودة لكن التاجر لا يلاحظ البلاغات الجديدة بلا شارة أو بند في جرس التنبيهات — نفس فجوة كانت لـ management alerts قبل الشارة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `dashboard.service.ts` | `openCustomerDisputesCount` + علم في `alerts` |
| `sidebar.tsx` | شارة عدد OPEN على رابط `/disputes` |
| `notifications-button.tsx` | بند بلاغات مفتوحة → `/disputes` |
| `ar.json` / `en.json` | `customerDisputesTitle` / `Msg` |

## سلوك

- بلاغ OPEN يزيد العداد في الشريط وجرس التنبيهات
- بعد حلّ/رفض البلاغ يختفي عند إعادة التحميل/التنقّل

## التالي

Cloudflare / Sentry / OTP · إشعار جاهزية takeaway (DC).
