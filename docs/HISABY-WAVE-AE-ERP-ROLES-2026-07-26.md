# Hisaby — موجة AE: صلاحيات ERP المتبقية (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AD  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

إغلاق فجوات `@Roles` على وحدات مالية/تنظيمية كانت مفتوحة لأي غير-VIEWER (مثل CASHIER):

| الوحدة | الأدوار | المسارات |
|--------|---------|----------|
| إعادة تقييم صرف | ADMIN\|MANAGER\|ACCOUNTANT | `POST /fx-revaluation/post` |
| رصيد متجر (GL 2130) | نفس | `POST /contacts/:id/store-credit-adjust` |
| أصول ثابتة | نفس | create/update/delete/depreciate |
| أسعار صرف | نفس | create/update/delete + `UpdateExchangeRateDto` (PartialType) |
| مراكز تكلفة | نفس | seed/create/update/delete |
| مشاريع | نفس | create/update/delete |
| موظفون (يشمل راتب) | نفس | create/update/delete |
| مستودعات | نفس | create/update/delete |
| فروع | ADMIN\|MANAGER | create/update/delete |

---

## تحقق سريع

1. CASHIER → 403 على إهلاك أصل / ترحيل FX / تعديل رصيد متجر / إنشاء موظف.  
2. MANAGER يستطيع إنشاء فرع ومستودع.  
3. PUT أسعار صرف بقيمة rate سالبة يُرفض (ValidationPipe يعمل عبر UpdateExchangeRateDto).

---

## ملاحظة
تغطية صلاحيات ERP الأساسية لهذه الجولة مكتملة تقريباً. المتبقي خارج النطاق: WAF · Sentry · OTA live · Capacitor · SoftPOS.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
