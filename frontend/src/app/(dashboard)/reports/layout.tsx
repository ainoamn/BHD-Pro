import { ReportPrintBranding } from "@/components/company/report-print-branding";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ReportPrintBranding />
      {children}
    </>
  );
}
