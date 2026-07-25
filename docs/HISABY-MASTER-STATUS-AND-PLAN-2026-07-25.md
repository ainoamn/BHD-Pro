# Hisaby — الحالة الكاملة وخطة التطوير
**آخر تحديث:** 25 يوليو 2026 · ~16:35 Asia/Muscat  
**المصدر المعتمد:** فرع `main` على GitHub (`ainoamn/BHD-Pro`) — متزامن مع `origin/main`.

---

## 0) خلاصة تنفيذية

| السؤال | الجواب |
|--------|--------|
| هل كل ما بُرمج مرفوع؟ | **نعم** على `main` بعد موجات يوليو 2026 (محاسبة A–G، POS، أمن، ربط واتساب/إيميل، OTA config-ready، S3، AI HITL، دفع شريك بوابة، عمولة/ولاء). أي WIP محلي غير مكتمل يُرفض ولا يُعتبر منجزاً. |
| هل الموقع «غير قابل للاختراق»؟ | **لا يوجد نظام غير قابل للاختراق.** Hisaby في مستوى **صلب لبيتا SaaS** مع طبقات حماية حقيقية؛ يحتاج استكمال hardening إنتاجي (WAF، 2FA إلزامي للإدارة، مراقبة). |
| أين يذهب المنتج؟ | منصة محاسبة + كاشير خليجية (عُمان أولاً): امتثال ضريبي، مدفوعات محلية، أوفلاين قوي، ومساعد ذكي بشري-في-الحلقة. |

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

### 1.3 الربط والإشعارات والامتثال (موجة يوليو مساءً)
- واتساب Cloud API + mock؛ إيميل Resend/SMTP/mock؛ إيصالات تلقائية بعد البيع
- `/integrations` + زر **اقرأني** (`GET /messaging/readme`)
- OTA: أوضاع `mock|sandbox|live` في `/vat` (`zatcaConfig`) — live ينتظر اعتماد الجهة
- مرفقات: `ATTACHMENT_STORAGE=dataurl|local|s3`
- مساعد AI قواعدي بإشراف بشري (`/ai-analytics` → Management Alerts)
- هيكل Capacitor في `mobile/` + `capacitor-ble.ts`
- دليل: [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md)

### 1.4 الأمن والحماية
- bcrypt(12)، JWT + refresh، 2FA اختياري، Helmet، throttling، dual-control
- CORS مقيّد، منصّة إدارة من env، حد MIME/حجم للمرفقات

### 1.5 المنصة
- اشتراكات، بوابات دفع، `/admin`، PWA، GeoIP، keep-warm

---

## 2) ما تبقّى (صادق)

| البند | الحالة | أولوية |
|-------|--------|--------|
| **OTA live** HTTP رسمي | sandbox/mock جاهز؛ live يحتاج اعتماد/عقد API | عالية |
| **NFC tap-to-pay جهاز طرفي** | دفع شريك بوابة منجز؛ الجهاز مؤجّل | متوسطة |
| بناء **Capacitor** أصلي | هيكل فقط | متوسطة |
| طباعة **BLE** موثوقة لكل البائعين | stubs + Serial أساس | منخفضة–متوسطة |
| **LLM خارجي** | مساعد قواعدي HITL فقط | منخفضة |
| 2FA **إلزامي** لـ ADMIN/MANAGER | اختياري اليوم | عالية أمنياً |
| WAF / حماية بوتات | غير موجود | عالية إنتاج |
| واتساب/إيميل إنتاجي 100% | يحتاج أسرار env على Render | متوسطة |
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

---

## 4) أين يذهب Hisaby؟

محاسبة سحابية عربية + كاشير حقيقي للخليج، بهوية عُمانية. التميّز: امتثال OTA، كاشير↔GL واحد، dual-control عملي، أوفلاين متجر، مدفوعات خليجية، مساعد بإشراف بشري.

---

## 5) موجات قادمة

- **H** تثبيت إنتاج: migrations، 2FA إلزامي، WAF، Sentry
- **I** OTA live عند توفر الاعتماد
- **J** جهاز tap-to-pay طرفي إن لزم
- **K** Capacitor build إن فشلت PWA
- **L** تحسينات UX onboarding وقوالب قطاعات

---

## 6) مطابقة الطلبات

| طلبك | الحالة |
|------|--------|
| محاسبة/POS/dual-control/رصيد متجر/X-Z | منجز على `main` |
| واتساب+إيميل+اقرأني | منجز |
| OTA / S3 / AI HITL / دفع شريك / أوفلاين مخزون | منجز **config-ready** |
| Capacitor/BLE | هيكل + stubs |
| عمولة كاشير + ولاء | منجز |
| شعارات عملاء مدفوعين في الرئيسية | منجز |
| نظام مطاعم ومطبخ كامل مربوط بالمحاسبة/POS | **خطة فقط** — [`HISABY-RESTAURANT-KITCHEN-PLAN.md`](./HISABY-RESTAURANT-KITCHEN-PLAN.md) — لم يبدأ التنفيذ |
| غير قابل للاختراق | طبقات قوية — **لا ضمان مطلق** |

---

## 7) بعد كل نشر

```bash
npx prisma migrate deploy
```

يشمل أحدثها: `customer_disputes`، `pos_incentives`. تحقق Vercel بعد دفع `main`.

---

## 8) المراسلات — حالة القرار (يوليو 2026 مساءً)

- **مبرمج ومرفوع:** واتساب Cloud API + إيميل + SMS + `/integrations` + اقرأني.
- **مؤجّل تشغيلياً:** اشتراك Meta / Resend حتى يتوفر الوقت.
- **المرجع:** [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)

**الخطوة التالية الآن:** تأكيد أن Render على آخر `main` حيّ · لا حاجة لـ Meta اليوم · عند الجاهزية نفّذ §8 في دليل المراسلات.

---

**خرائط مرتبطة:** [`HISABY-STATUS-AND-GAPS.md`](./HISABY-STATUS-AND-GAPS.md) · [`HISABY-POS-AND-SECURITY-ROADMAP.md`](./HISABY-POS-AND-SECURITY-ROADMAP.md) · [`INTEGRATIONS-MESSAGING-OTA.md`](./INTEGRATIONS-MESSAGING-OTA.md) · [`MESSAGING-WHATSAPP-EMAIL-GUIDE.md`](./MESSAGING-WHATSAPP-EMAIL-GUIDE.md)
