"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_ACCESS_GROUPS,
  type PlanModuleGrant,
  type PlanAccessGroup,
} from "@/lib/plan-access-catalog";

type Props = {
  groups?: PlanAccessGroup[];
  value: Record<string, PlanModuleGrant>;
  onChange: (next: Record<string, PlanModuleGrant>) => void;
  /** Show transaction limit inputs */
  showLimits?: boolean;
  en?: boolean;
  disabled?: boolean;
};

export function PermissionTree({
  groups = PLAN_ACCESS_GROUPS,
  value,
  onChange,
  showLimits = true,
  en = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, true])),
  );

  const setGrant = (code: string, patch: Partial<PlanModuleGrant>) => {
    if (disabled) return;
    const cur = value[code] || { enabled: false, transactionLimit: null };
    onChange({
      ...value,
      [code]: { ...cur, ...patch },
    });
  };

  const toggleGroup = (g: PlanAccessGroup, enabled: boolean) => {
    if (disabled) return;
    const next = { ...value };
    for (const m of g.modules) {
      next[m.code] = {
        enabled,
        transactionLimit: next[m.code]?.transactionLimit ?? null,
      };
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const expanded = open[g.id] !== false;
        const allOn = g.modules.every((m) => value[m.code]?.enabled);
        const someOn = g.modules.some((m) => value[m.code]?.enabled);
        return (
          <div
            key={g.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}
                className="p-1 rounded-md hover:bg-slate-200/60"
                aria-label="toggle"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                )}
              </button>
              <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOn && someOn;
                  }}
                  disabled={disabled}
                  onChange={(e) => toggleGroup(g, e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span className="font-extrabold text-sm text-teal-950">
                  {en ? g.labelEn : g.labelAr}
                </span>
              </label>
            </div>
            {expanded ? (
              <ul className="divide-y divide-slate-100">
                {g.modules.map((m) => {
                  const grant = value[m.code] || {
                    enabled: false,
                    transactionLimit: null,
                  };
                  return (
                    <li
                      key={m.code}
                      className={cn(
                        "flex flex-wrap items-center gap-2 px-3 py-2 text-sm",
                        grant.enabled ? "bg-white" : "bg-slate-50/50",
                      )}
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-[12rem] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!grant.enabled}
                          disabled={disabled}
                          onChange={(e) =>
                            setGrant(m.code, { enabled: e.target.checked })
                          }
                          className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                        <span
                          className={cn(
                            "font-semibold",
                            grant.enabled ? "text-slate-800" : "text-slate-400",
                          )}
                        >
                          {en ? m.labelEn : m.labelAr}
                        </span>
                        {!grant.enabled ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {en ? "Upgrade" : "ترقية"}
                          </span>
                        ) : null}
                      </label>
                      {showLimits && m.supportsLimit ? (
                        <label className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>{en ? "Tx limit" : "حد المعاملات"}</span>
                          <input
                            type="number"
                            disabled={disabled || !grant.enabled}
                            placeholder="∞"
                            value={
                              grant.transactionLimit == null ||
                              grant.transactionLimit < 0
                                ? ""
                                : grant.transactionLimit
                            }
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setGrant(m.code, {
                                transactionLimit:
                                  v === "" ? null : Number(v) || 0,
                              });
                            }}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-40"
                          />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
