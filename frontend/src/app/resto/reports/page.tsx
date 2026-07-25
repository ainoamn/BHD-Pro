"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";

type Summary = Awaited<
  ReturnType<typeof api.getRestoReportsSummary>
>["data"];

export default function RestoReportsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRestoReportsSummary(days);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxHour = Math.max(1, ...(data?.byHour.map((h) => h.orders) || [1]));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            {t.reportsTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.reportsSub}</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 p-1 bg-white/[0.03]">
          {[
            { d: 1, label: t.today },
            { d: 7, label: t.last7 },
            { d: 30, label: t.last30 },
          ].map((opt) => (
            <button
              key={opt.d}
              type="button"
              onClick={() => setDays(opt.d)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold",
                days === opt.d
                  ? "bg-amber-500 text-[#14110f]"
                  : "text-stone-300 hover:bg-white/5",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !data || data.orders === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.reportEmpty}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: t.reportOrders, value: data.orders },
              { label: t.reportClosed, value: data.closed },
              { label: t.reportCancelled, value: data.cancelled },
              { label: t.reportOpenNow, value: data.openNow },
              {
                label: t.reportRevenue,
                value: data.revenue.toFixed(3),
              },
              {
                label: t.reportAvgPrep,
                value: data.avgPrepMinutes,
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-[11px] text-stone-500">{c.label}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-amber-100">
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-200">{t.reportByHour}</h2>
              <div className="flex items-end gap-1 h-28">
                {data.byHour.map((h) => (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                    title={`${h.hour}:00 — ${h.orders}`}
                  >
                    <div
                      className="w-full rounded-t bg-amber-500/70"
                      style={{
                        height: `${Math.max(4, (h.orders / maxHour) * 100)}%`,
                      }}
                    />
                    {h.hour % 3 === 0 ? (
                      <span className="text-[9px] text-stone-500 tabular-nums">
                        {h.hour}
                      </span>
                    ) : (
                      <span className="text-[9px] opacity-0">·</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-200">{t.reportTopItems}</h2>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {data.topItems.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="tabular-nums text-amber-200 shrink-0">
                      {item.qty} · {item.revenue.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 lg:col-span-2">
              <h2 className="text-sm font-bold text-stone-200">{t.reportByTable}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-stone-500">
                    <tr>
                      <th className="text-start py-2 font-medium">{t.table}</th>
                      <th className="text-start py-2 font-medium">{t.reportOrders}</th>
                      <th className="text-start py-2 font-medium">{t.reportRevenue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTable.map((row) => (
                      <tr key={row.label} className="border-t border-white/5">
                        <td className="py-2 font-semibold">{row.label}</td>
                        <td className="py-2 tabular-nums">{row.orders}</td>
                        <td className="py-2 tabular-nums text-amber-200">
                          {row.revenue.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
