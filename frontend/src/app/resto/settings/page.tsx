"use client";

import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { RestoLinkSettings } from "@/components/resto/resto-link-settings";

export default function RestoSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-stone-400 mt-1">{t.linkDesc}</p>
      </div>
      <RestoLinkSettings variant="resto" />
    </div>
  );
}
