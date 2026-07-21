"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Users,
  Trash2,
  Edit,
  X,
  Loader2,
  Search,
  LayoutGrid,
  List,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import {
  PHONE_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  splitPhone,
  combinePhone,
  formatPhoneDisplay,
  buildContactWhatsAppLink,
  formatPhoneForWhatsApp,
} from "@/lib/phone";
import { useAuthStore } from "@/store/auth";
import { PageHeader, EmptyState, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import {
  CustomFieldsInputs,
  type CustomFieldDef,
} from "@/components/custom-fields/custom-fields-inputs";

type TabType = "CUSTOMER" | "SUPPLIER";
type ViewMode = "table" | "cards";

interface ContactRow {
  id: string;
  type: string;
  name: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: string;
  city?: string;
  customFieldsJson?: Record<string, string | number>;
  outstandingBalance?: number;
  receivableBalance?: number;
  payableBalance?: number;
}

const emptyContact = (type: TabType) => ({
  type,
  name: "",
  nameEn: "",
  email: "",
  phone: "",
  phoneDialCode: DEFAULT_DIAL_CODE,
  phoneLocal: "",
  taxId: "",
  address: "",
  city: "",
  customFields: {} as Record<string, string | number>,
});

type ContactForm = ReturnType<typeof emptyContact>;

function contactToForm(contact: ContactRow, tab: TabType): ContactForm {
  const { dialCode, local } = splitPhone(contact.phone);
  return {
    type: tab,
    name: contact.name,
    nameEn: contact.nameEn || "",
    email: contact.email || "",
    phone: contact.phone || "",
    phoneDialCode: dialCode,
    phoneLocal: local,
    taxId: contact.taxId || "",
    address: contact.address || "",
    city: contact.city || "",
    customFields: (contact.customFieldsJson as Record<string, string | number>) || {},
  };
}

function formToPayload(form: ContactForm) {
  const phone = combinePhone(form.phoneDialCode, form.phoneLocal);
  const payload: Record<string, unknown> = {
    type: form.type,
    name: form.name.trim(),
  };
  if (form.nameEn?.trim()) payload.nameEn = form.nameEn.trim();
  if (form.email?.trim()) payload.email = form.email.trim();
  if (phone) payload.phone = phone;
  if (form.taxId?.trim()) payload.taxId = form.taxId.trim();
  if (form.address?.trim()) payload.address = form.address.trim();
  if (form.city?.trim()) payload.city = form.city.trim();
  if (form.customFields && Object.keys(form.customFields).length > 0) {
    payload.customFieldsJson = form.customFields;
  }
  return payload;
}

function openWhatsApp(contact: ContactRow, t: (key: string) => string) {
  const wa = formatPhoneForWhatsApp(contact.phone);
  if (!wa) {
    toast.error(t("whatsappNeedPhone"));
    return;
  }
  window.open(buildContactWhatsAppLink(contact.phone, contact.name), "_blank");
}

function ContactsContent() {
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { company } = useAuthStore();

  const [tab, setTab] = useState<TabType>("CUSTOMER");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContact("CUSTOMER"));

  useEffect(() => {
    const action = searchParams.get("action");
    const type = searchParams.get("type") as TabType | null;
    if (type === "CUSTOMER" || type === "SUPPLIER") setTab(type);
    if (action === "new") {
      setForm(emptyContact(type === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER"));
      setModalOpen(true);
    }
  }, [searchParams]);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", tab],
    queryFn: async () => {
      const res = await api.getContacts(tab);
      return res.data as ContactRow[];
    },
  });

  const { data: contactFields = [] } = useQuery({
    queryKey: ["custom-fields", "CONTACT"],
    queryFn: async () => {
      const res = await api.getCustomFields("CONTACT");
      return res.data as CustomFieldDef[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyContact(tab));
  };

  const openCreate = () => {
    resetForm();
    setForm(emptyContact(tab));
    setModalOpen(true);
  };

  const openEdit = (contact: ContactRow) => {
    setEditingId(contact.id);
    setForm(contactToForm(contact, tab));
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      if (editingId) return api.updateContact(editingId, payload);
      return api.createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("saved"));
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const apiMsg = axiosErr?.response?.data?.message;
      const detail = Array.isArray(apiMsg) ? apiMsg.join(" — ") : apiMsg;
      toast.error(detail || t("saveError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("deleted"));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            {tab === "CUSTOMER" ? t("newCustomer") : t("newSupplier")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["CUSTOMER", "SUPPLIER"] as TabType[]).map((type) => (
            <button
              key={type}
              onClick={() => setTab(type)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === type
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              {type === "CUSTOMER" ? t("customers") : t("suppliers")}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full h-10 pr-10 pl-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("cards")}
            className={cn(
              "p-2 rounded-md",
              viewMode === "cards" ? "bg-emerald-600 text-white" : "text-slate-400"
            )}
            title={t("viewCards")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "p-2 rounded-md",
              viewMode === "table" ? "bg-emerald-600 text-white" : "text-slate-400"
            )}
            title={t("viewTable")}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-400">
        {t("totalContacts")}: <span className="text-white font-medium">{filtered.length}</span>
      </div>

      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? t("noResults") : tab === "CUSTOMER" ? t("noCustomers") : t("noSuppliers")}
            description={search ? undefined : t("createFirst")}
            action={
              !search ? (
                <button onClick={openCreate} className="text-emerald-400 hover:underline text-sm">
                  {tab === "CUSTOMER" ? t("newCustomer") : t("newSupplier")}
                </button>
              ) : undefined
            }
          />
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{contact.name}</h3>
                    {contact.city && (
                      <p className="text-xs text-slate-500 mt-0.5">{contact.city}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {contact.phone && formatPhoneForWhatsApp(contact.phone) && (
                      <button
                        onClick={() => openWhatsApp(contact, t)}
                        className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-400"
                        title={t("sendWhatsApp")}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEdit(contact)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(t("deleteConfirm"))) deleteMutation.mutate(contact.id); }}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      {formatPhoneDisplay(contact.phone)}
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      {contact.email}
                    </div>
                  )}
                  {contact.address && (
                    <div className="flex items-start gap-2 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <span className="text-xs">{contact.address}</span>
                    </div>
                  )}
                </div>

                {((contact.receivableBalance ?? 0) > 0 ||
                  (contact.payableBalance ?? 0) > 0) && (
                  <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 text-sm">
                    {(contact.receivableBalance ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t("receivable")}</span>
                        <span className="text-emerald-400 font-medium">
                          {formatMoney(contact.receivableBalance || 0, company?.currency || "OMR")}
                        </span>
                      </div>
                    )}
                    {(contact.payableBalance ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t("payable")}</span>
                        <span className="text-rose-400 font-medium">
                          {formatMoney(contact.payableBalance || 0, company?.currency || "OMR")}
                        </span>
                      </div>
                    )}
                    {(contact.outstandingBalance ?? 0) !== 0 && (
                      <div className="flex justify-between pt-1 border-t border-slate-700/50">
                        <span className="text-slate-400">{t("netBalance")}</span>
                        <span
                          className={cn(
                            "font-medium",
                            (contact.outstandingBalance || 0) > 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          )}
                        >
                          {formatMoney(contact.outstandingBalance || 0, company?.currency || "OMR")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("name")}</th>
                  <th className="text-right p-4 font-medium">{t("phone")}</th>
                  <th className="text-right p-4 font-medium">{t("email")}</th>
                  <th className="text-right p-4 font-medium">{t("address")}</th>
                  <th className="text-right p-4 font-medium">{t("city")}</th>
                  <th className="text-right p-4 font-medium">{t("balance")}</th>
                  <th className="text-right p-4 font-medium">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr key={contact.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-white font-medium">{contact.name}</td>
                    <td className="p-4 text-slate-300">
                      {contact.phone ? formatPhoneDisplay(contact.phone) : "—"}
                    </td>
                    <td className="p-4 text-slate-300">{contact.email || "—"}</td>
                    <td className="p-4 text-slate-400 text-xs max-w-[160px] truncate">{contact.address || "—"}</td>
                    <td className="p-4 text-slate-300">{contact.city || "—"}</td>
                    <td className="p-4">
                      <div className="space-y-0.5 text-xs">
                        {(contact.receivableBalance ?? 0) > 0 && (
                          <div className="text-emerald-400">
                            {t("receivable")}: {formatMoney(contact.receivableBalance || 0, company?.currency || "OMR")}
                          </div>
                        )}
                        {(contact.payableBalance ?? 0) > 0 && (
                          <div className="text-rose-400">
                            {t("payable")}: {formatMoney(contact.payableBalance || 0, company?.currency || "OMR")}
                          </div>
                        )}
                        {(contact.receivableBalance ?? 0) === 0 &&
                          (contact.payableBalance ?? 0) === 0 && (
                            <span className="text-slate-500">—</span>
                          )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {contact.phone && formatPhoneForWhatsApp(contact.phone) && (
                          <button
                            onClick={() => openWhatsApp(contact, t)}
                            className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-400"
                            title={t("sendWhatsApp")}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEdit(contact)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t("deleteConfirm"))) deleteMutation.mutate(contact.id); }}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">
                {editingId
                  ? t("editContact")
                  : tab === "CUSTOMER"
                    ? t("newCustomer")
                    : t("newSupplier")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("phone")}</label>
                <div className="flex gap-2">
                  <select
                    value={form.phoneDialCode}
                    onChange={(e) => setForm({ ...form, phoneDialCode: e.target.value })}
                    className="w-full sm:w-44 shrink-0 h-10 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    title={t("phoneCountryCode")}
                  >
                    {PHONE_DIAL_CODES.map((dc) => (
                      <option key={dc.code} value={dc.code}>
                        {dc.labelAr}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phoneLocal}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                      setForm({ ...form, phoneLocal: v });
                    }}
                    placeholder={t("phoneLocalPlaceholder")}
                    className="flex-1 h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t("phoneHint")}</p>
                {form.phoneLocal && (
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    {t("phonePreview")}: {combinePhone(form.phoneDialCode, form.phoneLocal)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("email")}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("city")}</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("taxId")}</label>
                <input
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("address")}</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <CustomFieldsInputs
                fields={contactFields}
                values={form.customFields}
                onChange={(customFields) => setForm({ ...form, customFields })}
              />
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || saveMutation.isPending}
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

export default function ContactsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ContactsContent />
    </Suspense>
  );
}
