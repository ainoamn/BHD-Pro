"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type Entry = {
  id: string;
  guestName: string;
  phone: string | null;
  guests: number;
  quotedMinutes: number | null;
  status: string;
  notes: string | null;
  waitedMinutes: number;
  createdAt: string;
  notifyChannel?: string | null;
  notifyResult?: string | null;
};

type FloorTable = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  openOrder: { id: string } | null;
};

type NotifyPayload = {
  ok: boolean;
  channel: string | null;
  error?: string;
  mock?: boolean;
  mode?: string;
} | null | undefined;

export default function RestoWaitlistPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [freeTables, setFreeTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [quoted, setQuoted] = useState(15);
  const [seatFor, setSeatFor] = useState<string | null>(null);
  const [tableId, setTableId] = useState("");

  const toastNotify = (notify: NotifyPayload) => {
    if (!notify) return;
    if (notify.ok) {
      if (notify.mock || notify.mode === "mock") {
        toast(
          `${t.notifySentMock}${notify.channel ? ` · ${notify.channel}` : ""}`,
          { icon: "🧪" },
        );
      } else {
        toast.success(
          `${t.notifySent}${notify.channel ? ` · ${notify.channel}` : ""}`,
        );
      }
      return;
    }
    if (notify.error === "no_phone") {
      toast.error(t.notifyNoPhone);
      return;
    }
    toast.error(t.notifyFail);
  };

  const load = useCallback(async () => {
    try {
      const [wl, floor] = await Promise.all([
        api.getRestoWaitlist(),
        api.getRestoFloor(),
      ]);
      setEntries(wl.data.entries || []);
      const tables = (floor.data.zones || []).flatMap(
        (z: { tables: FloorTable[] }) => z.tables || [],
      );
      setFreeTables(
        tables.filter(
          (tb) =>
            !tb.openOrder &&
            tb.status !== "OCCUPIED" &&
            tb.status !== "BILLING",
        ),
      );
      setLoadError(false);
    } catch {
      setEntries([]);
      setLoadError(true);
      toast.error(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const add = async () => {
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      await api.createRestoWaitlist({
        guestName: guestName.trim(),
        phone: phone.trim() || undefined,
        guests,
        quotedMinutes: quoted,
      });
      setGuestName("");
      setPhone("");
      await load();
      toast.success(t.waitlistAdd);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const notifyGuest = async (id: string) => {
    setBusy(true);
    try {
      const res = await api.notifyRestoWaitlist(id);
      toastNotify(res.data.notify);
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    id: string,
    status: "CANCELLED" | "SEATED",
    seatTableId?: string,
  ) => {
    setBusy(true);
    try {
      const res = await api.updateRestoWaitlistStatus(id, {
        status,
        tableId: seatTableId,
      });
      if (status === "SEATED") {
        const orderId = res.data?.order?.id;
        if (orderId) {
          router.push(`/resto/orders/${orderId}`);
          return;
        }
      }
      if (status === "CANCELLED") {
        toast.success(t.waitlistCancelledOk);
        toastNotify(res.data?.notify);
      }
      setSeatFor(null);
      setTableId("");
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Users className="w-6 h-6 text-amber-400" />
          {t.waitlistTitle}
        </h1>
        <p className="text-sm text-stone-400 mt-1">{t.waitlistSub}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder={t.guestName}
            className="h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phone}
            className="h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-stone-400">
            {t.guests}
            <input
              type="number"
              min={1}
              max={50}
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 h-9 rounded-lg bg-[#1a1614] border border-white/10 px-2"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-400">
            {t.quotedMin}
            <input
              type="number"
              min={0}
              max={240}
              value={quoted}
              onChange={(e) => setQuoted(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 h-9 rounded-lg bg-[#1a1614] border border-white/10 px-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !guestName.trim()}
          onClick={() => void add()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
        >
          {t.waitlistAdd}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-12">{t.waitlistEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{e.guestName}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {e.guests} {t.guests}
                    {e.phone ? ` · ${e.phone}` : ""} · {e.waitedMinutes}{" "}
                    {t.waitedMin}
                    {e.quotedMinutes != null
                      ? ` · ~${e.quotedMinutes}`
                      : ""}
                    {e.status === "NOTIFIED"
                      ? ` · ${t.waitlistNotify}${(() => {
                          const parts = [
                            e.notifyChannel || null,
                            e.notifyResult === "mock"
                              ? t.notifyResultMock
                              : e.notifyResult?.startsWith("fail")
                                ? t.notifyResultFail
                                : e.notifyResult === "ok"
                                  ? t.notifyResultOk
                                  : null,
                          ].filter(Boolean);
                          return parts.length ? ` (${parts.join(" · ")})` : "";
                        })()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void notifyGuest(e.id)}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold hover:bg-white/5"
                  >
                    {t.waitlistNotify}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSeatFor(e.id);
                      setTableId(freeTables[0]?.id || "");
                    }}
                    className="rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-bold text-white"
                  >
                    {t.waitlistSeat}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(e.id, "CANCELLED")}
                    className="rounded-lg border border-rose-500/35 text-rose-200 px-2.5 py-1.5 text-[11px] font-bold"
                  >
                    {t.waitlistCancel}
                  </button>
                </div>
              </div>
              {seatFor === e.id ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={tableId}
                    onChange={(ev) => setTableId(ev.target.value)}
                    className="h-9 rounded-lg bg-[#1a1614] border border-white/10 px-2 text-xs"
                  >
                    <option value="">{t.pickTableSeat}</option>
                    {freeTables.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.code}
                        {tb.name ? ` · ${tb.name}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !tableId}
                    onClick={() => void setStatus(e.id, "SEATED", tableId)}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-[11px] font-bold text-[#14110f] disabled:opacity-40"
                  >
                    {t.waitlistSeat}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
