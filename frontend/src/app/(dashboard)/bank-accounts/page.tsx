"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/utils";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";
import { DecimalInput } from "@/components/ui/decimal-input";
import { GlassCard } from "@/components/ui/page-shell";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";

interface BankRow {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
}

export default function BankAccountsPage() {
  const t = useTranslations("erp");
  const tRecon = useTranslations("bankRecon");
  const tCommon = useTranslations("common");
  const tDual = useTranslations("dualControl");
  const { company, user } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [dualOpen, setDualOpen] = useState(false);
  const [dualMode, setDualMode] = useState<"transfer" | "reverse">("transfer");
  const [lastTransferJournalId, setLastTransferJournalId] = useState<string | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.getBankAccounts()).data as BankRow[],
  });

  const transferMutation = useMutation({
    mutationFn: (approval?: DualApprovalPayload) =>
      api.transferBetweenBanks({
        fromBankAccountId: fromId,
        toBankAccountId: toId,
        amount,
        date,
        description: description.trim() || undefined,
        approval,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      const jid = (res.data as { journalId?: string })?.journalId;
      if (jid) setLastTransferJournalId(jid);
      toast.success(t("transferSuccess"));
      setAmount(0);
      setDescription("");
      setDualOpen(false);
      setDualMode("transfer");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (approval?: DualApprovalPayload) => {
      if (!lastTransferJournalId) throw new Error("No transfer");
      return api.reverseBankTransfer(lastTransferJournalId, approval);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success(t("transferReverseSuccess"));
      setLastTransferJournalId(null);
      setDualOpen(false);
      setDualMode("transfer");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const canTransfer =
    !!fromId && !!toId && fromId !== toId && amount > 0 && !transferMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/bank-reconciliation"
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700"
        >
          <ArrowLeftRight className="w-4 h-4" />
          {tRecon("title")}
        </Link>
      </div>

      {banks.length >= 2 && (
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">{t("transferTitle")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="">{t("transferFrom")}</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {formatMoney(Number(b.currentBalance), currency)}
                </option>
              ))}
            </select>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="">{t("transferTo")}</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id} disabled={b.id === fromId}>
                  {b.name} — {formatMoney(Number(b.currentBalance), currency)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DecimalInput value={amount} onChange={setAmount} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("transferNote")}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canTransfer}
              onClick={() => {
                setDualMode("transfer");
                setDualOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {transferMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowLeftRight className="w-4 h-4" />
              )}
              {t("transferSubmit")}
            </button>
            {lastTransferJournalId ? (
              <button
                type="button"
                disabled={reverseMutation.isPending}
                onClick={() => {
                  setDualMode("reverse");
                  setDualOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600/80 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {reverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {t("transferReverse")}
              </button>
            ) : null}
          </div>
        </GlassCard>
      )}

      <ErpCrudPage
        title={t("bankTitle")}
        subtitle={t("bankSubtitle")}
        queryKey="bank-accounts"
        emptyLabel={t("bankTitle")}
        currency={company?.currency}
        fetchAll={() => api.getBankAccounts()}
        create={(d) => api.createBankAccount(d)}
        update={(id, d) => api.updateBankAccount(id, d)}
        remove={(id) => api.deleteBankAccount(id)}
        columns={[
          { key: "name", label: t("name") },
          { key: "bankName", label: t("bankName") },
          { key: "accountNumber", label: t("accountNumber") },
          {
            key: "currentBalance",
            label: t("balance"),
            render: (r) =>
              formatMoney(
                Number((r as Record<string, unknown>).currentBalance),
                company?.currency || "OMR"
              ),
          },
        ]}
        fields={[
          { key: "name", label: t("name"), required: true },
          { key: "bankName", label: t("bankName"), required: true },
          { key: "accountNumber", label: t("accountNumber"), required: true },
          { key: "iban", label: t("iban") },
          { key: "openingBalance", label: t("openingBalance"), type: "number" },
          {
            key: "branchId",
            label: t("branch"),
            type: "select",
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
        ]}
      />

      <DualApprovalModal
        open={dualOpen}
        action="BANK_INTERNAL_TRANSFER"
        actionLabel={tDual("action.BANK_INTERNAL_TRANSFER")}
        payload={
          dualMode === "reverse"
            ? { journalId: lastTransferJournalId }
            : { fromBankAccountId: fromId, toBankAccountId: toId, amount }
        }
        summary={
          dualMode === "reverse"
            ? lastTransferJournalId || undefined
            : `${formatMoney(amount, currency)}`
        }
        actorRole={user?.role}
        busy={transferMutation.isPending || reverseMutation.isPending}
        onCancel={() => {
          setDualOpen(false);
          setDualMode("transfer");
        }}
        onConfirm={async (approval) => {
          if (dualMode === "reverse") {
            await reverseMutation.mutateAsync(approval);
            return;
          }
          await transferMutation.mutateAsync(approval);
        }}
      />
    </div>
  );
}
