"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { downloadCsv, printPage } from "@/lib/export-csv";
import { downloadExcel, downloadReportPdf } from "@/lib/export-report";

interface ExportButtonsProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  printTitle?: string;
}

export function ExportButtons({ filename, headers, rows, printTitle }: ExportButtonsProps) {
  const t = useTranslations("reportsExport");
  const [busy, setBusy] = useState(false);

  if (!rows.length) return null;

  const onPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadReportPdf(filename, printTitle || filename, headers, rows);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => downloadCsv(filename, headers, rows)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        {t("csv")}
      </button>
      <button
        type="button"
        onClick={() => downloadExcel(filename, headers, rows, printTitle || "Report")}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        {t("excel")}
      </button>
      <button
        type="button"
        onClick={onPdf}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        <FileText className="w-4 h-4" />
        {busy ? "..." : t("pdf")}
      </button>
      {printTitle && (
        <button
          type="button"
          onClick={() => printPage(printTitle)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          {t("print")}
        </button>
      )}
    </div>
  );
}
