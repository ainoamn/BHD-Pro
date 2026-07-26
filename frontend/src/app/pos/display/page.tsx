"use client";

import { useEffect, useState } from "react";
import { useLocaleStore } from "@/store/locale";
import { formatMoney } from "@/lib/utils";
import { posCopy } from "@/lib/pos-copy";
import {
  POS_CUSTOMER_DISPLAY_CHANNEL,
  readPosCustomerDisplay,
  type PosCustomerDisplayPayload,
} from "@/lib/pos-customer-display";

export default function PosCustomerDisplayPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [payload, setPayload] = useState<PosCustomerDisplayPayload | null>(null);

  useEffect(() => {
    setPayload(readPosCustomerDisplay());

    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(POS_CUSTOMER_DISPLAY_CHANNEL);
      ch.onmessage = (ev) => {
        const data = ev.data as PosCustomerDisplayPayload;
        if (data?.v === 1) setPayload(data);
      };
    } catch {
      /* ignore */
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== POS_CUSTOMER_DISPLAY_CHANNEL || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue) as PosCustomerDisplayPayload;
        if (data?.v === 1) setPayload(data);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      ch?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const dir = (payload?.locale || locale) === "en" ? "ltr" : "rtl";
  const currency = payload?.currency || "OMR";
  const phase = payload?.phase || "idle";

  return (
    <div
      className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col"
      dir={dir}
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, rgba(14,165,233,0.12), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(16,185,129,0.08), transparent 45%), #070b14",
      }}
    >
      <header className="px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/hisaby-mark.png"
            alt=""
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
              {payload?.companyName || t.brand}
            </p>
            <p className="text-sm text-slate-500">{t.customerDisplayTagline}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 sm:px-10 pb-10 max-w-5xl w-full mx-auto">
        {phase === "idle" || !payload ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-3xl sm:text-5xl font-extrabold text-white/90">
              {t.customerDisplayWelcome}
            </p>
            <p className="text-slate-500 text-lg">{t.customerDisplayIdleHint}</p>
          </div>
        ) : null}

        {phase === "thankyou" && payload ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <p className="text-4xl sm:text-6xl font-extrabold text-emerald-300">
              {t.customerDisplayThanks}
            </p>
            {payload.thankYouNumber ? (
              <p className="text-xl text-slate-400">
                {t.findReceipt}: {payload.thankYouNumber}
              </p>
            ) : null}
            <p className="text-5xl sm:text-7xl font-black tabular-nums text-white">
              {formatMoney(payload.total, currency)}
            </p>
          </div>
        ) : null}

        {(phase === "cart" || phase === "pay") && payload ? (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto py-4">
              {payload.lines.map((line, i) => (
                <li
                  key={`${line.name}-${i}`}
                  className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-3"
                >
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-semibold text-white truncate">
                      {line.name}
                    </p>
                    <p className="text-slate-500 text-sm tabular-nums">× {line.qty}</p>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums text-sky-200 shrink-0">
                    {formatMoney(line.total, currency)}
                  </p>
                </li>
              ))}
              {!payload.lines.length ? (
                <li className="text-center text-slate-500 py-16 text-lg">
                  {t.customerDisplayEmptyCart}
                </li>
              ) : null}
            </ul>

            <div className="mt-auto rounded-3xl border border-white/10 bg-black/35 px-6 py-5 space-y-2">
              <div className="flex justify-between text-slate-400 text-lg">
                <span>{t.subtotal}</span>
                <span className="tabular-nums">{formatMoney(payload.subtotal, currency)}</span>
              </div>
              {payload.tax > 0.0005 ? (
                <div className="flex justify-between text-slate-400 text-lg">
                  <span>{t.tax}</span>
                  <span className="tabular-nums">{formatMoney(payload.tax, currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                <span className="text-2xl font-bold text-white">{t.total}</span>
                <span className="text-4xl sm:text-5xl font-black tabular-nums text-emerald-300">
                  {formatMoney(payload.total, currency)}
                </span>
              </div>
              {phase === "pay" &&
              payload.cashTendered != null &&
              Number.isFinite(payload.cashTendered) ? (
                <div className="flex justify-between text-sky-200 text-lg pt-1">
                  <span>{t.amountTendered}</span>
                  <span className="tabular-nums font-semibold">
                    {formatMoney(payload.cashTendered, currency)}
                  </span>
                </div>
              ) : null}
              {phase === "pay" &&
              payload.change != null &&
              payload.change > 0.0005 ? (
                <div className="flex justify-between text-amber-200 text-xl font-bold pt-1">
                  <span>{t.changeDue}</span>
                  <span className="tabular-nums">{formatMoney(payload.change, currency)}</span>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
