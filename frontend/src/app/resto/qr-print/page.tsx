"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type QrTable = {
  id: string;
  code: string;
  name: string | null;
  zoneName: string;
  guestToken: string;
  path: string;
  dataUrl?: string;
};

export default function RestoQrPrintPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [tables, setTables] = useState<QrTable[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [floor, tokens] = await Promise.all([
          api.getRestoFloor(),
          api.ensureRestoGuestTokens(),
        ]);
        setCompanyName(floor.data.companyName || "Hisaby");
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const withQr = await Promise.all(
          (tokens.data.tables || []).map(async (tb) => {
            const url = `${origin}${tb.path}`;
            const dataUrl = await QRCode.toDataURL(url, {
              width: 280,
              margin: 1,
              color: { dark: "#14110f", light: "#ffffff" },
            });
            return { ...tb, dataUrl };
          }),
        );
        setTables(withQr);
      } catch {
        toast.error(t.actionFail);
      } finally {
        setLoading(false);
      }
    })();
  }, [t.actionFail]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 print:p-0 print:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/resto/settings"
            className="text-xs text-stone-400 hover:text-amber-200"
          >
            ← {t.settings}
          </Link>
          <h1 className="text-xl font-extrabold mt-1">{t.qrPrintTitle}</h1>
          <p className="text-sm text-stone-400 mt-1">{t.qrPrintSub}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f]"
        >
          <Printer className="w-4 h-4" />
          {t.qrPrintBtn}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400 print:hidden">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-3">
          {tables.map((tb) => (
            <article
              key={tb.id}
              className="rounded-2xl border border-stone-300 bg-white text-[#14110f] p-5 flex flex-col items-center text-center break-inside-avoid print:border-stone-400 print:rounded-xl"
            >
              <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                {companyName}
              </p>
              <p className="text-2xl font-extrabold mt-1">{tb.code}</p>
              <p className="text-sm text-stone-600">
                {tb.name || tb.zoneName}
              </p>
              {tb.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tb.dataUrl}
                  alt={`QR ${tb.code}`}
                  className="w-44 h-44 mt-3"
                />
              ) : null}
              <p className="text-xs text-stone-500 mt-3 leading-relaxed">
                {t.qrPrintScan}
              </p>
              <p className="text-[10px] text-stone-400 mt-2 font-mono break-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}${tb.path}`
                  : tb.path}
              </p>
            </article>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
