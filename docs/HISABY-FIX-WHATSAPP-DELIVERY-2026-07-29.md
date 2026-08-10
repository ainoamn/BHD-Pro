# واتساب — «تم الإرسال» بدون وصول · تشخيص وإصلاح (29 يوليو 2026)

**آخر تحديث:** 29 يوليو 2026 · محدّث 10 أغسطس 2026 (`#200 — API access blocked`)  
**جاهزية + فجوات:** [`HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md`](./HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md)  
**خطأ Meta #200:** [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)  
**البيئة الحية:** API `hisaby-api.onrender.com` · واجهة `bhd-pro.vercel.app`  
**مرجع تشغيلي عام:** [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)

---

## 0) تحديث 10 أغسطس 2026 — الحادثة ما زالت مفتوحة

المشغّل يؤكد مجدداً: **بعد إصدار الفواتير والإيصالات لا يصل واتساب للجوال.**

**أحدث رسالة من الكاشير:**

```text
واتساب لم يُرسل من السيرفر: #200 — API access blocked.
```

| | |
|--|--|
| المعنى | Graph رفض الطلب — غالباً `WHATSAPP_TOKEN` بلا صلاحية واتساب أو System User غير مرتبط بـ WABA |
| الإغلاق | توكن Permanent جديد على Render — **ليس** نص القالب وحده |
| الدليل | [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md) |

يشمل أيضاً:
- إيصالات **الكاشير** (بيع / إعادة إرسال)
- فواتير **المحاسبة** عند التحويل إلى `SENT` أو `PAID` (توظّف نفس `notifyPosSale` + قالب `pos_receipt`)

قائمة الإغلاق الموحّدة: [`HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md`](./HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md) §4.

---

## 1) الأعراض (ما رآه المشغّل — يوليو 2026 وما بعده)

| مصدر | ما ظهر |
|------|--------|
| كاشير `/pos` | إشعار أخضر: **«تم إرسال الإيصال عبر واتساب»** بعد «إعادة الإرسال الآن» على `CN-2026-0001` |
| Meta WhatsApp Manager | قالب `pos_receipt` · فئة Utility · لغة عربي · حالة **نشط — جودة معلقة** |
| Meta — عمود التسليم | **الرسائل التي تم تسليمها** و**معدل القراءة** فارغان (نقاط `.`) |
| Meta — تحت اللغة | نص يشبه **error 404** بجانب صف `pos_receipt` (غالباً فشل معاينة/عينة في واجهة Meta) |
| هاتف المستلم | **لا رسالة واتساب** |
| صحة API | `whatsappConfigured: true` · `whatsappMode: "live"` · `whatsappReceiptTemplate: "pos_receipt"` |

**الخلاصة:** الربط مع Meta مفعّل، والواجهة تعتبر الطلب ناجحاً، لكن التسليم للهاتف غير مؤكد / غير حاصل.

---

## 2) المعنى الصحيح لحالات النظام

| الحالة | المعنى الحقيقي |
|--------|----------------|
| توست أخضر في Hisaby (`whatsapp: "ok"`) | Meta **قبلت** طلب Graph API (HTTP 2xx + غالباً `wamid`) — **ليس** تأكيداً بالوصول للجوال |
| `whatsapp: "fail"` + `whatsappError` | رفض Meta أو رقم غير صالح أو قالب خاطئ — يظهر نص الخطأ |
| `whatsapp: "mock"` | وضع اختبار — لم يُرسل للعميل |
| عمود «تم التسليم» في Meta Manager | إحصاءات تسليم القالب؛ فارغ = لا تسليم مسجّل لهذا القالب بعد |
| Quality Pending | القالب **معتمد وقابل للإرسال**؛ الجودة قيد القياس — لا يمنع الإرسال وحده |

```text
كاشير → POST resendSaleNotify
  → CustomerNotifyService.sendCustomerPosMessage
  → WhatsappNotifyService.sendPosReceipt
      → sendTemplate(pos_receipt, 5 body params, lang=ar)
      → إن نجح: ok + via=template (+ messageId)
      → إن فشل القالب: ok=false + whatsappError (نص Meta)  ← بعد إصلاح 2026-07-29
  → يُحفظ على invoice.customFieldsJson.delivery
  → الواجهة تعرض ok / fail حسب delivery.whatsapp
```

---

## 3) الأسباب الأرجح (مرتّبة)

1. **عدم تطابق قالب `pos_receipt` مع ما يرسله Hisaby**  
   الكود يرسل **5 معاملات نصية للـ body** (موضعية `{{1}}…{{5}}` افتراضياً).  
   أي اختلاف في العدد، أو أزرار URL ديناميكية بدون مكوّن زر في الطلب، أو لغة غير `ar`، يسبب رفض Meta (`#132000` / `#132001` / `#132012` …).

2. **رقم العميل على الفاتورة/الإشعار**  
   يجب أن يُطبَّع إلى E.164 (عُمان: `968` + الرقم المحلي بدون صفر بادئ). رقم غير واتساب أو ناقص رمز الدولة → قبول API أحياناً ثم فشل تسليم، أو فشل فوري.

3. **خلط «نجاح الجلسة» مع «نجاح القالب» (سلوك قديم أُصلِح)**  
   قبل الإصلاح: إذا فشل القالب وكان الرقم داخل نافذة 24 ساعة، قد ينجح إرسال نص/مستند جلسة فيُعرض توست أخضر بينما إحصاءات القالب تبقى فارغة.

4. **معاينة Meta بخطأ 404**  
   غالباً مشكلة عينة ميديا/معاينة في واجهة القالب — يُفضّل فتح القالب والتحقق من النص والعينات يدوياً.

5. **ما زال مفتوحاً لاحقاً:** لا يوجد بعد webhook لحالات `delivered` / `failed` داخل Hisaby — الاعتماد على قبول API + سجلات Render + مدير واتساب.

---

## 4) مواصفات القالب المطلوبة (إلزامي)

| حقل | قيمة |
|-----|------|
| الاسم | `pos_receipt` (حرف صغير، مطابق لـ `WHATSAPP_RECEIPT_TEMPLATE`) |
| اللغة | عربي → رمز Graph: **`ar`** (`WHATSAPP_RECEIPT_TEMPLATE_LANG=ar`) |
| الفئة | Utility / أداة مساعدة |
| نمط المتغيرات | **موضعّي** افتراضياً |

**نص الجسم المقترح:**

```text
مرحباً {{1}}، إيصال من {{2}}. رقم الفاتورة: {{3}}. المبلغ: {{4}}. عرض الإيصال: {{5}}. شكراً لتعاملكم معنا.
```

| متغير | المحتوى من Hisaby |
|-------|-------------------|
| `{{1}}` | اسم العميل |
| `{{2}}` | اسم الشركة |
| `{{3}}` | رقم الفاتورة / الإشعار |
| `{{4}}` | المبلغ منسّق |
| `{{5}}` | رابط عرض الإيصال |

**إن أنشأت القالب بأسماء (named) في واجهة Meta الجديدة:**

```bash
WHATSAPP_RECEIPT_PARAM_STYLE=named
# اختياري — وإلا الأسماء الافتراضية في الكود:
# WHATSAPP_RECEIPT_PARAM_NAMES=customer_name,company_name,invoice_number,amount,receipt_url
```

**تحذيرات Meta الشائعة عند إنشاء القالب:** لا تبدأ بـ Hello فقط؛ لا تختم سطراً بمتغير بلا نص بعده؛ املأ «عينات» لكل متغير قبل الإرسال للمراجعة.

---

## 5) متغيرات Render (الإنتاج الحالي المتوقع)

```bash
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=<permanent System User token>
WHATSAPP_PHONE_NUMBER_ID=<id>
WHATSAPP_RECEIPT_TEMPLATE=pos_receipt
WHATSAPP_RECEIPT_TEMPLATE_LANG=ar
# اختياري:
# WHATSAPP_RECEIPT_PARAM_STYLE=named
# WHATSAPP_OTP_TEMPLATE=...
# WHATSAPP_GUEST_TEMPLATE=...
```

تحقق سريع:

```text
GET https://hisaby-api.onrender.com/api/health
→ whatsappConfigured, whatsappMode, whatsappReceiptTemplate
```

---

## 6) ما تغيّر في الكود (إصلاح صدق الأخطاء)

| ملف | التغيير |
|-----|---------|
| `backend/.../whatsapp-notify.service.ts` | تسجيل `messageId` · إخفاء الرقم في اللوجات · **فشل القالب = فشل صريح** (بدون اعتبار نجاح جلسة 24س نجاح إيصال كامل) · لوج أوضح: اسم القالب / اللغة / عدد المعاملات |
| `backend/.../customer-notify.service.ts` | حفظ `whatsappVia` · `whatsappMessageId` · `whatsappTo` (آخر 4 أرقام) · `receiptTemplateLang` في `delivery` |
| `frontend/.../pos/page.tsx` | توست النجاح يعرض الرقم المقنّع؛ عند الفشل يعرض **نص خطأ Meta** (وليس نجاحاً زائفاً) |
| `frontend/.../pos-copy.ts` | نص `shareWhatsAppTemplateMismatch` عربي/إنجليزي |

### حقول `invoice.customFieldsJson.delivery` بعد الإرسال

| حقل | مثال |
|-----|------|
| `whatsapp` | `ok` \| `fail` \| `mock` \| `skipped` |
| `whatsappError` | `#132000 — …` عند الفشل |
| `whatsappVia` | `template` \| `text` |
| `whatsappMessageId` | `wamid.…` إن وُجد |
| `whatsappTo` | `********1234` |
| `receiptTemplate` | `pos_receipt` |
| `receiptTemplateLang` | `ar` |
| `email` / `sms` | حالات القنوات الأخرى |
| `kind` / `at` | نوع الحدث + وقت |

---

## 7) قائمة تحقق للمشغّل (بعد ظهور الخطأ الحقيقي)

1. [ ] افتح قالب `pos_receipt` في Meta وطابق **5 متغيرات** والنص أعلاه.  
2. [ ] تأكد أن اللغة المعتمدة رمزها **`ar`** ويطابق Render.  
3. [ ] تأكد أن رقم العميل على البيع بصيغة دولية صحيحة (عُمان `968…`).  
4. [ ] من Hisaby → **`/integrations`** → اختبار واتساب لنفس الرقم.  
5. [ ] من الكاشير → بيع/إعادة إرسال → اقرأ رسالة الخطأ إن ظهرت (انسخ `#xxxxx`).  
6. [ ] في Render Logs ابحث عن: `WhatsApp template failed` أو `WhatsApp template accepted`.  
7. [ ] في WhatsApp Manager راقب عمود التسليم بعد إرسال ناجح عبر القالب.  
8. [ ] إن استمر القبول بدون وصول: راجع حالة الرقم التجاري، حدود المراسلة، وحظر المستلم للنشاط التجاري.

---

## 8) رموز Meta شائعة

| رمز | معنى تقريبي |
|-----|----------------|
| `#131047` | خارج نافذة 24 ساعة بدون قالب مناسب |
| `#132000` / `#132001` | عدد/شكل معاملات القالب غير مطابق |
| `#132012` | لغة القالب غير موجودة / غير مطابقة |
| `#133010` | القالب غير متاح / غير معتمد للإرسال |
| `#131026` | رقم المستلم غير صالح على واتساب |

---

## 9) ما لم يُنفَّذ بعد (فجوات موثّقة)

| فجوة | الفائدة |
|------|---------|
| Webhook وارد لحالات `sent` / `delivered` / `failed` / `read` | صدق التسليم داخل Hisaby بدل «قبول API» فقط |
| لوحة سجل رسائل | تشخيص بدون Render logs |
| مكوّنات زر URL في `sendTemplate` إن وُجد زر ديناميكي في القالب | دعم قوالب بأزرار |

---

## 10) نشر هذا الإصلاح

1. دمج/دفع التغييرات على `main`.  
2. انتظار Deploy Live لـ Render `hisaby-api` + Ready لـ Vercel.  
3. تأكيد `/api/health` على commit جديد.  
4. إعادة اختبار «إعادة الإرسال الآن» وقراءة الخطأ أو الرقم المقنّع في التوست.

---

**للمشغّل غير التقني:** التوست الأخضر القديم كان يعني «السيرفر قال إن Meta قبلت الطلب». بعد هذا الإصلاح، إن كان القالب أو الرقم غلطاً ستظهر رسالة خطأ واضحة بدل الإحساس الزائف بالوصول.
