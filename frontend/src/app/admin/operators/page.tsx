"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Power, Shield, Trash2, UserPlus, Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";
import { PLATFORM_OPERATOR_GROUPS } from "@/lib/plan-access-catalog";

type Operator = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  isActive: boolean;
  isBootstrap?: boolean;
  isProtected?: boolean;
};

function normalizePerms(list: string[]): string[] {
  const cleaned = Array.from(
    new Set(list.map((p) => p.trim().toLowerCase()).filter(Boolean)),
  );
  if (!cleaned.length || cleaned.includes("full")) return ["full"];
  return cleaned;
}

export default function AdminOperatorsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>(["full"]);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const modules = PLATFORM_OPERATOR_GROUPS[0].modules;

  const load = async () => {
    const res = await api.getAdminOperators();
    const list = res.data as Operator[];
    setRows(list);
    const next: Record<string, string[]> = {};
    for (const op of list) {
      next[op.id] = normalizePerms(
        op.isProtected ? ["full"] : op.permissions || ["full"],
      );
    }
    setDrafts(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) toast.error(en ? "Failed to load" : "تعذر التحميل");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [en]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of modules) map[m.code] = en ? m.labelEn : m.labelAr;
    return map;
  }, [en, modules]);

  const toggleList = (list: string[], code: string): string[] => {
    if (code === "full") return ["full"];
    let next = list.filter((x) => x !== "full");
    if (next.includes(code)) next = next.filter((x) => x !== code);
    else next = [...next, code];
    return next.length ? next : ["overview"];
  };

  const isChecked = (list: string[], code: string) => {
    if (list.includes("full")) return true;
    return list.includes(code);
  };

  const appoint = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.appointAdminOperator({
        email: email.trim(),
        name: name.trim() || undefined,
        permissions: normalizePerms(perms),
      });
      setEmail("");
      setName("");
      setPerms(["full"]);
      await load();
      toast.success(en ? "Appointed" : "تم التعيين");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Failed" : "تعذر");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const save = async (op: Operator) => {
    if (op.isProtected) return;
    setSavingId(op.id);
    try {
      await api.updateAdminOperator(op.id, {
        permissions: normalizePerms(drafts[op.id] || ["full"]),
      });
      await load();
      toast.success(en ? "Saved" : "تم الحفظ");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Failed" : "تعذر");
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  };

  const Checklist = ({
    list,
    onToggle,
    locked,
  }: {
    list: string[];
    onToggle: (code: string) => void;
    locked?: boolean;
  }) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b text-xs font-extrabold text-teal-950">
        {en ? "Platform console" : "لوحة تحكم المنصة"}
      </div>
      <ul className="divide-y divide-slate-100">
        {modules.map((m) => (
          <li key={m.code}>
            <label
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                locked && "opacity-80 cursor-not-allowed",
              )}
            >
              <input
                type="checkbox"
                checked={isChecked(list, m.code)}
                disabled={locked}
                onChange={() => onToggle(m.code)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span className="font-semibold text-slate-800">{labels[m.code]}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-950 flex items-center gap-2">
          <Shield className="w-7 h-7 text-teal-700" />
          {t.operators}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Check what each operator may access, then save. Owner stays full."
            : "ضع علامة صح على ما يُسمح لكل مشرف بتنفيذه ثم احفظ. المالك يبقى كامل الصلاحيات."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          {en ? "Appoint operator" : "تعيين مشرف"}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={en ? "Name (optional)" : "الاسم (اختياري)"}
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
        </div>
        <Checklist
          list={perms}
          onToggle={(code) => setPerms((p) => toggleList(p, code))}
        />
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={() => void appoint()}
          className="rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
          {en ? "Appoint" : "تعيين"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((op) => {
            const draft = drafts[op.id] || ["full"];
            return (
              <div
                key={op.id}
                className={cn(
                  "rounded-2xl border bg-white p-4 space-y-3",
                  op.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/40",
                )}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold">{op.name || op.email}</p>
                    <p className="text-xs font-mono text-slate-500" dir="ltr">
                      {op.email}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      {op.isProtected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          {en ? "Owner" : "مالك"}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          op.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900",
                        )}
                      >
                        {op.isActive ? t.active : t.inactive}
                      </span>
                    </div>
                  </div>
                  {!op.isProtected ? (
                    <div className="flex gap-2 text-sm font-bold">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateAdminOperator(op.id, {
                            isActive: !op.isActive,
                          });
                          await load();
                        }}
                        className="inline-flex items-center gap-1 text-slate-700 hover:underline"
                      >
                        <Power className="w-4 h-4" />
                        {op.isActive
                          ? en
                            ? "Deactivate"
                            : "إيقاف"
                          : en
                            ? "Activate"
                            : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(en ? "Remove?" : "إزالة؟")) return;
                          await api.removeAdminOperator(op.id);
                          await load();
                        }}
                        className="inline-flex items-center gap-1 text-rose-700 hover:underline"
                      >
                        <Trash2 className="w-4 h-4" />
                        {en ? "Remove" : "حذف الإشراف"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <Checklist
                  list={draft}
                  locked={!!op.isProtected}
                  onToggle={(code) =>
                    setDrafts((d) => ({
                      ...d,
                      [op.id]: toggleList(d[op.id] || ["full"], code),
                    }))
                  }
                />

                {!op.isProtected ? (
                  <button
                    type="button"
                    disabled={savingId === op.id}
                    onClick={() => void save(op)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {savingId === op.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {en ? "Save permissions" : "حفظ الصلاحيات"}
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {en
                      ? "Owner permissions are locked to full access."
                      : "صلاحيات المالك مقفلة على الوصول الكامل."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
