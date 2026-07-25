# ترقية Hisaby — Wave 6 (يوليو 2026)

## منجز

### 1) إشعار واتساب عند طلب موافقة أونلاين
- عند إنشاء `ApprovalRequest` يُرسل تنبيه لمديري واتساب (best-effort).

### 2) مزامنة كتالوج/مخزون أوفلاين
- `GET /pos/catalog/sync?warehouseId=` حتى 5000 منتج + كمية المستودع.
- IndexedDB حسب المستودع + زر تحديث يستخدم المزامنة الكاملة.
- تخفيض مخزون محلي تفاؤلي عند بيع أوفلاين.

### 3) استرداد أوسع + رصيد متجر (MVP → hardened)
- `refundMethod`: ORIGINAL | CASH | STORE_CREDIT.
- البيع بـ `useStoreCredit === true` فقط (لا يعتمد على `OTHER` وحده) يخصم `Contact.currentBalance` ذرياً.
- إلغاء البيع يعيد الرصيد عند `[STORE_CREDIT]` / `usedStoreCredit`.
- واجهة: زر رصيد متجر، رصيد في قائمة العملاء، حظر أوفلاين، استرداد إلى رصيد متجر.
- باقي النقد: مودال مبلغ مستلم → الباقي → تأكيد.
- استرداد برقم الإيصال: `GET /pos/sales/by-number?number=`.
- حقول openingBalance / creditLimit / currentBalance في جهات الاتصال (تحديث عبر API).

### 4) صقل لوحة الشركة
- مؤشرات: كاشير اليوم، موافقات معلّقة، ورديات مفتوحة + تنبيهات الشريط.

## تشغيل
لا migration جديدة.
