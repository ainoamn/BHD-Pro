# إصلاح React #310 — انهيار /pos و /resto

**التاريخ:** 29 يوليو 2026

## العَرَض

`Application error: a client-side exception has occurred` على `/pos` و`/resto`.
الكونسول: **Minified React error #310** (Rendered more hooks than during the previous render).

## السبب

في `RestoShell` و`PosShell` كان `useEffect` (إعادة التوجيه عند نقص الصلاحية) يُستدعى **بعد** `return` مبكر (`!hydrated` / login / bareShell). عند اكتمال الـ hydration يزيد عدد الـ hooks → انهيار.

## الإصلاح

نقل حساب `blockedByPerm` و`useEffect` المرتبط به **قبل** أي `return` شرطي.

## تحقق

- بناء الواجهة ناجح
- Playwright على الإنتاج بعد نشر Vercel: لا يظهر الخطأ #310
