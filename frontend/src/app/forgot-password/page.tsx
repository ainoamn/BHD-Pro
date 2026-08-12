"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword(email);
    } finally {
      // The UI intentionally returns the same response for known and unknown accounts.
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-app flex items-center justify-center p-4">
      <section className="glass w-full max-w-md rounded-2xl p-6 space-y-5" aria-labelledby="forgot-title">
        <h1 id="forgot-title" className="text-2xl font-bold text-slate-900 dark:text-white">
          {t("forgotTitle")}
        </h1>
        {submitted ? (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-slate-700 dark:text-slate-200">
            {t("forgotSent")}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-500">{t("forgotHelp")}</p>
            <div>
              <label htmlFor="forgot-email" className="block text-sm text-slate-600 dark:text-slate-300 mb-1">
                {t("email")}
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <button disabled={loading} className="w-full h-10 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {t("sendReset")}
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
