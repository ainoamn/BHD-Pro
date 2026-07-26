"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

type ApprovalRow = {
  id: string;
  action: string;
  status: string;
  summary?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  decisionNote?: string | null;
  requestedBy?: { name?: string; email?: string };
  decidedBy?: { name?: string; email?: string } | null;
};

type Tab = "pending" | "history";

function ApprovalCountdown({
  expiresAt,
  label,
  expiredLabel,
}: {
  expiresAt: string;
  label: string;
  expiredLabel: string;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const tick = () =>
      setLeft(
        Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (left <= 0) {
    return <p className="text-[11px] font-semibold text-rose-300 mt-1">{expiredLabel}</p>;
  }
  const urgent = left <= 60;
  return (
    <p
      className={`text-[11px] font-bold tabular-nums mt-1 ${
        urgent ? "text-rose-300" : "text-amber-200"
      }`}
    >
      {label} {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}

export default function PosApprovalsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canDecide = user?.role === "ADMIN" || user?.role === "MANAGER";

  const load = useCallback(async () => {
    if (!canDecide) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      if (tab === "pending") {
        const res = await api.listPendingDualControlRequests();
        setRows((res.data as ApprovalRow[]) || []);
      } else {
        const res = await api.listDualControlHistory(50);
        setRows((res.data as ApprovalRow[]) || []);
      }
    } catch {
      toast.error(t.approvalsFail);
    } finally {
      setLoading(false);
    }
  }, [canDecide, tab, t.approvalsFail]);

  useEffect(() => {
    void load();
    if (tab !== "pending") return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load, tab]);

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    try {
      await api.decideDualControlRequest(id, { approve });
      toast.success(approve ? t.approveOk : t.rejectOk);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(typeof msg === "string" ? msg : t.approvalsFail);
    } finally {
      setBusyId(null);
    }
  };

  if (!canDecide) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-2">
        <ShieldCheck className="w-8 h-8 text-amber-300 mx-auto" />
        <p className="text-sm text-slate-300">{t.approvalsManagerOnly}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-amber-300" />
        <div>
          <h1 className="text-lg font-bold text-white">{t.approvalsTitle}</h1>
          <p className="text-xs text-slate-500">{t.approvalsHint}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
            tab === "pending"
              ? "bg-amber-500 text-slate-950"
              : "border border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          {t.approvalsTabPending}
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
            tab === "history"
              ? "bg-amber-500 text-slate-950"
              : "border border-white/15 text-slate-300 hover:bg-white/5"
          }`}
        >
          {t.approvalsTabHistory}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500 text-center py-10">
          {tab === "pending" ? t.approvalsEmpty : t.approvalsHistoryEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {row.action}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {row.requestedBy?.name || row.requestedBy?.email || "—"}
                    {" · "}
                    {new Date(row.createdAt).toLocaleString(
                      locale === "en" ? "en-GB" : "ar",
                    )}
                  </p>
                  {row.summary ? (
                    <p className="text-xs text-slate-300 mt-1">{row.summary}</p>
                  ) : null}
                  {tab === "pending" && row.expiresAt ? (
                    <ApprovalCountdown
                      expiresAt={row.expiresAt}
                      label={t.approvalExpiresIn}
                      expiredLabel={t.approvalExpired}
                    />
                  ) : null}
                  {row.decidedBy ? (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {t.approvalsDecidedBy}:{" "}
                      {row.decidedBy.name || row.decidedBy.email}
                      {row.decisionNote ? ` — ${row.decisionNote}` : ""}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                    row.status === "PENDING"
                      ? "bg-amber-500/20 text-amber-200"
                      : row.status === "APPROVED" || row.status === "CONSUMED"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : row.status === "REJECTED"
                          ? "bg-rose-500/20 text-rose-200"
                          : "bg-slate-500/20 text-slate-300"
                  }`}
                >
                  {row.status}
                </span>
              </div>
              {tab === "pending" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row.id, true)}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row.id, false)}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-rose-500/40 text-xs font-bold text-rose-200 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t.reject}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
