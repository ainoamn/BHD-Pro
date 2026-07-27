"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader, GlassCard, LoadingSpinner, QueryError } from "@/components/ui/page-shell";

type Recipient = { id: string; name: string; email: string; phone?: string | null; role: string };
type Row = {
  id?: string;
  userId: string;
  frequency: "HOURLY" | "EVERY_2_HOURS" | "HALF_DAY" | "END_OF_DAY";
  isActive: boolean;
  channels: { inApp: boolean; email: boolean; whatsapp: boolean };
};

const EMPTY_ROW: Row = {
  userId: "",
  frequency: "END_OF_DAY",
  isActive: true,
  channels: { inApp: true, email: false, whatsapp: false },
};

export default function ManagerDigestsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const locale = currentUser?.company?.language === "en" ? "en" : "ar";
  const en = locale === "en";
  const [rows, setRows] = useState<Row[]>([]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manager-report-subscriptions"],
    queryFn: async () => {
      const res = await api.getManagerReportSubscriptions();
      return res.data as {
        subscriptions: Row[];
        recipients: Recipient[];
        channelStatus: {
          email: { configured: boolean; mode: string };
          whatsapp: { configured: boolean; mode: string };
        };
      };
    },
  });

  useEffect(() => {
    if (data?.subscriptions) setRows(data.subscriptions);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveManagerReportSubscriptions({ subscriptions: rows }),
    onSuccess: async () => {
      await refetch();
      toast.success(en ? "Report subscriptions saved" : "تم حفظ اشتراكات التقارير");
    },
    onError: (err) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || (en ? "Could not save" : "تعذر الحفظ"));
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: () => api.sendManagerReportNow(),
    onSuccess: () => toast.success(en ? "Digest queued" : "تم تشغيل التقرير الآن"),
    onError: () => toast.error(en ? "Could not send now" : "تعذر التشغيل الفوري"),
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError || !data) return <QueryError onRetry={() => refetch()} />;

  const recipients = data.recipients;

  return (
    <div className="space-y-6">
      <PageHeader
        title={en ? "Manager digests" : "تقارير المدير الدورية"}
        subtitle={
          en
            ? "Choose recipients, frequency, and channels. In-app works now; email and WhatsApp auto-send when configured."
            : "اختر المستلمين والتواتر والقنوات. الإشعار الداخلي يعمل الآن، والبريد وواتساب يرسلان تلقائياً عند ضبط الإعدادات."
        }
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW, userId: recipients[0]?.id || "" }])}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-white"
            >
              <Plus className="w-4 h-4" />
              {en ? "Add rule" : "إضافة قاعدة"}
            </button>
            <button
              type="button"
              onClick={() => sendNowMutation.mutate()}
              disabled={sendNowMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-bold text-[#14110f]"
            >
              {sendNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {en ? "Send now" : "إرسال الآن"}
            </button>
          </div>
        }
      />

      <GlassCard>
        <div className="space-y-3">
          <div className="text-sm text-slate-400">
            {en ? "Channel status" : "حالة القنوات"}:
            {" "}
            {`inApp=on, email=${data.channelStatus.email.mode}, whatsapp=${data.channelStatus.whatsapp.mode}`}
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              {en ? "No digest rules yet." : "لا توجد قواعد تقارير بعد."}
            </div>
          ) : null}
          {rows.map((row, idx) => (
            <div key={row.id || idx} className="grid gap-3 rounded-2xl border border-slate-800 p-4 md:grid-cols-6">
              <select
                value={row.userId}
                onChange={(e) => setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, userId: e.target.value } : item)))}
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3"
              >
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} ({recipient.role})
                  </option>
                ))}
              </select>
              <select
                value={row.frequency}
                onChange={(e) => setRows((prev) => prev.map((item, i) => (i === idx ? { ...item, frequency: e.target.value as Row["frequency"] } : item)))}
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3"
              >
                <option value="HOURLY">{en ? "Hourly" : "كل ساعة"}</option>
                <option value="EVERY_2_HOURS">{en ? "Every 2 hours" : "كل ساعتين"}</option>
                <option value="HALF_DAY">{en ? "Half day" : "نصف يوم"}</option>
                <option value="END_OF_DAY">{en ? "End of day" : "نهاية اليوم"}</option>
              </select>
              {(["inApp", "email", "whatsapp"] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!row.channels[channel]}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, channels: { ...item.channels, [channel]: e.target.checked } }
                            : item
                        )
                      )
                    }
                  />
                  {channel}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-500/10 text-rose-300"
              >
                <Trash2 className="w-4 h-4" />
                {en ? "Remove" : "حذف"}
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {en ? "Save subscriptions" : "حفظ الاشتراكات"}
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
