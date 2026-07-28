# موجة CG — صدق حالة إرسال OTA (mock · sandbox · live)

**التاريخ:** 28 يوليو 2026

## الهدف

صفحة `/vat` كانت تعرض «تم الإرسال بنجاح» وشارة خضراء «مُعتمدة» لأي فاتورة لها `vatUuid`، حتى في mock/sandbox أو `LIVE_PENDING` / `LIVE_REJECTED`. الـ API كان يخزّن `otaStatus`/`otaMode` في `customFieldsJson` دون أن تقرأها الواجهة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `vat.service.ts` | قائمة تُرجع `otaStatus`/`otaMode`/`otaMessage` · إرسال يُرجعها صراحة · إحصاءات حسب الاعتماد الحقيقي لا مجرد UUID |
| `vat/page.tsx` | toast حسب الوضع · شارات · إعادة إرسال لـ pending/rejected |
| `ar.json` / `en.json` | مفاتيح toast/شارة منفصلة عن عدّاد الإحصاءات |

## سلوك

- mock → toast/شارة تحذيرية «محلي»
- sandbox → «تجريبي»
- live pending/rejected → انتظار/رفض + زر إعادة إرسال
- live cleared → نجاح أخضر
- بطاقة الإحصاءات «مُعتمدة» = `clearedAt` / CLEARED / SANDBOX_ACCEPTED فقط

## التالي

Cloudflare / Sentry / OTP واتساب يدوياً · (اختياري) صدق mock لـ WhatsApp OTP في الحماية المزدوجة · أرشفة docs.
