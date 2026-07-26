# ترقية Hisaby — Wave 22 POS (يوليو 2026)

**الهدف:** قفل شاشة الخمول، عدّ النقد بالفئات عند الإغلاق، ووضع تدريب آمن بلا ترحيل.

## ما شُحن

1. **قفل الخمول**
   - `idleLockMinutes` في `security_config` (0 = معطّل)
   - بعد الخمول تُقفل شاشة `/pos` حتى موافقة مزدوجة `POS_IDLE_UNLOCK`
   - إعداد في الحماية المزدوجة

2. **عدّ النقد بالفئات (Till count)**
   - شبكة فئات عند إغلاق الوردية → مجموع يملأ `closingCash`
   - يُحفظ في `PosShift.closingDenominationJson` ويظهر في نص تقرير Z
   - Migration: `20260726200000_pos_shift_closing_denomination`

3. **وضع التدريب**
   - تبديل في شريط الكاشير (session)
   - بانر واضح؛ البيع محاكاة فقط — لا مخزون ولا دفاتر
   - يمكن تعطيله عبر `allowTrainingMode` في إعدادات الحماية

## النشر

```bash
npx prisma migrate deploy
npx prisma generate
```

## مؤجّل

- SoftPOS إنتاجي · كوبونات POS · لوحة متعددة الشركات · قيود العمر · layaway كامل · ميزان تسلسلي
