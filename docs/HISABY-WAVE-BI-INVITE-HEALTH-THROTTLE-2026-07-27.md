# موجة BI — صدق الدعوات + صحة البريد + throttles + UX خفيف

**التاريخ:** 27 يوليو 2026  
**بعد:** Wave BH (إغلاق مستودع الموظف)

## ما أُكمل

| البند | التفاصيل |
|-------|----------|
| دعوة مستخدم | `emailSent` / `emailError` + نسخ رابط الدعوة إن فشل البريد |
| رابط الدعوة | يفضّل `FRONTEND_URL` أولاً |
| `/api/health` | `emailConfigured` + `emailMode` |
| Throttles | `GET /auth/invite/:token` · حفظ/إرسال تقارير المدير |
| POS ربط | نسخ المفتاح بترجمة عربية/إنجليزية |
| مستخدمون | ألوان متوافقة مع الوضع الفاتح في الحقول/الجدول |

## تحقق سريع

- `/api/health` → `"emailConfigured": true|false`
- إنشاء مستخدم بدون بريد مضبوط → تحذير + رابط منسوخ

**متابعة:** [`HISABY-WAVE-BJ-LIGHT-HEALTH-PUBLIC-THROTTLE-2026-07-27.md`](./HISABY-WAVE-BJ-LIGHT-HEALTH-PUBLIC-THROTTLE-2026-07-27.md)
