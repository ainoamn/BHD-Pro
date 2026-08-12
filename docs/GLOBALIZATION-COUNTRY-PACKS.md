# بنية Country Packs والتوسع الدولي

## الأساس المضاف

يوفر `country-packs.ts` حزم OM/AE/SA/BH/QA/KW تشمل الدولة، العملة، عدد المنازل، المنطقة الزمنية، اللغة، VAT الافتراضية، ومعرّف محول الفوترة الإلكترونية. التسجيل يختار الحزمة بدلاً من افتراض عُمان/OMR لكل شركة.

## قاعدة التصميم

Country Pack هو سياسة versioned وليس مجموعة `if` داخل الخدمات. يجب فصل:

- تنسيق وعرض العملة عن قيمة Decimal المخزنة.
- الضريبة الافتراضية عن قرار ضريبة كل صنف/عميل.
- e-invoice adapter عن نموذج الفاتورة الأساسي.
- الترجمة عن النصوص المخزنة في قاعدة البيانات.
- timezone الشركة عن وقت UTC في السجلات.

## عقد الحزمة المستقبلي

كل حزمة تحتاج: `code`, `version`, `currency`, `currencyScale`, `timezone`, `locales`, `taxRules`, `invoiceNumberPolicy`, `fiscalYear`, `eInvoiceAdapter`, `validationSchemas`, `legalTextRefs`, واختبارات golden invoices. التغيير النظامي ينشئ إصداراً جديداً ولا يبدل نتائج مستندات تاريخية.

## خطة الوصول للعالمية

1. **الخليج:** إكمال VAT/e-invoice adapters وعينات رسمية لكل دولة، مع مستشار محلي.
2. **متعدد العملات:** دفتر أساس base currency، أسعار صرف مؤرخة، gains/losses وrounding policy.
3. **i18n:** إزالة النصوص الصلبة، pluralization وRTL/LTR، تنسيقات أرقام/تواريخ عبر Intl.
4. **Data residency:** خريطة المنطقة القانونية، DPA/subprocessors، retention وحق التصدير/الحذف.
5. **تشغيل عالمي:** CDN، multi-region DR، مراقبة SLO، دعم المناطق الزمنية، وسياسة إصدار متوافقة للخلف.
6. **ثقة السوق:** pentest مستقل، برنامج disclosure، أدلة controls، ثم شهادات يحددها السوق؛ لا تدّع شهادة قبل اكتمال التدقيق المستقل.

## Definition of done لدولة جديدة

- مراجعة ضريبية وقانونية معتمدة.
- golden invoice/credit note/receipt باللغة والعملات الصحيحة.
- اختبارات rounding وحدود VAT والتواريخ والتوقيت الصيفي.
- sandbox ناجح مع الجهة/مزود e-invoice إن وجد.
- شروط وخصوصية ودعم وrunbook حادث محلية.
