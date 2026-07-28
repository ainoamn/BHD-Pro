# موجة BQ — إصلاح OOM عند نشر Render (512Mi)

**التاريخ:** 28 يوليو 2026

## المشكلة

نشر `hisaby-api` يفشل بعد بناء Docker بنجاح:

```
Running generate... - Prisma Client
==> Out of memory (used over 512Mi)
```

السبب: أمر الإقلاع كان يشغّل `prisma db push` **مع** `prisma generate` داخل الحاوية محدودة الذاكرة، رغم أن Client مُولَّد أصلاً أثناء البناء.

## الإصلاح

`backend/Dockerfile` CMD:

- `prisma migrate deploy --skip-generate` (أو `db push --skip-generate` كاحتياط)
- `node --max-old-space-size=384 dist/main`

## إن استمر OOM بعد الإقلاع

رقِّ خطة Render فوق 512Mi، أو خفّض تحميل الإقلاع (Sentry/Redis اختياري).
