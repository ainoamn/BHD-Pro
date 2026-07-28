# موجة BZ — صدق كاش كتالوج POS + إبطال لوحة عند تسوية الدفع

**التاريخ:** 28 يوليو 2026

## الهدف

1. **POS:** موجة BU تُرجع `cached: true` من Redis دون أن تعكس الواجهة ذلك — المستخدم يرى «مزامنة ناجحة» حتى لو القراءة من كاش الخادم.
2. **لوحة التحكم:** موجة BY أبطلت الكاش عند فواتير/POS، لكن تسوية فاتورة اشتراك/بوابة عبر `fulfillBillingInvoice` كانت تحدّث المبالغ المدفوعة دون إبطال — فجوة صدق مع Redis.

## التغييرات

| ملف | ماذا |
|-----|------|
| `api.ts` | `cached?: boolean` على `syncPosCatalog` / `syncPosStock` |
| `pos-copy.ts` | `catalogSyncedCached` + `catalogCachedHint` (عربي/إنجليزي) |
| `pos/page.tsx` | toast مختلف عند `cached`؛ تلميح هادئ تحت شريط الكتالوج |
| `payments.module.ts` | استيراد `RedisModule` |
| `payments.service.ts` | `invalidateDashboardStats` بعد `$transaction` في `fulfillBillingInvoice` |

## سلوك

- بدون Redis: لا تغيير ملحوظ (`cached` غائب/`false`)
- مع Redis: مزامنة كتالوج كاملة من الكاش → toast «من كاش الخادم» + تلميح؛ تسوية دفع أونلاين → إبطال كاش اللوحة فوراً

## التالي

Cloudflare / Sentry يدوياً · قالب OTP واتساب · أرشفة docs القديمة.
