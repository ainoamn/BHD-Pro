"use client";

import { useLocale } from "next-intl";
import { DecimalInput } from "@/components/ui/decimal-input";

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  labelEn?: string | null;
  fieldType: string;
  optionsJson?: string[] | null;
  isRequired?: boolean;
  isActive?: boolean;
}

export function CustomFieldsInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<string, string | number>;
  onChange: (next: Record<string, string | number>) => void;
}) {
  const locale = useLocale();
  const active = fields.filter((f) => f.isActive !== false);
  if (active.length === 0) return null;

  const setValue = (key: string, value: string | number) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800">
      {active.map((field) => {
        const label = locale === "en" && field.labelEn ? field.labelEn : field.label;
        const options = Array.isArray(field.optionsJson) ? field.optionsJson : [];
        return (
          <div key={field.id}>
            <label className="block text-sm text-slate-400 mb-1">
              {label}
              {field.isRequired ? " *" : ""}
            </label>
            {field.fieldType === "SELECT" ? (
              <select
                value={String(values[field.key] ?? "")}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.fieldType === "NUMBER" ? (
              <DecimalInput
                value={Number(values[field.key] || 0)}
                onChange={(v) => setValue(field.key, v)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            ) : field.fieldType === "DATE" ? (
              <input
                type="date"
                value={String(values[field.key] ?? "")}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            ) : (
              <input
                type="text"
                value={String(values[field.key] ?? "")}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
