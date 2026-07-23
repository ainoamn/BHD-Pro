"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { FileText, Package, PieChart, Shield, Users, Wallet } from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { landingCopy } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

const featureIcons = [FileText, Package, PieChart, Users, Wallet, Shield];

/** Omani-inspired palette: flag green, ribbon red, limestone & frankincense dusk */
const oman = {
  green: "#0B5E3B",
  greenDeep: "#063D28",
  red: "#B91C2C",
  stone: "#C4B59A",
  sand: "#E6DCC8",
  dusk: "#1A2E24",
  ink: "#0F1F18",
} as const;

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
      className="min-h-screen text-[var(--oman-ink)]"
      dir={isAr ? "rtl" : "ltr"}
      style={
        {
          "--oman-green": oman.green,
          "--oman-green-deep": oman.greenDeep,
          "--oman-red": oman.red,
          "--oman-stone": oman.stone,
          "--oman-sand": oman.sand,
          "--oman-dusk": oman.dusk,
          "--oman-ink": oman.ink,
        } as CSSProperties
      }
    >
      {/* Flag ribbon */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1.5"
        style={{
          background: `linear-gradient(90deg, ${oman.red} 0%, ${oman.red} 26%, #fff 26%, #fff 52%, ${oman.green} 52%)`,
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[var(--oman-ink)]/8 bg-[var(--oman-sand)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/hisaby-mark.png" alt="Hisaby" width={34} height={34} className="rounded-md" priority />
            <span className="font-display text-lg font-bold tracking-tight text-[var(--oman-ink)]">
              {t.brand}
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--oman-ink)]/65 md:flex">
            <a href="#features" className="transition hover:text-[var(--oman-green)]">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="transition hover:text-[var(--oman-green)]">
              {t.navPricing}
            </a>
            <a href="#company" className="transition hover:text-[var(--oman-green)]">
              {t.navCompany}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(isAr ? "en" : "ar")}
              className="rounded-md px-2 py-1.5 text-xs font-bold text-[var(--oman-ink)]/70 hover:bg-white/60"
            >
              {t.langSwitch}
            </button>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-bold text-white"
                style={{ background: oman.green }}
              >
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-lg px-3 py-2 text-sm font-bold text-[var(--oman-ink)] sm:inline hover:bg-white/60"
                >
                  {t.login}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg px-3 py-2 text-sm font-bold text-white"
                  style={{ background: oman.green }}
                >
                  {t.register}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Full-bleed hero — one composition */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(135deg, ${oman.sand} 0%, #d9cbb3 28%, #a8c4b0 55%, ${oman.greenDeep} 100%)
            `,
          }}
        />
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 opacity-[0.12] transition-opacity duration-[1.4s]",
            visible ? "opacity-[0.14]" : "opacity-0"
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23063D28' stroke-width='1.2'%3E%3Cpath d='M36 4 L68 36 L36 68 L4 36 Z'/%3E%3Cpath d='M36 16 L56 36 L36 56 L16 36 Z'/%3E%3C/g%3E%3C/svg%3E")`,
            animation: visible ? "oman-drift 28s linear infinite" : undefined,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at ${isAr ? "15%" : "85%"} 40%, ${oman.red}22 0%, transparent 55%),
              linear-gradient(to top, ${oman.ink}cc 0%, transparent 48%)`,
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-end px-4 pb-16 pt-20 md:justify-center md:pb-24 md:pt-12">
          <div
            className={cn(
              "max-w-2xl transition-all duration-700 ease-out",
              visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            )}
          >
            <p
              className={cn(
                "mb-4 font-display text-5xl font-bold tracking-tight text-white drop-shadow-sm sm:text-6xl md:text-7xl",
                "transition-all delay-100 duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              {t.brand}
            </p>
            <h1
              className={cn(
                "max-w-xl text-xl font-bold leading-snug text-white/95 sm:text-2xl md:text-[1.65rem]",
                "transition-all delay-200 duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              {t.headline}
            </h1>
            <p
              className={cn(
                "mt-4 max-w-lg text-base leading-relaxed text-white/80",
                "transition-all delay-300 duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              {t.subhead}
            </p>
            <div
              className={cn(
                "mt-8 flex flex-wrap gap-3",
                "transition-all delay-[400ms] duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
            >
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-white px-6 py-3 text-base font-bold text-[var(--oman-ink)] shadow-sm transition hover:bg-[var(--oman-sand)]"
                >
                  {t.dashboard}
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="rounded-xl bg-white px-6 py-3 text-base font-bold text-[var(--oman-ink)] shadow-sm transition hover:bg-[var(--oman-sand)]"
                  >
                    {t.register}
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    {t.login}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Dominant brand mark as visual plane — edge-anchored, not a floating card */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-0 opacity-[0.18] transition-all duration-[1.2s] ease-out md:opacity-[0.22]",
              isAr ? "left-0 -translate-x-8" : "right-0 translate-x-8",
              visible ? "translate-y-0 scale-100" : "translate-y-8 scale-95"
            )}
          >
            <Image
              src="/brand/hisaby-mark.png"
              alt=""
              width={420}
              height={420}
              className="h-auto w-[min(70vw,420px)] brightness-0 invert"
              priority
            />
          </div>
        </div>
      </section>

      <section
        className="relative overflow-hidden border-y border-[var(--oman-ink)]/8 py-16"
        style={{ background: `linear-gradient(90deg, ${oman.sand} 0%, #f3eee4 50%, ${oman.sand} 100%)` }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold tracking-wide text-[var(--oman-green)]">{t.craftTitle}</p>
          <p className="mt-2 max-w-2xl text-lg leading-relaxed text-[var(--oman-ink)]/75">{t.craftBody}</p>
          <p className="mt-4 text-sm font-medium text-[var(--oman-ink)]/55">{t.regionLine}</p>
        </div>
        <div
          aria-hidden
          className="absolute inset-y-0 w-1"
          style={{
            [isAr ? "left" : "right"]: 0,
            background: oman.red,
          }}
        />
      </section>

      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold text-[var(--oman-ink)]">{t.featuresTitle}</h2>
          <p className="mt-2 max-w-2xl text-[var(--oman-ink)]/65">{t.featuresSub}</p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] || FileText;
              return (
                <div key={f.title}>
                  <Icon className="mb-3 h-6 w-6" style={{ color: oman.green }} />
                  <h3 className="text-lg font-bold text-[var(--oman-ink)]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--oman-ink)]/65">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 text-white" style={{ background: oman.dusk }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold">{t.pricingTitle}</h2>
          <p className="mt-2 text-white/70">{t.pricingSub}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {t.plans.map((p) => {
              const featured = Boolean((p as { featured?: boolean }).featured);
              return (
                <div
                  key={p.name}
                  className={cn(
                    "rounded-2xl border p-6",
                    featured ? "border-[var(--oman-red)]/40 bg-white/10" : "border-white/10 bg-white/5"
                  )}
                >
                  <p className="text-sm text-white/60">{p.note}</p>
                  <h3 className="mt-1 text-xl font-bold">{p.name}</h3>
                  <p className="mt-4 text-4xl font-extrabold">
                    {p.price}
                    <span className="ms-2 text-base font-medium text-white/55">{p.unit}</span>
                  </p>
                  <Link
                    href="/register"
                    className="mt-6 inline-flex w-full justify-center rounded-xl bg-white py-2.5 text-sm font-bold text-[var(--oman-ink)] transition hover:bg-[var(--oman-sand)]"
                  >
                    {t.register}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="company" className="py-20" style={{ background: oman.sand }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[auto_1fr]">
          <div className="mx-auto w-fit rounded-2xl bg-[var(--oman-ink)] p-6 md:mx-0">
            <Image
              src="/brand/bin-hamoud.png"
              alt="Bin Hamood Development"
              width={220}
              height={100}
              className="h-auto w-[200px]"
            />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: oman.green }}>
              {t.companyTitle}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-[var(--oman-ink)]">{t.companyName}</h2>
            <p className="mt-1 font-medium text-[var(--oman-ink)]/50">{t.companyNameEn}</p>
            <p className="mt-4 max-w-2xl leading-relaxed text-[var(--oman-ink)]/70">{t.companyBody}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--oman-ink)]/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Image src="/brand/hisaby-mark.png" alt="" width={28} height={28} className="rounded" />
              <div>
                <p className="font-bold text-[var(--oman-ink)]">{t.brand}</p>
                <p className="text-xs text-[var(--oman-ink)]/50">{t.footerTag}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/login" className="text-[var(--oman-ink)]/60 hover:text-[var(--oman-green)]">
                {t.login}
              </Link>
              <Link href="/register" className="text-[var(--oman-ink)]/60 hover:text-[var(--oman-green)]">
                {t.register}
              </Link>
              <Link
                href="/login?next=/admin&switch=1"
                className="rounded-lg border border-[var(--oman-ink)]/12 bg-[var(--oman-sand)]/60 px-3 py-1.5 text-[var(--oman-ink)] hover:bg-[var(--oman-sand)]"
              >
                {t.adminLogin}
              </Link>
            </div>
          </div>
          <p className="text-xs text-[var(--oman-ink)]/45">
            © {new Date().getFullYear()} {t.companyName}. {t.footerRights}.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes oman-drift {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 72px 72px;
          }
        }
      `}</style>
    </div>
  );
}
