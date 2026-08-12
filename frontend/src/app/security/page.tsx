import { TrustDocument } from "@/components/public/trust-document";

export default function SecurityPage() {
  return (
    <TrustDocument title="الأمان والثقة · Security & Trust" updated="2026-08-11">
      <section><h2>الحماية المطبقة</h2><ul><li>عزل بيانات الشركات والتحقق المركزي من الأدوار والوحدات.</li><li>مصادقة ثنائية، جلسات قابلة للإلغاء، ومفاتيح API محدودة النطاق والانتهاء.</li><li>تشفير أسرار البوابات وTOTP بمفاتيح منفصلة وقابلة للتدوير.</li><li>حماية CSRF وXSS وSSRF ورؤوس متصفح مشددة.</li><li>سجلات تدقيق منقحة من الأسرار واختبارات انحدار أمنية في CI.</li></ul></section>
      <section><h2>الإبلاغ المسؤول</h2><p>لا تختبر بيانات أو حسابات لا تملكها. أرسل وصفاً قابلاً لإعادة الإنتاج وأثر المشكلة إلى قناة الدعم الأمنية المعتمدة، وتجنب نشر التفاصيل قبل المعالجة.</p></section>
      <section><h2>حدود الشهادات</h2><p>هذه الصفحة تصف ضوابط تقنية ولا تدّعي شهادة PCI DSS أو SOC 2 أو ISO 27001 ما لم تعلن شهادة مستقلة سارية.</p></section>
      <hr /><section lang="en"><h2>English summary</h2><p>Hisaby uses tenant isolation, centralized authorization, scoped API keys, revocable sessions, purpose-separated secret encryption, hardened browser controls, and security regression testing. These controls are not a claim of independent certification.</p></section>
    </TrustDocument>
  );
}
