"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { posCopy } from "@/lib/pos-copy";
import { formatMoney } from "@/lib/utils";

type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  quantity: number | string;
  isTracked: boolean;
};

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  isTracked: boolean;
};

export default function PosCheckoutPage() {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paying, setPaying] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ number?: string; total?: number } | null>(null);

  const currency = company?.currency || "OMR";
  const taxRate = 5;

  const loadCatalog = useCallback(async (q?: string) => {
    try {
      const res = await api.searchPosProducts(q);
      setCatalog((res.data as PosProduct[]) || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    scanRef.current?.focus();
  }, [loadCatalog]);

  useEffect(() => {
    const id = window.setTimeout(() => loadCatalog(search), 220);
    return () => window.clearTimeout(id);
  }, [search, loadCatalog]);

  const addProduct = useCallback((p: PosProduct, qty = 1) => {
    const unitPrice = Number(p.salePrice);
    const stock = Number(p.quantity);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (p.isTracked && nextQty > stock) {
          toast.error(`${t.stock}: ${stock}`);
          return prev;
        }
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: nextQty } : l));
      }
      if (p.isTracked && qty > stock) {
        toast.error(`${t.stock}: ${stock}`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice,
          quantity: qty,
          stock,
          isTracked: p.isTracked,
        },
      ];
    });
  }, [t.stock]);

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    try {
      const res = await api.lookupPosProduct(code);
      addProduct(res.data as PosProduct, 1);
      setScan("");
      scanRef.current?.focus();
    } catch {
      toast.error(t.notFound);
      setScan("");
      scanRef.current?.focus();
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart],
  );
  const tax = useMemo(() => Number(((subtotal * taxRate) / 100).toFixed(3)), [subtotal]);
  const total = useMemo(() => Number((subtotal + tax).toFixed(3)), [subtotal, tax]);

  const checkout = async (method: "CASH" | "CREDIT_CARD") => {
    if (!cart.length || paying) return;
    setPaying(true);
    try {
      const res = await api.createPosSale({
        paymentMethod: method,
        taxRate,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      const inv = res.data as { number?: string; total?: number | string };
      setLastInvoice({ number: inv.number, total: Number(inv.total) });
      setCart([]);
      toast.success(t.saleOk);
      loadCatalog(search);
      scanRef.current?.focus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setPaying(false);
    }
  };

  const printReceipt = () => {
    if (!lastInvoice) return;
    const w = window.open("", "_blank", "width=360,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl"><head><title>Receipt</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:16px;width:280px;margin:0 auto}
        h1{font-size:16px;margin:0 0 8px} p{margin:4px 0;font-size:13px}
        hr{border:none;border-top:1px dashed #999;margin:12px 0}
      </style></head><body>
      <h1>${t.brand}</h1>
      <p>${company?.name || ""}</p>
      <hr/>
      <p>${lastInvoice.number || ""}</p>
      <p><strong>${t.total}: ${formatMoney(lastInvoice.total || 0, currency)}</strong></p>
      <hr/><p style="text-align:center">Hisaby POS</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-3 sm:p-4 min-h-[calc(100vh-3.5rem)]">
      <section className="lg:col-span-7 xl:col-span-8 space-y-3">
        <form onSubmit={handleScan} className="flex gap-2">
          <input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder={t.scanPlaceholder}
            className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 px-4 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/20"
            autoComplete="off"
          />
          <button
            type="submit"
            className="h-14 px-5 rounded-2xl bg-sky-500 text-white font-bold hover:bg-sky-400 transition"
          >
            Enter
          </button>
        </form>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[62vh] overflow-y-auto pe-1">
          {catalog.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="text-start rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-sky-500/10 hover:border-sky-400/40 p-3 transition"
            >
              <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
              <p className="text-[11px] text-slate-500 mt-1">{p.sku}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sky-300 font-bold text-sm">
                  {formatMoney(Number(p.salePrice), currency)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t.stock} {Number(p.quantity)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="lg:col-span-5 xl:col-span-4 mt-4 lg:mt-0 rounded-3xl border border-white/10 bg-[#111827] flex flex-col min-h-[420px]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <ShoppingCart className="w-4 h-4 text-sky-400" />
            {t.cart}
          </div>
          <button
            type="button"
            onClick={() => setCart([])}
            className="text-xs text-slate-500 hover:text-rose-300 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clear}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!cart.length && (
            <p className="text-sm text-slate-500 text-center py-10">{t.emptyCart}</p>
          )}
          {cart.map((l) => (
            <div key={l.productId} className="rounded-xl bg-white/5 border border-white/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{l.name}</p>
                  <p className="text-[11px] text-slate-500">{l.sku}</p>
                </div>
                <p className="text-sm font-bold text-sky-300 shrink-0">
                  {formatMoney(l.unitPrice * l.quantity, currency)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center gap-1 rounded-lg bg-black/30 p-0.5">
                  <button
                    type="button"
                    className="w-8 h-8 grid place-items-center rounded-md hover:bg-white/10"
                    onClick={() =>
                      setCart((prev) =>
                        prev
                          .map((x) =>
                            x.productId === l.productId
                              ? { ...x, quantity: Math.max(0, x.quantity - 1) }
                              : x,
                          )
                          .filter((x) => x.quantity > 0),
                      )
                    }
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                  <button
                    type="button"
                    className="w-8 h-8 grid place-items-center rounded-md hover:bg-white/10"
                    onClick={() =>
                      setCart((prev) =>
                        prev.map((x) => {
                          if (x.productId !== l.productId) return x;
                          const next = x.quantity + 1;
                          if (x.isTracked && next > x.stock) {
                            toast.error(`${t.stock}: ${x.stock}`);
                            return x;
                          }
                          return { ...x, quantity: next };
                        }),
                      )
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  {t.price} {formatMoney(l.unitPrice, currency)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>{t.subtotal}</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>
                {t.tax} ({taxRate}%)
              </span>
              <span>{formatMoney(tax, currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-extrabold text-white pt-1">
              <span>{t.total}</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CASH")}
              className="h-12 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40 hover:bg-emerald-400 inline-flex items-center justify-center gap-2"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.payCash}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CREDIT_CARD")}
              className="h-12 rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40 hover:bg-sky-400"
            >
              {t.payCard}
            </button>
          </div>
          {lastInvoice && (
            <button
              type="button"
              onClick={printReceipt}
              className="w-full h-10 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5"
            >
              {t.printReceipt} · {lastInvoice.number}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
