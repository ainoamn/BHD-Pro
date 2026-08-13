# نقطة التوقف — استكمال العمل من جهاز آخر (13 أغسطس 2026)

**الغرض:** تسليم نظيف بلا تعارض ملفات/بيانات. اقرأ هذا الملف أولاً على الجهاز الآخر ثم نفّذ `git pull`.

---

## 1) أين نحن الآن؟

| عنصر | القيمة |
|------|--------|
| المستودع | https://github.com/ainoamn/BHD-Pro |
| الفرع | **`main`** فقط للعمل اليومي |
| الالتزام الحالي (وقت التدوين) | **`949aab0`** — *Allow transitional Render boot for hardening without TOTP/S3 outage* |
| حالة الشجرة المحلية عند التسليم | **نظيفة** ومتزامنة مع `origin/main` |
| فرع التقوية | `security-hardening-2026-08-11` @ `2505a52` — **مدموج مسبقاً** في `main`؛ لا تعد العمل عليه إلا للفروع القديمة |

### الإنتاج الحي (تحقق 12 أغسطس 2026 ~10:46 GST)

| مكوّن | حالة |
|--------|------|
| API `hisaby-api.onrender.com` | **Live على `949aab0`** · `/api/health` ok · `/api/health/ready` 200 |
| واجهة | `bhd-pro.vercel.app` / `hisaby.pro` (Vercel عادةً يتبع `main`) |
| ما فشل سابقاً ثم نجح | دمج التقوية `209d2cb` فشل إقلاع (TOTP/S3) → أصلحه `949aab0` الانتقالي |

---

## 2) ماذا أُنجز في هذه الجلسات (ملخص للرفع)

### أ) واتساب Meta `#200`
- الخطأ الحقيقي: **API access blocked** = توكن/صلاحيات Meta، وليس زر الكاشير.
- توثيق: [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)
- **ما زال مفتوحاً للمشغّل:** Permanent Token على Render.

### ب) حزمة التقوية الأمنية (تدقيق 11 أغسطس)
- طُبّقت من حزمة Codex على أساس `a4f4cef`، دُمجت ورُفعت.
- توثيق التطبيق: [`HISABY-SECURITY-HARDENING-APPLIED-2026-08-12.md`](./HISABY-SECURITY-HARDENING-APPLIED-2026-08-12.md)
- التقرير الكامل: [`HISABY-TECHNICAL-SECURITY-AUDIT-2026-08-11-ar.md`](./HISABY-TECHNICAL-SECURITY-AUDIT-2026-08-11-ar.md)
- دليل النشر: [`SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md`](./SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md)
- Go-live Render: [`HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md`](./HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md)

### ج) إقلاع انتقالي للإنتاج (`949aab0`)
- بدون `TOTP_SECRETS_KEY` أو مع `dataurl`: الإقلاع مسموح + تحذير سجلات.
- بعد تجهيز الأسرار/S3: `HARDENING_STRICT_BOOT=true`.
- سكربت: `npm run start:prod:migrate` (هجرة + تشغيل لنسخة Render الواحدة).

### د) تحليل منافس [wazen.pro](https://wazen.pro/) (13 أغسطس)
- **ليس** نفس [wazen.sa](https://wazen.sa) (ERP سعودي ZATCA).
- wazen.pro = إدارة طلبات خليجية على **Firebase + Stripe + PWA**؛ سياسات إماراتية.
- Hisaby أعمق (محاسبة/POS/مطاعم)؛ وازن.pro أوضح رسالة وأبسط للتاجر.
- التفاصيل: [`COMPETITIVE-WAZEN-PRO-ANALYSIS-2026-08-13.md`](./COMPETITIVE-WAZEN-PRO-ANALYSIS-2026-08-13.md)

---

## 3) مهام مفتوحة — أكمل من هنا

مرتّبة حسب الأولوية التشغيلية:

1. **[ ] واتساب:** توكن Permanent بصلاحيات messaging على Render → اختبار إعادة إرسال إيصال (إغلاق `#200`).
2. **[ ] هجرة DB:** إن لم تُشغَّل بعد على الإنتاج:  
   `npx prisma migrate deploy --schema src/prisma/schema.prisma`  
   (أو Start Command = `npm run start:prod:migrate`). تأكد من Backup Neon أولاً.
3. **[ ] Env انتقالي صريح:** `ALLOW_INSECURE_DATAURL_STORAGE=true` حتى يتوفر S3.
4. **[ ] لاحقاً:** `TOTP_SECRETS_KEY` ≠ `PAYMENT_SECRETS_KEY` ثم `HARDENING_STRICT_BOOT=true`.
5. **[ ] اختياري منتج:** قرار استراتيجي بعد تحليل وازن (منتج دخول «طلبات» vs التركيز على ERP/مطاعم عُمان).

---

## 4) على الكمبيوتر الآخر — بدون تعارض

```powershell
cd <مسار-النسخة>
git fetch origin
git switch main
git pull origin main
git status
git rev-parse --short HEAD
# يجب أن يطابق أو يتجاوز 949aab0 (أو أحدث main بعد هذا التسليم)
```

### قواعد لمنع التعارض

| افعل | لا تفعل |
|------|---------|
| اعمل دائماً على `main` المحدَّث أو فرع جديد من أحدث `main` | لا تعدّل على نسختين محليتين دون push |
| `git pull` قبل أي تعديل | لا تستخدم `push --force` على `main` |
| ارفع commit قبل إغلاق الجهاز | لا تترك تعديلات غير committed على جهاز وتنسى |
| الأسرار فقط على Render/Vercel/Neon — ليست في Git | لا تنسخ `.env` الحقيقي إلى Git |

### إن ظهر تعارض لاحقاً

```powershell
git status
git pull --rebase origin main
# حل الملفات يدوياً ثم:
git add .
git rebase --continue
git push origin HEAD
```

---

## 5) روابط سريعة

| موضوع | ملف |
|--------|-----|
| حالة/فجوات عامة | [`HISABY-STATUS-AND-GAPS.md`](./HISABY-STATUS-AND-GAPS.md) |
| Render متوقف سابقاً | [`HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md`](./HISABY-RENDER-DEPLOY-STUCK-2026-08-10.md) |
| واتساب لا يصل | [`HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md`](./HISABY-FIX-WHATSAPP-DELIVERY-2026-07-29.md) |
| هذا التسليم | **هذا الملف** |

---

**الخلاصة للجهاز الآخر:** اسحب `main` من GitHub، ابدأ من §3 (مهام مفتوحة). الكود والوثائق حتى هذه النقطة مرفوعة؛ لا توجد تعديلات معلّقة على الجهاز الأول وقت إنشاء هذا المستند.
