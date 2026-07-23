"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function PosLoginPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) await api.restoreSession();
      if (cancelled) return;
      if (useAuthStore.getState().isAuthenticated) {
        try {
          await api.activatePosLink();
        } catch {
          /* optional */
        }
        router.replace("/pos");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router]);

  const finish = async () => {
    try {
      await api.activatePosLink();
    } catch {
      /* optional */
    }
    toast.success(t.signIn);
    router.replace("/pos");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.login(email, password);
      await finish();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hisaby-mark.png" alt="" className="mx-auto h-14 w-14 rounded-2xl mb-3" />
          <h1 className="text-2xl font-extrabold">{t.loginTitle}</h1>
          <p className="text-sm text-slate-400 mt-1">{t.loginSub}</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="text-xs font-bold text-slate-400"
            >
              {locale === "en" ? "عربية" : "English"}
            </button>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 text-white focus:outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t.password}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 text-white focus:outline-none focus:border-sky-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.signIn}
          </button>
          <GoogleSignInButton onSuccess={finish} />
          <p className="text-center text-xs text-slate-500">
            <Link href="/login?next=/dashboard" className="text-emerald-400 hover:underline">
              {t.toAccounting}
            </Link>
            {" · "}
            <Link href="/" className="hover:underline">
              Hisaby
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
