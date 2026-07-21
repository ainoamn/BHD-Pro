"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import api from "@/lib/api";

export default function CheckoutSuccessContent() {
  const t = useTranslations("payments");
  const searchParams = useSearchParams();
  const invoiceNumber = searchParams.get("invoice");
  const paid = searchParams.get("paid") === "1";

  const { data, isLoading } = useQuery({
    queryKey: ["billing-invoice", invoiceNumber],
    queryFn: async () => {
      if (!invoiceNumber) return null;
      const res = await api.getBillingInvoice(invoiceNumber);
      return res.data as { status: string; description: string };
    },
    enabled: !!invoiceNumber && paid,
  });

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        {paid ? (
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
        ) : (
          <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
        )}
        <h1 className="text-xl font-bold text-white">
          {paid ? t("paymentSuccess") : t("paymentFailed")}
        </h1>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
        ) : (
          data && <p className="text-slate-400 text-sm">{data.description}</p>
        )}
        <Link
          href="/subscription"
          className="inline-block mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
        >
          {t("backToSubscription")}
        </Link>
      </div>
    </div>
  );
}
