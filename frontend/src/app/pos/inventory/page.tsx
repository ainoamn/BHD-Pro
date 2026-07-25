"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Plus, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { formatMoney } from "@/lib/utils";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { DecimalInput } from "@/components/ui/decimal-input";

type PosProductRow = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  category: string;
  unit: string;
  quantity: number | string;
  minQuantity?: number | string;
  costPrice: number | string;
  salePrice: number | string;
  isTracked?: boolean;
};

const emptyForm = () => ({
  sku: "",
  barcode: "",
  name: "",
  category: "",
  unit: "pcs",
  quantity: 0,
  minQuantity: 5,
  costPrice: 0,
  salePrice: 0,
});

export default function PosInventoryPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const currency = useAuthStore((s) => s.company?.currency) || "OMR";
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [codesLoading, setCodesLoading] = useState(false);

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["pos-inventory-products"],
    queryFn: async () => {
      const res = await api.getProducts();
      return (res.data as PosProductRow[]) || [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set);
  }, [products]);

  const units = useMemo(() => {
    const base = ["pcs", "kg", "g", "L", "ml", "m", "box", "pack"];
    const set = new Set([...base, ...products.map((p) => p.unit).filter(Boolean)]);
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term) ||
        (p.category || "").toLowerCase().includes(term),
    );
  }, [products, q]);

  const fillCodes = async () => {
    setCodesLoading(true);
    try {
      const res = await api.getNextProductCodes();
      setForm((prev) => ({
        ...prev,
        sku: res.data.sku,
        barcode: res.data.barcode,
      }));
    } catch {
      toast.error(t.codesLoadError);
    } finally {
      setCodesLoading(false);
    }
  };

  const openCreate = async () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
    await fillCodes();
  };

  const openEdit = (p: PosProductRow) => {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      category: p.category || "",
      unit: p.unit || "pcs",
      quantity: Number(p.quantity),
      minQuantity: Number(p.minQuantity ?? 5),
      costPrice: Number(p.costPrice),
      salePrice: Number(p.salePrice),
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sku: form.sku.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim() || "pcs",
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 0,
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0,
      };
      if (editingId) {
        return api.updateProduct(editingId, {
          ...payload,
          sku: form.sku.trim() || undefined,
          barcode: form.barcode.trim() || null,
        });
      }
      return api.createProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-inventory-products"] });
      toast.success(t.productSaved);
      setModalOpen(false);
    },
    onError: () => toast.error(t.productSaveFail),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim()) {
      toast.error(t.productNeedNameCat);
      return;
    }
    saveMutation.mutate();
  };

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            {t.posInventoryTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t.posInventorySub}</p>
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
            onClick={() => void openCreate()}
            className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-400 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t.addProduct}
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.searchPlaceholder}
        className="w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 text-sm"
      />

      {isLoading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-slate-400 text-sm">
          {t.emptyCatalog}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400 text-xs">
              <tr>
                <th className="text-start p-3 font-medium">{t.productCol}</th>
                <th className="text-start p-3 font-medium hidden sm:table-cell">{t.category}</th>
                <th className="text-end p-3 font-medium">{t.stock}</th>
                <th className="text-end p-3 font-medium">{t.price}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-3">
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </p>
                  </td>
                  <td className="p-3 text-slate-400 hidden sm:table-cell">{p.category || "—"}</td>
                  <td className="p-3 text-end tabular-nums">
                    {Number(p.quantity)} {p.unit}
                  </td>
                  <td className="p-3 text-end tabular-nums text-emerald-300">
                    {formatMoney(Number(p.salePrice), currency)}
                  </td>
                  <td className="p-3 text-end">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
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
              <h2 className="font-bold">{editingId ? t.editProduct : t.addProduct}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.sku}</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    disabled={!!editingId}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-2 font-mono text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.barcode}</label>
                  <div className="flex gap-2">
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-2 font-mono text-sm"
                    />
                    {!editingId && (
                      <button
                        type="button"
                        disabled={codesLoading}
                        onClick={() => void fillCodes()}
                        className="h-10 w-10 shrink-0 rounded-lg border border-white/10 flex items-center justify-center"
                      >
                        {codesLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.productName}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.category}</label>
                  <CreatableSelect
                    value={form.category}
                    onChange={(category) => setForm({ ...form, category })}
                    options={categories}
                    placeholder={t.category}
                    addLabel={(name) => t.addCategoryNamed.replace("{name}", name)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.unit}</label>
                  <CreatableSelect
                    value={form.unit}
                    onChange={(unit) => setForm({ ...form, unit })}
                    options={units}
                    placeholder="pcs"
                    addLabel={(name) => t.addUnitNamed.replace("{name}", name)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.costPrice}</label>
                  <DecimalInput
                    value={form.costPrice}
                    min={0}
                    decimals={3}
                    onChange={(costPrice) => setForm({ ...form, costPrice })}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">{t.salePrice}</label>
                  <DecimalInput
                    value={form.salePrice}
                    min={0}
                    decimals={3}
                    onChange={(salePrice) => setForm({ ...form, salePrice })}
                    className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                  />
                </div>
              </div>
              {!editingId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t.qty}</label>
                    <input
                      type="number"
                      min={0}
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t.minQty}</label>
                    <input
                      type="number"
                      min={0}
                      value={form.minQuantity}
                      onChange={(e) =>
                        setForm({ ...form, minQuantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 text-slate-400">
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="h-10 px-4 rounded-xl bg-emerald-500 font-bold text-white disabled:opacity-50 inline-flex items-center gap-2"
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
