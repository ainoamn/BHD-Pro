"use client";

import { GlassCard } from "@/components/ui/page-shell";
import { formatMoney } from "@/lib/utils";

interface StatCard {
  label: string;
  value: number | string;
  isMoney?: boolean;
  isCount?: boolean;
  currency?: string;
  color?: string;
}

export function ReportStatCards({
  stats,
  currency = "OMR",
}: {
  stats: StatCard[];
  currency?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <GlassCard key={s.label} className="p-4">
          <p className="text-xs text-slate-400">{s.label}</p>
          <p className={`text-xl font-bold mt-1 ${s.color || "text-white"}`}>
            {s.isMoney ? formatMoney(Number(s.value), currency) : s.value}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}
