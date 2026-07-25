"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

export default function RestoFloorPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [companyName, setCompanyName] = useState("");
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getRestoFloor();
        if (cancelled) return;
        setCompanyName(res.data.companyName);
        setLinked(!!res.data.linked);
      } catch {
        /* shell handles auth */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-amber-400" />
          {t.floor}
        </h1>
        {companyName ? (
          <p className="text-sm text-stone-400 mt-1">{companyName}</p>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-dashed border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-stone-900/40 p-8 sm:p-12 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #f59e0b 0%, transparent 45%), radial-gradient(circle at 80% 70%, #78716c 0%, transparent 40%)",
          }}
        />
        <div className="relative space-y-3">
          <p className="text-lg font-bold text-amber-100">{t.floorEmptyTitle}</p>
          <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
            {t.floorEmptyBody}
          </p>
          <p className="text-xs text-stone-500">{t.comingR2}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              href="/resto/menu"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f] hover:bg-amber-400"
            >
              <UtensilsCrossed className="w-4 h-4" />
              {t.menu}
            </Link>
            {!linked ? (
              <Link
                href="/resto/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-stone-200 hover:bg-white/5"
              >
                {t.settings}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
