"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";

export default function PayInvoiceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.invoiceId as string;
  const t = useTranslations("payments");
  const cancelled = searchParams.get("cancelled");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-invoice-pay", invoiceId],
    queryFn: async () => {
      const res = await api.getPublicInvoicePayInfo(invoiceId);
      return res.data as {
        number: string;
        companyName: string;
        contactName: string;
        remaining: number;
        currency: string;
        gateways: { slug: string; nameAr: string; nameEn: string }[];
      };
    },
  });

  const payMutation = useMutation({
    mutationFn: (gatewaySlug: string) =>
      api.createPublicInvoiceCheckout(invoiceId, { gatewaySlug }),
    onSuccess: (res) => {
      const checkout = res.data as { checkout?: { redirectUrl?: string; kind?: string } };
      if (checkout.checkout?.redirectUrl) {
        window.location.href = checkout.checkout.redirectUrl;
      } else {
        toast.success(t("paymentSuccess"));
      }
    },
    onError: () => toast.error(t("paymentFailed")),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <p className="text-slate-400">{t("invoiceNotPayable")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="text-center">
          <CreditCard className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h1 className="text-lg font-bold text-white">{t("payInvoice")}</h1>
          <p className="text-sm text-slate-500 mt-1">{data.companyName}</p>
        </div>

        <div className="rounded-lg bg-slate-800/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{t("invoiceNumber")}</span>
            <span className="text-white font-medium">{data.number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{t("customer")}</span>
            <span className="text-white">{data.contactName}</span>
          </div>
          <div className="flex justify-between text-base pt-2 border-t border-slate-700">
            <span className="text-slate-300">{t("amountDue")}</span>
            <span className="text-emerald-400 font-bold">
              {formatMoney(data.remaining, data.currency)}
            </span>
          </div>
        </div>

        {cancelled && (
          <p className="text-amber-400 text-sm text-center">{t("paymentCancelled")}</p>
        )}

        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t("chooseGateway")}</p>
          {data.gateways.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noGateways")}</p>
          ) : (
            data.gateways.map((gw) => (
              <button
                key={gw.slug}
                type="button"
                disabled={payMutation.isPending}
                onClick={() => payMutation.mutate(gw.slug)}
                className="w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                {payMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {gw.nameAr}
              </button>
            ))
          )}
        </div>

        <p className="text-[10px] text-slate-600 text-center">{t("directPaymentNote")}</p>
      </div>
    </div>
  );
}
