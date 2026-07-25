"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  Package,
  PieChart,
  Shield,
  ShoppingCart,
} from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { landingCopy } from "@/lib/landing-copy";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

const featureIcons = [FileText, ShoppingCart, Package, PieChart, Building2, Shield];

type PlatformStats = {
  companies: number;
  users: number;
  visits: {
    total: number;
    last30Days: number;
    uniqueTotal: number;
    uniqueLast30Days: number;
  };
  finance: {
    sales: number;
    purchases: number;
    collected: number;
    receivables: number;
    volumeManaged: number;
    currency: "OMR";
  };
  growth: {
    companies: number | null;
    users: number | null;
    visits: number | null;
    volume: number | null;
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
  return fmt(Math.round(n * 10) / 10, n % 1 === 0 ? 0 : 1);
}

function GrowthBadge({
  value,
  label,
}: {
  value: number | null | undefined;
  label: string;
}) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <p
      className={cn(
        "mt-1 text-[11px] font-semibold",
        up ? "text-emerald-700" : "text-rose-600"
      )}
      title={label}
    >
      {up ? "↑" : "↓"} {Math.abs(value)}%
    </p>
  );
}

function AnimatedMetric({
  value,
  label,
  hint,
  growth,
  growthLabel,
  locale,
}: {
  value: number;
  label: string;
  hint?: string | null;
  growth?: number | null;
  growthLabel: string;
  locale: string;
}) {
  const { ref, display } = useCountUp(value, true);
  return (
    <div ref={ref} className="min-w-0">
      <p className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl tabular-nums">
        {formatCompact(display, locale)}
      </p>
      <p className="mt-1.5 text-xs font-medium leading-snug text-slate-500">{label}</p>
      <GrowthBadge value={growth} label={growthLabel} />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function LandingPage() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [customerLogos, setCustomerLogos] = useState<
    { id: string; name: string; logo: string }[]
  >([]);
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
        if (!cancelled && res.data) setStats(res.data as PlatformStats);
      } catch {
        // keep section hidden if API unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPublicCustomerLogos();
        if (!cancelled && res.data?.companies?.length) {
          setCustomerLogos(res.data.companies);
        }
      } catch {
        /* optional strip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fafcfb] text-slate-900" dir={isAr ? "rtl" : "ltr"}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          background: "linear-gradient(90deg, #C8102E 0%, #C8102E 22%, #ffffff 22%, #ffffff 48%, #0B6B45 48%)",
          height: "2px",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-emerald-950/5 bg-[#fafcfb]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/hisaby-mark.png" alt="Hisaby" width={32} height={32} className="rounded-lg" priority />
            <span className="text-lg font-extrabold tracking-tight text-emerald-950">{t.brand}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-500 md:flex">
            <a href="#stats" className="transition-colors hover:text-emerald-900">
              {t.statsTitle}
            </a>
            <a href="#customers" className="transition-colors hover:text-emerald-900">
              {t.customersTitle}
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

      <section className="relative min-h-[min(92vh,820px)] overflow-hidden">
        <Image
          src="/landing/oman-alam-palace.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            "object-cover transition-all duration-[1.6s] ease-out",
            visible ? "scale-100 opacity-100" : "scale-105 opacity-0"
          )}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: isAr
              ? "linear-gradient(105deg, rgba(250,252,251,0.94) 0%, rgba(250,252,251,0.82) 38%, rgba(250,252,251,0.35) 62%, rgba(10,45,32,0.28) 100%)"
              : "linear-gradient(255deg, rgba(250,252,251,0.94) 0%, rgba(250,252,251,0.82) 38%, rgba(250,252,251,0.35) 62%, rgba(10,45,32,0.28) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#fafcfb] via-transparent to-[#fafcfb]/40"
        />

        <div className="relative mx-auto flex min-h-[min(92vh,820px)] max-w-6xl items-center px-4 py-20 sm:px-6 md:py-24">
          <div
            className={cn(
              "max-w-xl transition-all duration-700 ease-out",
              visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            )}
          >
            <div className="rounded-3xl border border-white/50 bg-white/55 p-7 shadow-[0_20px_60px_-28px_rgba(6,61,40,0.25)] backdrop-blur-md sm:p-9">
              <p className="mb-4 text-5xl font-extrabold tracking-tight text-emerald-950 sm:text-6xl lg:text-[3.75rem] lg:leading-none">
                {t.brand}
              </p>
              <h1 className="text-[1.3rem] font-bold leading-snug text-slate-700 sm:text-2xl">
                {t.headline}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-500">{t.subhead}</p>
              <div
                className={cn(
                  "mt-8 flex flex-wrap gap-3 transition-all delay-150 duration-700",
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
                      className="rounded-2xl border border-emerald-950/10 bg-white/80 px-7 py-3 text-[15px] font-bold text-emerald-950 transition hover:bg-white"
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
                      className="rounded-2xl border border-emerald-950/10 bg-white/80 px-7 py-3 text-[15px] font-bold text-emerald-950 transition hover:bg-white"
                    >
                      {t.login}
                    </Link>
                  </>
                )}
              </div>
              <p className="mt-6 text-xs font-medium tracking-wide text-emerald-800/65">{t.regionLine}</p>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section id="stats" className="border-y border-emerald-950/[0.04] bg-white py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.statsTitle}</p>
            <p className="mt-3 max-w-2xl text-[15px] text-slate-500">{t.statsSub}</p>
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatedMetric
                value={stats.companies}
                label={t.statCompanies}
                growth={stats.growth?.companies}
                growthLabel={t.vsLastMonth}
                locale={locale}
              />
              <AnimatedMetric
                value={stats.users}
                label={t.statUsers}
                growth={stats.growth?.users}
                growthLabel={t.vsLastMonth}
                locale={locale}
              />
              <AnimatedMetric
                value={stats.finance.volumeManaged}
                label={t.statVolume}
                growth={stats.growth?.volume}
                growthLabel={t.vsLastMonth}
                locale={locale}
              />
              <AnimatedMetric
                value={stats.finance.collected}
                label={t.statCollected}
                locale={locale}
                growthLabel={t.vsLastMonth}
              />
              <AnimatedMetric
                value={stats.finance.receivables}
                label={t.statReceivable}
                locale={locale}
                growthLabel={t.vsLastMonth}
              />
              <AnimatedMetric
                value={stats.visits.total}
                label={t.statVisits}
                growth={stats.growth?.visits}
                growthLabel={t.vsLastMonth}
                hint={`${t.statVisits30}: ${formatCompact(stats.visits.last30Days, locale)}`}
                locale={locale}
              />
              <AnimatedMetric
                value={stats.visits.uniqueTotal}
                label={t.statUnique}
                hint={`${t.statVisits30}: ${formatCompact(stats.visits.uniqueLast30Days, locale)}`}
                locale={locale}
                growthLabel={t.vsLastMonth}
              />
            </div>
          </div>
        </section>
      )}

      <section
        id="customers"
        className="border-b border-emerald-950/[0.04] bg-[#f3f7f5] py-14 md:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">
            {t.customersTitle}
          </p>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-500">{t.customersSub}</p>
          {customerLogos.length === 0 ? (
            <p className="mt-8 text-sm text-slate-400">{t.customersEmpty}</p>
          ) : (
            <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {customerLogos.map((c) => (
                <li
                  key={c.id}
                  className="flex h-20 items-center justify-center rounded-2xl border border-emerald-950/[0.06] bg-white/80 px-4"
                  title={c.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.name}
                    className="max-h-12 max-w-full object-contain opacity-90"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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

      <section className="relative overflow-hidden border-y border-emerald-950/[0.04] py-16 md:py-20">
        <Image
          src="/landing/oman-fort.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-90"
        />
        <div aria-hidden className="absolute inset-0 bg-[#fafcfb]/82 backdrop-blur-[2px]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-l from-emerald-950/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl rounded-3xl border border-white/60 bg-white/55 p-7 shadow-sm backdrop-blur-md sm:p-8">
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.craftTitle}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{t.craftBody}</p>
          </div>
        </div>
      </section>

      <section id="features" className="relative overflow-hidden py-20 md:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "url(/landing/oman-coastal-fort.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div aria-hidden className="absolute inset-0 bg-[#fafcfb]/92" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">{t.featuresTitle}</h2>
          <p className="mt-3 max-w-xl text-[15px] text-slate-500">{t.featuresSub}</p>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] || FileText;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-white/70 bg-white/55 p-5 backdrop-blur-sm transition hover:bg-white/75"
                >
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
                  <p
                    className={cn(
                      "mt-6 text-4xl font-extrabold tracking-tight",
                      featured ? "text-white" : "text-emerald-950"
                    )}
                  >
                    {p.price}
                    <span
                      className={cn(
                        "ms-2 text-sm font-medium",
                        featured ? "text-emerald-200/60" : "text-slate-400"
                      )}
                    >
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

      <section id="company" className="relative overflow-hidden py-20 md:py-24">
        <Image
          src="/landing/oman-coastal-fort.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        <div aria-hidden className="absolute inset-0 bg-[#fafcfb]/78" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-emerald-950/15 via-transparent to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr] md:gap-14">
          <div className="mx-auto w-fit rounded-2xl border border-white/40 bg-emerald-950/95 p-7 shadow-lg backdrop-blur-sm md:mx-0">
            <Image
              src="/brand/bin-hamoud.png"
              alt="Bin Hamood Development"
              width={200}
              height={90}
              className="h-auto w-[180px]"
            />
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/60 p-7 shadow-sm backdrop-blur-md sm:p-8">
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800/70">{t.companyTitle}</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">
              {t.companyName}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-400">{t.companyNameEn}</p>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-600">{t.companyBody}</p>
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
