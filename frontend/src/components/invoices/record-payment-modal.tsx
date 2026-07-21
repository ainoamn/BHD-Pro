"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Receipt, ArrowDownUp } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { DecimalInput } from "@/components/ui/decimal-input";

export interface CollectibleInvoice {
  id: string;
  number: string;
  type: string;
  total: number;
  paidAmount: number;
  status: string;
  paymentStatus: string;
  date: string;
  dueDate?: string;
  contact?: { id: string; name: string };
}

interface RecordPaymentModalProps {
  open: boolean;
  invoices: CollectibleInvoice[];
  currency?: string;
  defaultInvoiceId?: string;
  defaultContactId?: string;
  onClose: () => void;
  onSuccess?: (invoiceId: string) => void;
}

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "CHECK",
  "ONLINE",
  "OTHER",
] as const;

type DistributionMode = "auto" | "manual";

function invoiceRemaining(inv: CollectibleInvoice) {
  return Number((Number(inv.total) - Number(inv.paidAmount || 0)).toFixed(3));
}

function isCollectible(inv: CollectibleInvoice) {
  return (
    inv.status !== "CANCELLED" &&
    inv.status !== "PAID" &&
    inv.paymentStatus !== "PAID" &&
    invoiceRemaining(inv) > 0
  );
}

function sortOldestFirst(list: CollectibleInvoice[]) {
  return [...list].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    const dda = new Date(a.dueDate || a.date).getTime();
    const ddb = new Date(b.dueDate || b.date).getTime();
    return dda - ddb;
  });
}

function autoAllocate(
  totalAmount: number,
  invoices: CollectibleInvoice[],
  selectedIds: Set<string>
): Record<string, number> {
  let left = totalAmount;
  const out: Record<string, number> = {};
  for (const inv of sortOldestFirst(invoices.filter((i) => selectedIds.has(i.id)))) {
    if (left <= 0.0005) break;
    const rem = invoiceRemaining(inv);
    const alloc = Math.min(left, rem);
    if (alloc > 0.0005) {
      out[inv.id] = Number(alloc.toFixed(3));
      left = Number((left - alloc).toFixed(3));
    }
  }
  return out;
}

export function RecordPaymentModal({
  open,
  invoices,
  currency = "OMR",
  defaultInvoiceId,
  defaultContactId,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const collectible = useMemo(
    () => sortOldestFirst(invoices.filter(isCollectible)),
    [invoices]
  );

  const contactsWithInvoices = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; remaining: number }>();
    for (const inv of collectible) {
      const cid = inv.contact?.id;
      if (!cid) continue;
      const prev = map.get(cid);
      const rem = invoiceRemaining(inv);
      if (prev) {
        prev.count += 1;
        prev.remaining = Number((prev.remaining + rem).toFixed(3));
      } else {
        map.set(cid, {
          id: cid,
          name: inv.contact?.name || "—",
          count: 1,
          remaining: rem,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [collectible]);

  const [contactId, setContactId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("auto");
  const [totalAmount, setTotalAmount] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<string>("CASH");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const contactInvoices = useMemo(
    () => collectible.filter((inv) => inv.contact?.id === contactId),
    [collectible, contactId]
  );

  const allocatedSum = useMemo(
    () =>
      Number(
        Object.entries(allocations)
          .filter(([id]) => selectedIds.has(id))
          .reduce((s, [, v]) => s + v, 0)
          .toFixed(3)
      ),
    [allocations, selectedIds]
  );

  const contactTotalRemaining = useMemo(
    () =>
      Number(
        contactInvoices
          .filter((i) => selectedIds.has(i.id))
          .reduce((s, i) => s + invoiceRemaining(i), 0)
          .toFixed(3)
      ),
    [contactInvoices, selectedIds]
  );

  const initForContact = useCallback(
    (cid: string, preferInvoiceId?: string) => {
      const list = collectible.filter((i) => i.contact?.id === cid);
      const ids = new Set(list.map((i) => i.id));
      if (preferInvoiceId && ids.has(preferInvoiceId)) {
        // keep all contact invoices selected; highlight default via preferInvoiceId
      }
      setSelectedIds(ids);
      const totalRem = Number(list.reduce((s, i) => s + invoiceRemaining(i), 0).toFixed(3));
      setTotalAmount(totalRem);
      setAllocations(autoAllocate(totalRem, list, ids));
    },
    [collectible]
  );

  useEffect(() => {
    if (!open) return;
    const defaultInv = defaultInvoiceId
      ? collectible.find((i) => i.id === defaultInvoiceId)
      : undefined;
    const cid =
      defaultContactId ||
      defaultInv?.contact?.id ||
      contactsWithInvoices[0]?.id ||
      "";
    setContactId(cid);
    setDistributionMode("auto");
    setMethod("CASH");
    setDate(new Date().toISOString().split("T")[0]);
    setReference("");
    setNotes("");
    if (cid) initForContact(cid, defaultInvoiceId);
  }, [open, defaultInvoiceId, defaultContactId, collectible, contactsWithInvoices, initForContact]);

  useEffect(() => {
    if (!open || !contactId) return;
    initForContact(contactId, defaultInvoiceId);
  }, [contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (distributionMode !== "auto" || !contactId) return;
    setAllocations(autoAllocate(totalAmount, contactInvoices, selectedIds));
  }, [totalAmount, distributionMode, contactInvoices, selectedIds, contactId]);

  const toggleInvoice = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (distributionMode === "auto") {
        setAllocations(autoAllocate(totalAmount, contactInvoices, next));
      } else {
        setAllocations((a) => {
          const copy = { ...a };
          if (!next.has(id)) delete copy[id];
          return copy;
        });
      }
      return next;
    });
  };

  const setManualAllocation = (invoiceId: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: value,
    }));
  };

  const switchToAuto = () => {
    setDistributionMode("auto");
    setAllocations(autoAllocate(totalAmount, contactInvoices, selectedIds));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const rows = sortOldestFirst(contactInvoices)
        .filter((inv) => selectedIds.has(inv.id) && (allocations[inv.id] || 0) > 0)
        .map((inv) => ({
          invoiceId: inv.id,
          amount: allocations[inv.id],
        }));
      return api.recordBatchInvoicePayment({
        method,
        date,
        reference: reference || undefined,
        notes: notes || undefined,
        allocations: rows,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("paidSuccess"));
      const firstId =
        (res.data as { invoices?: { id: string }[] })?.invoices?.[0]?.id ||
        contactInvoices.find((i) => selectedIds.has(i.id))?.id;
      if (firstId) onSuccess?.(firstId);
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || t("actionError"));
    },
  });

  const allocationMismatch =
    Math.abs(allocatedSum - totalAmount) > 0.001 && distributionMode === "manual";
  const hasSelection = selectedIds.size > 0 && allocatedSum > 0;
  const canSubmit =
    hasSelection &&
    totalAmount > 0 &&
    !allocationMismatch &&
    !mutation.isPending &&
    collectible.length > 0 &&
    contactId;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-8 bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl mb-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">{t("recordReceipt")}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {collectible.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">{t("noCollectible")}</p>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("selectBeneficiary")}</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {contactsWithInvoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {t("invoicesCount", { count: c.count })} —{" "}
                      {formatMoney(c.remaining, currency)}
                    </option>
                  ))}
                </select>
              </div>

              {contactId && contactInvoices.length > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-slate-400 flex items-center gap-1.5">
                      <ArrowDownUp className="w-4 h-4 text-emerald-500" />
                      {t("beneficiaryInvoices")} — {t("oldestFirst")}
                    </p>
                    <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={switchToAuto}
                        className={cn(
                          "px-3 py-1.5 transition-colors",
                          distributionMode === "auto"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        )}
                      >
                        {t("distributeAuto")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributionMode("manual")}
                        className={cn(
                          "px-3 py-1.5 transition-colors",
                          distributionMode === "manual"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        )}
                      >
                        {t("distributeManual")}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800/80 sticky top-0">
                          <tr>
                            <th className="p-2 w-10" />
                            <th className="p-2 text-right text-slate-400 font-medium">{t("number")}</th>
                            <th className="p-2 text-right text-slate-400 font-medium">{t("date")}</th>
                            <th className="p-2 text-right text-slate-400 font-medium">{t("dueDate")}</th>
                            <th className="p-2 text-right text-slate-400 font-medium">{t("remaining")}</th>
                            <th className="p-2 text-right text-slate-400 font-medium min-w-[100px]">
                              {t("allocation")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {contactInvoices.map((inv) => {
                            const rem = invoiceRemaining(inv);
                            const checked = selectedIds.has(inv.id);
                            const isDefault = inv.id === defaultInvoiceId;
                            return (
                              <tr
                                key={inv.id}
                                className={cn(
                                  "border-t border-slate-800/80",
                                  checked && "bg-emerald-500/5",
                                  isDefault && "ring-1 ring-inset ring-emerald-500/30"
                                )}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleInvoice(inv.id)}
                                    className="rounded border-slate-600"
                                  />
                                </td>
                                <td className="p-2 text-white font-medium">{inv.number}</td>
                                <td className="p-2 text-slate-400">
                                  {new Date(inv.date).toLocaleDateString("ar-OM")}
                                </td>
                                <td className="p-2 text-slate-400">
                                  {inv.dueDate
                                    ? new Date(inv.dueDate).toLocaleDateString("ar-OM")
                                    : "—"}
                                </td>
                                <td className="p-2 text-slate-300">{formatMoney(rem, currency)}</td>
                                <td className="p-2">
                                  {distributionMode === "manual" && checked ? (
                                    <DecimalInput
                                      value={allocations[inv.id] || 0}
                                      min={0}
                                      decimals={3}
                                      onChange={(v) =>
                                        setManualAllocation(inv.id, Math.min(v, rem))
                                      }
                                      className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                                    />
                                  ) : (
                                    <span className="text-emerald-400">
                                      {checked && allocations[inv.id]
                                        ? formatMoney(allocations[inv.id], currency)
                                        : "—"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 bg-slate-800/40 border-t border-slate-800 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>
                        {t("contactTotalDue")}:{" "}
                        <span className="text-white">{formatMoney(contactTotalRemaining, currency)}</span>
                      </span>
                      <span>
                        {t("allocated")}:{" "}
                        <span className={cn(allocationMismatch ? "text-rose-400" : "text-emerald-400")}>
                          {formatMoney(allocatedSum, currency)}
                        </span>
                      </span>
                      {distributionMode === "auto" && totalAmount > allocatedSum + 0.001 && (
                        <span className="text-amber-400">{t("unallocatedHint")}</span>
                      )}
                      {allocationMismatch && (
                        <span className="text-rose-400">{t("allocationMismatch")}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{t("totalPayment")}</label>
                      <DecimalInput
                        value={totalAmount}
                        min={0.001}
                        decimals={3}
                        onChange={(v) => setTotalAmount(v)}
                        className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{t("paymentMethod")}</label>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {t(`method_${m}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{t("date")}</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{t("reference")}</label>
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={t("referenceHint")}
                        className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{t("notes")}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </>
              )}

              {contactId && contactInvoices.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">{t("noCollectible")}</p>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
              className="flex-1 h-10 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  {t("recordReceipt")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
