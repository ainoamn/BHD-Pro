"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Soup, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { restoCopy } from "@/lib/resto-copy";

type MenuProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  sku: string;
  isTracked?: boolean;
  hasRecipe?: boolean;
};

type Ingredient = {
  id: string;
  name: string;
  nameEn: string | null;
  sku: string;
  unit: string;
};

type RecipeRow = {
  id: string;
  productId: string;
  notes: string | null;
  deductsIngredients: boolean;
  warningTracked: string | null;
  product: {
    id: string;
    name: string;
    nameEn: string | null;
    sku: string;
    isTracked: boolean;
  };
  items: Array<{
    id: string;
    componentProductId: string;
    qty: string | number;
    component: {
      id: string;
      name: string;
      nameEn: string | null;
      sku: string;
      unit: string;
    };
  }>;
};

export default function RestoRecipesPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";

  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [menu, setMenu] = useState<MenuProduct[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Array<{ componentProductId: string; qty: string }>>([
    { componentProductId: "", qty: "1" },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [rec, menuRes, productsRes] = await Promise.all([
        api.getRestoRecipes(),
        api.getRestoMenu(),
        api.getProducts(),
      ]);
      setRecipes(rec.data.recipes || []);
      setMenu(menuRes.data.items || []);
      const raw = Array.isArray(productsRes.data)
        ? productsRes.data
        : (productsRes.data as { items?: Ingredient[] })?.items || [];
      setIngredients(
        (raw as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          name: String(p.name || ""),
          nameEn: (p.nameEn as string | null) || null,
          sku: String(p.sku || ""),
          unit: String(p.unit || "piece"),
        })),
      );
    } catch {
      setRecipes([]);
      setLoadError(true);
      toast.error(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedDish = useMemo(
    () => menu.find((m) => m.id === productId),
    [menu, productId],
  );

  const onPickDish = (id: string) => {
    setProductId(id);
    const existing = recipes.find((r) => r.productId === id);
    if (existing) {
      setNotes(existing.notes || "");
      setLines(
        existing.items.map((i) => ({
          componentProductId: i.componentProductId,
          qty: String(Number(i.qty)),
        })),
      );
    } else {
      setNotes("");
      setLines([{ componentProductId: "", qty: "1" }]);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId || !canManage) return;
    const items = lines
      .filter((l) => l.componentProductId && Number(l.qty) > 0)
      .map((l) => ({
        componentProductId: l.componentProductId,
        qty: Number(l.qty),
      }));
    if (items.length === 0) return;
    setBusy(true);
    try {
      await api.upsertRestoRecipe(productId, {
        notes: notes.trim() || undefined,
        items,
      });
      toast.success(t.recipeSaved);
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm(t.deleteRecipe + "?")) return;
    setBusy(true);
    try {
      await api.deleteRestoRecipe(id);
      toast.success(t.recipeDeleted);
      if (productId === id) {
        setProductId("");
        setLines([{ componentProductId: "", qty: "1" }]);
        setNotes("");
      }
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const labelOf = (p: { name: string; nameEn: string | null; sku: string }) =>
    `${locale === "en" && p.nameEn ? p.nameEn : p.name} (${p.sku})`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Soup className="w-6 h-6 text-amber-400" />
          {t.recipesTitle}
        </h1>
        <p className="text-sm text-stone-400 mt-1">{t.recipesSub}</p>
      </div>

      {canManage ? (
        <form
          onSubmit={onSave}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
        >
          <label className="block space-y-1">
            <span className="text-xs text-stone-400">{t.recipeDish}</span>
            <select
              required
              value={productId}
              onChange={(e) => onPickDish(e.target.value)}
              className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
            >
              <option value="">{t.recipeDish}…</option>
              {menu.map((m) => (
                <option key={m.id} value={m.id}>
                  {labelOf(m)}
                  {m.hasRecipe ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedDish ? (
            <p
              className={`text-xs ${
                selectedDish.isTracked === false
                  ? "text-emerald-300"
                  : "text-amber-200"
              }`}
            >
              {selectedDish.isTracked === false
                ? t.recipeUntrackedOk
                : t.recipeTrackedWarn}
            </p>
          ) : null}

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid sm:grid-cols-[1fr_120px_auto] gap-2">
                <select
                  required
                  value={line.componentProductId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? { ...l, componentProductId: e.target.value }
                          : l,
                      ),
                    )
                  }
                  className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
                >
                  <option value="">{t.recipeComponent}…</option>
                  {ingredients
                    .filter((ing) => ing.id !== productId)
                    .map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {labelOf(ing)}
                      </option>
                    ))}
                </select>
                <input
                  required
                  type="number"
                  min={0.001}
                  step="0.001"
                  value={line.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, qty: e.target.value } : l,
                      ),
                    )
                  }
                  placeholder={t.recipeQty}
                  className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length <= 1
                        ? prev
                        : prev.filter((_, i) => i !== idx),
                    )
                  }
                  className="h-10 px-3 rounded-xl border border-white/15 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { componentProductId: "", qty: "1" },
                ])
              }
              className="text-xs font-semibold text-amber-300"
            >
              + {t.addComponent}
            </button>
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notes}
            className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />

          <button
            type="submit"
            disabled={busy || !productId}
            className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
          >
            {t.saveRecipe}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : recipes.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-12">{t.recipesEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {locale === "en" && r.product.nameEn
                      ? r.product.nameEn
                      : r.product.name}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {r.deductsIngredients
                      ? t.recipeUntrackedOk
                      : t.recipeTrackedWarn}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDelete(r.productId)}
                    className="rounded-lg border border-rose-500/40 text-rose-200 p-2"
                    title={t.deleteRecipe}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
              <ul className="text-sm text-stone-300 space-y-1">
                {r.items.map((i) => (
                  <li key={i.id}>
                    {Number(i.qty)} ×{" "}
                    {locale === "en" && i.component.nameEn
                      ? i.component.nameEn
                      : i.component.name}{" "}
                    <span className="text-stone-500">({i.component.unit})</span>
                  </li>
                ))}
              </ul>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => onPickDish(r.productId)}
                  className="text-xs font-semibold text-amber-300"
                >
                  {t.saveRecipe}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
