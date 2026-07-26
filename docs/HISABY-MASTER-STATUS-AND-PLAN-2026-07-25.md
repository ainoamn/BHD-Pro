# Hisaby — الحالة الكاملة وخطة التطوير
**آخر تحديث:** 26 يوليو 2026 · Asia/Muscat  
**المصدر المعتمد:** فرع `main` على GitHub (`ainoamn/BHD-Pro`) — متزامن مع `origin/main`.

---

## 0) خلاصة تنفيذية

| السؤال | الجواب |
|--------|--------|
| هل كل ما بُرمج مرفوع؟ | **نعم** على `main` بعد موجات يوليو 2026 (محاسبة، POS، مطاعم R1–R5 جزئي، أمن، واتساب/إيميل، OTA config-ready). أي WIP محلي غير مكتمل يُرفض ولا يُعتبر منجزاً. |
| هل الموقع «غير قابل للاختراق»؟ | **لا يوجد نظام غير قابل للاختراق.** Hisaby في مستوى **صلب لبيتا SaaS** مع طبقات حماية حقيقية؛ يحتاج استكمال hardening إنتاجي (WAF، 2FA إلزامي للإدارة، مراقبة). |
| أين يذهب المنتج؟ | منصة محاسبة + كاشير + مطاعم خليجية (عُمان أولاً): امتثال ضريبي، مدفوعات محلية، أوفلاين قوي، وتشغيل صالة/مطبخ. |

---

## 1) ما تم برمجته ورفعه (حتى هذه الدقيقة)

### 1.1 المحاسبة والموارد البشرية (موجات A–G)
- فوترة مبيعات/مشتريات، عروض أسعار، إشعارات دائن/مدين، أوامر شراء، فواتير مجدولة، تحصيل وعكس دفعات، ضريبة 5%
- دفتر أستاذ + قيود تلقائية عند الإصدار/التحصيل
- رواتب ومطالبات موظفين: استحقاق وصرف عبر GL (`5210/2150`، `5220/2160`) + بنك عند الصرف
- التزامات دورية `/commitments` + cron + حسابات مصروف/مستحق + مرفقات
- مزامنة أرصدة البنوك مع GL + تحويل داخلي + اقتراحات مطابقة كشف الحساب
- مرفقات MVP + تنبيهات إدارة (مراجع مكررة / معاملات متشابهة) + deep-link للفاتورة
- Dual-control: `PAYROLL_PAY`، `CLAIM_PAY`، `BANK_INTERNAL_TRANSFER`
- أصول ثابتة، مراكز تكلفة، فروع، مشاريع، تقارير وتصدير، إقفال فترات

### 1.2 الكاشير (POS) — جاهز للبيتا
- بيع `/pos`: مخزون مستودع، نقد/بطاقة/تحويل/رصيد متجر، خصم، عميل، إلغاء، سلات معلّقة
- دفع متعدد (split tender) + بقشيش + ملاحظات السلة المعلّقة
- **دفع شريك** (Thawani/Stripe/PayPal) عبر زر PARTNER — ليس شارة NFC
- مسح باركود، دور `CASHIER`، موافقات أونلاين + WhatsApp OTP
- شارة NFC للموافقة المزدوجة فقط
- ورديات، X/Z، حركات نقد → GL، عمولة كاشير + نقاط ولاء
- أوفلاين: طابور مبيعات + كتالوج + `GET /pos/stock/sync?since=`
- طباعة Web Serial (+ BLE stubs)، درج نقد، مشاركة إيصال
- **فصل مخزن الكاشير** (`posWarehouseId` + قطاع RETAIL/GENERAL) — الكتالوج لا يخلط أصناف المطاعم

### 1.3 حسابي للمطاعم (`/resto`) — R1–R5 جزئي على main
- صالة وطاولات وطلبات + KDS بمحطات وتوجيه أصناف
- إغلاق مدفوع عبر `PosService.createSale` + إغلاق تشغيلي soft
- حجوزات + إجلاس يفتح طلباً · وصفات BOM (خصم مكونات للطبق غير المتتبَّع فقط)
- قائمة سفري `/resto/takeaway` · تنبيه صوتي KDS · فاتورة ضيف
- فصل مخزن المطاعم (`restoWarehouseId` + قطاع RESTAURANT)
- مرجع: [`HISABY-RESTAURANT-KITCHEN-PLAN.md`](./HISABY-RESTAURANT-KITCHEN-PLAN.md)

### 1.4 الربط والإشعارات والامتثال
- واتساب Cloud API + mock؛ إيميل Resend/SMTP/mock؛ إيصالات تلقائية بعد البيع
- `/integrations` + زر **اقرأني** (`GET /messaging/readme`)
- OTA: أوضاع `mock|sandbox|live` في `/vat` (`zatcaConfig`) — live ينتظر اعتماد الجهة
- مرفقات: `ATTACHMENT_STORAGE=dataurl|local|s3`
- مساعد AI قواعدي بإشراف بشري (`/ai-analytics` → Management Alerts)
- هيكل Capacitor في `mobile/` + `capacitor-ble.ts`
- دليل: [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md)

### 1.5 الأمن والحماية
- bcrypt(12)، JWT + refresh، 2FA TOTP، Helmet، throttling، dual-control
- **إلزام 2FA** عبر `REQUIRE_2FA_ROLES` (افتراضي ADMIN,MANAGER) + `require2faForAdmins` للشركة
- CORS مقيّد، منصّة إدارة من env، حد MIME/حجم للمرفقات، CSP أساسي على Next
- موجة H جزئية: [`HISABY-WAVE-H-SECURITY-UX-2026-07-26.md`](./HISABY-WAVE-H-SECURITY-UX-2026-07-26.md)
- موجة I: تدقيق دخول + إصلاح دوران صفحات إضافية + منارة أخطاء متصفح — [`HISABY-WAVE-I-STABILITY-AUDIT-2026-07-26.md`](./HISABY-WAVE-I-STABILITY-AUDIT-2026-07-26.md)
- موجة J: صدق أخطاء القوائم/التقارير + تحسين الدخول/التسجيل — [`HISABY-WAVE-J-ERROR-HONESTY-AUTH-2026-07-26.md`](./HISABY-WAVE-J-ERROR-HONESTY-AUTH-2026-07-26.md)
- موجة K: صدق قوائم إضافية + إدارة مستأجرين/مستخدمين + throttle أمن الشركة — [`HISABY-WAVE-K-LISTS-ADMIN-SECURITY-2026-07-26.md`](./HISABY-WAVE-K-LISTS-ADMIN-SECURITY-2026-07-26.md)
- موجة L: دليل حسابات/مطاعم/موافقات + إدارة billing/plans + throttles منصة/OTA — [`HISABY-WAVE-L-HONESTY-ADMIN-THROTTLE-2026-07-26.md`](./HISABY-WAVE-L-HONESTY-ADMIN-THROTTLE-2026-07-26.md)
- موجة M: POS مخزون/جهات + وصفات/إعدادات مطاعم + throttles مستأجرين/باقات/موافقات — [`HISABY-WAVE-M-POS-RESTO-ADMIN-THROTTLE-2026-07-26.md`](./HISABY-WAVE-M-POS-RESTO-ADMIN-THROTTLE-2026-07-26.md)
- موجة N: فواتير محاسبة + بوابات دفع + ورديات/سفري/توصيل + throttles دفعات/مستخدمين/VAT — [`HISABY-WAVE-N-INVOICES-PAYMENTS-SHIFTS-2026-07-26.md`](./HISABY-WAVE-N-INVOICES-PAYMENTS-SHIFTS-2026-07-26.md)
- موجة O: قائمة انتظار/حجوزات/مرفقات + إصلاح upsell كتب POS + throttles فترات/اشتراك/API/ورديات — [`HISABY-WAVE-O-WAITLIST-ATTACHMENTS-THROTTLE-2026-07-26.md`](./HISABY-WAVE-O-WAITLIST-ATTACHMENTS-THROTTLE-2026-07-26.md)
- موجة P: حوافز/ربط POS·مطاعم/تنبيهات + throttles checkout عام وAI وFX — [`HISABY-WAVE-P-INCENTIVES-LINKS-ALERTS-2026-07-26.md`](./HISABY-WAVE-P-INCENTIVES-LINKS-ALERTS-2026-07-26.md)
- موجة Q: لوحات التطبيقات/حجز عام/قائمة صالة + throttles void/close/رصيد متجر — [`HISABY-WAVE-Q-APPS-RESERVE-MENU-2026-07-26.md`](./HISABY-WAVE-Q-APPS-RESERVE-MENU-2026-07-26.md)
- موجة R: صدق كاشير (boot/كتالوج/إيصالات) + throttles دفعات/مخزون/بنوك/KDS — [`HISABY-WAVE-R-POS-MONEY-THROTTLE-2026-07-26.md`](./HISABY-WAVE-R-POS-MONEY-THROTTLE-2026-07-26.md)
- موجة S: صدق معلّق/مشتريات/طابور أوفلاين + throttles جرد/تسليم/رواتب/قيود — [`HISABY-WAVE-S-POS-PARK-QUEUE-THROTTLE-2026-07-26.md`](./HISABY-WAVE-S-POS-PARK-QUEUE-THROTTLE-2026-07-26.md)
- موجة T: throttles مطالبات/التزامات/مجدولة/أوامر شراء/مشاركة فواتير + نقل·دمج·تقسيم مطاعم — [`HISABY-WAVE-T-MONEY-RESTO-THROTTLE-2026-07-26.md`](./HISABY-WAVE-T-MONEY-RESTO-THROTTLE-2026-07-26.md)
- موجة U: KDS/86/إشعارات + تسوية بنوك + صدق طاقم الصالة — [`HISABY-WAVE-U-KDS-BANK-STAFF-2026-07-26.md`](./HISABY-WAVE-U-KDS-BANK-STAFF-2026-07-26.md)
- موجة V: صدق محطات/معدّلات صالة + قائمة + ربط التطبيقات — [`HISABY-WAVE-V-RESTO-APPS-HONESTY-2026-07-26.md`](./HISABY-WAVE-V-RESTO-APPS-HONESTY-2026-07-26.md)
- موجة W: صدق شريط كاشير/قائمة 86 + throttles صالة وربط مخزن — [`HISABY-WAVE-W-POS-OPS-86-RESTO-THROTTLE-2026-07-26.md`](./HISABY-WAVE-W-POS-OPS-86-RESTO-THROTTLE-2026-07-26.md)
- موجة X: صدق مخازن الورديات + throttles أصناف طلب/حسابات/خروج — [`HISABY-WAVE-X-SHIFTS-ITEMS-ACCOUNTS-2026-07-26.md`](./HISABY-WAVE-X-SHIFTS-ITEMS-ACCOUNTS-2026-07-26.md)
- موجة Y: صدق مستلم البقشيش + throttles قائمة/جهات/منتجات/مخازن/فروع — [`HISABY-WAVE-Y-TIP-STAFF-MENU-CRUD-2026-07-26.md`](./HISABY-WAVE-Y-TIP-STAFF-MENU-CRUD-2026-07-26.md)
- موجة Z: صدق وردية الشِل + throttles فواتير/بنوك/أصول/رواتب/مراكز/مشاريع — [`HISABY-WAVE-Z-SHELL-INVOICE-ERP-2026-07-26.md`](./HISABY-WAVE-Z-SHELL-INVOICE-ERP-2026-07-26.md)
- موجة AA: صدق حالة الربط POS·مطاعم + throttles مرفقات/ضريبة/قوالب/صرف/مطالبات — [`HISABY-WAVE-AA-LINK-STATUS-MISC-THROTTLE-2026-07-26.md`](./HISABY-WAVE-AA-LINK-STATUS-MISC-THROTTLE-2026-07-26.md)
- موجة AB: إكمال throttles CRUD (التزامات/أوامر شراء/مجدولة/جرد/تسليم/API keys…) + صدق تذييل إيصال الكاشير — [`HISABY-WAVE-AB-CRUD-THROTTLE-COMPLETE-2026-07-26.md`](./HISABY-WAVE-AB-CRUD-THROTTLE-COMPLETE-2026-07-26.md)
- موجة AC: صلاحيات VIEWER/مطالبات/شركة/فترات + صدق EOD ورديات وKDS وولاء — [`HISABY-WAVE-AC-ROLES-EOD-HONESTY-2026-07-26.md`](./HISABY-WAVE-AC-ROLES-EOD-HONESTY-2026-07-26.md)
- موجة AD: صلاحيات قيود/دليل/بنوك/رواتب/ضريبة + activate ربط + صدق KPIs — [`HISABY-WAVE-AD-ROLES-KPI-HONESTY-2026-07-26.md`](./HISABY-WAVE-AD-ROLES-KPI-HONESTY-2026-07-26.md)
- موجة AE: صلاحيات أصول/صرف/FX/رصيد متجر/مراكز/مشاريع/موظفين/فروع/مستودعات — [`HISABY-WAVE-AE-ERP-ROLES-2026-07-26.md`](./HISABY-WAVE-AE-ERP-ROLES-2026-07-26.md)
- موجة AF: تحصيل فواتير/مخزون + PartialType ERP + اشتراك ADMIN + صدق بنوك — [`HISABY-WAVE-AF-PAYMENTS-STOCK-PARTIALTYPE-2026-07-26.md`](./HISABY-WAVE-AF-PAYMENTS-STOCK-PARTIALTYPE-2026-07-26.md)
- موجة AG: صلاحيات التزامات/جرد/تسليم/مجدولة + صدق بنوك التحصيل والمطالبات — [`HISABY-WAVE-AG-COMMITMENTS-STOCK-BANK-HONESTY-2026-07-26.md`](./HISABY-WAVE-AG-COMMITMENTS-STOCK-BANK-HONESTY-2026-07-26.md)
- موجة AH: عكس GL عند unsend + حذف مسودة فقط + صلاحيات دورة فاتورة/أوامر شراء — [`HISABY-WAVE-AH-INVOICE-GL-LIFECYCLE-2026-07-26.md`](./HISABY-WAVE-AH-INVOICE-GL-LIFECYCLE-2026-07-26.md)
- موجة AI: عكس استحقاق مطالبات/رواتب + تحرير فاتورة DRAFT فقط + مشتريات بعد إلغاء دفع → SENT + `/health/ready` — [`HISABY-WAVE-AI-GL-CLAIMS-PAYROLL-INVOICE-2026-07-26.md`](./HISABY-WAVE-AI-GL-CLAIMS-PAYROLL-INVOICE-2026-07-26.md)
- موجة AJ: إلغاء فاتورة يعكس الدفعات + حذف قيد آمن + إلغاء مطعم يلغي فاتورة الدفع + صلاحيات جهات/مرفقات/تنبيهات + PartialType PO/مجدول — [`HISABY-WAVE-AJ-CANCEL-JOURNAL-ROLES-2026-07-26.md`](./HISABY-WAVE-AJ-CANCEL-JOURNAL-ROLES-2026-07-26.md)
- موجة AK: عكس نقد POS + عكس صرف مطالبات + سلامة إهلاك أصول + إلغاء تسليم يعيد المخزون + صلاحيات checkout/share — [`HISABY-WAVE-AK-POS-CLAIM-ASSET-DELIVERY-2026-07-26.md`](./HISABY-WAVE-AK-POS-CLAIM-ASSET-DELIVERY-2026-07-26.md)
- موجة AL: عكس صرف رواتب + عكس تحويل بنكي + عكس استحقاق التزامات + upgrade ADMIN + dual على عكس دفعة — [`HISABY-WAVE-AL-PAYROLL-BANK-COMMIT-2026-07-26.md`](./HISABY-WAVE-AL-PAYROLL-BANK-COMMIT-2026-07-26.md)
- موجة AM: عكس FX + عكس صرف عمولة + عكس إهلاك أصل + حماية حذف بنك + dual FX/عمولة — [`HISABY-WAVE-AM-FX-COMMISSION-ASSET-BANK-2026-07-26.md`](./HISABY-WAVE-AM-FX-COMMISSION-ASSET-BANK-2026-07-26.md)
- موجة AN: عكس رصيد متجر + حماية حذف فرع/مستودع/مركز/موظف + dual رصيد متجر — [`HISABY-WAVE-AN-STORE-CREDIT-ERP-DELETE-2026-07-26.md`](./HISABY-WAVE-AN-STORE-CREDIT-ERP-DELETE-2026-07-26.md)
- موجة AO: حماية حذف مشروع/حساب/ضريبة + `apiErrorMessage` على صفحات ERP — [`HISABY-WAVE-AO-ERP-DELETE-FE-HONESTY-2026-07-26.md`](./HISABY-WAVE-AO-ERP-DELETE-FE-HONESTY-2026-07-26.md)

### 1.6 المنصة ولوحة الإدارة (محدث 26 يوليو مساءً)
- اشتراكات، بوابات دفع، `/admin`، PWA، GeoIP، keep-warm
- **صلاحيات باقات هرمية** + أعمدة مقارنة جنبًا إلى جنب في `/admin/plans`
- **تخفيض سنوي %** مع مزامنة شهري↔سنوي · `GET /public/plans` · تبديل تسعير في الصفحة الرئيسية
- **مقارنة باقات للعميل** — زر بجانب شهري/سنوي في `#pricing` يعرض جدول الفوارق من `highlights`
- **مستخدمو المنصة** قائمة+لوحة تفاصيل · **مستخدمو الشركة** شجرة صلاحيات حسب الدور
- ترقية يدوية + تخفيض دائم للشركة · نائب مالك · صيانة · MOCK_CARD · تذكير انتهاء اشتراك
- توثيق مفصّل: [`HISABY-ADMIN-PLANS-USERS-PRICING-2026-07-26.md`](./HISABY-ADMIN-PLANS-USERS-PRICING-2026-07-26.md) · مقارنة الصفحة الرئيسية: [`HISABY-LANDING-PLAN-COMPARE-2026-07-26.md`](./HISABY-LANDING-PLAN-COMPARE-2026-07-26.md)

---

## 2) ما تبقّى (صادق)

| البند | الحالة | أولوية |
|-------|--------|--------|
| **OTA live** HTTP رسمي | sandbox/mock جاهز؛ live يحتاج اعتماد/عقد API | عالية |
| **NFC tap-to-pay جهاز طرفي** | دفع شريك بوابة منجز؛ الجهاز مؤجّل | متوسطة |
| بناء **Capacitor** أصلي | هيكل فقط | متوسطة |
| طباعة **BLE** موثوقة لكل البائعين | stubs + Serial أساس | منخفضة–متوسطة |
| **LLM خارجي** | مساعد قواعدي HITL فقط | منخفضة |
| **2FA إلزامي** لـ ADMIN/MANAGER | منجز جزئياً — env + شركة + شريط تنبيه؛ WAF/Sentry لاحقاً | عالية أمنياً (متبقٍ WAF) |
| WAF / حماية بوتات | غير موجود | عالية إنتاج |
| واتساب/إيميل إنتاجي 100% | يحتاج أسرار env على Render | متوسطة |
| مطاعم: معدّلات / توصيل / SSE / كورسات / انتظار / 86 / void+expo / QR ضيف / طباعة QR | منجز على main | منخفضة |
| استقرار DNS / cold start | تشغيلي | مستمرة |

---

## 3) الأمن السيبراني — تقييم صادق

**المستوى:** أعلى من MVP · يحتاج hardening إنتاجي · ليس «enterprise مغلقاً».  
لا ضمان «غير قابل للاختراق». راجع `SECURITY.md`.

```text
NODE_ENV=production
JWT_SECRET / JWT_REFRESH_SECRET / PAYMENT_SECRETS_KEY = قوية
CORS_ORIGIN = نطاقك فقط
PLATFORM_ADMIN_EMAILS = مشغّلون فقط
npx prisma migrate deploy
```

**Migrations مطاعم/مخازن مهمة:**  
`resto_product_station_reservations` · `app_warehouse_sector_bind` · `resto_recipes_bom`

---

## 4) أين يذهب Hisaby؟

محاسبة سحابية عربية + كاشير حقيقي + مطاعم/مطبخ للخليج، بهوية عُمانية. التميّز: امتثال OTA، كاشير↔GL واحد، dual-control عملي، فصل قطاعات المخزون، أوفلاين متجر، مدفوعات خليجية.

---

## 5) موجات قادمة

- **H** تثبيت إنتاج: migrations، 2FA إلزامي، WAF، Sentry
- **I** OTA live عند توفر الاعتماد
- **J** جهاز tap-to-pay طرفي إن لزم
- **K** Capacitor build إن فشلت PWA
- **L** تحسينات UX onboarding وقوالب قطاعات
- **Resto** تكامل تطبيقات توصيل

---

## 6) مراجع

- [`HISABY-STATUS-AND-GAPS.md`](./HISABY-STATUS-AND-GAPS.md)
- [`HISABY-RESTAURANT-KITCHEN-PLAN.md`](./HISABY-RESTAURANT-KITCHEN-PLAN.md)
- [`HISABY-POS-AND-SECURITY-ROADMAP.md`](./HISABY-POS-AND-SECURITY-ROADMAP.md)
- [`HISABY-SESSION-REPORT.md`](./HISABY-SESSION-REPORT.md)
- [`RESTO-R1-QUICKSTART.md`](./RESTO-R1-QUICKSTART.md)
- [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md)
