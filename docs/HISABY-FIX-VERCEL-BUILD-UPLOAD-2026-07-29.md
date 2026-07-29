# إصلاح إنتاج — فشل نشر Vercel + رفع الملفات (29 يوليو 2026)

## الأعراض

- نشرات `main` على Vercel تفشل (Error) منذ عدة commits
- `/pos` و`/resto` على الإنتاج تظهر: Application error: a client-side exception…
- رفع المرفقات / شعار الشركة يفشل

## الأسباب

1. **بناء الواجهة:** `toast.message(...)` في صفحات السفري/التوصيل — غير موجود في `react-hot-toast` → فشل TypeScript أثناء `next build`.
2. **الإنتاج عالق:** آخر نشر ناجح قديم بينما الـ API على Render يتقدّم → واجهة قديمة + استثناءات وقت التشغيل.
3. **الرفع:** جسم JSON الافتراضي في Nest ~100KB بينما الشعار/المرفقات تُرسل كـ data URL حتى ~2.8MB.

## الإصلاح

| ملف | ماذا |
|-----|------|
| `takeaway/page.tsx` · `delivery/page.tsx` | `toast(...)` بدل `toast.message` |
| `backend/src/main.ts` | `useBodyParser` بحد `4mb` مع الإبقاء على `rawBody` |

## تحقق

- `npm run build` في `frontend` ينجح محلياً
- بعد الدفع: انتظر نشر Vercel Ready ثم حدّث `/pos`
- على Render أعد نشر الـ API لحد الرفع
