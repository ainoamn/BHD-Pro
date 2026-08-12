# نشر الإنتاج — Render متوقف على commit قديم (محدث 12 أغسطس 2026)

## الحالة المرصودة

| مكوّن | المتوقع | الحي |
|--------|---------|------|
| GitHub `main` | تقوية `209d2cb`+ | مرفوع |
| Vercel | أحدث `main` | عادة تلقائي |
| **Render `hisaby-api`** | نفس SHA | **`0384917` — لم ينشر** |

**دليل go-live للتقوية (إلزامي قبل/مع Deploy):**  
[`HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md`](./HISABY-RENDER-GO-LIVE-HARDENING-2026-08-12.md)

بدون Manual Deploy على Render لا تصل إصلاحات واتساب/كاشير/مطاعم/التقوية الأمنية للزبائن.

---

## ماذا تفعل الآن

1. اقرأ go-live أعلاه (dataurl انتقالي + `start:prod:migrate`).  
2. Environment: على الأقل `ALLOW_INSECURE_DATAURL_STORAGE=true` وCORS للواجهة الحية.  
3. Start Command: `npm run start:prod:migrate` (نسخة واحدة).  
4. Neon backup → **Manual Deploy** latest `main`.  
5. `curl -s https://hisaby-api.onrender.com/api/health` → `commit` ≠ `0384917`.  
6. لاحقاً: `TOTP_SECRETS_KEY` + `HARDENING_STRICT_BOOT=true` + واتساب Permanent token.

لا يوجد Deploy Hook في المستودع — النشر يدوي من لوحة Render.

---

## مراجع

- [`HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md`](./HISABY-OPS-READINESS-AND-OPEN-ISSUES-2026-08-10.md)  
- [`SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md`](./SECURITY-HARDENING-DEPLOYMENT-2026-08-11.md)  
- [`HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md`](./HISABY-WHATSAPP-META-200-API-ACCESS-BLOCKED-2026-08-10.md)
