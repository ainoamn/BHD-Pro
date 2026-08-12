"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Label shown for the “add new” row, e.g. "Add «X»" */
  addLabel: (query: string) => string;
  emptyHint?: string;
  className?: string;
  disabled?: boolean;
};

export function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
  addLabel,
  emptyHint,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of options) {
      const v = (raw || "").trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((o) => o.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return uniqueOptions.some((o) => o.toLowerCase() === q);
  }, [uniqueOptions, query]);

  const canAdd = query.trim().length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v.trim());
    setQuery("");
    setOpen(false);
  };

  const display = open ? query : value;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          value={display}
          disabled={disabled}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true);
            setQuery(value || "");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canAdd) pick(query);
              else if (filtered[0]) pick(filtered[0]);
            }
          }}
          className="w-full h-10 pe-9 ps-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Toggle"
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            setQuery(value || "");
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 end-0 w-9 inline-flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-xl"
        >
          {filtered.map((opt) => {
            const selected = opt.toLowerCase() === value.trim().toLowerCase();
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                    selected && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt}</span>
                </button>
              </li>
            );
          })}

          {canAdd ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(query)}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 border-t border-slate-200 dark:border-slate-800"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{addLabel(query.trim())}</span>
              </button>
            </li>
          ) : null}

          {!filtered.length && !canAdd ? (
            <li className="px-3 py-2 text-sm text-slate-500">{emptyHint || "—"}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
