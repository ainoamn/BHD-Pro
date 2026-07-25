# ترقية Hisaby — Wave 7 POS (يوليو 2026)

**الهدف:** رفع سرعة الكاشير وثقة المدير إلى مستوى تشغيلي عالمي دون SoftPOS/Capacitor.

## ما شُحن

1. **اختصارات لوحة المفاتيح:** F2 مسح · F4 تعليق · F8 إيصال · F9 نقد · F10 بطاقة · `?` مساعدة
2. **سلات معلّقة:** تعديل اسم/ملاحظات في نافذة (بدل `prompt`) · عمر السلة · تنبيه «قديمة» · تسمية تلقائية باسم العميل
3. **سجل الموافقات:** تبويب Pending + History في `/pos/approvals` عبر `GET /dual-control/requests/history`
4. **باركود وزن متغير (EAN-13 بادئة 2):** مطابقة رمز الصنف + كمية بالكيلو من الحقل المضمّن — أونلاين وأوفلاين

## ملفات رئيسية

- `frontend/src/app/pos/page.tsx`
- `frontend/src/app/pos/approvals/page.tsx`
- `frontend/src/lib/pos-plu.ts` · `backend/src/common/pos-plu.ts`
- `backend/src/pos/pos.service.ts` · `backend/src/dual-control/*`

## التالي (Wave 8 مقترح)

- استبدال نقاط الولاء عند الدفع (REDEEM)
- تقسيم دفع يشمل تحويل/رصيد متجر
- تخصيص تذييل الإيصال من إعدادات الشركة
