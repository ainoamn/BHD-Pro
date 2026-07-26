# تقرير حالة Hisaby — منجز، فجوات، وخطة

**التاريخ:** 26 يوليو 2026  
**المستودع:** https://github.com/ainoamn/BHD-Pro  
**للمزامنة:** `git pull origin main`  
**خرائط تفصيلية:** [`HISABY-POS-AND-SECURITY-ROADMAP.md`](./HISABY-POS-AND-SECURITY-ROADMAP.md)  
**لوحة المنصة / الباقات / التسعير:** [`HISABY-ADMIN-PLANS-USERS-PRICING-2026-07-26.md`](./HISABY-ADMIN-PLANS-USERS-PRICING-2026-07-26.md)  
**مقارنة الباقات في الصفحة الرئيسية:** [`HISABY-LANDING-PLAN-COMPARE-2026-07-26.md`](./HISABY-LANDING-PLAN-COMPARE-2026-07-26.md)  
**موجة H جزئية (أمن + UX):** [`HISABY-WAVE-H-SECURITY-UX-2026-07-26.md`](./HISABY-WAVE-H-SECURITY-UX-2026-07-26.md)  
**موجة I (استقرار + تدقيق دخول):** [`HISABY-WAVE-I-STABILITY-AUDIT-2026-07-26.md`](./HISABY-WAVE-I-STABILITY-AUDIT-2026-07-26.md)  
**موجة J (صدق أخطاء + دخول):** [`HISABY-WAVE-J-ERROR-HONESTY-AUTH-2026-07-26.md`](./HISABY-WAVE-J-ERROR-HONESTY-AUTH-2026-07-26.md)  
**موجة K (قوائم + إدارة + أمن):** [`HISABY-WAVE-K-LISTS-ADMIN-SECURITY-2026-07-26.md`](./HISABY-WAVE-K-LISTS-ADMIN-SECURITY-2026-07-26.md)  
**موجة L (صدق + إدارة + throttle):** [`HISABY-WAVE-L-HONESTY-ADMIN-THROTTLE-2026-07-26.md`](./HISABY-WAVE-L-HONESTY-ADMIN-THROTTLE-2026-07-26.md)  
**موجة M (POS/مطاعم + throttles):** [`HISABY-WAVE-M-POS-RESTO-ADMIN-THROTTLE-2026-07-26.md`](./HISABY-WAVE-M-POS-RESTO-ADMIN-THROTTLE-2026-07-26.md)

---

## 1) ملخص تنفيذي

المنتج **منشور ويعمل** (Vercel + Render + Neon) بثلاثة منتجات مترابطة:

| المنتج | المسار | الحالة |
|--------|--------|--------|
| **حسابي للمحاسبة** | `/dashboard` وما يتفرع منه | جاهز للبيتا — فواتير، مخزون، GL، تقارير، ضريبة |
| **حسابي للكاشير (POS)** | `/pos` | جاهز للبيتا — بيع سريع، مخزون مستودع، حماية مزدوجة، فصل مخزن التجزئة |
| **حسابي للمطاعم** | `/resto` | صالة · مطبخ KDS · سفري · حجوزات · وصفات BOM · إغلاق عبر POS |
| لوحة المنصة | `/admin` | مقارنة باقات عمودية · تخفيض سنوي · مستخدمون قائمة+لوحة · صلاحيات شركة شجرية |
| الصفحة الرئيسية | `/#pricing` | أسعار حية · شهري/سنوي · زر مقارنة فوارق الباقات |

**آخر موجة أمن/UX (26 يوليو):** إلزام 2FA لـ ADMIN/MANAGER · إصلاح دوران اللوحة عند فشل API · Onboarding يحفظ الإخفاء · CSP أساسي.

التقرير الشامل: [`HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md`](./HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md).

---

## 2) ما أُنجز — محاسبة وكاشير ومطاعم ومنصة

- فوترة مبيعات/مشتريات، عروض، إشعارات دائن/مدين، أوامر شراء، فواتير مجدولة
- تحصيل ودفعات، دفتر أستاذ، قيود GL، رواتب، التزامات دورية، مرفقات، تنبيهات إدارة
- مخزون ومستودعات، تقارير وتصدير، إقفال فترات، أصول ثابتة، مراكز تكلفة
- كاشير: بيع، ورديات X/Z، باركود، موافقات، أوفلاين، طباعة Serial، ولاء، دفع شريك
- مطاعم: صالة، KDS، حجوزات، سفري، BOM، فصل مخزن المطاعم
- منصة: اشتراكات، باقات حية، صلاحيات هرمية، مقارنة عميل/مشرف، 2FA سياسة

---

## 3) ما تبقّى (صادق)

| البند | الأولوية |
|-------|----------|
| OTA live (اعتماد جهة) | عالية |
| WAF / حماية بوتات | عالية إنتاج |
| Sentry كامل (DSN) | متوسطة |
| Capacitor أصلي | متوسطة |
| SoftPOS جهاز طرفي | متوسطة |
| طباعة BLE موثوقة | منخفضة–متوسطة |
| LLM خارجي | منخفضة |

---

## 4) مراجع

- [`HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md`](./HISABY-MASTER-STATUS-AND-PLAN-2026-07-25.md)
- [`SECURITY.md`](../SECURITY.md)
- [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md)
