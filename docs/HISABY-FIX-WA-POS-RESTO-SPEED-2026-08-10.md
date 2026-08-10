# إصلاح واتساب + بطء آخر المبيعات + بطء صالة المطاعم

**التاريخ:** 10 أغسطس 2026  
**Commit المتوقع بعد الدفع:** انظر `git log -1` على `main`

---

## 1) الأعراض

| موقع | المشكلة |
|------|---------|
| واتساب | الإيصالات/الفواتير لا تصل للجوال بعد الإصدار أو إعادة الإرسال |
| كاشير | «آخر المبيعات» تظهر بعد **10–15 ثانية** |
| مطاعم `/resto` | الدوران > **30 ثانية** عند الفتح/التحديث |

---

## 2) واتساب — الإصلاح

| تغيير | ملف |
|--------|-----|
| تعقيم نص المتغيرات (بدون أسطر جديدة — أخطاء Meta شائعة) | `whatsapp-notify.service.ts` |
| إعادة المحاولة: لغات متعددة + named ↔ positional | نفس الملف · Graph **v21** |
| اختبار `/messaging/test` يمر عبر `sendPosReceipt` ويعيد `messageId` + قناع الرقم | `messaging.controller.ts` |

**ما زال مطلوباً تشغيلياً**
1. Deploy Live على Render (الـ API الحي كان متأخراً عن `main`).
2. طابق قالب `pos_receipt` في Meta: **5 متغيرات** · لغة `ar`.
3. اختبار من **`/integrations`** لرقم `968…`.
4. في logs: `WhatsApp template accepted … id=wamid` = قبول Meta (تحقق من الهاتف).

اختياري: `WHATSAPP_RECEIPT_TEMPLATE_LANGS=ar,en` لتجارب لغة إضافية.

---

## 3) كاشير — آخر المبيعات

| تغيير | تفاصيل |
|--------|--------|
| فلتر مفهرس | `posWarehouseId` / `posShiftId` بدل الاعتماد الدائم على `notes contains` |
| `light=1` (افتراضي) | بدون بنود كاملة / بدون reprints / بدون استعلامات استرداد ثقيلة للشريط |
| مهلة 15ث | `listRecentPosSales` لا ينتظر 60ث |
| take 15 | شريط أخف |

ملفات: `pos.service.ts` · `pos.controller.ts` · `api.ts` · `pos/page.tsx`

---

## 4) مطاعم — الصالة

| تغيير | تفاصيل |
|--------|--------|
| تجميع بنود الطلب **SQL** | بدون تحميل كل سطور `resto_order_items` إلى الذاكرة |
| كاش ذاكرة **12ث** + dedupe in-flight | `getFloor` |
| حذف `guestToken` + قائمة `tables` المكررة من الحمولة | JSON أصغر |
| كاش `sessionStorage` للواجهة | لوحة تظهر فوراً من آخر لقطة ثم تُحدَّث |
| مهلة 20ث | `getRestoFloor` |

ملفات: `resto.service.ts` · `resto/page.tsx` · `api.ts`

---

## 5) نشر وتحقق

```text
1) git pull / Deploy Render hisaby-api من أحدث main
2) GET /api/health → commit == SHA الأخير ·
3) Vercel Ready للواجهة
4) /pos → آخر المبيعات < ~3ث عند API دافئ
5) /resto → الصالة تظهر من الكاش ثم refresh
6) /integrations → اختبار واتساب → وamid في الرد
```

**تحذير:** بدون Deploy لـ Render تبقى المشاكل كما هي على الإنتاج (commit قديم).

---

## 6) قائمة تحقق واتساب بعد النشر

- [ ] اختبار تكاملات → ok + messageId  
- [ ] بيع كاشير برقمك → رسالة على الهاتف  
- [ ] فاتورة SENT/PAID → رسالة  
- [ ] WhatsApp Manager → عمود التسليم يزيد  
