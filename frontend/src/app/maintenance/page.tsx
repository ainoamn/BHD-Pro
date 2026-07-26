"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";

export default function MaintenancePage() {
  const locale = useLocaleStore((s) => s.locale);
  const en = locale === "en";
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [message, setMessage] = useState<string>("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    api
      .getPublicMaintenance()
      .then((res) => {
        const d = res.data;
        setEnabled(!!d.enabled);
        setMessage(en ? d.messageEn || d.messageAr : d.messageAr || d.messageEn);
      })
      .catch(() => {
        setMessage(
          en
            ? "The platform is temporarily unavailable. Please try again later."
            : "المنصة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.",
        );
      });
  }, [en]);

  return (
    <div
      className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-6"
      dir={en ? "ltr" : "rtl"}
    >
      <div className="max-w-lg w-full text-center space-y-5">
        <Image
          src="/brand/hisaby-mark.png"
          alt="Hisaby"
          width={56}
          height={56}
          className="mx-auto rounded-xl"
        />
        <h1 className="text-2xl font-extrabold text-teal-950">
          {en ? "Under maintenance" : "تحت الصيانة"}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
          {message ||
            (en
              ? "We are performing scheduled maintenance. Thank you for your patience."
              : "نقوم حالياً بصيانة مجدولة. شكراً لصبركم.")}
        </p>
        {!enabled ? (
          <Link
            href="/dashboard"
            className="inline-block text-sm font-bold text-teal-800 hover:underline"
          >
            {en ? "Back to app" : "العودة للتطبيق"}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setLocale(en ? "ar" : "en")}
          className="block mx-auto text-xs font-bold text-slate-500 hover:text-teal-800"
        >
          {en ? "العربية" : "EN"}
        </button>
      </div>
    </div>
  );
}
