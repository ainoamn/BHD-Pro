"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Minus, PackagePlus, Plus, Printer, ScanBarcode, ShoppingCart, Trash2, Warehouse } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { posCopy } from "@/lib/pos-copy";
import { formatMoney } from "@/lib/utils";

const POS_WAREHOUSE_KEY = "hisaby-pos-warehouse-id";

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

type PosWarehouse = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type ReceiptSnapshot = {
  number?: string;
  total?: number;
  lines?: { name: string; qty: number; lineTotal: number }[];
  paymentMethod?: string;
};

type RecentCashSale = {
  id: string;
  number: string;
  total: number | string;
  date?: string;
  notes?: string | null;
  items?: {
    description: string;
    quantity: number | string;
    total: number | string;
  }[];
  payments?: { method?: string }[];
};

export default function PosCheckoutPage() {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paying, setPaying] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<ReceiptSnapshot | null>(null);
  const [warehouses, setWarehouses] = useState<PosWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [recentSales, setRecentSales] = useState<RecentCashSale[]>([]);

  const currency = company?.currency || "OMR";
  const taxRate = 5;

  const focusScan = useCallback(() => {
    window.requestAnimationFrame(() => scanRef.current?.focus());
  }, []);

  const loadCatalog = useCallback(async (q?: string) => {
    try {
      const res = await api.searchPosProducts(q);
      setCatalog((res.data as PosProduct[]) || []);
    } catch {
      /* ignore */
    } finally {
      setCatalogLoaded(true);
    }
  }, []);

  const loadRecentSales = useCallback(async () => {
    try {
      const res = await api.getInvoices({ isCash: true, type: "SALES" });
      const rows = (res.data as RecentCashSale[]) || [];
      setRecentSales(rows.slice(0, 5));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    loadRecentSales();
    focusScan();
    try {
      const saved = localStorage.getItem(POS_WAREHOUSE_KEY);
      if (saved) setWarehouseId(saved);
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const res = await api.getWarehouses();
        const rows = ((res.data as PosWarehouse[]) || []).filter((w) => w.isActive !== false);
        setWarehouses(rows);
      } catch {
        /* ignore */
      }
    })();
  }, [loadCatalog, loadRecentSales, focusScan]);

  useEffect(() => {
    const id = window.setTimeout(() => loadCatalog(search), 220);
    return () => window.clearTimeout(id);
  }, [search, loadCatalog]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SELECT" || tag === "TEXTAREA") return;
      if (!cart.length) {
        focusScan();
        return;
      }
      e.preventDefault();
      if (window.confirm(t.clearConfirm)) {
        setCart([]);
        focusScan();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cart.length, t.clearConfirm, focusScan]);

  const onWarehouseChange = (id: string) => {
    setWarehouseId(id);
    try {
      if (id) localStorage.setItem(POS_WAREHOUSE_KEY, id);
      else localStorage.removeItem(POS_WAREHOUSE_KEY);
    } catch {
      /* ignore */
    }
    focusScan();
  };

  const addProduct = useCallback(
    (p: PosProduct, qty = 1) => {
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
      focusScan();
    },
    [t.stock, focusScan],
  );

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    try {
      const res = await api.lookupPosProduct(code);
      addProduct(res.data as PosProduct, 1);
      setScan("");
      focusScan();
    } catch {
      toast.error(t.notFound);
      setScan("");
      focusScan();
    }
  };

  const clearCart = () => {
    if (!cart.length) return;
    if (window.confirm(t.clearConfirm)) {
      setCart([]);
      focusScan();
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [cart],
  );
  const tax = useMemo(() => Number(((subtotal * taxRate) / 100).toFixed(3)), [subtotal]);
  const total = useMemo(() => Number((subtotal + tax).toFixed(3)), [subtotal, tax]);

  const printReceiptSnapshot = useCallback(
    (receipt: ReceiptSnapshot) => {
      const w = window.open("", "_blank", "width=360,height=640");
      if (!w) return;
      const linesHtml = (receipt.lines || [])
        .map(
          (l) =>
            `<tr><td>${l.name}</td><td style="text-align:center">${l.qty}</td><td style="text-align:end">${formatMoney(l.lineTotal, currency)}</td></tr>`,
        )
        .join("");
      const dir = locale === "en" ? "ltr" : "rtl";
      w.document.write(`<!doctype html><html dir="${dir}"><head><title>Receipt</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:16px;width:280px;margin:0 auto;color:#111}
        h1{font-size:16px;margin:0 0 4px} p{margin:4px 0;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
        td{padding:3px 0;vertical-align:top}
        hr{border:none;border-top:1px dashed #999;margin:12px 0}
      </style></head><body>
      <h1>${t.brand}</h1>
      <p>${company?.name || ""}</p>
      <hr/>
      <p>${receipt.number || ""}</p>
      <p>${receipt.paymentMethod || ""}</p>
      <table><tbody>${linesHtml}</tbody></table>
      <hr/>
      <p><strong>${t.total}: ${formatMoney(receipt.total || 0, currency)}</strong></p>
      <hr/><p style="text-align:center">Hisaby POS</p>
      <script>window.print()</script></body></html>`);
      w.document.close();
    },
    [company?.name, currency, locale, t.brand, t.total],
  );

  const paymentLabel = (method?: string) => {
    if (!method) return "";
    const m = method.toUpperCase();
    if (m === "CASH") return t.payCash;
    if (m === "CREDIT_CARD" || m === "CARD") return t.payCard;
    return method;
  };

  const reprintSale = (sale: RecentCashSale) => {
    printReceiptSnapshot({
      number: sale.number,
      total: Number(sale.total),
      paymentMethod: paymentLabel(sale.payments?.[0]?.method),
      lines: (sale.items || []).map((item) => ({
        name: item.description,
        qty: Number(item.quantity),
        lineTotal: Number(item.total),
      })),
    });
  };

  const checkout = async (method: "CASH" | "CREDIT_CARD") => {
    if (!cart.length || paying) return;
    const snapshot = cart.map((l) => ({
      name: l.name,
      qty: l.quantity,
      lineTotal: Number((l.unitPrice * l.quantity).toFixed(3)),
    }));
    setPaying(true);
    try {
      const res = await api.createPosSale({
        paymentMethod: method,
        taxRate,
        warehouseId: warehouseId || undefined,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      const inv = res.data as { number?: string; total?: number | string };
      setLastInvoice({
        number: inv.number,
        total: Number(inv.total),
        lines: snapshot,
        paymentMethod: method === "CASH" ? t.payCash : t.payCard,
      });
      setCart([]);
      toast.success(t.saleOk);
      loadCatalog(search);
      loadRecentSales();
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setPaying(false);
    }
  };

  const showEmptyCatalog = catalogLoaded && catalog.length === 0 && !search.trim();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-3 sm:p-4 min-h-[calc(100vh-3.5rem)]">
      <section className="lg:col-span-7 xl:col-span-8 space-y-3">
        {warehouses.length > 0 ? (
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <Warehouse className="w-4 h-4 text-sky-400/80 shrink-0" />
            <span className="text-xs text-slate-400 shrink-0">{t.warehouseDefault}</span>
            <select
              value={warehouseId}
              onChange={(e) => onWarehouseChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none"
              aria-label={t.warehouse}
            >
              <option value="" className="bg-[#111827] text-white">
                {t.warehouseAll}
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#111827] text-white">
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <form onSubmit={handleScan} className="space-y-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400/80" />
              <input
                ref={scanRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder={t.scanPlaceholder}
                className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 ps-11 pe-4 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/20"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="h-14 px-5 rounded-2xl bg-sky-500 text-white font-bold hover:bg-sky-400 transition"
            >
              Enter
            </button>
          </div>
          <p className="text-[11px] text-slate-500 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <ScanBarcode className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {t.barcodeHint}
            </span>
            <span className="text-slate-600">{t.escHint}</span>
          </p>
        </form>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-300">{t.recentSales}</p>
            {!recentSales.length ? (
              <p className="text-[11px] text-slate-500">{t.noRecentSales}</p>
            ) : null}
          </div>
          {recentSales.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {recentSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => reprintSale(sale)}
                  className="shrink-0 rounded-xl border border-white/10 bg-black/20 hover:border-sky-400/40 hover:bg-sky-500/10 px-3 py-2 text-start transition min-w-[9.5rem]"
                  title={t.reprint}
                >
                  <p className="text-xs font-bold text-white truncate">{sale.number}</p>
                  <p className="text-[11px] text-sky-300 font-semibold mt-0.5">
                    {formatMoney(Number(sale.total), currency)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 inline-flex items-center gap-1">
                    <Printer className="w-3 h-3" />
                    {t.reprint}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {showEmptyCatalog ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center space-y-3">
            <PackagePlus className="w-10 h-10 text-sky-400/80 mx-auto" />
            <p className="text-base font-bold text-white">{t.emptyCatalog}</p>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{t.emptyCatalogHint}</p>
            <Link
              href="/inventory"
              className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400"
            >
              {t.goInventory}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[52vh] overflow-y-auto pe-1">
            {catalog.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="text-start rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-sky-500/10 hover:border-sky-400/40 p-3 transition"
              >
                <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{p.sku}</p>
                {p.barcode ? (
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{p.barcode}</p>
                ) : null}
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
            {catalogLoaded && catalog.length === 0 && search.trim() ? (
              <p className="col-span-full text-center text-sm text-slate-500 py-8">{t.notFound}</p>
            ) : null}
          </div>
        )}
      </section>

      <aside className="lg:col-span-5 xl:col-span-4 mt-4 lg:mt-0 rounded-3xl border border-white/10 bg-[#111827] flex flex-col min-h-[420px]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <ShoppingCart className="w-4 h-4 text-sky-400" />
            {t.cart}
          </div>
          <button
            type="button"
            onClick={clearCart}
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
              onClick={() => printReceiptSnapshot(lastInvoice)}
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
