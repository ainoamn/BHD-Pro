"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Package, PieChart, Shield, Users, Wallet } from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { landingCopy } from "@/lib/landing-copy";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const featureIcons = [FileText, Package, PieChart, Users, Wallet, Shield];

type PlatformStats = {
  companies: number;
  users: number;
  visits: { total: number; last30Days: number };
  finance: {
    sales: number;
    purchases: number;
    collected: number;
    receivables: number;
    volumeManaged: number;
  };
};

function formatCompact(n: number, locale: string) {
  const abs = Math.abs(n);
  const fmt = (value: number, digits: number) =>
    new Intl.NumberFormat(locale === "en" ? "en" : "ar", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value);

  if (abs >= 1_000_000) return `${fmt(n / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${fmt(n / 1_000, 1)}K`;
  return fmt(n, 0);
}

export function LandingPage() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const t = landingCopy[locale === "en" ? "en" : "ar"];
  const isAr = locale !== "en";

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPublicPlatformStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch {
        // keep section hidden if API unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = stats
    ? [
        { label: t.statCompanies, value: formatCompact(stats.companies, locale), hint: null as string | null },
        { label: t.statUsers, value: formatCompact(stats.users, locale), hint: null },
        {
          label: t.statVolume,
          value: formatCompact(stats.finance.volumeManaged, locale),
          hint: null,
        },
        {
          label: t.statCollected,
          value: formatCompact(stats.finance.collected, locale),
          hint: null,
        },
        {
          label: t.statReceivable,
          value: formatCompact(stats.finance.receivables, locale),
          hint: null,
        },
        {
          label: t.statVisits,
          value: formatCompact(stats.visits.total, locale),
          hint: `${t.statVisits30}: ${formatCompact(stats.visits.last30Days, locale)}`,
        },
      ]
    : null;

  return (
    <div className="min-h-screen bg-[#fafcfb] text-slate-900" dir={isAr ? "rtl" : "ltr"}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, #dcefe4 0%, transparent 55%), linear-gradient(180deg, #fafcfb 0%, #f3f8f5 40%, #ffffff 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          background: "linear-gradient(90deg, #C8102E 0%, #C8102E 22%, #ffffff 22%, #ffffff 48%, #0B6B45 48%)",
          height: "2px",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-emerald-950/5 bg-[#fafcfb]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/hisaby-mark.png" alt="Hisaby" width={32} height={32} className="rounded-lg" priority />
            <span className="text-lg font-extrabold tracking-tight text-emerald-950">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-500 md:flex">
            <a href="#stats" className="transition-colors hover:text-emerald-900">
              {t.statsTitle}
            </a>
            <a href="#features" className="transition-colors hover:text-emerald-900">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="transition-colors hover:text-emerald-900">
              {t.navPricing}
            </a>
            <a href="#company" className="transition-colors hover:text-emerald-900">
              {t.navCompany}
            </a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setLocale(isAr ? "en" : "ar")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-emerald-950"
            >
              {t.langSwitch}
            </button>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-emerald-900 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-xl px-3.5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-white sm:inline"
                >
                  {t.login}
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-emerald-900 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
                >
                  {t.register}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-24 h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-3xl transition-opacity duration-1000",
            isAr ? "-left-20" : "-right-20",
            visible ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-0 h-[280px] w-[280px] rounded-full bg-rose-400/5 blur-3xl transition-opacity delay-200 duration-1000",
            isAr ? "right-10" : "left-10",
            visible ? "opacity-100" : "opacity-0"
          )}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:gap-16 md:py-24 lg:py-28">
          <div
            className={cn(
              "transition-all duration-700 ease-out",
              visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            )}
          >
            <p className="mb-5 text-5xl font-extrabold tracking-tight text-emerald-950 sm:text-6xl lg:text-[4rem] lg:leading-none">
              {t.brand}
            </p>
            <h1 className="max-w-xl text-[1.35rem] font-bold leading-snug text-slate-700 sm:text-2xl">
              {t.headline}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-500">{t.subhead}</p>
            <div
              className={cn(
                "mt-9 flex flex-wrap gap-3 transition-all delay-150 duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              )}
            >
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-2xl bg-emerald-900 px-7 py-3 text-[15px] font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800"
                  >
                    {t.openAccounting}
                  </Link>
                  <Link
                    href="/pos"
                    className="rounded-2xl border border-emerald-950/10 bg-white/70 px-7 py-3 text-[15px] font-bold text-emerald-950 backdrop-blur transition hover:bg-white"
                  >
                    {t.openPos}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="rounded-2xl bg-emerald-900 px-7 py-3 text-[15px] font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800"
                  >
                    {t.register}
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-2xl border border-emerald-950/10 bg-white/70 px-7 py-3 text-[15px] font-bold text-emerald-950 backdrop-blur transition hover:bg-white"
                  >
                    {t.login}
                  </Link>
                </>
              )}
            </div>
            <p
              className={cn(
                "mt-8 text-xs font-medium tracking-wide text-emerald-800/60 transition-all delay-300 duration-700",
                visible ? "opacity-100" : "opacity-0"
              )}
            >
              {t.regionLine}
            </p>
          </div>

          <div
            className={cn(
              "relative flex justify-center transition-all duration-1000 ease-out md:justify-end",
              visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            )}
          >
            <div className="relative w-full max-w-[380px]">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-100/40 via-transparent to-rose-50/30"
              />
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#0a3d2c] px-8 pb-8 pt-10 text-white">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg width='56' height='56' viewBox='0 0 56 56' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 2 L54 28 L28 54 L2 28 Z' fill='none' stroke='%23ffffff' stroke-width='1'/%3E%3C/svg%3E\")",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-[#C8102E]/20 blur-2xl"
                />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/50">
                    {t.brandEn}
                  </p>
                  <p className="mt-6 text-3xl font-extrabold tracking-tight">{t.brand}</p>
                  <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-emerald-100/65">
                    {t.footerTag}
                  </p>
                </div>
                <div className="relative mt-12 flex justify-center">
                  <div className="rounded-2xl bg-white/95 p-4 shadow-lg shadow-black/10">
                    <Image
                      src="/brand/hisaby-mark.png"
                      alt=""
                      width={88}
                      height={88}
                      className="rounded-xl"
                      priority
                    />
                  </div>
                </div>
                <p className="relative mt-10 text-center text-[11px] text-emerald-100/45">{t.trustLine}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {metrics && (
        <section id="stats" className="border-y border-emerald-950/[0.04] bg-white py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.statsTitle}</p>
            <p className="mt-3 max-w-2xl text-[15px] text-slate-500">{t.statsSub}</p>
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <p className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">
                    {m.value}
                  </p>
                  <p className="mt-1.5 text-xs font-medium leading-snug text-slate-500">{m.label}</p>
                  {m.hint && <p className="mt-1 text-[11px] text-slate-400">{m.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="products" className="border-y border-emerald-950/[0.04] bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">{t.chooseTitle}</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-500">{t.chooseSub}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Link
              href={isAuthenticated ? "/dashboard" : "/login?next=/dashboard&app=accounting"}
              className="group rounded-2xl border border-emerald-950/10 bg-emerald-50/50 p-6 transition hover:border-emerald-700/30 hover:shadow-md"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800/70">Accounting</p>
              <h3 className="mt-2 text-xl font-extrabold text-emerald-950">{t.accountingCard}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.accountingDesc}</p>
              <span className="mt-5 inline-block text-sm font-bold text-emerald-800 group-hover:underline">
                {t.openAccounting} →
              </span>
            </Link>
            <Link
              href={isAuthenticated ? "/pos" : "/pos/login"}
              className="group rounded-2xl border border-slate-800/20 bg-[#0b1220] p-6 text-white transition hover:border-sky-400/40 hover:shadow-md"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300/80">POS</p>
              <h3 className="mt-2 text-xl font-extrabold">{t.posCard}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{t.posDesc}</p>
              <span className="mt-5 inline-block text-sm font-bold text-sky-300 group-hover:underline">
                {t.openPos} →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-950/[0.04] bg-white/60 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.craftTitle}</p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-500">{t.craftBody}</p>
        </div>
      </section>

      <section id="features" className="py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">{t.featuresTitle}</h2>
          <p className="mt-3 max-w-xl text-[15px] text-slate-500">{t.featuresSub}</p>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] || FileText;
              return (
                <div key={f.title} className="group">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/[0.04] transition group-hover:bg-emerald-950/[0.07]">
                    <Icon className="h-5 w-5 text-emerald-800" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-emerald-950">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-emerald-950/[0.04] bg-white py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">{t.pricingTitle}</h2>
          <p className="mt-3 text-[15px] text-slate-500">{t.pricingSub}</p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {t.plans.map((p) => {
              const featured = Boolean((p as { featured?: boolean }).featured);
              return (
                <div
                  key={p.name}
                  className={cn(
                    "rounded-2xl border p-7 transition",
                    featured
                      ? "border-emerald-900/20 bg-emerald-950 text-white shadow-lg shadow-emerald-950/10"
                      : "border-emerald-950/8 bg-[#fafcfb] hover:border-emerald-900/15"
                  )}
                >
                  <p className={cn("text-xs font-medium", featured ? "text-emerald-200/70" : "text-slate-400")}>
                    {p.note}
                  </p>
                  <h3 className={cn("mt-1.5 text-lg font-bold", featured ? "text-white" : "text-emerald-950")}>
                    {p.name}
                  </h3>
                  <p className={cn("mt-6 text-4xl font-extrabold tracking-tight", featured ? "text-white" : "text-emerald-950")}>
                    {p.price}
                    <span className={cn("ms-2 text-sm font-medium", featured ? "text-emerald-200/60" : "text-slate-400")}>
                      {p.unit}
                    </span>
                  </p>
                  <Link
                    href="/register"
                    className={cn(
                      "mt-8 inline-flex w-full justify-center rounded-xl py-2.5 text-sm font-bold transition",
                      featured
                        ? "bg-white text-emerald-950 hover:bg-emerald-50"
                        : "bg-emerald-900 text-white hover:bg-emerald-800"
                    )}
                  >
                    {t.register}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="company" className="py-20 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr] md:gap-14">
          <div className="mx-auto w-fit rounded-2xl bg-emerald-950 p-7 md:mx-0">
            <Image
              src="/brand/bin-hamoud.png"
              alt="Bin Hamood Development"
              width={200}
              height={90}
              className="h-auto w-[180px]"
            />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.companyTitle}</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">
              {t.companyName}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-400">{t.companyNameEn}</p>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-500">{t.companyBody}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-emerald-950/[0.06] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Image src="/brand/hisaby-mark.png" alt="" width={26} height={26} className="rounded-md" />
              <div>
                <p className="text-sm font-bold text-emerald-950">{t.brand}</p>
                <p className="text-xs text-slate-400">{t.footerTag}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
              <Link href="/login" className="text-slate-500 transition hover:text-emerald-900">
                {t.login}
              </Link>
              <Link href="/register" className="text-slate-500 transition hover:text-emerald-900">
                {t.register}
              </Link>
              <Link
                href="/login?next=/admin&switch=1"
                className="rounded-lg border border-emerald-950/10 bg-[#fafcfb] px-3 py-1.5 text-emerald-950 transition hover:bg-emerald-50"
              >
                {t.adminLogin}
              </Link>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} {t.companyName}. {t.footerRights}.
          </p>
        </div>
      </footer>
    </div>
  );
}
