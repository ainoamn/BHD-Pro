# دليل المراسلات والربط — واتساب · إيميل · SMS · إدارة

**آخر تحديث:** 27 يوليو 2026  
**الحالة:** الكود جاهز ومرفوع على `main` · الربط الحقيقي (Meta / Resend / Twilio) **مؤجّل تشغيلياً** حتى يتوفر وقتك لضبط الحسابات.

هذا الملف هو المرجع التشغيلي + التقني. واجهة مختصرة داخل المنتج: **`/integrations` → زر «اقرأني»**.

---

## 1) الخلاصة السريعة

| السؤال | الجواب |
|--------|--------|
| هل Hisaby يرسل واتساب تلقائياً؟ | **نعم بعد ضبط Meta** — بدون ضغط زر لكل رسالة |
| هل يحتاج اشتراك الآن؟ | **لا لتجربة المنتج** · نعم لاحقاً لحساب Meta Business + (اختياري) Resend/SMTP و Twilio |
| ماذا يفعل النظام اليوم بدون مفاتيح؟ | وضع `mock` أو تخطي الإرسال — لا رسائل حقيقية |
| أين يُدار؟ | متغيرات بيئة Render + `/integrations` + إعدادات الحماية (أرقام المديرين) |
| كيف أتحقق بسرعة؟ | `GET /api/health` → `emailConfigured` / `whatsappConfigured` / `smsConfigured` (+ أوضاعها) |

**قرارك الحالي:** توثيق كل شيء الآن · تفعيل Meta لاحقاً عندما يتوفر الوقت.

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
حدث POS (بيع) 
  → CustomerNotifyService.notifyPosSale
  → يبني نص الإيصال + رابط العرض + رابط البلاغ
  → WhatsappNotifyService.sendText(رقم العميل)
  → Graph API: https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
  → يسجّل نتيجة التسليم على invoice.customFieldsJson.delivery
```

نفس الفكرة للإيميل/SMS إن كانت القناة مضبوطة ولدى العميل بريد/جوال.

---

## 3) واتساب — الاستخدام والإدارة

### الفائدة
- إيصال فوري للعميل
- OTP موافقات حساسة
- تنبيه عند طلب موافقة أو بلاغ مشبوه

### ما نحتاجه للتطوير/التفعيل لاحقاً
1. حساب Meta Business + تطبيق مطورين بحالة WhatsApp  
2. `WHATSAPP_TOKEN` (دائم عبر System User للإنتاج)  
3. `WHATSAPP_PHONE_NUMBER_ID`  
4. رقم أعمال مُتحقق (اختبار أولاً ثم رقم الشركة)  
5. طريقة دفع في Meta للفوترة  
6. لاحقاً: **قوالب Templates** للرسائل الأولى خارج نافذة 24 ساعة

دليل الاشتراك المختصر: انظر §8 أدناه أو  
https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/

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

### إدارة داخل Hisaby
1. `/integrations` — حالة القناة + زر اختبار (يُرسل القالب إن وُجد) + تحذير إن نقص القالب  
2. إعدادات الحماية / Dual-control — أرقام `whatsappNotifyPhones`  
3. `autoSendPosReceipts` — إيقاف/تشغيل إيصالات الكاشير التلقائية  

### الاستخدام اليومي (بعد الضبط)
- الكاشير يبيع كالمعتاد → الرسالة تذهب وحدها إن وُجد رقم صحيح  
- عند الحاجة لموافقة: إرسال OTP من شاشة الموافقة  
- اختبار يدوي: `/integrations` → إرسال اختبار  

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
| ضبط Meta + توكن دائم | عالية | تشغيل واتساب إنتاجي |
| قوالب واتساب معتمدة (إيصال/OTP) | عالية | أول رسالة للعميل الجديد |
| Resend أو SMTP على الدومين | متوسطة | إيميلات موثوقة (SPF/DKIM) |
| Webhook وارد من Meta | متوسطة | حالة التسليم / ردود العملاء |
| لوحة سجل رسائل داخل Hisaby | متوسطة | تدقيق وتشخيص بدون قراءة Render logs |
| إيقاف قنوات لكل شركة (ليس فقط env عام) | منخفضة | تعدد مستأجرين أدق |

---

## 8) تفعيل Meta لاحقاً — قائمة تحقق (عندما يتوفر الوقت)

1. [ ] إنشاء Business Portfolio على business.facebook.com  
2. [ ] Create App → Connect with customers through WhatsApp  
3. [ ] API Setup → نسخ Token + Phone number ID  
4. [ ] اختبار إرسال من لوحة Meta لرقم تجريبي  
5. [ ] (إنتاج) System User + Permanent token  
6. [ ] وضع القيم في Render وإعادة تشغيل `hisaby-api`  
7. [ ] اختبار من Hisaby `/integrations`  
8. [ ] بيع تجريبي لعميل برقم حقيقي  
9. [ ] لاحقاً: إنشاء Template للإيصال وربطه في الكود إن لزم  

حتى إكمال هذه القائمة: اترك `WHATSAPP_TOKEN` فارغاً أو `mock` — المنتج يعمل بدون رسائل حقيقية.

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

## 10) الخطوة التالية المقترحة (بعد هذا التوثيق)

1. **تأكيد نشر Render** لآخر `main` (بعد إصلاح `npm ci`) حتى تكون الـ API حيّة.  
2. **لا تشترك في Meta الآن** إن لم يتوفر الوقت — استخدم النظام عادياً.  
3. عندما تجهز: نفّذ §8 ثم اختبر من `/integrations`.  
4. بالتوازي تشغيلياً: `npx prisma migrate deploy` على الإنتاج إن لم يُنفَّذ بعد.

---

**للمشغّل غير التقني:**  
افتح المحاسبة → **الربط والإشعارات** (`/integrations`) → **اقرأني**. كل الخطوات العملية موجودة هناك أيضاً عبر الـ API.
