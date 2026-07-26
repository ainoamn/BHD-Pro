"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import {
  clearUpgradeIntent,
  readUpgradeIntent,
  UPGRADE_FEATURES,
} from "@/lib/plan-upgrade";

export default function CheckoutSuccessContent() {
  const t = useTranslations("payments");
  const tSub = useTranslations("subscription");
  const searchParams = useSearchParams();
  const invoiceNumber = searchParams.get("invoice");
  const paid = searchParams.get("paid") === "1";
  const queryClient = useQueryClient();
  const setCompany = useAuthStore((s) => s.setCompany);
  const company = useAuthStore((s) => s.company);
  const locale = useLocaleStore((s) => s.locale);
  const [intent, setIntent] = useState(() => readUpgradeIntent());

  const { data, isLoading } = useQuery({
    queryKey: ["billing-invoice", invoiceNumber],
    queryFn: async () => {
      if (!invoiceNumber) return null;
      const res = await api.getBillingInvoice(invoiceNumber);
      return res.data as { status: string; description: string };
    },
    enabled: !!invoiceNumber && paid,
  });

  useEffect(() => {
    if (!paid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCurrentSubscription();
        const sub = res.data as { plan?: string };
        queryClient.invalidateQueries({ queryKey: ["subscription-current"] });
        if (!cancelled && company && sub.plan) {
          setCompany({ ...company, plan: sub.plan as typeof company.plan });
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setIntent(readUpgradeIntent());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once after paid return
  }, [paid]);

  const featureMeta = intent.feature ? UPGRADE_FEATURES[intent.feature] : null;
  const openHref = intent.returnTo || featureMeta?.href || "/subscription";

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        {paid ? (
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
        ) : (
          <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
        )}
        <h1 className="text-xl font-bold text-white">
          {paid ? t("paymentSuccess") : t("paymentFailed")}
        </h1>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
        ) : (
          data && <p className="text-slate-400 text-sm">{data.description}</p>
        )}
        {paid && featureMeta ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100 space-y-2">
            <p className="inline-flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4" />
              {tSub("featureUnlockedTitle")}
            </p>
            <p className="text-xs text-emerald-100/80">
              {tSub("featureUnlockedBody", {
                feature:
                  locale === "en" ? featureMeta.labelEn : featureMeta.labelAr,
              })}
            </p>
            <Link
              href={openHref}
              onClick={() => clearUpgradeIntent()}
              className="inline-block mt-1 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold"
            >
              {tSub("openFeature")}
            </Link>
          </div>
        ) : null}
        <Link
          href="/subscription"
          onClick={() => {
            if (paid) clearUpgradeIntent();
          }}
          className="inline-block mt-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm"
        >
          {t("backToSubscription")}
        </Link>
      </div>
    </div>
  );
}
