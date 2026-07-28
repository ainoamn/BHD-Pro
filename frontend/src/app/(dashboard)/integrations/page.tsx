"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  CreditCard,
  Database,
  Loader2,
  MessageCircle,
  Mail,
  Send,
  Smartphone,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { PageHeader, LoadingSpinner, QueryError, GlassCard } from "@/components/ui/page-shell";
import { cn, apiErrorMessage } from "@/lib/utils";

type MessagingStatus = {
  whatsapp: {
    configured: boolean;
    mode: string;
    live?: boolean;
    receiptTemplate?: string | null;
    guestTemplate?: string | null;
    otpTemplate?: string | null;
  };
  apps?: { alwaysLinked?: boolean; note?: string };
  email: { configured: boolean; mode: string; live?: boolean };
  sms?: { configured: boolean; mode: string; live?: boolean };
  storage: { driver: string; s3Ready: boolean };
  redis?: {
    configured: boolean;
    posCatalogCache?: boolean;
    posCatalogCacheTtlSec?: number | null;
    dashboardCache?: boolean;
    dashboardCacheTtlSec?: number | null;
    throttleStorage?: "redis" | "memory";
  };
  payments: {
    thawani: boolean;
    stripe: boolean;
    paypal: boolean;
    terminalMode?: string;
  };
  ota: { note: string };
  ai?: { llm: boolean; note?: string };
};

type ReadmeSection = {
  id: string;
  titleAr: string;
  stepsAr: string[];
};

type MessagingReadme = {
  titleAr: string;
  titleEn: string;
  sections: ReadmeSection[];
};

export default function IntegrationsPage() {
  const t = useTranslations("integrations");
  const queryClient = useQueryClient();
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");

  const { data: status, isLoading, isError, refetch } = useQuery({
    queryKey: ["messaging-status"],
    queryFn: async () => {
      const res = await api.getMessagingStatus();
      return res.data as MessagingStatus;
    },
  });

  const {
    data: readme,
    isFetching: readmeLoading,
    isError: readmeError,
    refetch: refetchReadme,
  } = useQuery({
    queryKey: ["messaging-readme"],
    queryFn: async () => {
      const res = await api.getMessagingReadme();
      return res.data as MessagingReadme;
    },
    enabled: readmeOpen,
  });

  const testMutation = useMutation({
    mutationFn: () =>
      api.testMessaging({
        channel,
        to: to.trim(),
        body: body.trim() || undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { mode?: string; mock?: boolean } | undefined;
      if (data?.mode === "mock" || data?.mock) {
        toast(t("testMock"), { icon: "🧪" });
      } else {
        toast.success(t("testOk"));
      }
      queryClient.invalidateQueries({ queryKey: ["messaging-status"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, t("testFail")));
    },
  });

  const cards = useMemo(() => {
    if (!status) return [];
    const payOk = status.payments.thawani || status.payments.stripe || status.payments.paypal;
    const channelTone = (configured: boolean, mode: string, live?: boolean) => {
      if (!configured || mode === "off") return "off" as const;
      if (mode === "mock" || live === false) return "mock" as const;
      return "live" as const;
    };
    return [
      {
        key: "whatsapp",
        icon: MessageCircle,
        title: t("whatsapp"),
        tone: channelTone(
          status.whatsapp.configured,
          status.whatsapp.mode,
          status.whatsapp.live,
        ),
        detail: status.whatsapp.mode,
        warn:
          status.whatsapp.mode === "mock"
            ? t("mockModeHint")
            : status.whatsapp.configured && !status.whatsapp.receiptTemplate
              ? t("whatsappTemplateMissing")
              : [
                  status.whatsapp.receiptTemplate
                    ? `${t("whatsappTemplate")}: ${status.whatsapp.receiptTemplate}`
                    : null,
                  status.whatsapp.otpTemplate
                    ? `OTP: ${status.whatsapp.otpTemplate}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null,
      },
      {
        key: "email",
        icon: Mail,
        title: t("email"),
        tone: channelTone(status.email.configured, status.email.mode, status.email.live),
        detail: status.email.mode,
        warn: status.email.mode === "mock" ? t("mockModeHint") : null,
      },
      {
        key: "sms",
        icon: Smartphone,
        title: t("sms"),
        tone: channelTone(
          !!status.sms?.configured,
          status.sms?.mode || "off",
          status.sms?.live,
        ),
        detail: status.sms?.mode || "off",
        warn: status.sms?.mode === "mock" ? t("mockModeHint") : null,
      },
      {
        key: "storage",
        icon: BookOpen,
        title: t("storage"),
        tone:
          status.storage.driver === "s3"
            ? status.storage.s3Ready
              ? ("live" as const)
              : ("off" as const)
            : ("live" as const),
        detail: status.storage.driver,
        warn: null as string | null,
      },
      {
        key: "redis",
        icon: Database,
        title: t("redis"),
        tone: status.redis?.configured ? ("live" as const) : ("off" as const),
        detail: status.redis?.configured
          ? `throttle:${status.redis.throttleStorage || "redis"}`
          : "off",
        warn: status.redis?.configured
          ? t("redisHint", {
              posTtl: status.redis.posCatalogCacheTtlSec ?? 60,
              dashTtl: status.redis.dashboardCacheTtlSec ?? 30,
            })
          : t("redisOffHint"),
      },
      {
        key: "payments",
        icon: CreditCard,
        title: t("payments"),
        tone: payOk ? ("live" as const) : ("off" as const),
        detail: status.payments.terminalMode
          ? `terminal:${status.payments.terminalMode}`
          : "gateways",
        warn: null as string | null,
      },
      {
        key: "ai",
        icon: Brain,
        title: t("ai"),
        tone: status.ai?.llm ? ("live" as const) : ("off" as const),
        detail: status.ai?.llm ? "llm" : "rules",
        warn: null as string | null,
      },
    ];
  }, [status, t]);

  const toneLabel = (tone: "live" | "mock" | "off") => {
    if (tone === "live") return t("ready");
    if (tone === "mock") return t("mockMode");
    return t("notReady");
  };

  const toneClass = (tone: "live" | "mock" | "off") => {
    if (tone === "live") return "text-emerald-400";
    if (tone === "mock") return "text-amber-300";
    return "text-amber-400";
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            type="button"
            onClick={() => setReadmeOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <BookOpen className="h-4 w-4" />
            {t("readme")}
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError || !status ? (
        <QueryError onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <GlassCard key={c.key} className="p-4">
              <div className="flex items-center gap-2 text-white">
                <c.icon className="h-5 w-5 text-emerald-400" />
                <span className="font-semibold">{c.title}</span>
              </div>
              <p className={cn("mt-3 text-sm font-medium", toneClass(c.tone))}>
                {toneLabel(c.tone)} · {c.detail}
              </p>
              {c.warn ? (
                <p
                  className={cn(
                    "mt-2 text-xs leading-relaxed",
                    c.tone === "mock" || (c.key === "whatsapp" && !status?.whatsapp.receiptTemplate)
                      ? "text-amber-300"
                      : "text-slate-400",
                  )}
                >
                  {c.warn}
                </p>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}

      {status?.apps?.alwaysLinked ? (
        <p className="text-sm text-slate-400">
          {status.apps.note ||
            "Accounting, POS, and Restaurants share one company — modules gated by plan."}
        </p>
      ) : null}

      {readmeOpen && (
        <GlassCard className="p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">
            {readme?.titleAr || t("readme")}
          </h2>
          {readmeLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loadingGuide")}
            </div>
          ) : readmeError || !readme ? (
            <QueryError onRetry={() => refetchReadme()} />
          ) : (
            readme.sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <h3 className="font-semibold text-emerald-300">{section.titleAr}</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300">
                  {section.stepsAr.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </GlassCard>
      )}

      <GlassCard className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-400" />
          {t("testTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300 space-y-1">
            <span>{t("channel")}</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value as "whatsapp" | "email" | "sms")}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 space-y-1">
            <span>{t("to")}</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={
                channel === "email" ? "ops@company.com" : "9689xxxxxxx"
              }
            />
          </label>
        </div>
        <label className="block text-sm text-slate-300 space-y-1">
          <span>{t("body")}</span>
          <textarea
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 min-h-[80px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("bodyPlaceholder")}
          />
        </label>
        <button
          type="button"
          disabled={testMutation.isPending || to.trim().length < 3}
          onClick={() => testMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {testMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("sendTest")}
        </button>
      </GlassCard>
    </div>
  );
}
