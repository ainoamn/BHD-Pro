"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api, { DualApprovalPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { posCopy } from "@/lib/pos-copy";
import { DualApprovalModal } from "@/components/security/dual-approval-modal";

const POS_WAREHOUSE_KEY = "hisaby-pos-warehouse-id";
const DEFAULT_VARIANCE_LIMIT = 1;

type ZReport = {
  salesTotal?: number;
  salesCount?: number;
  cashSales?: number;
  cardSales?: number;
  bankSales?: number;
  refundTotal?: number;
  refundsTotal?: number;
  voidedTotal?: number;
  voidsTotal?: number;
  expectedCash?: number;
  openingCash?: number;
  openingFloat?: number;
  closingCash?: number | null;
  variance?: number | null;
};

function printShiftReport(
  t: (typeof posCopy)["en"] | (typeof posCopy)["ar"],
  report: ZReport,
  kind: "Z" | "X",
  companyName?: string,
) {
  const title = kind === "X" ? "X-Report" : "Z-Report";
  const rows = [
    [t.openingFloat, report.openingCash ?? report.openingFloat ?? 0],
    [t.zSales, report.salesTotal ?? 0],
    [t.zCount, report.salesCount ?? 0],
    [t.zCash, report.cashSales ?? 0],
    [t.zRefunds, report.refundsTotal ?? report.refundTotal ?? 0],
    [t.zVoids, report.voidsTotal ?? report.voidedTotal ?? 0],
    [t.zExpected, report.expectedCash ?? 0],
    ...(kind === "Z"
      ? ([
          [t.closingCash, report.closingCash ?? "—"],
          [t.zVariance, report.variance ?? "—"],
        ] as [string, string | number][])
      : []),
  ];
  const html = `<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:ui-monospace,monospace;padding:16px;color:#111}
      h1{font-size:16px;margin:0 0 8px} h2{font-size:13px;margin:0 0 12px;color:#444}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td{padding:6px 0;border-bottom:1px dashed #ccc}
      td:last-child{text-align:right;font-weight:700}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${title} · ${companyName || "Hisaby POS"}</h1>
    <h2>${new Date().toLocaleString()}</h2>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function isDualControlRequired(err: {
  response?: { status?: number; data?: { message?: string | string[] } };
}) {
  const status = err.response?.status;
  const raw = err.response?.data?.message;
  const msg = Array.isArray(raw) ? raw.join(" ") : String(raw || "");
  return status === 403 && /dual control/i.test(msg);
}

export default function PosShiftsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const qc = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [lastZ, setLastZ] = useState<ZReport | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [varianceLimit, setVarianceLimit] = useState(DEFAULT_VARIANCE_LIMIT);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pendingCloseCash, setPendingCloseCash] = useState<number | null>(null);

  useEffect(() => {
    try {
      setWarehouseId(localStorage.getItem(POS_WAREHOUSE_KEY) || "");
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const res = await api.getWarehouses();
        const rows = ((res.data as { id: string; name: string; code: string; isActive?: boolean }[]) || []).filter(
          (w) => w.isActive !== false,
        );
        setWarehouses(rows);
      } catch {
        /* ignore */
      }
      try {
        const sec = await api.getCompanySecurity();
        const limit = (sec.data as { shiftVarianceLimit?: number })?.shiftVarianceLimit;
        if (typeof limit === "number" && limit >= 0) setVarianceLimit(limit);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onWarehouseChange = (id: string) => {
    setWarehouseId(id);
    try {
      if (id) localStorage.setItem(POS_WAREHOUSE_KEY, id);
      else localStorage.removeItem(POS_WAREHOUSE_KEY);
    } catch {
      /* ignore */
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["pos-shift-current", warehouseId || "default"],
    queryFn: async () => {
      const res = await api.getCurrentPosShift(warehouseId || undefined);
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
        zReportJson?: ZReport | null;
        openedBy?: { name: string };
        warehouse?: { name: string; code: string } | null;
      }[];
    },
  });

  const openMut = useMutation({
    mutationFn: () =>
      api.openPosShift({
        openingCash: Number(openingFloat) || 0,
        warehouseId: warehouseId || undefined,
      }),
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
    mutationFn: (args: { closingCash: number; approval?: DualApprovalPayload }) =>
      api.closePosShift({
        closingCash: args.closingCash,
        warehouseId: warehouseId || undefined,
        approval: args.approval,
      }),
    onSuccess: (res) => {
      toast.success(t.shiftClosed);
      setClosingCash("");
      setApprovalOpen(false);
      setPendingCloseCash(null);
      const z = (res.data as { zReport?: ZReport })?.zReport || null;
      setLastZ(z);
      if (z) printShiftReport(t, z, "Z", company?.name);
      qc.invalidateQueries({ queryKey: ["pos-shift-current"] });
      qc.invalidateQueries({ queryKey: ["pos-shifts"] });
    },
    onError: (err: {
      response?: { status?: number; data?: { message?: string | string[] } };
    }) => {
      if (isDualControlRequired(err) && pendingCloseCash != null) {
        setApprovalOpen(true);
        toast.error(t.varianceNeedApproval);
        return;
      }
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      toast.error(msg || t.shiftFail);
    },
  });

  const live = data?.live as ZReport | undefined;
  const expectedCash = Number(live?.expectedCash ?? 0);

  const requestClose = () => {
    const cash = Number(closingCash);
    if (Number.isNaN(cash) || cash < 0) return;
    const variance = Math.abs(cash - expectedCash);
    setPendingCloseCash(cash);
    if (variance > varianceLimit) {
      setApprovalOpen(true);
      return;
    }
    closeMut.mutate({ closingCash: cash });
  };

  const xReportMut = useMutation({
    mutationFn: async () => {
      const res = await api.getPosXReport({ warehouseId: warehouseId || undefined });
      return (res.data as { xReport?: ZReport })?.xReport || null;
    },
    onSuccess: (report) => {
      if (!report) {
        toast.error(t.xReportFail);
        return;
      }
      printShiftReport(t, report, "X", company?.name);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t.xReportFail);
    },
  });

  const shift = data?.shift as
    | {
        id?: string;
        openedAt: string;
        openedBy?: { name: string };
        warehouse?: { code: string } | null;
      }
    | null
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

      {warehouses.length > 0 ? (
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <span className="text-xs text-slate-400 shrink-0">{t.warehouse}</span>
          <select
            value={warehouseId}
            onChange={(e) => onWarehouseChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
          >
            <option value="" className="bg-[#111827]">
              {t.warehouseDefault}
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="bg-[#111827]">
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : shift ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
          <p className="text-sm text-emerald-300 font-semibold">{t.shiftOpen}</p>
          <p className="text-xs text-slate-400">
            {t.openedBy}: {shift.openedBy?.name || "—"} · {new Date(shift.openedAt).toLocaleString()}
            {shift.warehouse ? ` · ${shift.warehouse.code}` : ""}
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
                <p className="font-bold text-white">{live.refundsTotal ?? live.refundTotal ?? 0}</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-slate-500 text-xs">{t.zVoids}</p>
                <p className="font-bold text-white">{live.voidsTotal ?? live.voidedTotal ?? 0}</p>
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
              disabled={xReportMut.isPending}
              onClick={() => xReportMut.mutate()}
              className="h-10 px-4 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-200 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {xReportMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              {t.xReport}
            </button>
            <button
              type="button"
              disabled={closeMut.isPending || closingCash === ""}
              onClick={requestClose}
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

      {lastZ ? (
        <button
          type="button"
          onClick={() => printShiftReport(t, lastZ, "Z", company?.name)}
          className="inline-flex items-center gap-2 text-sm text-sky-300 hover:underline"
        >
          <Printer className="w-4 h-4" />
          {t.printZReport}
        </button>
      ) : null}

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
                  {s.warehouse ? ` · ${s.warehouse.code}` : ""}
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

      <DualApprovalModal
        open={approvalOpen}
        action="SHIFT_CLOSE_VARIANCE"
        actionLabel={t.varianceNeedApproval}
        payload={{
          closingCash: pendingCloseCash,
          expectedCash,
          varianceLimit,
        }}
        summary={`${t.closeShift}: ${pendingCloseCash ?? "—"} vs ${expectedCash}`}
        actorRole={user?.role}
        busy={closeMut.isPending}
        onCancel={() => {
          setApprovalOpen(false);
          setPendingCloseCash(null);
        }}
        onConfirm={async (approval) => {
          if (pendingCloseCash == null) return;
          await closeMut.mutateAsync({ closingCash: pendingCloseCash, approval });
        }}
      />
    </div>
  );
}
