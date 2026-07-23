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

  const toggleLang = () => setLocale(isAr ? "en" : "ar");

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-900 overflow-x-hidden">
      {/* soft atmosphere — not flat white */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(15,118,110,0.18), transparent 55%), radial-gradient(900px 500px at 0% 20%, rgba(8,47,73,0.08), transparent 50%), linear-gradient(180deg, #eef7f5 0%, #f7faf9 40%, #f1f5f9 100%)",
        }}
      />

      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#f7faf9]/80 border-b border-teal-900/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/brand/hisaby-mark.png"
              alt="Hisaby"
              width={36}
              height={36}
              className="rounded-lg shrink-0"
              priority
            />
            <span className="font-[family-name:var(--font-cairo)] text-xl font-extrabold tracking-tight text-teal-900">
              {t.brand}
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 font-medium">
              {t.brandEn}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-teal-800 transition-colors">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="hover:text-teal-800 transition-colors">
              {t.navPricing}
            </a>
            <a href="#company" className="hover:text-teal-800 transition-colors">
              {t.navCompany}
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-white/70"
            >
              {t.langSwitch}
            </button>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold px-3 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                {t.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline text-sm font-semibold px-3 py-2 rounded-lg text-teal-900 hover:bg-white/70"
                >
                  {t.login}
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold px-3 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800"
                >
                  {t.register}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO — one composition */}
      <section className="relative min-h-[min(92vh,860px)] flex items-center">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-90"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f766e' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 w-full py-16 md:py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div
            className={cn(
              "transition-all duration-700 ease-out",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <p className="text-sm font-semibold text-teal-800/80 mb-3">{t.trustLine}</p>
            <h1 className="font-[family-name:var(--font-cairo)] text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.15] text-slate-900 tracking-tight">
              <span className="block text-teal-800 mb-2 text-[1.15em]">{t.brand}</span>
              {t.headline}
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-xl leading-relaxed">{t.subhead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-teal-700 text-white font-bold text-base hover:bg-teal-800 transition-colors"
                >
                  {t.dashboard}
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-teal-700 text-white font-bold text-base hover:bg-teal-800 transition-colors"
                  >
                    {t.register}
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-teal-800/20 bg-white/60 text-teal-950 font-bold text-base hover:bg-white transition-colors"
                  >
                    {t.login}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div
            className={cn(
              "relative flex justify-center md:justify-end transition-all duration-1000 delay-150 ease-out",
              visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}
          >
            <div className="relative w-full max-w-md aspect-square">
              <div className="absolute inset-8 rounded-full bg-teal-600/10 blur-2xl animate-[pulse_6s_ease-in-out_infinite]" />
              <div className="relative h-full w-full rounded-[2rem] bg-gradient-to-br from-teal-800 via-teal-700 to-slate-900 p-10 flex flex-col items-center justify-center text-center shadow-none">
                <Image
                  src="/brand/hisaby-mark.png"
                  alt=""
                  width={140}
                  height={140}
                  className="rounded-2xl mb-6 animate-[floaty_5s_ease-in-out_infinite]"
                  priority
                />
                <p className="text-white text-3xl font-extrabold tracking-tight">{t.brand}</p>
                <p className="text-teal-100/80 mt-2 text-sm font-medium">{t.brandEn}</p>
                <p className="text-teal-100/60 mt-6 text-xs max-w-[14rem] leading-relaxed">
                  {t.footerTag}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-24 border-t border-teal-900/5">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t.featuresTitle}</h2>
          <p className="mt-3 text-slate-600 max-w-2xl">{t.featuresSub}</p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
            {t.features.map((f, i) => {
              const Icon = featureIcons[i] || FileText;
              return (
                <div key={f.title} className="group">
                  <Icon className="w-6 h-6 text-teal-700 mb-3 transition-transform duration-300 group-hover:-translate-y-0.5" />
                  <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">{t.pricingTitle}</h2>
          <p className="mt-3 text-slate-300 max-w-2xl">{t.pricingSub}</p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {t.plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  "rounded-2xl p-6 border",
                  Boolean((p as { featured?: boolean }).featured)
                    ? "border-teal-400/50 bg-teal-500/10"
                    : "border-white/10 bg-white/5"
                )}
              >
                <p className="text-sm font-semibold text-teal-200">{p.note}</p>
                <h3 className="mt-2 text-xl font-bold">{p.name}</h3>
                <p className="mt-4 text-4xl font-extrabold">
                  {p.price}
                  <span className="text-base font-medium text-slate-300 ms-2">{p.unit}</span>
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-white text-slate-900 font-bold py-2.5 text-sm hover:bg-teal-50"
                >
                  {t.register}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="company" className="py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-[auto_1fr] gap-10 items-center">
          <div className="rounded-2xl bg-black p-6 w-fit mx-auto md:mx-0">
            <Image
              src="/brand/bin-hamoud.png"
              alt="Bin Hamood Development"
              width={220}
              height={100}
              className="h-auto w-[200px] object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-800">{t.companyTitle}</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">{t.companyName}</h2>
            <p className="mt-1 text-slate-500 font-medium">{t.companyNameEn}</p>
            <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl">{t.companyBody}</p>
            <div className="mt-6 flex items-center gap-4">
              <Image
                src="/brand/bin-hamoud-mark.png"
                alt=""
                width={48}
                height={48}
                className="rounded-md bg-black p-1.5"
              />
              <Link
                href="/register"
                className="text-teal-800 font-bold text-sm hover:underline underline-offset-4"
              >
                {t.companyCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
          <div className="flex items-center gap-3">
            <Image src="/brand/hisaby-mark.png" alt="" width={32} height={32} className="rounded-md" />
            <div>
              <p className="font-bold text-slate-900">{t.brand}</p>
              <p className="text-xs text-slate-500">{t.footerTag}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-600">
            <Link href="/login" className="hover:text-teal-800">
              {t.login}
            </Link>
            <Link href="/register" className="hover:text-teal-800">
              {t.register}
            </Link>
            <a href="#company" className="hover:text-teal-800">
              {t.navCompany}
            </a>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {t.companyName}. {t.footerRights}.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes floaty {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
