"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  FileText,
  X,
  Loader2,
  UserPlus,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import {
  formatMoney,
  formatDate,
  calculateTax,
  calculateTotal,
  extractTaxFromInclusive,
  cn,
} from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/invoice-document";
import {
  InvoiceActions,
  canEditInvoice,
} from "@/components/invoices/invoice-actions";
import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";
import { ReversePaymentModal } from "@/components/invoices/reverse-payment-modal";
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  AccountingHubTabs,
  type AccountingHubTab,
} from "@/components/accounting/accounting-hub-tabs";
import { AccountingOverviewTab } from "@/components/accounting/accounting-overview-tab";
import { PageHeader, LoadingSpinner } from "@/components/ui/page-shell";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
}

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

interface Invoice {
  id: string;
  number: string;
  type: string;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  status: string;
  paymentStatus: string;
  notes?: string;
  contact: Contact;
  items: InvoiceItem[];
}

interface LineItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

type InvoiceType = "SALES" | "PURCHASE";
type DocumentType = InvoiceType | "QUOTATION" | "CREDIT_NOTE" | "DEBIT_NOTE";

const DOC_TYPES = new Set(["SALES", "PURCHASE", "QUOTATION", "CREDIT_NOTE", "DEBIT_NOTE"]);

const emptyLine = (): LineItemForm => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

export function AccountingModule() {
  const t = useTranslations("invoices");
  const tAcc = useTranslations("accounting");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab") as AccountingHubTab | null;
  const typeFromUrl = searchParams.get("type");
  const docTypeFromUrl = searchParams.get("docType") || typeFromUrl;
  const initialDocType: DocumentType | null =
    docTypeFromUrl && DOC_TYPES.has(docTypeFromUrl) ? (docTypeFromUrl as DocumentType) : null;
  const initialHub: AccountingHubTab =
    tabFromUrl === "overview" || tabFromUrl === "sales" || tabFromUrl === "purchases" || tabFromUrl === "documents"
      ? tabFromUrl
      : typeFromUrl === "PURCHASE"
        ? "purchases"
        : typeFromUrl === "SALES"
          ? "sales"
          : "overview";
  const initialType: InvoiceType =
    typeFromUrl === "PURCHASE" || typeFromUrl === "SALES"
      ? typeFromUrl
      : initialHub === "purchases"
        ? "PURCHASE"
        : "SALES";

  const [hubTab, setHubTab] = useState<AccountingHubTab>(initialHub);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialType);
  const [documentType, setDocumentType] = useState<DocumentType>(
    initialDocType ||
      (initialHub === "purchases"
        ? "PURCHASE"
        : initialHub === "sales"
          ? "SALES"
          : "SALES")
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [documentVariant, setDocumentVariant] = useState<"invoice" | "receipt">("invoice");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<LineItemForm[]>([emptyLine()]);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectInvoiceId, setCollectInvoiceId] = useState<string | undefined>();
  const [reversePaymentInvoice, setReversePaymentInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const action = searchParams.get("action");
    const type = searchParams.get("type");
    const docType = searchParams.get("docType") || type;
    const tabParam = searchParams.get("tab") as AccountingHubTab | null;
    const paymentParam = searchParams.get("paymentFilter");
    if (
      tabParam === "overview" ||
      tabParam === "sales" ||
      tabParam === "purchases" ||
      tabParam === "documents"
    ) {
      setHubTab(tabParam);
    }
    if (docType && DOC_TYPES.has(docType)) {
      const dt = docType as DocumentType;
      setDocumentType(dt);
      if (dt === "PURCHASE" || dt === "DEBIT_NOTE") {
        setInvoiceType("PURCHASE");
        if (tabParam !== "documents") setHubTab("purchases");
      } else if (dt === "SALES" || dt === "QUOTATION" || dt === "CREDIT_NOTE") {
        setInvoiceType("SALES");
        if (tabParam !== "documents") setHubTab("sales");
      }
    } else if (type === "SALES" || type === "PURCHASE") {
      setInvoiceType(type);
      setDocumentType(type);
    }
    if (paymentParam) setPaymentFilter(paymentParam);
    if (action === "new") {
      setModalOpen(true);
      if (docType && DOC_TYPES.has(docType)) {
        const dt = docType as DocumentType;
        setDocumentType(dt);
        setHubTab(dt === "PURCHASE" || dt === "DEBIT_NOTE" ? "purchases" : "sales");
      } else if (type === "SALES" || type === "PURCHASE") {
        setInvoiceType(type);
        setDocumentType(type);
        setHubTab(type === "SALES" ? "sales" : "purchases");
      }
    }
    if (action === "collect") {
      setCollectOpen(true);
      setHubTab("sales");
    }
  }, [searchParams]);

  // المصروفات: كل دفتر العناوين | الإيرادات: العملاء فقط
  const contactsQueryType = invoiceType === "SALES" ? "CUSTOMER" : undefined;

  useEffect(() => {
    setContactId("");
    setQuickCustomerOpen(false);
    setQuickCustomerName("");
  }, [invoiceType]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await api.getInvoices();
      return res.data as Invoice[];
    },
  });

  const listTypeFilter =
    hubTab === "sales"
      ? documentType === "QUOTATION" || documentType === "CREDIT_NOTE"
        ? documentType
        : "SALES"
      : hubTab === "purchases"
        ? documentType === "DEBIT_NOTE"
          ? "DEBIT_NOTE"
          : "PURCHASE"
        : undefined;

  const filteredInvoices = invoices
    .filter((inv) => !listTypeFilter || inv.type === listTypeFilter)
    .filter((inv) => !statusFilter || inv.status === statusFilter)
    .filter((inv) => !paymentFilter || inv.paymentStatus === paymentFilter)
    .filter((inv) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.contact?.name?.toLowerCase().includes(q)
      );
    });

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats", listTypeFilter],
    queryFn: async () => {
      const res = await api.getInvoiceStats(listTypeFilter);
      return res.data as {
        total: number;
        paidAmount: number;
        pendingAmount: number;
        overdueCount: number;
        pendingCollectionCount?: number;
        todayReceived?: number;
        todayExpenses?: number;
      };
    },
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", contactsQueryType ?? "ALL"],
    queryFn: async () => {
      const res = await api.getContacts(contactsQueryType);
      return res.data as Contact[];
    },
  });

  const contactType = invoiceType === "SALES" ? "CUSTOMER" : "SUPPLIER";

  const resetForm = () => {
    setEditingId(null);
    setContactId("");
    setDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
    setNotes("");
    setDiscount(0);
    setLines([emptyLine()]);
    setQuickCustomerOpen(false);
    setQuickCustomerName("");
  };

  const openCreate = () => {
    openNewInvoice(invoiceType);
  };

  const openEdit = (inv: Invoice) => {
    if (!canEditInvoice(inv.status, Number(inv.paidAmount || 0), inv.paymentStatus)) {
      toast.error(
        Number(inv.paidAmount || 0) > 0 ? t("cannotEditWithPayments") : t("cannotEditPaid")
      );
      return;
    }
    setEditingId(inv.id);
    setInvoiceType(inv.type as InvoiceType);
    setContactId(inv.contact?.id || "");
    setDate(inv.date.split("T")[0]);
    setDueDate(inv.dueDate.split("T")[0]);
    setNotes(inv.notes || "");
    setDiscount(Number(inv.discount));
    setLines(
      inv.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
      }))
    );
    setModalOpen(true);
  };

  const subtotalGross = lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice - l.discount,
    0
  );

  const applyVat = company?.applyVat !== false;
  const pricesIncludeTax = !!company?.pricesIncludeTax && applyVat;
  const vatRate = applyVat ? (company?.vatRate ?? 5) : 0;

  let subtotal: number;
  let taxAmount: number;
  let grandTotal: number;

  if (pricesIncludeTax && vatRate > 0) {
    // Prices already include tax — extract net + tax from inclusive totals
    const extracted = extractTaxFromInclusive(Math.max(0, subtotalGross - discount), vatRate);
    subtotal = extracted.net;
    taxAmount = extracted.tax;
    grandTotal = Number((subtotal + taxAmount).toFixed(3));
  } else {
    subtotal = subtotalGross;
    taxAmount = calculateTax(Math.max(0, subtotal - discount), vatRate);
    grandTotal = calculateTotal(subtotal, taxAmount, discount);
  }

  const quickCustomerMutation = useMutation({
    mutationFn: () =>
      api.createContact({
        type: contactType,
        name: quickCustomerName,
        email: "",
        phone: "",
      }),
    onSuccess: (res) => {
      refetchContacts();
      setContactId((res.data as Contact).id);
      setQuickCustomerOpen(false);
      setQuickCustomerName("");
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("saveError")),
  });

  const invalidateInvoiceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["report-profit-loss"] });
    queryClient.invalidateQueries({ queryKey: ["report-balance-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["report-trial-balance"] });
    queryClient.invalidateQueries({ queryKey: ["report-cash-flow"] });
  };

  const openDocument = (inv: Invoice, variant: "invoice" | "receipt" = "invoice") => {
    setPrintInvoice(inv);
    setDocumentVariant(variant);
  };

  const handleMarkPaid = (id: string) => {
    setCollectInvoiceId(id);
    setCollectOpen(true);
  };

  const handleCollectSuccess = async (invoiceId: string) => {
    invalidateInvoiceQueries();
    try {
      const res = await api.getInvoice(invoiceId);
      setPrintInvoice(res.data as Invoice);
      setDocumentVariant("receipt");
    } catch {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) {
        setPrintInvoice({ ...inv, status: "PAID", paymentStatus: "PAID" });
        setDocumentVariant("receipt");
      }
    }
  };

  const handleCancel = (id: string) => {
    if (confirm(t("cancelConfirm"))) {
      statusMutation.mutate({ id, status: "CANCELLED" });
    }
  };

  const handleMarkSent = (id: string) => {
    statusMutation.mutate({ id, status: "SENT" });
  };

  const handleDelete = (id: string) => {
    if (confirm(t("deleteConfirm"))) {
      deleteMutation.mutate(id);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contactId) {
        throw new Error(t("needCustomer"));
      }

      const taxRate = vatRate;
      const items = lines
        .filter((l) => l.description.trim())
        .map((l) => {
          const quantity = l.quantity > 0 ? l.quantity : 1;
          if (pricesIncludeTax && taxRate > 0) {
            const lineInclusive = quantity * l.unitPrice - l.discount;
            const { net } = extractTaxFromInclusive(Math.max(0, lineInclusive), taxRate);
            const unitNet = Number(((net + l.discount) / quantity).toFixed(3));
            return {
              description: l.description.trim(),
              quantity: Number(quantity),
              unitPrice: Number(unitNet),
              discount: Number(l.discount || 0),
            };
          }
          return {
            description: l.description.trim(),
            quantity: Number(quantity),
            unitPrice: Number(l.unitPrice || 0),
            discount: Number(l.discount || 0),
          };
        });

      if (items.length === 0) {
        throw new Error(t("needItems"));
      }

      if (items.some((i) => i.quantity < 0.001)) {
        throw new Error(t("needQuantity"));
      }

      const payload = {
        type: documentType,
        contactId,
        date,
        dueDate,
        discount: Number(discount || 0),
        taxRate: Number(taxRate),
        notes: notes || undefined,
        items,
      };
      if (editingId) return api.updateInvoice(editingId, payload);
      return api.createInvoice(payload);
    },
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success(t("saved"));
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        message?: string;
        response?: { data?: { message?: string | string[] } };
      };
      const apiMsg = axiosErr?.response?.data?.message;
      const detail = Array.isArray(apiMsg)
        ? apiMsg.join(" — ")
        : apiMsg || axiosErr?.message || t("saveError");
      toast.error(String(detail));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success(t("deleted"));
    },
    onError: () => toast.error(t("actionError")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateInvoiceStatus(id, status),
    onSuccess: (_data, { id, status }) => {
      invalidateInvoiceQueries();
      if (status === "PAID") {
        toast.success(t("paidSuccess"));
        if (printInvoice?.id === id) setDocumentVariant("receipt");
      } else if (status === "CANCELLED") toast.success(t("cancelledSuccess"));
      else toast.success(t("saved"));
    },
    onError: () => toast.error(t("actionError")),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.sendInvoice(id),
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success(t("sentSuccess"));
    },
    onError: () => toast.error(t("sendError")),
  });

  const unsendMutation = useMutation({
    mutationFn: (id: string) => api.unsendInvoice(id),
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success(t("undoSendSuccess"));
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || t("actionError"));
    },
  });

  const convertQuotationMutation = useMutation({
    mutationFn: (id: string) => api.convertQuotationToInvoice(id),
    onSuccess: () => {
      invalidateInvoiceQueries();
      toast.success(t("convertQuotation"));
    },
    onError: () => toast.error(t("actionError")),
  });

  const handleUnsend = (id: string) => {
    if (confirm(t("undoSendConfirm"))) unsendMutation.mutate(id);
  };

  const handleOpenReversePayment = (inv: Invoice) => {
    setReversePaymentInvoice(inv);
  };

  const actionsBusy =
    statusMutation.isPending ||
    sendMutation.isPending ||
    deleteMutation.isPending ||
    unsendMutation.isPending ||
    convertQuotationMutation.isPending;

  const activeDocumentInvoice = printInvoice
    ? invoices.find((i) => i.id === printInvoice.id) ?? printInvoice
    : null;

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      PAID: "bg-emerald-500/10 text-emerald-400",
      DRAFT: "bg-slate-500/10 text-slate-400",
      SENT: "bg-blue-500/10 text-blue-400",
      OVERDUE: "bg-rose-500/10 text-rose-400",
      CANCELLED: "bg-slate-600/10 text-slate-500",
    };
    return map[status] || "bg-amber-500/10 text-amber-400";
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      PAID: tStatus("paid"),
      DRAFT: tStatus("draft"),
      SENT: tStatus("sent"),
      OVERDUE: tStatus("overdue"),
      CANCELLED: tStatus("cancelled"),
      UNPAID: tStatus("unpaid"),
      PARTIAL: tStatus("partial"),
    };
    return map[status] || status;
  };


  const updateUrl = useCallback(
    (nextTab: AccountingHubTab, extra?: Record<string, string | null>) => {
      const params = new URLSearchParams();
      params.set("tab", nextTab);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          if (v) params.set(k, v);
        }
      }
      router.replace(`/accounting?${params.toString()}`);
    },
    [router]
  );

  const handleHubChange = (next: AccountingHubTab) => {
    setHubTab(next);
    updateUrl(next, { action: null, type: null });
  };

  const openNewInvoice = (type: InvoiceType) => {
    setInvoiceType(type);
    const nextTab = type === "SALES" ? "sales" : "purchases";
    setHubTab(nextTab);
    resetForm();
    setModalOpen(true);
    updateUrl(nextTab, { action: "new", type });
  };

  const showList = hubTab === "sales" || hubTab === "purchases" || hubTab === "documents";
  const isSalesList = hubTab === "sales";
  const isPurchaseList = hubTab === "purchases";
  const isDocuments = hubTab === "documents";
  const pendingCollection = stats?.pendingCollectionCount ?? 0;

  const toDocumentData = (inv: Invoice): InvoiceDocumentData => ({
    ...inv,
    paidAmount: Number(inv.paidAmount || 0),
    paymentStatus: inv.paymentStatus,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    taxRate: Number(inv.taxRate),
    taxAmount: Number(inv.taxAmount),
    total: Number(inv.total),
    items: inv.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount),
      taxAmount: Number(i.taxAmount),
      total: Number(i.total),
    })),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          hubTab === "overview"
            ? tAcc("title")
            : hubTab === "sales"
              ? tAcc("tabSales")
              : hubTab === "purchases"
                ? tAcc("tabPurchases")
                : tAcc("tabDocuments")
        }
        subtitle={hubTab === "overview" ? tAcc("subtitle") : t("subtitle")}
        action={
          showList ? (
            <div className="flex items-center gap-2">
              {(isSalesList || isDocuments) && (
                <button
                  type="button"
                  onClick={() => {
                    setCollectInvoiceId(undefined);
                    setCollectOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-700/50 rounded-lg text-sm font-medium hover:bg-emerald-600/30"
                >
                  <Receipt className="w-4 h-4" />
                  {t("recordReceipt")}
                </button>
              )}
              <button
                onClick={() => openNewInvoice(isPurchaseList ? "PURCHASE" : "SALES")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium hover:opacity-90",
                  isPurchaseList
                    ? "bg-gradient-to-r from-rose-500 to-orange-600"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600"
                )}
              >
                <Plus className="w-4 h-4" />
                {isPurchaseList ? t("newExpense") : t("newRevenue")}
              </button>
            </div>
          ) : undefined
        }
      />

      <AccountingHubTabs
        active={hubTab}
        onChange={handleHubChange}
        pendingCount={pendingCollection}
      />

      {hubTab === "overview" && (
        <AccountingOverviewTab
          currency={company?.currency || "OMR"}
          todayReceived={stats?.todayReceived ?? 0}
          todayExpenses={stats?.todayExpenses ?? 0}
          pendingCollection={pendingCollection}
          pendingAmount={Number(stats?.pendingAmount ?? 0)}
          onNewSalesInvoice={() => openNewInvoice("SALES")}
          onNewPurchaseInvoice={() => openNewInvoice("PURCHASE")}
          onCollect={() => {
            setCollectInvoiceId(undefined);
            setCollectOpen(true);
          }}
          onViewDocuments={() => handleHubChange("documents")}
          onViewSales={() => handleHubChange("sales")}
          onViewPurchases={() => handleHubChange("purchases")}
        />
      )}

      {showList && (
      <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: t("total"), value: filteredInvoices.length, isCount: true },
          { label: t("paid"), value: Number(stats?.paidAmount ?? 0) },
          { label: t("pending"), value: Number(stats?.pendingAmount ?? 0) },
          { label: t("overdue"), value: stats?.overdueCount ?? 0, isCount: true },
          {
            label: t("pendingCollection"),
            value: stats?.pendingCollectionCount ?? 0,
            isCount: true,
            highlight: (stats?.pendingCollectionCount ?? 0) > 0,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              "glass rounded-xl p-4",
              "highlight" in s && s.highlight && "ring-1 ring-amber-500/40"
            )}
          >
            <p className="text-sm text-slate-400">{s.label}</p>
            <p
              className={cn(
                "text-xl font-bold mt-1",
                "highlight" in s && s.highlight ? "text-amber-400" : "text-white"
              )}
            >
              {s.isCount ? s.value : formatMoney(s.value as number, company?.currency || "OMR")}
            </p>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-slate-500 mb-1">{t("search")}</label>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">{t("status")}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("filterAll")}</option>
            <option value="DRAFT">{tStatus("draft")}</option>
            <option value="SENT">{tStatus("sent")}</option>
            <option value="PAID">{tStatus("paid")}</option>
            <option value="OVERDUE">{tStatus("overdue")}</option>
            <option value="CANCELLED">{tStatus("cancelled")}</option>
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">{t("paymentStatus")}</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("filterAll")}</option>
            <option value="UNPAID">{tStatus("unpaid")}</option>
            <option value="PARTIAL">{tStatus("partial")}</option>
            <option value="PAID">{tStatus("paid")}</option>
          </select>
        </div>
        {(statusFilter || paymentFilter || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setPaymentFilter("");
              setSearchQuery("");
            }}
            className="h-9 px-3 text-sm text-slate-400 hover:text-white"
          >
            {t("resetFilters")}
          </button>
        )}
        <p className="text-xs text-slate-500 ms-auto self-center">
          {t("resultsCount", { count: filteredInvoices.length })}
        </p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-white font-medium">{t("noInvoices")}</p>
            <p className="text-slate-400 text-sm mt-1">{t("createFirst")}</p>
            <button onClick={openCreate} className="mt-4 text-emerald-400 hover:underline text-sm">
              {invoiceType === "SALES" ? t("newRevenue") : t("newExpense")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("number")}</th>
                  {isDocuments && (
                    <th className="text-right p-4 font-medium">{t("type")}</th>
                  )}
                  <th className="text-right p-4 font-medium">
                    {isPurchaseList ? t("supplier") : t("customer")}
                  </th>
                  <th className="text-right p-4 font-medium">{t("date")}</th>
                  <th className="text-right p-4 font-medium">{t("amount")}</th>
                  <th className="text-right p-4 font-medium">{t("status")}</th>
                  <th className="text-right p-4 font-medium">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-white font-medium">{inv.number}</td>
                    {isDocuments && (
                      <td className="p-4">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            inv.type === "SALES"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          )}
                        >
                          {inv.type === "SALES" ? t("sales") : t("purchase")}
                        </span>
                      </td>
                    )}
                    <td className="p-4 text-slate-300">{inv.contact?.name}</td>
                    <td className="p-4 text-slate-400">{formatDate(inv.date)}</td>
                    <td className="p-4 text-white font-semibold">
                      {formatMoney(Number(inv.total), company?.currency || "OMR")}
                    </td>
                    <td className="p-4">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColor(inv.status))}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="p-4">
                      <InvoiceActions
                        status={inv.status}
                        paymentStatus={inv.paymentStatus}
                        paidAmount={Number(inv.paidAmount || 0)}
                        invoiceType={inv.type}
                        disabled={actionsBusy}
                        onView={() => openDocument(inv, "invoice")}
                        onReceipt={() => openDocument(inv, "receipt")}
                        onEdit={() => openEdit(inv)}
                        onSend={() => sendMutation.mutate(inv.id)}
                        onMarkSent={() => handleMarkSent(inv.id)}
                        onMarkPaid={() => handleMarkPaid(inv.id)}
                        onUnsend={() => handleUnsend(inv.id)}
                        onReversePayment={() => handleOpenReversePayment(inv)}
                        onCancel={() => handleCancel(inv.id)}
                        onDelete={() => handleDelete(inv.id)}
                        onConvertToInvoice={() => convertQuotationMutation.mutate(inv.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>
      )}

      {activeDocumentInvoice && (
        <InvoiceDocument
          invoice={toDocumentData(activeDocumentInvoice)}
          company={company}
          currency={company?.currency || "OMR"}
          variant={documentVariant}
          actionsDisabled={actionsBusy}
          onClose={() => {
            setPrintInvoice(null);
            setDocumentVariant("invoice");
          }}
          onSendEmail={() => sendMutation.mutate(activeDocumentInvoice.id)}
          onMarkPaid={() => handleMarkPaid(activeDocumentInvoice.id)}
          onCancel={() => handleCancel(activeDocumentInvoice.id)}
          onMarkSent={() => handleMarkSent(activeDocumentInvoice.id)}
          onUnsend={() => handleUnsend(activeDocumentInvoice.id)}
          onReversePayment={() => handleOpenReversePayment(activeDocumentInvoice)}
          onEdit={() => {
            setPrintInvoice(null);
            openEdit(activeDocumentInvoice);
          }}
          onViewReceipt={() => setDocumentVariant("receipt")}
          onViewInvoice={() => setDocumentVariant("invoice")}
        />
      )}

      <RecordPaymentModal
        open={collectOpen}
        invoices={invoices
          .filter((i) => {
            if (hubTab === "sales") return i.type === "SALES";
            if (hubTab === "purchases") return i.type === "PURCHASE";
            return true;
          })
          .map((i) => ({
          id: i.id,
          number: i.number,
          type: i.type,
          total: Number(i.total),
          paidAmount: Number(i.paidAmount || 0),
          status: i.status,
          paymentStatus: i.paymentStatus,
          date: i.date,
          dueDate: i.dueDate,
          contact: i.contact ? { id: i.contact.id, name: i.contact.name } : undefined,
        }))}
        currency={company?.currency || "OMR"}
        defaultInvoiceId={collectInvoiceId}
        onClose={() => {
          setCollectOpen(false);
          setCollectInvoiceId(undefined);
        }}
        onSuccess={handleCollectSuccess}
      />

      {reversePaymentInvoice && (
        <ReversePaymentModal
          open={!!reversePaymentInvoice}
          invoiceId={reversePaymentInvoice.id}
          invoiceNumber={reversePaymentInvoice.number}
          currency={company?.currency || "OMR"}
          onClose={() => setReversePaymentInvoice(null)}
          onSuccess={async () => {
            invalidateInvoiceQueries();
            if (printInvoice?.id === reversePaymentInvoice.id) {
              try {
                const res = await api.getInvoice(reversePaymentInvoice.id);
                const fresh = res.data as Invoice;
                setPrintInvoice(fresh);
                if (Number(fresh.paidAmount || 0) <= 0) setDocumentVariant("invoice");
              } catch {
                setDocumentVariant("invoice");
              }
            }
            setReversePaymentInvoice(null);
          }}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">
                {editingId
                  ? t("editInvoice")
                  : invoiceType === "SALES"
                    ? t("newRevenue")
                    : t("newExpense")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    {invoiceType === "SALES" ? t("customer") : t("supplier")}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      className="flex-1 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">
                        {invoiceType === "SALES" ? t("selectCustomer") : t("selectSupplier")}
                      </option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setQuickCustomerOpen(!quickCustomerOpen)}
                      className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 hover:bg-slate-700"
                      title={t("quickAddCustomer")}
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {contacts.length === 0 && !quickCustomerOpen && (
                    <p className="text-xs text-amber-400 mt-1">
                      {invoiceType === "SALES" ? t("noCustomersHint") : t("noSuppliersHint")}
                    </p>
                  )}
                  {quickCustomerOpen && (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={quickCustomerName}
                        onChange={(e) => setQuickCustomerName(e.target.value)}
                        placeholder={invoiceType === "SALES" ? t("customer") : t("supplier")}
                        className="flex-1 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => quickCustomerMutation.mutate()}
                        disabled={!quickCustomerName || quickCustomerMutation.isPending}
                        className="px-3 h-9 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {tCommon("save")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{t("date")}</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{t("dueDate")}</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">{t("items")}</label>
                  <button
                    type="button"
                    onClick={() => setLines([...lines, emptyLine()])}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    + {t("addItem")}
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder={t("description")}
                        value={line.description}
                        onChange={(e) => {
                          const n = [...lines];
                          n[idx].description = e.target.value;
                          setLines(n);
                        }}
                        className="col-span-5 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <DecimalInput
                        value={line.quantity}
                        min={0}
                        decimals={3}
                        onChange={(v) => {
                          const n = [...lines];
                          n[idx].quantity = v;
                          setLines(n);
                        }}
                        className="col-span-2 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <DecimalInput
                        value={line.unitPrice}
                        min={0}
                        decimals={3}
                        onChange={(v) => {
                          const n = [...lines];
                          n[idx].unitPrice = v;
                          setLines(n);
                        }}
                        className="col-span-2 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <DecimalInput
                        value={line.discount}
                        min={0}
                        decimals={3}
                        onChange={(v) => {
                          const n = [...lines];
                          n[idx].discount = v;
                          setLines(n);
                        }}
                        className="col-span-2 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>{t("subtotal")}</span>
                  <span className="text-white">{formatMoney(subtotal, company?.currency || "OMR")}</span>
                </div>
                {applyVat && (
                  <div className="flex justify-between text-slate-400">
                    <span>
                      {t("tax")}
                      {pricesIncludeTax ? ` — ${t("taxIncluded")}` : ""}
                      {` (${vatRate}%)`}
                    </span>
                    <span className="text-white">{formatMoney(taxAmount, company?.currency || "OMR")}</span>
                  </div>
                )}
                {!applyVat && (
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>{t("vatDisabled")}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>{t("discount")}</span>
                  <DecimalInput
                    value={discount}
                    min={0}
                    decimals={3}
                    onChange={setDiscount}
                    className="w-24 h-7 px-2 bg-slate-700 border border-slate-600 rounded text-white text-right"
                  />
                </div>
                <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2">
                  <span>{t("grandTotal")}</span>
                  <span>{formatMoney(grandTotal, company?.currency || "OMR")}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!contactId) {
                    toast.error(t("needCustomer"));
                    return;
                  }
                  if (!lines.some((l) => l.description.trim())) {
                    toast.error(t("needItems"));
                    return;
                  }
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
