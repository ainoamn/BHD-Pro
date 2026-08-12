import { TrustDocument } from "@/components/public/trust-document";

export default function PrivacyPage() {
  return (
    <TrustDocument title="الخصوصية · Privacy" updated="2026-08-11">
      <section><h2>ملخص</h2><p>نجمع بيانات الحساب والشركة والمستندات التي تدخلها لتشغيل الخدمة، وحمايتها، وتقديم الدعم. لا نبيع البيانات الشخصية.</p></section>
      <section><h2>البيانات والاستخدام</h2><p>قد تشمل البيانات معلومات الدخول، سجلات الأمان، بيانات الفواتير والمخزون، وبيانات تقنية لازمة لمنع الاحتيال وتشخيص الأعطال.</p></section>
      <section><h2>المشاركة والاحتفاظ</h2><p>نشارك الحد الأدنى اللازم مع مزودي الاستضافة والبريد والدفع المتعاقدين. تختلف مدة الاحتفاظ حسب نوع السجل والالتزامات المحاسبية والقانونية.</p></section>
      <section><h2>حقوقك</h2><p>يمكن طلب الوصول أو التصحيح أو التصدير أو الحذف حيث يسمح القانون، مع التحقق من الهوية والاحتفاظ بما تفرضه الالتزامات النظامية.</p></section>
      <hr /><section lang="en"><h2>English summary</h2><p>We process account, company, business-document, security-log, and technical data to operate and protect Hisaby. We do not sell personal data. Access, correction, export, or deletion requests are handled subject to identity verification and legal retention duties.</p></section>
      <p className="text-sm text-amber-700 dark:text-amber-300">هذه مسودة تشغيلية ويجب اعتمادها قانونياً قبل الإطلاق التجاري في كل دولة.</p>
    </TrustDocument>
  );
}
