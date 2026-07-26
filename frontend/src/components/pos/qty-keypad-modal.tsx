"use client";

import { useEffect, useState } from "react";

type QtyKeypadModalProps = {
  open: boolean;
  title?: string;
  initialQty: number;
  maxQty?: number | null;
  stockLabel?: string;
  okLabel?: string;
  clearLabel?: string;
  /** Allow decimal kg entry (sold-by-weight) */
  allowDecimal?: boolean;
  unitLabel?: string;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
};

export function QtyKeypadModal({
  open,
  title,
  initialQty,
  maxQty,
  stockLabel,
  okLabel = "OK",
  clearLabel = "C",
  allowDecimal = false,
  unitLabel,
  onCancel,
  onConfirm,
}: QtyKeypadModalProps) {
  const [digits, setDigits] = useState("");

  useEffect(() => {
    if (!open) return;
    if (allowDecimal) {
      const n = Math.max(0, Number(initialQty) || 0);
      setDigits(n > 0 ? String(n) : "");
      return;
    }
    setDigits(String(Math.max(0, Math.floor(initialQty)) || ""));
  }, [open, initialQty, allowDecimal]);

  if (!open) return null;

  const display = digits === "" ? "0" : digits;
  const parsed = allowDecimal
    ? Math.max(0, parseFloat(display) || 0)
    : Math.max(0, parseInt(display, 10) || 0);
  const capped =
    maxQty != null && Number.isFinite(maxQty)
      ? Math.min(parsed, allowDecimal ? maxQty : Math.floor(maxQty))
      : parsed;

  const pushDigit = (d: string) => {
    setDigits((prev) => {
      if (d === "." && !allowDecimal) return prev;
      if (d === "." && prev.includes(".")) return prev;
      let next = `${prev === "0" && d !== "." ? "" : prev}${d}`;
      if (allowDecimal) {
        const [whole, frac] = next.split(".");
        next = frac != null ? `${whole.slice(0, 6)}.${frac.slice(0, 3)}` : whole.slice(0, 6);
      } else {
        next = next.replace(/\D/g, "").slice(0, 6);
      }
      if (maxQty != null && Number.isFinite(maxQty)) {
        const n = allowDecimal ? parseFloat(next) || 0 : parseInt(next, 10) || 0;
        if (n > maxQty) return String(allowDecimal ? maxQty : Math.floor(maxQty));
      }
      return next;
    });
  };

  const keys = allowDecimal
    ? (["1", "2", "3", "4", "5", "6", "7", "8", "9", clearLabel, "0", ".", "⌫"] as const)
    : (["1", "2", "3", "4", "5", "6", "7", "8", "9", clearLabel, "0", "⌫"] as const);

  const minOk = allowDecimal ? 0.001 : 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-white truncate">{title || "Qty"}</p>
          <button type="button" className="text-slate-400 text-sm px-2 py-1" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center">
          <p className="text-3xl font-extrabold text-white tabular-nums tracking-wide">
            {display}
            {allowDecimal && unitLabel ? (
              <span className="text-base text-slate-400 ms-1">{unitLabel}</span>
            ) : null}
          </p>
          {maxQty != null && Number.isFinite(maxQty) ? (
            <p className="text-[11px] text-slate-500 mt-1">
              {stockLabel || "Stock"}: {allowDecimal ? maxQty : Math.floor(maxQty)}
            </p>
          ) : null}
        </div>
        <div className={`grid gap-2 ${allowDecimal ? "grid-cols-3" : "grid-cols-3"}`}>
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="h-14 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white hover:bg-white/10 active:bg-sky-500/20"
              onClick={() => {
                if (k === clearLabel) {
                  setDigits("");
                  return;
                }
                if (k === "⌫") {
                  setDigits((prev) => prev.slice(0, -1));
                  return;
                }
                pushDigit(k);
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={capped < minOk}
          onClick={() =>
            onConfirm(
              allowDecimal
                ? Number(Math.max(minOk, capped).toFixed(3))
                : Math.max(1, Math.floor(capped)),
            )
          }
          className="w-full h-12 rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40 hover:bg-sky-400"
        >
          {okLabel}
        </button>
      </div>
    </div>
  );
}
