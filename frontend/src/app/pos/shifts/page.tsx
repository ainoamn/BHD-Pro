"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

export default function PosShiftsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const qc = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCash, setClosingCash] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pos-shift-current"],
    queryFn: async () => {
      const res = await api.getCurrentPosShift();
      return res.data;
    },
    refetchInterval: 15000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["pos-shifts"],
    queryFn: async () => {
      const res = await api.listPosShifts();
      return (res.data || []) as {
        id: string;
        status: string;
        openedAt: string;
        closedAt?: string | null;
        openingFloat: number;
        closingCash?: number | null;
        zReportJson?: { salesTotal?: number; expectedCash?: number; variance?: number } | null;
        openedBy?: { name: string };
      }[];
    },
  });

  const openMut = useMutation({
    mutationFn: () => api.openPosShift({ openingFloat: Number(openingFloat) || 0 }),
    onSuccess: () => {
      toast.success(t.shiftOpened);
      qc.invalidateQueries({ queryKey: ["pos-shift-current"] });
      qc.invalidateQueries({ queryKey: ["pos-shifts"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t.shiftFail);
    },
  });

  const closeMut = useMutation({
    mutationFn: () => api.closePosShift({ closingCash: Number(closingCash) || 0 }),
    onSuccess: () => {
      toast.success(t.shiftClosed);
      setClosingCash("");
      qc.invalidateQueries({ queryKey: ["pos-shift-current"] });
      qc.invalidateQueries({ queryKey: ["pos-shifts"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t.shiftFail);
    },
  });

  const shift = data?.shift;
  const live = data?.live as
    | {
        salesTotal?: number;
        cashSales?: number;
        cardSales?: number;
        bankSales?: number;
        refundTotal?: number;
        voidedTotal?: number;
        expectedCash?: number;
        salesCount?: number;
      }
    | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Clock3 className="w-6 h-6 text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold text-white">{t.shiftsTitle}</h1>
          <p className="text-sm text-slate-400">{t.shiftsHint}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : shift ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
          <p className="text-sm text-emerald-300 font-semibold">{t.shiftOpen}</p>
          <p className="text-xs text-slate-400">
            {t.openedBy}: {shift.openedBy?.name || "—"} · {new Date(shift.openedAt).toLocaleString()}
          </p>
          {live ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zSales}</p>
                <p className="font-bold text-white">{live.salesTotal ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zCash}</p>
                <p className="font-bold text-white">{live.cashSales ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zExpected}</p>
                <p className="font-bold text-emerald-300">{live.expectedCash ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zRefunds}</p>
                <p className="font-bold text-white">{live.refundTotal ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zVoids}</p>
                <p className="font-bold text-white">{live.voidedTotal ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zCount}</p>
                <p className="font-bold text-white">{live.salesCount ?? 0}</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.closingCash}</label>
              <input
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                inputMode="decimal"
                className="h-10 w-40 rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
              />
            </div>
            <button
              type="button"
              disabled={closeMut.isPending || closingCash === ""}
              onClick={() => closeMut.mutate()}
              className="h-10 px-4 rounded-lg bg-rose-500/90 text-white text-sm font-semibold disabled:opacity-50"
            >
              {closeMut.isPending ? "…" : t.closeShift}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <p className="text-sm text-slate-300">{t.noOpenShift}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.openingFloat}</label>
              <input
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                inputMode="decimal"
                className="h-10 w-40 rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
              />
            </div>
            <button
              type="button"
              disabled={openMut.isPending}
              onClick={() => openMut.mutate()}
              className="h-10 px-4 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold disabled:opacity-50"
            >
              {openMut.isPending ? "…" : t.openShift}
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">{t.shiftHistory}</h2>
        <ul className="space-y-2">
          {history.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm flex flex-wrap justify-between gap-2"
            >
              <div>
                <p className="text-white font-medium">
                  {s.status === "OPEN" ? t.shiftOpen : t.shiftClosedLabel} · {s.openedBy?.name || "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(s.openedAt).toLocaleString()}
                  {s.closedAt ? ` → ${new Date(s.closedAt).toLocaleString()}` : ""}
                </p>
              </div>
              {s.zReportJson ? (
                <div className="text-xs text-slate-400 text-end">
                  <p>
                    {t.zSales}: {s.zReportJson.salesTotal ?? "—"}
                  </p>
                  <p>
                    {t.zExpected}: {s.zReportJson.expectedCash ?? "—"}
                  </p>
                  <p>
                    {t.zVariance}: {s.zReportJson.variance ?? "—"}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
          {!history.length ? <p className="text-sm text-slate-500">{t.noShiftHistory}</p> : null}
        </ul>
      </div>
    </div>
  );
}
