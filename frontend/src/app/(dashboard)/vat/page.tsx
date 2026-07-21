"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Send, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, EmptyState, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

interface VatInvoice {
  id: string;
  number: string;
  date: string;
  total: number;
  taxAmount: number;
  status: string;
  vatUuid?: string;
  contact?: { name: string; taxId?: string };
}

interface VatStats {
  submitted: number;
  pending: number;
  total: number;
}

export default function VatPage() {
  const t = useTranslations("vat");
  const tStatus = useTranslations("status");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["vat-invoices"],
    queryFn: async () => {
      const res = await api.getVatInvoices();
      return res.data as VatInvoice[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["vat-stats"],
    queryFn: async () => {
      const res = await api.getVatStats();
      return res.data as VatStats;
    },
  });

  const submitMutation = useMutation({
    mutationFn: (invoiceId: string) => api.submitVatInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["vat-stats"] });
      toast.success(t("submitted"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t("submitError"));
    },
  });

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      PAID: "bg-emerald-500/10 text-emerald-400",
      SENT: "bg-blue-500/10 text-blue-400",
      DRAFT: "bg-slate-500/10 text-slate-400",
      OVERDUE: "bg-rose-500/10 text-rose-400",
    };
    return map[status] || "bg-amber-500/10 text-amber-400";
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      PAID: tStatus("paid"),
      SENT: tStatus("sent"),
      DRAFT: tStatus("draft"),
      OVERDUE: tStatus("overdue"),
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t("totalInvoices"), value: stats?.total ?? 0 },
          { label: t("submitted"), value: stats?.submitted ?? 0, color: "text-emerald-400" },
          { label: t("pending"), value: stats?.pending ?? 0, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className={cn("text-xl font-bold mt-1", s.color || "text-white")}>{s.value}</p>
          </div>
        ))}
      </div>

      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileText} title={t("noInvoices")} description={t("noInvoicesDesc")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("number")}</th>
                  <th className="text-right p-4 font-medium">{t("customer")}</th>
                  <th className="text-right p-4 font-medium">{t("date")}</th>
                  <th className="text-right p-4 font-medium">{t("amount")}</th>
                  <th className="text-right p-4 font-medium">{t("vat")}</th>
                  <th className="text-right p-4 font-medium">{t("status")}</th>
                  <th className="text-right p-4 font-medium">{t("ota")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-white font-medium">{inv.number}</td>
                    <td className="p-4 text-slate-300">{inv.contact?.name || "—"}</td>
                    <td className="p-4 text-slate-400">{formatDate(inv.date)}</td>
                    <td className="p-4 text-white">{formatMoney(Number(inv.total), currency)}</td>
                    <td className="p-4 text-slate-300">{formatMoney(Number(inv.taxAmount), currency)}</td>
                    <td className="p-4">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColor(inv.status))}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="p-4">
                      {inv.vatUuid ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <CheckCircle className="w-4 h-4" />
                          {t("cleared")}
                        </span>
                      ) : inv.status !== "DRAFT" ? (
                        <button
                          onClick={() => submitMutation.mutate(inv.id)}
                          disabled={submitMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 disabled:opacity-50"
                        >
                          {submitMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {t("submitOta")}
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">{t("sendFirst")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
