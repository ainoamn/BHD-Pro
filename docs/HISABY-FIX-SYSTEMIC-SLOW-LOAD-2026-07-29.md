# بطء شامل (>30 ثانية) — محاسبة + كاشير + مطاعم

**التاريخ:** 29 يوليو 2026

## التشخيص

أوقات تحميل >30 ثانية عبر **كل** التطبيقات تشير غالباً إلى:

1. **إسبات Render Free (cold start)** — 10–50 ثانية قبل أول رد من الـ API  
2. **Render لم يكن ينشر أحدث commits** — الصحة أعادت `commit: 7df7258` بينما `main` تجاوزه (مثلاً `8437402`)  
3. شلال تحميل: جلسة → بوابة صيانة → اشتراك ثقيل → قوائم فواتير بلا حد  
4. لوحة التحكم تعيد حساب الإحصائيات كل مرة بدون Redis، مع كتابة إصلاحية قبل القراءة  

## إصلاحات هذه الموجة

| إصلاح | الملف |
|--------|--------|
| Keep-warm كل **5 دقائق** | `.github/workflows/keep-warm.yml` |
| `wakeApi()` عند فتح المحاسبة/كاشير/مطاعم | layouts / shells |
| MaintenanceGate **لا تحجب** الواجهة | `maintenance-gate.tsx` |
| اشتراك `light=1` + modules في الشريط واللوحة | sidebar + dashboard + subscription light |
| قائمة فواتير محدودة `take=80` | invoices service/controller/api |
| إحصائيات فواتير بدون انتظار sync | invoices.getStats |
| كاش ذاكرة 30s للوحة بدون Redis + إصلاح مدفوعات بالخلفية | dashboard.service |

## مطلوب تشغيلياً (حرج)

1. من لوحة **Render** → Manual Deploy لأحدث `main` وتأكد أن `/api/health` يظهر commit جديد  
2. فعّل سر GitHub `API_HEALTH_URL` إن لم يكن مضبوطاً لـ keep-warm  
3. **مستحسن بشدة:** ترقية Render لخطة لا تنام، أو تفعيل **Redis** (`REDIS_URL`) لكاش اللوحة/الكاشير  
4. تأكد أن `DATABASE_URL` على Render هو رابط Neon **pooler**  

بدون إعادة نشر Render، إصلاحات الكود لن تظهر في الإنتاج.
