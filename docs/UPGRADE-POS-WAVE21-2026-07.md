# ترقية Hisaby — Wave 21: تسعير حسب فترة اليوم (يوليو 2026)

**الهدف:** أسعار مختلفة للفطور / الغداء / العشاء / الفترة الليلية مع الإبقاء على `salePrice` كسعر أساسي.

## ما شُحن

1. **مخطط المنتج**
   - حقل `Product.dayPartPrices` (JSON): `{ "breakfast": 2.5, "lunch": 3.0, ... }`
   - المفتاح الناقص أو الكائن الفارغ = استخدام `salePrice`
   - Migration: `20260726190000_product_day_part_prices`

2. **Backend**
   - `resolveDayPartSalePrice()` — يحسب السعر الفعّال حسب الفترة الحالية للشركة
   - `GET /resto/menu` يعيد:
     - `price` = السعر الفعّال الآن
     - `basePrice` = السعر الأساسي
     - `dayPartPrices` = خريطة التجاوزات
   - `addItem` (أرضية + ضيف QR) يختم `unitPrice` بالسعر الفعّال + الإضافات
   - `PATCH /resto/menu/:productId/day-part-prices`

3. **Frontend**
   - `/resto/menu` — محرر أسعار لكل فترة (فارغ = أساسي)
   - قائمة الضيف `/order/[token]` تستهلك `price` من الـ API كما هي

## النشر

```bash
npx prisma migrate deploy
```

## مؤجّل (موجات لاحقة)

- عربون الحجز الإلكتروني (deposits) على `/reserve`
- SoftPOS · كوبونات · لوحة متعددة الشركات
