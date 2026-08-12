"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Columns2,
  FileText,
  Package,
  PieChart,
  Shield,
  ShoppingCart,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { landingCopy } from "@/lib/landing-copy";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import {
  monthlyFromYearly,
  yearlySavings,
} from "@/lib/plan-pricing";

const featureIcons = [FileText, ShoppingCart, UtensilsCrossed, Package, PieChart, Shield];

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

type PublicPlanHighlightGroup = {
  groupId: string;
  labelAr: string;
  labelEn: string;
  items: { code: string; labelAr: string; labelEn: string }[];
};

type PublicPlan = {
  id: string;
  code?: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscountPct: number;
  currency: string;
  invoicesLimit?: number;
  usersLimit?: number;
  support?: string;
  sortOrder?: number;
  highlights?: PublicPlanHighlightGroup[];
};

function formatPlanPrice(n: number) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatLimitLabel(
  n: number | undefined | null,
  unlimitedLabel: string,
): string {
  if (n == null) return "—";
  if (n < 0) return unlimitedLabel;
  return String(n);
}

type CompareCell =
  | { kind: "text"; value: string }
  | { kind: "bool"; value: boolean };

type CompareRow = {
  id: string;
  label: string;
  cells: CompareCell[];
  differs: boolean;
};

function buildPlanCompareRows(
  plans: PublicPlan[],
  opts: {
    billing: "monthly" | "yearly";
    isAr: boolean;
    priceLabel: string;
    usersLabel: string;
    invoicesLabel: string;
    supportLabel: string;
    unlimitedLabel: string;
    perMonth: string;
    perYear: string;
  },
): CompareRow[] {
  const rows: CompareRow[] = [];

  const markDiffers = (cells: CompareCell[]) => {
    if (cells.length <= 1) return false;
    const key = (c: CompareCell) =>
      c.kind === "bool" ? `b:${c.value}` : `t:${c.value}`;
    const first = key(cells[0]!);
    return cells.some((c) => key(c) !== first);
  };

  const pushText = (id: string, label: string, values: string[]) => {
    const cells: CompareCell[] = values.map((value) => ({
      kind: "text",
      value,
    }));
    rows.push({ id, label, cells, differs: markDiffers(cells) });
  };

  const unit = opts.billing === "monthly" ? opts.perMonth : opts.perYear;
  pushText(
    "price",
    opts.priceLabel,
    plans.map((p) => {
      const price =
        opts.billing === "monthly" ? p.monthlyPrice : p.yearlyPrice;
      return `${formatPlanPrice(price)} ${unit}`;
    }),
  );
  pushText(
    "users",
    opts.usersLabel,
    plans.map((p) => formatLimitLabel(p.usersLimit, opts.unlimitedLabel)),
  );
  pushText(
    "invoices",
    opts.invoicesLabel,
    plans.map((p) => formatLimitLabel(p.invoicesLimit, opts.unlimitedLabel)),
  );
  pushText(
    "support",
    opts.supportLabel,
    plans.map((p) => (p.support?.trim() ? p.support : "—")),
  );

  const itemMeta = new Map<
    string,
    { labelAr: string; labelEn: string; groupOrder: number; itemOrder: number }
  >();
  plans.forEach((p) => {
    (p.highlights || []).forEach((g, gi) => {
      g.items.forEach((item, ii) => {
        if (!itemMeta.has(item.code)) {
          itemMeta.set(item.code, {
            labelAr: item.labelAr,
            labelEn: item.labelEn,
            groupOrder: gi,
            itemOrder: ii,
          });
        }
      });
    });
  });

  const codes = Array.from(itemMeta.entries()).sort((a, b) => {
    if (a[1].groupOrder !== b[1].groupOrder) {
      return a[1].groupOrder - b[1].groupOrder;
    }
    return a[1].itemOrder - b[1].itemOrder;
  });

  for (const [code, meta] of codes) {
    const cells: CompareCell[] = plans.map((p) => {
      const yes = (p.highlights || []).some((g) =>
        g.items.some((it) => it.code === code),
      );
      return { kind: "bool", value: yes };
    });
    rows.push({
      id: `feat:${code}`,
      label: opts.isAr ? meta.labelAr : meta.labelEn,
      cells,
      differs: markDiffers(cells),
    });
  }

  return rows;
}

async function loadPublicPlansClient(): Promise<PublicPlan[]> {
  // Same-origin rewrite — skip auth cookies / axios 401 refresh on public catalog
  const res = await fetch("/backend-api/public/plans", {
    credentials: "omit",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`plans ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as PublicPlan[]) : [];
}

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

export function LandingPage({
  initialPlans = [],
}: {
  initialPlans?: PublicPlan[];
}) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [customerLogos, setCustomerLogos] = useState<
    { id: string; name: string; logo: string }[]
  >([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [livePlans, setLivePlans] = useState<PublicPlan[]>(initialPlans);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareDiffsOnly, setCompareDiffsOnly] = useState(true);
  const t = landingCopy[locale === "en" ? "en" : "ar"];
  const isAr = locale !== "en";

  const compareRows = useMemo(() => {
    if (!showCompare || livePlans.length < 2) return [];
    return buildPlanCompareRows(livePlans, {
      billing,
      isAr,
      priceLabel: t.comparePrice,
      usersLabel: t.usersCap,
      invoicesLabel: t.invoicesCap,
      supportLabel: t.supportLabel,
      unlimitedLabel: t.unlimited,
      perMonth: t.perMonth,
      perYear: t.perYear,
    });
  }, [
    showCompare,
    livePlans,
    billing,
    isAr,
    t.comparePrice,
    t.usersCap,
    t.invoicesCap,
    t.supportLabel,
    t.unlimited,
    t.perMonth,
    t.perYear,
  ]);

  const visibleCompareRows = compareDiffsOnly
    ? compareRows.filter((r) => r.differs)
    : compareRows;

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

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const rows = await loadPublicPlansClient();
        if (!cancelled && rows.length) setLivePlans(rows);
      } catch {
        // keep SSR / previous plans
      }
    };
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (initialPlans.length) setLivePlans(initialPlans);
  }, [initialPlans]);

  useEffect(() => {
    if (openPlanId && livePlans.length && !livePlans.some((p) => p.id === openPlanId)) {
      setOpenPlanId(null);
    }
  }, [livePlans, openPlanId]);

  const showPricing = (mode: "monthly" | "yearly") => {
    setBilling(mode);
    if (typeof document !== "undefined") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  };

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
            <a href="#products" className="transition-colors hover:text-emerald-900">
              {t.navProducts}
            </a>
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
                    <Link
                      href="/resto"
                      className="rounded-2xl border border-amber-900/20 bg-[#14110f] px-7 py-3 text-[15px] font-bold text-amber-100 transition hover:bg-[#1c1815]"
                    >
                      {t.openResto}
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
                    <button
                      type="button"
                      onClick={() => showPricing(billing === "monthly" ? "yearly" : "monthly")}
                      className="rounded-2xl border border-emerald-950/10 bg-white/80 px-7 py-3 text-[15px] font-bold text-emerald-950 transition hover:bg-white"
                    >
                      {t.compareBilling}
                    </button>
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
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
            <Link
              href={isAuthenticated ? "/resto" : "/resto/login"}
              className="group rounded-2xl border border-amber-900/20 bg-[#14110f] p-6 text-white transition hover:border-amber-400/40 hover:shadow-md md:col-span-2 lg:col-span-1"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/80">Restaurants</p>
              <h3 className="mt-2 text-xl font-extrabold">{t.restoCard}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{t.restoDesc}</p>
              <span className="mt-5 inline-block text-sm font-bold text-amber-300 group-hover:underline">
                {t.openResto} →
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
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl">
                {t.pricingTitle}
              </h2>
              <p className="mt-3 text-[15px] text-slate-500">{t.pricingSub}</p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 self-start rounded-2xl border border-emerald-950/10 bg-[#fafcfb] p-1">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-bold transition",
                  billing === "monthly"
                    ? "bg-emerald-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-emerald-950",
                )}
              >
                {t.billingMonthly}
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-bold transition",
                  billing === "yearly"
                    ? "bg-emerald-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-emerald-950",
                )}
              >
                {t.billingYearly}
              </button>
              <span
                className="mx-0.5 hidden h-6 w-px bg-emerald-950/10 sm:block"
                aria-hidden
              />
              <button
                type="button"
                disabled={livePlans.length < 2}
                title={
                  livePlans.length < 2 ? t.compareNeedTwo : t.comparePlans
                }
                aria-pressed={showCompare}
                onClick={() => setShowCompare((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition",
                  showCompare
                    ? "bg-teal-800 text-white shadow-sm"
                    : "text-teal-900 hover:bg-teal-50 hover:text-teal-950",
                  livePlans.length < 2 && "opacity-45 cursor-not-allowed",
                )}
              >
                <Columns2 className="h-4 w-4" strokeWidth={2} />
                {showCompare ? t.hideCompare : t.comparePlans}
              </button>
            </div>
          </div>

          {showCompare && livePlans.length >= 2 ? (
            <div className="mt-8 overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#fafcfb]">
              <div className="flex flex-col gap-3 border-b border-emerald-950/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h3 className="text-base font-extrabold text-emerald-950">
                    {t.compareTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">{t.compareSub}</p>
                </div>
                <div className="inline-flex rounded-xl border border-emerald-950/10 bg-white p-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => setCompareDiffsOnly(true)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                      compareDiffsOnly
                        ? "bg-emerald-900 text-white"
                        : "text-slate-500 hover:text-emerald-950",
                    )}
                  >
                    {t.compareDiffsOnly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareDiffsOnly(false)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                      !compareDiffsOnly
                        ? "bg-emerald-900 text-white"
                        : "text-slate-500 hover:text-emerald-950",
                    )}
                  >
                    {t.compareShowAll}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/70">
                      <th className="sticky start-0 z-10 bg-[#fafcfb] px-4 py-3 text-start text-xs font-bold text-slate-400 sm:px-5">
                        {t.compareFeature}
                      </th>
                      {livePlans.map((p) => (
                        <th
                          key={p.id}
                          className="px-3 py-3 text-center text-sm font-extrabold text-emerald-950"
                        >
                          {isAr ? p.nameAr : p.nameEn}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompareRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={livePlans.length + 1}
                          className="px-5 py-8 text-center text-sm text-slate-400"
                        >
                          —
                        </td>
                      </tr>
                    ) : (
                      visibleCompareRows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-t border-emerald-950/[0.06]",
                            row.differs && "bg-amber-50/40",
                          )}
                        >
                          <td className="sticky start-0 z-10 bg-inherit px-4 py-2.5 text-start text-xs font-semibold text-slate-600 sm:px-5">
                            {row.label}
                          </td>
                          {row.cells.map((cell, idx) => (
                            <td
                              key={`${row.id}-${livePlans[idx]?.id ?? idx}`}
                              className="px-3 py-2.5 text-center"
                            >
                              {cell.kind === "bool" ? (
                                cell.value ? (
                                  <span
                                    className="inline-flex items-center justify-center gap-1 text-teal-800"
                                    title={t.compareIncluded}
                                  >
                                    <Check
                                      className="h-4 w-4"
                                      strokeWidth={2.5}
                                    />
                                    <span className="sr-only">
                                      {t.compareIncluded}
                                    </span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center justify-center text-slate-300"
                                    title={t.compareNotIncluded}
                                  >
                                    <X className="h-4 w-4" strokeWidth={2} />
                                    <span className="sr-only">
                                      {t.compareNotIncluded}
                                    </span>
                                  </span>
                                )
                              ) : (
                                <span className="text-xs font-bold text-emerald-950">
                                  {cell.value}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "mt-4 text-xs font-semibold text-slate-400",
              livePlans.length ? "text-teal-800/80" : "",
            )}
          >
            {t.clickPlanHint}
          </div>

          <div
            className={cn(
              "mt-10 grid gap-4",
              livePlans.length <= 1
                ? "md:grid-cols-1 max-w-md"
                : livePlans.length === 2
                  ? "md:grid-cols-2"
                  : livePlans.length >= 4
                    ? "md:grid-cols-2 xl:grid-cols-4"
                    : "md:grid-cols-3",
            )}
          >
            {livePlans.length
              ? livePlans.map((p, i) => {
                  const featured =
                    p.id === "PROFESSIONAL" ||
                    (livePlans.every((x) => x.id !== "PROFESSIONAL") &&
                      i === Math.min(1, livePlans.length - 1));
                  const price =
                    billing === "monthly" ? p.monthlyPrice : p.yearlyPrice;
                  const unit = billing === "monthly" ? t.perMonth : t.perYear;
                  const save = yearlySavings(p.monthlyPrice, p.yearlyPrice);
                  const disc =
                    p.yearlyDiscountPct ||
                    (p.monthlyPrice > 0
                      ? Math.round(
                          ((p.monthlyPrice * 12 - p.yearlyPrice) /
                            (p.monthlyPrice * 12)) *
                            100,
                        )
                      : 0);
                  const open = openPlanId === p.id;
                  const usersLabel =
                    p.usersLimit == null
                      ? null
                      : p.usersLimit < 0
                        ? t.unlimited
                        : String(p.usersLimit);
                  const invoicesLabel =
                    p.invoicesLimit == null
                      ? null
                      : p.invoicesLimit < 0
                        ? t.unlimited
                        : String(p.invoicesLimit);
                  const noteParts = [
                    usersLabel ? `${t.usersCap}: ${usersLabel}` : null,
                    invoicesLabel ? `${t.invoicesCap}: ${invoicesLabel}` : null,
                  ].filter(Boolean);
                  const note = noteParts.length
                    ? noteParts.join(" · ")
                    : isAr
                      ? "باقة نشطة"
                      : "Active plan";

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-2xl border p-6 sm:p-7 transition flex flex-col",
                        featured
                          ? "border-emerald-900/20 bg-emerald-950 text-white shadow-lg shadow-emerald-950/10"
                          : "border-emerald-950/8 bg-[#fafcfb] hover:border-emerald-900/15",
                        open && "ring-2 ring-emerald-700/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenPlanId((cur) => (cur === p.id ? null : p.id))
                        }
                        className="text-start w-full"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs font-medium",
                              featured ? "text-emerald-200/70" : "text-slate-400",
                            )}
                          >
                            {note}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {billing === "yearly" && disc > 0 ? (
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                  featured
                                    ? "bg-white/15 text-emerald-100"
                                    : "bg-emerald-100 text-emerald-800",
                                )}
                              >
                                {t.saveYearly} {disc}%
                              </span>
                            ) : null}
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                open && "rotate-180",
                                featured ? "text-emerald-200" : "text-slate-400",
                              )}
                            />
                          </div>
                        </div>
                        <h3
                          className={cn(
                            "mt-1.5 text-lg font-bold",
                            featured ? "text-white" : "text-emerald-950",
                          )}
                        >
                          {isAr ? p.nameAr : p.nameEn}
                        </h3>
                        <p
                          className={cn(
                            "mt-5 text-4xl font-extrabold tracking-tight",
                            featured ? "text-white" : "text-emerald-950",
                          )}
                        >
                          {formatPlanPrice(price)}
                          <span
                            className={cn(
                              "ms-2 text-sm font-medium",
                              featured ? "text-emerald-200/60" : "text-slate-400",
                            )}
                          >
                            {unit}
                          </span>
                        </p>
                        {billing === "yearly" && p.yearlyPrice > 0 ? (
                          <p
                            className={cn(
                              "mt-2 text-xs font-semibold",
                              featured ? "text-emerald-200/70" : "text-teal-800",
                            )}
                          >
                            {t.equivMonth} {formatPlanPrice(monthlyFromYearly(p.yearlyPrice))}{" "}
                            {isAr ? "ر.ع / شهر" : "OMR / mo"}
                            {save > 0
                              ? ` · ${t.saveYearly} ${formatPlanPrice(save)} ${isAr ? "ر.ع" : "OMR"}`
                              : ""}
                          </p>
                        ) : null}
                        <p
                          className={cn(
                            "mt-3 text-[11px] font-bold",
                            featured ? "text-emerald-200/80" : "text-teal-800",
                          )}
                        >
                          {open ? t.hideDetails : t.showDetails}
                        </p>
                      </button>

                      {open ? (
                        <div
                          className={cn(
                            "mt-4 pt-4 border-t space-y-3 max-h-[22rem] overflow-y-auto",
                            featured ? "border-white/15" : "border-slate-200",
                          )}
                        >
                          <p
                            className={cn(
                              "text-xs font-extrabold",
                              featured ? "text-emerald-100" : "text-teal-950",
                            )}
                          >
                            {t.includedServices}
                          </p>
                          {p.support ? (
                            <p
                              className={cn(
                                "text-[11px]",
                                featured ? "text-emerald-200/80" : "text-slate-500",
                              )}
                            >
                              {t.supportLabel}: {p.support}
                            </p>
                          ) : null}
                          {(p.highlights || []).length === 0 ? (
                            <p
                              className={cn(
                                "text-xs",
                                featured ? "text-emerald-200/70" : "text-slate-400",
                              )}
                            >
                              —
                            </p>
                          ) : (
                            (p.highlights || []).map((g) => (
                              <div key={g.groupId} className="space-y-1.5">
                                <p
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-wide",
                                    featured ? "text-emerald-300/80" : "text-slate-400",
                                  )}
                                >
                                  {isAr ? g.labelAr : g.labelEn}
                                </p>
                                <ul className="space-y-1">
                                  {g.items.map((item) => (
                                    <li
                                      key={item.code}
                                      className={cn(
                                        "flex items-start gap-1.5 text-[12px] leading-snug",
                                        featured ? "text-emerald-50" : "text-slate-700",
                                      )}
                                    >
                                      <Check
                                        className={cn(
                                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                                          featured ? "text-emerald-300" : "text-teal-700",
                                        )}
                                      />
                                      <span>{isAr ? item.labelAr : item.labelEn}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}

                      <Link
                        href={`/register?plan=${encodeURIComponent(p.id)}`}
                        className={cn(
                          "mt-6 inline-flex w-full justify-center rounded-xl py-2.5 text-sm font-bold transition",
                          featured
                            ? "bg-white text-emerald-950 hover:bg-emerald-50"
                            : "bg-emerald-900 text-white hover:bg-emerald-800",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.register}
                      </Link>
                    </div>
                  );
                })
              : t.plans.map((p) => {
                  const monthly = Number(p.price) || 0;
                  const yearly = Math.round(monthly * 12 * 0.8 * 1000) / 1000;
                  const price = billing === "monthly" ? monthly : yearly;
                  const featured = Boolean((p as { featured?: boolean }).featured);
                  return (
                    <div
                      key={p.name}
                      className={cn(
                        "rounded-2xl border p-7 transition",
                        featured
                          ? "border-emerald-900/20 bg-emerald-950 text-white shadow-lg shadow-emerald-950/10"
                          : "border-emerald-950/8 bg-[#fafcfb]",
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-medium",
                          featured ? "text-emerald-200/70" : "text-slate-400",
                        )}
                      >
                        {p.note}
                      </p>
                      <h3
                        className={cn(
                          "mt-1.5 text-lg font-bold",
                          featured ? "text-white" : "text-emerald-950",
                        )}
                      >
                        {p.name}
                      </h3>
                      <p
                        className={cn(
                          "mt-6 text-4xl font-extrabold",
                          featured ? "text-white" : "text-emerald-950",
                        )}
                      >
                        {formatPlanPrice(price)}
                        <span className="ms-2 text-sm font-medium opacity-60">
                          {billing === "monthly" ? t.perMonth : t.perYear}
                        </span>
                      </p>
                      <Link
                        href="/register"
                        className={cn(
                          "mt-8 inline-flex w-full justify-center rounded-xl py-2.5 text-sm font-bold",
                          featured
                            ? "bg-white text-emerald-950"
                            : "bg-emerald-900 text-white",
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
              <Link href="/privacy" className="text-slate-500 transition hover:text-emerald-900">
                {t.footerPrivacy}
              </Link>
              <Link href="/terms" className="text-slate-500 transition hover:text-emerald-900">
                {t.footerTerms}
              </Link>
              <Link href="/security" className="text-slate-500 transition hover:text-emerald-900">
                {t.footerSecurity}
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
