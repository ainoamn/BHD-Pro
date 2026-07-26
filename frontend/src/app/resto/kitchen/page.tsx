"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Loader2, RefreshCw, Volume2, VolumeX } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type KitchenItem = {
  id: string;
  name: string;
  nameEn?: string | null;
  qty: number;
  notes: string | null;
  course?: number;
  seat?: number | null;
  source?: string;
  status: string;
  isRush?: boolean;
  heldAt?: string | null;
  sentAt: string | null;
  stationId?: string | null;
  stationName?: string | null;
  allergens?: string[];
  orderId: string;
  orderNumber: string;
  orderNotes?: string | null;
  guestName?: string | null;
  channel?: string;
  table: { id: string; code: string; name: string | null } | null;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  sortOrder: number;
};

type StatusFilter = "" | "SENT" | "PREPARING" | "READY";

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.stop(ctx.currentTime + 0.4);
    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    /* ignore */
  }
}

export default function RestoKitchenPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [soundOn, setSoundOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sla, setSla] = useState({ warnMinutes: 8, criticalMinutes: 15 });
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("resto-kds-station");
      if (saved) setStationId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("resto-kds-station", stationId);
    } catch {
      /* ignore */
    }
  }, [stationId]);

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoKitchen(stationId || undefined);
      const next = res.data.items || [];
      if (res.data.sla) setSla(res.data.sla);
      if (primed.current && soundOn) {
        const fresh = next.filter((it) => !knownIds.current.has(it.id));
        if (fresh.length > 0) playChime();
      }
      knownIds.current = new Set(next.map((it) => it.id));
      primed.current = true;
      setItems(next);
      setStations(res.data.stations || []);
      setError("");
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [stationId, soundOn, t.actionFail]);

  useEffect(() => {
    setLoading(true);
    primed.current = false;
    knownIds.current = new Set();

    let es: EventSource | null = null;
    let pollId: number | undefined;
    let usePoll = false;

    const startPoll = () => {
      if (usePoll) return;
      usePoll = true;
      void load();
      pollId = window.setInterval(() => void load(), 5000);
    };

    try {
      es = new EventSource(api.restoKitchenStreamUrl(stationId || undefined), {
        withCredentials: true,
      });
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as {
            items?: KitchenItem[];
            stations?: Station[];
            sla?: { warnMinutes: number; criticalMinutes: number };
          };
          const next = payload.items || [];
          if (payload.sla) setSla(payload.sla);
          if (primed.current && soundOn) {
            const fresh = next.filter((it) => !knownIds.current.has(it.id));
            if (fresh.length > 0) playChime();
          }
          knownIds.current = new Set(next.map((it) => it.id));
          primed.current = true;
          setItems(next);
          setStations(payload.stations || []);
          setError("");
          setLoading(false);
        } catch {
          /* ignore parse */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        startPoll();
      };
      // Initial fetch while SSE connects
      void load();
    } catch {
      startPoll();
    }

    return () => {
      es?.close();
      if (pollId) window.clearInterval(pollId);
    };
  }, [load, stationId, soundOn]);

  const setStatus = async (
    itemId: string,
    status: "PREPARING" | "READY" | "SERVED",
  ) => {
    setBusyId(itemId);
    try {
      await api.setRestoKitchenItemStatus(itemId, status);
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const toggleRush = async (it: KitchenItem) => {
    setBusyId(it.id);
    try {
      await api.setRestoKitchenRush(it.id, !it.isRush);
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const toggleHold = async (it: KitchenItem) => {
    setBusyId(it.id);
    try {
      await api.setRestoKitchenHold(it.id, !it.heldAt);
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const recall = async (itemId: string, to: "PREPARING" | "READY") => {
    setBusyId(itemId);
    try {
      await api.recallRestoKitchenItem(itemId, to);
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const bumpOldestReady = useCallback(async () => {
    const ready = items
      .filter((i) => i.status === "READY" && !i.heldAt)
      .sort(
        (a, b) =>
          new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime(),
      );
    if (ready[0]) await setStatus(ready[0].id, "SERVED");
  }, [items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "b" || e.key === "B") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        void bumpOldestReady();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bumpOldestReady]);

  const ageMin = (sentAt: string | null) => {
    if (!sentAt) return 0;
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000),
    );
  };

  const cardTone = (
    status: string,
    minutes: number,
    opts?: { rush?: boolean; held?: boolean },
  ) => {
    if (opts?.held) return "border-stone-500/40 bg-stone-500/10 opacity-70";
    if (opts?.rush) return "border-rose-500/60 bg-rose-500/20 ring-1 ring-rose-400/40";
    if (status === "READY") return "border-emerald-400/40 bg-emerald-500/10";
    if (minutes >= sla.criticalMinutes)
      return "border-rose-400/50 bg-rose-500/15";
    if (minutes >= sla.warnMinutes) return "border-amber-400/45 bg-amber-500/15";
    return "border-white/10 bg-white/[0.04]";
  };

  const visible = statusFilter
    ? items.filter((i) => i.status === statusFilter)
    : items;

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "", label: t.kdsFilterAll },
    { id: "SENT", label: t.sent },
    { id: "PREPARING", label: t.preparing },
    { id: "READY", label: t.ready },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-400" />
            {t.kitchenTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.kitchenSub}</p>
          <p className="text-[11px] text-stone-500 mt-1">
            {t.kdsBumpHint} · {t.kdsLive}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-9 rounded-lg border px-3 text-xs font-semibold ${
              soundOn
                ? "border-amber-500/40 text-amber-200 bg-amber-500/10"
                : "border-white/10 text-stone-400 hover:bg-white/5"
            }`}
            title={t.kdsSoundOn}
          >
            {soundOn ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            {t.kdsSoundOn}
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-stone-300 hover:bg-white/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.refresh}
          </button>
        </div>
      </div>

      {stations.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStationId("")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              !stationId
                ? "bg-amber-500 text-[#14110f]"
                : "border border-white/15 text-stone-300 hover:bg-white/5"
            }`}
          >
            {t.allStations}
          </button>
          {stations.map((s) => {
            const label = locale === "en" && s.nameEn ? s.nameEn : s.name;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStationId(s.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                  stationId === s.id
                    ? "bg-amber-500 text-[#14110f]"
                    : "border border-white/15 text-stone-300 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
              statusFilter === f.id
                ? "bg-white/15 text-white"
                : "border border-white/10 text-stone-400 hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error && items.length === 0 ? (
        null
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-20">{t.kitchenEmpty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((it) => {
            const minutes = ageMin(it.sentAt);
            const busy = busyId === it.id;
            return (
              <li
                key={it.id}
                className={`rounded-2xl border p-4 space-y-3 ${cardTone(it.status, minutes, {
                  rush: !!it.isRush,
                  held: !!it.heldAt,
                })}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-400">
                      {t.table} {it.table?.code || "—"} · {it.orderNumber}
                      {it.stationName ? ` · ${it.stationName}` : ""}
                      {" · "}
                      {it.course === 0
                        ? t.courseDrinks
                        : it.course === 2
                          ? t.courseMain
                          : it.course === 3
                            ? t.courseDessert
                            : t.courseStarter}
                      {it.seat != null ? ` · ${t.seat} ${it.seat}` : ""}
                      {it.source === "GUEST" ? ` · ${t.fromGuest}` : ""}
                      {it.isRush ? ` · ${t.kdsRush}` : ""}
                      {it.heldAt ? ` · ${t.kdsHeld}` : ""}
                    </p>
                    <p className="text-lg font-extrabold mt-0.5">
                      {it.qty}×{" "}
                      {locale === "en" && it.nameEn ? it.nameEn : it.name}
                    </p>
                    {locale === "en" && it.nameEn && it.nameEn !== it.name ? (
                      <p className="text-[11px] text-stone-500">{it.name}</p>
                    ) : locale === "ar" && it.nameEn ? (
                      <p className="text-[11px] text-stone-500">{it.nameEn}</p>
                    ) : null}
                    {(it.allergens || []).length > 0 ? (
                      <p className="text-[11px] font-bold text-rose-200 mt-1">
                        {t.kdsAllergens}: {(it.allergens || []).join(", ")}
                      </p>
                    ) : null}
                    {it.notes ? (
                      <p className="text-xs text-amber-200/90 mt-1">{it.notes}</p>
                    ) : null}
                    {it.orderNotes ? (
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {it.orderNotes}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs font-bold tabular-nums text-stone-300 shrink-0">
                    {minutes}m
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const w = window.open("", "_blank", "width=360,height=480");
                      if (!w) return;
                      w.document.write(`<!doctype html><html><head><title>${t.kitchenTicket}</title>
<style>body{font-family:system-ui;padding:16px}h1{font-size:18px;margin:0 0 8px}p{margin:4px 0;font-size:14px}</style>
</head><body>
<h1>${t.kitchenTicket}</h1>
<p><b>${t.table}</b> ${it.table?.code || "—"} · ${it.orderNumber}</p>
<p><b>${it.qty}× ${locale === "en" && it.nameEn ? it.nameEn : it.name}</b></p>
${it.nameEn && it.nameEn !== it.name ? `<p>${locale === "en" ? it.name : it.nameEn}</p>` : ""}
${(it.allergens || []).length ? `<p><b>${t.kdsAllergens}:</b> ${(it.allergens || []).join(", ")}</p>` : ""}
${it.notes ? `<p>${it.notes}</p>` : ""}
${it.orderNotes ? `<p>${it.orderNotes}</p>` : ""}
<p>${minutes}m · ${it.status}${it.source === "GUEST" ? ` · ${t.fromGuest}` : ""}</p>
<script>window.print()</script>
</body></html>`);
                      w.document.close();
                    }}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-stone-300 hover:bg-white/5"
                  >
                    {t.kitchenTicket}
                  </button>
                  {it.status === "SENT" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "PREPARING")}
                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-[#14110f] disabled:opacity-50"
                    >
                      {t.markPreparing}
                    </button>
                  ) : null}
                  {it.status === "SENT" || it.status === "PREPARING" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "READY")}
                      className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-[#0b1a12] disabled:opacity-50"
                    >
                      {t.markReady}
                    </button>
                  ) : null}
                  {it.status === "READY" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "SERVED")}
                      className="rounded-lg bg-sky-500/90 px-3 py-1.5 text-xs font-bold text-[#0b1220] disabled:opacity-50"
                    >
                      {t.markServed}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleRush(it)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${
                      it.isRush
                        ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                        : "border-white/15 text-stone-300 hover:bg-white/5"
                    }`}
                  >
                    {t.kdsRush}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleHold(it)}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-stone-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    {it.heldAt ? t.kdsUnhold : t.kdsHold}
                  </button>
                  {it.status === "READY" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void recall(it.id, "PREPARING")}
                      className="rounded-lg border border-amber-400/35 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 disabled:opacity-50"
                    >
                      {t.kdsRecall}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
