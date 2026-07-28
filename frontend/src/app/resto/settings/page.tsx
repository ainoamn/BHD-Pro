"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { RestoLinkSettings } from "@/components/resto/resto-link-settings";
import { HisabyAppsLinkHub } from "@/components/shared/hisaby-apps-link-hub";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/utils";

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
};

type SectionRow = {
  zoneId: string;
  zoneName: string;
  zoneNameEn: string | null;
  userId: string | null;
  user: { id: string; name: string; email: string; role: string } | null;
};

type StaffRow = { id: string; name: string; email: string; role: string };

export default function RestoSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";
  const canAssign = canManage || user?.role === "WAITER";
  const [stations, setStations] = useState<Station[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [sectionBusy, setSectionBusy] = useState(false);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [pickByZone, setPickByZone] = useState<Record<string, string>>({});
  const [dayParts, setDayParts] = useState<
    Record<string, { start: number; end: number }>
  >({
    breakfast: { start: 5, end: 11 },
    lunch: { start: 11, end: 16 },
    dinner: { start: 16, end: 22 },
    late: { start: 22, end: 5 },
  });
  const [dayPartMeta, setDayPartMeta] = useState<{
    timezone: string;
    currentDayPart: string;
    currentHour: number;
  } | null>(null);
  const [dayPartBusy, setDayPartBusy] = useState(false);
  const [kitchenSla, setKitchenSla] = useState({
    warnMinutes: 8,
    criticalMinutes: 15,
    expoWarnMinutes: 5,
  });
  const [slaBusy, setSlaBusy] = useState(false);
  const [booking, setBooking] = useState({
    enabled: false,
    publicSlug: "",
    publicUrl: "" as string | null,
    maxParty: 12,
    minParty: 1,
    slotMinutes: 30,
    horizonDays: 14,
    openHour: 11,
    closeHour: 23,
    turnMinutes: 90,
    autoConfirm: false,
    autoNotify: true,
    remindMinutes: 120,
  });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [qrTables, setQrTables] = useState<
    Array<{
      id: string;
      code: string;
      name: string | null;
      zoneName: string;
      guestToken: string;
      path: string;
    }>
  >([]);

  const DAY_PART_KEYS = ["breakfast", "lunch", "dinner", "late"] as const;

  const dayPartLabel = (code: string) => {
    if (code === "breakfast") return t.dayPartBreakfast;
    if (code === "lunch") return t.dayPartLunch;
    if (code === "dinner") return t.dayPartDinner;
    if (code === "late") return t.dayPartLate;
    return code;
  };

  const loadStations = async () => {
    const res = await api.getRestoStations();
    setStations(res.data.stations || []);
  };

  const loadSections = async () => {
    const [sec, st] = await Promise.all([
      api.getRestoSectionAssignments(),
      api.getRestoStaff(),
    ]);
    setSections(sec.data.assignments || []);
    setStaff(st.data.staff || []);
    const picks: Record<string, string> = {};
    for (const a of sec.data.assignments || []) {
      picks[a.zoneId] = a.userId || "";
    }
    setPickByZone(picks);
  };

  const loadDayParts = async () => {
    const res = await api.getRestoConfig();
    setDayParts(res.data.dayParts || dayParts);
    if (res.data.kitchenSla) setKitchenSla(res.data.kitchenSla);
    if (res.data.booking) {
      setBooking({
        enabled: !!res.data.booking.enabled,
        publicSlug: res.data.booking.publicSlug || "",
        publicUrl: res.data.booking.publicUrl,
        maxParty: res.data.booking.maxParty,
        minParty: res.data.booking.minParty,
        slotMinutes: res.data.booking.slotMinutes,
        horizonDays: res.data.booking.horizonDays,
        openHour: res.data.booking.openHour,
        closeHour: res.data.booking.closeHour,
        turnMinutes: res.data.booking.turnMinutes,
        autoConfirm: !!res.data.booking.autoConfirm,
        autoNotify: res.data.booking.autoNotify !== false,
        remindMinutes:
          typeof res.data.booking.remindMinutes === "number"
            ? res.data.booking.remindMinutes
            : 120,
      });
    }
    setDayPartMeta({
      timezone: res.data.timezone,
      currentDayPart: res.data.currentDayPart,
      currentHour: res.data.currentHour,
    });
  };

  const boot = async () => {
    setBootLoading(true);
    setLoadError(false);
    try {
      await Promise.all([loadStations(), loadSections(), loadDayParts()]);
    } catch (err) {
      setLoadError(true);
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDayParts = async () => {
    setDayPartBusy(true);
    try {
      const res = await api.updateRestoConfig({
        dayParts: {
          breakfast: dayParts.breakfast,
          lunch: dayParts.lunch,
          dinner: dayParts.dinner,
          late: dayParts.late,
        },
      });
      setDayParts(res.data.dayParts);
      if (res.data.kitchenSla) setKitchenSla(res.data.kitchenSla);
      setDayPartMeta({
        timezone: res.data.timezone,
        currentDayPart: res.data.currentDayPart,
        currentHour: res.data.currentHour,
      });
      toast.success(t.dayPartSaved);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setDayPartBusy(false);
    }
  };

  const saveKitchenSla = async () => {
    setSlaBusy(true);
    try {
      const res = await api.updateRestoConfig({ kitchenSla });
      if (res.data.kitchenSla) setKitchenSla(res.data.kitchenSla);
      toast.success(t.slaSaved);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setSlaBusy(false);
    }
  };

  const saveBooking = async () => {
    setBookingBusy(true);
    try {
      const res = await api.updateRestoConfig({
        booking: {
          enabled: booking.enabled,
          publicSlug: booking.publicSlug.trim() || null,
          maxParty: booking.maxParty,
          minParty: booking.minParty,
          slotMinutes: booking.slotMinutes,
          horizonDays: booking.horizonDays,
          openHour: booking.openHour,
          closeHour: booking.closeHour,
          turnMinutes: booking.turnMinutes,
          autoConfirm: booking.autoConfirm,
          autoNotify: booking.autoNotify,
          remindMinutes: booking.remindMinutes,
        },
      });
      if (res.data.booking) {
        setBooking({
          enabled: !!res.data.booking.enabled,
          publicSlug: res.data.booking.publicSlug || "",
          publicUrl: res.data.booking.publicUrl,
          maxParty: res.data.booking.maxParty,
          minParty: res.data.booking.minParty,
          slotMinutes: res.data.booking.slotMinutes,
          horizonDays: res.data.booking.horizonDays,
          openHour: res.data.booking.openHour,
          closeHour: res.data.booking.closeHour,
          turnMinutes: res.data.booking.turnMinutes,
          autoConfirm: !!res.data.booking.autoConfirm,
          autoNotify: res.data.booking.autoNotify !== false,
          remindMinutes:
            typeof res.data.booking.remindMinutes === "number"
              ? res.data.booking.remindMinutes
              : 120,
        });
      }
      toast.success(t.bookingSaved);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setBookingBusy(false);
    }
  };

  const copyBookingLink = async () => {
    const url =
      booking.publicUrl ||
      (booking.publicSlug
        ? `${window.location.origin}/reserve/${booking.publicSlug}`
        : "");
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.bookingLinkCopied);
    } catch {
      toast.error(t.actionFail);
    }
  };

  const runDemoSeed = async () => {
    setDemoBusy(true);
    try {
      await api.seedRestoDemoCatalog();
      toast.success(t.demoSeedOk);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setDemoBusy(false);
    }
  };

  const purgeDemo = async () => {
    if (!window.confirm(t.demoPurgeConfirm)) return;
    setDemoBusy(true);
    try {
      await api.purgeRestoDemoCatalog();
      toast.success(t.demoPurgeOk);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setDemoBusy(false);
    }
  };

  const assignZone = async (zoneId: string) => {
    const userId = pickByZone[zoneId];
    if (!userId) return;
    setSectionBusy(true);
    try {
      const res = await api.assignRestoSection({ zoneId, userId });
      setSections(res.data.assignments || []);
      toast.success(t.sectionAssign);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setSectionBusy(false);
    }
  };

  const releaseZone = async (zoneId: string) => {
    setSectionBusy(true);
    try {
      const res = await api.releaseRestoSection(zoneId);
      setSections(res.data.assignments || []);
      setPickByZone((prev) => ({ ...prev, [zoneId]: "" }));
      toast.success(t.sectionRelease);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setSectionBusy(false);
    }
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createRestoStation({
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        sortOrder: stations.length,
      });
      setName("");
      setNameEn("");
      toast.success(t.stationAdded);
      await loadStations();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.actionFail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-stone-400 mt-1">{t.linkDesc}</p>
      </div>
      <HisabyAppsLinkHub tone="resto" />
      <RestoLinkSettings variant="resto" />

      {bootLoading ? (
        <p className="text-sm text-stone-400 py-8 text-center">…</p>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void boot()}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
      {canManage ? (
        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.dayPartSchedule}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.dayPartScheduleSub}</p>
            {dayPartMeta ? (
              <p className="text-[11px] text-indigo-200/80 mt-1 tabular-nums">
                {t.dayPartTimezone}: {dayPartMeta.timezone} · {t.dayPartCurrent}:{" "}
                {dayPartLabel(dayPartMeta.currentDayPart)} (
                {dayPartMeta.currentHour}:00)
              </p>
            ) : null}
          </div>
          <ul className="space-y-2">
            {DAY_PART_KEYS.map((key) => (
              <li
                key={key}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <span className="w-24 text-sm font-semibold shrink-0">
                  {dayPartLabel(key)}
                </span>
                <label className="flex items-center gap-1 text-[11px] text-stone-400">
                  {t.dayPartStart}
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={dayParts[key]?.start ?? 0}
                    disabled={dayPartBusy}
                    onChange={(e) =>
                      setDayParts((prev) => ({
                        ...prev,
                        [key]: {
                          start: Number(e.target.value),
                          end: prev[key]?.end ?? 0,
                        },
                      }))
                    }
                    className="w-14 h-8 rounded-lg bg-black/30 border border-white/10 px-1.5 text-sm tabular-nums text-stone-100"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-stone-400">
                  {t.dayPartEnd}
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={dayParts[key]?.end ?? 0}
                    disabled={dayPartBusy}
                    onChange={(e) =>
                      setDayParts((prev) => ({
                        ...prev,
                        [key]: {
                          start: prev[key]?.start ?? 0,
                          end: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-14 h-8 rounded-lg bg-black/30 border border-white/10 px-1.5 text-sm tabular-nums text-stone-100"
                  />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={dayPartBusy}
            onClick={() => void saveDayParts()}
            className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {dayPartBusy ? "…" : t.dayPartSave}
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.slaTitle}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-stone-400">{t.slaWarn}</span>
              <input
                type="number"
                min={1}
                max={120}
                value={kitchenSla.warnMinutes}
                disabled={slaBusy}
                onChange={(e) =>
                  setKitchenSla((p) => ({
                    ...p,
                    warnMinutes: Number(e.target.value) || 1,
                  }))
                }
                className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-stone-400">{t.slaCritical}</span>
              <input
                type="number"
                min={2}
                max={180}
                value={kitchenSla.criticalMinutes}
                disabled={slaBusy}
                onChange={(e) =>
                  setKitchenSla((p) => ({
                    ...p,
                    criticalMinutes: Number(e.target.value) || 2,
                  }))
                }
                className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-stone-400">{t.slaExpo}</span>
              <input
                type="number"
                min={1}
                max={60}
                value={kitchenSla.expoWarnMinutes}
                disabled={slaBusy}
                onChange={(e) =>
                  setKitchenSla((p) => ({
                    ...p,
                    expoWarnMinutes: Number(e.target.value) || 1,
                  }))
                }
                className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={slaBusy}
            onClick={() => void saveKitchenSla()}
            className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {slaBusy ? "…" : t.dayPartSave}
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.bookingOnline}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.bookingOnlineSub}</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={booking.enabled}
              disabled={bookingBusy}
              onChange={(e) =>
                setBooking((b) => ({ ...b, enabled: e.target.checked }))
              }
            />
            {t.bookingEnabled}
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-stone-400">{t.bookingSlug}</span>
            <input
              value={booking.publicSlug}
              disabled={bookingBusy}
              onChange={(e) =>
                setBooking((b) => ({
                  ...b,
                  publicSlug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                }))
              }
              placeholder="my-restaurant"
              className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(
              [
                ["minParty", t.bookingMinParty],
                ["maxParty", t.bookingMaxParty],
                ["slotMinutes", t.bookingSlot],
                ["horizonDays", t.bookingHorizon],
                ["openHour", t.bookingOpen],
                ["closeHour", t.bookingClose],
                ["turnMinutes", t.bookingTurn],
                ["remindMinutes", t.bookingRemind],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block space-y-1">
                <span className="text-[11px] text-stone-400">{label}</span>
                <input
                  type="number"
                  value={booking[key]}
                  disabled={bookingBusy}
                  onChange={(e) =>
                    setBooking((b) => ({
                      ...b,
                      [key]: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm tabular-nums"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={booking.autoConfirm}
                disabled={bookingBusy}
                onChange={(e) =>
                  setBooking((b) => ({ ...b, autoConfirm: e.target.checked }))
                }
              />
              {t.bookingAutoConfirm}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={booking.autoNotify}
                disabled={bookingBusy}
                onChange={(e) =>
                  setBooking((b) => ({ ...b, autoNotify: e.target.checked }))
                }
              />
              {t.bookingAutoNotify}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bookingBusy}
              onClick={() => void saveBooking()}
              className="flex-1 min-w-[140px] rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
            >
              {bookingBusy ? "…" : t.dayPartSave}
            </button>
            <button
              type="button"
              disabled={!booking.enabled || (!booking.publicUrl && !booking.publicSlug)}
              onClick={() => void copyBookingLink()}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {t.bookingCopyLink}
            </button>
          </div>
          {booking.publicUrl || booking.publicSlug ? (
            <p className="text-[11px] text-amber-100/70 break-all" dir="ltr">
              {booking.publicUrl ||
                `${typeof window !== "undefined" ? window.location.origin : ""}/reserve/${booking.publicSlug}`}
            </p>
          ) : null}
        </div>
      ) : null}

      {canAssign && sections.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.sectionStaff}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.sectionStaffSub}</p>
          </div>
          <ul className="space-y-2">
            {sections.map((row) => {
              const zoneLabel =
                locale === "en" && row.zoneNameEn
                  ? row.zoneNameEn
                  : row.zoneName;
              return (
                <li
                  key={row.zoneId}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{zoneLabel}</p>
                    <p className="text-[11px] text-stone-400">
                      {row.user?.name || t.sectionUnassigned}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={pickByZone[row.zoneId] || ""}
                      disabled={sectionBusy}
                      onChange={(e) =>
                        setPickByZone((prev) => ({
                          ...prev,
                          [row.zoneId]: e.target.value,
                        }))
                      }
                      className="flex-1 min-w-[140px] h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                    >
                      <option value="">{t.sectionUnassigned}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={sectionBusy || !pickByZone[row.zoneId]}
                      onClick={() => void assignZone(row.zoneId)}
                      className="h-9 px-3 rounded-lg bg-emerald-500/90 text-[#0b1220] text-xs font-bold disabled:opacity-40"
                    >
                      {t.sectionAssign}
                    </button>
                    {row.userId ? (
                      <button
                        type="button"
                        disabled={sectionBusy}
                        onClick={() => void releaseZone(row.zoneId)}
                        className="h-9 px-3 rounded-lg border border-white/15 text-xs font-semibold disabled:opacity-40"
                      >
                        {t.sectionRelease}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.guestQrTitle}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.guestQrHint}</p>
          </div>
          <button
            type="button"
            disabled={qrBusy}
            onClick={() => {
              void (async () => {
                setQrBusy(true);
                try {
                  const res = await api.ensureRestoGuestTokens();
                  setQrTables(res.data.tables || []);
                  toast.success(t.guestQrEnsure);
                } catch (err) {
                  toast.error(apiErrorMessage(err, t.actionFail));
                } finally {
                  setQrBusy(false);
                }
              })();
            }}
            className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {qrBusy ? "…" : t.guestQrEnsure}
          </button>
            {qrTables.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto space-y-1.5 text-sm">
              {qrTables.map((tb) => (
                <li
                  key={tb.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5"
                >
                  <span className="font-semibold truncate">
                    {tb.code}
                    {tb.name ? ` · ${tb.name}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-violet-200 shrink-0"
                    onClick={() => {
                      const url = `${window.location.origin}${tb.path}`;
                      void navigator.clipboard.writeText(url);
                      toast.success(t.guestQrCopied);
                    }}
                  >
                    {t.guestQrCopy}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href="/resto/qr-print"
            className="block text-center rounded-xl border border-violet-400/40 py-2.5 text-sm font-bold text-violet-100 hover:bg-violet-500/10"
          >
            {t.qrPrintOpen}
          </Link>
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.demoSeedTitle}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.demoSeedHint}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoSeed()}
              className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-[#0b1220] disabled:opacity-50"
            >
              {demoBusy ? "…" : t.demoSeedRun}
            </button>
            {user?.role === "ADMIN" ? (
              <button
                type="button"
                disabled={demoBusy}
                onClick={() => void purgeDemo()}
                className="rounded-xl border border-rose-500/40 text-rose-200 px-4 py-2.5 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
              >
                {t.demoPurge}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
        <div>
          <h2 className="font-bold">{t.stations}</h2>
          <p className="text-xs text-stone-400 mt-1">{t.stationsHint}</p>
        </div>
        <ul className="space-y-1.5">
          {stations.map((s) => (
            <li
              key={s.id}
              className="rounded-xl bg-black/20 px-3 py-2 text-sm flex justify-between gap-2"
            >
              <span className="font-semibold">
                {locale === "en" && s.nameEn ? s.nameEn : s.name}
              </span>
              <span className="text-xs text-stone-500">#{s.sortOrder}</span>
            </li>
          ))}
          {stations.length === 0 ? (
            <li className="text-xs text-stone-500">{t.kitchenEmpty}</li>
          ) : null}
        </ul>
        {canManage ? (
          <form onSubmit={onAdd} className="grid sm:grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.stationName}
              className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
              required
            />
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="EN"
              className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
            >
              {t.addStation}
            </button>
          </form>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}
