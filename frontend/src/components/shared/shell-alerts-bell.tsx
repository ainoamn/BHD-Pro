"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Link2Off,
  AlertTriangle,
  Package,
  Users,
  Wallet,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ShellAlertItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  tone?: "warning" | "error" | "info";
};

type Props = {
  /** Show amber/red badge when there are alerts */
  hasAlert: boolean;
  title: string;
  emptyLabel: string;
  items: ShellAlertItem[];
  /** Dark shell styling (POS / resto) */
  tone?: "pos" | "resto";
  className?: string;
};

export function ShellAlertsBell({
  hasAlert,
  title,
  emptyLabel,
  items,
  tone = "pos",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isResto = tone === "resto";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const iconFor = (id: string) => {
    if (id.includes("inventory")) return Package;
    if (id.includes("contact")) return Users;
    if (id.includes("book")) return Wallet;
    if (id.includes("setting") || id.includes("link")) return Settings2;
    if (id.includes("unlink") || id.includes("error")) return Link2Off;
    return AlertTriangle;
  };

  return (
    <div className={cn("relative shrink-0", className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={title}
        aria-expanded={open}
        className={cn(
          "relative w-10 h-10 flex items-center justify-center rounded-xl border transition-colors",
          isResto
            ? "bg-amber-500/10 border-amber-500/25 text-amber-100 hover:bg-amber-500/20"
            : "bg-sky-500/10 border-sky-500/25 text-sky-100 hover:bg-sky-500/20",
        )}
      >
        <Bell className="w-4 h-4" />
        {hasAlert ? (
          <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0b1220]" />
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-full mt-2 end-0 z-50 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border shadow-2xl",
            isResto
              ? "bg-[#1c1814] border-amber-500/25"
              : "bg-[#121a28] border-white/10",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {hasAlert ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                {items.length}
              </span>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{emptyLabel}</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((alert) => {
                  const Icon = iconFor(alert.id);
                  return (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            alert.tone === "error" && "bg-rose-500/15 text-rose-300",
                            alert.tone === "info" && "bg-sky-500/15 text-sky-300",
                            (!alert.tone || alert.tone === "warning") &&
                              "bg-amber-500/15 text-amber-300",
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{alert.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {alert.message}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
