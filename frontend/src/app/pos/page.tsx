"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Camera,
  CircleHelp,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  ScanBarcode,
  ShoppingCart,
  Star,
  Trash2,
  UserPlus,
  Warehouse,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { posCopy } from "@/lib/pos-copy";
import { formatMoney } from "@/lib/utils";
import type { Contact } from "@/types";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";
import { BarcodeCameraScanner } from "@/components/pos/barcode-camera-scanner";
import { QtyKeypadModal } from "@/components/pos/qty-keypad-modal";
import { playPosScanBeep } from "@/lib/pos-beep";
import { openPosReceiptEmail, openPosReceiptWhatsApp } from "@/lib/pos-receipt-share";
import { loadPosFavorites, togglePosFavorite } from "@/lib/pos-favorites";
import { useQuery } from "@tanstack/react-query";
import {
  PHONE_DIAL_CODES,
  combinePhone,
  DEFAULT_DIAL_CODE,
} from "@/lib/phone";
import { ContactSearchSelect } from "@/components/contacts/contact-search-select";

const POS_WAREHOUSE_KEY = "hisaby-pos-warehouse-id";

type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  quantity: number | string;
  isTracked: boolean;
  minQuantity?: number | string | null;
};

type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  catalogPrice: number;
  quantity: number;
  discount: number;
  stock: number;
  isTracked: boolean;
};

type ParkedCart = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  warehouseId: string;
  contactId?: string;
  lines: CartLine[];
};

type CheckoutMethod = "CASH" | "CREDIT_CARD" | "BANK_TRANSFER" | "STORE_CREDIT" | "PARTNER" | "TERMINAL";

type PosWarehouse = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type ReceiptSnapshot = {
  id?: string;
  number?: string;
  total?: number;
  lines?: { name: string; qty: number; lineTotal: number }[];
  paymentMethod?: string;
  warehouseLabel?: string;
};

type RecentCashSale = {
  id: string;
  number: string;
  total: number | string;
  date?: string;
  createdAt?: string;
  notes?: string | null;
  status?: string;
  items?: {
    productId?: string | null;
    description: string;
    quantity: number | string;
    unitPrice?: number | string;
    total: number | string;
  }[];
  payments?: { method?: string; amount?: number | string }[];
};

export default function PosCheckoutPage() {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
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
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [customerRecentPurchases, setCustomerRecentPurchases] = useState<RecentCashSale[]>([]);
  const [customerPurchasesLoading, setCustomerPurchasesLoading] = useState(false);
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState<number | null>(null);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [voidTarget, setVoidTarget] = useState<RecentCashSale | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [refundTarget, setRefundTarget] = useState<RecentCashSale | null>(null);
  const [refundQtys, setRefundQtys] = useState<Record<string, string>>({});
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"ORIGINAL" | "CASH" | "STORE_CREDIT">(
    "ORIGINAL",
  );
  const [refundAwaitingApproval, setRefundAwaitingApproval] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [cashTenderOpen, setCashTenderOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState("");
  const [receiptLookup, setReceiptLookup] = useState("");
  const [receiptLookupBusy, setReceiptLookupBusy] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutMethod | null>(null);
  const [pendingSplitPayments, setPendingSplitPayments] = useState<
    { method: CheckoutMethod; amount: number }[] | null
  >(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [catalogStale, setCatalogStale] = useState(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [awaitingPayId, setAwaitingPayId] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [todayStats, setTodayStats] = useState<{
    salesCount: number;
    salesTotal: number;
    refundCount: number;
    voidCount: number;
  } | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerDial, setNewCustomerDial] = useState(DEFAULT_DIAL_CODE);
  const [newCustomerLocal, setNewCustomerLocal] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [webSerialOk, setWebSerialOk] = useState(false);
  const [qtyKeypadLineId, setQtyKeypadLineId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cartNotes, setCartNotes] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [tipCustom, setTipCustom] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCashAmt, setSplitCashAmt] = useState("");
  const [splitCardAmt, setSplitCardAmt] = useState("");

  const currency = company?.currency || "OMR";
  const companyId = company?.id;
  const defaultDial =
    PHONE_DIAL_CODES.find((d) => d.country === company?.country)?.code ??
    DEFAULT_DIAL_CODE;
  const canOverridePrice = user?.role === "ADMIN" || user?.role === "MANAGER";
  const taxRate =
    company?.applyVat === false
      ? 0
      : typeof company?.vatRate === "number"
        ? company.vatRate
        : 5;

  const { data: securityConfig } = useQuery({
    queryKey: ["company-security"],
    queryFn: async () => {
      const res = await api.getCompanySecurity();
      return res.data as { requireOpenShift?: boolean };
    },
    staleTime: 60_000,
  });
  const requireOpenShift = securityConfig?.requireOpenShift === true;

  useEffect(() => {
    setFavoriteIds(loadPosFavorites(companyId));
  }, [companyId]);

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId),
    [warehouses, warehouseId],
  );
  const warehouseLabel = selectedWarehouse
    ? `${selectedWarehouse.code} — ${selectedWarehouse.name}`
    : "";

  const focusScan = useCallback(() => {
    window.requestAnimationFrame(() => scanRef.current?.focus());
  }, []);

  const loadCatalog = useCallback(async (q?: string, whId?: string) => {
    const wh = whId || warehouseId || undefined;
    try {
      const res = await api.searchPosProducts(q, wh);
      const rows = (res.data as PosProduct[]) || [];
      setCatalog(rows);
      setCatalogStale(false);
      if (!q?.trim() && rows.length) {
        const { saveCatalogCache } = await import("@/lib/pos-catalog-cache");
        void saveCatalogCache(rows, wh);
      }
    } catch {
      try {
        const { loadCatalogCacheMeta, filterCachedCatalog, isCatalogStale } = await import(
          "@/lib/pos-catalog-cache"
        );
        const meta = await loadCatalogCacheMeta(wh);
        setCatalog(filterCachedCatalog(meta.products, q) as PosProduct[]);
        setCatalogStale(isCatalogStale(meta.savedAt));
      } catch {
        /* ignore */
      }
    } finally {
      setCatalogLoaded(true);
    }
  }, [warehouseId]);

  const refreshCatalog = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error(t.syncFail);
      return;
    }
    setCatalogRefreshing(true);
    try {
      if (typeof api.syncPosCatalog === "function") {
        const wh = warehouseId || undefined;
        const { loadCatalogCacheMeta, saveCatalogCache, mergeCatalogDeltas, isCatalogStale } =
          await import("@/lib/pos-catalog-cache");
        const meta = await loadCatalogCacheMeta(wh);
        if (meta.savedAt && !isCatalogStale(meta.savedAt) && typeof api.syncPosStock === "function") {
          const deltaRes = await api.syncPosStock(wh, meta.savedAt);
          const deltas = (deltaRes.data?.products as PosProduct[]) || [];
          if (deltaRes.data?.full) {
            await saveCatalogCache(deltas, wh);
            setCatalog(deltas.slice(0, 80));
          } else if (deltas.length) {
            await mergeCatalogDeltas(deltas, wh);
          }
          setCatalogStale(false);
          if (search.trim()) await loadCatalog(search, wh);
          toast.success(t.catalogSynced);
        } else {
          const res = await api.syncPosCatalog(wh);
          const rows = (res.data?.products as PosProduct[]) || [];
          await saveCatalogCache(rows, wh);
          setCatalogStale(false);
          if (search.trim()) {
            await loadCatalog(search, wh);
          } else {
            setCatalog(rows.slice(0, 80));
            setCatalogLoaded(true);
          }
          toast.success(t.catalogSynced);
        }
      } else {
        await loadCatalog(search, warehouseId || undefined);
        toast.success(t.refreshCatalog);
      }
    } catch {
      toast.error(t.catalogSyncFail);
    } finally {
      setCatalogRefreshing(false);
    }
  }, [
    loadCatalog,
    search,
    t.catalogSynced,
    t.catalogSyncFail,
    t.syncFail,
    t.refreshCatalog,
    warehouseId,
  ]);

  // Background stock delta sync while POS is open (multi-register safety)
  useEffect(() => {
    let cancelled = false;
    const tick = async (silent: boolean) => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (typeof api.syncPosStock !== "function") return;
      try {
        const wh = warehouseId || undefined;
        const { loadCatalogCacheMeta, mergeCatalogDeltas, saveCatalogCache, isCatalogStale } =
          await import("@/lib/pos-catalog-cache");
        const meta = await loadCatalogCacheMeta(wh);
        if (!meta.savedAt) return;
        const deltaRes = await api.syncPosStock(wh, meta.savedAt);
        if (cancelled) return;
        const deltas = (deltaRes.data?.products as PosProduct[]) || [];
        if (deltaRes.data?.full) {
          await saveCatalogCache(deltas, wh);
        } else if (deltas.length) {
          await mergeCatalogDeltas(deltas, wh);
        }
        setCatalogStale(isCatalogStale(meta.savedAt) && !deltas.length);
        if (!silent && deltas.length) {
          await loadCatalog(search, wh);
        }
      } catch {
        /* ignore background failures */
      }
    };
    void tick(true);
    const id = window.setInterval(() => void tick(true), 45000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick(true);
    };
    const onOnline = () => void tick(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [warehouseId, loadCatalog, search]);

  const loadOpsStrip = useCallback(async () => {
    const wh = warehouseId || undefined;
    try {
      const [shiftRes, statsRes] = await Promise.all([
        api.getCurrentPosShift(wh),
        api.getPosTodayStats(wh),
      ]);
      setShiftOpen(!!shiftRes.data?.shift);
      const s = statsRes.data;
      setTodayStats(
        s
          ? {
              salesCount: Number(s.salesCount) || 0,
              salesTotal: Number(s.salesTotal) || 0,
              refundCount: Number(s.refundCount) || 0,
              voidCount: Number(s.voidCount) || 0,
            }
          : null,
      );
    } catch {
      /* ignore */
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
    if (!awaitingPayId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.getPosTerminalTap(awaitingPayId);
        if (cancelled) return;
        if (res.data?.paid) {
          setAwaitingPayId(null);
          toast.success(t.terminalTapPaid);
          void loadRecentSales();
          void loadOpsStrip();
        }
      } catch {
        /* keep polling */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [awaitingPayId, t.terminalTapPaid, loadRecentSales, loadOpsStrip]);

  useEffect(() => {
    if (!contactId) {
      setCustomerRecentPurchases([]);
      setCustomerPurchasesLoading(false);
      setCustomerLoyaltyPoints(null);
      setLoyaltyEnabled(false);
      return;
    }
    let cancelled = false;
    setCustomerPurchasesLoading(true);
    (async () => {
      try {
        const res = await api.getPosCustomerRecentSales(contactId);
        if (!cancelled) {
          setCustomerRecentPurchases((res.data?.sales || []) as RecentCashSale[]);
        }
      } catch {
        if (!cancelled) setCustomerRecentPurchases([]);
      } finally {
        if (!cancelled) setCustomerPurchasesLoading(false);
      }
      try {
        const pts = await api.getPosCustomerPoints(contactId);
        if (!cancelled) {
          setLoyaltyEnabled(!!pts.data.customerEnabled);
          setCustomerLoyaltyPoints(
            pts.data.customerEnabled ? Number(pts.data.points) : null,
          );
        }
      } catch {
        if (!cancelled) {
          setCustomerLoyaltyPoints(null);
          setLoyaltyEnabled(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const refreshCustomerPurchases = useCallback(async () => {
    if (!contactId) return;
    try {
      const res = await api.getPosCustomerRecentSales(contactId);
      setCustomerRecentPurchases((res.data?.sales || []) as RecentCashSale[]);
    } catch {
      /* ignore */
    }
  }, [contactId]);

  const maybeKickDrawer = useCallback(async (method: CheckoutMethod) => {
    if (method !== "CASH") return;
    try {
      const { getPreferCashDrawer, tryOpenCashDrawer, isWebSerialSupported } = await import(
        "@/lib/pos-escpos"
      );
      if (!isWebSerialSupported() || !getPreferCashDrawer()) return;
      await tryOpenCashDrawer();
    } catch {
      /* best-effort */
    }
  }, []);

  const mapDraftToParked = useCallback(
    (d: {
      id: string;
      name: string;
      notes?: string | null;
      warehouseId: string | null;
      contactId?: string | null;
      linesJson: unknown;
      createdAt: string;
    }): ParkedCart => ({
      id: d.id,
      name: d.name,
      notes: d.notes || undefined,
      createdAt: d.createdAt,
      warehouseId: d.warehouseId || "",
      contactId: d.contactId || undefined,
      lines: Array.isArray(d.linesJson)
        ? (d.linesJson as CartLine[]).map((l) => ({
            ...l,
            catalogPrice: l.catalogPrice ?? l.unitPrice,
          }))
        : [],
    }),
    [],
  );

  const loadParkedCarts = useCallback(async () => {
    if (!companyId) {
      setParkedCarts([]);
      return;
    }
    try {
      const res = await api.listPosDrafts();
      const rows = (res.data || []).map(mapDraftToParked);
      setParkedCarts(rows);
    } catch {
      /* ignore */
    }
  }, [companyId, mapDraftToParked]);

  useEffect(() => {
    loadRecentSales();
    focusScan();
    let saved = "";
    try {
      saved = localStorage.getItem(POS_WAREHOUSE_KEY) || "";
      if (saved) setWarehouseId(saved);
    } catch {
      /* ignore */
    }
    if (companyId) {
      void loadParkedCarts();
    } else {
      setParkedCarts([]);
    }
    (async () => {
      try {
        const { isWebSerialSupported } = await import("@/lib/pos-escpos");
        setWebSerialOk(isWebSerialSupported());
      } catch {
        setWebSerialOk(false);
      }
      try {
        const [whRes, contactRes] = await Promise.all([
          api.getWarehouses(),
          api.getContacts("CUSTOMER"),
        ]);
        const rows = ((whRes.data as PosWarehouse[]) || []).filter((w) => w.isActive !== false);
        setWarehouses(rows);
        const contactRows = ((contactRes.data as Contact[]) || []).filter(
          (c) => c.isActive !== false,
        );
        setCustomers(contactRows);
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
  }, [loadRecentSales, loadParkedCarts, focusScan, companyId]);

  useEffect(() => {
    void loadOpsStrip();
  }, [loadOpsStrip]);

  /** Flush offline sales when connectivity returns. */
  useEffect(() => {
    let cancelled = false;
    const flush = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      try {
        const { flushPendingPosSales } = await import("@/lib/pos-offline-sync");
        const result = await flushPendingPosSales();
        if (cancelled) return;
        if (result.synced > 0) {
          toast.success(t.syncOk);
          await loadRecentSales();
          await loadOpsStrip();
          await loadCatalog(search, warehouseId || undefined);
        } else if (result.failed) {
          toast.error(t.syncFail);
        }
      } catch {
        /* ignore */
      }
    };
    void flush();
    window.addEventListener("online", flush);
    return () => {
      cancelled = true;
      window.removeEventListener("online", flush);
    };
  }, [loadCatalog, loadOpsStrip, loadRecentSales, search, t.syncFail, t.syncOk, warehouseId]);

  useEffect(() => {
    const id = window.setTimeout(() => loadCatalog(search), 220);
    return () => window.clearTimeout(id);
  }, [search, warehouseId, loadCatalog]);

  const parkCart = async () => {
    if (!cart.length) {
      toast.error(t.parkEmpty);
      return;
    }
    try {
      await api.createPosDraft({
        name: `${t.parkName} ${parkedCarts.length + 1}`,
        notes: cartNotes.trim() || undefined,
        warehouseId: warehouseId || undefined,
        contactId: contactId || undefined,
        lines: cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          stock: l.stock,
          isTracked: l.isTracked,
          discount: l.discount,
        })),
      });
      setCart([]);
      setCartNotes("");
      setTipAmount(0);
      setTipCustom("");
      setSplitOpen(false);
      await loadParkedCarts();
      toast.success(t.parkOk);
      focusScan();
    } catch {
      toast.error(t.parkFail);
    }
  };

  const recallParked = async (parked: ParkedCart) => {
    if (cart.length && !window.confirm(t.recallOverwrite)) return;
    const whId = parked.warehouseId || warehouseId;
    let lines = parked.lines.map((l) => ({ ...l }));
    try {
      const refreshed = await Promise.all(
        lines.map(async (line) => {
          try {
            const res = await api.lookupPosProduct(line.sku, whId || undefined);
            const p = res.data as PosProduct;
            return { ...line, stock: Number(p.quantity), isTracked: p.isTracked };
          } catch {
            const fromCatalog = catalog.find((c) => c.id === line.productId);
            if (fromCatalog) {
              return {
                ...line,
                stock: Number(fromCatalog.quantity),
                isTracked: fromCatalog.isTracked,
              };
            }
            return line;
          }
        }),
      );
      lines = refreshed;
    } catch {
      /* best-effort */
    }
    setCart(lines);
    setCartNotes(parked.notes || "");
    setTipAmount(0);
    setTipCustom("");
    setSplitOpen(false);
    if (parked.warehouseId) onWarehouseChange(parked.warehouseId);
    if (parked.contactId) setContactId(parked.contactId);
    try {
      await api.deletePosDraft(parked.id);
    } catch {
      /* still ok — cart recalled locally */
    }
    await loadParkedCarts();
    focusScan();
  };

  const deleteParked = async (id: string) => {
    try {
      await api.deletePosDraft(id);
      await loadParkedCarts();
    } catch {
      toast.error(t.parkFail);
    }
  };

  const renameParked = async (parked: ParkedCart) => {
    const next = window.prompt(t.renameParkedPrompt, parked.name);
    if (next == null) return;
    const name = next.trim();
    if (!name || name === parked.name) return;
    try {
      await api.updatePosDraft(parked.id, { name });
      await loadParkedCarts();
      toast.success(t.renameParkedOk);
    } catch {
      toast.error(t.parkFail);
    }
  };

  const editParkedNotes = async (parked: ParkedCart) => {
    const next = window.prompt(t.parkNotes, parked.notes || "");
    if (next == null) return;
    try {
      await api.updatePosDraft(parked.id, { notes: next.trim() });
      await loadParkedCarts();
      toast.success(t.renameParkedOk);
    } catch {
      toast.error(t.parkFail);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (e.key !== "Escape") return;
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
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
  }, [cart.length, t.clearConfirm, focusScan, shortcutsOpen]);

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
            catalogPrice: unitPrice,
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
    await applyScanCode(code);
  };

  const applyScanCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const res = await api.lookupPosProduct(trimmed, warehouseId || undefined);
      addProduct(res.data as PosProduct, 1);
      playPosScanBeep();
      setScan("");
      setCameraOpen(false);
      focusScan();
    } catch {
      try {
        const { lookupCachedProduct } = await import("@/lib/pos-catalog-cache");
        const cached = await lookupCachedProduct(trimmed, warehouseId || undefined);
        if (cached) {
          addProduct(cached as PosProduct, 1);
          playPosScanBeep();
          setScan("");
          setCameraOpen(false);
          focusScan();
          return;
        }
      } catch {
        /* ignore */
      }
      toast.error(t.notFound);
      setScan("");
      focusScan();
    }
  };

  const clearCart = () => {
    if (!cart.length) return;
    if (window.confirm(t.clearConfirm)) {
      setCart([]);
      setCartNotes("");
      setTipAmount(0);
      setTipCustom("");
      setSplitOpen(false);
      focusScan();
    }
  };

  const lineTotal = (l: CartLine) =>
    Math.max(0, Number((l.unitPrice * l.quantity - (l.discount || 0)).toFixed(3)));

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
    [cart],
  );
  const tax = useMemo(
    () => Number(((subtotal * taxRate) / 100).toFixed(3)),
    [subtotal, taxRate],
  );
  const merchandiseTotal = useMemo(
    () => Number((subtotal + tax).toFixed(3)),
    [subtotal, tax],
  );
  const tipValue = useMemo(
    () => Math.max(0, Number(Number(tipAmount || 0).toFixed(3))),
    [tipAmount],
  );
  const total = useMemo(
    () => Number((merchandiseTotal + tipValue).toFixed(3)),
    [merchandiseTotal, tipValue],
  );

  const applyTipPercent = (pct: number) => {
    const next = Number(((merchandiseTotal * pct) / 100).toFixed(3));
    setTipAmount(next);
    setTipCustom(String(next));
  };

  const openSplitTender = () => {
    if (!cart.length) return;
    const half = Number((total / 2).toFixed(3));
    const rest = Number((total - half).toFixed(3));
    setSplitCashAmt(String(half));
    setSplitCardAmt(String(rest));
    setSplitOpen(true);
  };

  const printReceiptSnapshot = useCallback(
    async (receipt: ReceiptSnapshot) => {
      const escPosPayload = {
        brand: t.brand,
        companyName: company?.name || "",
        vatNumber: company?.vatNumber || undefined,
        warehouseLabel: receipt.warehouseLabel,
        number: receipt.number,
        paymentMethod: receipt.paymentMethod,
        totalLabel: t.total,
        total: receipt.total || 0,
        currency,
        lines: receipt.lines || [],
      };
      try {
        const { tryPrintEscPosSmart, getPreferThermalPrinter } = await import("@/lib/pos-escpos");
        if (getPreferThermalPrinter()) {
          const ok = await tryPrintEscPosSmart(escPosPayload);
          if (ok) return;
        }
      } catch {
        /* fall through to browser print */
      }

      const w = window.open("", "_blank", "width=360,height=640");
      if (!w) return;
      const linesHtml = (receipt.lines || [])
        .map(
          (l) =>
            `<tr><td>${l.name}</td><td style="text-align:center">${l.qty}</td><td style="text-align:end">${formatMoney(l.lineTotal, currency)}</td></tr>`,
        )
        .join("");
      const dir = locale === "en" ? "ltr" : "rtl";
      const companyName = company?.name || "";
      const vatLine = company?.vatNumber
        ? `<p style="font-size:11px;color:#444">${locale === "en" ? "VAT" : "الرقم الضريبي"}: ${company.vatNumber}</p>`
        : "";
      const whLine = receipt.warehouseLabel
        ? `<p style="font-size:12px">${t.warehouse}: ${receipt.warehouseLabel}</p>`
        : "";
      const payLine = receipt.paymentMethod
        ? `<p style="font-size:12px">${t.payment}: ${receipt.paymentMethod}</p>`
        : "";
      w.document.write(`<!doctype html><html dir="${dir}"><head><title>Receipt</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body{
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          padding: 0; width: 72mm; max-width: 100%; margin: 0 auto; color:#111;
          font-size: 12px; line-height: 1.35;
        }
        h1{font-size:14px;margin:0 0 4px} h2{font-size:15px;margin:6px 0 2px;font-weight:800}
        p{margin:4px 0;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;table-layout:fixed}
        td{padding:3px 0;vertical-align:top;word-wrap:break-word}
        td:nth-child(2){width:2.5em;text-align:center}
        td:nth-child(3){width:5.5em;text-align:end;white-space:nowrap}
        hr{border:none;border-top:1px dashed #999;margin:10px 0}
      </style></head><body>
      <h1>${t.brand}</h1>
      <h2>${companyName}</h2>
      ${vatLine}
      ${whLine}
      <hr/>
      <p>${receipt.number || ""}</p>
      ${payLine}
      <table><tbody>${linesHtml}</tbody></table>
      <hr/>
      <p><strong>${t.total}: ${formatMoney(receipt.total || 0, currency)}</strong></p>
      <hr/><p style="text-align:center">Hisaby POS</p>
      <script>window.print()</script></body></html>`);
      w.document.close();
    },
    [
      company?.name,
      company?.vatNumber,
      currency,
      locale,
      t.brand,
      t.payment,
      t.total,
      t.warehouse,
    ],
  );

  const paymentLabel = (method?: string) => {
    if (!method) return "";
    const m = method.toUpperCase();
    if (m === "CASH") return t.payCash;
    if (m === "CREDIT_CARD" || m === "CARD") return t.payCard;
    if (m === "PARTNER") return t.partnerPay;
    if (m === "TERMINAL") return t.terminalTap;
    if (m === "BANK_TRANSFER") return t.payBank;
    if (m === "STORE_CREDIT" || m === "OTHER") return t.payStoreCredit;
    return method;
  };

  const reprintSale = (sale: RecentCashSale) => {
    const payMethods = (sale.payments || [])
      .map((p) => paymentLabel(p.method))
      .filter(Boolean);
    printReceiptSnapshot({
      number: sale.number,
      total: Number(sale.total),
      paymentMethod: payMethods.length
        ? payMethods.join(" + ")
        : paymentLabel(sale.payments?.[0]?.method),
      warehouseLabel: warehouseLabel || undefined,
      lines: (sale.items || []).map((item) => ({
        name: item.description,
        qty: Number(item.quantity),
        lineTotal: Number(item.total),
      })),
    });
  };

  const voidSale = (sale: RecentCashSale) => {
    setVoidTarget(sale);
  };

  const openRefund = async (sale: RecentCashSale) => {
    let detail = sale;
    const missingIds = !(sale.items || []).some((i) => i.productId);
    if (missingIds) {
      try {
        const res = await api.getInvoice(sale.id);
        detail = res.data as RecentCashSale;
      } catch {
        /* use list payload */
      }
    }
    const qtys: Record<string, string> = {};
    for (const item of detail.items || []) {
      if (item.productId) qtys[item.productId] = "";
    }
    setRefundQtys(qtys);
    setRefundReason("");
    setRefundMethod("ORIGINAL");
    setRefundAwaitingApproval(false);
    setRefundTarget(detail);
  };

  const refundItemsPayload = () => {
    if (!refundTarget) return [];
    return Object.entries(refundQtys)
      .map(([productId, raw]) => ({
        productId,
        quantity: Number(raw),
      }))
      .filter((row) => row.quantity > 0.0005);
  };

  const confirmRefundSale = async (approval: DualApprovalPayload) => {
    if (!refundTarget) return;
    const items = refundItemsPayload();
    if (!items.length) {
      toast.error(t.refundSelect);
      return;
    }
    setRefundBusy(true);
    try {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline) {
        if (refundTarget.id.startsWith("OFF-") || !refundTarget.id) {
          toast.error(t.offlineOpLocalOnly);
          return;
        }
        const { enqueuePendingOp } = await import("@/lib/pos-offline-queue");
        await enqueuePendingOp({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          kind: "refund",
          invoiceId: refundTarget.id,
          payload: {
            items,
            reason: refundReason.trim() || undefined,
            refundMethod,
            approval,
          },
        });
        toast.success(t.opQueued);
        setRefundTarget(null);
        setRefundAwaitingApproval(false);
        return;
      }
      await api.refundPosSale(refundTarget.id, {
        items,
        reason: refundReason.trim() || undefined,
        refundMethod,
        approval,
      });
      toast.success(t.refundOk);
      setRefundTarget(null);
      setRefundAwaitingApproval(false);
      await loadRecentSales();
      await loadOpsStrip();
      await loadCatalog(search, warehouseId || undefined);
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.refundFail);
    } finally {
      setRefundBusy(false);
    }
  };

  const confirmVoidSale = async (approval: DualApprovalPayload) => {
    if (!voidTarget) return;
    setVoidBusy(true);
    try {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline) {
        if (voidTarget.id.startsWith("OFF-") || !voidTarget.id) {
          toast.error(t.offlineOpLocalOnly);
          return;
        }
        const { enqueuePendingOp } = await import("@/lib/pos-offline-queue");
        await enqueuePendingOp({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          kind: "void",
          invoiceId: voidTarget.id,
          payload: { approval },
        });
        toast.success(t.opQueued);
        setVoidTarget(null);
        return;
      }
      await api.voidPosSale(voidTarget.id, { approval });
      toast.success(t.voidOk);
      setLastInvoice((prev) => (prev?.number === voidTarget.number ? null : prev));
      setVoidTarget(null);
      await loadRecentSales();
      await loadOpsStrip();
      await loadCatalog(search, warehouseId || undefined);
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.voidFail);
    } finally {
      setVoidBusy(false);
    }
  };

  const saveNewCustomer = async () => {
    const name = newCustomerName.trim();
    const local = newCustomerLocal.replace(/\D/g, "").replace(/^0+/, "");
    if (!name) return;
    if (local.length < 7) {
      toast.error(t.phoneRequired);
      return;
    }
    const phone = combinePhone(newCustomerDial || defaultDial, local);
    if (!phone) {
      toast.error(t.phoneRequired);
      return;
    }
    setSavingCustomer(true);
    try {
      const email = newCustomerEmail.trim();
      const res = await api.createContact({
        type: "CUSTOMER",
        name,
        phone,
        ...(email ? { email } : {}),
      });
      const created = res.data as Contact;
      const contactRes = await api.getContacts("CUSTOMER");
      const contactRows = ((contactRes.data as Contact[]) || []).filter(
        (c) => c.isActive !== false,
      );
      setCustomers(contactRows);
      setContactId(created.id);
      setAddCustomerOpen(false);
      setNewCustomerName("");
      setNewCustomerLocal("");
      setNewCustomerEmail("");
      setNewCustomerDial(defaultDial);
      toast.success(t.customerSaved);
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setSavingCustomer(false);
    }
  };

  const runCheckout = async (
    method: CheckoutMethod,
    approval?: DualApprovalPayload,
    payments?: { method: CheckoutMethod; amount: number }[],
  ) => {
    if (!cart.length || paying) return;
    if (requireOpenShift && !shiftOpen) {
      toast(
        (toastId) => (
          <span className="text-sm">
            {t.requireOpenShiftToast}{" "}
            <Link
              href="/pos/shifts"
              className="underline font-semibold text-sky-300"
              onClick={() => toast.dismiss(toastId.id)}
            >
              {t.openShiftsLink}
            </Link>
          </span>
        ),
        { duration: 5000 },
      );
      setPendingCheckout(null);
      setCheckoutBusy(false);
      return;
    }

    // Refresh on-hand stock from catalog / lookup before pay
    let workingCart = cart;
    const minByProduct = new Map<string, number>();
    try {
      const refreshed = await Promise.all(
        cart.map(async (line) => {
          try {
            const res = await api.lookupPosProduct(line.sku, warehouseId || undefined);
            const p = res.data as PosProduct;
            const minQ =
              p.minQuantity != null && p.minQuantity !== ""
                ? Number(p.minQuantity)
                : NaN;
            if (Number.isFinite(minQ)) minByProduct.set(line.productId, minQ);
            return {
              ...line,
              stock: Number(p.quantity),
              isTracked: p.isTracked,
            };
          } catch {
            const fromCatalog = catalog.find((c) => c.id === line.productId);
            if (fromCatalog) {
              const minQ =
                fromCatalog.minQuantity != null && fromCatalog.minQuantity !== ""
                  ? Number(fromCatalog.minQuantity)
                  : NaN;
              if (Number.isFinite(minQ)) minByProduct.set(line.productId, minQ);
              return {
                ...line,
                stock: Number(fromCatalog.quantity),
                isTracked: fromCatalog.isTracked,
              };
            }
            return line;
          }
        }),
      );
      workingCart = refreshed;
      setCart(refreshed);
    } catch {
      /* use cart as-is */
    }

    const overStock = workingCart.filter(
      (l) => l.isTracked && l.quantity > l.stock,
    );
    if (overStock.length) {
      toast.error(
        `${t.stockExceedsBlock}: ${overStock.map((l) => `${l.name} (${l.stock})`).join(", ")}`,
      );
      setPendingCheckout(null);
      setCheckoutBusy(false);
      return;
    }

    const lowAfter = workingCart.filter((l) => {
      if (!l.isTracked) return false;
      const fromCatalog = catalog.find((c) => c.id === l.productId);
      const minQ =
        minByProduct.get(l.productId) ??
        (fromCatalog?.minQuantity != null && fromCatalog.minQuantity !== ""
          ? Number(fromCatalog.minQuantity)
          : 5);
      const threshold = Number.isFinite(minQ) ? minQ : 5;
      return l.stock - l.quantity <= threshold;
    });
    if (lowAfter.length && !window.confirm(t.stockLowAfterSale)) {
      setPendingCheckout(null);
      setCheckoutBusy(false);
      return;
    }

    const usesStoreCredit =
      method === "STORE_CREDIT" ||
      !!payments?.some((p) => p.method === "STORE_CREDIT");
    if (usesStoreCredit) {
      if (!contactId) {
        toast.error(t.storeCreditNeedCustomer);
        return;
      }
      const cust = customers.find((c) => c.id === contactId);
      const bal = Number(cust?.currentBalance ?? 0);
      const creditNeed = payments
        ? payments
            .filter((p) => p.method === "STORE_CREDIT")
            .reduce((sum, p) => sum + p.amount, 0)
        : total;
      if (bal + 0.0005 < creditNeed) {
        toast.error(t.storeCreditLow);
        return;
      }
    }
    if (
      (method === "PARTNER" || method === "TERMINAL") &&
      typeof navigator !== "undefined" &&
      navigator.onLine === false
    ) {
      toast.error(method === "TERMINAL" ? t.terminalTapOffline : t.partnerPayOffline);
      return;
    }
    const tipLine =
      tipValue > 0.0005 ? [{ name: t.tip, qty: 1, lineTotal: tipValue }] : [];
    const snapshot = [
      ...workingCart.map((l) => ({
        name: l.name,
        qty: l.quantity,
        lineTotal: lineTotal(l),
      })),
      ...tipLine,
    ];
    const saleNotes = cartNotes.trim()
      ? `${cartNotes.trim()} — Hisaby POS sale`
      : undefined;
    const useStoreCredit = method === "STORE_CREDIT" && !payments?.length;
    const isPartner =
      (method === "PARTNER" || method === "TERMINAL") && !payments?.length;
    const paymentLabelJoined = payments?.length
      ? payments
          .map((p) => `${paymentLabel(p.method)} ${p.amount.toFixed(3)}`)
          .join(" + ")
      : paymentLabel(method);
    const payload = {
      paymentMethod: payments?.length
        ? undefined
        : useStoreCredit
          ? "STORE_CREDIT"
          : isPartner
            ? "CREDIT_CARD"
            : method,
      partnerCheckout: isPartner || undefined,
      payments: payments?.length
        ? payments.map((p) => ({ method: p.method, amount: p.amount }))
        : undefined,
      tipAmount: tipValue > 0.0005 ? tipValue : undefined,
      useStoreCredit: useStoreCredit || undefined,
      notes: saleNotes,
      warehouseId: warehouseId || undefined,
      contactId: contactId || undefined,
      approval,
      items: workingCart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount || 0,
      })),
    };
    setPaying(true);
    try {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline) {
        if (usesStoreCredit || payments?.length) {
          toast.error(t.storeCreditOffline);
          return;
        }
        const { enqueuePendingSale } = await import("@/lib/pos-offline-queue");
        const { adjustCachedStock } = await import("@/lib/pos-catalog-cache");
        const localNumber = `OFF-${Date.now().toString(36).toUpperCase()}`;
        const clientSaleId = crypto.randomUUID();
        await enqueuePendingSale({
          id: clientSaleId,
          createdAt: new Date().toISOString(),
          payload: {
            items: payload.items,
            paymentMethod: method,
            tipAmount: payload.tipAmount,
            notes: saleNotes,
            warehouseId: warehouseId || undefined,
            contactId: contactId || undefined,
            clientSaleId,
          },
          receipt: {
            number: localNumber,
            total,
            lines: snapshot,
            paymentMethod: paymentLabelJoined,
            warehouseLabel: warehouseLabel || undefined,
          },
        });
        void adjustCachedStock(payload.items, warehouseId || undefined);
        setLastInvoice({
          number: localNumber,
          total,
          lines: snapshot,
          paymentMethod: paymentLabelJoined,
          warehouseLabel: warehouseLabel || undefined,
        });
        setCart([]);
        setCartNotes("");
        setTipAmount(0);
        setTipCustom("");
        setSplitOpen(false);
        setPendingCheckout(null);
        toast.success(t.saleQueued);
        focusScan();
        return;
      }

      const res = await api.createPosSale(payload);
      const inv = res.data as { id?: string; number?: string; total?: number | string };
      setLastInvoice({
        id: inv.id,
        number: inv.number,
        total: Number(inv.total),
        lines: snapshot,
        paymentMethod: paymentLabelJoined,
        warehouseLabel: warehouseLabel || undefined,
      });
      if (isPartner && inv.id) {
        setAwaitingPayId(inv.id);
        try {
          if (method === "TERMINAL") {
            const tapRes = await api.startPosTerminalTap(inv.id);
            const tap = tapRes.data as {
              mode?: string;
              checkoutUrl?: string | null;
              softposDeepLink?: string | null;
              sessionId?: string;
            };
            const url = tap.softposDeepLink || tap.checkoutUrl;
            if (url) {
              window.open(url, "_blank", "noopener,noreferrer");
              toast.success(t.terminalTapOpened);
            } else if (tap.mode === "mock") {
              await api.confirmPosTerminalTapMock(inv.id);
              setAwaitingPayId(null);
              toast.success(t.terminalTapMockOk);
            } else {
              toast.error(t.terminalTapFail);
            }
          } else {
            const payRes = await api.createPosPartnerCheckout(inv.id);
            const data = payRes.data as {
              checkout?: { redirectUrl?: string };
              checkoutUrl?: string;
            };
            const url = data?.checkout?.redirectUrl || data?.checkoutUrl;
            if (url) {
              window.open(url, "_blank", "noopener,noreferrer");
              toast.success(t.partnerPayOpened);
            } else {
              toast.error(t.partnerPayFail);
            }
          }
        } catch {
          toast.error(method === "TERMINAL" ? t.terminalTapFail : t.partnerPayFail);
        }
      }
      setCart([]);
      setCartNotes("");
      setTipAmount(0);
      setTipCustom("");
      setSplitOpen(false);
      setPendingCheckout(null);
      toast.success(isPartner ? t.partnerPayPending : t.saleOk);
      void maybeKickDrawer(
        payments?.some((p) => p.method === "CASH") ? "CASH" : method,
      );
      if (usesStoreCredit) {
        try {
          const cres = await api.getContacts("CUSTOMER");
          setCustomers(
            ((cres.data as Contact[]) || []).filter((c) => c.isActive !== false),
          );
        } catch {
          /* ignore */
        }
      }
      loadCatalog(search);
      loadRecentSales();
      loadOpsStrip();
      void refreshCustomerPurchases();
      focusScan();
    } catch (err: unknown) {
      const networkFail =
        !err ||
        (err as { code?: string; message?: string }).code === "ERR_NETWORK" ||
        /network/i.test(String((err as { message?: string }).message || ""));
      if (networkFail) {
        if (usesStoreCredit || payments?.length) {
          toast.error(t.storeCreditOffline);
          return;
        }
        try {
          const { enqueuePendingSale } = await import("@/lib/pos-offline-queue");
          const { adjustCachedStock } = await import("@/lib/pos-catalog-cache");
          const localNumber = `OFF-${Date.now().toString(36).toUpperCase()}`;
          const clientSaleId = crypto.randomUUID();
          await enqueuePendingSale({
            id: clientSaleId,
            createdAt: new Date().toISOString(),
            payload: {
              items: payload.items,
              paymentMethod: method,
              tipAmount: payload.tipAmount,
              notes: saleNotes,
              warehouseId: warehouseId || undefined,
              contactId: contactId || undefined,
              clientSaleId,
            },
            receipt: {
              number: localNumber,
              total,
              lines: snapshot,
              paymentMethod: paymentLabelJoined,
              warehouseLabel: warehouseLabel || undefined,
            },
          });
          void adjustCachedStock(payload.items, warehouseId || undefined);
          setLastInvoice({
            number: localNumber,
            total,
            lines: snapshot,
            paymentMethod: paymentLabelJoined,
            warehouseLabel: warehouseLabel || undefined,
          });
          setCart([]);
          setCartNotes("");
          setTipAmount(0);
          setTipCustom("");
          setSplitOpen(false);
          setPendingCheckout(null);
          toast.success(t.saleQueued);
          focusScan();
          return;
        } catch {
          /* fall through */
        }
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setPaying(false);
      setCheckoutBusy(false);
    }
  };

  const completeSplitCheckout = async () => {
    const cash = Math.max(0, parseFloat(splitCashAmt) || 0);
    const card = Math.max(0, parseFloat(splitCardAmt) || 0);
    const sum = Number((cash + card).toFixed(3));
    if (Math.abs(sum - total) > 0.005) {
      toast.error(t.splitSumMismatch);
      return;
    }
    const payments: { method: CheckoutMethod; amount: number }[] = [];
    if (cash > 0.0005) payments.push({ method: "CASH", amount: Number(cash.toFixed(3)) });
    if (card > 0.0005)
      payments.push({ method: "CREDIT_CARD", amount: Number(card.toFixed(3)) });
    if (!payments.length) {
      toast.error(t.splitSumMismatch);
      return;
    }
    const needsPriceApproval = cart.some(
      (l) => Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001,
    );
    if (needsPriceApproval) {
      setPendingSplitPayments(payments);
      setPendingCheckout(payments[0].method);
      return;
    }
    await runCheckout(payments[0].method, undefined, payments);
  };

  const checkout = async (method: CheckoutMethod) => {
    if (!cart.length || paying) return;
    if (requireOpenShift && !shiftOpen) {
      toast(
        (toastId) => (
          <span className="text-sm">
            {t.requireOpenShiftToast}{" "}
            <Link
              href="/pos/shifts"
              className="underline font-semibold text-sky-300"
              onClick={() => toast.dismiss(toastId.id)}
            >
              {t.openShiftsLink}
            </Link>
          </span>
        ),
        { duration: 5000 },
      );
      return;
    }
    if (method === "CASH") {
      setCashTendered(total > 0 ? String(Number(total.toFixed(3))) : "");
      setCashTenderOpen(true);
      return;
    }
    const needsPriceApproval = cart.some(
      (l) => Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001,
    );
    if (needsPriceApproval) {
      setPendingCheckout(method);
      return;
    }
    await runCheckout(method);
  };

  const confirmCashTender = async () => {
    const tendered = parseFloat(cashTendered);
    if (!Number.isFinite(tendered) || tendered + 0.0005 < total) {
      toast.error(t.amountTendered);
      return;
    }
    setCashTenderOpen(false);
    const needsPriceApproval = cart.some(
      (l) => Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001,
    );
    if (needsPriceApproval) {
      setPendingCheckout("CASH");
      return;
    }
    await runCheckout("CASH");
  };

  const findReceiptForRefund = async () => {
    const num = receiptLookup.trim();
    if (!num || receiptLookupBusy) return;
    setReceiptLookupBusy(true);
    try {
      const res = await api.getPosSaleByNumber(num);
      const sale = res.data as RecentCashSale;
      setReceiptLookup("");
      await openRefund(sale);
    } catch {
      toast.error(t.receiptNotFound);
    } finally {
      setReceiptLookupBusy(false);
    }
  };

  const showEmptyCatalog = catalogLoaded && catalog.length === 0 && !search.trim();
  const favoriteProducts = useMemo(
    () => catalog.filter((p) => favoriteIds.includes(p.id)),
    [catalog, favoriteIds],
  );
  const qtyKeypadLine = useMemo(
    () => cart.find((l) => l.productId === qtyKeypadLineId) || null,
    [cart, qtyKeypadLineId],
  );

  const toggleFavorite = (productId: string, e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!companyId) return;
    setFavoriteIds(togglePosFavorite(companyId, productId));
  };

  const REFUND_REASON_CHIPS = [
    { key: "damaged", label: t.refundReasonDamaged },
    { key: "wrong_item", label: t.refundReasonWrongItem },
    { key: "customer_return", label: t.refundReasonCustomerReturn },
    { key: "other", label: t.refundReasonOther },
  ] as const;

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

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 space-y-1">
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">{t.customer}</span>
            <ContactSearchSelect
              type="CUSTOMER"
              value={contactId}
              onChange={(id) => setContactId(id)}
              emptyLabel={t.walkIn}
              placeholder={t.searchCustomer}
              initialItems={customers}
              showBalance
              balanceLabel={t.creditBalance}
              defaultDialCode={defaultDial}
              variant="pos"
            />
            <button
              type="button"
              onClick={() => {
                setNewCustomerDial(defaultDial);
                setAddCustomerOpen(true);
              }}
              className="shrink-0 h-8 px-2 rounded-lg border border-sky-400/30 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/15 inline-flex items-center gap-1"
              title={t.addCustomer}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.addCustomer}</span>
            </button>
          </label>
          {contactId && loyaltyEnabled && customerLoyaltyPoints != null ? (
            <p className="text-[11px] text-violet-300/90 ps-0.5 tabular-nums">
              {t.points}: {Number(customerLoyaltyPoints).toFixed(0)}
            </p>
          ) : null}
          {contactId ? (
            <div className="pt-1.5 border-t border-white/5 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {t.recentPurchases}
              </p>
              {customerPurchasesLoading ? (
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  …
                </p>
              ) : !customerRecentPurchases.length ? (
                <p className="text-[11px] text-slate-500">{t.noRecentPurchases}</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {customerRecentPurchases.map((sale) => {
                    const when = sale.date || sale.createdAt;
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => reprintSale(sale)}
                        className="shrink-0 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-start min-w-[7.5rem] hover:border-sky-400/40 transition"
                        title={t.reprint}
                      >
                        <p className="text-[10px] text-slate-500">
                          {when ? new Date(when).toLocaleDateString() : "—"}
                        </p>
                        <p className="text-[11px] font-bold text-white truncate">{sale.number}</p>
                        <p className="text-[11px] text-sky-300 font-semibold">
                          {formatMoney(Number(sale.total), currency)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleScan} className="space-y-1.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
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
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="h-14 min-w-14 px-4 rounded-2xl border border-sky-400/40 text-sky-200 font-bold hover:bg-sky-500/15 transition inline-flex items-center justify-center gap-2"
                title={t.scanCamera}
                aria-label={t.scanCamera}
              >
                <Camera className="w-5 h-5" />
                <span className="sm:hidden text-sm">{t.scanCamera}</span>
              </button>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="h-14 min-w-14 px-3 rounded-2xl border border-white/15 text-slate-300 font-bold hover:bg-white/5 transition inline-flex items-center justify-center"
                title={t.shortcutsTitle}
                aria-label={t.shortcutsTitle}
              >
                <CircleHelp className="w-5 h-5" />
              </button>
              <button
                type="submit"
                className="h-14 flex-1 sm:flex-none px-5 rounded-2xl bg-sky-500 text-white font-bold hover:bg-sky-400 transition"
              >
                Enter
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <ScanBarcode className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {t.barcodeHint}
            </span>
            <span className="text-slate-600">{t.escHint}</span>
          </p>
        </form>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
          />
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            disabled={catalogRefreshing}
            className="h-11 shrink-0 px-3 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
            title={t.refreshCatalog}
          >
            {catalogRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {t.refreshCatalog}
          </button>
        </div>
        {catalogStale ? (
          <p className="text-[11px] text-amber-300/90 px-1">{t.catalogStale}</p>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <Link
                href="/pos/shifts"
                className={`font-semibold hover:underline ${
                  shiftOpen ? "text-emerald-300" : "text-slate-500"
                }`}
              >
                {shiftOpen ? t.shiftStripOpen : t.shiftStripClosed}
              </Link>
              {todayStats ? (
                <span className="text-slate-400">
                  {t.todaySales}:{" "}
                  <span className="text-white font-semibold">{todayStats.salesCount}</span>
                  {" · "}
                  <span className="text-sky-300 font-semibold">
                    {formatMoney(todayStats.salesTotal, currency)}
                  </span>
                  {todayStats.voidCount || todayStats.refundCount ? (
                    <span className="text-slate-500 ms-1">
                      ({t.zVoids} {todayStats.voidCount} · {t.zRefunds} {todayStats.refundCount})
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-bold text-slate-300">{t.recentSales}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void findReceiptForRefund();
            }}
            className="flex gap-2"
          >
            <input
              value={receiptLookup}
              onChange={(e) => setReceiptLookup(e.target.value)}
              placeholder={t.findReceipt}
              className="flex-1 min-w-0 h-9 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!receiptLookup.trim() || receiptLookupBusy}
              className="shrink-0 h-9 px-3 rounded-lg border border-amber-400/30 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/15 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {receiptLookupBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t.refundSale}
            </button>
          </form>
          {!recentSales.length ? (
            <p className="text-[11px] text-slate-500">{t.noRecentSales}</p>
          ) : null}
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
                  <button
                    type="button"
                    onClick={() => openRefund(sale)}
                    className="w-full h-7 rounded-lg border border-amber-500/30 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/15 transition"
                  >
                    {t.refundSale}
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
          <>
            {favoriteProducts.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-300/90 uppercase tracking-wide px-1">
                  {t.favorites}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {favoriteProducts.map((p) => (
                    <button
                      key={`fav-${p.id}`}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="shrink-0 max-w-[10rem] text-start rounded-xl border border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 transition"
                    >
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-sky-300 font-bold mt-0.5">
                        {formatMoney(Number(p.salePrice), currency)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[52vh] overflow-y-auto pe-1">
              {catalog.map((p) => {
                const qty = Number(p.quantity);
                const minQ =
                  p.minQuantity != null && p.minQuantity !== ""
                    ? Number(p.minQuantity)
                    : 5;
                const threshold = Number.isFinite(minQ) ? minQ : 5;
                const showLow = p.isTracked && qty <= threshold;
                const isFav = favoriteIds.includes(p.id);
                return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="relative text-start rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-sky-500/10 hover:border-sky-400/40 p-3 transition"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    title={isFav ? t.unpinFavorite : t.pinFavorite}
                    aria-label={isFav ? t.unpinFavorite : t.pinFavorite}
                    onClick={(e) => toggleFavorite(p.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleFavorite(p.id);
                      }
                    }}
                    className="absolute top-2 start-2 z-10 p-1 rounded-md hover:bg-black/30"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFav ? "fill-amber-400 text-amber-400" : "text-slate-500"
                      }`}
                    />
                  </span>
                  {showLow ? (
                    <span className="absolute top-2 end-2 rounded-md bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                      {t.lowStock}
                    </span>
                  ) : null}
                  <p className="font-semibold text-sm line-clamp-2 pe-10 ps-6">{p.name}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{p.sku}</p>
                  {p.barcode ? (
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{p.barcode}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sky-300 font-bold text-sm">
                      {formatMoney(Number(p.salePrice), currency)}
                    </span>
                    <span
                      className={`text-[10px] ${showLow ? "text-amber-300 font-semibold" : "text-slate-500"}`}
                    >
                      {t.stock} {qty}
                    </span>
                  </div>
                </button>
                );
              })}
              {catalogLoaded && catalog.length === 0 && search.trim() ? (
                <p className="col-span-full text-center text-sm text-slate-500 py-8">{t.notFound}</p>
              ) : null}
            </div>
          </>
        )}
      </section>

      <aside className="lg:col-span-5 xl:col-span-4 mt-4 lg:mt-0 rounded-3xl border border-white/10 bg-[#111827] flex flex-col min-h-[420px] pb-28 lg:pb-0">
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
                    {p.notes ? (
                      <p className="text-[10px] text-amber-200/80 truncate">{p.notes}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void editParkedNotes(p)}
                    className="h-7 px-2 rounded-md text-[10px] font-semibold text-slate-400 hover:bg-white/10"
                    title={t.editParkNotes}
                  >
                    {t.editParkNotes}
                  </button>
                  <button
                    type="button"
                    onClick={() => void renameParked(p)}
                    className="h-7 px-2 rounded-md text-[10px] font-semibold text-slate-400 hover:bg-white/10"
                    title={t.renameParked}
                  >
                    {t.renameParked}
                  </button>
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
                  <button
                    type="button"
                    className="w-8 h-8 grid place-items-center rounded-md hover:bg-white/10 text-sm font-bold tabular-nums"
                    onClick={() => setQtyKeypadLineId(l.productId)}
                    title={t.qty}
                  >
                    {l.quantity}
                  </button>
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
                  readOnly={!canOverridePrice}
                  disabled={!canOverridePrice}
                  onChange={(e) => {
                    if (!canOverridePrice) return;
                    const next = Math.max(0, parseFloat(e.target.value) || 0);
                    setCart((prev) =>
                      prev.map((x) =>
                        x.productId === l.productId ? { ...x, unitPrice: next } : x,
                      ),
                    );
                  }}
                  className={`w-24 h-8 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white ${
                    !canOverridePrice ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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

        <div className="border-t border-white/10 p-4 space-y-3 sticky bottom-0 z-20 bg-[#111827] lg:static shadow-[0_-8px_24px_rgba(0,0,0,0.35)] lg:shadow-none">
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-500">{t.parkNotes}</label>
            <textarea
              value={cartNotes}
              onChange={(e) => setCartNotes(e.target.value)}
              rows={2}
              placeholder={t.parkNotesPlaceholder}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 resize-none"
            />
          </div>
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
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 text-sm">{t.tip}</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={!cart.length}
                      onClick={() => applyTipPercent(pct)}
                      className="h-7 px-2 rounded-md text-[10px] font-semibold border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-40"
                    >
                      {pct === 0 ? "0" : `${pct}%`}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={tipCustom}
                    disabled={!cart.length}
                    onChange={(e) => {
                      setTipCustom(e.target.value);
                      setTipAmount(Math.max(0, parseFloat(e.target.value) || 0));
                    }}
                    placeholder={t.tipCustom}
                    className="w-20 h-7 px-2 rounded-md bg-black/30 border border-white/10 text-xs text-end text-white disabled:opacity-40"
                  />
                </div>
              </div>
              {tipValue > 0.0005 ? (
                <div className="flex justify-between text-slate-400">
                  <span>{t.tip}</span>
                  <span>{formatMoney(tipValue, currency)}</span>
                </div>
              ) : null}
            </div>
            <div className="flex justify-between text-lg font-extrabold text-white pt-1">
              <span>{t.total}</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </div>
          {splitOpen ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-200">{t.splitTender}</p>
                <button
                  type="button"
                  className="text-[10px] text-slate-400 hover:text-white"
                  onClick={() => setSplitOpen(false)}
                >
                  {t.clear}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-400 space-y-1">
                  <span>{t.splitCash}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={splitCashAmt}
                    onChange={(e) => {
                      const cash = Math.max(0, parseFloat(e.target.value) || 0);
                      setSplitCashAmt(e.target.value);
                      setSplitCardAmt(
                        String(Number(Math.max(0, total - cash).toFixed(3))),
                      );
                    }}
                    className="w-full h-9 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                  />
                </label>
                <label className="text-[11px] text-slate-400 space-y-1">
                  <span>{t.splitCard}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={splitCardAmt}
                    onChange={(e) => {
                      const card = Math.max(0, parseFloat(e.target.value) || 0);
                      setSplitCardAmt(e.target.value);
                      setSplitCashAmt(
                        String(Number(Math.max(0, total - card).toFixed(3))),
                      );
                    }}
                    className="w-full h-9 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={!cart.length || paying}
                onClick={() => void completeSplitCheckout()}
                className="w-full min-h-11 h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40 hover:bg-amber-400 text-sm"
              >
                {paying && <Loader2 className="w-4 h-4 animate-spin inline me-2" />}
                {t.splitCheckout}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={openSplitTender}
              className="w-full min-h-9 h-9 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              {t.splitTender}
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CASH")}
              className="min-h-12 h-12 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40 hover:bg-emerald-400 inline-flex items-center justify-center gap-2 text-sm"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.payCash}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("CREDIT_CARD")}
              className="min-h-12 h-12 rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40 hover:bg-sky-400 text-sm"
            >
              {t.payCard}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("PARTNER")}
              className="min-h-12 h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-40 hover:bg-violet-500 text-sm"
              title={t.partnerPayHint}
            >
              {t.partnerPay}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("TERMINAL")}
              className="min-h-12 h-12 rounded-xl bg-fuchsia-600 text-white font-bold disabled:opacity-40 hover:bg-fuchsia-500 text-sm"
              title={t.terminalTapHint}
            >
              {t.terminalTap}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying}
              onClick={() => checkout("BANK_TRANSFER")}
              className="min-h-12 h-12 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-40 hover:bg-teal-500 text-sm"
            >
              {t.payBank}
            </button>
            <button
              type="button"
              disabled={!cart.length || paying || !contactId}
              onClick={() => checkout("STORE_CREDIT")}
              className="min-h-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40 hover:bg-amber-400 text-sm"
              title={!contactId ? t.storeCreditNeedCustomer : undefined}
            >
              {t.payStoreCredit}
            </button>
          </div>
          {awaitingPayId ? (
            <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100 flex items-center justify-between gap-2">
              <span>{t.partnerPayPending}</span>
              <button
                type="button"
                className="underline font-semibold"
                onClick={() => setAwaitingPayId(null)}
              >
                ✕
              </button>
            </div>
          ) : null}
          {lastInvoice && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => printReceiptSnapshot(lastInvoice)}
                className="w-full min-h-10 h-10 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5"
              >
                {t.printReceipt} · {lastInvoice.number}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPosReceiptWhatsApp({
                      companyName: company?.name,
                      number: lastInvoice.number,
                      warehouseLabel: lastInvoice.warehouseLabel,
                      paymentMethod: lastInvoice.paymentMethod,
                      total: lastInvoice.total,
                      currency,
                      lines: lastInvoice.lines,
                    })
                  }
                  className="min-h-10 h-10 rounded-xl border border-emerald-500/30 text-sm text-emerald-200 hover:bg-emerald-500/10"
                >
                  {t.shareWhatsApp}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPosReceiptEmail({
                      companyName: company?.name,
                      number: lastInvoice.number,
                      warehouseLabel: lastInvoice.warehouseLabel,
                      paymentMethod: lastInvoice.paymentMethod,
                      total: lastInvoice.total,
                      currency,
                      lines: lastInvoice.lines,
                    })
                  }
                  className="min-h-10 h-10 rounded-xl border border-sky-500/30 text-sm text-sky-200 hover:bg-sky-500/10"
                >
                  {t.shareEmail}
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!lastInvoice.id) {
                    toast.error(t.partnerPayOffline);
                    return;
                  }
                  try {
                    const res = await api.createPosPartnerCheckout(lastInvoice.id);
                    const data = res.data as {
                      checkout?: { redirectUrl?: string };
                      checkoutUrl?: string;
                    };
                    const url = data?.checkout?.redirectUrl || data?.checkoutUrl;
                    if (url) {
                      window.open(url, "_blank", "noopener,noreferrer");
                      toast.success(t.partnerPayOpened);
                    } else {
                      toast.error(t.partnerPayFail);
                    }
                  } catch {
                    toast.error(t.partnerPayFail);
                  }
                }}
                className="w-full min-h-10 h-10 rounded-xl border border-violet-500/30 text-sm text-violet-200 hover:bg-violet-500/10"
                title={t.partnerPayHint}
              >
                {t.partnerPay}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { tryPrintEscPosSmart } = await import("@/lib/pos-escpos");
                    const ok = await tryPrintEscPosSmart({
                      brand: t.brand,
                      companyName: company?.name || "",
                      vatNumber: company?.vatNumber || undefined,
                      warehouseLabel: lastInvoice.warehouseLabel,
                      number: lastInvoice.number,
                      paymentMethod: lastInvoice.paymentMethod,
                      totalLabel: t.total,
                      total: lastInvoice.total || 0,
                      currency,
                      lines: lastInvoice.lines || [],
                    });
                    if (!ok) toast.error(t.thermalFail);
                  } catch {
                    toast.error(t.thermalFail);
                  }
                }}
                className="w-full min-h-10 h-10 rounded-xl border border-amber-500/30 text-sm text-amber-200 hover:bg-amber-500/10"
              >
                {t.thermalPrint}
              </button>
              {webSerialOk ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { tryOpenCashDrawer } = await import("@/lib/pos-escpos");
                      const ok = await tryOpenCashDrawer();
                      if (!ok) toast.error(t.thermalFail);
                    } catch {
                      toast.error(t.thermalFail);
                    }
                  }}
                  className="w-full min-h-10 h-10 rounded-xl border border-emerald-500/30 text-sm text-emerald-200 hover:bg-emerald-500/10"
                >
                  {t.openDrawer}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </aside>

      {addCustomerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-white">{t.addCustomer}</p>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => !savingCustomer && setAddCustomerOpen(false)}
              >
                ✕
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">{t.customerName}</span>
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                autoFocus
              />
            </label>
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400">{t.customerPhone} *</span>
              <div className="flex gap-2">
                <label className="w-[7.5rem] shrink-0 space-y-0.5">
                  <span className="text-[10px] text-slate-500">{t.phoneCountryCode}</span>
                  <select
                    value={newCustomerDial}
                    onChange={(e) => setNewCustomerDial(e.target.value)}
                    className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-2 text-sm text-white"
                  >
                    {PHONE_DIAL_CODES.map((dc) => (
                      <option key={dc.code} value={dc.code} className="bg-[#111827]">
                        {locale === "en" ? dc.labelEn : dc.labelAr}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-500">{t.phoneLocal}</span>
                  <input
                    value={newCustomerLocal}
                    onChange={(e) =>
                      setNewCustomerLocal(
                        e.target.value.replace(/\D/g, "").replace(/^0+/, ""),
                      )
                    }
                    className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                    inputMode="numeric"
                    placeholder="9xxxxxxx"
                  />
                </label>
              </div>
              {newCustomerLocal.length >= 7 ? (
                <p className="text-[11px] text-sky-300/90">
                  {t.phonePreview}: {combinePhone(newCustomerDial, newCustomerLocal)}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">{t.phoneRequired}</p>
              )}
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">{t.customerEmail}</span>
              <input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                inputMode="email"
              />
            </label>
            <button
              type="button"
              disabled={
                !newCustomerName.trim() ||
                newCustomerLocal.replace(/\D/g, "").length < 7 ||
                savingCustomer
              }
              onClick={() => void saveNewCustomer()}
              className="w-full h-11 rounded-xl bg-sky-500 text-white font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {savingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.addCustomer}
            </button>
          </div>
        </div>
      ) : null}

      <BarcodeCameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => void applyScanCode(code)}
      />

      {cashTenderOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-white">{t.payCash}</p>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => !paying && setCashTenderOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="flex justify-between text-sm text-slate-300">
              <span>{t.total}</span>
              <span className="font-semibold text-white">{formatMoney(total, currency)}</span>
            </div>
            <label className="space-y-1.5 block">
              <span className="text-[11px] text-slate-400">{t.amountTendered}</span>
              <input
                type="number"
                min={0}
                step={0.001}
                autoFocus
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void confirmCashTender();
                  }
                }}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-base text-white"
              />
            </label>
            {(() => {
              const tendered = parseFloat(cashTendered);
              const ok = Number.isFinite(tendered) && tendered + 0.0005 >= total;
              const change = ok ? tendered - total : 0;
              return (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{t.changeDue}</span>
                  <span className={`font-bold ${ok ? "text-emerald-300" : "text-slate-500"}`}>
                    {ok ? formatMoney(change, currency) : "—"}
                  </span>
                </div>
              );
            })()}
            <button
              type="button"
              disabled={
                paying ||
                !Number.isFinite(parseFloat(cashTendered)) ||
                parseFloat(cashTendered) + 0.0005 < total
              }
              onClick={() => void confirmCashTender()}
              className="w-full h-11 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.confirmCash}
            </button>
          </div>
        </div>
      ) : null}

      <DualApprovalModal
        open={!!voidTarget}
        action="POS_VOID"
        actionLabel={t.voidConfirm}
        payload={voidTarget ? { invoiceId: voidTarget.id } : undefined}
        summary={voidTarget ? `${t.voidSale}: ${voidTarget.number}` : undefined}
        actorRole={user?.role}
        busy={voidBusy}
        onCancel={() => !voidBusy && setVoidTarget(null)}
        onConfirm={confirmVoidSale}
      />

      {refundTarget && !refundAwaitingApproval ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-white">{t.refundTitle}</p>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => setRefundTarget(null)}
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {refundTarget.number} · {t.refundSelect}
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {(refundTarget.items || [])
                .filter((item) => item.productId)
                .map((item) => (
                  <div
                    key={item.productId!}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{item.description}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.qty}: {Number(item.quantity)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={Number(item.quantity)}
                      step="0.001"
                      value={refundQtys[item.productId!] ?? ""}
                      onChange={(e) =>
                        setRefundQtys((prev) => ({
                          ...prev,
                          [item.productId!]: e.target.value,
                        }))
                      }
                      placeholder={t.refundQty}
                      className="h-9 w-24 rounded-lg bg-white/5 border border-white/10 px-2 text-sm text-white"
                    />
                  </div>
                ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400">{t.refundReason}</p>
              <div className="flex flex-wrap gap-1.5">
                {REFUND_REASON_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setRefundReason(chip.label)}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                      refundReason === chip.label
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                        : "border-white/10 text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t.refundReason}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <label className="space-y-1.5 block">
              <span className="text-[11px] text-slate-400">{t.refundMethod}</span>
              <select
                value={refundMethod}
                onChange={(e) =>
                  setRefundMethod(e.target.value as "ORIGINAL" | "CASH" | "STORE_CREDIT")
                }
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
              >
                <option value="ORIGINAL" className="bg-[#111827] text-white">
                  {t.refundOriginal}
                </option>
                <option value="CASH" className="bg-[#111827] text-white">
                  {t.refundCash}
                </option>
                <option value="STORE_CREDIT" className="bg-[#111827] text-white">
                  {t.refundStoreCredit}
                </option>
              </select>
            </label>
            <button
              type="button"
              disabled={!refundItemsPayload().length}
              onClick={() => setRefundAwaitingApproval(true)}
              className="w-full h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40"
            >
              {t.refundContinue}
            </button>
          </div>
        </div>
      ) : null}

      <DualApprovalModal
        open={!!refundTarget && refundAwaitingApproval}
        action="POS_REFUND"
        actionLabel={t.refundTitle}
        payload={
          refundTarget
            ? { invoiceId: refundTarget.id, items: refundItemsPayload() }
            : undefined
        }
        summary={refundTarget ? `${t.refundSale}: ${refundTarget.number}` : undefined}
        actorRole={user?.role}
        busy={refundBusy}
        onCancel={() => {
          if (!refundBusy) {
            setRefundAwaitingApproval(false);
            setRefundTarget(null);
          }
        }}
        onConfirm={confirmRefundSale}
      />

      <DualApprovalModal
        open={!!pendingCheckout}
        action="POS_PRICE_OVERRIDE"
        actionLabel={locale === "en" ? "Confirm price override" : "تأكيد تجاوز السعر"}
        payload={{ method: pendingCheckout || undefined }}
        summary={locale === "en" ? "POS price override" : "تجاوز سعر الكاشير"}
        actorRole={user?.role}
        busy={checkoutBusy || paying}
        onCancel={() => {
          if (!checkoutBusy && !paying) {
            setPendingCheckout(null);
            setPendingSplitPayments(null);
          }
        }}
        onConfirm={async (approval) => {
          if (!pendingCheckout) return;
          setCheckoutBusy(true);
          const split = pendingSplitPayments;
          setPendingSplitPayments(null);
          await runCheckout(pendingCheckout, approval, split || undefined);
        }}
      />

      <QtyKeypadModal
        open={!!qtyKeypadLine}
        title={qtyKeypadLine?.name || t.qty}
        initialQty={qtyKeypadLine?.quantity || 1}
        maxQty={qtyKeypadLine?.isTracked ? qtyKeypadLine.stock : null}
        stockLabel={t.stock}
        okLabel={t.keypadOk}
        clearLabel={t.keypadClear}
        onCancel={() => setQtyKeypadLineId(null)}
        onConfirm={(qty) => {
          if (!qtyKeypadLineId) return;
          setCart((prev) =>
            prev
              .map((x) => {
                if (x.productId !== qtyKeypadLineId) return x;
                if (x.isTracked && qty > x.stock) {
                  toast.error(`${t.stock}: ${x.stock}`);
                  return { ...x, quantity: x.stock };
                }
                return { ...x, quantity: qty };
              })
              .filter((x) => x.quantity > 0),
          );
          setQtyKeypadLineId(null);
          focusScan();
        }}
      />

      {shortcutsOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-white">{t.shortcutsTitle}</p>
              <button
                type="button"
                className="text-slate-400 text-sm px-2"
                onClick={() => setShortcutsOpen(false)}
              >
                ✕
              </button>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>{t.shortcutEsc}</li>
              <li>{t.shortcutScan}</li>
              <li>{t.shortcutHelp}</li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
