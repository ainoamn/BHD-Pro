"use client";

import { cn } from "@/lib/utils";

/** Standard field label used across forms */
export function FormLabel({
  children,
  htmlFor,
  required,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-sm text-slate-400 mb-1", className)}
    >
      {children}
      {required ? <span className="text-rose-400 ms-0.5">*</span> : null}
    </label>
  );
}

export interface LineItemsColumn {
  key: string;
  label: string;
  className?: string;
}

/** Column headers for invoice / document line-item grids */
export function LineItemsColumnHeader({
  columns,
  className,
}: {
  columns: LineItemsColumn[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 mb-1.5 px-0.5", className)} style={{ gridTemplateColumns: "subgrid" }}>
      {columns.map((col) => (
        <span
          key={col.key}
          className={cn("text-xs font-medium text-slate-500 truncate", col.className)}
        >
          {col.label}
        </span>
      ))}
    </div>
  );
}

/** Wrapper: 12-col grid with optional header row */
export function LineItemsGrid({
  columns,
  headerColumns,
  children,
  className,
}: {
  columns?: LineItemsColumn[];
  headerColumns?: LineItemsColumn[];
  children: React.ReactNode;
  className?: string;
}) {
  const headers = headerColumns ?? columns ?? [];
  return (
    <div className={className}>
      <div
        className="hidden sm:grid grid-cols-12 gap-2 mb-1.5 px-0.5"
        aria-hidden
      >
        {headers.map((col) => (
          <span
            key={col.key}
            className={cn("text-xs font-medium text-slate-500", col.className)}
          >
            {col.label}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

/** Inline label above a field inside a line-item row (mobile-friendly) */
export function LineFieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("sm:hidden text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block", className)}>
      {children}
    </span>
  );
}
