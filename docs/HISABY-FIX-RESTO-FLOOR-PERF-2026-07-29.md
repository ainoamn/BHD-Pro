# تسريع تحميل صفحات المطاعم

**التاريخ:** 29 يوليو 2026  
**المسار:** `/resto` وما يتفرع منه

## العَرَض

صفحة الصالة على [bhd-pro.vercel.app/resto](https://bhd-pro.vercel.app/resto) تتأخر كثيراً حتى تظهر الطاولات والبيانات.

## الأسباب

1. `GET /resto/floor` كان يجلب **كل بنود** الطلبات المفتوحة داخل كل طاولة (nested items).
2. عند فتح `/resto` كانت الواجهة تطلق ~7–8 طلبات معاً: floor + staff + stations + modifiers + link-status مكرر + اشتراك ثقيل + وردية.
3. كل إجراء على الطلب يعيد `loadFloor` مع شاشة تحميل كاملة.
4. `GET /subscriptions/current` يعد فواتير الشهر وكل المستخدمين فقط لفحص `features.resto`.

## الإصلاحات

| الطبقة | التغيير |
|--------|---------|
| Backend `getFloor` | طاولات + طلبات مفتوحة بدون nested items؛ مجاميع البنود في استعلام واحد |
| Backend `getMenu` | حد 120 بدل 500؛ 86/مسارات/وصفات بالتوازي |
| Backend subscription | `?light=1` — features فقط للشل |
| Frontend floor | تأجيل staff/stations/modifiers حتى فتح طلب؛ بدون link-status مكرر؛ تحديث صامت بعد الإجراءات |
| Shell | اشتراك خفيف + حفظ `warehouseId` في sessionStorage |

## نشر

1. **Render** — إعادة نشر API (ضروري لـ getFloor الخفيف).
2. **Vercel** — نشر الواجهة من `main`.
3. تحديث قوي للمتصفح.

## تحقق

- فتح `/resto`: خريطة الطاولات تظهر أسرع.
- فتح طاولة: القائمة/المعدّلات تُحمَّل عند الحاجة فقط.
- إرسال أصناف للمطبخ: لا وميض تحميل كامل للصالة.
