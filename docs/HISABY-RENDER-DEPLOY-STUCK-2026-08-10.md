# نشر الإنتاج — Render (محدث 13 أغسطس 2026)

## الحالة المرصودة

| مكوّن | المتوقع | الحي (12 أغسطس 2026) |
|--------|---------|----------------------|
| GitHub `main` | تقوية + إقلاع انتقالي | **`949aab0`+ مرفوع** |
| Vercel | أحدث `main` | عادة تلقائي |
| **Render `hisaby-api`** | نفس SHA | **Live على `949aab0`** (بعد فشل `209d2cb`) |

**تسليم جهاز آخر:** [`CONTINUE-FROM-HERE-2026-08-13.md`](./CONTINUE-FROM-HERE-2026-08-13.md)  
**دليل go-live للتقوية:** [`HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md`](./HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md)

`209d2cb` فشل إقلاع بسبب صرامة TOTP/S3؛ `949aab0` أصلحه بوضع انتقالي. ما زال مطلوباً: هجرة Prisma إن لم تُنفَّذ، واتساب Permanent Token، ثم لاحقاً `HARDENING_STRICT_BOOT=true`.

---

## ماذا تفعل الآن (بعد أن أصبح Live)

1. تحقق: `curl -s https://hisaby-api.onrender.com/api/health` → يبدأ بـ `949aab0` (أو أحدث).  
2. إن لزم: Shell → `npx prisma migrate deploy --schema src/prisma/schema.prisma` أو Start = `npm run start:prod:migrate`.  
3. Environment: `ALLOW_INSECURE_DATAURL_STORAGE=true` حتى S3.  
4. واتساب `#200`: جدّد التوكن.  
5. لاحقاً: `TOTP_SECRETS_KEY` + `HARDENING_STRICT_BOOT=true`.

لا يوجد Deploy Hook في المستودع — أي نشر لاحق يدوي أو Auto-Deploy من GitHub.

---

## مراجع

- [`HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md`](./HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md)  
- [`SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md`](./SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md)  
- [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)
