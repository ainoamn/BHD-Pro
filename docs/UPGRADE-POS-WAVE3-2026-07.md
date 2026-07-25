# ترقية Hisaby — POS Wave 3 (يوليو 2026)

## منجز

### 1) دور `CASHIER`
- إضافة القيمة إلى `UserRole` (Prisma + migration).
- صلاحيات POS: بيع، بحث، مسودة، void، استرداد، ورديات.

### 2) ورديات الصندوق + تقرير Z
- جدول `pos_shifts` + ربط اختياري `invoices.pos_shift_id`.
- API: `GET/POST /pos/shifts/*` (current, open, close, list).
- واجهة `/pos/shifts` مع إجماليات حية وتقرير Z عند الإغلاق.

### 3) استرداد جزئي
- `POST /pos/sales/:id/refund` → إشعار دائن + استرجاع مخزون.
- dual-control action: `POS_REFUND`.
- زر استرداد في آخر المبيعات (كامل البنود في هذه النسخة).

### 4) WhatsApp OTP (اختياري)
- `POST /dual-control/whatsapp-otp` + طريقة `WHATSAPP_OTP`.
- جدول `dual_control_otps`.
- يتطلب `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` وأرقام في `security_config.whatsappNotifyPhones` أو هاتف الشركة.

## تشغيل على الإنتاج
1. `prisma migrate deploy` (`20260725170000_cashier_shifts_otp`)
2. ضبط أسرار واتساب إن رغبت بتفعيل OTP
3. إنشاء مستخدم بدور كاشير من `/users`
