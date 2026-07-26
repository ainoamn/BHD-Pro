"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api, { DualApprovalPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { posCopy } from "@/lib/pos-copy";
import { DualApprovalModal } from "@/components/security/dual-approval-modal";
import {
  openPosShiftReportEmail,
  openPosShiftReportWhatsApp,
  type PosShiftReportShareData,
} from "@/lib/pos-receipt-share";

const POS_WAREHOUSE_KEY = "hisaby-pos-warehouse-id";
const DEFAULT_VARIANCE_LIMIT = 1;

type CashMovement = {
  id: string;
  type: string;
  amount: number | string;
  reason?: string | null;
  journalId?: string | null;
  createdAt: string;
  createdBy?: { name?: string };
};

type ZReport = {
  salesTotal?: number;
  salesCount?: number;
  cashSales?: number;
  cardSales?: number;
  bankSales?: number;
  storeCreditSales?: number;
  cashIn?: number;
  cashOut?: number;
  commissionCashOut?: number;
  cashMovements?: CashMovement[];
  refundTotal?: number;
  refundsTotal?: number;
  cashRefundsTotal?: number;
  voidedTotal?: number;
  voidsTotal?: number;
  expectedCash?: number;
  openingCash?: number;
  openingFloat?: number;
  closingCash?: number | null;
  variance?: number | null;
  varianceStatus?: "BALANCED" | "SHORT" | "OVER" | null;
  formulaAr?: string;
  formulaEn?: string;
};

function varianceBadgeLabel(
  t: (typeof posCopy)["en"] | (typeof posCopy)["ar"],
  status?: string | null,
  variance?: number | null,
) {
  const s =
    status ||
    (variance == null
      ? null
      : Math.abs(variance) <= 0.005
        ? "BALANCED"
        : variance < 0
          ? "SHORT"
          : "OVER");
  if (s === "SHORT") return t.shortage;
  if (s === "OVER") return t.overage;
  if (s === "BALANCED") return t.balanced;
  return null;
}

function varianceBadgeClass(status?: string | null, variance?: number | null) {
  const s =
    status ||
    (variance == null
      ? null
      : Math.abs(variance) <= 0.005
        ? "BALANCED"
        : variance < 0
          ? "SHORT"
          : "OVER");
  if (s === "SHORT") return "bg-rose-500/20 text-rose-200 border-rose-400/40";
  if (s === "OVER") return "bg-amber-500/20 text-amber-100 border-amber-400/40";
  if (s === "BALANCED") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
  return "bg-white/5 text-slate-400 border-white/10";
}

function toShareReport(
  report: ZReport,
  kind: "Z" | "X",
  companyName?: string,
  currency?: string,
): PosShiftReportShareData {
  return {
    kind,
    companyName,
    currency: currency || "OMR",
    openingCash: Number(report.openingCash ?? report.openingFloat ?? 0),
    salesTotal: Number(report.salesTotal ?? 0),
    salesCount: Number(report.salesCount ?? 0),
    cashSales: Number(report.cashSales ?? 0),
    cardSales: Number(report.cardSales ?? 0),
    cashIn: Number(report.cashIn ?? 0),
    cashOut: Number(report.cashOut ?? 0),
    refundTotal: Number(report.refundsTotal ?? report.refundTotal ?? 0),
    voidedTotal: Number(report.voidsTotal ?? report.voidedTotal ?? 0),
    expectedCash: Number(report.expectedCash ?? 0),
    closingCash: report.closingCash != null ? Number(report.closingCash) : null,
    variance: report.variance != null ? Number(report.variance) : null,
    varianceStatus: report.varianceStatus ?? null,
  };
}

function printShiftReport(
  t: (typeof posCopy)["en"] | (typeof posCopy)["ar"],
  report: ZReport,
  kind: "Z" | "X",
  companyName?: string,
) {
  const title = kind === "X" ? "X-Report" : "Z-Report";
  const movements = report.cashMovements || [];
  const rows = [
    [t.openingFloat, report.openingCash ?? report.openingFloat ?? 0],
    [t.zSales, report.salesTotal ?? 0],
    [t.zCount, report.salesCount ?? 0],
    [t.zCash, report.cashSales ?? 0],
    [t.cardSales, report.cardSales ?? 0],
    [t.zCashIn, report.cashIn ?? 0],
    [t.zCashOut, report.cashOut ?? 0],
    [t.zRefunds, report.refundsTotal ?? report.refundTotal ?? 0],
    [t.zVoids, report.voidsTotal ?? report.voidedTotal ?? 0],
    [t.zExpected, report.expectedCash ?? 0],
    ...(kind === "Z"
      ? ([
          [t.closingCash, report.closingCash ?? "—"],
          [t.zVariance, report.variance ?? "—"],
          [
            t.reconciliationTitle,
            varianceBadgeLabel(t, report.varianceStatus, report.variance) || "—",
          ],
        ] as [string, string | number][])
      : []),
  ];
  const movementRows = movements
    .map((m) => {
      const label = m.type === "IN" ? t.cashIn : t.cashOut;
      const reason = m.reason ? ` · ${m.reason}` : "";
      const when = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
      return `<tr><td>${label}${reason}<br/><span style="font-size:11px;color:#666">${when}</span></td><td>${m.amount}</td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:ui-monospace,monospace;padding:16px;color:#111}
      h1{font-size:16px;margin:0 0 8px} h2{font-size:13px;margin:0 0 12px;color:#444}
      h3{font-size:12px;margin:16px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td{padding:6px 0;border-bottom:1px dashed #ccc}
      td:last-child{text-align:right;font-weight:700}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${title} · ${companyName || "Hisaby POS"}</h1>
    <h2>${new Date().toLocaleString()}</h2>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
    ${
      movements.length
        ? `<h3>${t.cashMovements}</h3><table>${movementRows}</table>`
        : ""
    }
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

export type PosShiftsViewProps = {
  /** Lock shift ops to this warehouse (resto kitchen stock, etc.) */
  forcedWarehouseId?: string | null;
  hideWarehousePicker?: boolean;
  titleOverride?: string;
};

export function PosShiftsView({
  forcedWarehouseId,
  hideWarehousePicker,
  titleOverride,
}: PosShiftsViewProps = {}) {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const qc = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [lastZ, setLastZ] = useState<ZReport | null>(null);
  const [lastX, setLastX] = useState<ZReport | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [varianceLimit, setVarianceLimit] = useState(DEFAULT_VARIANCE_LIMIT);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [cashApprovalOpen, setCashApprovalOpen] = useState(false);
  const [pendingCloseCash, setPendingCloseCash] = useState<number | null>(null);
  const [cashType, setCashType] = useState<"IN" | "OUT">("IN");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashOutLimit, setCashOutLimit] = useState(20);
  const [lastClosedShiftId, setLastClosedShiftId] = useState<string | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiFindings, setAiFindings] = useState<{
    shiftId: string;
    summary: string;
    findings: { severity: string; message: string }[];
    llmNote?: string | null;
  } | null>(null);

  useEffect(() => {
    if (forcedWarehouseId) {
      setWarehouseId(forcedWarehouseId);
      return;
    }
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
        const cfg = sec.data as {
          shiftVarianceLimit?: number;
          cashOutApprovalLimit?: number;
        };
        const limit = cfg?.shiftVarianceLimit;
        if (typeof limit === "number" && limit >= 0) setVarianceLimit(limit);
        const outLim = cfg?.cashOutApprovalLimit;
        if (typeof outLim === "number" && outLim >= 0) setCashOutLimit(outLim);
      } catch {
        /* ignore */
      }
    })();
  }, [forcedWarehouseId]);

  useEffect(() => {
    if (!forcedWarehouseId) return;
    (async () => {
      try {
        const sec = await api.getCompanySecurity();
        const cfg = sec.data as {
          shiftVarianceLimit?: number;
          cashOutApprovalLimit?: number;
        };
        const limit = cfg?.shiftVarianceLimit;
        if (typeof limit === "number" && limit >= 0) setVarianceLimit(limit);
        const outLim = cfg?.cashOutApprovalLimit;
        if (typeof outLim === "number" && outLim >= 0) setCashOutLimit(outLim);
      } catch {
        /* ignore */
      }
    })();
  }, [forcedWarehouseId]);

  const onWarehouseChange = (id: string) => {
    if (forcedWarehouseId) return;
    setWarehouseId(id);
    try {
      if (id) localStorage.setItem(POS_WAREHOUSE_KEY, id);
      else localStorage.removeItem(POS_WAREHOUSE_KEY);
    } catch {
      /* ignore */
    }
  };

  const isManagerView =
    user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "ACCOUNTANT";

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

  const { data: shiftsToday } = useQuery({
    queryKey: ["pos-shifts-today"],
    queryFn: async () => {
      const res = await api.getPosShiftsToday();
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });
  const openMut = useMutation({
    mutationFn: () =>
      api.openPosShift({
        openingCash: Number(openingFloat) || 0,
        warehouseId: warehouseId || undefined,
        notes: openingNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t.shiftOpened);
      setOpeningNotes("");
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
      const payload = res.data as {
        zReport?: ZReport;
        shift?: { id?: string };
        zEmail?: { sent?: number; skipped?: boolean };
      };
      const z = payload?.zReport || null;
      setLastZ(z);
      setLastClosedShiftId(payload?.shift?.id || null);
      if (z) printShiftReport(t, z, "Z", company?.name);
      if (payload?.zEmail && !payload.zEmail.skipped && (payload.zEmail.sent || 0) > 0) {
        toast.success(t.zEmailSent);
      }
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

  const cashMut = useMutation({
    mutationFn: (approval?: Parameters<typeof api.createPosCashMovement>[0]["approval"]) =>
      api.createPosCashMovement({
        type: cashType,
        amount: Number(cashAmount),
        reason: cashReason.trim() || undefined,
        warehouseId: warehouseId || undefined,
        approval,
      }),
    onSuccess: (res) => {
      const posted = (res.data as { postedToGl?: boolean })?.postedToGl;
      toast.success(
        posted
          ? `${cashType === "IN" ? t.cashInOk : t.cashOutOk} · ${t.cashPostedToGl}`
          : cashType === "IN"
            ? t.cashInOk
            : t.cashOutOk,
      );
      setCashAmount("");
      setCashReason("");
      setCashApprovalOpen(false);
      qc.invalidateQueries({ queryKey: ["pos-shift-current"] });
      qc.invalidateQueries({ queryKey: ["pos-shifts-today"] });
    },
    onError: (err: {
      response?: { status?: number; data?: { message?: string | string[] } };
    }) => {
      if (isDualControlRequired(err) && cashType === "OUT") {
        setCashApprovalOpen(true);
        toast.error(t.cashOutNeedApproval);
        return;
      }
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      toast.error(msg || t.cashMovementFail);
    },
  });
  const live = data?.live as ZReport | undefined;
  const expectedCash = Number(live?.expectedCash ?? 0);

  const { data: parkedDrafts = [] } = useQuery({
    queryKey: ["pos-drafts-eod"],
    queryFn: async () => {
      const res = await api.listPosDrafts();
      return (res.data as { id: string }[]) || [];
    },
    refetchInterval: 20000,
  });
  const parkedCount = parkedDrafts.length;

  const [quarantineCount, setQuarantineCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { quarantinedAllCount } = await import("@/lib/pos-offline-sync");
        const n = await quarantinedAllCount();
        if (!cancelled) setQuarantineCount(n);
      } catch {
        if (!cancelled) setQuarantineCount(0);
      }
    })();
    const id = window.setInterval(() => {
      void import("@/lib/pos-offline-sync").then(({ quarantinedAllCount }) =>
        quarantinedAllCount().then((n) => {
          if (!cancelled) setQuarantineCount(n);
        }),
      );
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const shiftIdForEod = (data?.shift as { id?: string } | undefined)?.id;
  const { data: eodAnomalies } = useQuery({
    queryKey: ["pos-eod-anomalies", shiftIdForEod],
    enabled: !!shiftIdForEod,
    queryFn: async () => {
      const res = await api.getPosShiftAnomalies(shiftIdForEod!);
      return res.data as {
        findings?: { severity: string; messageAr?: string; messageEn?: string }[];
      };
    },
    staleTime: 60_000,
  });
  const anomalyCount = eodAnomalies?.findings?.length || 0;

  const cashMovements = (data?.cashMovements ||
    live?.cashMovements ||
    []) as CashMovement[];

  const previewVariance =
    closingCash !== "" && !Number.isNaN(Number(closingCash))
      ? Number((Number(closingCash) - expectedCash).toFixed(3))
      : null;
  const previewStatus =
    previewVariance == null
      ? null
      : Math.abs(previewVariance) <= 0.005
        ? ("BALANCED" as const)
        : previewVariance < 0
          ? ("SHORT" as const)
          : ("OVER" as const);

  const runAiReview = async (shiftId: string) => {
    setAiBusyId(shiftId);
    try {
      const res = await api.getPosShiftAnomalies(shiftId);
      const body = res.data;
      const findings = (body.findings || []).map((f) => ({
        severity: f.severity,
        message: locale === "en" ? f.messageEn : f.messageAr,
      }));
      const summary = locale === "en" ? body.summaryEn : body.summaryAr;
      setAiFindings({
        shiftId,
        summary,
        findings,
        llmNote: (body as { llmNote?: string | null }).llmNote || null,
      });
      if (!findings.length) toast.success(t.aiReviewOk);
      else toast(summary, { icon: "⚠" });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t.aiReviewFail;
      toast.error(typeof msg === "string" ? msg : t.aiReviewFail);
    } finally {
      setAiBusyId(null);
    }
  };

  const requestClose = () => {
    const cash = Number(closingCash);
    if (Number.isNaN(cash) || cash < 0) return;
    const variance = Math.abs(cash - expectedCash);
    if ((parkedCount || 0) > 0) {
      if (!window.confirm(t.eodConfirmParked)) return;
    }
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
      setLastX(report);
      printShiftReport(t, report, "X", company?.name);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t.xReportFail);
    },
  });

  const shareReport = (report: ZReport | null, kind: "Z" | "X", channel: "wa" | "email") => {
    if (!report) return;
    const payload = toShareReport(report, kind, company?.name, company?.currency);
    if (channel === "wa") openPosShiftReportWhatsApp(payload);
    else openPosShiftReportEmail(payload);
  };

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
          <h1 className="text-xl font-bold text-white">
            {titleOverride || t.shiftsTitle}
          </h1>
          <p className="text-sm text-slate-400">{t.shiftsHint}</p>
        </div>
      </div>

      {!hideWarehousePicker && warehouses.length > 0 ? (
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

      {hideWarehousePicker && forcedWarehouseId ? (
        <p className="text-xs text-stone-400 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          {t.warehouse}: <span className="text-stone-200 font-mono">{forcedWarehouseId.slice(0, 8)}…</span>
        </p>
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
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-300">{t.reconciliationTitle}</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-slate-500 text-[10px]">{t.cashSales}</p>
                  <p className="font-bold text-white tabular-nums">{live.cashSales ?? 0}</p>
                </div>
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-slate-500 text-[10px]">{t.cardSales}</p>
                  <p className="font-bold text-white tabular-nums">{live.cardSales ?? 0}</p>
                </div>
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-slate-500 text-[10px]">{t.expectedInDrawer}</p>
                  <p className="font-bold text-emerald-300 tabular-nums">
                    {live.expectedCash ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-slate-500 text-[10px]">{t.zCashOut}</p>
                  <p className="font-bold text-white tabular-nums">{live.cashOut ?? 0}</p>
                </div>
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-slate-500 text-[10px]">{t.zCashIn}</p>
                  <p className="font-bold text-white tabular-nums">{live.cashIn ?? 0}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                {locale === "en" ? live.formulaEn : live.formulaAr}
                {live.commissionCashOut
                  ? ` · ${t.payout}: ${live.commissionCashOut}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300">{t.cashMovements}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCashType("IN")}
                className={`h-9 px-3 rounded-lg text-xs font-semibold border ${
                  cashType === "IN"
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 text-slate-400"
                }`}
              >
                {t.cashIn}
              </button>
              <button
                type="button"
                onClick={() => setCashType("OUT")}
                className={`h-9 px-3 rounded-lg text-xs font-semibold border ${
                  cashType === "OUT"
                    ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                    : "border-white/10 text-slate-400"
                }`}
              >
                {t.cashOut}
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.cashMovementAmount}</label>
                <input
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  inputMode="decimal"
                  className="h-10 w-32 rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
                />
              </div>
              <div className="flex-1 min-w-[10rem]">
                <label className="block text-xs text-slate-400 mb-1">
                  {cashType === "OUT" ? t.cashMovementReasonRequired : t.cashMovementReason}
                </label>
                <input
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  className="h-10 w-full rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
                />
              </div>
              <button
                type="button"
                disabled={
                  cashMut.isPending ||
                  !(Number(cashAmount) > 0) ||
                  (cashType === "OUT" && !cashReason.trim())
                }
                onClick={() => {
                  const amt = Number(cashAmount);
                  if (
                    cashType === "OUT" &&
                    amt >= cashOutLimit &&
                    cashOutLimit >= 0
                  ) {
                    setCashApprovalOpen(true);
                    return;
                  }
                  cashMut.mutate(undefined);
                }}
                className="h-10 px-4 rounded-lg bg-sky-500/90 text-white text-sm font-semibold disabled:opacity-50"
              >
                {cashMut.isPending ? "…" : cashType === "IN" ? t.cashIn : t.cashOut}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">{t.cashPostedToGl}</p>
            {cashMovements.length ? (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {cashMovements.map((m) => (
                  <li
                    key={m.id}
                    className="flex justify-between gap-2 text-xs text-slate-300 border-b border-white/5 pb-1.5"
                  >
                    <span>
                      <span
                        className={
                          m.type === "IN" ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"
                        }
                      >
                        {m.type === "IN" ? t.cashIn : t.cashOut}
                      </span>
                      {m.reason ? ` · ${m.reason}` : ""}
                      {m.journalId ? (
                        <span className="ms-1 text-sky-400/90">· {t.cashPostedToGl}</span>
                      ) : null}
                      <span className="block text-slate-500">
                        {new Date(m.createdAt).toLocaleString()}
                        {m.createdBy?.name ? ` · ${m.createdBy.name}` : ""}
                      </span>
                    </span>
                    <span className="font-bold text-white shrink-0">{m.amount}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">{t.noCashMovements}</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300">{t.reconciliationTitle}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.countedCash}</label>
                <input
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  inputMode="decimal"
                  className="h-10 w-40 rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
                />
              </div>
              <div className="rounded-lg bg-black/30 px-3 py-2 min-w-[7rem]">
                <p className="text-[10px] text-slate-500">{t.expectedInDrawer}</p>
                <p className="font-bold text-emerald-300 tabular-nums">{expectedCash}</p>
              </div>
              <div className="rounded-lg bg-black/30 px-3 py-2 min-w-[7rem]">
                <p className="text-[10px] text-slate-500">{t.difference}</p>
                <p className="font-bold text-white tabular-nums">
                  {previewVariance != null ? previewVariance : "—"}
                </p>
              </div>
              {previewStatus ? (
                <span
                  className={`inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold ${varianceBadgeClass(previewStatus, previewVariance)}`}
                >
                  {varianceBadgeLabel(t, previewStatus, previewVariance)}
                </span>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.eodChecklist}
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{t.eodParked}</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      parkedCount > 0 ? "text-amber-300" : "text-emerald-300"
                    }`}
                  >
                    {parkedCount}
                  </span>
                </li>
                {parkedCount > 0 ? (
                  <li className="text-[11px] text-amber-200/90">{t.eodParkedWarn}</li>
                ) : null}
                <li className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{t.eodVariance}</span>
                  <span className="tabular-nums text-slate-100">
                    {previewVariance != null ? previewVariance : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{t.eodOfflineQ}</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      quarantineCount > 0 ? "text-rose-300" : "text-emerald-300"
                    }`}
                  >
                    {quarantineCount}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{t.eodAnomalies}</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      anomalyCount > 0 ? "text-amber-300" : "text-emerald-300"
                    }`}
                  >
                    {anomalyCount}
                  </span>
                </li>
              </ul>
              {parkedCount === 0 && quarantineCount === 0 && anomalyCount === 0 ? (
                <p className="text-[11px] text-emerald-300/90">{t.eodOk}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                onClick={() => shareReport(lastX || live || null, "X", "wa")}
                disabled={!(lastX || live)}
                className="h-10 px-3 rounded-lg border border-emerald-500/30 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {t.shareReportWhatsApp}
              </button>
              <button
                type="button"
                onClick={() => shareReport(lastX || live || null, "X", "email")}
                disabled={!(lastX || live)}
                className="h-10 px-3 rounded-lg border border-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Mail className="w-3.5 h-3.5" />
                {t.shareReportEmail}
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
            <div className="min-w-[12rem] flex-1">
              <label className="block text-xs text-slate-400 mb-1">{t.shiftOpenNotes}</label>
              <input
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value.slice(0, 200))}
                className="h-10 w-full rounded-lg bg-black/30 border border-white/10 px-3 text-sm text-white"
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => printShiftReport(t, lastZ, "Z", company?.name)}
            className="inline-flex items-center gap-2 text-sm text-sky-300 hover:underline"
          >
            <Printer className="w-4 h-4" />
            {t.printZReport}
          </button>
          <button
            type="button"
            onClick={() => shareReport(lastZ, "Z", "wa")}
            className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            {t.shareReportWhatsApp}
          </button>
          <button
            type="button"
            onClick={() => shareReport(lastZ, "Z", "email")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:underline"
          >
            <Mail className="w-4 h-4" />
            {t.shareReportEmail}
          </button>
          {lastClosedShiftId ? (
            <button
              type="button"
              disabled={aiBusyId === lastClosedShiftId}
              onClick={() => void runAiReview(lastClosedShiftId)}
              className="inline-flex items-center gap-1.5 text-sm text-violet-300 hover:underline disabled:opacity-50"
            >
              {aiBusyId === lastClosedShiftId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              {t.aiReview}
            </button>
          ) : null}
          {lastZ.varianceStatus || lastZ.variance != null ? (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${varianceBadgeClass(lastZ.varianceStatus, lastZ.variance)}`}
            >
              {varianceBadgeLabel(t, lastZ.varianceStatus, lastZ.variance)}
              {lastZ.variance != null ? ` · ${lastZ.variance}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {isManagerView && shiftsToday ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-sky-200">{t.shiftsTodayTitle}</h2>
              <p className="text-xs text-slate-500">
                {t.shiftsTodayHint}
                {shiftsToday.date ? ` · ${shiftsToday.date}` : ""}
                {typeof shiftsToday.totals?.voidCount === "number"
                  ? ` · ${t.zVoids}: ${shiftsToday.totals.voidCount}`
                  : ""}
              </p>
            </div>
            {(shiftsToday.totals?.openCount || 0) > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {shiftsToday.totals.openCount} {t.shiftStatusOpen}
              </span>
            ) : null}
          </div>
          {shiftsToday.warehouses?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-300">
                <thead>
                  <tr className="text-slate-500 border-b border-white/10">
                    <th className="py-2 text-start font-medium">{t.warehouse}</th>
                    <th className="py-2 text-start font-medium">{t.shiftOpen}</th>
                    <th className="py-2 text-end font-medium">{t.zSales}</th>
                    <th className="py-2 text-end font-medium">{t.zVoids}</th>
                    <th className="py-2 text-end font-medium">{t.zCashIn}</th>
                    <th className="py-2 text-end font-medium">{t.zCashOut}</th>
                    <th className="py-2 text-end font-medium">{t.zExpected}</th>
                    <th className="py-2 text-end font-medium">X/Z</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsToday.warehouses.map((w) => (
                    <tr
                      key={w.warehouseId || "default"}
                      className={`border-b border-white/5 ${
                        w.openShift ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <td className="py-2.5 pe-2">
                        <span className="text-white font-medium">
                          {w.warehouseCode ? `${w.warehouseCode} — ` : ""}
                          {w.warehouseName}
                        </span>
                        <span className="block text-slate-500">
                          {w.shifts.length} ·{" "}
                          {w.openShift ? t.shiftStatusOpen : t.shiftStatusClosed}
                        </span>
                      </td>
                      <td className="py-2.5 pe-2">
                        {w.openShift
                          ? w.openShift.openedBy?.name || t.shiftStatusOpen
                          : "—"}
                      </td>
                      <td className="py-2.5 text-end font-semibold text-white">
                        {w.salesTotal}
                      </td>
                      <td
                        className={`py-2.5 text-end font-semibold ${
                          (w.voidCount || 0) > 0 ? "text-amber-300" : "text-slate-500"
                        }`}
                      >
                        {w.voidCount || 0}
                      </td>
                      <td className="py-2.5 text-end">{w.cashIn}</td>
                      <td className="py-2.5 text-end">{w.cashOut}</td>
                      <td className="py-2.5 text-end text-emerald-300 font-semibold">
                        {w.expectedCash}
                      </td>
                      <td className="py-2.5 text-end">
                        {w.shifts[0] ? (
                          <Link
                            href={`/pos/shifts`}
                            onClick={() => {
                              if (w.warehouseId) onWarehouseChange(w.warehouseId);
                              else onWarehouseChange("");
                            }}
                            className="text-sky-300 hover:underline"
                          >
                            {w.openShift ? t.xReport : t.printZReport}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-slate-400">
                    <td className="pt-3 font-semibold text-white" colSpan={2}>
                      {t.todaySales}
                    </td>
                    <td className="pt-3 text-end font-bold text-white">
                      {shiftsToday.totals.salesTotal}
                    </td>
                    <td className="pt-3 text-end font-semibold text-amber-300">
                      {shiftsToday.totals.voidCount ?? 0}
                    </td>
                    <td className="pt-3 text-end">{shiftsToday.totals.cashIn}</td>
                    <td className="pt-3 text-end">{shiftsToday.totals.cashOut}</td>
                    <td className="pt-3 text-end font-bold text-emerald-300">
                      {shiftsToday.totals.expectedCash}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t.shiftsTodayEmpty}</p>
          )}
        </div>
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
                <div className="text-xs text-slate-400 text-end space-y-1">
                  <p>
                    {t.cashSales}: {s.zReportJson.cashSales ?? "—"} · {t.cardSales}:{" "}
                    {s.zReportJson.cardSales ?? "—"}
                  </p>
                  <p>
                    {t.expectedInDrawer}: {s.zReportJson.expectedCash ?? "—"}
                  </p>
                  <p className="inline-flex items-center justify-end gap-2">
                    <span>
                      {t.zVariance}: {s.zReportJson.variance ?? "—"}
                    </span>
                    {varianceBadgeLabel(
                      t,
                      s.zReportJson.varianceStatus,
                      s.zReportJson.variance,
                    ) ? (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${varianceBadgeClass(s.zReportJson.varianceStatus, s.zReportJson.variance)}`}
                      >
                        {varianceBadgeLabel(
                          t,
                          s.zReportJson.varianceStatus,
                          s.zReportJson.variance,
                        )}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => printShiftReport(t, s.zReportJson!, "Z", company?.name)}
                      className="text-sky-300 hover:underline"
                    >
                      {t.printZReport}
                    </button>
                    <button
                      type="button"
                      onClick={() => shareReport(s.zReportJson!, "Z", "wa")}
                      className="text-emerald-300 hover:underline"
                    >
                      {t.shareReportWhatsApp}
                    </button>
                    <button
                      type="button"
                      onClick={() => shareReport(s.zReportJson!, "Z", "email")}
                      className="text-slate-300 hover:underline"
                    >
                      {t.shareReportEmail}
                    </button>
                    {s.status === "CLOSED" ? (
                      <button
                        type="button"
                        disabled={aiBusyId === s.id}
                        onClick={() => void runAiReview(s.id)}
                        className="text-violet-300 hover:underline disabled:opacity-50"
                      >
                        {aiBusyId === s.id ? "…" : t.aiReview}
                      </button>
                    ) : null}
                  </div>
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

      <DualApprovalModal
        open={cashApprovalOpen}
        action="SHIFT_CASH_OUT"
        actionLabel={t.cashOutNeedApproval}
        payload={{
          amount: Number(cashAmount),
          reason: cashReason,
          limit: cashOutLimit,
        }}
        summary={`${t.cashOut}: ${cashAmount} (≥ ${cashOutLimit})`}
        actorRole={user?.role}
        busy={cashMut.isPending}
        onCancel={() => setCashApprovalOpen(false)}
        onConfirm={async (approval) => {
          await cashMut.mutateAsync(approval);
        }}
      />

      {aiFindings ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          role="dialog"
          onClick={() => setAiFindings(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{t.aiReviewTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{aiFindings.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setAiFindings(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {aiFindings.llmNote ? (
              <p className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 whitespace-pre-wrap">
                {aiFindings.llmNote}
              </p>
            ) : null}
            {aiFindings.findings.length ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {aiFindings.findings.map((f, i) => (
                  <li
                    key={`${aiFindings.shiftId}-${i}`}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                  >
                    <span
                      className={
                        f.severity === "high"
                          ? "text-rose-300 font-semibold"
                          : f.severity === "medium"
                            ? "text-amber-200 font-semibold"
                            : "text-sky-300 font-semibold"
                      }
                    >
                      {f.severity}
                    </span>
                    <p className="text-slate-200 mt-1">{f.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-300">{t.aiReviewOk}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

