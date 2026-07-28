# موجة EF — صدق عمليات المطبخ (مستعجل / تعليق / استرجاع)

**التاريخ:** 28 يوليو 2026

## الهدف

أزرار Rush / Hold / Recall في KDS كانت تنجح بصمت وتفشل بشريط خطأ عام سهل تفويته على شاشة مزدحمة — بخلاف تغيير الحالة الذي يعرض صدق الإشعار.

## التغييرات

| ملف | ماذا |
|-----|------|
| `kitchen/page.tsx` | toast نجاح/فشل لـ rush/hold/recall/status · `apiErrorMessage` |
| `menu/page.tsx` | بقايا `actionFail` → `apiErrorMessage` (محطة/حساسية/أجزاء اليوم/…) |
| `resto-copy` | `kdsRushSet` / `kdsRushCleared` / `kdsHoldSet` / `kdsHoldCleared` / `kdsRecallOk` |

## سلوك

- تفعيل مستعجل → toast «عُلّم مستعجلاً» · إلغاء → «أُزيل الاستعجال»
- تعليق / تحرير / استرجاع بنفس الصدق
- فشل API → toast + شريط بالسبب الفعلي

## التالي

Cloudflare / Sentry / OTP يدوياً · لاحقاً: إشعار واتساب عند فتح/إغلاق الوردية.
