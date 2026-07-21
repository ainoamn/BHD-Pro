"use client";

import { useEffect, useState } from "react";
import { cn, normalizeDecimalString, parseDecimalValue } from "@/lib/utils";

interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  decimals?: number;
  disabled?: boolean;
}

/**
 * Accepts decimals with `.` or `,` (and Arabic digits) — unlike type="number".
 */
export function DecimalInput({
  value,
  onChange,
  className,
  min = 0,
  decimals = 3,
  disabled,
}: DecimalInputProps) {
  const [text, setText] = useState(() => formatInitial(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatInitial(value, decimals));
    }
  }, [value, decimals, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const parsed = parseDecimalValue(text);
        const next = parsed === null ? 0 : Math.max(min, parsed);
        onChange(Number(next.toFixed(decimals)));
        setText(formatInitial(next, decimals));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty, digits, one separator (. or ,), Arabic digits
        if (!/^[\d٠-٩۰-۹]*([.,٫][\d٠-٩۰-۹]*)?$/.test(raw) && raw !== "") {
          return;
        }
        setText(raw);
        const normalized = normalizeDecimalString(raw);
        if (normalized === "" || normalized === ".") {
          onChange(0);
          return;
        }
        const num = parseFloat(normalized);
        if (!Number.isNaN(num)) {
          onChange(Math.max(min, num));
        }
      }}
      className={cn(className)}
    />
  );
}

function formatInitial(value: number, decimals: number): string {
  if (value === 0 || value === undefined || value === null || Number.isNaN(value)) {
    return "";
  }
  const fixed = Number(Number(value).toFixed(decimals));
  return String(fixed);
}
