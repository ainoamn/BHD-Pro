"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useLocaleStore } from "@/store/locale";

export type DualApprovalPayload = {
  method: "SELF_CONFIRM" | "PASSWORD" | "PIN";
  email?: string;
  password?: string;
  pin?: string;
};

type ActorRole = string | undefined;

type Props = {
  open: boolean;
  actionLabel: string;
  actorRole?: ActorRole;
  busy?: boolean;
  onConfirm: (approval: DualApprovalPayload) => void | Promise<void>;
  onCancel: () => void;
};

const copy = {
  ar: {
    title: "موافقة مزدوجة",
    hint: "هذا الإجراء حساس ويتطلب تأكيداً إضافياً",
    selfConfirm: "أؤكد أنني أتحمل مسؤولية هذا الإجراء",
    continue: "متابعة",
    cancel: "إلغاء",
    tabPassword: "كلمة مرور المشرف",
    tabPin: "رمز PIN",
    email: "بريد المشرف",
    password: "كلمة المرور",
    pin: "رمز المشرف (4–8 أرقام)",
    submit: "تأكيد الموافقة",
  },
  en: {
    title: "Dual control",
    hint: "This sensitive action needs an extra approval",
    selfConfirm: "I confirm I am responsible for this action",
    continue: "Continue",
    cancel: "Cancel",
    tabPassword: "Supervisor password",
    tabPin: "PIN",
    email: "Supervisor email",
    password: "Password",
    pin: "Supervisor PIN (4–8 digits)",
    submit: "Confirm approval",
  },
};

function isApprover(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export function DualApprovalModal({
  open,
  actionLabel,
  actorRole,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const t = copy[locale === "en" ? "en" : "ar"];
  const approver = isApprover(actorRole);

  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"PASSWORD" | "PIN">("PASSWORD");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  if (!open) return null;

  const submitSelf = async () => {
    if (!checked || busy) return;
    await onConfirm({ method: "SELF_CONFIRM" });
  };

  const submitOther = async () => {
    if (busy) return;
    if (mode === "PASSWORD") {
      await onConfirm({
        method: "PASSWORD",
        email: email.trim(),
        password,
      });
      return;
    }
    await onConfirm({ method: "PIN", pin: pin.trim() });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-white">{t.title}</h2>
              <p className="text-sm text-slate-400 mt-1">{actionLabel}</p>
              <p className="text-xs text-slate-500 mt-1">{t.hint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {approver ? (
            <>
              <label className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1"
                />
                <span>{t.selfConfirm}</span>
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={!checked || busy}
                  onClick={submitSelf}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.continue}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => setMode("PASSWORD")}
                  className={`flex-1 px-3 py-2 text-xs font-semibold ${
                    mode === "PASSWORD"
                      ? "bg-sky-500/20 text-sky-200"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {t.tabPassword}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("PIN")}
                  className={`flex-1 px-3 py-2 text-xs font-semibold ${
                    mode === "PIN"
                      ? "bg-sky-500/20 text-sky-200"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {t.tabPin}
                </button>
              </div>

              {mode === "PASSWORD" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t.email}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t.password}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.pin}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white tracking-widest"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    (mode === "PASSWORD"
                      ? !email.trim() || !password
                      : pin.length < 4)
                  }
                  onClick={submitOther}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.submit}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
