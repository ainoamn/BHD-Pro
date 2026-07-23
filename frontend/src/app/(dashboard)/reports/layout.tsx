import { ReportPrintBranding } from "@/components/company/report-print-branding";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <ReportPrintBranding />
      <div className="w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] [&_table]:text-xs sm:[&_table]:text-sm [&_th]:whitespace-nowrap [&_td]:align-top">
        {children}
      </div>
    </div>
  );
}
