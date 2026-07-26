"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
  LayoutGrid,
  Printer,
} from "lucide-react";
import api, { type RestoOrderPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { restoCopy } from "@/lib/resto-copy";
import { printRestoGuestCheck } from "@/lib/resto-guest-check";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";

type FloorTable = {
  id: string;
  code: string;
  name: string | null;
  seats: number;
  status: string;
  guestToken?: string | null;
  guestCallAt?: string | null;
  guestCallType?: string | null;
  openOrder: {
    id: string;
    number: string;
    status: string;
    guests: number;
    itemCount: number;
    total?: number;
    createdAt?: string;
    occupiedMinutes?: number;
    guestItemCount?: number;
  } | null;
};

type FloorZone = {
  id: string;
  name: string;
  nameEn: string | null;
  sectionServer?: { id: string; name: string; assignmentId: string } | null;
  tables: FloorTable[];
};

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
  image?: string | null;
  images?: string[];
  defaultStationId?: string | null;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
};

function statusStyle(status: string, occupied: boolean) {
  if (occupied || status === "OCCUPIED") {
    return "border-amber-400/50 bg-amber-500/20 text-amber-50";
  }
  if (status === "BILLING") {
    return "border-sky-400/40 bg-sky-500/15 text-sky-50";
  }
  if (status === "RESERVED") {
    return "border-violet-400/40 bg-violet-500/15 text-violet-50";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-50 hover:border-emerald-400/50";
}

export default function RestoFloorPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const [companyName, setCompanyName] = useState("");
  const [zones, setZones] = useState<FloorZone[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<RestoOrderPayload | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState(false);
  const [menuQ, setMenuQ] = useState("");
  const [guests, setGuests] = useState(2);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [tipAssigneeId, setTipAssigneeId] = useState("");
  const [staff, setStaff] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [staffError, setStaffError] = useState(false);
  const [serviceChargePct, setServiceChargePct] = useState("10");
  const [cashPart, setCashPart] = useState("");
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [loyaltyName, setLoyaltyName] = useState("");
  const [loyaltyRedeem, setLoyaltyRedeem] = useState("");
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidTarget, setVoidTarget] = useState<{
    itemId: string;
    comp: boolean;
    reason: string;
  } | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [modifiers, setModifiers] = useState<
    Array<{ id: string; name: string; nameEn: string | null; priceDelta: number }>
  >([]);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [opsMode, setOpsMode] = useState<"none" | "transfer" | "merge" | "split">(
    "none",
  );
  const [opsTableId, setOpsTableId] = useState("");
  const [opsTargetOrderId, setOpsTargetOrderId] = useState("");
  const [splitItemIds, setSplitItemIds] = useState<string[]>([]);
  const [course, setCourse] = useState(1);
  const [seat, setSeat] = useState<number | null>(1);
  const [settleSeat, setSettleSeat] = useState(1);
  const [equalParts, setEqualParts] = useState("2");
  const [shiftOpen, setShiftOpen] = useState<boolean | null>(null);

  const loadFloor = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getRestoFloor();
      setCompanyName(res.data.companyName);
      setZones(res.data.zones || []);
      setEmpty(!!res.data.empty);
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.getRestoStaff();
      setStaff(res.data.staff || []);
      setStaffError(false);
    } catch {
      setStaff([]);
      setStaffError(true);
    }
  }, []);

  useEffect(() => {
    void loadFloor();
    void loadStaff();
    void (async () => {
      try {
        const link = await api.getRestoLinkStatus();
        const wh = link.data.warehouseId || undefined;
        const shift = await api.getCurrentPosShift(wh);
        setShiftOpen(!!(shift.data as { shift?: unknown })?.shift);
      } catch {
        setShiftOpen(null);
      }
    })();
  }, [loadFloor, loadStaff]);

  useEffect(() => {
    if (!order) {
      setTipAssigneeId("");
      return;
    }
    setTipAssigneeId(order.tipAssigneeId || order.openedById || "");
  }, [order?.id, order?.tipAssigneeId, order?.openedById]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.getRestoStations();
        setStations(res.data.stations || []);
      } catch {
        /* ignore */
      }
      try {
        const res = await api.getRestoModifiers();
        setModifiers(res.data.modifiers || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.getRestoMenu(menuQ.trim() || undefined, "now");
          if (!cancelled) {
            setMenu(res.data.items || []);
            setMenuError(false);
          }
        } catch {
          if (!cancelled) {
            setMenu([]);
            setMenuError(true);
          }
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [order, menuQ]);

  const itemStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: t.pending,
      SENT: t.sent,
      PREPARING: t.preparing,
      READY: t.ready,
      SERVED: t.served,
      CANCELLED: t.cancelled,
    };
    return map[s] || s;
  };

  const onSeed = async () => {
    setSeeding(true);
    setError("");
    try {
      await api.seedRestoFloor(8);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setSeeding(false);
    }
  };

  const openTable = async (table: FloorTable) => {
    setBusy(true);
    setError("");
    try {
      if (table.openOrder?.id) {
        const res = await api.getRestoOrder(table.openOrder.id);
        setOrder(res.data);
      } else {
        const res = await api.openRestoOrder({
          tableId: table.id,
          guests,
        });
        const zone = zones.find((z) =>
          z.tables.some((tb) => tb.id === table.id),
        );
        const sectionId = zone?.sectionServer?.id;
        if (sectionId && !res.data.tipAssigneeId) {
          try {
            const patched = await api.updateRestoOrder(res.data.id, {
              tipAssigneeId: sectionId,
            });
            setOrder(patched.data);
          } catch {
            setOrder(res.data);
          }
        } else {
          setOrder(res.data);
        }
        await loadFloor();
      }
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const refreshOrder = async (id: string) => {
    const res = await api.getRestoOrder(id);
    setOrder(res.data);
    await loadFloor();
  };

  const addProduct = async (productId: string, defaultStationId?: string | null) => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const mods = modifiers
        .filter((m) => selectedMods.includes(m.id))
        .map((m) => ({
          name: locale === "en" && m.nameEn ? m.nameEn : m.name,
          priceDelta: m.priceDelta,
        }));
      const res = await api.addRestoOrderItem(order.id, {
        productId,
        qty: 1,
        notes: itemNote.trim() || undefined,
        stationId: stationId || defaultStationId || undefined,
        course,
        seat: seat ?? null,
        modifiers: mods.length ? mods : undefined,
      });
      setOrder(res.data);
      setItemNote("");
      setSelectedMods([]);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const freeTables = zones
    .flatMap((z) => z.tables)
    .filter(
      (tb) =>
        !tb.openOrder &&
        tb.status !== "OCCUPIED" &&
        tb.status !== "BILLING" &&
        tb.id !== order?.table?.id,
    );

  const otherOpenOrders = zones
    .flatMap((z) => z.tables)
    .filter((tb) => tb.openOrder && tb.openOrder.id !== order?.id)
    .map((tb) => ({
      orderId: tb.openOrder!.id,
      label: `${tb.code} · ${tb.openOrder!.number}`,
    }));

  const runTransfer = async () => {
    if (!order || !opsTableId) return;
    setBusy(true);
    try {
      const res = await api.transferRestoOrder(order.id, opsTableId);
      setOrder(res.data);
      setOpsMode("none");
      setOpsTableId("");
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const runMerge = async () => {
    if (!order || !opsTargetOrderId) return;
    if (!window.confirm(t.confirmMerge)) return;
    setBusy(true);
    try {
      await api.mergeRestoOrder(order.id, opsTargetOrderId);
      setOrder(null);
      setOpsMode("none");
      setOpsTargetOrderId("");
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const runSplit = async (asTakeaway: boolean) => {
    if (!order || splitItemIds.length === 0) return;
    if (!asTakeaway && !opsTableId) return;
    setBusy(true);
    try {
      const res = await api.splitRestoOrder(order.id, {
        itemIds: splitItemIds,
        tableId: asTakeaway ? undefined : opsTableId || undefined,
      });
      setOrder(res.data.source);
      setOpsMode("none");
      setSplitItemIds([]);
      setOpsTableId("");
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const toggleSplitItem = (id: string) => {
    setSplitItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const bumpQty = async (itemId: string, qty: number) => {
    if (!order || qty < 0.001) return;
    setBusy(true);
    try {
      const res = await api.updateRestoOrderItem(order.id, itemId, { qty });
      setOrder(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const saveItemNote = async (itemId: string, notes: string) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.updateRestoOrderItem(order.id, itemId, { notes });
      setOrder(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const saveGuests = async (n: number) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.updateRestoOrder(order.id, { guests: n });
      setOrder(res.data);
      setGuests(n);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.removeRestoOrderItem(order.id, itemId);
      setOrder(res.data);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const voidOrComp = (itemId: string, comp: boolean) => {
    if (!order) return;
    const reason =
      voidReason.trim() ||
      window.prompt(t.voidReasonPh)?.trim() ||
      "";
    if (reason.length < 2) return;
    setVoidTarget({ itemId, comp, reason });
  };

  const confirmVoidOrComp = async (approval: DualApprovalPayload) => {
    if (!order || !voidTarget) return;
    setVoidBusy(true);
    setBusy(true);
    try {
      const res = await api.voidRestoOrderItem(order.id, voidTarget.itemId, {
        reason: voidTarget.reason,
        comp: voidTarget.comp,
        approval,
      });
      setOrder(res.data);
      setVoidReason("");
      setVoidTarget(null);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setVoidBusy(false);
      setBusy(false);
    }
  };

  const sendKitchen = async (fireCourse?: number) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.sendRestoOrder(order.id, fireCourse);
      setOrder(res.data);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const courseLabel = (c: number) => {
    if (c === 0) return t.courseDrinks;
    if (c === 1) return t.courseStarter;
    if (c === 2) return t.courseMain;
    if (c === 3) return t.courseDessert;
    return `${t.course} ${c}`;
  };

  const printCheck = (seatFilter?: number | null) => {
    if (!order) return;
    printRestoGuestCheck({
      order,
      company: company
        ? {
            name: company.name,
            address: company.address,
            city: company.city,
            country: company.country,
            phone: company.phone,
            email: company.email,
            vatNumber: company.vatNumber,
            crNumber: company.crNumber,
            logo: company.logo,
          }
        : { name: companyName || "Hisaby" },
      currency: company?.currency || "OMR",
      locale: locale === "en" ? "en" : "ar",
      tipAmount: Number(tipAmount) || 0,
      ...(seatFilter !== undefined ? { seat: seatFilter } : {}),
    });
  };

  const setItemSeat = async (itemId: string, next: number | null) => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.updateRestoOrderItem(order.id, itemId, {
        seat: next,
      });
      setOrder(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const cycleItemSeat = (itemId: string, current: number | null | undefined) => {
    if (!order) return;
    const max = Math.max(1, order.guests || 1);
    let next: number | null;
    if (current == null) next = 1;
    else if (current >= max) next = null;
    else next = current + 1;
    void setItemSeat(itemId, next);
  };

  const settleBySeatPay = async (
    method: "CASH" | "CREDIT_CARD" = "CASH",
  ) => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.settleRestoBySeat(order.id, {
        seat: settleSeat,
        paymentMethod: method,
        tipAmount: Number(tipAmount) || undefined,
        tipAssigneeId: tipAssigneeId || undefined,
        serviceChargePct: Number(serviceChargePct) || undefined,
        contactId: order.contactId || order.loyalty?.contactId || undefined,
        loyaltyPointsToRedeem:
          Number(loyaltyRedeem) > 0 ? Number(loyaltyRedeem) : undefined,
      });
      if (res.data.source) {
        setOrder(res.data.source);
      } else {
        setOrder(null);
      }
      setTipAmount("");
      setCashPart("");
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const settleEqualPay = async (
    method: "CASH" | "CREDIT_CARD" = "CASH",
  ) => {
    if (!order) return;
    const parts = Math.max(2, Math.min(20, Math.floor(Number(equalParts) || 2)));
    setBusy(true);
    setError("");
    try {
      await api.settleRestoEqual(order.id, {
        parts,
        paymentMethod: method,
        tipAmount: Number(tipAmount) || undefined,
        tipAssigneeId: tipAssigneeId || undefined,
        serviceChargePct: Number(serviceChargePct) || undefined,
        contactId: order.contactId || order.loyalty?.contactId || undefined,
        loyaltyPointsToRedeem:
          Number(loyaltyRedeem) > 0 ? Number(loyaltyRedeem) : undefined,
      });
      setOrder(null);
      setTipAmount("");
      setCashPart("");
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const attachLoyalty = async () => {
    if (!order || !loyaltyPhone.trim()) return;
    setLoyaltyBusy(true);
    setError("");
    try {
      const res = await api.attachRestoLoyalty(order.id, {
        phone: loyaltyPhone.trim(),
        name: loyaltyName.trim() || undefined,
      });
      setOrder(res.data);
      setLoyaltyPhone("");
      setLoyaltyName("");
    } catch {
      setError(t.actionFail);
    } finally {
      setLoyaltyBusy(false);
    }
  };

  const clearLoyalty = async () => {
    if (!order) return;
    setLoyaltyBusy(true);
    setError("");
    try {
      const res = await api.attachRestoLoyalty(order.id, { contactId: null });
      setOrder(res.data);
      setLoyaltyRedeem("");
    } catch {
      setError(t.actionFail);
    } finally {
      setLoyaltyBusy(false);
    }
  };

  const closeOrder = async (
    method: "CASH" | "CREDIT_CARD" | "soft" | "SPLIT" = "CASH",
  ) => {
    if (!order) return;
    setBusy(true);
    try {
      const tipTo = tipAssigneeId || undefined;
      const loyalty =
        order.contactId || order.loyalty?.contactId
          ? {
              contactId: order.contactId || order.loyalty?.contactId || undefined,
              loyaltyPointsToRedeem:
                Number(loyaltyRedeem) > 0 ? Number(loyaltyRedeem) : undefined,
            }
          : {};
      if (method === "soft") {
        await api.closeRestoOrder(order.id, { soft: true });
      } else if (method === "SPLIT") {
        const tip = Number(tipAmount) || 0;
        const pct = Number(serviceChargePct) || 0;
        const due =
          Number((order.subtotal + tip + (order.subtotal * pct) / 100).toFixed(3));
        const cash = Number(cashPart) || 0;
        if (cash <= 0 || cash >= due) {
          setError(t.actionFail);
          setBusy(false);
          return;
        }
        const card = Number((due - cash).toFixed(3));
        await api.closeRestoOrder(order.id, {
          payments: [
            { method: "CASH", amount: cash },
            { method: "CREDIT_CARD", amount: card },
          ],
          tipAmount: tip || undefined,
          tipAssigneeId: tipTo,
          serviceChargePct: pct || undefined,
          ...loyalty,
        });
      } else {
        await api.closeRestoOrder(order.id, {
          paymentMethod: method,
          tipAmount: Number(tipAmount) || undefined,
          tipAssigneeId: tipTo,
          serviceChargePct: Number(serviceChargePct) || undefined,
          ...loyalty,
        });
      }
      setOrder(null);
      setTipAmount("");
      setTipAssigneeId("");
      setCashPart("");
      setLoyaltyPhone("");
      setLoyaltyName("");
      setLoyaltyRedeem("");
      await loadFloor();
    } catch (err) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(" ") : String(raw || "");
      if (/shift|وردية/i.test(msg)) {
        setError(t.needOpenShift);
        setShiftOpen(false);
      } else {
        setError(t.actionFail);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendPayLink = async () => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.createRestoPayLink(order.id, {
        tipAmount: Number(tipAmount) || undefined,
        tipAssigneeId: tipAssigneeId || undefined,
        serviceChargePct: Number(serviceChargePct) || undefined,
      });
      if (res.data.alreadyPaid) {
        setOrder(null);
        await loadFloor();
        return;
      }
      if (res.data.payUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(res.data.payUrl);
        } catch {
          /* ignore */
        }
      }
      if (res.data.payUrl) {
        window.open(res.data.payUrl, "_blank", "noopener,noreferrer");
      }
      const refreshed = await api.getRestoOrder(order.id);
      setOrder(refreshed.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (!window.confirm(t.cancelConfirm)) return;
    setBusy(true);
    try {
      await api.cancelRestoOrder(order.id);
      setOrder(null);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const openTakeaway = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.openRestoOrder({
        channel: "TAKEAWAY",
        guests: 1,
      });
      setOrder(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => n.toFixed(3);
  const pendingCount =
    order?.items.filter((i) => i.status === "PENDING").length ?? 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-amber-400" />
            {t.floor}
          </h1>
          {companyName ? (
            <p className="text-sm text-stone-400 mt-1">{companyName}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 flex items-center gap-2">
            {t.guests}
            <input
              type="number"
              min={1}
              max={50}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value) || 1)}
              className="w-14 h-9 rounded-lg bg-[#1a1614] border border-white/10 px-2 text-sm tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openTakeaway()}
            className="h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 text-xs font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {t.takeaway}
          </button>
          <button
            type="button"
            onClick={() => void loadFloor()}
            className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-stone-300 hover:bg-white/5"
          >
            {t.refresh}
          </button>
        </div>
      </div>

      {shiftOpen === false ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-amber-100">{t.needOpenShift}</p>
          <Link
            href="/resto/shifts"
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#14110f]"
          >
            {t.goToShifts}
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : empty ? (
        <div className="rounded-3xl border border-dashed border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-stone-900/40 p-8 sm:p-12 text-center space-y-4">
          <p className="text-lg font-bold text-amber-100">{t.floorEmptyTitle}</p>
          <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
            {t.floorEmptyBody}
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void onSeed()}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#14110f] hover:bg-amber-400 disabled:opacity-60"
          >
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {seeding ? t.seeding : t.seedFloor}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
          <div className="space-y-6">
            {zones.map((zone) => {
              const zoneLabel =
                locale === "en" && zone.nameEn ? zone.nameEn : zone.name;
              return (
                <section key={zone.id} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-bold text-stone-300 tracking-wide">
                      {zoneLabel}
                    </h2>
                    {zone.sectionServer ? (
                      <p className="text-[11px] text-amber-200/90">
                        {t.sectionServer}:{" "}
                        <span className="font-semibold">
                          {zone.sectionServer.name}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {zone.tables.map((table) => {
                      const occupied = !!table.openOrder;
                      const calling = !!table.guestCallAt;
                      return (
                        <div
                          key={table.id}
                          className={`rounded-2xl border p-3 transition min-h-[110px] flex flex-col ${statusStyle(
                            table.status,
                            occupied,
                          )} ${calling ? "ring-2 ring-rose-400/70" : ""}`}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void openTable(table)}
                            className="text-start flex-1"
                          >
                            <p className="text-lg font-extrabold tracking-tight">
                              {table.code}
                            </p>
                            <p className="text-xs opacity-70 mt-0.5">
                              {table.seats} {t.seats}
                            </p>
                            {calling ? (
                              <p className="mt-2 text-[11px] font-bold text-rose-200">
                                {t.guestCall}:{" "}
                                {table.guestCallType === "CHECK"
                                  ? t.guestCallCheck
                                  : table.guestCallType === "WATER"
                                    ? t.guestCallWater
                                    : t.guestCallWaiter}
                              </p>
                            ) : null}
                            {table.openOrder ? (
                              <div className="mt-2 space-y-0.5">
                                <p className="text-xs font-semibold">
                                  {table.openOrder.number}
                                </p>
                                <p className="text-[11px] opacity-80">
                                  {table.openOrder.itemCount} ·{" "}
                                  {itemStatusLabel(table.openOrder.status)}
                                  {typeof table.openOrder.occupiedMinutes ===
                                  "number"
                                    ? ` · ${table.openOrder.occupiedMinutes} ${t.occupiedMin}`
                                    : ""}
                                </p>
                                {(table.openOrder.guestItemCount ?? 0) > 0 ? (
                                  <p className="text-[10px] font-bold text-violet-200">
                                    {t.guestOrderBadge}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs font-semibold opacity-80">
                                {t.free}
                              </p>
                            )}
                          </button>
                          <div className="flex gap-1 mt-2">
                            {table.guestToken ? (
                              <button
                                type="button"
                                className="flex-1 rounded-lg border border-white/15 py-1 text-[10px] font-bold hover:bg-black/20"
                                onClick={() => {
                                  const url = `${window.location.origin}/order/${table.guestToken}`;
                                  void navigator.clipboard.writeText(url);
                                }}
                              >
                                {t.guestQr}
                              </button>
                            ) : null}
                            {calling ? (
                              <button
                                type="button"
                                className="flex-1 rounded-lg bg-rose-600/80 py-1 text-[10px] font-bold"
                                onClick={() =>
                                  void api
                                    .clearRestoGuestCall(table.id)
                                    .then(() => loadFloor())
                                }
                              >
                                {t.guestCallClear}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="rounded-2xl border border-white/10 bg-[#1a1614]/80 p-4 space-y-3 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            {!order ? (
              <p className="text-sm text-stone-400 py-8 text-center">
                {t.openOrder}
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-500">
                      {t.table} {order.table?.code}
                    </p>
                    <p className="font-bold text-amber-100">{order.number}</p>
                    <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{t.guestsEdit}</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={order.guests}
                        disabled={busy}
                        onChange={(e) =>
                          void saveGuests(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-14 h-7 rounded-md bg-black/30 border border-white/10 px-1 text-xs tabular-nums"
                      />
                      <span>· {itemStatusLabel(order.status)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrder(null)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ul className="space-y-2">
                  {order.items.length === 0 ? (
                    <li className="text-xs text-stone-500 py-2">{t.noItems}</li>
                  ) : (
                    order.items.map((it) => (
                      <li
                        key={it.id}
                        className="rounded-xl bg-white/[0.04] px-3 py-2 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-start gap-2">
                            {opsMode === "split" ? (
                              <input
                                type="checkbox"
                                checked={splitItemIds.includes(it.id)}
                                onChange={() => toggleSplitItem(it.id)}
                                className="mt-1"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{it.name}</p>
                              <p className="text-[11px] text-stone-500">
                                {courseLabel(it.course ?? 1)} ·{" "}
                                {itemStatusLabel(it.status)} · {fmt(it.lineTotal)}
                              </p>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  cycleItemSeat(it.id, it.seat ?? null)
                                }
                                className="mt-1 text-[10px] font-bold rounded-md border border-white/15 px-1.5 py-0.5 text-amber-100/90 hover:bg-white/5 disabled:opacity-40"
                                title={t.seat}
                              >
                                {it.seat != null
                                  ? `${t.seat} ${it.seat}`
                                  : t.seatShared}
                              </button>
                            </div>
                          </div>
                          {it.status === "PENDING" ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={busy || it.qty <= 1}
                                onClick={() => void bumpQty(it.id, Number(it.qty) - 1)}
                                className="w-7 h-7 rounded-md border border-white/10 text-xs font-bold disabled:opacity-40"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs tabular-nums">
                                {it.qty}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void bumpQty(it.id, Number(it.qty) + 1)}
                                className="w-7 h-7 rounded-md border border-white/10 text-xs font-bold"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void removeItem(it.id)}
                                className="text-stone-500 hover:text-rose-300 p-1"
                                title={t.remove}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs tabular-nums text-stone-400">
                                {it.isComp ? "COMP " : ""}×{it.qty}
                              </span>
                              {it.status !== "CANCELLED" && !it.isComp ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void voidOrComp(it.id, true)}
                                    className="text-[10px] font-bold text-sky-300 px-1"
                                    title={t.compItem}
                                  >
                                    COMP
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void voidOrComp(it.id, false)}
                                    className="text-[10px] font-bold text-rose-300 px-1"
                                    title={t.voidItem}
                                  >
                                    VOID
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                        {it.status === "PENDING" ? (
                          <input
                            defaultValue={it.notes || ""}
                            placeholder={t.itemNotesPh}
                            disabled={busy}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (it.notes || "")) {
                                void saveItemNote(it.id, v);
                              }
                            }}
                            className="w-full h-8 rounded-md bg-black/30 border border-white/10 px-2 text-[11px]"
                          />
                        ) : it.notes ? (
                          <p className="text-[11px] text-amber-200/80">{it.notes}</p>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>

                <div className="flex items-center justify-between text-sm font-bold border-t border-white/10 pt-3">
                  <span>{t.orderTotal}</span>
                  <span className="tabular-nums text-amber-200">
                    {fmt(order.subtotal)}
                  </span>
                </div>

                <div className="border border-white/10 rounded-xl p-2 space-y-2">
                  <p className="text-[11px] font-bold text-stone-400">{t.opsTitle}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["transfer", t.transferTable],
                        ["merge", t.mergeOrder],
                        ["split", t.splitOrder],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setOpsMode((m) => (m === mode ? "none" : mode));
                          setOpsTableId("");
                          setOpsTargetOrderId("");
                          setSplitItemIds([]);
                        }}
                        className={`rounded-lg px-1.5 py-1.5 text-[10px] font-bold ${
                          opsMode === mode
                            ? "bg-violet-500/30 text-violet-100 border border-violet-400/40"
                            : "border border-white/10 text-stone-300 hover:bg-white/5"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {opsMode === "transfer" ? (
                    <div className="space-y-1.5">
                      <select
                        value={opsTableId}
                        onChange={(e) => setOpsTableId(e.target.value)}
                        className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                      >
                        <option value="">{t.pickFreeTable}</option>
                        {freeTables.map((tb) => (
                          <option key={tb.id} value={tb.id}>
                            {tb.code}
                            {tb.name ? ` · ${tb.name}` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !opsTableId}
                        onClick={() => void runTransfer()}
                        className="w-full rounded-lg bg-violet-600/80 py-2 text-[11px] font-bold disabled:opacity-40"
                      >
                        {t.confirmTransfer}
                      </button>
                    </div>
                  ) : null}
                  {opsMode === "merge" ? (
                    <div className="space-y-1.5">
                      <select
                        value={opsTargetOrderId}
                        onChange={(e) => setOpsTargetOrderId(e.target.value)}
                        className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                      >
                        <option value="">{t.pickTargetOrder}</option>
                        {otherOpenOrders.map((o) => (
                          <option key={o.orderId} value={o.orderId}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !opsTargetOrderId}
                        onClick={() => void runMerge()}
                        className="w-full rounded-lg bg-violet-600/80 py-2 text-[11px] font-bold disabled:opacity-40"
                      >
                        {t.confirmMerge}
                      </button>
                    </div>
                  ) : null}
                  {opsMode === "split" ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-stone-500">{t.splitHint}</p>
                      <select
                        value={opsTableId}
                        onChange={(e) => setOpsTableId(e.target.value)}
                        className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                      >
                        <option value="">{t.pickFreeTable}</option>
                        {freeTables.map((tb) => (
                          <option key={tb.id} value={tb.id}>
                            {tb.code}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={busy || splitItemIds.length === 0 || !opsTableId}
                          onClick={() => void runSplit(false)}
                          className="rounded-lg bg-violet-600/80 py-2 text-[10px] font-bold disabled:opacity-40"
                        >
                          {t.confirmSplit}
                        </button>
                        <button
                          type="button"
                          disabled={busy || splitItemIds.length === 0}
                          onClick={() => void runSplit(true)}
                          className="rounded-lg border border-white/15 py-2 text-[10px] font-bold disabled:opacity-40"
                        >
                          {t.splitTakeaway}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-2">
                  <p className="text-[11px] font-bold text-amber-100/90">{t.loyalty}</p>
                  {order.loyalty ? (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-stone-100">
                            {order.loyalty.name}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {t.loyaltyPoints}: {order.loyalty.points}
                            {order.loyalty.phone
                              ? ` · ${order.loyalty.phone}`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={loyaltyBusy}
                          onClick={() => void clearLoyalty()}
                          className="text-[10px] font-semibold text-stone-400 hover:text-rose-200 disabled:opacity-40"
                        >
                          {t.loyaltyClear}
                        </button>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-[10px] text-stone-500">
                          {t.loyaltyRedeem}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={loyaltyRedeem}
                          onChange={(e) => setLoyaltyRedeem(e.target.value)}
                          className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-2 text-xs tabular-nums"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-stone-500">{t.loyaltyHint}</p>
                      <input
                        value={loyaltyPhone}
                        onChange={(e) => setLoyaltyPhone(e.target.value)}
                        placeholder={t.loyaltyPhone}
                        className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                        inputMode="tel"
                      />
                      <input
                        value={loyaltyName}
                        onChange={(e) => setLoyaltyName(e.target.value)}
                        placeholder={t.guestName}
                        className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                      />
                      <button
                        type="button"
                        disabled={loyaltyBusy || !loyaltyPhone.trim()}
                        onClick={() => void attachLoyalty()}
                        className="w-full rounded-lg bg-amber-500/90 text-[#14110f] py-1.5 text-[11px] font-bold disabled:opacity-40"
                      >
                        {t.loyaltyAttach}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-stone-500">{t.tipAmount}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-stone-500">{t.serviceChargePct}</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step="1"
                      value={serviceChargePct}
                      onChange={(e) => setServiceChargePct(e.target.value)}
                      className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
                    />
                  </label>
                </div>
                {staffError ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-rose-300">{t.loadFailed}</p>
                    <button
                      type="button"
                      onClick={() => void loadStaff()}
                      className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950"
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : staff.length > 0 ? (
                  <label className="block space-y-1">
                    <span className="text-[11px] text-stone-500">
                      {t.tipAssignee}
                    </span>
                    <select
                      value={tipAssigneeId}
                      onChange={(e) => setTipAssigneeId(e.target.value)}
                      className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                    >
                      <option value="">{t.sectionUnassigned}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-stone-500">
                      {t.tipAssigneeHint}
                    </span>
                  </label>
                ) : null}
                <label className="block space-y-1">
                  <span className="text-[11px] text-stone-500">
                    {t.paySplit} — {t.cashPart}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={cashPart}
                    onChange={(e) => setCashPart(e.target.value)}
                    className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
                  />
                </label>
                <input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.voidReasonPh}
                  className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-2 text-[11px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!order.items.length}
                    onClick={() => printCheck()}
                    className="self-end inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-white/15 text-xs font-semibold hover:bg-white/5 disabled:opacity-40 col-span-2"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t.printCheck}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {([0, 1, 2, 3] as const).map((c) => {
                      const n = order.items.filter(
                        (i) => i.status === "PENDING" && (i.course ?? 1) === c,
                      ).length;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={busy || n === 0}
                          onClick={() => void sendKitchen(c)}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-100 disabled:opacity-40"
                        >
                          {t.fireCourse}: {courseLabel(c)}
                          {n > 0 ? ` (${n})` : ""}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={busy || pendingCount === 0}
                    onClick={() => void sendKitchen()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-[#14110f] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t.fireAll}
                    {pendingCount > 0 ? ` (${pendingCount})` : ""}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy || (order?.itemCount ?? 0) === 0}
                      onClick={() => void closeOrder("CASH")}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t.payCash}
                    </button>
                    <button
                      type="button"
                      disabled={busy || (order?.itemCount ?? 0) === 0}
                      onClick={() => void closeOrder("CREDIT_CARD")}
                      className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t.payCard}
                    </button>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-stone-300">
                        {t.settleBySeat}
                      </span>
                      <select
                        value={settleSeat}
                        onChange={(e) => setSettleSeat(Number(e.target.value))}
                        className="h-7 rounded-md bg-black/40 border border-white/10 px-1.5 text-[11px]"
                      >
                        {Array.from(
                          { length: Math.max(1, order.guests || 1) },
                          (_, i) => i + 1,
                        ).map((s) => (
                          <option key={s} value={s}>
                            {t.seat} {s}
                            {order.bySeat?.find((b) => b.seat === s)
                              ? ` · ${fmt(
                                  order.bySeat.find((b) => b.seat === s)!
                                    .subtotal,
                                )}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void settleBySeatPay("CASH")}
                        className="rounded-lg bg-emerald-700/90 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                      >
                        {t.payCash}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void settleBySeatPay("CREDIT_CARD")}
                        className="rounded-lg bg-sky-700/90 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                      >
                        {t.payCard}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => printCheck(settleSeat)}
                      className="w-full rounded-lg border border-white/15 py-1.5 text-[10px] font-semibold text-stone-300 hover:bg-white/5 disabled:opacity-40"
                    >
                      {t.printSeatCheck}
                    </button>
                    <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                      <label className="flex-1 space-y-0.5">
                        <span className="text-[10px] text-stone-500">
                          {t.equalParts}
                        </span>
                        <input
                          type="number"
                          min={2}
                          max={20}
                          value={equalParts}
                          onChange={(e) => setEqualParts(e.target.value)}
                          className="w-full h-7 rounded-md bg-black/40 border border-white/10 px-2 text-[11px] tabular-nums"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy || (order?.itemCount ?? 0) === 0}
                        onClick={() => void settleEqualPay("CASH")}
                        className="mt-3 rounded-lg border border-violet-400/35 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-bold text-violet-100 disabled:opacity-40"
                      >
                        {t.settleEqual}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (order?.itemCount ?? 0) === 0 ||
                      !(Number(cashPart) > 0)
                    }
                    onClick={() => void closeOrder("SPLIT")}
                    className="w-full rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 disabled:opacity-50"
                  >
                    {t.paySplit}
                    {Number(cashPart) > 0 && order
                      ? ` · ${t.cashPart} ${Number(cashPart).toFixed(3)} + ${t.cardPart}`
                      : ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy || (order?.itemCount ?? 0) === 0}
                    onClick={() => void sendPayLink()}
                    className="w-full rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50"
                  >
                    {t.payLink}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void closeOrder("soft")}
                    className="w-full rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-stone-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    {t.softClose}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelOrder()}
                    className="w-full rounded-xl border border-rose-500/35 text-rose-200 px-3 py-2 text-[11px] font-semibold hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {t.cancelOrder}
                  </button>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {t.closePaidHint}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-2">
                  <p className="text-xs font-bold text-stone-300">{t.addItems}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([0, 1, 2, 3] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCourse(c)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold border ${
                          course === c
                            ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                            : "border-white/10 text-stone-400 hover:bg-white/5"
                        }`}
                      >
                        {courseLabel(c)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSeat(null)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold border ${
                        seat === null
                          ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                          : "border-white/10 text-stone-400 hover:bg-white/5"
                      }`}
                    >
                      {t.seatShared}
                    </button>
                    {Array.from(
                      { length: Math.max(1, order.guests || 1) },
                      (_, i) => i + 1,
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeat(s)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold border ${
                          seat === s
                            ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                            : "border-white/10 text-stone-400 hover:bg-white/5"
                        }`}
                      >
                        {t.seat} {s}
                      </button>
                    ))}
                  </div>
                  <input
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    placeholder={t.itemNotesPh}
                    className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                  />
                  {modifiers.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-stone-500">{t.modifiers}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {modifiers.map((m) => {
                          const on = selectedMods.includes(m.id);
                          const label =
                            locale === "en" && m.nameEn ? m.nameEn : m.name;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setSelectedMods((prev) =>
                                  on
                                    ? prev.filter((x) => x !== m.id)
                                    : [...prev, m.id],
                                )
                              }
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold border ${
                                on
                                  ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                                  : "border-white/10 text-stone-400 hover:bg-white/5"
                              }`}
                            >
                              {label}
                              {m.priceDelta
                                ? ` +${m.priceDelta.toFixed(3)}`
                                : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {stations.length > 0 ? (
                    <select
                      value={stationId}
                      onChange={(e) => setStationId(e.target.value)}
                      className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm"
                    >
                      <option value="">{t.stationAuto}</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {locale === "en" && s.nameEn ? s.nameEn : s.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={menuQ}
                    onChange={(e) => setMenuQ(e.target.value)}
                    placeholder={t.menuSearch}
                    className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <ul className="max-h-56 overflow-y-auto space-y-1">
                    {menuError ? (
                      <li className="text-xs text-rose-300 py-2 px-1">
                        {t.loadFailed}
                        <button
                          type="button"
                          className="ms-2 underline text-amber-300"
                          onClick={() => {
                            setMenuError(false);
                            void api
                              .getRestoMenu(menuQ.trim() || undefined, "now")
                              .then((res) => setMenu(res.data.items || []))
                              .catch(() => setMenuError(true));
                          }}
                        >
                          {t.retry}
                        </button>
                      </li>
                    ) : null}
                    {menu.slice(0, 40).map((m) => {
                      const label =
                        locale === "en" && m.nameEn ? m.nameEn : m.name;
                      const price =
                        typeof m.price === "number"
                          ? m.price
                          : Number(m.price);
                      const img = m.image || m.images?.[0] || null;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void addProduct(m.id, m.defaultStationId)
                            }
                            className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-white/5 disabled:opacity-50"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={img}
                                  alt=""
                                  className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10"
                                />
                              ) : (
                                <span className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />
                              )}
                              <span className="truncate">{label}</span>
                            </span>
                            <span className="text-xs text-stone-500 tabular-nums shrink-0">
                              {Number.isNaN(price) ? "—" : price.toFixed(3)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <button
                  type="button"
                  className="hidden"
                  onClick={() => order && void refreshOrder(order.id)}
                />
              </>
            )}
          </aside>
        </div>
      )}

      <DualApprovalModal
        open={!!voidTarget}
        action="RESTO_VOID"
        actionLabel={
          voidTarget?.comp ? t.compItem : t.voidItem || t.voidReasonPh
        }
        payload={
          voidTarget
            ? {
                orderId: order?.id,
                itemId: voidTarget.itemId,
                comp: voidTarget.comp,
              }
            : undefined
        }
        summary={
          voidTarget
            ? `${voidTarget.comp ? t.compItem : t.voidItem}: ${voidTarget.reason}`
            : undefined
        }
        actorRole={user?.role}
        busy={voidBusy}
        onCancel={() => !voidBusy && setVoidTarget(null)}
        onConfirm={confirmVoidOrComp}
      />
    </div>
  );
}
