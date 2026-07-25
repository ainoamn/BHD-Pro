# حسابي للمطاعم — دليل سريع (R1+R2)

**المسار:** `/resto`

## التدفق التشغيلي

1. فعّل الربط من `/resto/settings`  
2. من الصالة `/resto` اضغط **تهيئة صالة افتراضية** إن لم توجد طاولات  
3. اضغط طاولة فارغة → يفتح طلب  
4. أضف أصنافاً من القائمة → **إرسال للمطبخ**  
5. تابع البنود في `/resto/kitchen` (بدء / جاهز / تسليم)  
6. **إغلاق الطلب** يحرّر الطاولة (الدفع المحاسبي في R4)

## API مختصر

| العملية | المسار |
|---------|--------|
| الصالة | `GET /resto/floor` · `POST /resto/floor/seed` |
| طلب | `POST /resto/orders` · `GET /resto/orders/:id` |
| بنود | `POST .../items` · `DELETE .../items/:itemId` |
| إرسال | `POST /resto/orders/:id/send` |
| مطبخ | `GET /resto/kitchen` · `POST /resto/kitchen/items/:id/status` |

المرجع: [`HISABY-RESTAURANT-KITCHEN-PLAN.md`](./HISABY-RESTAURANT-KITCHEN-PLAN.md)
