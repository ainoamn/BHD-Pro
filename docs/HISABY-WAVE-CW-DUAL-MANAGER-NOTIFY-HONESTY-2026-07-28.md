# موجة CW — صدق إشعار المديرين عند طلب موافقة مزدوجة

**التاريخ:** 28 يوليو 2026

## الهدف

إنشاء طلب موافقة أونلاين كان يطلق واتساب للمديرين دون انتظار (`void`) ودون إبلاغ الواجهة. التدقيق سجّل `APPROVAL_REQUEST_NOTIFIED` بنجاح حتى في وضع mock (`ok: true`).

## التغييرات

| ملف | ماذا |
|-----|------|
| `dual-control.service.ts` | `await` الإشعار · إرجاع `managerNotify` · تدقيق `success` فقط عند تسليم حي + `notifyStatus`/`mock` |
| `dual-approval-modal.tsx` | toast حسب `ok` / `mock` / `fail` / `skipped` |
| `api.ts` | نوع `managerNotify` على إنشاء الطلب |

## سلوك

- الطلب يُنشأ دائماً (لا يُفشل بسبب الإشعار)
- mock → 🧪 · بلا أرقام/قناة → تخطّي · فشل حي → تحذير · تسليم حي → نجاح

## التالي

Cloudflare / Sentry / OTP يدوياً.
