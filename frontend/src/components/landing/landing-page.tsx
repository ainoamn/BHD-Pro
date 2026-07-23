"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Package, PieChart, Shield, Users, Wallet } from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { landingCopy } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const featureIcons = [FileText, Package, PieChart, Users, Wallet, Shield];

export function LandingPage() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(false);
  const t = landingCopy[locale === "en" ? "en" : "ar"];
  const isAr = locale !== "en";

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#f8faf9] text-slate-900"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 420px at 100% 0%, rgba(13,148,136,0.12), transparent 60%), linear-gradient(180deg, #eef6f4 0%, #f8faf9 45%, #ffffff 100%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-teal-900/5 bg-[#f8faf9]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/hisaby-mark.png" alt="Hisaby" width={34} height={34} className="rounded-md" priority />
            <span className="text-lg font-extrabold tracking-tight text-teal-900">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-teal-800">{t.navFeatures}</a>
            <a href="#pricing" className="hover:text-teal-800">{t.navPricing}</a>
            <a href="#company" className="hover:text-teal-800">{t.navCompany}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(isAr ? "en" : "ar")}
              className="rounded-md px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-white"
            >
              {t.langSwitch}
            </button>
            {isAuthenticated ? (
              <Link href="/dashboard" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white">
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-teal-900 sm:inline hover:bg-white">
                  {t.login}
                </Link>
                <Link href="/register" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white">
                  {t.register}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className={cn("transition duration-700", visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
          <p className="mb-3 text-sm font-semibold text-teal-800">{t.trustLine}</p>
          <p className="mb-2 text-4xl font-extrabold tracking-tight text-teal-900 sm:text-5xl">{t.brand}</p>
          <h1 className="max-w-xl text-2xl font-bold leading-snug text-slate-800 sm:text-3xl">{t.headline}</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">{t.subhead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="rounded-xl bg-teal-700 px-6 py-3 text-base font-bold text-white">
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link href="/register" className="rounded-xl bg-teal-700 px-6 py-3 text-base font-bold text-white">
                  {t.register}
                </Link>
                <Link href="/login" className="rounded-xl border border-teal-800/15 bg-white px-6 py-3 text-base font-bold text-teal-950">
                  {t.login}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className={cn("flex justify-center transition duration-1000", visible ? "opacity-100" : "opacity-0")}>
          <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center rounded-[2rem] bg-teal-800 p-10 text-center text-white">
            <Image src="/brand/hisaby-mark.png" alt="" width={120} height={120} className="mb-5 rounded-2xl bg-white p-3" priority />
            <p className="text-3xl font-extrabold">{t.brand}</p>
            <p className="mt-2 text-sm text-teal-100">{t.footerTag}</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-teal-900/5 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold">{t.featuresTitle}</h2>
          <p className="mt-2 max-w-2xl text-slate-600">{t.featuresSub}</p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] || FileText;
              return (
                <div key={f.title}>
                  <Icon className="mb-3 h-6 w-6 text-teal-700" />
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold">{t.pricingTitle}</h2>
          <p className="mt-2 text-slate-300">{t.pricingSub}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {t.plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "rounded-2xl border p-6",
                  Boolean((p as { featured?: boolean }).featured)
                    ? "border-teal-400/40 bg-teal-500/10"
                    : "border-white/10 bg-white/5"
                )}
              >
                <p className="text-sm text-teal-200">{p.note}</p>
                <h3 className="mt-1 text-xl font-bold">{p.name}</h3>
                <p className="mt-4 text-4xl font-extrabold">
                  {p.price}
                  <span className="ms-2 text-base font-medium text-slate-300">{p.unit}</span>
                </p>
                <Link href="/register" className="mt-6 inline-flex w-full justify-center rounded-xl bg-white py-2.5 text-sm font-bold text-slate-900">
                  {t.register}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="company" className="py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[auto_1fr]">
          <div className="mx-auto w-fit rounded-2xl bg-black p-6 md:mx-0">
            <Image src="/brand/bin-hamoud.png" alt="Bin Hamood Development" width={220} height={100} className="h-auto w-[200px]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-800">{t.companyTitle}</p>
            <h2 className="mt-2 text-3xl font-extrabold">{t.companyName}</h2>
            <p className="mt-1 font-medium text-slate-500">{t.companyNameEn}</p>
            <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">{t.companyBody}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/brand/hisaby-mark.png" alt="" width={28} height={28} className="rounded" />
            <div>
              <p className="font-bold">{t.brand}</p>
              <p className="text-xs text-slate-500">{t.footerTag}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {t.companyName}. {t.footerRights}.
          </p>
        </div>
      </footer>
    </div>
  );
}
