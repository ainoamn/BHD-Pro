# ملاحظات إصدار التقوية الأمنية والهندسية

## المنفذ

- تنقيح متداخل ومحدود الحجم لبيانات audit، مع تسجيل فشل الكتابة دون أسرار.
- فرض صلاحيات الوحدات مركزياً بعد JWT/API key ورفض tenant header المتعارض.
- إغلاق XSS في طباعة الفواتير والكاشير والمطعم مع اختبارات escaping.
- تثبيت origins لبوابة Thawani، رفض config غير المعروف، HTTPS/timeout/no-redirect.
- atomic payment claim و`idempotency_key` فريد وربط webhook بالبوابة والشركة/session.
- تقليل select في مستندات الفواتير العامة وعدم إرسال UUID للواجهة العامة.
- forgot/reset/change password برمز مجزأ منتهي، رد غير كاشف، وإلغاء الجلسات.
- CSRF double-submit + Origin، TOTP بمفتاح منفصل، ومفاتيح API scopes/expiry/IP.
- AES-256-GCM v2 مع HKDF purpose separation وAAD وkey IDs وprevious-key rings مع قراءة v1.
- Decimal في مسارات الفواتير/الشراء/اليومية/الدفع، وتسلسل ذري لأرقام المستندات.
- تحقق magic bytes للمرفقات وS3 SSE/Content-Disposition ومتطلبات إنتاج آمنة.
- Country Packs خليجية، صفحات استعادة وثقة/خصوصية/شروط، accessibility labels ورؤوس حماية أوسع.
- release migration منفصل، Redis password، container capabilities أقل، وبوابات CI إضافية.

## دليل التحقق في بيئة العمل

- Prisma schema: صالح.
- Backend TypeScript مع عميل Prisma مولد: ناجح.
- Backend Jest: 18 suites / 51 tests ناجحة.
- Frontend TypeScript: ناجح.

## غير منفذ تلقائياً

- لم تُدوّر أسرار الإنتاج ولم تُعدل Vercel/Render/Neon/DNS/S3/Sentry والبريد.
- لم تُشغّل الهجرة على قاعدة إنتاج ولم تُحذف بيانات.
- لم يُنفذ pentest إنتاجي أو اعتماد قانوني/PCI/SOC 2/ISO.
- يلزم بيئة متصلة بالـregistry لتأكيد `npm audit` النهائي، وبيئة متصفح لتشغيل Playwright كاملاً.
- يلزم برنامج تدريجي لاستكمال Decimal في كل الحسابات القديمة وتفكيك الخدمات الكبيرة دون كسر العقود.
