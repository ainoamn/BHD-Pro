"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";
import { GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";
import { useAuthStore } from "@/store/auth";
import { formatMoney, formatDate } from "@/lib/utils";

interface RateRow {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  notes?: string | null;
}

const CURRENCIES = ["OMR", "USD", "EUR", "SAR", "AED", "KWD", "BHD", "QAR", "GBP"];

export default function ExchangeRatesPage() {
  const t = useTranslations("exchangeRates");
  const tCommon = useTranslations("common");
  const companyCurrency = useAuthStore((s) => s.user?.company?.currency) || "OMR";

  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState(companyCurrency);
  const [amount, setAmount] = useState(100);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState<{
    converted: number;
    rate: number;
    source: string;
    date?: string | null;
  } | null>(null);

  const convertMutation = useMutation({
    mutationFn: () => api.convertExchangeRate({ from, to, amount, date }),
    onSuccess: (res) => {
      const data = res.data as {
        converted: number;
        rate: number;
        source: string;
        date?: string | null;
      };
      setResult(data);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setResult(null);
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  return (
    <div className="space-y-6">
      <GlassCard className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("convertTitle")}</h2>
          <p className="text-sm text-slate-400 mt-1">{t("convertHint")}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400">{t("from")}</label>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">{t("to")}</label>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">{t("amount")}</label>
            <DecimalInput
              value={amount}
              onChange={setAmount}
              className="mt-1 w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">{t("date")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className="h-10 px-4 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {t("convert")}
          </button>
        </div>
        {result && (
          <p className="text-sm text-emerald-400">
            {formatMoney(amount, from)} → {formatMoney(result.converted, to)}{" "}
            <span className="text-slate-400">
              ({t("rate")}: {result.rate}
              {result.date ? ` · ${formatDate(String(result.date))}` : ""} · {result.source})
            </span>
          </p>
        )}
      </GlassCard>

      <ErpCrudPage<RateRow>
        title={t("title")}
        subtitle={t("subtitle")}
        queryKey="exchange-rates"
        emptyLabel={t("title")}
        fetchAll={() => api.getExchangeRates()}
        create={(d) =>
          api.createExchangeRate({
            fromCurrency: String(d.fromCurrency).toUpperCase(),
            toCurrency: String(d.toCurrency).toUpperCase(),
            rate: Number(d.rate),
            date: d.date,
            notes: d.notes || undefined,
          })
        }
        update={(id, d) =>
          api.updateExchangeRate(id, {
            fromCurrency: String(d.fromCurrency).toUpperCase(),
            toCurrency: String(d.toCurrency).toUpperCase(),
            rate: Number(d.rate),
            date: d.date,
            notes: d.notes || undefined,
          })
        }
        remove={(id) => api.deleteExchangeRate(id)}
        toForm={(row) => ({
          fromCurrency: row.fromCurrency,
          toCurrency: row.toCurrency,
          rate: Number(row.rate),
          date: String(row.date).slice(0, 10),
          notes: row.notes || "",
        })}
        columns={[
          { key: "fromCurrency", label: t("from") },
          { key: "toCurrency", label: t("to") },
          {
            key: "rate",
            label: t("rate"),
            render: (r) => Number(r.rate),
          },
          {
            key: "date",
            label: t("date"),
            render: (r) => formatDate(r.date),
          },
        ]}
        fields={[
          {
            key: "fromCurrency",
            label: t("from"),
            type: "select",
            required: true,
            options: CURRENCIES.map((c) => ({ value: c, label: c })),
          },
          {
            key: "toCurrency",
            label: t("to"),
            type: "select",
            required: true,
            options: CURRENCIES.map((c) => ({ value: c, label: c })),
          },
          { key: "rate", label: t("rate"), type: "number", required: true },
          { key: "date", label: t("date"), type: "date", required: true },
          { key: "notes", label: t("notes"), type: "textarea" },
        ]}
      />
    </div>
  );
}
