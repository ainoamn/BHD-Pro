# موجة BS — صدق إخفاء الوحدات عبر الباقة

**التاريخ:** 28 يوليو 2026

## الهدف

منع إظهار POS/المطاعم وميزات مدفوعة كـ«مفتوحة» قبل تحميل الاشتراك، وجعل مقارنة الباقات ولوحات التطبيقات صادقة مع الخطة.

## التغييرات

| ملف | ماذا |
|-----|------|
| `frontend/src/lib/plan-upgrade.ts` | `featuresFromPlanId` + `isLegacyPlanFeature` |
| `frontend/src/components/layout/sidebar.tsx` | افتراضات محافظة من باقة الشركة؛ لا unlock حتى `feature === true` |
| `frontend/src/app/(dashboard)/subscription/page.tsx` | كل ميزات الترقية مع ✓ أو قفل لكل باقة |
| `hisaby-apps-link-hub.tsx` / `hisaby-apps-panel.tsx` | زر ترقية بدل فتح إن الباقة لا تشمل النظام |
| i18n | `appUpgrade` / `appPlanLocked` + تلميح الباقة |

## تحقق يدوي

1. حساب STARTER: الشريط يُظهر كاشير/مطاعم كترقية (قفل)، لا رابط مباشر.
2. لوحة التحكم: بطاقة POS → «ترقية الباقة».
3. `/subscription`: STARTER يعرض قفل على POS/resto/AI/… وPROFESSIONAL يفتح POS ويقفل resto.

## التالي

- كاش Redis لكتالوج POS (اختياري عند `REDIS_URL`)
- صدق وضع mock للبريد/SMS
