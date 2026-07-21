"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Trash2, Edit, X, Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, EmptyState, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Product } from "@/types";

interface ProductStats {
  total: number;
  lowStock: number;
  totalValue: number;
  lowStockItems: Product[];
}

const emptyProduct = () => ({
  sku: "",
  name: "",
  nameEn: "",
  category: "",
  costPrice: 0,
  salePrice: 0,
  quantity: 0,
  minQuantity: 5,
  unit: "pcs",
  description: "",
});

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct());

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.getProducts();
      return res.data as Product[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["product-stats"],
    queryFn: async () => {
      const res = await api.getProductStats();
      return res.data as ProductStats;
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyProduct());
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      name: product.name,
      nameEn: product.nameEn || "",
      category: product.category,
      costPrice: Number(product.costPrice),
      salePrice: Number(product.salePrice),
      quantity: Number(product.quantity),
      minQuantity: Number(product.minQuantity),
      unit: product.unit,
      description: product.description || "",
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingId) return api.updateProduct(editingId, form);
      return api.createProduct(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stats"] });
      toast.success(t("saved"));
      setModalOpen(false);
      resetForm();
    },
    onError: () => toast.error(t("saveError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stats"] });
      toast.success(t("deleted"));
    },
  });

  const isLowStock = (p: Product) =>
    Number(p.quantity) <= Number(p.minQuantity);

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
            {t("newProduct")}
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("totalProducts"), value: stats?.total ?? 0, isCount: true },
          { label: t("lowStock"), value: stats?.lowStock ?? 0, isCount: true, alert: true },
          { label: t("totalValue"), value: Number(stats?.totalValue ?? 0) },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <p className="text-sm text-slate-400 flex items-center gap-1">
              {s.alert && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              {s.label}
            </p>
            <p className={cn("text-xl font-bold mt-1", s.alert && (s.value as number) > 0 ? "text-amber-400" : "text-white")}>
              {s.isCount ? s.value : formatMoney(s.value as number, currency)}
            </p>
          </div>
        ))}
      </div>

      {stats && stats.lowStockItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-amber-400 font-medium">{t("lowStockAlert")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.lowStockItems.map((item) => (
              <span key={item.id} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
                {item.name} ({item.quantity}/{item.minQuantity})
              </span>
            ))}
          </div>
        </div>
      )}

      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("noProducts")}
            description={t("createFirst")}
            action={
              <button onClick={openCreate} className="text-emerald-400 hover:underline text-sm">
                {t("newProduct")}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("sku")}</th>
                  <th className="text-right p-4 font-medium">{t("name")}</th>
                  <th className="text-right p-4 font-medium">{t("category")}</th>
                  <th className="text-right p-4 font-medium">{t("quantity")}</th>
                  <th className="text-right p-4 font-medium">{t("costPrice")}</th>
                  <th className="text-right p-4 font-medium">{t("salePrice")}</th>
                  <th className="text-right p-4 font-medium">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.filter((p) => p.isActive !== false).map((product) => (
                  <tr key={product.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-slate-400 font-mono text-xs">{product.sku}</td>
                    <td className="p-4 text-white font-medium">
                      <span className="flex items-center gap-2">
                        {product.name}
                        {isLowStock(product) && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{product.category}</td>
                    <td className={cn("p-4", isLowStock(product) ? "text-amber-400" : "text-white")}>
                      {product.quantity} {product.unit}
                    </td>
                    <td className="p-4 text-slate-300">{formatMoney(Number(product.costPrice), currency)}</td>
                    <td className="p-4 text-white">{formatMoney(Number(product.salePrice), currency)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t("deleteConfirm"))) deleteMutation.mutate(product.id); }}
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
                {editingId ? t("editProduct") : t("newProduct")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("sku")}</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    disabled={!!editingId}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("category")}</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("costPrice")}</label>
                  <DecimalInput
                    value={form.costPrice}
                    min={0}
                    decimals={3}
                    onChange={(v) => setForm({ ...form, costPrice: v })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("salePrice")}</label>
                  <DecimalInput
                    value={form.salePrice}
                    min={0}
                    decimals={3}
                    onChange={(v) => setForm({ ...form, salePrice: v })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("quantity")}</label>
                  <input
                    type="number"
                    value={form.quantity}
                    min={0}
                    onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("minQuantity")}</label>
                  <input
                    type="number"
                    value={form.minQuantity}
                    min={0}
                    onChange={(e) => setForm({ ...form, minQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("unit")}</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.sku || !form.name || !form.category || saveMutation.isPending}
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
