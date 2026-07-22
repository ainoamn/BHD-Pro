"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { CompanyLogo } from "@/components/company/company-logo";
import { cn } from "@/lib/utils";

const MAX_BYTES = 512 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";

interface CompanyLogoUploadProps {
  value?: string | null;
  companyName?: string;
  onChange: (logo: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function CompanyLogoUpload({
  value,
  companyName,
  onChange,
  disabled,
  className,
}: CompanyLogoUploadProps) {
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("logoInvalidType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.onerror = () => toast.error(t("logoReadError"));
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block text-sm text-slate-400">{t("companyLogo")}</label>
      <p className="text-xs text-slate-500">{t("companyLogoHint")}</p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center justify-center w-32 h-32 rounded-xl border border-dashed border-slate-600 bg-slate-800/50 overflow-hidden">
          {value ? (
            <CompanyLogo src={value} name={companyName} size="lg" className="max-h-28 max-w-28" />
          ) : (
            <ImagePlus className="w-10 h-10 text-slate-600" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {value ? t("logoChange") : t("logoUpload")}
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-rose-400 hover:bg-rose-950/40 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {t("logoRemove")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
