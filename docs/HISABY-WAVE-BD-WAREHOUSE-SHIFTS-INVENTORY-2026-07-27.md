# موجة BD — إكمال مستودع الموظف (ورديات + مخزون)

**التاريخ:** 27 يوليو 2026  
**بعد:** Wave BC  
**متابعة:** [`HISABY-WAVE-BE-WAREHOUSE-SESSION-RESTO-2026-07-27.md`](./HISABY-WAVE-BE-WAREHOUSE-SESSION-RESTO-2026-07-27.md)

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| ورديات UI | قائمة المستودع للمدير فقط؛ الكاشير يرى مستودعه |
| فتح وردية API | `openShift` يستقبل `TokenPayload` ويفرض المستودع عبر `resolveSaleWarehouse` |
| إغلاق وردية | الكاشير يُغلق وردية مستودعه المنزلي فقط |
| حركة نقد | نفس القفل على مستودع الوردية |
| مخزون الكاشير `/pos/inventory` | يعرض أصناف مستودع الموظف؛ المدير يختار المستودع؛ الإنشاء يمرّر `warehouseId` |

## تذكير إنتاج

```bash
npx prisma migrate deploy
```

Migration المرتبط: `20260727133000_user_home_warehouse_pos_fulfillment`  
ثم عيّن «مستودع الموظف» من صفحة المستخدمين.
