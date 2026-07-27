"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth";

export default function RestoContactsPage() {
  const locale = useAuthStore((s) => (s.user?.company?.language === "en" ? "en" : "ar"));
  const en = locale === "en";

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-stone-100 space-y-4">
        <h1 className="text-2xl font-bold">
          {en ? "Shared contacts" : "دفتر العناوين الموحد"}
        </h1>
        <p className="text-sm text-stone-300">
          {en
            ? "Restaurants use the same company contact directory as accounting and POS. Open the shared directory to choose guests, customers, or business contacts without duplicating records."
            : "المطاعم تستخدم نفس دفتر العناوين الموحد الخاص بالشركة والمشترك مع المحاسبة والكاشير. افتح الدفتر الموحد لاختيار الضيوف والعملاء وجهات الاتصال بدون تكرار السجلات."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/contacts"
            className="inline-flex rounded-xl bg-emerald-500 px-4 py-2 font-bold text-white"
          >
            {en ? "Open shared contacts" : "فتح دفتر العناوين"}
          </Link>
          <Link
            href="/resto"
            className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-stone-200"
          >
            {en ? "Back to restaurants" : "العودة إلى المطاعم"}
          </Link>
        </div>
      </div>
    </div>
  );
}
