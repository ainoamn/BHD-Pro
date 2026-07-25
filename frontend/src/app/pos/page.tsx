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
  discount: number;
  stock: number;
  isTracked: boolean;
};

type ParkedCart = {
  id: string;
  name: string;
  createdAt: string;
  warehouseId: string;
  lines: CartLine[];
};

type CheckoutMethod = "CASH" | "CREDIT_CARD" | "BANK_TRANSFER";

function parkedStorageKey(companyId?: string | null) {
  return `hisaby-pos-parked:${companyId || "default"}`;
}

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
  status?: string;
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
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);

  const currency = company?.currency || "OMR";
  const companyId = company?.id;
  const taxRate =
    company?.applyVat === false
      ? 0
      : typeof company?.vatRate === "number"
        ? company.vatRate
        : 5;

  const focusScan = useCallback(() => {
    window.requestAnimationFrame(() => scanRef.current?.focus());
  }, []);

  const loadCatalog = useCallback(async (q?: string, whId?: string) => {
    try {
      const res = await api.searchPosProducts(q, whId || warehouseId || undefined);
      setCatalog((res.data as PosProduct[]) || []);
    } catch {
      /* ignore */
    } finally {
      setCatalogLoaded(true);
    }
  }, [warehouseId]);

  const loadRecentSales = useCallback(async () => {
    try {
      const res = await api.getInvoices({ isCash: true, type: "SALES" });
      const rows = ((res.data as RecentCashSale[]) || []).filter(
        (inv) =>
          String(inv.notes || "").includes("Hisaby POS") &&
          String(inv.status || "").toUpperCase() !== "CANCELLED",
      );
      setRecentSales(rows.slice(0, 5));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadRecentSales();
    focusScan();
    let saved = "";
    try {
      saved = localStorage.getItem(POS_WAREHOUSE_KEY) || "";
      if (saved) setWarehouseId(saved);
      const raw = localStorage.getItem(parkedStorageKey(companyId));
      if (raw) {
        const parsed = JSON.parse(raw) as ParkedCart[];
        if (Array.isArray(parsed)) setParkedCarts(parsed);
      } else {
        setParkedCarts([]);
      }
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const res = await api.getWarehouses();
        const rows = ((res.data as PosWarehouse[]) || []).filter((w) => w.isActive !== false);
        setWarehouses(rows);
        if (!saved && rows.length > 0) {
          setWarehouseId(rows[0].id);
          try {
            localStorage.setItem(POS_WAREHOUSE_KEY, rows[0].id);
          } catch {
            /* ignore */
          }
        } else if (saved && rows.length > 0 && !rows.some((w) => w.id === saved)) {
          setWarehouseId(rows[0].id);
          try {
            localStorage.setItem(POS_WAREHOUSE_KEY, rows[0].id);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [loadRecentSales, focusScan, companyId]);

  useEffect(() => {
    const id = window.setTimeout(() => loadCatalog(search), 220);
    return () => window.clearTimeout(id);
  }, [search, warehouseId, loadCatalog]);

  const persistParked = useCallback(
    (next: ParkedCart[]) => {
      setParkedCarts(next);
      try {
        localStorage.setItem(parkedStorageKey(companyId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [companyId],
  );

  const parkCart = () => {
    if (!cart.length) {
      toast.error(t.parkEmpty);
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `park-${Date.now()}`;
    const entry: ParkedCart = {
      id,
      name: `${t.parkName} ${parkedCarts.length + 1}`,
      createdAt: new Date().toISOString(),
      warehouseId,
      lines: cart.map((l) => ({ ...l })),
    };
    persistParked([entry, ...parkedCarts]);
    setCart([]);
    toast.success(t.parkOk);
    focusScan();
  };

  const recallParked = (parked: ParkedCart) => {
    setCart(parked.lines.map((l) => ({ ...l })));
    if (parked.warehouseId) onWarehouseChange(parked.warehouseId);
    persistParked(parkedCarts.filter((p) => p.id !== parked.id));
    focusScan();
  };

  const deleteParked = (id: string) => {
    persistParked(parkedCarts.filter((p) => p.id !== id));
  };

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
            discount: 0,
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
      const res = await api.lookupPosProduct(code, warehouseId || undefined);
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

  const lineTotal = (l: CartLine) =>
    Math.max(0, Number((l.unitPrice * l.quantity - (l.discount || 0)).toFixed(3)));

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
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
    if (m === "BANK_TRANSFER") return t.payBank;
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

  const voidSale = async (sale: RecentCashSale) => {
    if (!window.confirm(t.voidConfirm)) return;
    try {
      await api.voidPosSale(sale.id);
      toast.success(t.voidOk);
      setLastInvoice((prev) => (prev?.number === sale.number ? null : prev));
      await loadRecentSales();
      await loadCatalog(search, warehouseId || undefined);
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.voidFail);
    }
  };

  const checkout = async (method: CheckoutMethod) => {
    if (!cart.length || paying) return;
    const snapshot = cart.map((l) => ({
      name: l.name,
      qty: l.quantity,
      lineTotal: lineTotal(l),
    }));
    setPaying(true);
    try {
      const res = await api.createPosSale({
        paymentMethod: method,
        warehouseId: warehouseId || undefined,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount || 0,
        })),
      });
      const inv = res.data as { number?: string; total?: number | string };
      setLastInvoice({
        number: inv.number,
        total: Number(inv.total),
        lines: snapshot,
        paymentMethod: paymentLabel(method),
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
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 space-y-1">
            <label className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-sky-400/80 shrink-0" />
              <span className="text-xs text-slate-400 shrink-0">{t.warehouseDefault}</span>
              <select
                value={warehouseId}
                onChange={(e) => onWarehouseChange(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none"
                aria-label={t.warehouse}
              >
                <option value="" className="bg-[#111827] text-white" disabled>
                  {t.warehouseAll}
                </option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#111827] text-white">
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[10px] text-slate-500 ps-6">{t.warehouseHint}</p>
          </div>
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
                <div
                  key={sale.id}
                  className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-start min-w-[9.5rem] space-y-1.5"
                >
                  <button
                    type="button"
                    onClick={() => reprintSale(sale)}
                    className="w-full text-start hover:opacity-90 transition"
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
                  <button
                    type="button"
                    onClick={() => voidSale(sale)}
                    className="w-full h-7 rounded-lg border border-rose-500/30 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/15 transition"
                  >
                    {t.voidSale}
                  </button>
                </div>
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
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold">
            <ShoppingCart className="w-4 h-4 text-sky-400" />
            {t.cart}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={parkCart}
              className="text-xs text-slate-500 hover:text-amber-300"
            >
              {t.parkCart}
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-slate-500 hover:text-rose-300 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.clear}
            </button>
          </div>
        </div>

        {parkedCarts.length > 0 ? (
          <div className="px-3 pt-2 space-y-1.5 border-b border-white/5 pb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {t.parkedCarts}
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {parkedCarts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {p.lines.length} · {new Date(p.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => recallParked(p)}
                    className="h-7 px-2 rounded-md text-[10px] font-semibold text-sky-300 hover:bg-sky-500/15"
                  >
                    {t.recallCart}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteParked(p.id)}
                    className="h-7 px-2 rounded-md text-[10px] font-semibold text-rose-300/80 hover:bg-rose-500/15"
                  >
                    {t.deleteParked}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                  {formatMoney(lineTotal(l), currency)}
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
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <label className="text-[11px] text-slate-500 shrink-0">{t.price}</label>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={l.unitPrice}
                  onChange={(e) => {
                    const next = Math.max(0, parseFloat(e.target.value) || 0);
                    setCart((prev) =>
                      prev.map((x) =>
                        x.productId === l.productId ? { ...x, unitPrice: next } : x,
                      ),
                    );
                  }}
                  className="w-24 h-8 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <label className="text-[11px] text-slate-500 shrink-0">{t.discount}</label>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={l.discount || 0}
                  onChange={(e) => {
                    const next = Math.max(0, parseFloat(e.target.value) || 0);
                    setCart((prev) =>
                      prev.map((x) =>
                        x.productId === l.productId ? { ...x, discount: next } : x,
                      ),
                    );
                  }}
                  className="w-24 h-8 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                />
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
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CASH")}
              className="h-12 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40 hover:bg-emerald-400 inline-flex items-center justify-center gap-2 text-sm"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.payCash}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CREDIT_CARD")}
              className="h-12 rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40 hover:bg-sky-400 text-sm"
            >
              {t.payCard}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("BANK_TRANSFER")}
              className="h-12 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-40 hover:bg-teal-500 text-sm"
            >
              {t.payBank}
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
