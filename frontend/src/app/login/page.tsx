"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, Loader2, Shield } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuthStore } from "@/store/auth";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function LoginForm() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const forceSwitch = searchParams.get("switch") === "1";
  const isAdminNext = nextPath.startsWith("/admin");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentEmail = useAuthStore((s) => s.user?.email);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState(
    process.env.NODE_ENV === "development" ? "admin@bhd.om" : ""
  );
  const [password, setPassword] = useState(
    process.env.NODE_ENV === "development" ? "Admin123!x" : ""
  );
  const [totpCode, setTotpCode] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (forceSwitch && isAuthenticated) {
        await api.logout();
        if (!cancelled) setReady(true);
        return;
      }

      if (!isAuthenticated) {
        await api.restoreSession();
      }

      const auth = useAuthStore.getState();
      if (!auth.isAuthenticated) {
        if (!cancelled) setReady(true);
        return;
      }

      if (isAdminNext) {
        try {
          const res = await api.getAdminMe();
          if (res.data.isPlatformAdmin) {
            router.replace(nextPath);
            return;
          }
        } catch {
          /* stay on login to switch account */
        }
        if (!cancelled) setReady(true);
        return;
      }

      router.replace(nextPath);
    })();
    return () => {
      cancelled = true;
    };
  }, [forceSwitch, isAuthenticated, isAdminNext, nextPath, router]);

  const finishLogin = () => {
    toast.success(t("login"));
    router.replace(nextPath);
  };

  const switchAccount = async () => {
    setSwitching(true);
    try {
      await api.logout();
      setReady(true);
    } finally {
      setSwitching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (useAuthStore.getState().isAuthenticated) {
        await api.logout();
      }
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

  if (!ready) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const stillLoggedIn = useAuthStore.getState().isAuthenticated;

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
          {isAdminNext && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 font-medium">
              تسجيل دخول مشرف المنصة
            </p>
          )}
        </div>

        {stillLoggedIn && isAdminNext && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p>
              أنت مسجّل حاليًا كـ <strong>{currentEmail}</strong> وليس لديه صلاحية إدارة المنصة.
            </p>
            <button
              type="button"
              onClick={switchAccount}
              disabled={switching}
              className="text-sm font-bold underline underline-offset-2"
            >
              {switching ? "…" : "تسجيل الخروج والدخول بحساب المشرف"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {tempToken ? t("totpTitle") : isAdminNext ? "دخول الإدارة" : t("login")}
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
            <Link href="/" className="text-emerald-400 hover:underline">
              العودة للرئيسية
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-app flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
