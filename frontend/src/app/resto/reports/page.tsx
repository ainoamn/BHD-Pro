"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn, apiErrorMessage } from "@/lib/utils";

type Summary = Awaited<
  ReturnType<typeof api.getRestoReportsSummary>
>["data"];

type Flash = Awaited<ReturnType<typeof api.getRestoFlashReport>>["data"];

export default function RestoReportsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [flashBusy, setFlashBusy] = useState(false);
  const [hourMode, setHourMode] = useState<"orders" | "revenue">("orders");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.getRestoReportsSummary(days);
      setData(res.data);
    } catch (err) {
      setData(null);
      setLoadError(true);
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setLoading(false);
    }
  }, [days, t.actionFail]);

  useEffect(() => {
    void load();
  }, [load]);

  const printFlash = async () => {
    setFlashBusy(true);
    try {
      const res = await api.getRestoFlashReport();
      const flash = res.data as Flash;
      const w = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
      if (!w) return;
      const rows = (flash.byServer || [])
        .map(
          (s) =>
            `<tr><td>${s.name}</td><td>${s.orders}</td><td>${s.tips.toFixed(3)}</td></tr>`,
        )
        .join("");
      const sections = (flash.sectionAssignments || [])
        .map(
          (a) =>
            `<li>${a.zoneName}: <strong>${a.user?.name || "—"}</strong></li>`,
        )
        .join("");
      w.document.write(`<!doctype html><html><head><title>${t.flashTitle}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111}
h1{font-size:20px;margin:0 0 4px}
.meta{color:#555;font-size:12px;margin-bottom:16px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}
.kpi{border:1px solid #ddd;padding:10px;border-radius:8px}
.kpi b{display:block;font-size:18px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:start;font-size:13px}
@media print{button{display:none}}
</style></head><body>
<h1>${t.flashTitle}</h1>
<p class="meta">${t.flashPrinted}: ${new Date(flash.printedAt).toLocaleString()}</p>
<div class="kpis">
<div class="kpi"><span>${t.reportOrders}</span><b>${flash.orders}</b></div>
<div class="kpi"><span>${t.reportClosed}</span><b>${flash.closed}</b></div>
<div class="kpi"><span>${t.reportRevenue}</span><b>${flash.revenue.toFixed(3)}</b></div>
<div class="kpi"><span>${t.reportTips}</span><b>${flash.tipsTotal.toFixed(3)}</b></div>
<div class="kpi"><span>${t.reportServiceCharges}</span><b>${flash.serviceChargesTotal.toFixed(3)}</b></div>
<div class="kpi"><span>${t.reportOpenNow}</span><b>${flash.openNow}</b></div>
</div>
<h2 style="font-size:15px">${t.reportByServer}</h2>
<table><thead><tr><th>${t.tipAssignee}</th><th>${t.reportOrders}</th><th>${t.tipAmount}</th></tr></thead>
<tbody>${rows || `<tr><td colspan="3">${t.reportEmpty}</td></tr>`}</tbody></table>
<h2 style="font-size:15px;margin-top:20px">${t.flashSections}</h2>
<ul>${sections || `<li>—</li>`}</ul>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
      w.document.close();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setFlashBusy(false);
    }
  };

  const maxHour = Math.max(
    1,
    ...((data?.byHour || []).map((h) =>
      hourMode === "orders" ? h.orders : h.revenue,
    ) || [1]),
  );

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={flashBusy}
            onClick={() => void printFlash()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-xs font-bold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {flashBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5" />
            )}
            {t.flashPrint}
          </button>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : !data || data.orders === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.reportEmpty}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: t.reportOrders, value: data.orders },
              { label: t.reportClosed, value: data.closed },
              {
                label: t.reportRevenue,
                value: data.revenue.toFixed(3),
              },
              {
                label: t.reportAvgTicket,
                value: data.avgTicket.toFixed(3),
              },
              {
                label: t.reportTurn,
                value: data.avgTableTurnMinutes || "—",
              },
              {
                label: t.reportAvgPrep,
                value: data.avgPrepMinutes,
              },
              {
                label: t.reportPrepP90,
                value: data.prepP90,
              },
              {
                label: t.reportVoidRate,
                value: `${data.voidRate}%`,
              },
              {
                label: t.reportCompRate,
                value: `${data.compRate}%`,
              },
              {
                label: t.reportTips,
                value: (data.tipsTotal ?? 0).toFixed(3),
              },
              {
                label: t.reportAvgTip,
                value: (data.avgTip ?? 0).toFixed(3),
              },
              {
                label: t.reportServiceCharges,
                value: (data.serviceChargesTotal ?? 0).toFixed(3),
              },
              {
                label: t.reportTipPool,
                value: (data.equalPoolShare ?? 0).toFixed(3),
              },
              { label: t.reportOpenNow, value: data.openNow },
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
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-stone-200">
                  {hourMode === "orders" ? t.reportByHour : t.reportByHourRev}
                </h2>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setHourMode("orders")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold",
                      hourMode === "orders"
                        ? "bg-amber-500/20 text-amber-100"
                        : "text-stone-500",
                    )}
                  >
                    {t.reportOrders}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHourMode("revenue")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold",
                      hourMode === "revenue"
                        ? "bg-amber-500/20 text-amber-100"
                        : "text-stone-500",
                    )}
                  >
                    {t.reportRevenue}
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-1 h-28">
                {data.byHour.map((h) => {
                  const val = hourMode === "orders" ? h.orders : h.revenue;
                  return (
                    <div
                      key={h.hour}
                      className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                      title={`${h.hour}:00 — ${hourMode === "orders" ? h.orders : h.revenue.toFixed(3)}`}
                    >
                      <div
                        className="w-full rounded-t bg-amber-500/70"
                        style={{
                          height: `${Math.max(4, (val / maxHour) * 100)}%`,
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
                  );
                })}
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

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-200">
                {t.reportStationPrep}
              </h2>
              {(data.byStationPrep || []).length === 0 ? (
                <p className="text-sm text-stone-500">—</p>
              ) : (
                <ul className="space-y-2">
                  {data.byStationPrep.map((row) => (
                    <li
                      key={row.stationId || row.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate font-semibold">{row.name}</span>
                      <span className="tabular-nums text-amber-200 shrink-0 text-xs">
                        n={row.count} · avg {row.avg} · p90 {row.p90}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-200">
                {t.reportVoidReasons}
              </h2>
              {(data.voidReasons || []).length === 0 ? (
                <p className="text-sm text-stone-500">—</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {data.voidReasons.map((row) => (
                    <li
                      key={row.reason}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">{row.reason}</span>
                      <span className="tabular-nums text-rose-200 shrink-0">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 lg:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-sm font-bold text-stone-200">
                  {t.reportByServer}
                </h2>
                <p className="text-[11px] text-stone-500">
                  {t.reportTipPool}: {(data.equalPoolShare ?? 0).toFixed(3)}
                  {data.poolStaffCount
                    ? ` × ${data.poolStaffCount}`
                    : ""}
                </p>
              </div>
              {(data.byServer || []).length === 0 ? (
                <p className="text-sm text-stone-500">—</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-stone-500">
                      <tr>
                        <th className="text-start py-2 font-medium">
                          {locale === "en" ? "Server" : "النادل"}
                        </th>
                        <th className="text-start py-2 font-medium">
                          {t.reportOrders}
                        </th>
                        <th className="text-start py-2 font-medium">
                          {t.reportTips}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byServer.map((row) => (
                        <tr
                          key={row.userId || row.name}
                          className="border-t border-white/5"
                        >
                          <td className="py-2 font-semibold">{row.name}</td>
                          <td className="py-2 tabular-nums">{row.orders}</td>
                          <td className="py-2 tabular-nums text-amber-200">
                            {row.tips.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 lg:col-span-2">
              <h2 className="text-sm font-bold text-stone-200">{t.reportByTable}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-stone-500">
                    <tr>
                      <th className="text-start py-2 font-medium">{t.table}</th>
                      <th className="text-start py-2 font-medium">
                        {t.reportOrders}
                      </th>
                      <th className="text-start py-2 font-medium">
                        {t.reportRevenue}
                      </th>
                      <th className="text-start py-2 font-medium">
                        {t.reportTurnCol}
                      </th>
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
                        <td className="py-2 tabular-nums text-stone-300">
                          {row.avgTurnMinutes != null
                            ? row.avgTurnMinutes
                            : "—"}
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
