"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, Loader2, Zap, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { LoadingSpinner } from "@/components/ui/page-shell";

interface Plan {
  id: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  invoicesLimit: number;
  usersLimit: number;
  support: string;
  currency: string;
}

interface Subscription {
  plan: string;
  planDetails: Plan;
  planExpiry: string | null;
  currency: string;
  usage: {
    invoicesThisMonth: number;
    invoicesLimit: number;
    users: number;
    usersLimit: number;
  };
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SubscriptionContent />
    </Suspense>
  );
}

function SubscriptionContent() {
  const t = useTranslations("subscription");
  const tPay = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const queryClient = useQueryClient();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const { data: platformGateways = [] } = useQuery({
    queryKey: ["platform-gateways"],
    queryFn: async () => {
      const res = await api.getPlatformGateways();
      return res.data as { slug: string; nameAr: string; nameEn: string }[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const res = await api.getSubscriptionPlans();
      return res.data as Plan[];
    },
  });

  const { data: current, isLoading } = useQuery({
    queryKey: ["subscription-current"],
    queryFn: async () => {
      const res = await api.getCurrentSubscription();
      return res.data as Subscription;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ plan, billing, gatewaySlug }: { plan: string; billing: "monthly" | "yearly"; gatewaySlug: string }) =>
      api.createSubscriptionCheckout({ plan, billing, gatewaySlug }),
    onSuccess: (res) => {
      const data = res.data as { checkout?: { redirectUrl?: string; kind?: string } };
      setCheckoutPlan(null);
      if (data.checkout?.redirectUrl) {
        window.location.href = data.checkout.redirectUrl;
      } else if (data.checkout?.kind === "free") {
        queryClient.invalidateQueries({ queryKey: ["subscription-current"] });
        toast.success(t("upgraded"));
      }
    },
    onError: () => toast.error(tPay("paymentFailed")),
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ plan, billing }: { plan: string; billing: "monthly" | "yearly" }) =>
      api.upgradeSubscription(plan, billing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-current"] });
      toast.success(t("upgraded"));
    },
    onError: () => toast.error("Upgrade failed"),
  });

  const planName = (plan: Plan) => {
    const locale = typeof document !== "undefined" ? document.documentElement.lang : "ar";
    return locale === "en" ? plan.nameEn : plan.nameAr;
  };

  const limitLabel = (limit: number) => (limit === -1 ? "∞" : limit.toString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-slate-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* Current plan */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : current && (
        <div className="glass rounded-xl p-6 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">{t("currentPlan")}</p>
              <p className="text-xl font-bold text-white">
                {planName(current.planDetails as Plan)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">{t("invoicesLimit")}</p>
              <p className="text-white font-medium">
                {current.usage.invoicesThisMonth} / {limitLabel(current.usage.invoicesLimit)}
              </p>
              <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: current.usage.invoicesLimit === -1
                      ? "10%"
                      : `${Math.min(100, (current.usage.invoicesThisMonth / current.usage.invoicesLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-slate-500">{t("usersLimit")}</p>
              <p className="text-white font-medium">
                {current.usage.users} / {limitLabel(current.usage.usersLimit)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">{t("expiresAt")}</p>
              <p className="text-white font-medium">
                {current.planExpiry
                  ? new Date(current.planExpiry).toLocaleDateString()
                  : t("noExpiry")}
              </p>
            </div>
            <div>
              <p className="text-slate-500">{tCommon("currency")}</p>
              <p className="text-white font-medium">{company?.currency || "OMR"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling("monthly")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            billing === "monthly" ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
          )}
        >
          {t("monthly")}
        </button>
        <button
          onClick={() => setBilling("yearly")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            billing === "yearly" ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
          )}
        >
          {t("yearly")}
        </button>
        <span className="text-xs text-emerald-400">{t("saveYearly")}</span>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = current?.plan === plan.id;
          const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const period = billing === "monthly" ? t("perMonth") : t("perYear");

          return (
            <div
              key={plan.id}
              className={cn(
                "glass rounded-xl p-6 relative",
                isCurrent && "border-2 border-emerald-500/50"
              )}
            >
              {isCurrent && (
                <span className="absolute top-4 left-4 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                  {t("current")}
                </span>
              )}

              <div className="flex items-center gap-2 mb-4">
                <Zap className={cn("w-5 h-5", plan.id === "ENTERPRISE" ? "text-amber-400" : "text-emerald-400")} />
                <h3 className="text-lg font-bold text-white">{planName(plan)}</h3>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white">{price}</span>
                <span className="text-slate-400 text-sm mr-1"> {t("omr")}{period}</span>
              </div>

              <ul className="space-y-2 text-sm text-slate-400 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {limitLabel(plan.invoicesLimit)} {t("invoicesLimit")}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {limitLabel(plan.usersLimit)} {t("usersLimit")}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {plan.support} {t("support")}
                </li>
              </ul>

              <button
                disabled={isCurrent || checkoutMutation.isPending}
                onClick={() => {
                  if (plan.id === "STARTER") {
                    upgradeMutation.mutate({ plan: plan.id, billing });
                  } else if (platformGateways.length > 0) {
                    setCheckoutPlan(plan.id);
                  } else {
                    toast.error(tPay("noPlatformGateways"));
                  }
                }}
                className={cn(
                  "w-full py-2.5 rounded-lg font-medium transition-all disabled:opacity-50",
                  isCurrent
                    ? "bg-slate-800 text-slate-500 cursor-default"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90"
                )}
              >
                {isCurrent ? t("current") : t("upgrade")}
              </button>
            </div>
          );
        })}
      </div>

      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">{tPay("chooseGateway")}</h3>
            </div>
            <p className="text-sm text-slate-400">{tPay("subscriptionPayHint")}</p>
            <div className="space-y-2">
              {platformGateways.map((gw) => (
                <button
                  key={gw.slug}
                  type="button"
                  disabled={checkoutMutation.isPending}
                  onClick={() =>
                    checkoutMutation.mutate({
                      plan: checkoutPlan,
                      billing,
                      gatewaySlug: gw.slug,
                    })
                  }
                  className="w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm"
                >
                  {gw.nameAr}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCheckoutPlan(null)}
              className="w-full h-10 text-slate-400 text-sm"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
