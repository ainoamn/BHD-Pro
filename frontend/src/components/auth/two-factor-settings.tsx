"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { GlassCard } from "@/components/ui/page-shell";

export function TwoFactorSettings() {
  const t = useTranslations("twoFactor");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["2fa-status"],
    queryFn: async () => {
      const res = await api.get2faStatus();
      return res.data;
    },
  });

  const setupMutation = useMutation({
    mutationFn: () => api.setup2fa(),
    onSuccess: (res) => {
      setSetup({
        qrCodeDataUrl: res.data.qrCodeDataUrl,
        secret: res.data.secret,
      });
      setCode("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirm2fa(code),
    onSuccess: () => {
      toast.success(t("enabled"));
      setSetup(null);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => api.disable2fa(password, code),
    onSuccess: () => {
      toast.success(t("disabled"));
      setPassword("");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  if (isLoading) {
    return (
      <GlassCard className="p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      </GlassCard>
    );
  }

  const enabled = !!status?.enabled;

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Shield className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
          <p className="text-sm text-slate-400 mt-1">{t("subtitle")}</p>
          <p className="text-sm mt-2">
            <span className="text-slate-400">{t("status")}: </span>
            <span className={enabled ? "text-emerald-400" : "text-amber-400"}>
              {enabled ? t("on") : t("off")}
            </span>
          </p>
        </div>
      </div>

      {!enabled && !setup && (
        <button
          type="button"
          onClick={() => setupMutation.mutate()}
          disabled={setupMutation.isPending}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
        >
          {setupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("enable")}
        </button>
      )}

      {setup && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-300">{t("scanHint")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrCodeDataUrl}
            alt="2FA QR"
            className="w-44 h-44 rounded-lg bg-white p-2"
          />
          <p className="text-xs text-slate-500 break-all">
            {t("manualSecret")}: <code className="text-emerald-400">{setup.secret}</code>
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("code")}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || code.length < 6}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
            >
              {t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => setSetup(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-400">{t("disableHint")}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password")}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("code")}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <button
            type="button"
            onClick={() => disableMutation.mutate()}
            disabled={disableMutation.isPending || !password || code.length < 6}
            className="px-4 py-2 rounded-lg bg-rose-600/80 text-white text-sm disabled:opacity-50"
          >
            {t("disable")}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
