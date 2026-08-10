# نشر الإنتاج — Render متوقف على commit قديم (محدث 10 أغسطس 2026)

## الحالة المرصودة الآن

| مكوّن | المتوقع | الحي حالياً |
|--------|---------|-------------|
| GitHub `main` | `e0b8df8` (+ إصلاحات لاحقة) | مرفوع |
| Vercel واجهة | أحدث `main` | عادة يتحدّث تلقائياً |
| **Render `hisaby-api`** | نفس SHA | **`0384917` ما زال — لم ينشر** |
| Redis | مفعّل مستحسن | **`false`** |

`GET https://hisaby-api.onrender.com/api/health` يعيد:

```json
"commit": "03849173bc4cbc677e247a54db7252c0b3b48cd6",
"redisConfigured": false
```

بدون Manual Deploy على Render:

- لا تصل إصلاحات واتساب / كاشير / مطاعم / لوحة التحكم إلى الزبائن  
- تبقى البطء ومشاكل الإرسال كما هي على الإنتاج  

لا يوجد مفتاح Render Deploy Hook في هذا المستودع ليقوم الوكيل بالنشر نيابة عنك.

---

## ماذا تفعل الآن (إجبارياً)

1. افتح [Render Dashboard](https://dashboard.render.com) → خدمة **`hisaby-api`**.  
2. **Manual Deploy** → **Deploy latest commit** من فرع **`main`**.  
3. انتظر **Live** (ليس Build failed).  
4. تحقق:

```bash
curl -s https://hisaby-api.onrender.com/api/health
```

يجب أن يبدأ `commit` بـ SHA حديث (مثل `e0b8df8` أو أحدث)، **وليس** `0384917`.

5. (مستحسن) Environment → أضف **`REDIS_URL`** إن وُجد Redis.  
6. حدّث الواجهة على `bhd-pro.vercel.app` بقوة (`Ctrl+Shift+R`)؛ على الجوال امسح بيانات الموقع مرة إذا كان PWA.

---

## بعد النشر — قبول سريع

| فحص | نتيجة متوقعة |
|------|----------------|
| `/api/health` commit جديد | نعم |
| `/pos` آخر المبيعات | تظهر في ثوانٍ (API دافئ) |
| `/resto` الصالة | كاش + تحديث أسرع من 30ث |
| `/integrations` اختبار واتساب | `ok` + `messageId` أو خطأ Meta واضح |
| جوال العميل | رسالة قالب إن وصل القبول والتسليم |

---

## ملاحظات

- مكرّر منذ يوليو 2026: Render auto-deploy غالباً **معطّل أو مقطوع**.  
- الواجهة على Vercel وحدها **لا تكفي** — معظم المنطق في `hisaby-api`.  
- وثائق ذات صلة:  
  - [`HISABY-FIX-WA-POS-RESTO-SPEED-2026-08-10.md`](./HISABY-FIX-WA-POS-RESTO-SPEED-2026-08-10.md)  
  - [`HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md`](./HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md)  
  - [`PRODUCTION-VERIFICATION-2026-07-30.md`](./PRODUCTION-VERIFICATION-2026-07-30.md)
