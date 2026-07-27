# موجة BC — مستودع الموظف الذكي + بيع مؤجّل التسليم

**التاريخ:** 27 يوليو 2026

## الفكرة

| الدور | السلوك |
|-------|--------|
| ADMIN / MANAGER / RESTO_MANAGER | يختار أي مستودع بحرية من القائمة |
| CASHIER وباقي الموظفين | يُقفل على **مستودعه المنزلي** (`User.defaultWarehouseId` أو مستودع POS للشركة) |
| بيع من مستودع آخر | مسموح للكاشير مع خيار **تسليم لاحقاً** — التحصيل الآن، وخصم المخزون عند التنفيذ |

## قاعدة البيانات

- `users.default_warehouse_id`
- `invoices.pos_warehouse_id`
- `invoices.pos_fulfillment_status` = `PENDING` | `DONE` | null

Migration: `20260727133000_user_home_warehouse_pos_fulfillment`

على Render:

```bash
npx prisma migrate deploy
```

## واجهات API

- `GET /pos/warehouse-context`
- `POST /pos/sales` + `deferredFulfillment`
- `GET /pos/fulfillments/pending`
- `POST /pos/sales/:id/fulfill`
- تعيين المستودع من `/users` (مستخدمين الشركة)

## تشغيل المدير

1. أنشئ مستودعات للفروع.
2. من **المستخدمون** عيّن «مستودع الموظف» لكل كاشير.
3. الكاشير يرى مستودعه فقط؛ لتلبية طلب من فرع آخر يفعّل «بيع من مستودع آخر (تسليم لاحقاً)».
4. عند وصول البضاعة: زر **تم التسليم / خصم المخزون** من قائمة الانتظار في شاشة الكاشير.

**متابعة:** [BD](./HISABY-WAVE-BD-WAREHOUSE-SHIFTS-INVENTORY-2026-07-27.md) · [BE](./HISABY-WAVE-BE-WAREHOUSE-SESSION-RESTO-2026-07-27.md) · [BF](./HISABY-WAVE-BF-WAREHOUSE-UX-INVITE-2026-07-27.md)
