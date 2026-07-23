export type LandingLocale = "ar" | "en";

export const landingCopy = {
  ar: {
    brand: "حسابي",
    brandEn: "Hisaby",
    navFeatures: "المزايا",
    navPricing: "الباقات",
    navCompany: "الشركة",
    login: "تسجيل الدخول",
    register: "ابدأ مجاناً",
    dashboard: "لوحة التحكم",
    headline: "نظام محاسبة سحابي لأصحاب الأعمال في عُمان",
    subhead:
      "فواتير، مخزون، ضريبة، وتقارير مالية من منصة واحدة — بسيطة وسريعة وبالعربية.",
    trustLine: "يشغّله فريق شركة بن حمود للتطوير",
    featuresTitle: "كل ما تحتاجه لإدارة أعمالك",
    featuresSub: "واجهة واضحة تغطي المحاسبة اليومية دون تعقيد.",
    features: [
      {
        title: "الفوترة وعروض الأسعار",
        body: "أنشئ فواتير وإيصالات وعروض أسعار بعلامتك التجارية ورمز تحقق QR.",
      },
      {
        title: "المخزون والمشتريات",
        body: "تابع المنتجات والموردين وأوامر الشراء من مكان واحد.",
      },
      {
        title: "الضريبة والتقارير",
        body: "تقارير مالية وضريبة قيمة مضافة جاهزة لمتابعة أداء شركتك.",
      },
      {
        title: "فريق وصلاحيات",
        body: "أضف مستخدمين بأدوار مختلفة وتحكم بما يراه كل عضو.",
      },
      {
        title: "اشتراك مرن",
        body: "باقات تناسب الشركات الناشئة والمتوسطة مع ترقية عند الحاجة.",
      },
      {
        title: "دخول آمن",
        body: "تسجيل بكلمة مرور أو Google، مع حماية إضافية للحسابات الإدارية.",
      },
    ],
    pricingTitle: "باقات واضحة بالريال العماني",
    pricingSub: "ابدأ صغيرًا ووسّع عندما ينمو عملك.",
    plans: [
      { name: "بدائية", price: "5", unit: "ر.ع / شهر", note: "للأعمال الصغيرة" },
      { name: "محترفة", price: "15", unit: "ر.ع / شهر", note: "الأكثر اختيارًا", featured: true },
      { name: "مؤسسية", price: "35", unit: "ر.ع / شهر", note: "بلا حدود عملية" },
    ],
    companyTitle: "الشركة المالكة والمشغّلة",
    companyName: "شركة بن حمود للتطوير",
    companyNameEn: "Bin Hamood Development",
    companyBody:
      "حسابي (Hisaby) منتج سحابي مطوّر ومشغّل بواسطة شركة بن حمود للتطوير — شركة عُمانية تبني حلولًا تقنية عملية للشركات المحلية.",
    companyCta: "تعرّف على المنتج وابدأ تجربتك",
    footerTag: "محاسبة عُمانية بسيطة وموثوقة",
    footerRights: "جميع الحقوق محفوظة",
    langSwitch: "English",
  },
  en: {
    brand: "Hisaby",
    brandEn: "حسابي",
    navFeatures: "Features",
    navPricing: "Plans",
    navCompany: "Company",
    login: "Sign in",
    register: "Start free",
    dashboard: "Dashboard",
    headline: "Cloud accounting for businesses in Oman",
    subhead:
      "Invoices, inventory, VAT, and financial reports in one fast Arabic-first platform.",
    trustLine: "Built and operated by Bin Hamood Development",
    featuresTitle: "Everything you need to run the books",
    featuresSub: "A clear interface for daily accounting — without the clutter.",
    features: [
      {
        title: "Invoicing & quotes",
        body: "Create branded invoices, receipts, and quotations with verification QR codes.",
      },
      {
        title: "Inventory & purchasing",
        body: "Track products, suppliers, and purchase orders in one place.",
      },
      {
        title: "VAT & reports",
        body: "Financial and VAT reports ready to monitor your company performance.",
      },
      {
        title: "Team & roles",
        body: "Invite users with roles so each person sees only what they need.",
      },
      {
        title: "Flexible plans",
        body: "Starter to enterprise packages in Omani Rial — upgrade when you grow.",
      },
      {
        title: "Secure access",
        body: "Sign in with password or Google, with stronger protection for admins.",
      },
    ],
    pricingTitle: "Simple plans in OMR",
    pricingSub: "Start small. Scale when your business grows.",
    plans: [
      { name: "Starter", price: "5", unit: "OMR / mo", note: "For small teams" },
      { name: "Professional", price: "15", unit: "OMR / mo", note: "Most popular", featured: true },
      { name: "Enterprise", price: "35", unit: "OMR / mo", note: "For growing orgs" },
    ],
    companyTitle: "Owner & operator",
    companyName: "Bin Hamood Development",
    companyNameEn: "شركة بن حمود للتطوير",
    companyBody:
      "Hisaby is designed, built, and operated by Bin Hamood Development — an Omani technology company focused on practical tools for local businesses.",
    companyCta: "Explore the product and start today",
    footerTag: "Simple, reliable Omani accounting",
    footerRights: "All rights reserved",
    langSwitch: "العربية",
  },
} as const;
