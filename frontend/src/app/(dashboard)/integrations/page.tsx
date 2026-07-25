"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, MessageCircle, Mail, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";

type MessagingStatus = {
  whatsapp: { configured: boolean; mode: string };
  email: { configured: boolean; mode: string };
  storage: { driver: string; s3Ready: boolean };
  payments: { thawani: boolean; stripe: boolean; paypal: boolean };
  ota: { note: string };
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
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["messaging-status"],
    queryFn: async () => {
      const res = await api.getMessagingStatus();
      return res.data as MessagingStatus;
    },
  });

  const { data: readme, isFetching: readmeLoading } = useQuery({
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
    onSuccess: () => {
      toast.success(t("testOk"));
      queryClient.invalidateQueries({ queryKey: ["messaging-status"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t("testFail"));
    },
  });

  const cards = useMemo(() => {
    if (!status) return [];
    return [
      {
        key: "whatsapp",
        icon: MessageCircle,
        title: t("whatsapp"),
        ok: status.whatsapp.configured,
        detail: status.whatsapp.mode,
      },
      {
        key: "email",
        icon: Mail,
        title: t("email"),
        ok: status.email.configured,
        detail: status.email.mode,
      },
      {
        key: "storage",
        icon: BookOpen,
        title: t("storage"),
        ok: status.storage.driver === "s3" ? status.storage.s3Ready : true,
        detail: status.storage.driver,
      },
    ];
  }, [status, t]);

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

      {isLoading || !status ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <GlassCard key={c.key} className="p-4">
              <div className="flex items-center gap-2 text-white">
                <c.icon className="h-5 w-5 text-emerald-400" />
                <span className="font-semibold">{c.title}</span>
              </div>
              <p
                className={cn(
                  "mt-3 text-sm font-medium",
                  c.ok ? "text-emerald-400" : "text-amber-400",
                )}
              >
                {c.ok ? t("ready") : t("notReady")} · {c.detail}
              </p>
            </GlassCard>
          ))}
        </div>
      )}

      {readmeOpen && (
        <GlassCard className="p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">
            {readme?.titleAr || t("readme")}
          </h2>
          {readmeLoading || !readme ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loadingGuide")}
            </div>
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
              onChange={(e) => setChannel(e.target.value as "whatsapp" | "email")}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 space-y-1">
            <span>{t("to")}</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={channel === "whatsapp" ? "9689xxxxxxx" : "ops@company.com"}
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
