"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/api";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = window.location.hash.startsWith("#token=")
      ? window.location.hash.slice("#token=".length)
      : "";
    setToken(decodeURIComponent(raw));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) return setError(t("resetInvalid"));
    if (password !== confirm) return setError(t("passwordMismatch"));
    if (password.length < 10 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return setError(t("passwordHint"));
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setComplete(true);
      setToken("");
      setPassword("");
      setConfirm("");
    } catch {
      setError(t("resetInvalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-app flex items-center justify-center p-4">
      <section className="glass w-full max-w-md rounded-2xl p-6 space-y-5" aria-labelledby="reset-title">
        <h1 id="reset-title" className="text-2xl font-bold text-slate-900 dark:text-white">
          {t("resetTitle")}
        </h1>
        {complete ? (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-slate-700 dark:text-slate-200">
            {t("resetComplete")}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {[{ id: "reset-password", label: t("newPassword"), value: password, set: setPassword }, { id: "reset-confirm", label: t("confirmPassword"), value: confirm, set: setConfirm }].map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm text-slate-600 dark:text-slate-300 mb-1">{field.label}</label>
                <div className="relative">
                  <Lock aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id={field.id}
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    required
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">{t("passwordHint")}</p>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <button disabled={loading} className="w-full h-10 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {t("savePassword")}
            </button>
          </form>
        )}
        <Link href="/login" className="block text-center text-sm text-emerald-500 hover:underline">
          {t("backToLogin")}
        </Link>
      </section>
    </main>
  );
}
