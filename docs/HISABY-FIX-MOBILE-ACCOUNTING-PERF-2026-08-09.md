# بطء الكاشير والمطاعم والمحاسبة + المحاسبة لا تفتح على الهاتف

**التاريخ:** 9 أغسطس 2026  
**الحي:** API على `0384917` سابقاً · `redisConfigured: false` · cold start Render Free ما زال ممكناً

---

## 1) الأعراض

| التطبيق | المشكلة |
|---------|---------|
| كاشير | انتظار طويل قبل ظهور البيانات من السيرفر |
| مطاعم | نفس البطء خاصة أول فتح بعد خمول |
| محاسبة (كمبيوتر) | تفتح لكن تحميل القوائم/الإحصائيات بطيء |
| محاسبة (هاتف) | **لا تفتح** / تدور إلى ما لا نهاية أو شاشة بيضاء |

---

## 2) التشخيص

### أ) موبايل المحاسبة لا يفتح
1. **Service Worker قديم (`hisaby-shell-v2`)** كان يخزّن كل GET بما فيها `/backend-api` و `/_next`، وعند فشل الشبكة يعيد HTML بدل JSON → جلسة/تحطم/شاشة بيضاء.  
2. **بوابة `(dashboard)/layout`** كانت تنتظر `restoreSession` بلا مهلة (axios 60 ثانية) بينما صفحة الدخول لديها safety 10s فقط.  
3. على شبكة الجوال + cold API يبدو كأن «النظام لا يفتح».

### ب) بطء مشترك (الثلاثة)
1. **Render Free** + Redis **معطّل** (`posCatalogCache` / `dashboardCache` false).  
2. **Fan-out** طلبات عند الفتح (كاشير ~10+، محاسبة قائمة فواتير مع بنود، لوحة + modules).  
3. قائمة فواتير/مبيعات حديثة كانت تُرجع **payload ضخماً** (بنود + منتجات).

---

## 3) إصلاحات هذه الموجة

| إصلاح | الملفات |
|--------|---------|
| SW v3: لا يلمس API/`_next`/JS — تنظيف كاش v1/v2 | `frontend/public/sw.js`, `pwa-register.tsx` |
| مهلة 12s + زر إعادة محاولة/دخول على لوحة المحاسبة | `(dashboard)/layout.tsx` |
| `restoreSession` timeout 15s | `api.ts` |
| فواتير قائمة `light=1` بدون بنود | invoices service/controller/api + accounting-module |
| تأجيل contacts/cost/projects حتى فتح نموذج المحاسبة | accounting-module |
| رسم الإيراد dynamic + عدم انتظار modules لأول paint | dashboard page |
| POS: سياق المستودع أولاً، عملاء/انتظار لاحقاً | pos page |
| مبيعات حديثة بدون join منتج | pos.service listRecentSales |
| زر إغلاق القائمة على الموبايل | sidebar |

---

## 4) مطلوب منك بعد النشر

1. **Render Deploy Live** + **Vercel Ready**.  
2. على الهاتف (مرة واحدة):  
   - افتح الموقع → تطبيق → **مسح بيانات الموقع / Clear site data** أو أزل PWA ثم أعد الدخول  
   - أو Chrome → إعدادات الموقع → Storage → Clear  
   حتى يغادر SW القديم.  
3. اختبر: `/dashboard` و `/accounting` على الهاتف، `/pos` و `/resto` على الجهاز.  
4. **مستحسن بقوة:**  
   - تفعيل **`REDIS_URL`** على Render  
   - أو ترقية Render لخطة **لا تنام**

بدون Redis/always-on يبقى بعد الخمول انتظار 10–50 ثانية أحياناً — وليس بطء Prisma وحده.

---

## 5) تحقق سريع

```text
GET /api/health
→ commit جديد · redisConfigured (إن فعّلته)
```

شبكة المتصفح: فتح `/accounting` يجب ألا يبقى على spinner أكثر من ~12s بدون زر «إعادة المحاولة».
