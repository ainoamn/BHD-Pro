"use client";

import { useAuthStore } from "@/store/auth";
import { CompanyLogo } from "@/components/company/company-logo";

/** Shown on printed reports / statements (hidden on screen). */
export function ReportPrintBranding() {
  const { company } = useAuthStore();
  if (!company?.name && !company?.logo) return null;

  return (
    <div className="hidden print:flex print:items-center print:justify-between print:gap-4 print:mb-6 print:pb-4 print:border-b print:border-slate-300">
      <div className="text-right">
        <p className="text-lg font-bold text-slate-900">{company?.name}</p>
        {company?.vatNumber && (
          <p className="text-xs text-slate-600 mt-1">
            {company.vatNumber}
          </p>
        )}
        {company?.address && (
          <p className="text-xs text-slate-600 mt-0.5">{company.address}</p>
        )}
      </div>
      <CompanyLogo src={company?.logo} name={company?.name} size="lg" />
    </div>
  );
}
