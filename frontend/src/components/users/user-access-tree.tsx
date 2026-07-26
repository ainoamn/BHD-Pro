"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODULE_LABELS,
  USER_ACCESS_GROUPS,
  type AccessLevel,
  type ModuleKey,
  type ModulePermissions,
} from "@/lib/module-permissions";

const LEVELS: AccessLevel[] = ["hidden", "view", "edit"];

type Props = {
  value: ModulePermissions;
  onChange: (next: ModulePermissions) => void;
  en?: boolean;
  disabled?: boolean;
};

export function UserAccessTree({
  value,
  onChange,
  en = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(USER_ACCESS_GROUPS.map((g) => [g.id, true])),
  );

  const levelLabel: Record<AccessLevel, string> = {
    hidden: en ? "Hidden" : "مخفي",
    view: en ? "View" : "عرض",
    edit: en ? "Edit" : "تعديل",
  };

  const setLevel = (key: ModuleKey, level: AccessLevel) => {
    if (disabled) return;
    onChange({ ...value, [key]: level });
  };

  const toggleGroup = (modules: ModuleKey[], enable: boolean) => {
    if (disabled) return;
    const next = { ...value };
    for (const m of modules) {
      next[m] = enable ? "edit" : "hidden";
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {en
          ? "Defaults follow the selected role. Override any row: Hidden / View / Edit."
          : "القيم الافتراضية تتبع الدور المختار. عدّل أي صف: مخفي / عرض / تعديل."}
      </p>
      {USER_ACCESS_GROUPS.map((g) => {
        const expanded = open[g.id] !== false;
        const allOn = g.modules.every((m) => value[m] !== "hidden");
        const someOn = g.modules.some((m) => value[m] !== "hidden");
        return (
          <div
            key={g.id}
            className="rounded-xl border border-slate-700 bg-slate-950/40 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}
                className="p-1 rounded-md hover:bg-slate-700"
                aria-label="toggle"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-300" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300" />
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
                  onChange={(e) => toggleGroup(g.modules, e.target.checked)}
                  className="rounded border-slate-600 text-teal-500 focus:ring-teal-600"
                />
                <span className="font-extrabold text-sm text-teal-200 truncate">
                  {en ? g.labelEn : g.labelAr}
                </span>
              </label>
            </div>
            {expanded ? (
              <ul className="divide-y divide-slate-800">
                {g.modules.map((key) => {
                  const level = value[key] || "hidden";
                  return (
                    <li
                      key={key}
                      className={cn(
                        "px-3 py-2.5 flex flex-wrap items-center justify-between gap-2",
                        level === "hidden" ? "opacity-70" : "",
                      )}
                    >
                      <span className="text-sm font-semibold text-slate-200">
                        {MODULE_LABELS[key][en ? "en" : "ar"]}
                      </span>
                      <div className="flex gap-1">
                        {LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            disabled={disabled}
                            onClick={() => setLevel(key, lvl)}
                            className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full border disabled:opacity-40",
                              level === lvl
                                ? lvl === "edit"
                                  ? "bg-emerald-600 text-white border-emerald-500"
                                  : lvl === "view"
                                    ? "bg-sky-600 text-white border-sky-500"
                                    : "bg-slate-600 text-white border-slate-500"
                                : "bg-transparent text-slate-400 border-slate-700 hover:border-slate-500",
                            )}
                          >
                            {levelLabel[lvl]}
                          </button>
                        ))}
                      </div>
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
