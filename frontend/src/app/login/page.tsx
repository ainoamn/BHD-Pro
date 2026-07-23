"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, Loader2, Shield } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [email, setEmail] = useState(
    process.env.NODE_ENV === "development" ? "admin@bhd.om" : ""
  );
  const [password, setPassword] = useState(
    process.env.NODE_ENV === "development" ? "Admin123!" : ""
  );
  const [totpCode, setTotpCode] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finishLogin = () => {
    toast.success(t("login"));
    router.push("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tempToken) {
        await api.verify2faLogin(tempToken, totpCode);
        finishLogin();
        return;
      }
      const data = await api.login(email, password);
      if (data?.requires2fa && data.tempToken) {
        setTempToken(data.tempToken);
        toast.success(t("totpPrompt"));
        return;
      }
      finishLogin();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string | string[] }; status?: number };
        code?: string;
        message?: string;
      };
      const msg = axiosErr?.response?.data?.message;
      const status = axiosErr?.response?.status;
      if (!axiosErr?.response) {
        toast.error(t("networkError"));
      } else if (status === 403 && typeof msg === "string" && msg.includes("locked")) {
        toast.error(t("accountLocked"));
      } else {
        toast.error(Array.isArray(msg) ? msg.join(" — ") : msg || t("invalidCredentials"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hisaby-mark.png"
              alt="Hisaby"
              className="w-14 h-14 rounded-2xl object-cover"
            />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tApp("name")}</h1>
          </Link>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{tApp("tagline")}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {tempToken ? t("totpTitle") : t("login")}
          </h2>

          {!tempToken ? (
            <>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">{t("email")}</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t("totpCode")}</label>
              <div className="relative">
                <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full h-10 pr-10 pl-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white tracking-widest focus:outline-none focus:border-emerald-500"
                  placeholder="000000"
                  minLength={6}
                  maxLength={8}
                  required
                />
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 mt-2 hover:text-emerald-400"
                onClick={() => {
                  setTempToken(null);
                  setTotpCode("");
                }}
              >
                {t("backToLogin")}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {tempToken ? t("verifyTotp") : t("login")}
          </button>

          {!tempToken && (
            <GoogleSignInButton
              onSuccess={finishLogin}
              onRequires2fa={(token) => setTempToken(token)}
            />
          )}

          <p className="text-center text-sm text-slate-400">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-emerald-400 hover:underline">
              {t("register")}
            </Link>
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-center text-xs text-slate-500">{t("demoHint")}</p>
          )}
        </form>
      </div>
    </div>
  );
}
