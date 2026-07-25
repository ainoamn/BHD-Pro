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
  whatsappConfigured?: boolean;
  whatsappNotifyPhones?: string[];
  nfcBadgesConfigured?: boolean;
  nfcBadgeCount?: number;
  shiftVarianceLimit?: number;
  cashOutApprovalLimit?: number;
  requireOpenShift?: boolean;
  autoSendPosReceipts?: boolean;
  autoEmailZReportOnClose?: boolean;
  zReportNotifyEmails?: string[];
  actions: {
    POS_VOID: boolean;
    POS_PRICE_OVERRIDE: boolean;
    POS_REFUND: boolean;
    STOCK_ADJUST: boolean;
    STOCK_TRANSFER: boolean;
    INVOICE_CANCEL: boolean;
    PAYMENT_REVERSE: boolean;
    SHIFT_CLOSE_VARIANCE: boolean;
    SHIFT_CASH_OUT: boolean;
    PAYROLL_PAY: boolean;
    CLAIM_PAY: boolean;
    BANK_INTERNAL_TRANSFER: boolean;
    RESTO_VOID: boolean;
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
  "SHIFT_CLOSE_VARIANCE",
  "SHIFT_CASH_OUT",
  "PAYROLL_PAY",
  "CLAIM_PAY",
  "BANK_INTERNAL_TRANSFER",
  "RESTO_VOID",
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
    SHIFT_CLOSE_VARIANCE: true,
    SHIFT_CASH_OUT: true,
    PAYROLL_PAY: true,
    CLAIM_PAY: true,
    BANK_INTERNAL_TRANSFER: true,
    RESTO_VOID: true,
  });
  const [pin, setPin] = useState("");
  const [whatsappPhones, setWhatsappPhones] = useState("");
  const [nfcSecret, setNfcSecret] = useState("");
  const [varianceLimit, setVarianceLimit] = useState("1");
  const [cashOutLimit, setCashOutLimit] = useState("20");
  const [requireOpenShift, setRequireOpenShift] = useState(false);
  const [autoSendPosReceipts, setAutoSendPosReceipts] = useState(true);
  const [autoEmailZReportOnClose, setAutoEmailZReportOnClose] = useState(false);
  const [zReportEmails, setZReportEmails] = useState("");

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
    const defaults: SecurityPublic["actions"] = {
      POS_VOID: true,
      POS_PRICE_OVERRIDE: true,
      POS_REFUND: true,
      STOCK_ADJUST: true,
      STOCK_TRANSFER: true,
      INVOICE_CANCEL: true,
      PAYMENT_REVERSE: true,
      SHIFT_CLOSE_VARIANCE: true,
      SHIFT_CASH_OUT: true,
      PAYROLL_PAY: true,
      CLAIM_PAY: true,
      BANK_INTERNAL_TRANSFER: true,
      RESTO_VOID: true,
    };
    setActions({ ...defaults, ...data.actions });
    setVarianceLimit(String(data.shiftVarianceLimit ?? 1));
    setCashOutLimit(String(data.cashOutApprovalLimit ?? 20));
    setRequireOpenShift(data.requireOpenShift === true);
    setAutoSendPosReceipts(data.autoSendPosReceipts !== false);
    setAutoEmailZReportOnClose(data.autoEmailZReportOnClose === true);
    setZReportEmails((data.zReportNotifyEmails || []).join(", "));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateCompanySecurity(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-security"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success(t("saved"));
      setPin("");
      setNfcSecret("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const baseBody = () => ({
    dualControlEnabled: enabled,
    actions,
    shiftVarianceLimit: Number(varianceLimit) || 0,
    cashOutApprovalLimit: Number(cashOutLimit) || 0,
    requireOpenShift,
    autoSendPosReceipts,
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
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t("varianceLimit")}</label>
            <input
              type="number"
              min={0}
              step="0.001"
              value={varianceLimit}
              onChange={(e) => setVarianceLimit(e.target.value)}
              className="w-full sm:w-40 h-10 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">{t("varianceHint")}</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{t("cashOutLimit")}</label>
            <input
              type="number"
              min={0}
              step="0.001"
              value={cashOutLimit}
              onChange={(e) => setCashOutLimit(e.target.value)}
              className="w-full sm:w-40 h-10 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">{t("cashOutLimitHint")}</p>
          </div>

          <label className="flex items-center justify-between gap-4 text-sm text-slate-200">
            <span>
              <span className="block">{t("requireOpenShift")}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5 font-normal">
                {t("requireOpenShiftHint")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={requireOpenShift}
              disabled={!isAdmin || saveMutation.isPending}
              onChange={(e) => setRequireOpenShift(e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between gap-4 text-sm text-slate-200">
            <span>
              <span className="block">{t("autoSendPosReceipts")}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5 font-normal">
                {t("autoSendPosReceiptsHint")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={autoSendPosReceipts}
              disabled={!isAdmin || saveMutation.isPending}
              onChange={(e) => setAutoSendPosReceipts(e.target.checked)}
            />
          </label>

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
                  ...baseBody(),
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
                    ...baseBody(),
                    clearSupervisorPin: true,
                  })
                }
                className="h-10 px-4 rounded-lg bg-slate-800 text-rose-300 text-sm font-semibold"
              >
                {t("clearPin")}
              </button>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-sm text-slate-300">{t("whatsappPhones")}</p>
            <p className="text-[11px] text-slate-500">
              {data?.whatsappConfigured
                ? t("whatsappReady")
                : t("whatsappNotConfigured")}
              {data?.whatsappNotifyPhones?.length
                ? ` · ${data.whatsappNotifyPhones.join(", ")}`
                : ""}
            </p>
            <textarea
              value={whatsappPhones}
              onChange={(e) => setWhatsappPhones(e.target.value)}
              placeholder={t("whatsappPhonesPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
            />
            <button
              type="button"
              disabled={saveMutation.isPending || !whatsappPhones.trim()}
              onClick={() => {
                const phones = whatsappPhones
                  .split(/[\s,;]+/)
                  .map((p) => p.replace(/\D/g, ""))
                  .filter((p) => p.length >= 8);
                saveMutation.mutate({
                  ...baseBody(),
                  whatsappNotifyPhones: phones,
                });
              }}
              className="h-10 px-4 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {t("saveWhatsapp")}
            </button>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-sm text-slate-300">{t("nfcBadges")}</p>
            <p className="text-[11px] text-slate-500">
              {data?.nfcBadgesConfigured
                ? t("nfcSet", { count: data.nfcBadgeCount ?? 0 })
                : t("nfcUnset")}
            </p>
            <p className="text-[11px] text-slate-500">{t("nfcHint")}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={nfcSecret}
                onChange={(e) => setNfcSecret(e.target.value)}
                placeholder={t("nfcPlaceholder")}
                className="flex-1 h-10 px-3 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                autoComplete="off"
              />
              <button
                type="button"
                disabled={nfcSecret.trim().length < 4 || saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({
                    ...baseBody(),
                    addNfcBadgeSecret: nfcSecret.trim(),
                  })
                }
                className="h-10 px-4 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {t("addNfc")}
              </button>
              {data?.nfcBadgesConfigured ? (
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      ...baseBody(),
                      clearNfcBadges: true,
                    })
                  }
                  className="h-10 px-4 rounded-lg bg-slate-800 text-rose-300 text-sm font-semibold"
                >
                  {t("clearNfc")}
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(baseBody())}
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
