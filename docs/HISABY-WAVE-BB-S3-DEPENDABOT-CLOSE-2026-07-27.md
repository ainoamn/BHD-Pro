# موجة BB — S3 مرفقات + إغلاق ضوضاء Dependabot

**التاريخ:** 27 يوليو 2026

## الملخص

| البند | الحالة |
|-------|--------|
| `@aws-sdk/client-s3` | تبعية رسمية في الـ backend |
| رفع S3 | `ATTACHMENT_STORAGE=s3` + مفاتيح `S3_*` — فشل صريح إن نقصت الإعدادات |
| حذف مرفق | يحذف ملف local/S3 عند حذف السجل |
| `/health` | يعرض `attachmentStorage` و`s3Configured` |
| Dependabot | workflow يغلق كل PRs Dependabot المفتوحة مرة عند إضافة الملف (أو يدوياً) |

## تفعيل S3 على الإنتاج

```env
ATTACHMENT_STORAGE=s3
S3_BUCKET=...
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# اختياري MinIO / Cloudflare R2:
# S3_ENDPOINT=https://...
# S3_PUBLIC_BASE_URL=https://cdn.example.com
```

تحقق: `GET /api/health` → `"attachmentStorage":"s3","s3Configured":true`.

## إغلاق Dependabot يدوياً لاحقاً

Actions → **Close Dependabot noise** → Run workflow.
