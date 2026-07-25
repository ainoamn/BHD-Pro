"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import {
  DEFAULT_DIAL_CODE,
  PHONE_DIAL_CODES,
  combinePhone,
  formatPhoneDisplay,
  splitPhone,
} from "@/lib/phone";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type ContactRow = {
  id: string;
  type: string;
  name: string;
  nameEn?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  currentBalance?: number | string | null;
  storeCreditBalance?: number | string | null;
};

const emptyForm = () => ({
  name: "",
  nameEn: "",
  phoneDialCode: DEFAULT_DIAL_CODE,
  phoneLocal: "",
  email: "",
  address: "",
  city: "",
});

export default function PosContactsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const currency = useAuthStore((s) => s.company?.currency) || "OMR";
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["pos-contacts"],
    queryFn: async () => {
      const res = await api.getContacts("CUSTOMER");
      return (res.data as ContactRow[]) || [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => {
      const phone = (c.phone || "").toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.nameEn || "").toLowerCase().includes(term) ||
        phone.includes(term) ||
        (c.email || "").toLowerCase().includes(term)
      );
    });
  }, [contacts, q]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (c: ContactRow) => {
    const { dialCode, local } = splitPhone(c.phone);
    setEditingId(c.id);
    setForm({
      name: c.name,
      nameEn: c.nameEn || "",
      phoneDialCode: dialCode,
      phoneLocal: local,
      email: c.email || "",
      address: c.address || "",
      city: c.city || "",
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const phone = combinePhone(form.phoneDialCode, form.phoneLocal);
      const payload = {
        type: "CUSTOMER" as const,
        name: form.name.trim(),
        ...(form.nameEn.trim() ? { nameEn: form.nameEn.trim() } : {}),
        ...(phone ? { phone } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
        ...(form.city.trim() ? { city: form.city.trim() } : {}),
      };
      if (editingId) return api.updateContact(editingId, payload);
      return api.createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-contacts"] });
      toast.success(t.contactSaved);
      setModalOpen(false);
    },
    onError: () => toast.error(t.contactSaveFail),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t.contactNeedName);
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            {t.posContactsTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t.posContactsSub}</p>
          <p className="text-xs text-emerald-300/80 mt-1">{t.sharedRecordsNote}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pos"
            className="h-10 px-3 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center"
          >
            {t.openPos}
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="h-10 px-4 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-400 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t.addContact}
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.contactSearch}
        className="w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 text-sm"
      />

      {isLoading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-slate-400 text-sm">
          {t.noContacts}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400 text-xs">
              <tr>
                <th className="text-start p-3 font-medium">{t.contactName}</th>
                <th className="text-start p-3 font-medium hidden sm:table-cell">{t.phone}</th>
                <th className="text-end p-3 font-medium">{t.storeCredit}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-3">
                    <p className="font-semibold text-white">{c.name}</p>
                    {c.nameEn ? (
                      <p className="text-[11px] text-slate-500">{c.nameEn}</p>
                    ) : null}
                    {c.address || c.city ? (
                      <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                        {[c.address, c.city].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 text-slate-300 hidden sm:table-cell font-mono text-xs">
                    {formatPhoneDisplay(c.phone) || "—"}
                  </td>
                  <td className="p-3 text-end tabular-nums text-amber-200">
                    {formatMoney(
                      Number(c.storeCreditBalance ?? c.currentBalance ?? 0),
                      currency,
                    )}
                  </td>
                  <td className="p-3 text-end">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-xs text-sky-300 hover:underline"
                    >
                      {t.edit}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/60 p-4 overflow-y-auto">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold">{editingId ? t.editContact : t.addContact}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.contactNameAr}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.contactNameEn}</label>
                <input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.phone}</label>
                <div className="flex gap-2">
                  <select
                    value={form.phoneDialCode}
                    onChange={(e) => setForm({ ...form, phoneDialCode: e.target.value })}
                    className="h-10 rounded-lg bg-black/30 border border-white/10 px-2 text-sm w-[7.5rem]"
                  >
                    {PHONE_DIAL_CODES.map((d) => (
                      <option key={d.code} value={d.code}>
                        +{d.code}
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.phoneLocal}
                    onChange={(e) => setForm({ ...form, phoneLocal: e.target.value })}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                    inputMode="tel"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.email}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.address}</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.city}</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 text-slate-400">
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-10 px-4 rounded-xl bg-sky-500 font-bold text-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
