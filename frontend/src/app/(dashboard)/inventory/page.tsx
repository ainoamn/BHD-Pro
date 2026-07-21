"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Package,
  Trash2,
  Edit,
  X,
  Loader2,
  AlertTriangle,
  ArrowLeftRight,
  Warehouse,
  ClipboardList,
} from "lucide-react";
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

type AdjustMode = "IN" | "OUT" | "SET";

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
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("IN");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustRef, setAdjustRef] = useState("");
  const [adjustWarehouseId, setAdjustWarehouseId] = useState("");

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await api.getWarehouses();
      return res.data as { id: string; code: string; name: string }[];
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

  const openAdjust = (product: Product) => {
    setAdjustProduct(product);
    setAdjustMode("IN");
    setAdjustQty(0);
    setAdjustNotes("");
    setAdjustRef("");
    setAdjustWarehouseId(
      (product as Product & { warehouseId?: string }).warehouseId || ""
    );
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

  const adjustMutation = useMutation({
    mutationFn: () =>
      api.adjustProductStock(adjustProduct!.id, {
        mode: adjustMode,
        quantity: Number(adjustQty),
        warehouseId: adjustWarehouseId || undefined,
        notes: adjustNotes.trim() || undefined,
        reference: adjustRef.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stats"] });
      toast.success(t("adjusted"));
      setAdjustProduct(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/stock-counts"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700"
            >
              <ClipboardList className="w-4 h-4" />
              {t("stockCountsLink")}
            </Link>
            <Link
              href="/warehouses"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700"
            >
              <Warehouse className="w-4 h-4" />
              {t("warehousesLink")}
            </Link>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              {t("newProduct")}
            </button>
          </div>
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
          <>
            <div className="md:hidden p-3 space-y-3">
              {products
                .filter((p) => p.isActive !== false)
                .map((product) => (
                  <div
                    key={product.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold flex items-center gap-2">
                          {product.name}
                          {isLowStock(product) && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-medium shrink-0",
                          isLowStock(product) ? "text-amber-400" : "text-white"
                        )}
                      >
                        {product.quantity} {product.unit}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{product.category || "—"}</span>
                      <span className="text-emerald-400">
                        {formatMoney(Number(product.salePrice), currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAdjust(product)}
                        className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      >
                        {t("adjust")}
                      </button>
                      <button
                        onClick={() => openEdit(product)}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t("deleteConfirm"))) deleteMutation.mutate(product.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                  {products
                    .filter((p) => p.isActive !== false)
                    .map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30"
                      >
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
                        <td
                          className={cn(
                            "p-4",
                            isLowStock(product) ? "text-amber-400" : "text-white"
                          )}
                        >
                          {product.quantity} {product.unit}
                        </td>
                        <td className="p-4 text-slate-300">
                          {formatMoney(Number(product.costPrice), currency)}
                        </td>
                        <td className="p-4 text-white">
                          {formatMoney(Number(product.salePrice), currency)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openAdjust(product)}
                              className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                            >
                              {t("adjust")}
                            </button>
                            <button
                              onClick={() => openEdit(product)}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t("deleteConfirm"))) deleteMutation.mutate(product.id);
                              }}
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
          </>
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

      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-amber-400" />
                  {t("adjustStock")}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {adjustProduct.name} — {t("currentQty")}: {Number(adjustProduct.quantity)}{" "}
                  {adjustProduct.unit}
                </p>
              </div>
              <button onClick={() => setAdjustProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("adjustMode")}</label>
                <select
                  value={adjustMode}
                  onChange={(e) => setAdjustMode(e.target.value as AdjustMode)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="IN">{t("modeIn")}</option>
                  <option value="OUT">{t("modeOut")}</option>
                  <option value="SET">{t("modeSet")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("adjustQty")}</label>
                <DecimalInput
                  value={adjustQty}
                  min={0}
                  decimals={3}
                  onChange={setAdjustQty}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              {warehouses.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("warehouse")}</label>
                  <select
                    value={adjustWarehouseId}
                    onChange={(e) => setAdjustWarehouseId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">—</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("reference")}</label>
                <input
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("notes")}</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button
                onClick={() => setAdjustProduct(null)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending || (adjustMode !== "SET" && adjustQty <= 0)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
              >
                {adjustMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("adjust")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
