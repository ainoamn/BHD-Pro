"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";

type Board = Awaited<ReturnType<typeof api.getRestoLiveBoard>>["data"];

const POLL_MS = 12000;

export default function RestoLiveBoardPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [data, setData] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const res = await api.getRestoLiveBoard();
      setData(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const fmt = (n: number) => n.toFixed(3);
  const asOfLabel = data
    ? new Date(data.asOf).toLocaleTimeString(
        locale === "en" ? "en-GB" : "ar",
        { hour: "2-digit", minute: "2-digit", second: "2-digit" },
      )
    : "";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber-400" />
            {t.liveBoardTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.liveBoardSub}</p>
          {data ? (
            <p className="text-[11px] text-stone-500 mt-1 tabular-nums">
              {t.liveAsOf}: {asOfLabel}
              {data.timezone ? ` · ${data.timezone}` : ""}
              {refreshing ? ` · ${t.liveRefreshing}` : ""}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 text-xs font-bold hover:bg-white/5 disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {t.refresh}
        </button>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <p className="text-sm text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t.refresh}
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : data ? (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-stone-300">{t.liveHouse}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { label: t.liveOpenTables, value: data.house.openTables },
                { label: t.liveOpenCovers, value: data.house.openCovers },
                {
                  label: t.liveOpenRevenue,
                  value: fmt(data.house.openRevenue),
                },
                {
                  label: t.liveRevenueToday,
                  value: fmt(data.house.revenue),
                },
                {
                  label: t.liveTipsToday,
                  value: fmt(data.house.tipsTotal),
                },
                {
                  label: t.liveClosedToday,
                  value: data.house.closedOrders,
                },
                {
                  label: t.liveCoversToday,
                  value: data.house.closedCovers,
                },
                {
                  label: t.liveAvgTicket,
                  value: fmt(data.house.avgTicket),
                },
                {
                  label: t.liveOpenChecks,
                  value: data.house.openChecks,
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <p className="text-[10px] text-stone-500 font-semibold">
                    {kpi.label}
                  </p>
                  <p className="text-lg font-extrabold tabular-nums text-amber-100 mt-0.5">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.sections.map((sec) => {
              const zoneLabel =
                locale === "en" && sec.zoneNameEn
                  ? sec.zoneNameEn
                  : sec.zoneName;
              const hot = sec.openChecks > 0;
              return (
                <article
                  key={sec.zoneId}
                  className={cn(
                    "rounded-2xl border p-4 space-y-3",
                    hot
                      ? "border-amber-500/35 bg-amber-500/5"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold truncate">{zoneLabel}</h3>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {t.liveServer}:{" "}
                        <span className="font-semibold text-stone-200">
                          {sec.server?.name || t.liveUnassigned}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums",
                        hot
                          ? "bg-amber-500/25 text-amber-100"
                          : "bg-white/10 text-stone-400",
                      )}
                    >
                      {sec.openTables} / {sec.openCovers}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] text-stone-500">
                        {t.liveOpenRevenue}
                      </p>
                      <p className="font-bold tabular-nums">
                        {fmt(sec.openRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500">
                        {t.liveAvgTurn}
                      </p>
                      <p className="font-bold tabular-nums">
                        {sec.avgOccupiedMinutes ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500">
                        {t.liveRevenueToday}
                      </p>
                      <p className="font-bold tabular-nums text-emerald-200/90">
                        {fmt(sec.closedToday.revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500">
                        {t.liveTipsToday}
                      </p>
                      <p className="font-bold tabular-nums text-sky-200/90">
                        {fmt(sec.closedToday.tips)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 tabular-nums">
                    {t.liveClosedToday}: {sec.closedToday.orders} ·{" "}
                    {t.liveCoversToday}: {sec.closedToday.covers} ·{" "}
                    {t.liveAvgTicket}: {fmt(sec.closedToday.avgTicket)}
                  </p>
                </article>
              );
            })}
          </section>

          {(data.offFloor.openChecks > 0 ||
            data.offFloor.closedToday.orders > 0) && (
            <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-2">
              <h2 className="text-sm font-bold text-violet-100">
                {t.liveOffFloor}
              </h2>
              <p className="text-sm tabular-nums text-stone-300">
                {t.liveOpenChecks}: {data.offFloor.openChecks} (
                {t.takeaway}: {data.offFloor.takeawayOpen} · {t.delivery}:{" "}
                {data.offFloor.deliveryOpen}) · {t.liveOpenRevenue}:{" "}
                {fmt(data.offFloor.openRevenue)}
              </p>
              <p className="text-sm tabular-nums text-stone-300">
                {t.liveClosedToday}: {data.offFloor.closedToday.orders} ·{" "}
                {t.liveRevenueToday}: {fmt(data.offFloor.closedToday.revenue)} ·{" "}
                {t.liveTipsToday}: {fmt(data.offFloor.closedToday.tips)}
              </p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
