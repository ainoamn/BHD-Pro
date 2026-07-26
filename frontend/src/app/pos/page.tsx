"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Camera,
  CircleHelp,
  Minus,
  Monitor,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  ScanBarcode,
  ScanSearch,
  ShoppingCart,
  Star,
  Trash2,
  UserPlus,
  Warehouse,
  Wallet,
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
import { playPosScanBeep, playPosWarnBeep, playPosDenyBeep } from "@/lib/pos-beep";
import {
  clearPosCartSession,
  loadPosCartSession,
  POS_DUP_SALE_WINDOW_MS,
  posCartFingerprint,
  readLastSaleFingerprint,
  savePosCartSession,
  writeLastSaleFingerprint,
} from "@/lib/pos-cart-session";
import {
  openPosCustomerDisplayWindow,
  publishPosCustomerDisplay,
} from "@/lib/pos-customer-display";
import { openPosReceiptEmail, sharePosReceiptWhatsAppWithPdf } from "@/lib/pos-receipt-share";
import {
  printPosReceiptBrowser,
  type PosReceiptPrintData,
} from "@/lib/pos-receipt-print";
import { formatCompanyAddressCompact } from "@/lib/contact-address";
import { toAppAbsoluteUrl } from "@/lib/app-url";
import { loadPosFavorites, syncPosFavoritesFromCloud, togglePosFavorite } from "@/lib/pos-favorites";
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
  barcode?: string | null;
  unitPrice: number;
  catalogPrice: number;
  quantity: number;
  discount: number;
  stock: number;
  isTracked: boolean;
  notes?: string;
};

type ParkedCart = {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  warehouseId: string;
  contactId?: string;
  contactPhone?: string;
  contactName?: string;
  heldAmount?: number | null;
  heldMethod?: string | null;
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
  lines?: {
    name: string;
    qty: number;
    lineTotal: number;
    barcode?: string | null;
    sku?: string | null;
    note?: string | null;
  }[];
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
  contact?: { id?: string; name?: string; phone?: string | null } | null;
  items?: {
    productId?: string | null;
    description: string;
    quantity: number | string;
    unitPrice?: number | string;
    total: number | string;
    notes?: string | null;
    product?: { barcode?: string | null; sku?: string | null } | null;
  }[];
  payments?: { method?: string; amount?: number | string }[];
  reprintCount?: number;
};

export default function PosCheckoutPage() {
  const locale = useLocaleStore((s) => s.locale);
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const scanRef = useRef<HTMLInputElement>(null);
  const receiptLookupRef = useRef<HTMLInputElement>(null);
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
  const [parkSearch, setParkSearch] = useState("");
  const [restorePrompt, setRestorePrompt] = useState<{
    warehouseId: string;
    contactId: string;
    cartNotes: string;
    tipAmount: number;
    tipCustom: string;
    redeemPointsInput: string;
    cart: CartLine[];
  } | null>(null);
  const [parkEdit, setParkEdit] = useState<{
    id: string;
    name: string;
    notes: string;
  } | null>(null);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [customerRecentPurchases, setCustomerRecentPurchases] = useState<RecentCashSale[]>([]);
  const [customerPurchasesLoading, setCustomerPurchasesLoading] = useState(false);
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState<number | null>(null);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [redeemEnabled, setRedeemEnabled] = useState(false);
  const [redeemRate, setRedeemRate] = useState(0);
  const [redeemPointsInput, setRedeemPointsInput] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
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
  const [pendingAllowNegativeStock, setPendingAllowNegativeStock] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [priceCheckMode, setPriceCheckMode] = useState(false);
  const [priceCheckProduct, setPriceCheckProduct] = useState<{
    name: string;
    price: number;
    stock: number;
    sku?: string;
    barcode?: string | null;
  } | null>(null);
  const [noSaleOpen, setNoSaleOpen] = useState(false);
  const [noSaleReason, setNoSaleReason] = useState("");
  const [noSaleAwaitingApproval, setNoSaleAwaitingApproval] = useState(false);
  const [noSaleBusy, setNoSaleBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [catalogStale, setCatalogStale] = useState(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [awaitingPayId, setAwaitingPayId] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftOpenedAt, setShiftOpenedAt] = useState<string | null>(null);
  const [tipAssigneeId, setTipAssigneeId] = useState("");
  const [tipStaff, setTipStaff] = useState<{ id: string; name: string }[]>([]);
  const [parkSuspendReason, setParkSuspendReason] = useState("");
  const [todayStats, setTodayStats] = useState<{
    salesCount: number;
    salesTotal: number;
    refundCount: number;
    voidCount: number;
    mine?: { salesCount: number; salesTotal: number };
  } | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerDial, setNewCustomerDial] = useState(DEFAULT_DIAL_CODE);
  const [newCustomerLocal, setNewCustomerLocal] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickBarcode, setQuickBarcode] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickCategory, setQuickCategory] = useState("General");
  const [savingProduct, setSavingProduct] = useState(false);
  const [webSerialOk, setWebSerialOk] = useState(false);
  const [qtyKeypadLineId, setQtyKeypadLineId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cartNotes, setCartNotes] = useState("");
  const [parkHoldOpen, setParkHoldOpen] = useState(false);
  const [parkHoldAmount, setParkHoldAmount] = useState("");
  const [parkHoldMethod, setParkHoldMethod] = useState<
    "CASH" | "CREDIT_CARD" | "BANK_TRANSFER"
  >("CASH");
  const [recalledDraftId, setRecalledDraftId] = useState<string | null>(null);
  const [heldDeposit, setHeldDeposit] = useState<{
    amount: number;
    method: string;
  } | null>(null);
  const [creditTopUpOpen, setCreditTopUpOpen] = useState(false);
  const [creditTopUpAmount, setCreditTopUpAmount] = useState("");
  const [creditTopUpMethod, setCreditTopUpMethod] = useState<
    "CASH" | "CREDIT_CARD" | "BANK_TRANSFER"
  >("CASH");
  const [creditTopUpBusy, setCreditTopUpBusy] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipCustom, setTipCustom] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCashAmt, setSplitCashAmt] = useState("");
  const [splitCardAmt, setSplitCardAmt] = useState("");
  const [splitBankAmt, setSplitBankAmt] = useState("");
  const [splitCreditAmt, setSplitCreditAmt] = useState("");

  const currency = company?.currency || "OMR";
  const companyId = company?.id;
  const defaultDial =
    PHONE_DIAL_CODES.find((d) => d.country === company?.country)?.code ??
    DEFAULT_DIAL_CODE;
  const canOverridePrice = true; // any POS staff; dual-control required at checkout
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
      return res.data as {
        requireOpenShift?: boolean;
        maxLineDiscountAmount?: number;
        maxLineDiscountPercent?: number;
      };
    },
    staleTime: 60_000,
  });
  const requireOpenShift = securityConfig?.requireOpenShift === true;
  const maxLineDiscountAmount =
    typeof securityConfig?.maxLineDiscountAmount === "number" &&
    securityConfig.maxLineDiscountAmount >= 0
      ? securityConfig.maxLineDiscountAmount
      : 5;
  const maxLineDiscountPercent =
    typeof securityConfig?.maxLineDiscountPercent === "number" &&
    securityConfig.maxLineDiscountPercent >= 0
      ? securityConfig.maxLineDiscountPercent
      : 20;

  const lineNeedsDiscountApproval = useCallback(
    (l: { unitPrice: number; quantity: number; discount?: number }) => {
      const discount = Number(l.discount || 0);
      if (discount <= 0.0005) return false;
      const lineGross = Number(l.unitPrice) * Number(l.quantity);
      const pct = lineGross > 0.0005 ? (discount / lineGross) * 100 : 0;
      return (
        discount > maxLineDiscountAmount + 0.0005 ||
        pct > maxLineDiscountPercent + 0.0005
      );
    },
    [maxLineDiscountAmount, maxLineDiscountPercent],
  );

  const cartNeedsPriceApproval = useCallback(
    () =>
      cart.some(
        (l) => Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001,
      ),
    [cart],
  );

  const cartNeedsDiscountApproval = useCallback(
    () => cart.some((l) => lineNeedsDiscountApproval(l)),
    [cart, lineNeedsDiscountApproval],
  );

  const cartNeedsCheckoutApproval = useCallback(
    () => cartNeedsPriceApproval() || cartNeedsDiscountApproval(),
    [cartNeedsPriceApproval, cartNeedsDiscountApproval],
  );

  const checkoutApprovalAction = useCallback(():
    | "POS_PRICE_OVERRIDE"
    | "POS_LINE_DISCOUNT"
    | "POS_STOCK_OVERRIDE" => {
    if (cartNeedsPriceApproval()) return "POS_PRICE_OVERRIDE";
    if (cartNeedsDiscountApproval()) return "POS_LINE_DISCOUNT";
    return "POS_STOCK_OVERRIDE";
  }, [cartNeedsPriceApproval, cartNeedsDiscountApproval]);

  useEffect(() => {
    setFavoriteIds(loadPosFavorites(companyId));
    if (!companyId) return;
    let cancelled = false;
    void syncPosFavoritesFromCloud(companyId).then((ids) => {
      if (!cancelled) setFavoriteIds(ids);
    });
    return () => {
      cancelled = true;
    };
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
      const opened = (shiftRes.data?.shift as { openedAt?: string } | null)?.openedAt;
      setShiftOpenedAt(opened || null);
      const s = statsRes.data;
      setTodayStats(
        s
          ? {
              salesCount: Number(s.store?.salesCount ?? s.salesCount) || 0,
              salesTotal: Number(s.store?.salesTotal ?? s.salesTotal) || 0,
              refundCount: Number(s.store?.refundCount ?? s.refundCount) || 0,
              voidCount: Number(s.store?.voidCount ?? s.voidCount) || 0,
              mine: s.mine
                ? {
                    salesCount: Number(s.mine.salesCount) || 0,
                    salesTotal: Number(s.mine.salesTotal) || 0,
                  }
                : undefined,
            }
          : null,
      );
    } catch {
      /* ignore */
    }
  }, [warehouseId]);

  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsSearch, setReceiptsSearch] = useState("");

  const loadRecentSales = useCallback(async (q?: string) => {
    setReceiptsLoading(true);
    try {
      const res = await api.listRecentPosSales({
        take: q?.trim() ? 40 : 20,
        warehouseId: warehouseId || undefined,
        q: q?.trim() || undefined,
      });
      const rows = ((res.data as RecentCashSale[]) || []).filter(
        (inv) => String(inv.status || "").toUpperCase() !== "CANCELLED",
      );
      setRecentSales(rows);
    } catch {
      /* ignore */
    } finally {
      setReceiptsLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (!receiptsOpen) return;
    const q = receiptsSearch.trim();
    const id = window.setTimeout(() => {
      void loadRecentSales(q || undefined);
    }, q ? 280 : 0);
    return () => window.clearTimeout(id);
  }, [receiptsOpen, receiptsSearch, loadRecentSales]);

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
      setRedeemEnabled(false);
      setRedeemPointsInput("");
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
          setRedeemEnabled(!!pts.data.redeemEnabled);
          setRedeemRate(Number(pts.data.redeemPointsPerUnit) || 0);
          setCustomerLoyaltyPoints(
            pts.data.customerEnabled ? Number(pts.data.points) : null,
          );
          if (pts.data.receiptFooter) {
            setReceiptFooter(String(pts.data.receiptFooter));
          }
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
      contact?: { id: string; name: string; phone?: string | null } | null;
      linesJson: unknown;
      createdAt: string;
      updatedAt?: string;
      heldAmount?: number | string | null;
      heldMethod?: string | null;
    }): ParkedCart => ({
      id: d.id,
      name: d.name,
      notes: d.notes || undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt || d.createdAt,
      warehouseId: d.warehouseId || "",
      contactId: d.contactId || undefined,
      contactPhone: d.contact?.phone || undefined,
      contactName: d.contact?.name || undefined,
      heldAmount:
        d.heldAmount != null && Number(d.heldAmount) > 0
          ? Number(d.heldAmount)
          : null,
      heldMethod: d.heldMethod || null,
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

  const filteredParkedCarts = useMemo(() => {
    const q = parkSearch.trim().toLowerCase();
    const digits = parkSearch.replace(/\D/g, "");
    if (!q && !digits) return parkedCarts;
    return parkedCarts.filter((p) => {
      const hay = `${p.name} ${p.notes || ""} ${p.contactName || ""}`.toLowerCase();
      if (q && hay.includes(q)) return true;
      if (digits && (p.contactPhone || "").replace(/\D/g, "").includes(digits)) {
        return true;
      }
      return false;
    });
  }, [parkSearch, parkedCarts]);

  const clearActiveCartSession = useCallback(() => {
    if (companyId && user?.id) clearPosCartSession(companyId, user.id);
  }, [companyId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setTipAssigneeId((prev) => prev || user.id);
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getUsers();
        const rows = ((res.data as { id: string; name: string; role?: string; isActive?: boolean }[]) || [])
          .filter((u) => u.isActive !== false)
          .map((u) => ({ id: u.id, name: u.name || u.id }));
        if (!cancelled) setTipStaff(rows);
      } catch {
        if (!cancelled && user?.id) {
          setTipStaff([{ id: user.id, name: user.name || user.email || user.id }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.name, user?.email]);

  useEffect(() => {
    if (!companyId || !user?.id) return;
    if (!cart.length) return; // never wipe session while empty — clear only on park/sale/discard
    const timer = window.setTimeout(() => {
      savePosCartSession(companyId, user.id, {
        warehouseId,
        contactId,
        cartNotes,
        tipAmount,
        tipCustom,
        redeemPointsInput,
        cart,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    companyId,
    user?.id,
    warehouseId,
    contactId,
    cartNotes,
    tipAmount,
    tipCustom,
    redeemPointsInput,
    cart,
  ]);

  useEffect(() => {
    if (!companyId || !user?.id) return;
    const saved = loadPosCartSession(companyId, user.id);
    if (!saved?.cart?.length) return;
    setRestorePrompt({
      warehouseId: saved.warehouseId || "",
      contactId: saved.contactId || "",
      cartNotes: saved.cartNotes || "",
      tipAmount: saved.tipAmount || 0,
      tipCustom: saved.tipCustom || "",
      redeemPointsInput: saved.redeemPointsInput || "",
      cart: saved.cart.map((l) => ({
        ...l,
        catalogPrice: l.catalogPrice ?? l.unitPrice,
      })),
    });
  }, [companyId, user?.id]);

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
      void api
        .getPosIncentivesConfig()
        .then((res) => {
          setReceiptFooter(String(res.data.receiptFooter || ""));
        })
        .catch(() => undefined);
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

  const parkCart = async (opts?: {
    heldAmount?: number;
    heldMethod?: "CASH" | "CREDIT_CARD" | "BANK_TRANSFER";
  }) => {
    if (!cart.length) {
      toast.error(t.parkEmpty);
      return;
    }
    const reason = (parkSuspendReason || cartNotes).trim();
    if (reason.length < 3) {
      toast.error(t.parkReasonRequired);
      return;
    }
    try {
      const cust = customers.find((c) => c.id === contactId);
      const autoName = cust?.name
        ? cust.name
        : `${t.parkName} ${parkedCarts.length + 1}`;
      await api.createPosDraft({
        name: autoName,
        notes: cartNotes.trim() || undefined,
        suspendReason: reason.slice(0, 120),
        warehouseId: warehouseId || undefined,
        contactId: contactId || undefined,
        heldAmount: opts?.heldAmount,
        heldMethod: opts?.heldMethod,
        lines: cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          stock: l.stock,
          isTracked: l.isTracked,
          discount: l.discount,
          notes: l.notes,
          catalogPrice: l.catalogPrice,
          barcode: l.barcode,
        })),
      });
      setCart([]);
      setCartNotes("");
      setParkSuspendReason("");
      setTipAmount(0);
      setTipCustom("");
      setRedeemPointsInput("");
      setSplitOpen(false);
      setRecalledDraftId(null);
      setHeldDeposit(null);
      setParkHoldOpen(false);
      setParkHoldAmount("");
      clearActiveCartSession();
      await loadParkedCarts();
      toast.success(
        opts?.heldAmount
          ? `${t.parkOk} · ${t.parkHold}: ${formatMoney(opts.heldAmount, currency)}`
          : t.parkOk,
      );
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
    const holdAmt = Number(parked.heldAmount || 0);
    if (holdAmt > 0.0005) {
      setRecalledDraftId(parked.id);
      setHeldDeposit({
        amount: holdAmt,
        method: parked.heldMethod || "CASH",
      });
    } else {
      setRecalledDraftId(null);
      setHeldDeposit(null);
      try {
        await api.deletePosDraft(parked.id);
      } catch {
        /* still ok — cart recalled locally */
      }
    }
    await loadParkedCarts();
    focusScan();
  };

  const deleteParked = async (id: string, approval?: DualApprovalPayload) => {
    try {
      await api.deletePosDraft(id, approval ? { approval } : undefined);
      if (recalledDraftId === id) {
        setRecalledDraftId(null);
        setHeldDeposit(null);
      }
      await loadParkedCarts();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error(t.parkHoldNeedApproval);
        return;
      }
      toast.error(t.parkFail);
    }
  };

  const renameParked = async (parked: ParkedCart) => {
    setParkEdit({
      id: parked.id,
      name: parked.name,
      notes: parked.notes || "",
    });
  };

  const editParkedNotes = async (parked: ParkedCart) => {
    setParkEdit({
      id: parked.id,
      name: parked.name,
      notes: parked.notes || "",
    });
  };

  const saveParkEdit = async () => {
    if (!parkEdit) return;
    try {
      await api.updatePosDraft(parkEdit.id, {
        name: parkEdit.name.trim() || t.parkName,
        notes: parkEdit.notes.trim(),
      });
      setParkEdit(null);
      toast.success(t.renameParkedOk);
      await loadParkedCarts();
    } catch {
      toast.error(t.parkFail);
    }
  };

  const parkAgeLabel = (iso: string) => {
    const m = Math.max(
      0,
      Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
    );
    if (m < 1) return `<1${locale === "en" ? "m" : "د"}`;
    if (m < 60) return `${m}${locale === "en" ? "m" : "د"}`;
    return `${Math.floor(m / 60)}${locale === "en" ? "h" : "س"}`;
  };

  const applyParkReason = (reason: string) => {
    setCartNotes((prev) => {
      const base = prev.trim();
      if (!base) return reason;
      if (base.includes(reason)) return base;
      return `${reason} — ${base}`;
    });
  };

  const applyRestorePrompt = () => {
    if (!restorePrompt) return;
    setCart(restorePrompt.cart);
    setCartNotes(restorePrompt.cartNotes);
    setTipAmount(restorePrompt.tipAmount);
    setTipCustom(restorePrompt.tipCustom);
    setRedeemPointsInput(restorePrompt.redeemPointsInput);
    if (restorePrompt.contactId) setContactId(restorePrompt.contactId);
    if (restorePrompt.warehouseId) {
      setWarehouseId(restorePrompt.warehouseId);
      try {
        localStorage.setItem(POS_WAREHOUSE_KEY, restorePrompt.warehouseId);
      } catch {
        /* ignore */
      }
    }
    setRestorePrompt(null);
    toast.success(t.restoreCartOk);
    focusScan();
  };

  const discardRestorePrompt = () => {
    setRestorePrompt(null);
    clearActiveCartSession();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (e.key === "?" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        focusScan();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setPriceCheckMode((v) => {
          const next = !v;
          if (!next) setPriceCheckProduct(null);
          toast.success(next ? t.priceCheckOn : t.priceCheckOff);
          return next;
        });
        focusScan();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("[data-pos-park]")?.click();
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        setNoSaleOpen(true);
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        setReceiptsSearch("");
        setReceiptsOpen(true);
        void loadRecentSales();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        window.requestAnimationFrame(() => receiptLookupRef.current?.focus());
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>('[data-pos-pay="CASH"]')
          ?.click();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>('[data-pos-pay="CREDIT_CARD"]')
          ?.click();
        return;
      }

      if (!typing && (e.key === "+" || e.key === "=") && cart.length) {
        e.preventDefault();
        setCart((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          const nextQty = last.quantity + 1;
          if (last.isTracked && nextQty > last.stock) {
            toast.error(`${t.stock}: ${last.stock}`);
            return prev;
          }
          return prev.map((x, i) =>
            i === prev.length - 1 ? { ...x, quantity: nextQty } : x,
          );
        });
        return;
      }
      if (!typing && e.key === "-" && cart.length) {
        e.preventDefault();
        setCart((prev) => {
          if (!prev.length) return prev;
          return prev
            .map((x, i) =>
              i === prev.length - 1
                ? { ...x, quantity: Math.max(0, x.quantity - 1) }
                : x,
            )
            .filter((x) => x.quantity > 0);
        });
        return;
      }

      if (e.key !== "Escape") return;
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (parkEdit) {
        setParkEdit(null);
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
  }, [cart.length, t.clearConfirm, t.stock, t.priceCheckOn, t.priceCheckOff, focusScan, shortcutsOpen, parkEdit, loadRecentSales]);

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
    (p: PosProduct, qty = 1): { added: boolean; lowStock: boolean } => {
      const unitPrice = Number(p.salePrice);
      const stock = Number(p.quantity);
      const minQty =
        p.minQuantity != null && p.minQuantity !== ""
          ? Number(p.minQuantity)
          : 0;
      let added = false;
      let lowStock = false;
      setCart((prev) => {
        const existing = prev.find((l) => l.productId === p.id);
        if (existing) {
          const nextQty = existing.quantity + qty;
          if (p.isTracked && nextQty > stock) {
            toast.error(`${t.stock}: ${stock}`);
            return prev;
          }
          added = true;
          if (p.isTracked) {
            lowStock = stock - nextQty <= minQty;
          }
          return prev.map((l) =>
            l.productId === p.id ? { ...l, quantity: nextQty } : l,
          );
        }
        if (p.isTracked && qty > stock) {
          toast.error(`${t.stock}: ${stock}`);
          return prev;
        }
        added = true;
        if (p.isTracked) {
          lowStock = stock - qty <= minQty;
        }
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode || null,
            unitPrice,
            catalogPrice: unitPrice,
            quantity: qty,
            discount: 0,
            stock,
            isTracked: p.isTracked,
          },
        ];
      });
      if (added) focusScan();
      return { added, lowStock };
    },
    [t.stock, focusScan],
  );

  const playAddFeedback = (result: { added: boolean; lowStock: boolean }) => {
    if (!result.added) {
      playPosDenyBeep();
      return;
    }
    if (result.lowStock) {
      playPosWarnBeep();
      toast(t.lowStockWarn, { icon: "⚠" });
      return;
    }
    playPosScanBeep();
  };

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
      const data = res.data as PosProduct & { scanQty?: number };
      if (priceCheckMode) {
        setPriceCheckProduct({
          name: data.name,
          price: Number(data.salePrice),
          stock: Number(data.quantity),
          sku: data.sku,
          barcode: data.barcode,
        });
        try {
          playPosScanBeep();
        } catch {
          /* ignore */
        }
        setScan("");
        setCameraOpen(false);
        focusScan();
        return;
      }
      const qty =
        typeof data.scanQty === "number" && data.scanQty > 0
          ? data.scanQty
          : 1;
      const result = addProduct(data, qty);
      if (result.added && qty !== 1) toast.success(`${t.pluWeightAdded}: ${qty}`);
      playAddFeedback(result);
      setScan("");
      setCameraOpen(false);
      focusScan();
    } catch {
      try {
        const { lookupCachedProduct } = await import("@/lib/pos-catalog-cache");
        const cached = await lookupCachedProduct(
          trimmed,
          warehouseId || undefined,
        );
        if (cached) {
          if (priceCheckMode) {
            setPriceCheckProduct({
              name: cached.name,
              price: Number(cached.salePrice),
              stock: Number(cached.quantity),
              sku: cached.sku,
              barcode: cached.barcode,
            });
            try {
              playPosScanBeep();
            } catch {
              /* ignore */
            }
            setScan("");
            setCameraOpen(false);
            focusScan();
            return;
          }
          const qty =
            typeof cached.scanQty === "number" && cached.scanQty > 0
              ? cached.scanQty
              : 1;
          const result = addProduct(cached as PosProduct, qty);
          if (result.added && qty !== 1) {
            toast.success(`${t.pluWeightAdded}: ${qty}`);
          }
          playAddFeedback(result);
          setScan("");
          setCameraOpen(false);
          focusScan();
          return;
        }
      } catch {
        /* ignore */
      }
      playPosDenyBeep();
      toast.error(t.notFound);
      if (!priceCheckMode) {
        setQuickBarcode(trimmed);
        setQuickName("");
        setQuickPrice("");
        setQuickCategory("General");
        setQuickProductOpen(true);
      }
      setScan("");
      focusScan();
    }
  };

  const saveQuickProduct = async () => {
    const name = quickName.trim();
    const price = Number(quickPrice);
    const barcode = quickBarcode.trim();
    if (!name || !barcode) return;
    if (Number.isNaN(price) || price < 0) {
      toast.error(t.quickProductPrice);
      return;
    }
    setSavingProduct(true);
    try {
      const res = await api.createProduct({
        name,
        category: quickCategory.trim() || "General",
        barcode,
        salePrice: price,
        costPrice: 0,
        quantity: 0,
        isTracked: false,
        unit: "pcs",
        warehouseId: warehouseId || undefined,
      });
      const created = res.data as PosProduct & {
        id: string;
        sku?: string;
        salePrice?: number | string;
        quantity?: number | string;
        isTracked?: boolean;
        barcode?: string | null;
        name?: string;
      };
      const asPos: PosProduct = {
        id: created.id,
        name: created.name || name,
        sku: created.sku || "",
        barcode: created.barcode || barcode,
        salePrice: Number(created.salePrice ?? price),
        quantity: Number(created.quantity ?? 0),
        isTracked: created.isTracked === true,
      };
      try {
        const { upsertProductInCatalogCache } = await import("@/lib/pos-catalog-cache");
        await upsertProductInCatalogCache(asPos, warehouseId || undefined);
      } catch {
        /* ignore cache */
      }
      setCatalog((prev) => [asPos, ...prev.filter((p) => p.id !== asPos.id)]);
      playAddFeedback(addProduct(asPos, 1));
      setQuickProductOpen(false);
      toast.success(t.quickProductOk);
      focusScan();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.saleFail);
    } finally {
      setSavingProduct(false);
    }
  };

  const clearCart = () => {
    if (!cart.length) return;
    if (window.confirm(t.clearConfirm)) {
      setCart([]);
      setCartNotes("");
      setTipAmount(0);
      setTipCustom("");
      setRedeemPointsInput("");
      setSplitOpen(false);
      setRecalledDraftId(null);
      setHeldDeposit(null);
      clearActiveCartSession();
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
  const redeemPointsValue = useMemo(() => {
    if (!redeemEnabled || !contactId || !(redeemRate > 0)) return 0;
    const pts = Math.max(0, parseFloat(redeemPointsInput) || 0);
    const maxPts = customerLoyaltyPoints != null ? customerLoyaltyPoints : 0;
    const usePts = Math.min(pts, maxPts);
    const raw = Number((usePts * redeemRate).toFixed(3));
    // Cap at merchandise (before tip)
    return Math.min(raw, merchandiseTotal);
  }, [
    redeemEnabled,
    contactId,
    redeemRate,
    redeemPointsInput,
    customerLoyaltyPoints,
    merchandiseTotal,
  ]);
  const redeemPointsToSend = useMemo(() => {
    if (!(redeemPointsValue > 0.0005) || !(redeemRate > 0)) return 0;
    return Number((redeemPointsValue / redeemRate).toFixed(3));
  }, [redeemPointsValue, redeemRate]);
  const total = useMemo(() => {
    const merch = Math.max(0, merchandiseTotal - redeemPointsValue);
    return Number((merch + tipValue).toFixed(3));
  }, [merchandiseTotal, redeemPointsValue, tipValue]);

  const heldPaid = heldDeposit?.amount || 0;
  const remainingDue = useMemo(
    () => Math.max(0, Number((total - heldPaid).toFixed(3))),
    [total, heldPaid],
  );

  useEffect(() => {
    if (!companyId) return;
    const tendered = parseFloat(cashTendered);
    const hasTender = cashTendered.trim() !== "" && Number.isFinite(tendered);
    const change =
      hasTender && tendered + 0.0005 >= total
        ? Number((tendered - total).toFixed(3))
        : null;
    let phase: "idle" | "cart" | "pay" | "thankyou" = "idle";
    if (cart.length && (paying || hasTender)) phase = "pay";
    else if (cart.length) phase = "cart";
    else if (lastInvoice) phase = "thankyou";

    publishPosCustomerDisplay({
      v: 1,
      companyId,
      companyName: company?.name || "",
      currency,
      locale: locale === "en" ? "en" : "ar",
      phase,
      lines: cart.map((l) => ({
        name: l.name,
        qty: l.quantity,
        total: Math.max(
          0,
          Number((l.unitPrice * l.quantity - (l.discount || 0)).toFixed(3)),
        ),
      })),
      subtotal,
      tax,
      total:
        phase === "thankyou" && lastInvoice
          ? Number(lastInvoice.total) || total
          : total,
      cashTendered: hasTender ? tendered : null,
      change,
      thankYouNumber: lastInvoice?.number || null,
      updatedAt: Date.now(),
    });
  }, [
    companyId,
    company?.name,
    currency,
    locale,
    cart,
    paying,
    cashTendered,
    subtotal,
    tax,
    total,
    lastInvoice,
  ]);

  const applyTipPercent = (pct: number) => {
    const next = Number(((merchandiseTotal * pct) / 100).toFixed(3));
    setTipAmount(next);
    setTipCustom(String(next));
  };

  const openSplitTender = () => {
    if (!cart.length) return;
    const hold = heldPaid > 0.0005 ? heldPaid : 0;
    const rest = Number((total - hold).toFixed(3));
    const method = (heldDeposit?.method || "CASH").toUpperCase();
    setSplitCashAmt(method === "CASH" ? String(hold || rest) : String(Math.max(0, rest)));
    setSplitCardAmt(method === "CREDIT_CARD" ? String(hold) : "0");
    setSplitBankAmt(method === "BANK_TRANSFER" ? String(hold) : "0");
    if (method === "CASH" && hold > 0) {
      setSplitCashAmt(String(Number((hold + Math.max(0, rest)).toFixed(3))));
    } else if (hold > 0 && method !== "CASH") {
      setSplitCashAmt(String(Math.max(0, rest)));
    } else {
      const half = Number((total / 2).toFixed(3));
      setSplitCashAmt(String(half));
      setSplitCardAmt(String(Number((total - half).toFixed(3))));
      setSplitBankAmt("0");
    }
    setSplitCreditAmt("0");
    setSplitOpen(true);
  };

  const printReceiptSnapshot = useCallback(
    async (receipt: ReceiptSnapshot, opts?: { gift?: boolean }) => {
      const gift = !!opts?.gift;
      const receiptLines = (receipt.lines || []).map((l) => ({
        name: l.name,
        qty: l.qty,
        lineTotal: gift ? 0 : l.lineTotal,
        barcode: l.barcode || null,
        sku: l.sku || null,
        note: l.note || null,
      }));
      const printData: PosReceiptPrintData = {
        brand: t.brand,
        company: {
          name: company?.name,
          address: company?.address,
          city: company?.city,
          country: company?.country,
          phone: company?.phone,
          email: company?.email,
          vatNumber: company?.vatNumber,
          crNumber: company?.crNumber,
          logo: company?.logo || "/brand/hisaby-mark.png",
        },
        number: receipt.number,
        paymentMethod: gift ? undefined : receipt.paymentMethod,
        warehouseLabel: receipt.warehouseLabel,
        total: gift ? 0 : receipt.total || 0,
        currency,
        lines: receiptLines,
        locale: locale === "en" ? "en" : "ar",
        footerNote: receiptFooter || t.brand,
        gift,
        labels: {
          vat: locale === "en" ? "VAT" : "الرقم الضريبي",
          cr: locale === "en" ? "CR" : "السجل التجاري",
          phone: locale === "en" ? "Phone" : "الهاتف",
          email: locale === "en" ? "Email" : "البريد",
          warehouse: t.warehouse,
          payment: t.payment,
          total: t.total,
          barcode: locale === "en" ? "Scan barcode for returns" : "امسح الباركود للإرجاع",
          printBtn: locale === "en" ? "Print receipt" : "طباعة الإيصال",
          giftTitle: t.giftReceipt,
        },
      };

      const escPosPayload = {
        brand: t.brand,
        companyName: company?.name || "",
        vatNumber: company?.vatNumber || undefined,
        crNumber: company?.crNumber || undefined,
        phone: company?.phone || undefined,
        address: formatCompanyAddressCompact({
          address: company?.address,
          city: company?.city,
        }) || undefined,
        warehouseLabel: receipt.warehouseLabel,
        number: receipt.number,
        paymentMethod: receipt.paymentMethod,
        totalLabel: t.total,
        total: receipt.total || 0,
        currency,
        lines: receiptLines,
        footerNote: receiptFooter || t.brand,
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

      printPosReceiptBrowser(printData);
    },
    [
      company?.name,
      company?.vatNumber,
      company?.crNumber,
      company?.phone,
      company?.email,
      company?.address,
      company?.city,
      company?.country,
      company?.logo,
      currency,
      locale,
      receiptFooter,
      t.brand,
      t.warehouse,
      t.payment,
      t.total,
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

  const reprintSale = async (
    sale: RecentCashSale,
    opts?: { gift?: boolean },
  ) => {
    const gift = !!opts?.gift;
    let reprintCount = sale.reprintCount || 0;
    if (sale.id && !String(sale.id).startsWith("OFF-")) {
      try {
        const res = await api.recordPosSaleReprint(
          sale.id,
          gift ? "GIFT" : "STANDARD",
        );
        reprintCount = Number(res.data.reprintCount) || reprintCount + 1;
        setRecentSales((prev) =>
          prev.map((r) =>
            r.id === sale.id ? { ...r, reprintCount } : r,
          ),
        );
      } catch {
        /* still print locally */
      }
    }
    const payMethods = (sale.payments || [])
      .map((p) => paymentLabel(p.method))
      .filter(Boolean);
    printReceiptSnapshot(
      {
        id: sale.id,
        number: sale.number,
        total: Number(sale.total),
        paymentMethod: payMethods.length
          ? payMethods.join(" + ")
          : paymentLabel(sale.payments?.[0]?.method),
        warehouseLabel: warehouseLabel || undefined,
        lines: (sale.items || []).map((item) => {
          const fromCatalog = item.productId
            ? catalog.find((c) => c.id === item.productId)
            : undefined;
          const barcode =
            item.product?.barcode ||
            fromCatalog?.barcode ||
            item.product?.sku ||
            fromCatalog?.sku ||
            null;
          return {
            name: item.description,
            qty: Number(item.quantity),
            lineTotal: Number(item.total),
            barcode,
            sku: item.product?.sku || fromCatalog?.sku || null,
            note: item.notes || null,
          };
        }),
      },
      { gift },
    );
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
    opts?: { allowNegativeStock?: boolean },
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
    const needsStockOverride = overStock.length > 0;
    const needsPriceOrDiscount =
      cartNeedsPriceApproval() || cartNeedsDiscountApproval();
    if ((needsStockOverride || needsPriceOrDiscount) && !approval) {
      setPendingAllowNegativeStock(needsStockOverride);
      setPendingSplitPayments(payments || null);
      setPendingCheckout(method);
      setCheckoutBusy(false);
      return;
    }

    const fp = posCartFingerprint({
      warehouseId: warehouseId || "",
      contactId: contactId || "",
      total,
      cart: workingCart,
    });
    const lastFp = readLastSaleFingerprint();
    if (
      lastFp &&
      lastFp.fp === fp &&
      Date.now() - lastFp.at < POS_DUP_SALE_WINDOW_MS
    ) {
      if (!window.confirm(t.duplicateSaleWarn)) {
        setPendingCheckout(null);
        setCheckoutBusy(false);
        return;
      }
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
      tipValue > 0.0005
        ? [{ name: t.tip, qty: 1, lineTotal: tipValue, barcode: null as string | null, sku: null as string | null }]
        : [];
    const snapshot = [
      ...workingCart.map((l) => ({
        name: l.name,
        qty: l.quantity,
        lineTotal: lineTotal(l),
        barcode: l.barcode || null,
        sku: l.sku || null,
        note: l.notes?.trim() || null,
      })),
      ...tipLine,
    ];
    const saleNotes = cartNotes.trim()
      ? `${cartNotes.trim()} — Hisaby POS sale`
      : undefined;
    const useStoreCredit = method === "STORE_CREDIT" && !payments?.length;
    const isPartner =
      (method === "PARTNER" || method === "TERMINAL") && !payments?.length;

    let effectivePayments = payments;
    if (
      !effectivePayments?.length &&
      heldPaid > 0.0005 &&
      method !== "STORE_CREDIT" &&
      method !== "PARTNER" &&
      method !== "TERMINAL"
    ) {
      const holdMethod = (heldDeposit?.method || "CASH") as CheckoutMethod;
      if (remainingDue <= 0.0005) {
        effectivePayments = [{ method: holdMethod, amount: Number(total.toFixed(3)) }];
      } else if (method === holdMethod) {
        effectivePayments = [{ method, amount: Number(total.toFixed(3)) }];
      } else {
        effectivePayments = [
          { method: holdMethod, amount: Number(heldPaid.toFixed(3)) },
          { method, amount: Number(remainingDue.toFixed(3)) },
        ];
      }
    }

    const paymentLabelJoined = effectivePayments?.length
      ? effectivePayments
          .map((p) => `${paymentLabel(p.method)} ${p.amount.toFixed(3)}`)
          .join(" + ")
      : paymentLabel(method);

    const payload = {
      paymentMethod: effectivePayments?.length
        ? undefined
        : useStoreCredit
          ? "STORE_CREDIT"
          : isPartner
            ? "CREDIT_CARD"
            : method,
      partnerCheckout: isPartner || undefined,
      payments: effectivePayments?.length
        ? effectivePayments.map((p) => ({ method: p.method, amount: p.amount }))
        : undefined,
      tipAmount: tipValue > 0.0005 ? tipValue : undefined,
      tipAssigneeId:
        tipValue > 0.0005 && tipAssigneeId ? tipAssigneeId : undefined,
      useStoreCredit: useStoreCredit || undefined,
      loyaltyPointsToRedeem:
        redeemPointsToSend > 0.0005 ? redeemPointsToSend : undefined,
      notes: saleNotes,
      warehouseId: warehouseId || undefined,
      contactId: contactId || undefined,
      parkedDraftId: recalledDraftId || undefined,
      approval,
      allowNegativeStock:
        opts?.allowNegativeStock === true ||
        (needsStockOverride && !!approval) ||
        undefined,
      items: workingCart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount || 0,
        notes: l.notes?.trim() || undefined,
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
        writeLastSaleFingerprint(fp);
        clearActiveCartSession();
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
              toast.error(t.terminalTapNeedConfig || t.terminalTapFail);
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
      setRedeemPointsInput("");
      setSplitOpen(false);
      setRecalledDraftId(null);
      setHeldDeposit(null);
      setPendingCheckout(null);
      writeLastSaleFingerprint(fp);
      clearActiveCartSession();
      toast.success(isPartner ? t.partnerPayPending : t.saleOk);
      void maybeKickDrawer(
        effectivePayments?.some((p) => p.method === "CASH") ? "CASH" : method,
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
          writeLastSaleFingerprint(fp);
          clearActiveCartSession();
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
    const bank = Math.max(0, parseFloat(splitBankAmt) || 0);
    const credit = Math.max(0, parseFloat(splitCreditAmt) || 0);
    const sum = Number((cash + card + bank + credit).toFixed(3));
    if (Math.abs(sum - total) > 0.005) {
      toast.error(t.splitSumMismatch);
      return;
    }
    const payments: { method: CheckoutMethod; amount: number }[] = [];
    if (cash > 0.0005) payments.push({ method: "CASH", amount: Number(cash.toFixed(3)) });
    if (card > 0.0005)
      payments.push({ method: "CREDIT_CARD", amount: Number(card.toFixed(3)) });
    if (bank > 0.0005)
      payments.push({ method: "BANK_TRANSFER", amount: Number(bank.toFixed(3)) });
    if (credit > 0.0005)
      payments.push({ method: "STORE_CREDIT", amount: Number(credit.toFixed(3)) });
    if (!payments.length) {
      toast.error(t.splitSumMismatch);
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
      setCashTendered(remainingDue > 0 ? String(Number(remainingDue.toFixed(3))) : "0");
      setCashTenderOpen(true);
      return;
    }
    await runCheckout(method);
  };

  const confirmCashTender = async () => {
    const tendered = parseFloat(cashTendered);
    if (!Number.isFinite(tendered) || tendered + 0.0005 < remainingDue) {
      toast.error(t.amountTendered);
      return;
    }
    setCashTenderOpen(false);
    await runCheckout("CASH");
  };

  const confirmNoSale = async (approval?: DualApprovalPayload) => {
    const reason = noSaleReason.trim();
    if (!reason) {
      toast.error(t.noSaleReason);
      return;
    }
    if (!shiftOpen) {
      toast.error(t.noSaleNeedShift);
      return;
    }
    setNoSaleBusy(true);
    try {
      await api.createPosNoSale({
        reason,
        warehouseId: warehouseId || undefined,
        approval,
      });
      try {
        const { tryOpenCashDrawer } = await import("@/lib/pos-escpos");
        await tryOpenCashDrawer();
      } catch {
        /* drawer optional */
      }
      toast.success(t.noSaleOk);
      setNoSaleOpen(false);
      setNoSaleAwaitingApproval(false);
      setNoSaleReason("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      const text = typeof msg === "string" ? msg : t.saleFail;
      if (/open shift|وردية/i.test(text)) {
        toast.error(t.noSaleNeedShift);
      } else {
        toast.error(text);
      }
    } finally {
      setNoSaleBusy(false);
    }
  };

  const appendCashDigit = (key: string) => {
    setCashTendered((prev) => {
      const cur = prev || "";
      if (key === "back") {
        return cur.slice(0, -1);
      }
      if (key === ".") {
        if (cur.includes(".")) return cur;
        return cur ? `${cur}.` : "0.";
      }
      if (key === "00") {
        if (!cur || cur === "0") return "0";
        const parts = cur.split(".");
        if (parts[1] && parts[1].length >= 2) return cur;
        return `${cur}00`;
      }
      if (!/^\d$/.test(key)) return cur;
      if (cur.includes(".")) {
        const [, dec = ""] = cur.split(".");
        if (dec.length >= 3) return cur;
      }
      if (cur === "0") return key;
      return `${cur}${key}`;
    });
  };

  const setCashExact = () => setCashTendered(String(Number(remainingDue.toFixed(3))));
  const addCashDenom = (n: number) => {
    const base = parseFloat(cashTendered);
    const start = Number.isFinite(base) ? base : 0;
    setCashTendered(String(Number((start + n).toFixed(3))));
  };
  const setCashRoundUp = () => {
    const ceil = Math.ceil(remainingDue - 0.0005);
    setCashTendered(String(Math.max(ceil, Math.ceil(remainingDue))));
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
            <button
              type="button"
              disabled={!contactId}
              onClick={() => {
                setCreditTopUpAmount("");
                setCreditTopUpMethod("CASH");
                setCreditTopUpOpen(true);
              }}
              className="shrink-0 h-8 px-2 rounded-lg border border-emerald-400/30 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-40"
              title={t.creditTopUp}
            >
              {t.creditTopUp}
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
                        onClick={() => void reprintSale(sale)}
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
                onClick={() => {
                  setPriceCheckMode((v) => {
                    const next = !v;
                    if (!next) setPriceCheckProduct(null);
                    toast.success(next ? t.priceCheckOn : t.priceCheckOff);
                    return next;
                  });
                  focusScan();
                }}
                className={`h-14 min-w-14 px-3 rounded-2xl border font-bold transition inline-flex items-center justify-center ${
                  priceCheckMode
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                    : "border-white/15 text-slate-300 hover:bg-white/5"
                }`}
                title={t.priceCheckMode}
                aria-label={t.priceCheckMode}
              >
                <ScanSearch className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setNoSaleOpen(true)}
                className="h-14 min-w-14 px-3 rounded-2xl border border-amber-400/30 text-amber-200 font-bold hover:bg-amber-500/15 transition inline-flex items-center justify-center"
                title={t.noSale}
                aria-label={t.noSale}
              >
                <Wallet className="w-5 h-5" />
              </button>
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
            {priceCheckMode ? (
              <span className="text-violet-300 font-semibold">{t.priceCheckOn}</span>
            ) : (
              <span className="text-slate-600">{t.escHint}</span>
            )}
          </p>
        </form>

        {priceCheckProduct ? (
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-violet-300/90 font-semibold">{t.priceCheckTitle}</p>
              <p className="text-base font-bold text-white truncate">{priceCheckProduct.name}</p>
              <p className="text-[11px] text-slate-400">
                {priceCheckProduct.barcode || priceCheckProduct.sku || ""}
                {priceCheckProduct.stock != null
                  ? ` · ${t.priceCheckStock}: ${priceCheckProduct.stock}`
                  : ""}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-violet-100">
              {formatMoney(priceCheckProduct.price, currency)}
            </p>
          </div>
        ) : null}

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
        {!shiftOpen ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 flex items-center justify-between gap-2">
            <span>{t.shiftBannerClosed}</span>
            <Link href="/pos/shifts" className="font-bold underline shrink-0">
              {t.openShiftsLink}
            </Link>
          </div>
        ) : shiftOpenedAt &&
          Date.now() - new Date(shiftOpenedAt).getTime() >
            10 * 60 * 60 * 1000 ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100 flex items-center justify-between gap-2">
            <span>{t.shiftBannerLate}</span>
            <Link href="/pos/shifts" className="font-bold underline shrink-0">
              {t.closeShift}
            </Link>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2">
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
              <span className="text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  {t.mySalesToday}:{" "}
                  <span className="text-white font-semibold">
                    {todayStats.mine?.salesCount ?? todayStats.salesCount}
                  </span>
                  {" · "}
                  <span className="text-emerald-300 font-semibold">
                    {formatMoney(
                      todayStats.mine?.salesTotal ?? todayStats.salesTotal,
                      currency,
                    )}
                  </span>
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  {t.storeSalesToday}:{" "}
                  <span className="text-white font-semibold">{todayStats.salesCount}</span>
                  {" · "}
                  <span className="text-sky-300 font-semibold">
                    {formatMoney(todayStats.salesTotal, currency)}
                  </span>
                </span>
                {todayStats.voidCount || todayStats.refundCount ? (
                  <span className="text-slate-500">
                    ({t.zVoids} {todayStats.voidCount} · {t.zRefunds} {todayStats.refundCount})
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-300">{t.recentSales}</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openPosCustomerDisplayWindow()}
                className="h-7 px-2 rounded-lg border border-emerald-500/30 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/15 inline-flex items-center gap-1"
                title={t.customerDisplay}
              >
                <Monitor className="w-3 h-3" />
                {t.customerDisplay}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReceiptsSearch("");
                  setReceiptsOpen(true);
                  void loadRecentSales();
                }}
                className="h-7 px-2 rounded-lg border border-white/15 text-[10px] font-semibold text-slate-300 hover:bg-white/5"
              >
                {t.receiptsDrawer} · F7
              </button>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void findReceiptForRefund();
            }}
            className="flex gap-2"
          >
            <input
              ref={receiptLookupRef}
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
                    onClick={() => void reprintSale(sale)}
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
              href="/pos/inventory"
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
              data-pos-park
              onClick={() => setParkHoldOpen(true)}
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
            <input
              value={parkSearch}
              onChange={(e) => setParkSearch(e.target.value)}
              placeholder={t.parkSearch}
              className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-2 text-[11px] text-white placeholder:text-slate-600"
            />
            <div className="flex flex-wrap gap-1">
              {[
                t.parkReasonWaitPay,
                t.parkReasonCustomerAway,
                t.parkReasonHold,
                t.parkReasonOther,
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => applyParkReason(reason)}
                  className="h-7 px-2 rounded-md text-[10px] font-semibold border border-white/10 text-slate-300 hover:bg-white/5"
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {!filteredParkedCarts.length ? (
                <p className="text-[11px] text-slate-500 py-2 text-center">{t.parkSearchEmpty}</p>
              ) : (
                filteredParkedCarts.map((p) => {
                const ageIso = p.updatedAt || p.createdAt;
                const ageMin = Math.floor(
                  (Date.now() - new Date(ageIso).getTime()) / 60000,
                );
                const stale = ageMin >= 60;
                return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${
                    stale ? "bg-amber-500/10 border border-amber-500/20" : "bg-black/20"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {p.lines.length} · {t.parkAge} {parkAgeLabel(ageIso)}
                      {stale ? ` · ${t.parkStale}` : ""}
                      {p.contactPhone
                        ? ` · ${t.parkPhone} ${p.contactPhone}`
                        : ""}
                      {p.heldAmount ? (
                        <span className="text-emerald-300">
                          {" "}
                          · {t.parkHold}{" "}
                          {formatMoney(Number(p.heldAmount), currency)}
                        </span>
                      ) : null}
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
              );
              })
              )}
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
                  className={`w-24 h-8 px-2 rounded-md bg-black/30 border text-sm text-end text-white ${
                    Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001
                      ? "border-amber-400/50 text-amber-100"
                      : "border-white/10"
                  } ${!canOverridePrice ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
              {Math.abs(l.unitPrice - (l.catalogPrice ?? l.unitPrice)) > 0.001 ? (
                <p className="mt-1 text-[10px] text-amber-300/90">{t.priceOverrideHint}</p>
              ) : null}
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
                  className={`w-24 h-8 px-2 rounded-md bg-black/30 border text-sm text-end text-white ${
                    lineNeedsDiscountApproval(l)
                      ? "border-amber-400/50 text-amber-100"
                      : "border-white/10"
                  }`}
                />
              </div>
              {lineNeedsDiscountApproval(l) ? (
                <p className="mt-1 text-[10px] text-amber-300/90">{t.lineDiscountHint}</p>
              ) : null}
              <div className="mt-2">
                <label className="text-[11px] text-slate-500 block mb-1">{t.lineNote}</label>
                <input
                  type="text"
                  maxLength={200}
                  value={l.notes || ""}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 200);
                    setCart((prev) =>
                      prev.map((x) =>
                        x.productId === l.productId ? { ...x, notes: next } : x,
                      ),
                    );
                  }}
                  placeholder={t.lineNotePlaceholder}
                  className="w-full h-8 px-2 rounded-md bg-black/30 border border-white/10 text-xs text-white placeholder:text-slate-600"
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
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{t.tip}</span>
                    <span>{formatMoney(tipValue, currency)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500 shrink-0">
                      {t.tipAssignee}
                    </label>
                    <select
                      value={tipAssigneeId}
                      onChange={(e) => setTipAssigneeId(e.target.value)}
                      className="flex-1 h-8 rounded-md bg-black/30 border border-white/10 px-2 text-[11px] text-white"
                    >
                      {(tipStaff.length
                        ? tipStaff
                        : user
                          ? [{ id: user.id, name: user.name || user.email || "Me" }]
                          : []
                      ).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
            {contactId && redeemEnabled && customerLoyaltyPoints != null ? (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-violet-200">
                    {t.redeemPoints}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {t.points}: {customerLoyaltyPoints}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500">{t.redeemPointsHint}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    max={customerLoyaltyPoints}
                    value={redeemPointsInput}
                    onChange={(e) => setRedeemPointsInput(e.target.value)}
                    className="flex-1 h-9 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                  />
                  <button
                    type="button"
                    className="h-9 px-2 rounded-md text-[10px] font-semibold border border-white/10 text-slate-300"
                    onClick={() =>
                      setRedeemPointsInput(String(customerLoyaltyPoints || 0))
                    }
                  >
                    {t.redeemMax}
                  </button>
                </div>
                {redeemPointsValue > 0.0005 ? (
                  <div className="flex justify-between text-xs text-violet-200">
                    <span>{t.redeemValue}</span>
                    <span>{formatMoney(redeemPointsValue, currency)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-extrabold text-white pt-1">
              <span>{t.total}</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            {heldPaid > 0.0005 ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 space-y-0.5">
                <div className="flex justify-between text-xs text-emerald-200">
                  <span>{t.parkHoldPaid}</span>
                  <span className="tabular-nums">{formatMoney(heldPaid, currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white">
                  <span>{t.remainingDue}</span>
                  <span className="tabular-nums text-amber-200">
                    {formatMoney(remainingDue, currency)}
                  </span>
                </div>
              </div>
            ) : null}
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
                    onChange={(e) => setSplitCashAmt(e.target.value)}
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
                    onChange={(e) => setSplitCardAmt(e.target.value)}
                    className="w-full h-9 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                  />
                </label>
                <label className="text-[11px] text-slate-400 space-y-1">
                  <span>{t.splitBank}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={splitBankAmt}
                    onChange={(e) => setSplitBankAmt(e.target.value)}
                    className="w-full h-9 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-end text-white"
                  />
                </label>
                <label className="text-[11px] text-slate-400 space-y-1">
                  <span>{t.splitCredit}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={splitCreditAmt}
                    onChange={(e) => setSplitCreditAmt(e.target.value)}
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
              data-pos-pay="CASH"
              disabled={!cart.length || paying}
              onClick={() => checkout("CASH")}
              className="min-h-12 h-12 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40 hover:bg-emerald-400 inline-flex items-center justify-center gap-2 text-sm"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.payCash}
            </button>
            <button
              type="button"
              data-pos-pay="CREDIT_CARD"
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
                  onClick={() => {
                    if (lastInvoice.id) {
                      void reprintSale(
                        {
                          id: lastInvoice.id,
                          number: lastInvoice.number || "",
                          total: lastInvoice.total || 0,
                          items: (lastInvoice.lines || []).map((l) => ({
                            description: l.name,
                            quantity: l.qty,
                            total: l.lineTotal,
                            product: { barcode: l.barcode, sku: l.sku },
                            notes: l.note,
                          })),
                          payments: lastInvoice.paymentMethod
                            ? [{ method: lastInvoice.paymentMethod }]
                            : undefined,
                        },
                        { gift: true },
                      );
                    } else {
                      void printReceiptSnapshot(lastInvoice, { gift: true });
                    }
                  }}
                  className="h-9 rounded-xl border border-violet-500/30 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/15"
                >
                  {t.giftReceipt}
                </button>
                <button
                  type="button"
                  disabled={!lastInvoice.id || String(lastInvoice.id).startsWith("OFF-")}
                  onClick={() => {
                    if (!lastInvoice.id) return;
                    void openRefund({
                      id: lastInvoice.id,
                      number: lastInvoice.number || "",
                      total: lastInvoice.total || 0,
                      items: (lastInvoice.lines || []).map((l) => ({
                        description: l.name,
                        quantity: l.qty,
                        total: l.lineTotal,
                        product: { barcode: l.barcode, sku: l.sku },
                        notes: l.note,
                      })),
                    });
                  }}
                  className="h-9 rounded-xl border border-amber-500/30 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-40"
                >
                  {t.refundLastSale}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const toastId = toast.loading(t.shareWhatsAppPdfPreparing);
                    try {
                      let viewUrl: string | undefined;
                      if (lastInvoice.id) {
                        try {
                          const res = await api.createDocumentShareLink(
                            lastInvoice.id,
                            "receipt",
                          );
                          const data = res.data as {
                            shareUrl?: string;
                            sharePath?: string;
                          };
                          viewUrl = data.sharePath
                            ? toAppAbsoluteUrl(data.sharePath)
                            : data.shareUrl
                              ? toAppAbsoluteUrl(data.shareUrl)
                              : undefined;
                        } catch {
                          /* optional link */
                        }
                      }
                      const cust = customers.find((c) => c.id === contactId);
                      const receiptLines = (lastInvoice.lines || []).map((l) => ({
                        name: l.name,
                        qty: l.qty,
                        lineTotal: l.lineTotal,
                        barcode: l.barcode || null,
                        sku: l.sku || null,
                      }));
                      const printData: PosReceiptPrintData = {
                        brand: t.brand,
                        company: {
                          name: company?.name,
                          address: company?.address,
                          city: company?.city,
                          country: company?.country,
                          phone: company?.phone,
                          email: company?.email,
                          vatNumber: company?.vatNumber,
                          crNumber: company?.crNumber,
                          logo: company?.logo || "/brand/hisaby-mark.png",
                        },
                        number: lastInvoice.number,
                        paymentMethod: lastInvoice.paymentMethod,
                        warehouseLabel: lastInvoice.warehouseLabel,
                        total: lastInvoice.total || 0,
                        currency,
                        lines: receiptLines,
                        locale: locale === "en" ? "en" : "ar",
                        labels: {
                          vat: locale === "en" ? "VAT" : "الرقم الضريبي",
                          cr: locale === "en" ? "CR" : "السجل التجاري",
                          phone: locale === "en" ? "Phone" : "الهاتف",
                          email: locale === "en" ? "Email" : "البريد",
                          warehouse: t.warehouse,
                          payment: t.payment,
                          total: t.total,
                          barcode:
                            locale === "en"
                              ? "Scan barcode for returns"
                              : "امسح الباركود للإرجاع",
                          printBtn:
                            locale === "en" ? "Print receipt" : "طباعة الإيصال",
                        },
                      };
                      const result = await sharePosReceiptWhatsAppWithPdf({
                        share: {
                          companyName: company?.name,
                          number: lastInvoice.number,
                          warehouseLabel: lastInvoice.warehouseLabel,
                          paymentMethod: lastInvoice.paymentMethod,
                          total: lastInvoice.total,
                          currency,
                          lines: receiptLines,
                          customerPhone: cust?.phone,
                          viewUrl,
                        },
                        printData,
                        locale: locale === "en" ? "en" : "ar",
                      });
                      toast.dismiss(toastId);
                      if (result.sharedNative) {
                        toast.success(t.shareWhatsAppPdfOk);
                      } else {
                        toast.success(t.shareWhatsAppPdfDownloaded);
                      }
                    } catch {
                      toast.dismiss(toastId);
                      toast.error(t.shareWhatsAppPdfFail);
                    }
                  }}
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
                <button
                  type="button"
                  onClick={async () => {
                    if (!lastInvoice.id) {
                      toast.error(t.partnerPayOffline);
                      return;
                    }
                    const cust = customers.find((c) => c.id === contactId);
                    if (!cust?.phone) {
                      toast.error(t.shareSmsNeedCustomer);
                      return;
                    }
                    const toastId = toast.loading(t.shareSms);
                    try {
                      const res = await api.resendPosSaleNotify(lastInvoice.id);
                      toast.dismiss(toastId);
                      const sms = res.data?.delivery?.sms;
                      if (sms === "ok") toast.success(t.shareSmsOk);
                      else toast.error(t.shareSmsFail);
                    } catch (err: unknown) {
                      toast.dismiss(toastId);
                      const msg = (err as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message;
                      toast.error(typeof msg === "string" ? msg : t.shareSmsFail);
                    }
                  }}
                  className="min-h-10 h-10 rounded-xl border border-violet-500/30 text-sm text-violet-200 hover:bg-violet-500/10"
                >
                  {t.shareSms}
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

      {quickProductOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-bold text-white">{t.quickCreateProduct}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.quickCreateHint}</p>
              </div>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => !savingProduct && setQuickProductOpen(false)}
              >
                ✕
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">{t.quickProductBarcode}</span>
              <input
                value={quickBarcode}
                readOnly
                className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm text-amber-200 font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">{t.quickProductName}</span>
              <input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                autoFocus
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[11px] text-slate-400">{t.quickProductPrice}</span>
                <input
                  value={quickPrice}
                  onChange={(e) => setQuickPrice(e.target.value)}
                  inputMode="decimal"
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-slate-400">{t.quickProductCategory}</span>
                <input
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!quickName.trim() || !quickBarcode.trim() || savingProduct}
              onClick={() => void saveQuickProduct()}
              className="w-full h-11 rounded-xl bg-emerald-500 text-slate-950 font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {savingProduct && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.quickProductSave}
            </button>
          </div>
        </div>
      ) : null}

      <BarcodeCameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => void applyScanCode(code)}
      />

      {restorePrompt ? (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <p className="font-bold text-white">{t.restoreCartTitle}</p>
            <p className="text-[12px] text-slate-400">{t.restoreCartHint}</p>
            <p className="text-sm text-slate-200">
              {restorePrompt.cart.length} ·{" "}
              {formatMoney(
                restorePrompt.cart.reduce(
                  (s, l) =>
                    s +
                    Math.max(
                      0,
                      l.unitPrice * l.quantity - (l.discount || 0),
                    ),
                  0,
                ),
                currency,
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyRestorePrompt}
                className="flex-1 h-11 rounded-xl bg-emerald-500 text-slate-950 font-bold"
              >
                {t.restoreCartYes}
              </button>
              <button
                type="button"
                onClick={discardRestorePrompt}
                className="flex-1 h-11 rounded-xl border border-white/15 text-slate-200 font-semibold"
              >
                {t.restoreCartNo}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">{t.amountTendered}</span>
              <div className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-3 flex items-center justify-end text-xl font-bold tabular-nums text-white">
                {cashTendered || "0"}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={setCashExact}
                className="h-9 px-2.5 rounded-lg text-xs font-bold border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
              >
                {t.cashExact}
              </button>
              <button
                type="button"
                onClick={setCashRoundUp}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-200 hover:bg-white/5"
              >
                {t.cashRoundUp}
              </button>
              {[1, 5, 10, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addCashDenom(n)}
                  className="h-9 px-2.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-200 hover:bg-white/5"
                >
                  +{n}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => appendCashDigit(key)}
                    className="h-11 rounded-xl bg-white/5 border border-white/10 text-lg font-semibold text-white hover:bg-white/10 active:scale-[0.98]"
                  >
                    {key === "back" ? "⌫" : key}
                  </button>
                ),
              )}
            </div>
            {(() => {
              const tendered = parseFloat(cashTendered);
              const due = remainingDue;
              const ok = Number.isFinite(tendered) && tendered + 0.0005 >= due;
              const change = ok ? tendered - due : 0;
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
                parseFloat(cashTendered) + 0.0005 < remainingDue
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

      {noSaleOpen && !noSaleAwaitingApproval ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-white">{t.noSaleTitle}</p>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => !noSaleBusy && setNoSaleOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-400">{t.noSaleHint}</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  [t.noSaleChange, t.noSaleChange],
                  [t.noSaleFloat, t.noSaleFloat],
                  [t.noSaleManager, t.noSaleManager],
                  [t.noSaleOther, t.noSaleOther],
                ] as const
              ).map(([label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setNoSaleReason(label)}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                    noSaleReason === label
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/10 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={noSaleReason}
              onChange={(e) => setNoSaleReason(e.target.value)}
              placeholder={t.noSaleReason}
              className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              disabled={!noSaleReason.trim() || noSaleBusy}
              onClick={() => setNoSaleAwaitingApproval(true)}
              className="w-full h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40"
            >
              {t.noSaleConfirm}
            </button>
          </div>
        </div>
      ) : null}

      <DualApprovalModal
        open={noSaleOpen && noSaleAwaitingApproval}
        action="POS_NO_SALE"
        actionLabel={t.noSaleTitle}
        payload={{ reason: noSaleReason }}
        summary={noSaleReason || t.noSaleTitle}
        actorRole={user?.role}
        busy={noSaleBusy}
        onCancel={() => {
          if (!noSaleBusy) {
            setNoSaleAwaitingApproval(false);
            setNoSaleOpen(false);
          }
        }}
        onConfirm={confirmNoSale}
      />

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
        action={checkoutApprovalAction()}
        actionLabel={
          checkoutApprovalAction() === "POS_PRICE_OVERRIDE"
            ? locale === "en"
              ? "Confirm price override"
              : "تأكيد تجاوز السعر"
            : checkoutApprovalAction() === "POS_LINE_DISCOUNT"
              ? locale === "en"
                ? "Confirm line discount"
                : "تأكيد خصم السطر"
              : locale === "en"
                ? "Confirm stock override"
                : "تأكيد تجاوز المخزون"
        }
        payload={{
          method: pendingCheckout || undefined,
          allowNegativeStock: pendingAllowNegativeStock || undefined,
        }}
        summary={
          checkoutApprovalAction() === "POS_PRICE_OVERRIDE"
            ? locale === "en"
              ? "POS price override"
              : "تجاوز سعر الكاشير"
            : checkoutApprovalAction() === "POS_LINE_DISCOUNT"
              ? locale === "en"
                ? "POS line discount over limit"
                : "خصم سطر يتجاوز الحد"
              : locale === "en"
                ? "Sell past on-hand stock"
                : "بيع بتجاوز المخزون المتاح"
        }
        actorRole={user?.role}
        busy={checkoutBusy || paying}
        onCancel={() => {
          if (!checkoutBusy && !paying) {
            setPendingCheckout(null);
            setPendingSplitPayments(null);
            setPendingAllowNegativeStock(false);
          }
        }}
        onConfirm={async (approval) => {
          if (!pendingCheckout) return;
          setCheckoutBusy(true);
          const split = pendingSplitPayments;
          const allowNeg = pendingAllowNegativeStock;
          setPendingSplitPayments(null);
          setPendingAllowNegativeStock(false);
          await runCheckout(pendingCheckout, approval, split || undefined, {
            allowNegativeStock: allowNeg,
          });
        }}
      />

      {parkHoldOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => setParkHoldOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-white">{t.parkHoldTitle}</p>
            <p className="text-xs text-slate-400">{t.parkHoldHint}</p>
            <div className="flex flex-wrap gap-1">
              {[
                t.parkReasonWaitPay,
                t.parkReasonCustomerAway,
                t.parkReasonHold,
                t.parkReasonOther,
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setParkSuspendReason(reason);
                    applyParkReason(reason);
                  }}
                  className={`h-7 px-2 rounded-md text-[10px] font-semibold border ${
                    parkSuspendReason === reason
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/10 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              value={parkSuspendReason}
              onChange={(e) => setParkSuspendReason(e.target.value.slice(0, 120))}
              placeholder={t.parkReasonRequired}
              className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
            />
            <input
              value={parkHoldAmount}
              onChange={(e) => setParkHoldAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={t.parkHoldAmount}
              className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              inputMode="decimal"
            />
            <div className="flex gap-1.5">
              {(
                [
                  ["CASH", t.payCash],
                  ["CREDIT_CARD", t.payCard],
                  ["BANK_TRANSFER", t.payBank],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setParkHoldMethod(m)}
                  className={`flex-1 h-9 rounded-lg text-xs font-semibold border ${
                    parkHoldMethod === m
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/10 text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void parkCart()}
                className="flex-1 h-10 rounded-xl border border-white/15 text-sm text-slate-200"
              >
                {t.parkWithoutHold}
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = parseFloat(parkHoldAmount);
                  if (!Number.isFinite(amt) || amt < 0.001) {
                    toast.error(t.parkHoldAmount);
                    return;
                  }
                  if (amt > total + 0.005) {
                    toast.error(t.parkHoldTooHigh);
                    return;
                  }
                  void parkCart({ heldAmount: amt, heldMethod: parkHoldMethod });
                }}
                className="flex-1 h-10 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold"
              >
                {t.parkWithHold}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creditTopUpOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => !creditTopUpBusy && setCreditTopUpOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-white">{t.creditTopUpTitle}</p>
            <p className="text-xs text-slate-400">{t.creditTopUpHint}</p>
            <input
              value={creditTopUpAmount}
              onChange={(e) =>
                setCreditTopUpAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder={t.creditTopUpAmount}
              className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
              inputMode="decimal"
            />
            <div className="flex gap-1.5">
              {(
                [
                  ["CASH", t.payCash],
                  ["CREDIT_CARD", t.payCard],
                  ["BANK_TRANSFER", t.payBank],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCreditTopUpMethod(m)}
                  className={`flex-1 h-9 rounded-lg text-xs font-semibold border ${
                    creditTopUpMethod === m
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={creditTopUpBusy}
                onClick={() => setCreditTopUpOpen(false)}
                className="flex-1 h-10 rounded-xl border border-white/15 text-sm text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={creditTopUpBusy || !contactId}
                onClick={async () => {
                  const amt = parseFloat(creditTopUpAmount);
                  if (!contactId || !Number.isFinite(amt) || amt < 0.001) {
                    toast.error(t.creditTopUpAmount);
                    return;
                  }
                  setCreditTopUpBusy(true);
                  try {
                    const res = await api.topUpPosStoreCredit({
                      contactId,
                      amount: amt,
                      method: creditTopUpMethod,
                      warehouseId: warehouseId || undefined,
                    });
                    toast.success(
                      `${t.creditTopUpOk} · ${formatMoney(res.data.amount, currency)}`,
                    );
                    setCreditTopUpOpen(false);
                    try {
                      const cres = await api.getContacts("CUSTOMER");
                      setCustomers(
                        ((cres.data as Contact[]) || []).filter(
                          (c) => c.isActive !== false,
                        ),
                      );
                    } catch {
                      /* ignore */
                    }
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })
                      ?.response?.data?.message;
                    toast.error(typeof msg === "string" ? msg : t.creditTopUpFail);
                  } finally {
                    setCreditTopUpBusy(false);
                  }
                }}
                className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {creditTopUpBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.creditTopUp}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptsOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => setReceiptsOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#121a2b] shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <div>
                <p className="font-bold text-white">{t.receiptsDrawerTitle}</p>
                <p className="text-[11px] text-slate-400">{t.receiptsDrawerHint}</p>
              </div>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => setReceiptsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="px-3 pt-3">
              <input
                value={receiptsSearch}
                onChange={(e) => setReceiptsSearch(e.target.value)}
                placeholder={t.receiptsSearch}
                className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder:text-slate-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {receiptsLoading ? (
                <p className="text-sm text-slate-400 inline-flex items-center gap-2 py-6 justify-center w-full">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  …
                </p>
              ) : !recentSales.length ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  {receiptsSearch.trim() ? t.receiptsSearchEmpty : t.noRecentSales}
                </p>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{sale.number}</p>
                        <p className="text-[11px] text-slate-500">
                          {sale.createdAt
                            ? new Date(sale.createdAt).toLocaleString()
                            : sale.date
                              ? new Date(sale.date).toLocaleDateString()
                              : "—"}
                          {sale.contact?.name || sale.contact?.phone ? (
                            <span className="text-slate-400">
                              {" "}
                              ·{" "}
                              {[sale.contact?.name, sale.contact?.phone]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                          {sale.reprintCount ? (
                            <span className="text-amber-300/90">
                              {" "}
                              · {t.reprintCount}: {sale.reprintCount}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <p className="text-sky-300 font-semibold tabular-nums shrink-0">
                        {formatMoney(Number(sale.total), currency)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          void reprintSale(sale);
                          setReceiptsOpen(false);
                        }}
                        className="h-8 px-2.5 rounded-lg border border-sky-500/30 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/15"
                      >
                        {t.reprint}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void reprintSale(sale, { gift: true });
                          setReceiptsOpen(false);
                        }}
                        className="h-8 px-2.5 rounded-lg border border-violet-500/30 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/15"
                      >
                        {t.giftReceipt}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          voidSale(sale);
                          setReceiptsOpen(false);
                        }}
                        className="h-8 px-2.5 rounded-lg border border-rose-500/30 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15"
                      >
                        {t.voidSale}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void openRefund(sale);
                          setReceiptsOpen(false);
                        }}
                        className="h-8 px-2.5 rounded-lg border border-amber-500/30 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/15"
                      >
                        {t.refundSale}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

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
              <li>{t.shortcutF2}</li>
              <li>{t.shortcutF3}</li>
              <li>{t.shortcutF4}</li>
              <li>{t.shortcutF6}</li>
              <li>{t.shortcutF7}</li>
              <li>{t.shortcutF8}</li>
              <li>{t.shortcutF9}</li>
              <li>{t.shortcutF10}</li>
              <li>{t.shortcutQtyPlus}</li>
              <li>{t.shortcutQtyMinus}</li>
              <li>{t.shortcutHelp}</li>
            </ul>
          </div>
        </div>
      ) : null}

      {parkEdit ? (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => setParkEdit(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-white">{t.parkEditTitle}</p>
            <input
              value={parkEdit.name}
              onChange={(e) =>
                setParkEdit((p) => (p ? { ...p, name: e.target.value } : p))
              }
              className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm text-white"
              placeholder={t.renameParkedPrompt}
            />
            <textarea
              value={parkEdit.notes}
              onChange={(e) =>
                setParkEdit((p) => (p ? { ...p, notes: e.target.value } : p))
              }
              rows={3}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
              placeholder={t.parkNotesPlaceholder}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveParkEdit()}
                className="flex-1 h-10 rounded-xl bg-sky-500 font-bold text-white text-sm"
              >
                {t.parkSaveEdit}
              </button>
              <button
                type="button"
                onClick={() => setParkEdit(null)}
                className="h-10 px-4 rounded-xl border border-white/15 text-sm text-slate-300"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
