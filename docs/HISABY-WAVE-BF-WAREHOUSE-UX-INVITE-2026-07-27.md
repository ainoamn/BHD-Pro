# موجة BF — صقل مستودع الموظف (واجهة + دعوات + صلاحيات)

**التاريخ:** 27 يوليو 2026  
**بعد:** Waves BC → BD → BE

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| قائمة التسليم | عدّاد `(n)` + سطر «+N أخرى» + تحديث بعد مزامنة الأوفلاين |
| أنواع API | `PosPendingFulfillment` لـ `listPosPendingFulfillments` / `fulfillPosSale` |
| المستخدمون | إلزام مستودع عند إنشاء كاشير + تنبيه للكاشير بلا مستودع |
| الدعوة | `getInvite` يعيد المستودع؛ صفحة الإكمال تعرضه للقراءة فقط |
| صلاحيات | افتراضي CASHIER: `inventory: hidden` (يستخدم `/pos/inventory`) |
| توثيق | روابط BC–BF + اختبار دخان للمستودع في قائمة الإطلاق |

## تذكير إنتاج

```bash
npx prisma migrate deploy
```

Migration: `20260727133000_user_home_warehouse_pos_fulfillment`

**متابعة:** [`HISABY-WAVE-BG-CASHIER-WAREHOUSE-ENFORCE-2026-07-27.md`](./HISABY-WAVE-BG-CASHIER-WAREHOUSE-ENFORCE-2026-07-27.md)
