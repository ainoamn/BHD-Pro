"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Users } from "lucide-react";
import api from "@/lib/api";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ExportButtons } from "@/components/reports/export-buttons";

type ReportTab =
  | "profitLoss"
  | "balanceSheet"
  | "trialBalance"
  | "cashFlow"
  | "cashForecast"
  | "arAging"
  | "apAging"
  | "contactStatement";

interface AgingData {
  grandTotal: number;
  buckets: { key: string; label: string; amount: number; count: number }[];
  contacts: {
    contactId: string;
    contactName: string;
    total: number;
    buckets: Record<string, number>;
  }[];
}

interface ForecastData {
  openingCash: number;
  weeks: number;
  projectedClosing: number;
  overdue: { inflow: number; outflow: number; net: number };
  beyond: { inflow: number; outflow: number; net: number; count: number };
  buckets: {
    weekStart: string;
    weekEnd: string;
    label: string;
    inflow: number;
    outflow: number;
    net: number;
    cumulative: number;
    items: {
      type: string;
      number: string;
      contactName: string;
      dueDate: string;
      amount: number;
    }[];
  }[];
}

function ReportsPageContent() {
  const t = useTranslations("reports");
  const searchParams = useSearchParams();
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const tabFromUrl = searchParams.get("tab") as ReportTab | null;
  const [tab, setTab] = useState<ReportTab>(
    tabFromUrl &&
      [
        "profitLoss",
        "balanceSheet",
        "trialBalance",
        "cashFlow",
        "cashForecast",
        "arAging",
        "apAging",
        "contactStatement",
      ].includes(tabFromUrl)
      ? tabFromUrl
      : "profitLoss"
  );
  const [contactId, setContactId] = useState("");
  const [forecastWeeks, setForecastWeeks] = useState(8);

  useEffect(() => {
    if (
      tabFromUrl &&
      [
        "profitLoss",
        "balanceSheet",
        "trialBalance",
        "cashFlow",
        "cashForecast",
        "arAging",
        "apAging",
        "contactStatement",
      ].includes(tabFromUrl)
    ) {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const { data: profitLoss, isLoading: loadingPL } = useQuery({
    queryKey: ["report-profit-loss"],
    queryFn: async () => {
      const res = await api.getProfitLoss();
      return res.data as { revenue: number; expenses: number; netProfit: number; margin: number };
    },
    enabled: tab === "profitLoss",
  });

  const { data: balanceSheet, isLoading: loadingBS } = useQuery({
    queryKey: ["report-balance-sheet"],
    queryFn: async () => {
      const res = await api.getBalanceSheet();
      return res.data as {
        assets: { code: string; name: string; balance: number }[];
        liabilities: { code: string; name: string; balance: number }[];
        equity: { code: string; name: string; balance: number }[];
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
      };
    },
    enabled: tab === "balanceSheet",
  });

  const { data: trialBalance, isLoading: loadingTB } = useQuery({
    queryKey: ["report-trial-balance"],
    queryFn: async () => {
      const res = await api.getTrialBalance();
      return res.data as {
        lines: { code: string; name: string; debit: number; credit: number }[];
        totalDebit: number;
        totalCredit: number;
      };
    },
    enabled: tab === "trialBalance",
  });

  const { data: cashFlow, isLoading: loadingCF } = useQuery({
    queryKey: ["report-cash-flow"],
    queryFn: async () => {
      const res = await api.getCashFlowReport();
      return res.data as { operating: number; inflow: number; outflow: number; netCashFlow: number };
    },
    enabled: tab === "cashFlow",
  });

  const { data: forecast, isLoading: loadingForecast } = useQuery({
    queryKey: ["report-cash-forecast", forecastWeeks],
    queryFn: async () => {
      const res = await api.getCashFlowForecast(forecastWeeks);
      return res.data as ForecastData;
    },
    enabled: tab === "cashForecast",
  });

  const { data: arAging, isLoading: loadingAr } = useQuery({
    queryKey: ["report-ar-aging"],
    queryFn: async () => {
      const res = await api.getArAging();
      return res.data as AgingData;
    },
    enabled: tab === "arAging",
  });

  const { data: apAging, isLoading: loadingAp } = useQuery({
    queryKey: ["report-ap-aging"],
    queryFn: async () => {
      const res = await api.getApAging();
      return res.data as AgingData;
    },
    enabled: tab === "apAging",
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await api.getContacts();
      return res.data as { id: string; name: string; type: string }[];
    },
    enabled: tab === "contactStatement",
  });

  const { data: statement, isLoading: loadingStatement } = useQuery({
    queryKey: ["report-contact-statement", contactId],
    queryFn: async () => {
      const res = await api.getContactStatement(contactId);
      return res.data as {
        contact: { id: string; name: string; type: string };
        outstanding: number;
        entries: {
          date: string;
          kind: string;
          reference: string;
          docType: string;
          debit: number;
          credit: number;
          balance: number;
        }[];
      };
    },
    enabled: tab === "contactStatement" && !!contactId,
  });

  const isLoading =
    loadingPL ||
    loadingBS ||
    loadingTB ||
    loadingCF ||
    loadingForecast ||
    loadingAr ||
    loadingAp ||
    loadingStatement;

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "profitLoss", label: t("profitLoss") },
    { key: "balanceSheet", label: t("balanceSheet") },
    { key: "trialBalance", label: t("trialBalance") },
    { key: "cashFlow", label: t("cashFlow") },
    { key: "cashForecast", label: t("cashForecast") },
    { key: "arAging", label: t("arAging") },
    { key: "apAging", label: t("apAging") },
    { key: "contactStatement", label: t("contactStatement") },
  ];

  const renderAccountSection = (
    title: string,
    items: { code: string; name: string; balance: number }[],
    total: number
  ) => (
    <div className="space-y-3">
      <h3 className="text-white font-semibold">{title}</h3>
      {items.map((item) => (
        <div key={item.code} className="flex justify-between text-sm py-2 border-b border-slate-800/50">
          <span className="text-slate-300">{item.code} — {item.name}</span>
          <span className="text-white">{formatMoney(item.balance, currency)}</span>
        </div>
      ))}
      <div className="flex justify-between font-bold text-emerald-400 pt-2">
        <span>{t("total")}</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
    </div>
  );

  const renderAging = (data: AgingData, title: string) => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="w-6 h-6 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400">{t("agingTotal")}</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {formatMoney(data.grandTotal, currency)}
          </p>
        </div>
        {data.buckets.map((b) => (
          <div key={b.key} className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-xs text-slate-400">{b.label}</p>
            <p className="text-lg font-bold text-white mt-1">{formatMoney(b.amount, currency)}</p>
            <p className="text-[10px] text-slate-500 mt-1">{b.count} {t("invoicesCount")}</p>
          </div>
        ))}
      </div>
      {data.contacts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-right p-3">{t("contact")}</th>
                <th className="text-right p-3">{t("agingCurrent")}</th>
                <th className="text-right p-3">1–30</th>
                <th className="text-right p-3">31–60</th>
                <th className="text-right p-3">61–90</th>
                <th className="text-right p-3">90+</th>
                <th className="text-right p-3">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c.contactId} className="border-b border-slate-800/50">
                  <td className="p-3 text-white">{c.contactName}</td>
                  <td className="p-3 text-slate-300">{formatMoney(c.buckets.current || 0, currency)}</td>
                  <td className="p-3 text-slate-300">{formatMoney(c.buckets.days1_30 || 0, currency)}</td>
                  <td className="p-3 text-slate-300">{formatMoney(c.buckets.days31_60 || 0, currency)}</td>
                  <td className="p-3 text-slate-300">{formatMoney(c.buckets.days61_90 || 0, currency)}</td>
                  <td className="p-3 text-slate-300">{formatMoney(c.buckets.over90 || 0, currency)}</td>
                  <td className="p-3 text-emerald-400 font-medium">{formatMoney(c.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const exportConfig = (() => {
    if (tab === "profitLoss" && profitLoss) {
      return {
        filename: "profit-loss",
        title: t("profitLoss"),
        headers: [t("profitLoss"), t("total")],
        rows: [
          [t("revenue"), profitLoss.revenue],
          [t("expenses"), profitLoss.expenses],
          [t("netProfit"), profitLoss.netProfit],
          [t("margin"), `${profitLoss.margin.toFixed(1)}%`],
        ],
      };
    }
    if (tab === "trialBalance" && trialBalance) {
      return {
        filename: "trial-balance",
        title: t("trialBalance"),
        headers: [t("account"), t("debit"), t("credit")],
        rows: trialBalance.lines
          .filter((l) => l.debit > 0 || l.credit > 0)
          .map((l) => [`${l.code} — ${l.name}`, l.debit, l.credit]),
      };
    }
    if (tab === "arAging" && arAging?.contacts.length) {
      return {
        filename: "ar-aging",
        title: t("arAging"),
        headers: [t("contact"), t("agingCurrent"), "1–30", "31–60", "61–90", "90+", t("total")],
        rows: arAging.contacts.map((c) => [
          c.contactName,
          c.buckets.current || 0,
          c.buckets.days1_30 || 0,
          c.buckets.days31_60 || 0,
          c.buckets.days61_90 || 0,
          c.buckets.over90 || 0,
          c.total,
        ]),
      };
    }
    if (tab === "apAging" && apAging?.contacts.length) {
      return {
        filename: "ap-aging",
        title: t("apAging"),
        headers: [t("contact"), t("agingCurrent"), "1–30", "31–60", "61–90", "90+", t("total")],
        rows: apAging.contacts.map((c) => [
          c.contactName,
          c.buckets.current || 0,
          c.buckets.days1_30 || 0,
          c.buckets.days31_60 || 0,
          c.buckets.days61_90 || 0,
          c.buckets.over90 || 0,
          c.total,
        ]),
      };
    }
    if (tab === "contactStatement" && statement?.entries.length) {
      return {
        filename: "contact-statement",
        title: t("contactStatement"),
        headers: [t("date"), t("reference"), t("docType"), t("debit"), t("credit"), t("balance")],
        rows: statement.entries.map((e) => [
          e.date,
          e.reference,
          e.docType,
          e.debit,
          e.credit,
          e.balance,
        ]),
      };
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          exportConfig ? (
            <ExportButtons
              filename={exportConfig.filename}
              headers={exportConfig.headers}
              rows={exportConfig.rows}
              printTitle={exportConfig.title}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <GlassCard className="p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {tab === "profitLoss" && profitLoss && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">{t("profitLoss")}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: t("revenue"), value: profitLoss.revenue, color: "text-emerald-400" },
                    { label: t("expenses"), value: profitLoss.expenses, color: "text-rose-400" },
                    { label: t("netProfit"), value: profitLoss.netProfit, color: "text-white" },
                    { label: t("margin"), value: `${profitLoss.margin.toFixed(1)}%`, isText: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className={cn("text-2xl font-bold mt-1", item.color || "text-white")}>
                        {item.isText ? item.value : formatMoney(item.value as number, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "balanceSheet" && balanceSheet && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {renderAccountSection(t("assets"), balanceSheet.assets, balanceSheet.totalAssets)}
                {renderAccountSection(t("liabilities"), balanceSheet.liabilities, balanceSheet.totalLiabilities)}
                {renderAccountSection(t("equity"), balanceSheet.equity, balanceSheet.totalEquity)}
              </div>
            )}

            {tab === "trialBalance" && trialBalance && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">{t("trialBalance")}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="text-right p-3 font-medium">{t("account")}</th>
                        <th className="text-right p-3 font-medium">{t("debit")}</th>
                        <th className="text-right p-3 font-medium">{t("credit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.lines.filter((l) => l.debit > 0 || l.credit > 0).map((line) => (
                        <tr key={line.code} className="border-b border-slate-800/50">
                          <td className="p-3 text-slate-300">{line.code} — {line.name}</td>
                          <td className="p-3 text-white">{line.debit > 0 ? formatMoney(line.debit, currency) : "—"}</td>
                          <td className="p-3 text-white">{line.credit > 0 ? formatMoney(line.credit, currency) : "—"}</td>
                        </tr>
                      ))}
                      <tr className="font-bold text-emerald-400">
                        <td className="p-3">{t("total")}</td>
                        <td className="p-3">{formatMoney(trialBalance.totalDebit, currency)}</td>
                        <td className="p-3">{formatMoney(trialBalance.totalCredit, currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "cashFlow" && cashFlow && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white mb-4">{t("cashFlow")}</h2>
                {[
                  { label: t("inflow"), value: cashFlow.inflow },
                  { label: t("outflow"), value: cashFlow.outflow },
                  { label: t("operating"), value: cashFlow.operating },
                  { label: t("netCashFlow"), value: cashFlow.netCashFlow },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-3 border-b border-slate-800/50">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-white font-semibold">{formatMoney(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "cashForecast" && forecast && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">{t("cashForecast")}</h2>
                  <select
                    value={forecastWeeks}
                    onChange={(e) => setForecastWeeks(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    {[4, 8, 12, 16].map((w) => (
                      <option key={w} value={w}>
                        {t("weeksCount", { count: w })}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-slate-400">{t("cashForecastHint")}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t("openingCash"), value: forecast.openingCash },
                    {
                      label: t("overdueNet"),
                      value: forecast.overdue.net,
                    },
                    {
                      label: t("projectedClosing"),
                      value: forecast.projectedClosing,
                    },
                    {
                      label: t("beyondHorizon"),
                      value: forecast.beyond.net,
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl bg-slate-800/50 p-4">
                      <p className="text-xs text-slate-400">{card.label}</p>
                      <p
                        className={cn(
                          "text-lg font-semibold mt-1",
                          card.value < 0 ? "text-rose-400" : "text-emerald-400"
                        )}
                      >
                        {formatMoney(card.value, currency)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="text-right p-3">{t("week")}</th>
                        <th className="text-right p-3">{t("inflow")}</th>
                        <th className="text-right p-3">{t("outflow")}</th>
                        <th className="text-right p-3">{t("netCashFlow")}</th>
                        <th className="text-right p-3">{t("cumulative")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.buckets.map((b) => (
                        <tr key={b.weekStart} className="border-b border-slate-800/50">
                          <td className="p-3 text-white">{b.label}</td>
                          <td className="p-3 text-emerald-400">{formatMoney(b.inflow, currency)}</td>
                          <td className="p-3 text-rose-400">{formatMoney(b.outflow, currency)}</td>
                          <td
                            className={cn(
                              "p-3 font-medium",
                              b.net < 0 ? "text-rose-400" : "text-white"
                            )}
                          >
                            {formatMoney(b.net, currency)}
                          </td>
                          <td
                            className={cn(
                              "p-3 font-semibold",
                              b.cumulative < 0 ? "text-rose-400" : "text-emerald-400"
                            )}
                          >
                            {formatMoney(b.cumulative, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {forecast.buckets.map((b) => (
                    <div
                      key={`m-${b.weekStart}`}
                      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2"
                    >
                      <p className="text-white font-medium text-sm">{b.label}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t("inflow")}</span>
                        <span className="text-emerald-400">{formatMoney(b.inflow, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t("outflow")}</span>
                        <span className="text-rose-400">{formatMoney(b.outflow, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t("cumulative")}</span>
                        <span
                          className={cn(
                            "font-semibold",
                            b.cumulative < 0 ? "text-rose-400" : "text-emerald-400"
                          )}
                        >
                          {formatMoney(b.cumulative, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "arAging" && arAging && renderAging(arAging, t("arAging"))}
            {tab === "apAging" && apAging && renderAging(apAging, t("apAging"))}

            {tab === "contactStatement" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">{t("contactStatement")}</h2>
                </div>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm"
                >
                  <option value="">{t("selectContact")}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type === "CUSTOMER" ? t("customer") : t("supplier")})
                    </option>
                  ))}
                </select>
                {statement && (
                  <>
                    <div className="bg-slate-800/50 rounded-xl p-4 inline-block">
                      <p className="text-xs text-slate-400">{t("outstanding")}</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {formatMoney(statement.outstanding, currency)}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="text-right p-3">{t("date")}</th>
                            <th className="text-right p-3">{t("reference")}</th>
                            <th className="text-right p-3">{t("docType")}</th>
                            <th className="text-right p-3">{t("debit")}</th>
                            <th className="text-right p-3">{t("credit")}</th>
                            <th className="text-right p-3">{t("balance")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statement.entries.map((e, i) => (
                            <tr key={i} className="border-b border-slate-800/50">
                              <td className="p-3 text-slate-300">{formatDate(e.date)}</td>
                              <td className="p-3 text-white">{e.reference}</td>
                              <td className="p-3 text-slate-400">{e.docType}</td>
                              <td className="p-3 text-slate-300">
                                {e.debit > 0 ? formatMoney(e.debit, currency) : "—"}
                              </td>
                              <td className="p-3 text-slate-300">
                                {e.credit > 0 ? formatMoney(e.credit, currency) : "—"}
                              </td>
                              <td className="p-3 text-emerald-400 font-medium">
                                {formatMoney(e.balance, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ReportsPageContent />
    </Suspense>
  );
}
