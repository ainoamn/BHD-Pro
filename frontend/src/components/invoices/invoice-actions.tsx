"use client";

import { useTranslations } from "next-intl";
import {
  Printer,
  Edit,
  Send,
  Ban,
  Trash2,
  Receipt,
  Mail,
  Undo2,
  FileOutput,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function canEditInvoice(
  status: string,
  paidAmount?: number,
  paymentStatus?: string
) {
  if (["PAID", "CANCELLED"].includes(status)) return false;
  if (paymentStatus === "PAID" || paymentStatus === "PARTIAL") return false;
  if (paidAmount != null && Number(paidAmount) > 0) return false;
  return true;
}

export function canUnsendInvoice(status: string, paidAmount?: number) {
  if (["DRAFT", "CANCELLED", "PAID"].includes(status)) return false;
  if (paidAmount != null && Number(paidAmount) > 0) return false;
  return ["SENT", "VIEWED", "OVERDUE"].includes(status);
}

export function canReversePayment(paidAmount?: number, paymentStatus?: string) {
  if (paidAmount != null && Number(paidAmount) > 0) return true;
  return paymentStatus === "PARTIAL" || paymentStatus === "PAID";
}

export function canDeleteInvoice(status: string, paidAmount?: number) {
  if (["PAID", "CANCELLED"].includes(status)) return false;
  if (paidAmount != null && Number(paidAmount) > 0) return false;
  return true;
}

export function canMarkPaid(status: string, paymentStatus?: string) {
  if (paymentStatus === "PAID") return false;
  return ["SENT", "OVERDUE", "VIEWED", "DRAFT"].includes(status);
}

export function canCancelInvoice(status: string) {
  return ["DRAFT", "SENT", "OVERDUE", "VIEWED"].includes(status);
}

export function canSendInvoice(status: string) {
  return status === "DRAFT";
}

export function canShowReceipt(status: string) {
  return status === "PAID";
}

interface InvoiceActionsProps {
  status: string;
  paymentStatus?: string;
  paidAmount?: number;
  invoiceType?: string;
  onView?: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onMarkSent?: () => void;
  onMarkPaid?: () => void;
  onUnsend?: () => void;
  onReversePayment?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onReceipt?: () => void;
  onConvertToInvoice?: () => void;
  disabled?: boolean;
}

function ActionBtn({
  onClick,
  label,
  icon: Icon,
  className,
  disabled,
}: {
  onClick?: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  disabled?: boolean;
}) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function InvoiceActions({
  status,
  paymentStatus,
  paidAmount,
  invoiceType,
  onView,
  onEdit,
  onSend,
  onMarkSent,
  onMarkPaid,
  onUnsend,
  onReversePayment,
  onCancel,
  onDelete,
  onReceipt,
  onConvertToInvoice,
  disabled,
}: InvoiceActionsProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-wrap gap-1 justify-end max-w-md">
      <ActionBtn
        onClick={onView}
        label={t("viewPrint")}
        icon={Printer}
        className="bg-slate-800 text-slate-200 hover:bg-slate-700"
        disabled={disabled}
      />
      {invoiceType === "QUOTATION" && status !== "CANCELLED" && onConvertToInvoice && (
        <ActionBtn
          onClick={onConvertToInvoice}
          label={t("convertQuotation")}
          icon={FileOutput}
          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
          disabled={disabled}
        />
      )}
      {canShowReceipt(status) && (
        <ActionBtn
          onClick={onReceipt}
          label={t("receipt")}
          icon={Receipt}
          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
          disabled={disabled}
        />
      )}
      {canEditInvoice(status, paidAmount, paymentStatus) && (
        <ActionBtn
          onClick={onEdit}
          label={tCommon("edit")}
          icon={Edit}
          className="bg-slate-800 text-slate-200 hover:bg-slate-700"
          disabled={disabled}
        />
      )}
      {canUnsendInvoice(status, paidAmount) && (
        <ActionBtn
          onClick={onUnsend}
          label={t("undoSend")}
          icon={Undo2}
          className="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
          disabled={disabled}
        />
      )}
      {canReversePayment(paidAmount, paymentStatus) && (
        <ActionBtn
          onClick={onReversePayment}
          label={t("reversePayment")}
          icon={Undo2}
          className="bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
          disabled={disabled}
        />
      )}
      {canSendInvoice(status) && onMarkSent && (
        <ActionBtn
          onClick={onMarkSent}
          label={t("markSent")}
          icon={Send}
          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
          disabled={disabled}
        />
      )}
      {canSendInvoice(status) && onSend && (
        <ActionBtn
          onClick={onSend}
          label={t("sendInvoice")}
          icon={Mail}
          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
          disabled={disabled}
        />
      )}
      {canMarkPaid(status, paymentStatus) && (
        <ActionBtn
          onClick={onMarkPaid}
          label={t("recordReceipt")}
          icon={Receipt}
          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
          disabled={disabled}
        />
      )}
      {canCancelInvoice(status) && (
        <ActionBtn
          onClick={onCancel}
          label={t("cancelInvoice")}
          icon={Ban}
          className="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
          disabled={disabled}
        />
      )}
      {canDeleteInvoice(status, paidAmount) && (
        <ActionBtn
          onClick={onDelete}
          label={tCommon("delete")}
          icon={Trash2}
          className="bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
          disabled={disabled}
        />
      )}
    </div>
  );
}
