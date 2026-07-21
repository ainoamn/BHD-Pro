"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle, XCircle } from "lucide-react";

export default function PaySuccessContent() {
  const t = useTranslations("payments");
  const searchParams = useSearchParams();
  const paid = searchParams.get("paid") === "1";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        {paid ? (
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
        ) : (
          <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
        )}
        <h1 className="text-xl font-bold text-white">
          {paid ? t("paymentSuccess") : t("paymentFailed")}
        </h1>
        <p className="text-slate-400 text-sm">{t("paymentSuccessHint")}</p>
      </div>
    </div>
  );
}
