# موجة AY — توحيد المستخدمين والصلاحيات والتقارير

**التاريخ:** 27 يوليو 2026

## الملخص

- دعوة مستخدم بالبريد + `username` تلقائي + شاشة `/complete-profile`.
- مصفوفة صلاحيات موسّعة للمحاسبة / POS / المطاعم مع فرضها في السايدبار والشلّات وlayout المحاسبة.
- توجيه بعد الدخول حسب الدور والصلاحية (`homePathForUser`).
- دفتر عناوين موحّد للمطاعم عبر `/resto/contacts` (نفس `Contact` الشركة).
- اشتراكات تقارير المدير الدورية (`/manager-digests`) بقنوات in-app / email / whatsapp.
- Migration: `20260727105500_user_invites_manager_reports`.

## تحقق

- `backend`: `npm run prisma:generate` + `npm run build`
- `frontend`: `npm run type-check`

## ملاحظة تشغيل

تطبيق الـ migration على PostgreSQL مطلوب قبل استخدام حقول الدعوة/الاشتراكات في الإنتاج:
`npx prisma migrate deploy` من مجلد `backend`.
