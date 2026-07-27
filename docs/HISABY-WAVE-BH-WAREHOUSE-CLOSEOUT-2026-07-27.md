# موجة BH — إغلاق بقايا مستودع الموظف

**التاريخ:** 27 يوليو 2026  
**بعد:** Waves BC → BG

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| تسجيل شركة جديدة | `register` يستخدم `issueSession` بنفس شكل المستودع/الصلاحيات |
| DTO مستخدمين | `defaultWarehouseId` يُقبل كـ UUID أو فارغ فقط |
| صلاحيات كاشير | حتى مع overrides قديمة: `inventory` / `warehouses` / `stockCounts` تُخفى |
| مخزون الكاشير | لا يسقط إلى ERP catalog؛ Retry يعيد تحميل سياق المستودع |
| ورديات مطاعم | عرض اسم المستودع بدل UUID مختصر |
| تلميح صلاحيات | في نافذة الوصول للكاشير عند ظهور مخزون ERP |

## اختبار

```bash
cd backend && npx jest test/module-permissions.spec.ts
```

**متابعة:** [`HISABY-WAVE-BI-INVITE-HEALTH-THROTTLE-2026-07-27.md`](./HISABY-WAVE-BI-INVITE-HEALTH-THROTTLE-2026-07-27.md)
