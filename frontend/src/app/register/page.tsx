"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Calculator, Mail, Lock, User, Building2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

const plans = [
  { id: "STARTER", nameKey: "starter" as const, price: "5" },
  { id: "PROFESSIONAL", nameKey: "professional" as const, price: "15" },
  { id: "ENTERPRISE", nameKey: "enterprise" as const, price: "35" },
];

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
    plan: "STARTER",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.register(form);
      toast.success(t("register"));
      router.push("/dashboard");
    } catch {
      toast.error("Registration failed");
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
                minLength={8}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">{tSub("title")}</label>
            <div className="grid grid-cols-3 gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setForm({ ...form, plan: plan.id })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    form.plan === plan.id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <p className="text-sm font-medium">{tSub(plan.nameKey)}</p>
                  <p className="text-xs mt-1">
                    {plan.price} {tSub("omr")}{tSub("perMonth")}
                  </p>
                </button>
              ))}
            </div>
          </div>

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
