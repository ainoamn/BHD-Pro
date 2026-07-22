"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface GatewayRow {
  slug: string;
  nameAr: string;
  nameEn: string;
  isEnabled: boolean;
  isTestMode: boolean;
  online: boolean;
  config: Record<string, string | boolean>;
  configKeys: { key: string; labelAr: string; labelEn: string; secret?: boolean }[];
}

export function PaymentGatewaysSettings() {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: gateways = [], isLoading } = useQuery({
    queryKey: ["company-gateways"],
    queryFn: async () => {
      const res = await api.getCompanyGateways();
      return res.data as GatewayRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: unknown }) =>
      api.updateCompanyGateway(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-gateways"] });
      toast.success(t("saved"));
      setActiveSlug(null);
    },
    onError: () => toast.error(t("saveError")),
  });

  const openEdit = (gw: GatewayRow) => {
    setActiveSlug(gw.slug);
    const config: Record<string, string> = {};
    for (const k of gw.configKeys) {
      const val = gw.config[k.key];
      // Keep mask placeholder for secrets so empty save won't wipe keys (backend preserves blank/mask)
      config[k.key] = val == null ? "" : String(val);
    }
    setDraft(config);
  };

  const active = gateways.find((g) => g.slug === activeSlug);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5 text-emerald-400" />
        <h3 className="font-semibold text-white">{t("companyGatewaysTitle")}</h3>
      </div>
      <p className="text-sm text-slate-400">{t("companyGatewaysHint")}</p>

      <div className="grid gap-3">
        {gateways.filter((g) => g.online).map((gw) => (
          <div
            key={gw.slug}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-medium text-white">{gw.nameAr}</p>
              <p className="text-xs text-slate-500">{gw.nameEn}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  gw.isEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700 text-slate-400"
                )}
              >
                {gw.isEnabled ? t("enabled") : t("disabled")}
              </span>
              <button
                type="button"
                onClick={() => openEdit(gw)}
                className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                {tCommon("edit")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-lg font-semibold text-white">
              {t("configure")} — {active.nameAr}
            </h4>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={active.isEnabled}
                onChange={(e) =>
                  saveMutation.mutate({
                    slug: active.slug,
                    data: { isEnabled: e.target.checked },
                  })
                }
              />
              {t("enableGateway")}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                defaultChecked={active.isTestMode}
                onChange={(e) =>
                  saveMutation.mutate({
                    slug: active.slug,
                    data: { isTestMode: e.target.checked },
                  })
                }
              />
              {t("testMode")}
            </label>

            {active.configKeys.map((k) => (
              <div key={k.key}>
                <label className="block text-xs text-slate-500 mb-1">{k.labelAr}</label>
                <input
                  type={k.secret ? "password" : "text"}
                  value={draft[k.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [k.key]: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  placeholder={k.secret ? "••••••••" : ""}
                />
              </div>
            ))}

            <p className="text-xs text-slate-500">{t("directPaymentNote")}</p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSlug(null)}
                className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({
                    slug: active.slug,
                    data: { configJson: draft },
                  })
                }
                className="flex-1 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
