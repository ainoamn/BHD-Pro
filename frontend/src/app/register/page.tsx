"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Calculator, Mail, Lock, User, Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const tSub = useTranslations("subscription");
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 10) {
      toast.error(t("passwordHint"));
      return;
    }
    setLoading(true);
    try {
      await api.register(form);
      toast.success(t("register"));
      router.push("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(" — ") : msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center mb-4">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{tApp("name")}</h1>
          <p className="text-slate-400 mt-1">{tApp("tagline")}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("register")}</h2>
          <p className="text-xs text-slate-500">{t("starterOnlyHint")}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t("name")}</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 pr-10 pl-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t("companyName")}</label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full h-10 pr-10 pl-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">{t("email")}</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-10 pr-10 pl-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">{t("password")}</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full h-10 pr-10 pl-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                minLength={10}
                autoComplete="new-password"
                required
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{t("passwordHint")}</p>
          </div>

          <p className="text-xs text-slate-500">
            {tSub("starter")} — {t("upgradeLater")}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("register")}
          </button>

          <p className="text-center text-sm text-slate-400">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              {t("login")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
