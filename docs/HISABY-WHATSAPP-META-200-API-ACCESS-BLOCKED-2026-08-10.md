# واتساب — `#200 — API access blocked` (إيصال الكاشير)

**التاريخ:** 10 أغسطس 2026  
**البيئة:** واجهة `bhd-pro.vercel.app` · API `hisaby-api.onrender.com`  
**مستودع:** https://github.com/ainoamn/BHD-Pro  
**مرتبط:** [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md) · [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md) · [`HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md`](./HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md)

---

## 1) ما يظهر للمشغّل

بعد **إعادة الإرسال الآن** (أو إرسال الإيصال من السيرفر) على الكاشير:

```text
واتساب لم يُرسل من السيرفر: #200 — API access blocked.
```

| الحقل | المعنى |
|--------|--------|
| `#200` | رمز خطأ **Meta Graph API** (صلاحيات / وصول التطبيق) |
| `API access blocked` | Meta **رفضت** طلب الإرسال — ليس عطلاً في زر Hisaby |
| `whatsapp: fail` في delivery | السيرفر وصّل الخطأ بأمانة؛ الرسالة **لم تُقبل** من واتساب |

هذا **تقدّم تشخيصي** مقارنة بسلوك قديم كان قد يعرض نجاحاً وهمياً: الآن نرى رفض Meta الحقيقي.

---

## 2) هل يُصلح بالكود فقط؟

| | |
|--|--|
| **لا** | `#200` لا يُحل بتعديل قالب `pos_receipt` أو رقم العميل وحدهما |
| **نعم (جزئياً)** | Hisaby يحسّن نص الخطأ والتوكن الفارغ؛ **الإرسال الحقيقي** يحتاج توكن Meta صالحاً |

مسار الطلب:

```text
كاشير → resendPosSaleNotify
  → WhatsApp Cloud API:
      POST graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
      Authorization: Bearer {WHATSAPP_TOKEN}
  → Meta يرد #200 + API access blocked
  → delivery.whatsapp = fail + whatsappError
```

---

## 3) الأسباب الشائعة لـ `#200`

1. **Access Token** بدون صلاحية `whatsapp_business_messaging` (أو `whatsapp_business_management` لإدارة القوالب/الأصول).
2. **توكن User مؤقت** منتهي أو من مستخدم لا يملك أصول WABA.
3. **System User** بدون تعيين **WhatsApp Business Account** / رقم الهاتف للتطبيق.
4. تطبيق Meta في وضع **Development** مع قيود إرسال خارج مستخدمي الاختبار.
5. `WHATSAPP_PHONE_NUMBER_ID` لا يطابق الرقم المرتبط بنفس التوكن/WABA.
6. بعد **App Review** أو تغيير الصلاحيات: التوكن القديم يصبح بلا وصول — يلزم **توليد توكن جديد**.
7. توكن نُسِخ ناقصاً أو بمسافات زائدة في Render (Hisaby يقصّ المسافات الآن عند `isConfigured`).

---

## 4) خطوات الإغلاق (Render + Meta) — إلزامي

### أ) Meta Access Token Debugger

1. افتح [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
2. الصق قيمة `WHATSAPP_TOKEN` الحالية من Render.
3. تحقق:
   - **Scopes:** `whatsapp_business_messaging` ويفضّل `whatsapp_business_management`
   - **Expires:** Permanent / لا ينتهي قريباً
   - **Valid:** نعم
   - أن الأصل المرتبط يشمل **WABA** ورقم WhatsApp المستخدم

إن ظهر «Invalid» أو صلاحيات ناقصة → أنشئ توكن جديد (أقل).

### ب) Permanent Token (System User)

1. Meta Business Suite → **Business Settings** → **Users** → **System users**.
2. System user بصلاحية إدارة الأصل (Full control على واتساب إن أمكن).
3. **Add assets** → WhatsApp account / رقم.
4. **Generate new token** للتطبيق الذي يملك `PHONE_NUMBER_ID`.
5. اختر الصلاحيات أعلاه → انسخ التوكن مرة واحدة.

### ج) Render Environment

```env
WHATSAPP_TOKEN=<Permanent System User token — كامل>
WHATSAPP_PHONE_NUMBER_ID=<نفس الرقم من WhatsApp → API Setup>
WHATSAPP_RECEIPT_TEMPLATE=pos_receipt
WHATSAPP_RECEIPT_TEMPLATE_LANG=ar
# اختياري: WHATSAPP_ENABLED=true
```

1. احفظ المتغيرات.
2. **Manual Deploy** لأحدث `main` إن كان الـ API على commit قديم (راجع [مستند Render المتوقف](./HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md)).
3. بعد التشغيل: `GET https://hisaby-api.onrender.com/api/health`  
   متوقع: `whatsappConfigured: true` · `whatsappMode: "live"` · `whatsappReceiptTemplate: "pos_receipt"`.

### د) اختبار سريع

1. كاشير → فاتورة بإيصال → عميل برقم واتساب صالح (عُمان `968…`).
2. **إعادة الإرسال الآن**.
3. نجاح = `whatsapp: ok` (قبول Meta) + ظهور الرسالة على الجوال (التسليم الفعلي يتأكد من الهاتف / WhatsApp Manager).
4. إن بقي `#200` بعد توكن جديد: راجع أن **Phone Number ID** من نفس WABA وأن التطبيق **Live**.

---

## 5) تمييز عن أخطاء أخرى

| رمز / نص | المعنى التقريبي | أين يُصلَّح |
|-----------|------------------|-------------|
| `#200` / API access blocked | توكن/صلاحيات/وصول أصل | Meta + `WHATSAPP_TOKEN` |
| `#190` | توكن منتهٍ / OAuth | توكن جديد |
| `#10` / `#3` | صلاحية التطبيق ناقصة | App permissions / Review |
| `#132000` / `#132001` / `#132012` | متغيرات أو لغة القالب | نص `pos_receipt` + env lang |
| `#133010` | القالب غير موجود | اسم القالب على WABA |
| `#131047` | خارج نافذة 24 ساعة بدون قالب | قالب Utility معتمد |

---

## 6) ما تغيّر في الكود (هذا المستند)

| ملف | التغيير |
|-----|---------|
| `backend/.../whatsapp-notify.service.ts` | `trim` على التوكن؛ تلميح عربي لـ `#200` و `#190` وأخطاء القالب |
| `frontend/.../pos-copy.ts` | نص `shareWhatsAppTokenBlocked` |
| `frontend/.../pos/page.tsx` | تمييز توست خطأ التوكن عن أخطاء القالب |

**لا يُتوقع** أن يختفي `#200` بعد deploy وحده إن بقي التوكن بلا صلاحية واتساب.

---

## 7) قائمة تحقق سريعة للمشغّل

- [ ] Debugger: scopes واتساب + Valid
- [ ] System User مرتبط بـ WABA والرقم
- [ ] `WHATSAPP_TOKEN` محدّث على Render (قيمة جديدة كاملة)
- [ ] `WHATSAPP_PHONE_NUMBER_ID` يطابق API Setup
- [ ] Deploy API لأحدث `main` إن لزم
- [ ] إعادة إرسال إيصال → لا `#200` → رسالة على الجوال

---

## 8) خلاصة

**الخطأ من Meta (صلاحية التوكن/الوصول)، وليس من تنسيق رقم الإيصال في Hisaby.**  
الإغلاق = توكن دائم بصلاحيات واتساب + رقم صحيح + إعادة تشغيل/Deploy على Render.
