"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_ACCESS_GROUPS,
  defaultGrantsForModule,
  type PlanModuleGrant,
  type PlanAccessGroup,
  type PlanAccessModule,
} from "@/lib/plan-access-catalog";

type Props = {
  groups?: PlanAccessGroup[];
  value: Record<string, PlanModuleGrant>;
  onChange: (next: Record<string, PlanModuleGrant>) => void;
  showLimits?: boolean;
  en?: boolean;
  disabled?: boolean;
  /** Denser tree for side-by-side plan columns */
  compact?: boolean;
};

export function PermissionTree({
  groups = PLAN_ACCESS_GROUPS,
  value,
  onChange,
  showLimits = true,
  en = false,
  disabled = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, true])),
  );
  const [modOpen, setModOpen] = useState<Record<string, boolean>>({});

  const setGrant = (code: string, patch: Partial<PlanModuleGrant>) => {
    if (disabled) return;
    const cur = value[code] || { enabled: false, transactionLimit: null };
    onChange({ ...value, [code]: { ...cur, ...patch } });
  };

  const toggleModule = (m: PlanAccessModule, enabled: boolean) => {
    setGrant(m.code, {
      enabled,
      grants: defaultGrantsForModule(m, enabled),
    });
  };

  const toggleChild = (m: PlanAccessModule, childCode: string, on: boolean) => {
    const cur = value[m.code] || { enabled: true, transactionLimit: null };
    const base =
      cur.grants || defaultGrantsForModule(m, !!cur.enabled) || {};
    setGrant(m.code, {
      enabled: true,
      grants: { ...base, [childCode]: on },
    });
  };

  const toggleGroup = (g: PlanAccessGroup, enabled: boolean) => {
    if (disabled) return;
    const next = { ...value };
    for (const m of g.modules) {
      next[m.code] = {
        enabled,
        transactionLimit: next[m.code]?.transactionLimit ?? null,
        grants: defaultGrantsForModule(m, enabled),
      };
    }
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {groups.map((g) => {
        const expanded = open[g.id] !== false;
        const allOn = g.modules.every((m) => value[m.code]?.enabled);
        const someOn = g.modules.some((m) => value[m.code]?.enabled);
        return (
          <div
            key={g.id}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <div
              className={cn(
                "flex items-center gap-2 bg-slate-50 border-b border-slate-100",
                compact ? "px-2 py-1.5" : "px-3 py-2.5",
              )}
            >
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
              <label className="flex items-center gap-2 flex-1 cursor-pointer select-none min-w-0">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOn && someOn;
                  }}
                  disabled={disabled}
                  onChange={(e) => toggleGroup(g, e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600 shrink-0"
                />
                <span
                  className={cn(
                    "font-extrabold text-teal-950 truncate",
                    compact ? "text-xs" : "text-sm",
                  )}
                >
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
                  const hasKids = !!m.children?.length;
                  const kidsOpen = compact || modOpen[m.code] === true;
                  return (
                    <li key={m.code} className={grant.enabled ? "bg-white" : "bg-slate-50/50"}>
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-1.5 text-sm",
                          compact ? "px-2 py-1.5" : "px-3 py-2",
                        )}
                      >
                        {hasKids ? (
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-slate-100"
                            onClick={() =>
                              setModOpen((o) => ({ ...o, [m.code]: !kidsOpen }))
                            }
                          >
                            {kidsOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        <label
                          className={cn(
                            "flex items-center gap-2 flex-1 cursor-pointer min-w-0",
                            !compact && "min-w-[12rem]",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={!!grant.enabled}
                            disabled={disabled}
                            onChange={(e) => toggleModule(m, e.target.checked)}
                            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600 shrink-0"
                          />
                          <span
                            className={cn(
                              "font-semibold leading-snug",
                              compact ? "text-xs" : "text-sm",
                              grant.enabled ? "text-slate-800" : "text-slate-400",
                            )}
                          >
                            {en ? m.labelEn : m.labelAr}
                          </span>
                          {!grant.enabled ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
                              {en ? "Upgrade" : "ترقية"}
                            </span>
                          ) : null}
                        </label>
                        {showLimits && m.supportsLimit ? (
                          <label className="flex items-center gap-1 text-[10px] text-slate-500 w-full ps-6">
                            <span>{en ? "Tx" : "حد"}</span>
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
                              className="w-16 rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
                            />
                          </label>
                        ) : null}
                      </div>
                      {hasKids && kidsOpen && grant.enabled ? (
                        <ul
                          className={cn(
                            "mb-2 rounded-lg border border-slate-100 bg-slate-50/80 divide-y divide-slate-100",
                            compact ? "ms-5 me-2" : "ms-8 me-3",
                          )}
                        >
                          {m.children!.map((c) => {
                            const on =
                              grant.grants?.[c.code] !== false &&
                              (grant.grants?.[c.code] === true ||
                                grant.grants?.[c.code] === undefined);
                            return (
                              <li key={c.code}>
                                <label className="flex items-center gap-2 px-2.5 py-1 text-[11px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!on}
                                    disabled={disabled}
                                    onChange={(e) =>
                                      toggleChild(m, c.code, e.target.checked)
                                    }
                                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                                  />
                                  <span
                                    className={cn(
                                      "font-medium",
                                      on ? "text-slate-700" : "text-slate-400",
                                    )}
                                  >
                                    {en ? c.labelEn : c.labelAr}
                                  </span>
                                  {!on ? (
                                    <span className="text-[9px] font-bold text-amber-700">
                                      {en ? "Upgrade" : "ترقية"}
                                    </span>
                                  ) : null}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
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
