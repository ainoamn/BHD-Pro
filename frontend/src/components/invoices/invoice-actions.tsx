"use client";

import { useTranslations } from "next-intl";
import {
  Eye,
  Download,
  Send,
  Edit,
  Ban,
  Trash2,
  Receipt,
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
  onDownload?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
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
        "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 shadow-sm",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

/** Solid high-contrast styles — readable on dark dashboard backgrounds */
const BTN = {
  view: "bg-white text-slate-900 hover:bg-slate-100 border border-slate-200",
  download: "bg-slate-100 text-slate-900 hover:bg-white border border-slate-300",
  send: "bg-blue-600 text-white hover:bg-blue-500",
  convert: "bg-emerald-600 text-white hover:bg-emerald-500",
  receipt: "bg-teal-600 text-white hover:bg-teal-500",
  edit: "bg-violet-600 text-white hover:bg-violet-500",
  unsend: "bg-amber-500 text-white hover:bg-amber-400",
  reverse: "bg-orange-600 text-white hover:bg-orange-500",
  issue: "bg-indigo-600 text-white hover:bg-indigo-500",
  paid: "bg-emerald-600 text-white hover:bg-emerald-500",
  cancel: "bg-amber-700 text-white hover:bg-amber-600",
  delete: "bg-rose-600 text-white hover:bg-rose-500",
} as const;

export function InvoiceActions({
  status,
  paymentStatus,
  paidAmount,
  invoiceType,
  onView,
  onDownload,
  onShare,
  onEdit,
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
  const canShare = status !== "CANCELLED";

  return (
    <div className="flex flex-wrap gap-1.5 justify-end max-w-xl">
      {onView && (
        <ActionBtn
          onClick={onView}
          label={t("view")}
          icon={Eye}
          className={BTN.view}
          disabled={disabled}
        />
      )}
      {onDownload && (
        <ActionBtn
          onClick={onDownload}
          label={t("download")}
          icon={Download}
          className={BTN.download}
          disabled={disabled}
        />
      )}
      {onShare && canShare && (
        <ActionBtn
          onClick={onShare}
          label={t("sendDocument")}
          icon={Send}
          className={BTN.send}
          disabled={disabled}
        />
      )}
      {invoiceType === "QUOTATION" && status !== "CANCELLED" && onConvertToInvoice && (
        <ActionBtn
          onClick={onConvertToInvoice}
          label={t("convertQuotation")}
          icon={FileOutput}
          className={BTN.convert}
          disabled={disabled}
        />
      )}
      {canShowReceipt(status) && (
        <ActionBtn
          onClick={onReceipt}
          label={t("receipt")}
          icon={Receipt}
          className={BTN.receipt}
          disabled={disabled}
        />
      )}
      {canEditInvoice(status, paidAmount, paymentStatus) && (
        <ActionBtn
          onClick={onEdit}
          label={tCommon("edit")}
          icon={Edit}
          className={BTN.edit}
          disabled={disabled}
        />
      )}
      {canUnsendInvoice(status, paidAmount) && (
        <ActionBtn
          onClick={onUnsend}
          label={t("undoSend")}
          icon={Undo2}
          className={BTN.unsend}
          disabled={disabled}
        />
      )}
      {canReversePayment(paidAmount, paymentStatus) && (
        <ActionBtn
          onClick={onReversePayment}
          label={t("reversePayment")}
          icon={Undo2}
          className={BTN.reverse}
          disabled={disabled}
        />
      )}
      {canSendInvoice(status) && onMarkSent && (
        <ActionBtn
          onClick={onMarkSent}
          label={invoiceType === "QUOTATION" ? t("sendQuotation") : t("issueInvoice")}
          icon={Send}
          className={BTN.issue}
          disabled={disabled}
        />
      )}
      {canMarkPaid(status, paymentStatus) && invoiceType !== "QUOTATION" && (
        <ActionBtn
          onClick={onMarkPaid}
          label={t("recordReceipt")}
          icon={Receipt}
          className={BTN.paid}
          disabled={disabled}
        />
      )}
      {canCancelInvoice(status) && (
        <ActionBtn
          onClick={onCancel}
          label={t("cancelInvoice")}
          icon={Ban}
          className={BTN.cancel}
          disabled={disabled}
        />
      )}
      {canDeleteInvoice(status, paidAmount) && (
        <ActionBtn
          onClick={onDelete}
          label={tCommon("delete")}
          icon={Trash2}
          className={BTN.delete}
          disabled={disabled}
        />
      )}
    </div>
  );
}
