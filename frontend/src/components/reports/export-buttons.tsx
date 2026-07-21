"use client";

import { Download, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { downloadCsv, printPage } from "@/lib/export-csv";

interface ExportButtonsProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  printTitle?: string;
}

export function ExportButtons({ filename, headers, rows, printTitle }: ExportButtonsProps) {
  const t = useTranslations("reportsExport");

  if (!rows.length) return null;

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => downloadCsv(filename, headers, rows)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        {t("csv")}
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
