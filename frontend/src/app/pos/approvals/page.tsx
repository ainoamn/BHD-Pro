"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

type PendingRow = {
  id: string;
  action: string;
  status: string;
  summary?: string | null;
  expiresAt: string;
  createdAt: string;
  requestedBy?: { name?: string; email?: string };
};

export default function PosApprovalsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canDecide = user?.role === "ADMIN" || user?.role === "MANAGER";

  const load = useCallback(async () => {
    if (!canDecide) {
      setLoading(false);
      setRows([]);
      return;
    }
    try {
      const res = await api.listPendingDualControlRequests();
      setRows((res.data as PendingRow[]) || []);
    } catch {
      toast.error(t.approvalsFail);
    } finally {
      setLoading(false);
    }
  }, [canDecide, t.approvalsFail]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500 text-center py-10">{t.approvalsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {row.summary || row.action}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">{row.action}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {row.requestedBy?.name || row.requestedBy?.email || "—"}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {t.expiresAt}: {new Date(row.expiresAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => decide(row.id, true)}
                  className="min-h-12 rounded-xl bg-emerald-500 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busyId === row.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t.approve}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => decide(row.id, false)}
                  className="min-h-12 rounded-xl border border-rose-500/40 text-rose-200 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-rose-500/10"
                >
                  <X className="w-4 h-4" />
                  {t.reject}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
