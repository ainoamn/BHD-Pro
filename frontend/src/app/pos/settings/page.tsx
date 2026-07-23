"use client";

import Link from "next/link";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { PosLinkSettings } from "@/components/pos/pos-link-settings";

export default function PosSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-slate-400 mt-1">{t.posLinkDesc}</p>
      </div>

      <PosLinkSettings variant="pos" />

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between text-sm">
        <Link href="/pos" className="text-center text-sky-300 hover:underline">
          ← {t.openPos}
        </Link>
        <Link href="/inventory" className="text-center text-emerald-300 hover:underline">
          {t.goInventory} →
        </Link>
      </div>
    </div>
  );
}
