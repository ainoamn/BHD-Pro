"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

type MaintenanceValue = {
  enabled?: boolean;
  messageAr?: string;
  messageEn?: string;
};

export default function AdminSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [messageAr, setMessageAr] = useState("");
  const [messageEn, setMessageEn] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError(false);
    api
      .getAdminSettings()
      .then((res) => {
        const all = res.data as Record<string, MaintenanceValue>;
        const m = (all?.["site.maintenance"] || {}) as MaintenanceValue;
        setEnabled(!!m.enabled);
        setMessageAr(m.messageAr || "");
        setMessageEn(m.messageEn || "");
      })
      .catch(() => {
        setLoadError(true);
        toast.error(en ? "Could not load settings" : "تعذر تحميل الإعدادات");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateAdminSetting("site.maintenance", {
        enabled,
        messageAr: messageAr.trim(),
        messageEn: messageEn.trim(),
      });
      toast.success(en ? "Saved" : "تم الحفظ");
    } catch {
      toast.error(en ? "Save failed" : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">{t.loading}</p>;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3 max-w-md">
        <p className="text-sm text-rose-700">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {t.settings}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.settingsHint}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-teal-950">
              {en ? "Maintenance mode" : "وضع الصيانة"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {en
                ? "When enabled, company users are redirected to the maintenance page."
                : "عند التفعيل يُوجَّه مستخدمو الشركات إلى صفحة الصيانة."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-8 w-14 rounded-full transition-colors ${
              enabled ? "bg-teal-700" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                enabled ? "start-7" : "start-1"
              }`}
            />
          </button>
        </div>

        <label className="block text-xs space-y-1.5">
          <span className="text-slate-500 font-semibold">
            {en ? "Message (Arabic)" : "الرسالة (عربي)"}
          </span>
          <textarea
            value={messageAr}
            onChange={(e) => setMessageAr(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={
              en
                ? "We are performing scheduled maintenance…"
                : "نقوم حالياً بصيانة مجدولة…"
            }
          />
        </label>

        <label className="block text-xs space-y-1.5">
          <span className="text-slate-500 font-semibold">
            {en ? "Message (English)" : "الرسالة (إنجليزي)"}
          </span>
          <textarea
            value={messageEn}
            onChange={(e) => setMessageEn(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            dir="ltr"
            placeholder="We are performing scheduled maintenance…"
          />
        </label>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-teal-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {saving ? t.loading : t.save}
        </button>
      </div>
    </div>
  );
}
