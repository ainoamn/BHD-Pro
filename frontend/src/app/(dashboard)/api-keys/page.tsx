"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, KeyRound, Copy, Ban, Trash2, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
}

export default function ApiKeysPage() {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await api.getApiKeys();
      return res.data as ApiKeyRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["api-keys"] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error(t("nameRequired"));
      return api.createApiKey({ name: name.trim() });
    },
    onSuccess: (res) => {
      invalidate();
      const data = res.data as ApiKeyRow & { secret: string };
      setRevealedSecret(data.secret);
      setName("");
      toast.success(t("created"));
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || tCommon("error"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("revoked"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setOpen(false);
    setRevealedSecret(null);
    setName("");
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            onClick={() => {
              setRevealedSecret(null);
              setName("");
              setOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t("new")}
          </button>
        }
      />

      <GlassCard className="p-4 text-sm text-slate-400 space-y-1">
        <p>{t("usageHint")}</p>
        <code className="block text-xs text-emerald-400/90 bg-slate-900/50 rounded px-2 py-1.5 mt-2 overflow-x-auto">
          curl -H &quot;X-API-Key: qk_live_…&quot; https://your-api/api/invoices
        </code>
      </GlassCard>

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={KeyRound} title={t("empty")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{row.keyPrefix}…</p>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full h-fit",
                      row.revokedAt
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-emerald-500/10 text-emerald-400",
                    )}
                  >
                    {row.revokedAt ? t("statusRevoked") : t("statusActive")}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {t("createdAt")}: {formatDate(row.createdAt)}
                  {row.lastUsedAt ? ` · ${t("lastUsed")}: ${formatDate(row.lastUsedAt)}` : ""}
                </p>
                <div className="flex gap-2 pt-1">
                  {!row.revokedAt && (
                    <button
                      onClick={() => {
                        if (confirm(t("revokeConfirm"))) revokeMutation.mutate(row.id);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10"
                    >
                      {t("revoke")}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                  >
                    {tCommon("delete")}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">{t("name")}</th>
                  <th className="px-4 py-3">{t("prefix")}</th>
                  <th className="px-4 py-3">{t("createdAt")}</th>
                  <th className="px-4 py-3">{t("lastUsed")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.keyPrefix}…</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.lastUsedAt ? formatDate(row.lastUsedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          row.revokedAt
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-emerald-500/10 text-emerald-400",
                        )}
                      >
                        {row.revokedAt ? t("statusRevoked") : t("statusActive")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end space-x-1 rtl:space-x-reverse">
                      {!row.revokedAt && (
                        <button
                          onClick={() => {
                            if (confirm(t("revokeConfirm"))) revokeMutation.mutate(row.id);
                          }}
                          className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded inline-flex"
                          title={t("revoke")}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
                        }}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded inline-flex"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">
                {revealedSecret ? t("secretTitle") : t("new")}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {revealedSecret ? (
              <>
                <p className="text-sm text-amber-400">{t("secretWarning")}</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs break-all bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400">
                    {revealedSecret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="shrink-0 p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2.5 bg-slate-700 text-white rounded-lg"
                >
                  {t("done")}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm text-slate-400">{t("name")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </div>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("generate")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
