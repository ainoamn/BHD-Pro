# Hisaby — موجة AC: صلاحيات + صدق EOD/مطبخ (26 يوليو 2026)

**الفرع:** `main` · بعد موجة AB  
**المستودع:** [ainoamn/BHD-Pro](https://github.com/ainoamn/BHD-Pro)

---

## ما شُحن

### 1) أمن / صلاحيات (Backend)
- **JwtAuthGuard:** منع دور VIEWER من POST/PUT/PATCH/DELETE بعد نجاح المصادقة (كان `DenyViewerMutationsGuard` لا يرى `req.user` لمسارات JWT لأن الحارس العام يعمل قبل JwtAuthGuard)
- **مطالبات موظفين:** approve/reject → ADMIN|MANAGER · pay → ADMIN|MANAGER|ACCOUNTANT
- **ملف الشركة `PUT /companies/me`:** ADMIN|MANAGER
- **فترات محاسبية:** lock → ADMIN|MANAGER|ACCOUNTANT · unlock → ADMIN
- **أوامر شراء status:** DTO مع `@IsEnum` بدل `@Body('status')` الخام
- **رسالة اختبار messaging:** `@IsIn(['whatsapp','email','sms'])` — لا سقوط صامت لإيميل

### 2) صدق واجهة
- **EOD ورديات:** فشل جلب السلال المعلّقة يظهر `?` + تأكيد خاص · طابور أوفلاين لا يُصفَّر عند فشل IndexedDB · لا «جاهز للإغلاق» كاذب
- **ولاء كاشير:** toast عند فشل نقاط العميل
- **KDS مطبخ:** تبديل الصوت لا يعيد تشغيل EventSource (soundOn عبر ref)
- **لوحة صالة مباشرة:** شريط خطأ + تحديث حتى مع بيانات قديمة
- **طلب مطعم:** خطأ محطات + إعادة
- **تقرير flash:** toast عند فشل الطباعة
- **تحصيل فاتورة:** لا اختلاق status=PAID عند فشل إعادة الجلب

---

## تحقق سريع

1. مستخدم VIEWER → أي POST يرجع 403.  
2. كاشير لا يستطيع إقفال فترة / اعتماد مطالبة / تعديل شركة.  
3. أوقف API أثناء شاشة إغلاق وردية — سلال معلّقة تظهر `?` وليس 0 أخضر.  
4. في المطبخ بدّل الصوت — لا انقطاع SSE.

---

## متبقٍ

WAF · Sentry SDK كامل · OTA live · Capacitor · SoftPOS
