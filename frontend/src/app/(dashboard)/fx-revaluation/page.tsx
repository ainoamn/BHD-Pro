"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, ArrowLeftRight } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard, EmptyState } from "@/components/ui/page-shell";

interface PreviewItem {
  invoiceId: string;
  number: string;
  type: string;
  currency: string;
  foreignRemaining: number;
  bookedBaseRemaining: number;
  rateAtInvoice: number;
  rateAsOf: number;
  revaluedBase: number;
  gainLoss: number;
  pnlImpact: number;
}

interface PreviewResult {
  asOf: string;
  companyCurrency: string;
  items: PreviewItem[];
  skipped: { invoiceId: string; number: string; reason: string }[];
  totals: {
    unrealizedGain: number;
    unrealizedLoss: number;
    net: number;
    count: number;
  };
}

export default function FxRevaluationPage() {
  const t = useTranslations("fxRevaluation");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const baseCurrency = useAuthStore((s) => s.user?.company?.currency) || "OMR";
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewKey, setPreviewKey] = useState(0);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["fx-revaluation-preview", asOf, previewKey],
    queryFn: async () => {
      const res = await api.previewFxRevaluation(asOf);
      return res.data as PreviewResult;
    },
  });

  const items = data?.items || [];
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.invoiceId));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.invoiceId)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const postMutation = useMutation({
    mutationFn: () =>
      api.postFxRevaluation({
        asOf,
        invoiceIds: selected.size ? Array.from(selected) : undefined,
      }),
    onSuccess: (res) => {
      const body = res.data as { journalNumber?: string; postedCount: number };
      toast.success(
        t("posted", { number: body.journalNumber || "", count: body.postedCount }),
      );
      setSelected(new Set());
      setPreviewKey((k) => k + 1);
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const handlePost = () => {
    if (!items.length) {
      toast.error(t("nothingToPost"));
      return;
    }
    if (!confirm(t("confirmPost"))) return;
    postMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/exchange-rates"
            className="text-sm text-emerald-400 hover:underline"
          >
            {t("manageRates")}
          </Link>
        }
      />

      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400">{t("asOf")}</label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
                setSelected(new Set());
              }}
              className="mt-1 block h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 h-10 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t("preview")}
          </button>
          <button
            type="button"
            onClick={handlePost}
            disabled={postMutation.isPending || !items.length}
            className="flex items-center gap-2 h-10 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg disabled:opacity-50"
          >
            {postMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("postJournal")}
          </button>
        </div>
        <p className="text-sm text-slate-400">{t("hint")}</p>
      </GlassCard>

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <GlassCard className="p-5 text-rose-400 text-sm">
          {(error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || tCommon("error")}
        </GlassCard>
      ) : !items.length ? (
        <EmptyState icon={ArrowLeftRight} title={t("empty")} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassCard className="p-4">
              <p className="text-xs text-slate-400">{t("unrealizedGain")}</p>
              <p className="text-lg font-semibold text-emerald-400 mt-1">
                {formatMoney(data?.totals.unrealizedGain || 0, baseCurrency)}
              </p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-slate-400">{t("unrealizedLoss")}</p>
              <p className="text-lg font-semibold text-rose-400 mt-1">
                {formatMoney(data?.totals.unrealizedLoss || 0, baseCurrency)}
              </p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-slate-400">{t("net")}</p>
              <p className="text-lg font-semibold text-white mt-1">
                {formatMoney(data?.totals.net || 0, baseCurrency)}
              </p>
            </GlassCard>
          </div>

          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-3">{t("invoice")}</th>
                  <th className="px-3 py-3">{t("type")}</th>
                  <th className="px-3 py-3">{t("currency")}</th>
                  <th className="px-3 py-3 text-end">{t("foreignRemaining")}</th>
                  <th className="px-3 py-3 text-end">{t("bookedBase")}</th>
                  <th className="px-3 py-3 text-end">{t("rateAsOf")}</th>
                  <th className="px-3 py-3 text-end">{t("revaluedBase")}</th>
                  <th className="px-3 py-3 text-end">{t("pnlImpact")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((row) => (
                  <tr key={row.invoiceId} className="hover:bg-slate-800/30">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.invoiceId)}
                        onChange={() => toggleOne(row.invoiceId)}
                      />
                    </td>
                    <td className="px-3 py-3 text-white font-medium">{row.number}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {row.type === "SALES" ? t("ar") : t("ap")}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{row.currency}</td>
                    <td className="px-3 py-3 text-end text-slate-300">
                      {formatMoney(row.foreignRemaining, row.currency)}
                    </td>
                    <td className="px-3 py-3 text-end text-slate-300">
                      {formatMoney(row.bookedBaseRemaining, baseCurrency)}
                    </td>
                    <td className="px-3 py-3 text-end text-slate-300">{row.rateAsOf}</td>
                    <td className="px-3 py-3 text-end text-slate-300">
                      {formatMoney(row.revaluedBase, baseCurrency)}
                    </td>
                    <td
                      className={`px-3 py-3 text-end font-medium ${
                        row.pnlImpact >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatMoney(row.pnlImpact, baseCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((row) => (
              <GlassCard key={row.invoiceId} className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <label className="flex items-center gap-2 text-white font-medium">
                    <input
                      type="checkbox"
                      checked={selected.has(row.invoiceId)}
                      onChange={() => toggleOne(row.invoiceId)}
                    />
                    {row.number}
                  </label>
                  <span
                    className={
                      row.pnlImpact >= 0 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {formatMoney(row.pnlImpact, baseCurrency)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {row.type === "SALES" ? t("ar") : t("ap")} · {row.currency} ·{" "}
                  {t("rateAsOf")} {row.rateAsOf}
                </p>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {!!data?.skipped?.length && (
        <GlassCard className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-amber-400">{t("skipped")}</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            {data.skipped.map((s) => (
              <li key={s.invoiceId}>
                {s.number}: {s.reason}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
