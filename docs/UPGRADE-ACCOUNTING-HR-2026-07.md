# موجة المحاسبة والموارد البشرية (يوليو 2026)

## الهدف
ربط الرواتب والمطالبات والبنوك والالتزامات بدفتر الأستاذ فعلياً، مع مرفقات وتنبيهات إدارة لمكافحة التكرار/الاحتيال البسيط.

## ما طُبّق (في الكود + Git)

| المرحلة | المحتوى | الحالة |
|---------|---------|--------|
| **A** | استحقاق/صرف رواتب ومطالبات عبر `GlPostingService` (5210/2150، 5220/2160) + اختيار بنك عند الصرف | منجز |
| **B** | وحدة التزامات دورية `/commitments` + cron يومي 7ص + إيقاف/تأجيل يوم\|شهر\|سنة | منجز |
| **C** | مزامنة `BankAccount.currentBalance` مع قيود GL + ربط دفعة الفاتورة بحساب بنك | منجز |
| **D** | مرفقات `attachments` + فهرس مرجع دفع فريد لكل فاتورة + تنبيهات إدارة `management-alerts` | منجز (MVP) |
| **E** | Dual-control على صرف الرواتب (`PAYROLL_PAY`) ومطالبات الموظفين (`CLAIM_PAY`) | منجز |
| **F** | تحويل داخلي بين حسابات البنك + اقتراحات مطابقة كشف الحساب من GL/الدفعات | منجز |
| **G** | Dual-control على التحويل البنكي + مزامنة رصيد البنك مع القيود اليدوية | منجز |

## ما لم يُطبّق بعد (مقصود / مؤجّل)
- رفع ملفات إلى S3 (حالياً `storageKey` = data URL حتى 2MB من الواجهة)
- Capacitor / NFC شريك / OTA e-invoice / AI احتيال حقيقي

## واجهة (متابعة)
- نافذة التحصيل: اختيار حساب بنك + مرجع
- مطالبات الموظفين: اختيار بنك عند الصرف + مرفقات
- مستند الفاتورة: لوحة مرفقات أثناء المعاينة
- **حماية مزدوجة** على `PAYROLL_PAY` و `CLAIM_PAY` و `BANK_INTERNAL_TRANSFER`
- تحويل بنكي داخلي + اقتراحات تسوية + شارة تنبيهات الإدارة في القائمة
- مزامنة `BankAccount.currentBalance` أيضاً عند إنشاء قيد يومية يدوي

## Migration
`backend/src/prisma/migrations/20260725180000_payroll_claims_gl_posting`

على الإنتاج بعد النشر:
```bash
npx prisma migrate deploy
```

## API سريع
- `PATCH /payroll/:id/status` + `bankAccountId` / `paymentMethod`
- `POST /employee-claims/:id/approve` → قيد استحقاق
- `POST /employee-claims/:id/pay` + بنك
- `CRUD /commitments`, `POST /commitments/run-due`
- `GET|POST|DELETE /attachments`
- `GET|PATCH /management-alerts` (ADMIN/MANAGER/ACCOUNTANT)
- `POST /bank-accounts/transfer`
- `GET /bank-accounts/:id/suggest-matches`
