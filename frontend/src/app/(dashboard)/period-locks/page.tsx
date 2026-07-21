"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

interface PeriodRow {
  id: string;
  year: number;
  month: number;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedBy?: { id: string; name: string } | null;
}

const MONTH_KEYS = [
  "m1", "m2", "m3", "m4", "m5", "m6",
  "m7", "m8", "m9", "m10", "m11", "m12",
] as const;

export default function PeriodLocksPage() {
  const t = useTranslations("periodLocks");
  const tCommon = useTranslations("common");
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["periods", year],
    queryFn: async () => {
      const res = await api.getPeriods(year);
      return res.data as PeriodRow[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["periods", year] });
  };

  const lockMutation = useMutation({
    mutationFn: (month: number) => api.lockPeriod(year, month),
    onSuccess: () => {
      invalidate();
      toast.success(t("locked"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (month: number) => api.unlockPeriod(year, month),
    onSuccess: () => {
      invalidate();
      toast.success(t("unlocked"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const pending = lockMutation.isPending || unlockMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <GlassCard className="p-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-lg font-semibold text-white">{year}</p>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </GlassCard>

      <p className="text-sm text-slate-400">{t("hint")}</p>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {periods.map((p) => (
              <GlassCard key={p.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-medium">{t(MONTH_KEYS[p.month - 1] as "m1")}</p>
                    {p.isLocked && p.lockedAt && (
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(p.lockedAt)}
                        {p.lockedBy ? ` · ${p.lockedBy.name}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded shrink-0",
                      p.isLocked
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    )}
                  >
                    {p.isLocked ? t("statusLocked") : t("statusOpen")}
                  </span>
                </div>
                {p.isLocked ? (
                  isAdmin && (
                    <button
                      disabled={pending}
                      onClick={() => unlockMutation.mutate(p.month)}
                      className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-200 inline-flex items-center gap-1"
                    >
                      {unlockMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                      {t("unlock")}
                    </button>
                  )
                ) : (
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t("lockConfirm"))) lockMutation.mutate(p.month);
                    }}
                    className="text-xs px-3 py-1.5 rounded bg-rose-500/10 text-rose-400 inline-flex items-center gap-1"
                  >
                    {lockMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    {t("lock")}
                  </button>
                )}
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-right px-4 py-3">{t("month")}</th>
                    <th className="text-right px-4 py-3">{t("status")}</th>
                    <th className="text-right px-4 py-3">{t("lockedAt")}</th>
                    <th className="text-right px-4 py-3">{t("lockedBy")}</th>
                    <th className="text-right px-4 py-3">{tCommon("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white font-medium">
                        {t(MONTH_KEYS[p.month - 1] as "m1")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded",
                            p.isLocked
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-emerald-500/10 text-emerald-400"
                          )}
                        >
                          {p.isLocked ? t("statusLocked") : t("statusOpen")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {p.lockedAt ? formatDate(p.lockedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {p.lockedBy?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {p.isLocked ? (
                            isAdmin ? (
                              <button
                                disabled={pending}
                                onClick={() => unlockMutation.mutate(p.month)}
                                className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-200 inline-flex items-center gap-1 hover:text-white"
                              >
                                <Unlock className="w-3 h-3" />
                                {t("unlock")}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">{t("adminOnly")}</span>
                            )
                          ) : (
                            <button
                              disabled={pending}
                              onClick={() => {
                                if (confirm(t("lockConfirm"))) lockMutation.mutate(p.month);
                              }}
                              className="text-xs px-3 py-1.5 rounded bg-rose-500/10 text-rose-400 inline-flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              {t("lock")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
