import { TrustDocument } from "@/components/public/trust-document";

export default function TermsPage() {
  return (
    <TrustDocument title="شروط الاستخدام · Terms" updated="2026-08-11">
      <section><h2>الخدمة والحساب</h2><p>أنت مسؤول عن صحة بياناتك، صلاحيات مستخدمي شركتك، حماية وسائل الدخول، والنسخ أو التصدير الذي تتطلبه سياساتك.</p></section>
      <section><h2>الاستخدام المقبول</h2><p>يحظر إساءة استخدام المنصة، اختراق حسابات الآخرين، رفع محتوى ضار، تجاوز القيود، أو استخدامها في نشاط غير قانوني.</p></section>
      <section><h2>الفوترة والتوافر</h2><p>تحدد الباقة والطلب التجاري الأسعار والحدود. نسعى لتوافر موثوق، لكن أعمال الصيانة والحوادث ومزودي الطرف الثالث قد تؤثر مؤقتاً.</p></section>
      <section><h2>المسؤولية</h2><p>المنصة أداة تشغيل ومحاسبة وليست بديلاً عن الاستشارة القانونية أو الضريبية المتخصصة.</p></section>
      <hr /><section lang="en"><h2>English summary</h2><p>You are responsible for account security, tenant-user permissions, lawful use, and the accuracy of business records. Hisaby is an operational accounting tool, not legal or tax advice. Commercial terms and plan limits apply.</p></section>
      <p className="text-sm text-amber-700 dark:text-amber-300">هذه مسودة تحتاج مراجعة واعتماداً قانونياً محلياً قبل النشر النهائي.</p>
    </TrustDocument>
  );
}
