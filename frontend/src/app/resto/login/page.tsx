"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { homePathForUser } from "@/lib/user-home";
import { wakeApi } from "@/lib/wake-api";

export default function RestoLoginPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    wakeApi();
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) await api.restoreSession();
      if (cancelled) return;
      if (useAuthStore.getState().isAuthenticated) {
        router.replace(homePathForUser(useAuthStore.getState().user));
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router]);

  const finish = async () => {
    toast.success(t.signIn);
    router.replace(homePathForUser(useAuthStore.getState().user));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.login(email, password);
      await finish();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.linkFail);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
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
          <p className="text-sm text-stone-400 mt-1">{t.loginSub}</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-amber-500/15 bg-white/5 p-6 space-y-4"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="text-xs font-bold text-stone-400 hover:text-white"
            >
              {locale === "en" ? "ع" : "EN"}
            </button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-stone-400">{t.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-stone-400">{t.password}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-amber-500 font-bold text-[#14110f] hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t.signIn}
          </button>
          <GoogleSignInButton onSuccess={() => void finish()} />
          <p className="text-center text-xs text-stone-500">
            <Link href="/login" className="hover:underline">
              {t.toAccounting}
            </Link>
            {" · "}
            <Link href="/pos/login" className="hover:underline">
              {t.toPos}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
