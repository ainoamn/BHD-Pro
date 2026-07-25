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

## ما لم يُطبّق بعد (مقصود / مؤجّل)
- Dual-control على صرف الرواتب/المطالبات/التحويلات البنكية
- رفع ملفات إلى S3 (حالياً `storageKey` = مسار أو data URL)
- مطابقة كشف بنكي ذكية كاملة من GL
- Capacitor / NFC شريك / OTA e-invoice / AI احتيال حقيقي

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
- `GET|PATCH /management-alerts` (OWNER/ADMIN/ACCOUNTANT)
