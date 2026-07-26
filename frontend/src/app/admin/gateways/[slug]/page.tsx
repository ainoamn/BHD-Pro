"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { GatewayLogo } from "@/components/admin/gateway-logo";

type ConfigKey = { key: string; labelAr: string; labelEn: string; secret?: boolean };

type Gateway = {
  slug: string;
  nameAr: string;
  nameEn: string;
  isEnabled: boolean;
  isTestMode: boolean;
  online?: boolean;
  configJson: Record<string, string>;
  configKeys: ConfigKey[];
};

export default function AdminGatewayDetailPage() {
  const params = useParams();
  const slug = String(params.slug || "").toUpperCase();
  const locale = useLocaleStore((s) => s.locale);
  const en = locale === "en";
  const [g, setG] = useState<Gateway | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.getAdminPaymentGateway(slug);
      const data = res.data as Gateway;
      setG(data);
      setIsEnabled(data.isEnabled);
      setIsTestMode(data.isTestMode);
      setConfig({ ...(data.configJson || {}) });
    } catch {
      setG(null);
      setLoadError(true);
      toast.error(en ? "Gateway not found" : "البوابة غير موجودة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateAdminPaymentGateway(slug, {
        isEnabled,
        isTestMode,
        configJson: config,
      });
      const data = res.data as Gateway;
      setG(data);
      setConfig({ ...(data.configJson || {}) });
      toast.success(en ? "Gateway saved" : "تم حفظ البوابة");
    } catch {
      toast.error(en ? "Save failed" : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (!g) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3 max-w-md">
        <p className="text-sm text-rose-700">
          {loadError
            ? en
              ? "Could not load gateway"
              : "تعذر تحميل البوابة"
            : en
              ? "Gateway not found"
              : "البوابة غير موجودة"}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold"
        >
          {en ? "Retry" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  const apiPublic =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_PUBLIC_URL || "https://hisaby-api.onrender.com"
      : "https://hisaby-api.onrender.com";

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/admin/gateways"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-800"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {en ? "Back to gateways" : "العودة للبوابات"}
      </Link>

      <div className="flex items-center gap-4">
        <GatewayLogo slug={g.slug} size="lg" />
        <div>
          <h1 className="text-2xl font-extrabold text-teal-950">
            {en ? g.nameEn : g.nameAr}
          </h1>
          <p className="text-sm text-slate-500 font-mono">{g.slug}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 shadow-sm">
        <h2 className="font-bold text-slate-900">
          {en ? "Settings" : "الإعدادات"}
        </h2>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700"
            />
            {en ? "Enable for subscription checkout" : "تفعيل لدفع الاشتراكات"}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={isTestMode}
              onChange={(e) => setIsTestMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600"
            />
            {en ? "Test mode" : "وضع تجريبي"}
          </label>
        </div>

        <div className="grid gap-4">
          {(g.configKeys || []).map((key) => (
            <div key={key.key} className="space-y-1.5">
              <label className="text-xs font-mono text-slate-500">
                {en ? key.labelEn : key.labelAr}{" "}
                <span className="text-slate-400">({key.key})</span>
              </label>
              <input
                dir="ltr"
                type={key.secret ? "password" : "text"}
                value={config[key.key] ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, [key.key]: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                placeholder={key.secret ? "••••••••" : ""}
              />
            </div>
          ))}
        </div>

        {g.online !== false && g.slug !== "BANK_TRANSFER" && g.slug !== "MANUAL" ? (
          <div className="rounded-xl border bg-slate-50 p-3 text-xs font-mono break-all text-slate-600">
            Webhook: {apiPublic}/api/payments/webhooks/{g.slug.toLowerCase()}
          </div>
        ) : null}

        <p className="text-xs text-slate-500">
          {en
            ? "Leave secret fields as •••••••• to keep existing keys. Empty + save keeps the stored secret."
            : "اترك الحقول السرية كـ •••••••• للإبقاء على المفاتيح الحالية."}
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {en ? "Save" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
