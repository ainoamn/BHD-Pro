"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import api from "@/lib/api";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type ContactSearchItem = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  currentBalance?: number | string | null;
};

type Props = {
  type?: "CUSTOMER" | "SUPPLIER" | "BOTH";
  value: string;
  onChange: (id: string, contact?: ContactSearchItem | null) => void;
  /** Empty selection label (e.g. Walk-in) */
  emptyLabel: string;
  placeholder: string;
  /** Optional: seed list when query empty */
  initialItems?: ContactSearchItem[];
  /** Show store-credit balance suffix */
  showBalance?: boolean;
  balanceLabel?: string;
  defaultDialCode?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Dark POS theme vs accounting slate */
  variant?: "pos" | "accounting";
};

function matchesLocal(c: ContactSearchItem, q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, "");
  const name = (c.name || "").toLowerCase();
  const phone = (c.phone || "").toLowerCase();
  const phoneDigits = (c.phone || "").replace(/\D/g, "");
  if (name.includes(term)) return true;
  if (phone.includes(term)) return true;
  if (digits.length >= 3 && phoneDigits.includes(digits)) return true;
  return false;
}

export function ContactSearchSelect({
  type = "CUSTOMER",
  value,
  onChange,
  emptyLabel,
  placeholder,
  initialItems = [],
  showBalance = false,
  balanceLabel = "",
  defaultDialCode = "968",
  className,
  inputClassName,
  disabled,
  variant = "pos",
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<ContactSearchItem[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<ContactSearchItem | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seed = useMemo(() => initialItems, [initialItems]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const fromSeed = seed.find((c) => c.id === value);
    if (fromSeed) {
      setSelected(fromSeed);
      return;
    }
    const fromRemote = remote.find((c) => c.id === value);
    if (fromRemote) setSelected(fromRemote);
  }, [value, seed, remote]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setRemote([]);
        setSearchError(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearchError(false);
      try {
        const res = await api.getContacts(type, term);
        setRemote((res.data as ContactSearchItem[]) || []);
      } catch {
        setRemote([]);
        setSearchError(true);
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void runSearch(query), 220);
    return () => window.clearTimeout(id);
  }, [query, open, runSearch]);

  const localFiltered = useMemo(() => {
    if (!query.trim()) return seed.slice(0, 30);
    return seed.filter((c) => matchesLocal(c, query)).slice(0, 30);
  }, [seed, query]);

  const options = useMemo(() => {
    const map = new Map<string, ContactSearchItem>();
    for (const c of remote) map.set(c.id, c);
    for (const c of localFiltered) if (!map.has(c.id)) map.set(c.id, c);
    return Array.from(map.values()).slice(0, 40);
  }, [remote, localFiltered]);

  const displayValue = open
    ? query
    : selected
      ? `${selected.name}${selected.phone ? ` · ${formatPhoneDisplay(selected.phone, defaultDialCode)}` : ""}`
      : "";

  const isPos = variant === "pos";
  const panel = isPos
    ? "absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0f172a] shadow-xl"
    : "absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl";
  const row = isPos
    ? "w-full text-start px-3 py-2 text-sm text-white hover:bg-sky-500/15"
    : "w-full text-start px-3 py-2 text-sm text-white hover:bg-emerald-500/15";
  const inputCls = cn(
    isPos
      ? "w-full h-9 rounded-lg bg-transparent border border-white/10 px-8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400/50"
      : "w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-8 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500",
    inputClassName,
  );

  const pick = (c: ContactSearchItem | null) => {
    if (!c) {
      setSelected(null);
      setQuery("");
      onChange("", null);
      setOpen(false);
      return;
    }
    setSelected(c);
    setQuery("");
    onChange(c.id, c);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative flex-1 min-w-0", className)}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
      <input
        ref={inputRef}
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          if (selected) setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("", null);
        }}
        className={inputCls}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
      />
      {(value || query) && !disabled ? (
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-white"
          onClick={() => {
            pick(null);
            inputRef.current?.focus();
          }}
          aria-label="Clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}

      {open ? (
        <div id={listId} className={panel} role="listbox">
          <button type="button" role="option" aria-selected={!value} className={row} onClick={() => pick(null)}>
            {emptyLabel}
          </button>
          {loading ? (
            <p className="px-3 py-2 text-xs text-slate-500 inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              …
            </p>
          ) : null}
          {!loading && searchError && query.trim() ? (
            <p className="px-3 py-2 text-xs text-rose-400">
              Search failed / فشل البحث
            </p>
          ) : !loading && options.length === 0 && query.trim() ? (
            <p className="px-3 py-2 text-xs text-slate-500">—</p>
          ) : null}
          {options.map((c) => {
            const bal = Number(c.currentBalance ?? 0);
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={value === c.id}
                className={cn(row, value === c.id && (isPos ? "bg-sky-500/20" : "bg-emerald-500/20"))}
                onClick={() => pick(c)}
              >
                <span className="font-medium block truncate">{c.name}</span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {c.phone
                    ? formatPhoneDisplay(c.phone, defaultDialCode)
                    : c.email || ""}
                  {showBalance && bal > 0 ? ` · ${balanceLabel} ${bal}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
