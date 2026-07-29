# دليل المراسلات والربط — واتساب · إيميل · SMS · إدارة

**آخر تحديث:** 29 يوليو 2026  
**الحالة:** واتساب Cloud API **مفعّل حياً** على الإنتاج (`whatsappMode: live` · قالب `pos_receipt`) · الإيميل/SMS ما زالا اختياريين.  
**حادثة «تم الإرسال ولا يصل»:** [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md)

هذا الملف هو المرجع التشغيلي + التقني. واجهة مختصرة داخل المنتج: **`/integrations` → زر «اقرأني»**.

---

## 1) الخلاصة السريعة

| السؤال | الجواب |
|--------|--------|
| هل Hisaby يرسل واتساب تلقائياً؟ | **نعم** بعد ضبط Meta + قالب معتمد — بعد البيع/الإلغاء/الاسترداد ومن زر إعادة الإرسال |
| هل «تم الإرسال» = وصل للجوال؟ | **لا.** التوست الأخضر = Meta **قبلت** الطلب (`ok`). التسليم الحقيقي يظهر في WhatsApp Manager أو لاحقاً عبر webhook |
| ماذا بدون مفاتيح؟ | وضع `mock` أو تخطي — لا رسائل حقيقية |
| أين يُدار؟ | متغيرات Render + `/integrations` + إعدادات الحماية (أرقام المديرين) |
| كيف أتحقق بسرعة؟ | `GET /api/health` → `whatsappConfigured` / `whatsappMode` / `whatsappReceiptTemplate` |
| قالب الإيصال؟ | الاسم `pos_receipt` · لغة `ar` · **5 متغيرات** `{{1}}…{{5}}` — انظر §3 |

**تشخيص فوري إن ظهرت رسالة خضراء ولا يصل واتساب:** طابق القالب مع §3، تحقق من رقم العميل (`968…`)، واختبر من `/integrations`، ثم راجع [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md).

---

## 2) ماذا بُرمج؟ ولماذا؟

### الهدف المنتج
إشعارات تشغيلية **من الخادم** (server-side) بدون تدخل بشري بعد كل بيع/موافقة/بلاغ:
- العميل يستلم إيصالاً وروابط عرض/بلاغ
- المدير يستلم OTP وطلبات موافقة
- يقل الاعتماد على «مشاركة يدوية» من جهاز الكاشير

### المكوّنات (ملفات أساسية)

| المكوّن | الملف | الفائدة |
|---------|-------|---------|
| واتساب | `backend/src/notifications/whatsapp-notify.service.ts` | إرسال نص + رابط مستند عبر Meta Cloud API |
| إيميل | `backend/src/notifications/email-notify.service.ts` | Resend أو SMTP أو mock |
| SMS | `backend/src/notifications/sms-notify.service.ts` | Twilio أو mock |
| تنبيهات العميل | `backend/src/notifications/customer-notify.service.ts` | بعد بيع/إلغاء/استرداد POS + بلاغات عامة |
| OTP/موافقات | `backend/src/dual-control/dual-control.service.ts` | OTP واتساب للمديرين |
| واجهة API | `backend/src/notifications/messaging.controller.ts` | `status` / `readme` / `test` |
| واجهة المستخدم | `frontend/.../integrations/page.tsx` | حالة القنوات + اقرأني + اختبار إرسال |
| التخزين | `backend/src/storage/storage.service.ts` | مرفقات dataurl/local/S3 (اختياري للمستندات) |

### كيف يعمل التدفق (واتساب مثالاً)

```text
حدث POS (بيع / إلغاء / استرداد) أو «إعادة الإرسال الآن»
  → CustomerNotifyService.sendCustomerPosMessage
  → يبني نص الإيصال + رابط العرض + رابط البلاغ
  → WhatsappNotifyService.sendPosReceipt
      → يفضّل قالب pos_receipt (5 معاملات body + lang=ar)
      → إن فشل القالب: whatsapp=fail + whatsappError (نص Meta) — لا يُعرض نجاح زائف
  → Graph API: https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
  → يسجّل النتيجة على invoice.customFieldsJson.delivery
      (whatsapp, whatsappError, whatsappVia, whatsappMessageId, whatsappTo, …)
```

نفس الفكرة للإيميل/SMS إن كانت القناة مضبوطة ولدى العميل بريد/جوال.

**مهم:** قبول Graph API ≠ تسليم للجوال. عمود «الرسائل التي تم تسليمها» في مدير واتساب هو المؤشر الأقرب للوصول حتى يُضاف webhook.

---

## 3) واتساب — الاستخدام والإدارة

### الفائدة
- إيصال فوري للعميل
- OTP موافقات حساسة
- تنبيه عند طلب موافقة أو بلاغ مشبوه

### ما هو مضبوط / ما يتبقى
1. ✅ حساب Meta + توكن + Phone number ID على Render (وضع `live`)  
2. ✅ قالب `pos_receipt` ظاهر **نشط — جودة معلقة** في WhatsApp Manager  
3. ⚠️ طابق نص القالب مع المواصفات أدناه إن ظهرت أخطاء `#132000` / لا تسليم  
4. ☐ Webhook لحالات التسليم داخل Hisaby (مدرج في §7)  
5. ☐ إيميل (Resend/SMTP) و SMS (Twilio) اختياريان ما زالا `off` على الصحة الحية غالباً

دليل Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/  
قائمة تحقق التشغيل: §8 · حادثة التسليم: [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md)

### متغيرات البيئة (Render → hisaby-api → Environment)

```bash
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=...                 # أو mock للاختبار الداخلي فقط
WHATSAPP_PHONE_NUMBER_ID=...
# إلزامي لإيصال أول رسالة للعميل (خارج نافذة 24 ساعة):
WHATSAPP_RECEIPT_TEMPLATE=pos_receipt
WHATSAPP_RECEIPT_TEMPLATE_LANG=ar
# اختياري لإشعارات المطعم (إن لم يُضبط يُستخدم قالب الإيصال):
# WHATSAPP_GUEST_TEMPLATE=guest_notify
# WHATSAPP_GUEST_TEMPLATE_LANG=ar
# اختياري لـ OTP الموافقات (متغير {{1}} = الرمز) — وإلا نص حر داخل نافذة 24 ساعة:
# WHATSAPP_OTP_TEMPLATE=hisaby_otp
# WHATSAPP_OTP_TEMPLATE_LANG=en
```

**قالب الإيصال (Utility) — موضعّي `{{1}}…{{5}}` (الافتراضي في الكود):**

```
مرحباً {{1}}، إيصال من {{2}}. رقم الفاتورة: {{3}}. المبلغ: {{4}}. عرض الإيصال: {{5}}. شكراً لتعاملكم معنا.
```

**قالب OTP (Utility أو Authentication) — متغير واحد:**

```
رمز حسابي: {{1}}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.
```

ملاحظات مهمة:
- واجهة Meta قد تطلب أرقاماً `{{1}}` أو أسماء؛ الافتراضي في Hisaby موضعّي. للأسماء: `WHATSAPP_RECEIPT_PARAM_STYLE=named`.
- لا تكتب `Hello` ولا تضع متغيراً في آخر السطر بدون نص بعده.
- بعد الصق: اضغط «إضافة عينة» واملأ أمثلة لكل متغير ثم أرسل للمراجعة.
- الاسم: `pos_receipt` · اللغة: عربي · الفئة: أداة مساعدة (Utility).

بعد موافقة Meta ضع على Render:
`WHATSAPP_RECEIPT_TEMPLATE=pos_receipt` و `WHATSAPP_RECEIPT_TEMPLATE_LANG=ar`

للموافقات الحساسة (اختياري):
`WHATSAPP_OTP_TEMPLATE=hisaby_otp` و `WHATSAPP_OTP_TEMPLATE_LANG=en` (أو `ar`)

### أين يُرسل النظام تلقائياً؟
| القناة | الحدث |
|--------|--------|
| **كاشير** | بعد البيع / الإلغاء / الاسترداد · وزر «إعادة الإرسال الآن» (خادم فقط) |
| **محاسبة** | عند وضع الفاتورة `SENT` أو `PAID` (غير إيصالات POS) |
| **مطاعم** | طاولة جاهزة / تأكيد حجز / تذكير — نفس القالب أو `WHATSAPP_GUEST_TEMPLATE` |
| **موافقات** | Dual-control OTP عبر `sendOtp` (قالب إن وُجد، وإلا نص حر) |

بدون القالب المعتمد ستفشل الرسائل خارج نافذة 24 ساعة (رمز Meta شائع `#131047`). من الكاشير سيظهر الخطأ؛ المشاركة اليدوية عبر زر منفصل.

### استكشاف أعطال سريع («تم الإرسال» ولا يصل)

| فحص | ماذا تتوقع |
|------|------------|
| توست أخضر + آخر 4 أرقام | API قبلت الطلب لهذا الرقم — راجع واتساب Manager إن وصل فعلاً |
| توست أحمر مع `#132000` / `#132012` | القالب أو اللغة أو عدد المتغيرات غير مطابق — أصلح `pos_receipt` |
| توست أحمر `invalid phone` | صحّح رقم العميل (عُمان: `968` + محلي بدون 0) |
| مدير واتساب: تسليم فارغ للجودة المعلقة | إما لم يُرسل عبر هذا القالب بنجاح، أو التسليم لم يُحتسب بعد |
| Render logs: `WhatsApp template failed` | انسخ السطر كاملاً — فيه الاسم واللغة وعدد المعاملات ونص Meta |
| Render logs: `WhatsApp template accepted` + `id=wamid…` | القبول تم؛ إن لم يصل الهاتف راجع الرقم / حظر النشاط / حدود المراسلة |

### إدارة داخل Hisaby
1. `/integrations` — حالة القناة + زر اختبار (يُرسل القالب إن وُجد) + تحذير إن نقص القالب  
2. إعدادات الحماية / Dual-control — أرقام `whatsappNotifyPhones`  
3. `autoSendPosReceipts` — إيقاف/تشغيل إيصالات الكاشير التلقائية  
4. كاشير — «إعادة الإرسال الآن» يعيد استدعاء الخادم ويعرض خطأ Meta عند الفشل  

### الاستخدام اليومي (بعد الضبط)
- الكاشير يبيع كالمعتاد → الرسالة تذهب وحدها إن وُجد رقم صحيح  
- عند الحاجة لموافقة: إرسال OTP من شاشة الموافقة  
- اختبار يدوي: `/integrations` → إرسال اختبار  
- إن فشل القالب: لا تعتمد على المشاركة اليدوية وحدها لإصلاح الإعداد — أصلح القالب أولاً  

---

## 4) البريد الإلكتروني — الاستخدام والإدارة

### الفائدة
- نسخة إيصال للعميل على الإيميل  
- بديل/مكمّل لواتساب  
- مناسب للشركات التي تفضّل البريد للمستندات

### خيارات الربط
| الخيار | المتغيرات | متى تستخدمه |
|--------|-----------|-------------|
| **Resend** | `RESEND_API_KEY` + `EMAIL_FROM` | الأسرع للـ SaaS |
| **SMTP** | `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | بريد الشركة الحالي |
| **mock** | `EMAIL_MODE=mock` | تطوير بدون إرسال حقيقي — حالة التسليم في API تكون `mock` (ليست `ok`)؛ واجهة التكاملات تعرض «وضع اختبار» |

```bash
EMAIL_ENABLED=true
EMAIL_FROM=Hisaby <noreply@yourdomain.com>
RESEND_API_KEY=
# أو
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
```

**ملاحظة:** مسار SMTP يستخدم `nodemailer` ديناميكياً — إن لزم تثبيته على الخادم عند تفعيل SMTP.

### الإدارة
- نفس `/integrations`  
- `autoSendPosReceiptEmail` (افتراضي يعمل إن الإيميل مضبوط)  

---

## 5) SMS (Twilio) — اختياري

| الفائدة | وصول دون واتساب · تنبيه قصير |
| المتغيرات | `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_FROM` |
| اختبار | `TWILIO_MODE=mock` |

يُرسل مع إيصالات POS عند توفر رقم جوال (إلى جانب واتساب إن كان مفعّلاً).

---

## 6) واجهات API للمطورين

| Method | Path | الغرض |
|--------|------|--------|
| GET | `/messaging/status` | هل واتساب/إيميل/SMS مضبوطة؟ |
| GET | `/messaging/readme` | دليل عربي/إنجليزي للواجهة |
| POST | `/messaging/test` | اختبار قناة: `{ "channel":"whatsapp\|email\|sms", "to":"...", "body":"..." }` |

تتطلب تسجيل دخول JWT وصلاحية مناسبة.

---

## 7) ما الذي نحتاجه للتطوير المستقبلي؟

| بند | الأولوية | الفائدة |
|-----|----------|---------|
| ✅ ضبط Meta + توكن دائم | تم | واتساب إنتاجي `live` |
| ⚠️ طابق قالب `pos_receipt` + تحقق التسليم | عالية | إغلاق حادثة «تم الإرسال ولا يصل» |
| قالب OTP معتمد (`WHATSAPP_OTP_TEMPLATE`) | عالية | موافقات خارج نافذة 24 ساعة |
| Resend أو SMTP على الدومين | متوسطة | إيميلات موثوقة (SPF/DKIM) |
| Webhook وارد من Meta | عالية | `delivered` / `failed` / `read` داخل Hisaby |
| لوحة سجل رسائل داخل Hisaby | متوسطة | تدقيق بدون Render logs |
| مكوّن زر URL في `sendTemplate` إن لزم | متوسطة | قوالب بأزرار ديناميكية |
| إيقاف قنوات لكل شركة (ليس فقط env عام) | منخفضة | تعدد مستأجرين أدق |

---

## 8) قائمة تحقق تشغيل واتساب (الوضع الحالي)

1. [x] Business Portfolio + تطبيق WhatsApp على Meta  
2. [x] Token + Phone number ID على Render · `whatsappMode: live`  
3. [x] قالب `pos_receipt` بحالة Active (قد تظهر Quality Pending)  
4. [ ] نص القالب = 5 متغيرات مطابقة لـ Hisaby (انظر §3)  
5. [ ] اختبار من `/integrations` لرقم عليه واتساب فعلاً  
6. [ ] بيع/إعادة إرسال من الكاشير → وصول الرسالة أو خطأ Meta واضح  
7. [ ] عمود التسليم في WhatsApp Manager يبدأ بالارتفاع بعد إرسال ناجح عبر القالب  
8. [ ] (مستحسن) System User + Permanent token إن لم يكن دائماً بعد  
9. [ ] (لاحقاً) Webhook حالات التسليم  

مرجع الحادثة والإصلاح البرمجي: [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md)

---

## 9) أجزاء مرتبطة (موجزة)

| جزء | الفائدة | أين يُدار |
|-----|---------|-----------|
| OTA فاتورة إلكترونية | امتثال عُمان mock/sandbox/live | `/vat` |
| دفع شريك / Terminal | تحصيل بطاقة/محفظة | إعدادات بوابات + كاشير |
| S3 مرفقات | ملفات أكبر من data URL | `ATTACHMENT_STORAGE=s3` |
| AI HITL | اقتراحات بموافقة بشرية | `/ai-analytics` |
| أوفلاين POS | بيع بدون نت ثم مزامنة | كاشير + IndexedDB |
| Capacitor/BLE | غلاف جوال/طباعة | `mobile/` |

تفاصيل أوسع: [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md) · [`HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md`](./HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md)

---

## 10) الخطوة التالية المقترحة

1. **انشر** إصلاح صدق أخطاء واتساب (إن لم يُدفع بعد) على Render + Vercel.  
2. **طابق** قالب `pos_receipt` مع §3 واختبر من `/integrations` ثم الكاشير.  
3. إن ظهر خطأ Meta في التوست: أصلح القالب/اللغة/الرقم حسب الرمز.  
4. لاحقاً: Webhook تسليم + قالب OTP + إيميل/SMS إن لزم.

---

**للمشغّل غير التقني:**  
افتح المحاسبة → **الربط والإشعارات** (`/integrations`) → **اقرأني**.  
إن ظهر «تم الإرسال» ولا يصل الجوال: اقرأ [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md) ونفّذ قائمة التحقق هناك.
