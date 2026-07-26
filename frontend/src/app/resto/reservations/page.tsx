"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { restoCopy } from "@/lib/resto-copy";

type Reservation = {
  id: string;
  guestName: string;
  phone: string | null;
  guests: number;
  reservedAt: string;
  status: string;
  notes: string | null;
  confirmedAt?: string | null;
  reminderSentAt?: string | null;
  table: { id: string; code: string; name: string | null } | null;
};

type FloorTable = {
  id: string;
  code: string;
  name: string | null;
};

export default function RestoReservationsPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canEdit =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER" ||
    user?.role === "WAITER";

  const [rows, setRows] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    guestName: "",
    phone: "",
    guests: "2",
    reservedAt: "",
    tableId: "",
    notes: "",
  });

  const toastNotify = (notify?: {
    ok: boolean;
    channel: string | null;
    error?: string;
  }) => {
    if (!notify) return;
    if (notify.ok) {
      toast.success(
        `${t.notifySent}${notify.channel ? ` · ${notify.channel}` : ""}`,
      );
      return;
    }
    if (notify.error === "no_phone") {
      toast.error(t.notifyNoPhone);
      return;
    }
    toast.error(t.notifyFail);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, floor] = await Promise.all([
        api.getRestoReservations(3),
        api.getRestoFloor(),
      ]);
      setRows(res.data.reservations || []);
      const fromZones = (floor.data.zones || []).flatMap(
        (z: { tables?: FloorTable[] }) => z.tables || [],
      );
      const flat =
        fromZones.length > 0
          ? fromZones
          : (floor.data.tables || []).map((tb: FloorTable) => ({
              id: tb.id,
              code: tb.code,
              name: tb.name,
            }));
      setTables(flat);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.guestName.trim() || !form.reservedAt) return;
    setBusy(true);
    try {
      await api.createRestoReservation({
        guestName: form.guestName.trim(),
        phone: form.phone.trim() || undefined,
        guests: Number(form.guests) || 2,
        reservedAt: new Date(form.reservedAt).toISOString(),
        tableId: form.tableId || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({
        guestName: "",
        phone: "",
        guests: "2",
        reservedAt: "",
        tableId: "",
        notes: "",
      });
      toast.success(t.reservationOk);
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    id: string,
    status: "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW",
  ) => {
    setBusy(true);
    try {
      const res = await api.updateRestoReservationStatus(id, status);
      await load();
      if (status === "SEATED" && res.data.openedOrderId) {
        router.push(`/resto/orders/${res.data.openedOrderId}`);
      }
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const sendNotify = async (
    id: string,
    kind: "CONFIRM" | "REMINDER" | "TABLE_READY",
  ) => {
    setBusy(true);
    try {
      const res = await api.notifyRestoReservation(id, kind);
      toastNotify(res.data.notify);
      await load();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: t.resPending,
      CONFIRMED: t.resConfirmed,
      SEATED: t.resSeated,
      CANCELLED: t.cancelled,
      NO_SHOW: t.resNoShow,
    };
    return map[s] || s;
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-amber-400" />
          {t.reservations}
        </h1>
        <p className="text-sm text-stone-400 mt-1">{t.reservationsSub}</p>
      </div>

      {canEdit ? (
        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 grid sm:grid-cols-2 gap-3"
        >
          <input
            required
            value={form.guestName}
            onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
            placeholder={t.guestName}
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={t.phone}
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />
          <input
            type="number"
            min={1}
            value={form.guests}
            onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))}
            placeholder={t.guests}
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />
          <input
            required
            type="datetime-local"
            value={form.reservedAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, reservedAt: e.target.value }))
            }
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />
          <select
            value={form.tableId}
            onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          >
            <option value="">{t.tableOptional}</option>
            {tables.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.code}
              </option>
            ))}
          </select>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t.notes}
            className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="sm:col-span-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
          >
            {t.addReservation}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-12">{t.reservationsEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{r.guestName}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(r.reservedAt).toLocaleString(
                      locale === "en" ? "en-GB" : "ar",
                    )}
                    {" · "}
                    {r.guests} {t.guests}
                    {r.table ? ` · ${t.table} ${r.table.code}` : ""}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                  {r.notes ? (
                    <p className="text-xs text-amber-200/80 mt-1">{r.notes}</p>
                  ) : null}
                </div>
                <span className="text-xs font-bold text-amber-200">
                  {statusLabel(r.status)}
                </span>
              </div>
              {canEdit &&
              r.status !== "CANCELLED" &&
              r.status !== "NO_SHOW" &&
              r.status !== "SEATED" ? (
                <div className="flex flex-wrap gap-2">
                  {r.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(r.id, "CONFIRMED")}
                      className="rounded-lg bg-sky-600/90 px-2.5 py-1 text-[11px] font-bold"
                    >
                      {t.resConfirm}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !r.phone}
                    onClick={() => void sendNotify(r.id, "CONFIRM")}
                    className="rounded-lg border border-sky-400/40 text-sky-100 px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
                    title={!r.phone ? t.notifyNoPhone : undefined}
                  >
                    {t.resSendConfirm}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !r.phone}
                    onClick={() => void sendNotify(r.id, "REMINDER")}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                  >
                    {t.resSendRemind}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !r.phone}
                    onClick={() => void sendNotify(r.id, "TABLE_READY")}
                    className="rounded-lg border border-amber-400/35 text-amber-100 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                  >
                    {t.resTableReady}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(r.id, "SEATED")}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold"
                  >
                    {t.resSeat}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(r.id, "NO_SHOW")}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {t.resNoShow}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(r.id, "CANCELLED")}
                    className="rounded-lg border border-rose-500/40 text-rose-200 px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {t.cancelled}
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
