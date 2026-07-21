"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2, Percent, Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Company } from "@/types";
import { cn } from "@/lib/utils";
import { PaymentGatewaysSettings } from "@/components/payments/payment-gateways-settings";

const CURRENCIES = [
  { code: "OMR", labelAr: "ريال عماني (ر.ع)" },
  { code: "SAR", labelAr: "ريال سعودي (ر.س)" },
  { code: "AED", labelAr: "درهم إماراتي (د.إ)" },
  { code: "KWD", labelAr: "دينار كويتي (د.ك)" },
  { code: "BHD", labelAr: "دينار بحريني (د.ب)" },
  { code: "QAR", labelAr: "ريال قطري (ر.ق)" },
  { code: "USD", labelAr: "دولار أمريكي ($)" },
  { code: "EUR", labelAr: "يورو (€)" },
];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { company: authCompany, setCompany } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    crNumber: "",
    vatNumber: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    website: "",
    language: "ar",
    currency: "OMR",
    applyVat: true,
    pricesIncludeTax: false,
    vatRate: 5,
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await api.getCompany();
      return res.data as Company;
    },
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        crNumber: company.crNumber || "",
        vatNumber: company.vatNumber || "",
        address: company.address || "",
        city: company.city || "",
        phone: company.phone || "",
        email: company.email || "",
        website: (company as Company & { website?: string }).website || "",
        language: company.language || "ar",
        currency: company.currency || "OMR",
        applyVat: company.applyVat !== false,
        pricesIncludeTax: !!company.pricesIncludeTax,
        vatRate: company.vatRate ?? 5,
      });
      if (authCompany) {
        setCompany({ ...authCompany, ...company });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateCompany(form),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      const updated = res.data as Company;
      if (authCompany) {
        setCompany({ ...authCompany, ...updated });
      } else {
        setCompany(updated);
      }
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("saveError")),
  });

  const fields: { key: keyof typeof form; label: string; type?: string; required?: boolean }[] = [
    { key: "name", label: t("companyName"), required: true },
    { key: "crNumber", label: t("crNumber") },
    { key: "vatNumber", label: t("vatNumber") },
    { key: "email", label: t("email"), type: "email" },
    { key: "phone", label: t("phone") },
    { key: "website", label: t("website") },
    { key: "address", label: t("address") },
    { key: "city", label: t("city") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <GlassCard className="p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="max-w-2xl space-y-8"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">{t("companyInfo")}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => (
                  <div key={field.key} className={field.key === "address" ? "md:col-span-2" : ""}>
                    <label className="block text-sm text-slate-400 mb-1">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      value={String(form[field.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      required={field.required}
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("language")}</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ar">{tCommon("arabic")}</option>
                    <option value="en">{tCommon("english")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("currency")}</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Percent className="w-6 h-6 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">{t("taxSettings")}</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">{t("taxSettingsHint")}</p>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={form.applyVat}
                    onChange={(e) => setForm({ ...form, applyVat: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-white font-medium">{t("applyVat")}</p>
                    <p className="text-xs text-slate-400 mt-1">{t("applyVatHint")}</p>
                  </div>
                </label>

                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", !form.applyVat && "opacity-50 pointer-events-none")}>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{t("vatRate")}</label>
                    <div className="flex items-center gap-2">
                      <DecimalInput
                        value={form.vatRate}
                        onChange={(v) => setForm({ ...form, vatRate: v })}
                        decimals={2}
                        min={0}
                        className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:border-slate-600 md:mt-5">
                    <input
                      type="checkbox"
                      checked={form.pricesIncludeTax}
                      onChange={(e) => setForm({ ...form, pricesIncludeTax: e.target.checked })}
                      disabled={!form.applyVat}
                      className="mt-1 w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="text-white font-medium text-sm">{t("pricesIncludeTax")}</p>
                      <p className="text-xs text-slate-400 mt-1">{t("pricesIncludeTaxHint")}</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={!form.name || saveMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {tCommon("save")}
              </button>
            </div>
          </form>
        )}
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-white">{t("periodLocks")}</h2>
              <p className="text-sm text-slate-400 mt-1">{t("periodLocksDesc")}</p>
            </div>
          </div>
          <Link
            href="/period-locks"
            className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700"
          >
            {t("periodLocks")}
          </Link>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Percent className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-white">{t("taxRatesLink")}</h2>
              <p className="text-sm text-slate-400 mt-1">{t("taxRatesLinkDesc")}</p>
            </div>
          </div>
          <Link
            href="/tax-rates"
            className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700"
          >
            {t("taxRatesLink")}
          </Link>
        </div>
      </GlassCard>

      <GlassCard>
        <PaymentGatewaysSettings />
      </GlassCard>
    </div>
  );
}
