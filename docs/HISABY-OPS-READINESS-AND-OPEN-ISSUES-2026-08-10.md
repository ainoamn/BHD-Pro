# حالة جاهزية Hisaby للإنتاج — ملاحظات مفتوحة (10 أغسطس 2026)

**التاريخ:** 10 أغسطس 2026  
**المستودع:** https://github.com/ainoamn/BHD-Pro · الفرع `main`  
**واجهة:** https://bhd-pro.vercel.app  
**API:** https://hisaby-api.onrender.com  

**مرتبط:**  
- واتساب (تفاصيل تقنية): [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md)  
- **Meta `#200` API access blocked:** [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)  
- دليل المراسلات: [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)  
- بطء اللوحة: [`HISABY-FIX-DASHBOARD-SLOW-PAINT-2026-08-10.md`](./HISABY-FIX-DASHBOARD-SLOW-PAINT-2026-08-10.md)  
- موبايل المحاسبة: [`HISABY-FIX-MOBILE-ACCOUNTING-PERF-2026-08-09.md`](./HISABY-FIX-MOBILE-ACCOUNTING-PERF-2026-08-09.md)

---

## 1) الخلاصة للمالك / المشغّل

| السؤال | الجواب |
|--------|--------|
| هل البرنامج قابل للاستخدام؟ | **نعم** — بيع كاشير، محاسبة، مطاعم، دخول وإدارة شركة |
| هل هو «جاهز 100% بلا أي مشاكل تقنية»؟ | **لا** |
| التصنيف الحالي | **إنتاج شبه جاهز / تجريبي-تشغيلي** — يعمل مع فجوات معروفة |
| أهم عائق تشغيل الآن | **نشر API متأخر** + **واتساب لا يصل للهاتف** بعد الفواتير/الإيصالات + **بدون Redis** |

---

## 2) لقطة الصحة الحية (وقت التدوين)

فحص `GET /api/health` و `/api/health/ready` في **10 أغسطس 2026 ~16:40 بتوقيت عُمان**:

| حقل | القيمة |
|-----|--------|
| `status` | `ok` / DB `ready` |
| `commit` الحي | **`0384917…`** |
| أحدث `main` عند التدوين | **`392f2a3`** (لوحة أسرع + إصلاحات موبايل/واتساب سابقة) |
| `redisConfigured` | **`false`** |
| `posCatalogCache` / `dashboardCache` | **معطّل** |
| `whatsappConfigured` / `whatsappMode` | **`true` / `live`** |
| `whatsappReceiptTemplate` | **`pos_receipt`** |
| `whatsappOtpTemplate` | `null` |
| `emailConfigured` / `smsConfigured` | **`false` / off** |
| `s3Configured` / `sentry` | **`false`** |
| `attachmentStorage` | `dataurl` |

**استنتاج:** السيرفر **لا يشغّل أحدث كود `main`**. إصلاحات السرعة/الموبايل/صدق أخطاء واتساب قد **لا تظهر** للمستخدم حتى Deploy Live على Render (و Ready على Vercel للواجهة).

---

## 3) ملاحظات الجاهزية (ما ذكر في التقييم)

### 3.1 جاهز للاستخدام (مع مراقبة)
- تسجيل الدخول والجلسات
- الكاشير (بيع / وردية / مخزون أساسي)
- المحاسبة (فواتير، قيود، لوحة — مع بطء محتمل)
- المطاعم (صالة / مطبخ — مع بطء محتمل بعد خمول)
- الربط الأساسي مع Meta WhatsApp من جهة **الإرسال المقبول API**

### 3.2 غير جاهز / ناقص / فيه مخاطرة

| # | المشكلة | الأثر على المستخدم | الأولوية |
|---|---------|-------------------|----------|
| 1 | **نشر API/واجهة متأخر عن `main`** | إصلاحات لا تصل للإنتاج | حرجة |
| 2 | **واتساب لا يصل للجوال** بعد إصدار فواتير/إيصالات (كاشير ومحاسبة) | العميل لا يستلم المستند | حرجة |
| 3 | **Redis غير مفعّل** | بطء تكرار + لا كاش كتالوج/لوحة مشترك | عالية |
| 4 | **Cold start (Render Free)** بعد الخمول | انتظار 10–50ث أول طلب | عالية |
| 5 | **إيميل / SMS غير مفعّلين** | لا بديل للإيصال | متوسطة |
| 6 | **لا قالب OTP واتساب** | موافقات Dual-control قد تفشل خارج نافذة 24 ساعة | متوسطة |
| 7 | **لا webhook لحالة التسليم** (`delivered` / `failed`) | «تم الإرسال» لا يعني وصل | متوسطة |
| 8 | **S3 مرفقات + Sentry** غير مفعّلين | ملفات كبيرة / مراقبة أخطاء محدودة | منخفضة–متوسطة |
| 9 | **اختبار تشغيل يوم كامل** غير مكتمل رسمياً | باقات/تقارير/مخزون/OTA قد تكشف باجات | مستمرة |

---

## 4) واتساب — ما زال لا يصل بعد الفواتير والإيصالات

### 4.0 تحديث الكود 10 أغسطس 2026
إصلاحات أُضيفت في [`HISABY-FIX-WA-POS-RESTO-SPEED-2026-08-10.md`](./HISABY-FIX-WA-POS-RESTO-SPEED-2026-08-10.md):
- إعادة محاولة قالب (لغات + named/positional)
- تعقيم متغيرات الجسم
- اختبار التكاملات = مسار `sendPosReceipt` الحقيقي

**ما زال حرجاً:** Deploy Render + مطابقة قالب Meta `pos_receipt` يدوياً.

### 4.1 تأكيد الحالة (تذكير المشغّل — 10 أغسطس 2026)
- بعد **إصدار الفاتورة** و**إيصال الكاشير**: غالباً **لا تصل** رسالة واتساب للجوال.
- **لقطة إنتاج (كاشير):**  
  `واتساب لم يُرسل من السيرفر: #200 — API access blocked.`  
  → Meta رفضت وصول API (توكن/صلاحيات). الدليل الكامل:  
  [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)
- في WhatsApp Manager سابقاً: قالب `pos_receipt` **نشط — جودة معلقة**، عمود التسليم فارغ.
- الصحة الحية: `whatsappMode: live` + `WHATSAPP_RECEIPT_TEMPLATE=pos_receipt`.

### 4.2 أين يُفترض أن يُرسل النظام؟

| الحدث | المسار في الكود |
|-------|-----------------|
| بيع كاشير (تلقائي إن لم يُعطَّل) | `PosService` → `CustomerNotifyService.notifyPosSale` → `sendPosReceipt` |
| إعادة إرسال من الكاشير | `POST /pos/sales/:id/notify` → `resendPosSaleNotify` |
| فاتورة محاسبة عند `SENT` أو `PAID` (غير POS) | `InvoicesService.updateStatus` → `notifyPosSale` (نفس قناة الإيصال) |
| إلغاء / استرداد POS | `notifyPosVoid` / `notifyPosRefund` (نفس قالب الإيصال غالباً) |

القالب المُرسل (افتراضي موضعّي، 5 متغيرات، لغة `ar`):

```text
{{1}} اسم العميل
{{2}} اسم الشركة
{{3}} رقم الفاتورة/الإيصال
{{4}} المبلغ
{{5}} رابط العرض
```

متغيرات Render المتوقعة:

```bash
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_RECEIPT_TEMPLATE=pos_receipt
WHATSAPP_RECEIPT_TEMPLATE_LANG=ar
```

### 4.3 أسباب محتملة لاستمرار «لا يصل» (مرتّبة)

0. **`#200 — API access blocked`** — التوكن بلا صلاحية واتساب أو System User غير مربوط بـ WABA (إغلاق على Meta + `WHATSAPP_TOKEN`، ليس القالب).  
1. **عدم تطابق قالب Meta `pos_receipt`** مع 5 متغيرات / اللغة `ar` / أزرار URL بدون معاملات زر.  
2. **رقم العميل** بدون `968` أو ليس عليه واتساب أو خاطئ على جهة الاتصال.  
3. **«تم الإرسال» = قبول Graph API** وليس تسليم الهاتف (لا webhook بعد).  
4. **صيغة named مقابل positional** — إن وُجدت أسماء في Meta تحتاج `WHATSAPP_RECEIPT_PARAM_STYLE=named`.  
5. **جودة/حدود/حظر** على رقم الأعمال في Meta (أقل شيوعاً بعد Accept).  
6. **تعطيل الإرسال التلقائي** في إعدادات الشركة: `autoSendPosReceipts === false` (اختَبر من `/integrations` أو زر إعادة الإرسال).  
7. **كود إصلاح الأخطاء لم يُنشر** على Render — الحي على commit قديم.

### 4.4 قائمة تحقق لإغلاق حادثة واتساب

- [ ] إن ظهر `#200` / `API access blocked`: اتبع [`HISABY-WHATSAPP-META-200-…`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md) (توكن Permanent + scopes).  
- [ ] Deploy Render + Vercel لأحدث `main`؛ صحة API تظهر commit الحديث.  
- [ ] فتح `pos_receipt` في Meta ومطابقة نص الجسم مع 5 متغيرات (انظر دليل المراسلات §3).  
- [ ] اختبار من Hisaby **`/integrations`** إلى **رقمك** بصيغة `968xxxxxxxx`.  
- [ ] بيع كاشير بعميل برقمك → راقب Render logs:  
  - `WhatsApp template accepted … id=wamid…` = قبول  
  - `WhatsApp template failed … #…` = اقرأ الرمز وأصلح (توكن أو قالب)  
- [ ] فاتورة محاسبة: غيّر الحالة إلى `SENT` أو `PAID` لعميل برقمك.  
- [ ] راقب WhatsApp Manager → عمود التسليم للقالب.  
- [ ] لاحقاً: webhook لحالات `failed`/`delivered` داخل المنتج.

تفاصيل أعمق وأخطاء Meta الشائعة:  
[`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md) ·  
[`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)

---

## 5) الشروط الدنيا لاعتبار «جاهز للاستخدام اليومي»

1. [ ] `GET /api/health` → `commit` = أحدث `main` (ليس أقدم بأشواط).  
2. [ ] Vercel على نفس المستوى (أو أحدث واجهة متوافقة).  
3. [ ] `REDIS_URL` مفعّل **أو** Render لا ينام (خطة always-on).  
4. [ ] واتساب: وصول حقيقي على جوال تجريبي بعد فاتورة + إيصال كاشير.  
5. [ ] اختبار يوم عمل: بيع → إلغاء/استرداد → فاتورة SENT/PAID → طاولة مطعم → طباعة.  
6. [ ] (مستحسن) إيميل أو SMS كمسار بديل للإيصال.

---

## 6) إجراءات فورية مقترحة (ترتيب)

1. **Render Manual Deploy** من `main` → تحقق commit.  
2. **مسح كاش PWA** على الهواتف التي «لا تفتح المحاسبة».  
3. **إغلاق واتساب:** طابق القالب + اختبار `/integrations` + رقم `968…`.  
4. **Redis** على Render.  
5. وثّق نتيجة الاختبار هنا أو في ticket داخلي (وصل / لم يصل + أي `#` خطأ من Meta).

---

## 7) ما ليس ادعاءً في هذا الملف

- لا يُزعم خلو النظام من كل الأخطاء.
- لا يُزعم اكتمال كل تقارير/OTA/SoftPOS/التحليلات دون اختباركم التشغيلي.
- «الوضع ok في health» ≠ «الميزة وصلت للعميل النهائي».

---

**آخر تحديث:** 10 أغسطس 2026 — بعد تقييم الجاهزية وتأكيد استمرار عدم وصول واتساب للفواتير والإيصالات.
