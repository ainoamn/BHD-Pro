"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Shield, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { GlassCard } from "@/components/ui/page-shell";

type SecurityPublic = {
  dualControlEnabled: boolean;
  hasSupervisorPin: boolean;
  methods: string[];
  actions: {
    POS_VOID: boolean;
    POS_PRICE_OVERRIDE: boolean;
    POS_REFUND: boolean;
    STOCK_ADJUST: boolean;
    STOCK_TRANSFER: boolean;
    INVOICE_CANCEL: boolean;
    PAYMENT_REVERSE: boolean;
  };
};

const ACTION_KEYS = [
  "POS_VOID",
  "POS_PRICE_OVERRIDE",
  "POS_REFUND",
  "STOCK_ADJUST",
  "STOCK_TRANSFER",
  "INVOICE_CANCEL",
  "PAYMENT_REVERSE",
] as const;

export function DualControlSettings() {
  const t = useTranslations("dualControl");
  const tCommon = useTranslations("common");
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const [enabled, setEnabled] = useState(true);
  const [actions, setActions] = useState<SecurityPublic["actions"]>({
    POS_VOID: true,
    POS_PRICE_OVERRIDE: true,
    POS_REFUND: true,
    STOCK_ADJUST: true,
    STOCK_TRANSFER: true,
    INVOICE_CANCEL: true,
    PAYMENT_REVERSE: true,
  });
  const [pin, setPin] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["company-security"],
    queryFn: async () => {
      const res = await api.getCompanySecurity();
      return res.data as SecurityPublic;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(data.dualControlEnabled !== false);
    setActions({ ...data.actions });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateCompanySecurity(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-security"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success(t("saved"));
      setPin("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  if (isLoading) {
    return (
      <GlassCard className="p-6 flex items-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        {tCommon("loading")}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Shield className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
          <p className="text-sm text-slate-400 mt-1">{t("desc")}</p>
          <p className="text-xs text-slate-500 mt-2">{t("futureNote")}</p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 text-sm text-slate-200">
        <span>{t("enabled")}</span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!isAdmin || saveMutation.isPending}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </label>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("actions")}
        </p>
        {ACTION_KEYS.map((key) => (
          <label
            key={key}
            className="flex items-center justify-between gap-4 text-sm text-slate-300"
          >
            <span>{t(`action.${key}`)}</span>
            <input
              type="checkbox"
              checked={actions[key] !== false}
              disabled={!isAdmin || saveMutation.isPending}
              onChange={(e) =>
                setActions((prev) => ({ ...prev, [key]: e.target.checked }))
              }
            />
          </label>
        ))}
      </div>

      {isAdmin ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm text-slate-300">
            {data?.hasSupervisorPin ? t("pinSet") : t("pinUnset")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder={t("pinPlaceholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="flex-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
            />
            <button
              type="button"
              disabled={pin.length < 4 || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  dualControlEnabled: enabled,
                  actions,
                  supervisorPin: pin,
                })
              }
              className="h-10 px-4 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold disabled:opacity-50"
            >
              {t("setPin")}
            </button>
            {data?.hasSupervisorPin ? (
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({
                    dualControlEnabled: enabled,
                    actions,
                    clearSupervisorPin: true,
                  })
                }
                className="h-10 px-4 rounded-lg bg-slate-800 text-rose-300 text-sm font-semibold"
              >
                {t("clearPin")}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                dualControlEnabled: enabled,
                actions,
              })
            }
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {tCommon("save")}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">{t("adminOnly")}</p>
      )}
    </GlassCard>
  );
}
