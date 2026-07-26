"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Calculator,
  Link2,
  Link2Off,
  Loader2,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { cn } from "@/lib/utils";

type HubTone = "accounting" | "pos" | "resto";

const copy = {
  ar: {
    title: "أنظمة حسابي الثلاثة",
    hint: "اربط أو افصل الكاشير والمطاعم عن المحاسبة بنقرة واحدة — البيانات المشتركة (منتجات وجهات اتصال) تبقى.",
    accounting: "المحاسبة",
    pos: "الكاشير",
    resto: "المطاعم",
    open: "فتح",
    link: "ربط",
    unlink: "فصل",
    linked: "مربوط",
    unlinked: "منفصل",
    current: "الحالي",
    unlinkPosConfirm: "فصل الكاشير عن المحاسبة؟ يبقى المخزون وجهات الاتصال.",
    unlinkRestoConfirm: "فصل المطاعم عن المحاسبة؟ تبقى الأصناف والطلبات التشغيلية.",
    ok: "تم",
    fail: "تعذر تنفيذ العملية",
    forbidden: "غير مسموح لهذه الصلاحية",
  },
  en: {
    title: "Three Hisaby apps",
    hint: "Link or unlink POS and Restaurants from Accounting in one tap — shared products and contacts stay.",
    accounting: "Accounting",
    pos: "POS",
    resto: "Restaurants",
    open: "Open",
    link: "Link",
    unlink: "Unlink",
    linked: "Linked",
    unlinked: "Separate",
    current: "Current",
    unlinkPosConfirm: "Unlink POS from Accounting? Inventory and contacts remain.",
    unlinkRestoConfirm: "Unlink Restaurants from Accounting? Menu items and floor data remain.",
    ok: "Done",
    fail: "Action failed",
    forbidden: "Not allowed for this role",
  },
} as const;

function errMessage(err: unknown, fallback: string) {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 403) return "forbidden";
  const msg = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg) && msg[0]) return String(msg[0]);
  return fallback;
}

export function HisabyAppsLinkHub({
  tone = "accounting",
  className,
}: {
  tone?: HubTone;
  className?: string;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const t = copy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "";
  const canManage = ["ADMIN", "MANAGER", "RESTO_MANAGER"].includes(role);

  const [posLinked, setPosLinked] = useState<boolean | null>(null);
  const [restoLinked, setRestoLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"pos" | "resto" | null>(null);

  const refresh = useCallback(async () => {
    const [pos, resto] = await Promise.all([
      api.getPosLinkStatus().catch(() => null),
      api.getRestoLinkStatus().catch(() => null),
    ]);
    setPosLinked(pos ? !!pos.data.linked : null);
    setRestoLinked(resto ? !!resto.data.linked : null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toastFail = (err: unknown) => {
    const m = errMessage(err, t.fail);
    toast.error(m === "forbidden" ? t.forbidden : m);
  };

  const linkPos = async () => {
    setBusy("pos");
    try {
      const res = await api.activatePosLink();
      const needs = (res.data as { needsWarehouse?: boolean })?.needsWarehouse;
      toast.success(
        needs
          ? locale === "en"
            ? "Linked — pick a POS warehouse in Settings"
            : "تم الربط — اختر مخزن الكاشير من الإعدادات"
          : t.ok,
      );
      await refresh();
    } catch (err) {
      toastFail(err);
    } finally {
      setBusy(null);
    }
  };

  const unlinkPos = async () => {
    if (!window.confirm(t.unlinkPosConfirm)) return;
    setBusy("pos");
    try {
      await api.deactivatePosLink();
      toast.success(t.ok);
      await refresh();
    } catch (err) {
      toastFail(err);
    } finally {
      setBusy(null);
    }
  };

  const linkResto = async () => {
    setBusy("resto");
    try {
      const res = await api.activateRestoLink();
      const needs = (res.data as { needsWarehouse?: boolean })?.needsWarehouse;
      toast.success(
        needs
          ? locale === "en"
            ? "Linked — pick a restaurant warehouse in Settings"
            : "تم الربط — اختر مخزن المطاعم من الإعدادات"
          : t.ok,
      );
      await refresh();
    } catch (err) {
      toastFail(err);
    } finally {
      setBusy(null);
    }
  };

  const unlinkResto = async () => {
    if (!window.confirm(t.unlinkRestoConfirm)) return;
    setBusy("resto");
    try {
      await api.deactivateRestoLink();
      toast.success(t.ok);
      await refresh();
    } catch (err) {
      toastFail(err);
    } finally {
      setBusy(null);
    }
  };

  const shell =
    tone === "accounting"
      ? "rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3"
      : tone === "pos"
        ? "rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
        : "rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3";

  const apps = [
    {
      key: "accounting" as const,
      href: "/dashboard",
      title: t.accounting,
      icon: Calculator,
      linked: true as boolean | null,
      current: tone === "accounting",
      manage: null as null | { link: () => void; unlink: () => void },
    },
    {
      key: "pos" as const,
      href: "/pos",
      title: t.pos,
      icon: ShoppingCart,
      linked: posLinked,
      current: tone === "pos",
      manage: { link: linkPos, unlink: unlinkPos },
    },
    {
      key: "resto" as const,
      href: "/resto",
      title: t.resto,
      icon: UtensilsCrossed,
      linked: restoLinked,
      current: tone === "resto",
      manage: { link: linkResto, unlink: unlinkResto },
    },
  ];

  return (
    <div className={cn(shell, className)}>
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Link2 className="w-4 h-4 opacity-80" />
          {t.title}
        </h2>
        <p className="text-xs opacity-60 mt-1 leading-relaxed">{t.hint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;
          const isBusy = busy === app.key;
          return (
            <div
              key={app.key}
              className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-90" />
                  <span className="font-semibold text-sm truncate">{app.title}</span>
                </div>
                {app.current ? (
                  <span className="text-[10px] font-bold uppercase opacity-50">
                    {t.current}
                  </span>
                ) : app.linked === null ? (
                  <span className="text-[10px] opacity-40">…</span>
                ) : app.linked ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-300">
                    <Link2 className="w-3 h-3" />
                    {t.linked}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-200">
                    <Link2Off className="w-3 h-3" />
                    {t.unlinked}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Link
                  href={app.href}
                  className="inline-flex rounded-lg bg-white/10 hover:bg-white/15 px-2.5 py-1 text-[11px] font-bold"
                >
                  {t.open}
                </Link>
                {app.manage && app.linked === false ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void app.manage!.link()}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-[#0f1410] disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {t.link}
                  </button>
                ) : null}
                {app.manage && app.linked === true && canManage ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void app.manage!.unlink()}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {t.unlink}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
