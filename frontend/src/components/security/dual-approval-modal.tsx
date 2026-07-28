"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Wifi, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { NfcBadgeReader } from "@/components/security/nfc-badge-reader";

export type DualControlAction =
  | "POS_VOID"
  | "POS_PRICE_OVERRIDE"
  | "POS_LINE_DISCOUNT"
  | "POS_STOCK_OVERRIDE"
  | "POS_NO_SALE"
  | "POS_REFUND"
  | "POS_BLIND_RETURN"
  | "POS_IDLE_UNLOCK"
  | "STOCK_ADJUST"
  | "STOCK_TRANSFER"
  | "INVOICE_CANCEL"
  | "PAYMENT_REVERSE"
  | "SHIFT_CLOSE_VARIANCE"
  | "SHIFT_CASH_OUT"
  | "PAYROLL_PAY"
  | "CLAIM_PAY"
  | "BANK_INTERNAL_TRANSFER"
  | "FX_REVALUATION"
  | "COMMISSION_PAYOUT"
  | "STORE_CREDIT_ADJUST"
  | "PERIOD_UNLOCK"
  | "ASSET_DEPRECIATE"
  | "COMMITMENT_REVERSE"
  | "RESTO_VOID";

export type DualApprovalPayload = {
  method: "SELF_CONFIRM" | "PASSWORD" | "PIN" | "APPROVAL_REQUEST" | "WHATSAPP_OTP" | "NFC";
  email?: string;
  password?: string;
  pin?: string;
  approvalRequestId?: string;
  otp?: string;
  badgeSecret?: string;
  reason?: string;
};

type ActorRole = string | undefined;

type Props = {
  open: boolean;
  actionLabel: string;
  /** Required to create an async online approval request. */
  action?: DualControlAction;
  payload?: Record<string, unknown>;
  summary?: string;
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
    tabOnline: "طلب موافقة أونلاين",
    tabWhatsapp: "واتساب OTP",
    tabNfc: "شارة NFC",
    email: "بريد المشرف",
    password: "كلمة المرور",
    pin: "رمز المشرف (4–8 أرقام)",
    pinClear: "مسح",
    otp: "رمز واتساب (6 أرقام)",
    sendOtp: "إرسال الرمز",
    otpSent: "تم إرسال الرمز عبر واتساب",
    otpSentMock: "وضع mock — الرمز لم يُرسل للواتساب (راجع سجلات الخادم)",
    otpFail: "تعذر إرسال رمز واتساب",
    reason: "سبب الموافقة",
    reasonHint: "مطلوب للتدقيق (3 أحرف على الأقل)",
    reasonRequired: "أدخل سبب الموافقة",
    submit: "تأكيد الموافقة",
    waiting: "بانتظار موافقة المدير…",
    waitingHint: "اطلب من المدير فتح قائمة الموافقات والموافقة خلال 15 دقيقة",
    expiresIn: "ينتهي خلال",
    expiredLocal: "انتهت المهلة — أعد الطلب",
    approved: "تمت الموافقة — جاري التنفيذ",
    rejected: "رُفض الطلب",
    expired: "انتهت صلاحية الطلب",
    requestFail: "تعذر إنشاء طلب الموافقة",
  },
  en: {
    title: "Dual control",
    hint: "This sensitive action needs an extra approval",
    selfConfirm: "I confirm I am responsible for this action",
    continue: "Continue",
    cancel: "Cancel",
    tabPassword: "Supervisor password",
    tabPin: "PIN",
    tabOnline: "Request online approval",
    tabWhatsapp: "WhatsApp OTP",
    tabNfc: "NFC badge",
    email: "Supervisor email",
    password: "Password",
    pin: "Supervisor PIN (4–8 digits)",
    pinClear: "Clear",
    otp: "WhatsApp code (6 digits)",
    sendOtp: "Send code",
    otpSent: "Code sent via WhatsApp",
    otpSentMock: "Mock mode — code was not delivered to WhatsApp (see server logs)",
    otpFail: "Could not send WhatsApp code",
    reason: "Approval reason",
    reasonHint: "Required for audit (min 3 characters)",
    reasonRequired: "Enter an approval reason",
    submit: "Confirm approval",
    waiting: "Waiting for manager approval…",
    waitingHint: "Ask a manager to open Approvals and decide within 15 minutes",
    expiresIn: "Expires in",
    expiredLocal: "Timed out — request again",
    approved: "Approved — continuing",
    rejected: "Request was rejected",
    expired: "Request expired",
    requestFail: "Could not create approval request",
  },
};

function isApprover(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

type WaitMode = "idle" | "waiting" | "done";
type Mode = "PASSWORD" | "PIN" | "ONLINE" | "WHATSAPP" | "NFC";

export function DualApprovalModal({
  open,
  actionLabel,
  action,
  payload,
  summary,
  actorRole,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const t = copy[locale === "en" ? "en" : "ar"];
  const approver = isApprover(actorRole);

  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<Mode>("PASSWORD");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [waitMode, setWaitMode] = useState<WaitMode>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestExpiresAt, setRequestExpiresAt] = useState<string | null>(null);
  const [expireLeftSec, setExpireLeftSec] = useState<number | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      setMode("PASSWORD");
      setEmail("");
      setPassword("");
      setPin("");
      setOtp("");
      setReason("");
      setOtpBusy(false);
      setWaitMode("idle");
      setRequestId(null);
      setRequestExpiresAt(null);
      setExpireLeftSec(null);
      setRequestBusy(false);
      confirmedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || waitMode !== "waiting" || !requestId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.getDualControlRequest(requestId);
        const status = String(res.data?.status || "").toUpperCase();
        if (cancelled) return;
        if (status === "APPROVED") {
          setWaitMode("done");
          if (!confirmedRef.current) {
            confirmedRef.current = true;
            toast.success(t.approved);
            await onConfirm({
              method: "APPROVAL_REQUEST",
              approvalRequestId: requestId,
              reason: reason.trim() || undefined,
            });
          }
          return;
        }
        if (status === "REJECTED") {
          setWaitMode("idle");
          setRequestId(null);
          toast.error(t.rejected);
          return;
        }
        if (status === "EXPIRED" || status === "CONSUMED") {
          setWaitMode("idle");
          setRequestId(null);
          toast.error(t.expired);
        }
      } catch {
        /* keep polling */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, waitMode, requestId, onConfirm, reason, t.approved, t.expired, t.rejected]);

  useEffect(() => {
    if (!open || waitMode !== "waiting" || !requestExpiresAt) {
      setExpireLeftSec(null);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(requestExpiresAt).getTime() - Date.now()) / 1000),
      );
      setExpireLeftSec(left);
      if (left <= 0) {
        setWaitMode("idle");
        setRequestId(null);
        setRequestExpiresAt(null);
        toast.error(t.expiredLocal);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, waitMode, requestExpiresAt, t.expiredLocal]);

  if (!open) return null;

  const reasonOk = reason.trim().length >= 3;

  const submitSelf = async () => {
    if (!checked || busy) return;
    if (reason.trim().length < 3) {
      toast.error(t.reasonRequired);
      return;
    }
    await onConfirm({ method: "SELF_CONFIRM", reason: reason.trim() });
  };

  const submitOther = async () => {
    if (busy || requestBusy) return;
    if (reason.trim().length < 3) {
      toast.error(t.reasonRequired);
      return;
    }
    if (mode === "ONLINE") {
      if (!action) {
        toast.error(t.requestFail);
        return;
      }
      setRequestBusy(true);
      try {
        const res = await api.createDualControlRequest({
          action,
          payload: payload || {},
          summary: summary || actionLabel,
        });
        setRequestId(res.data.id);
        setRequestExpiresAt(res.data.expiresAt || null);
        setWaitMode("waiting");
      } catch {
        toast.error(t.requestFail);
      } finally {
        setRequestBusy(false);
      }
      return;
    }
    if (mode === "PASSWORD") {
      await onConfirm({
        method: "PASSWORD",
        email: email.trim(),
        password,
        reason: reason.trim(),
      });
      return;
    }
    if (mode === "WHATSAPP") {
      await onConfirm({
        method: "WHATSAPP_OTP",
        otp: otp.trim(),
        reason: reason.trim(),
      });
      return;
    }
    if (mode === "NFC") {
      return;
    }
    await onConfirm({ method: "PIN", pin: pin.trim(), reason: reason.trim() });
  };

  const onNfcRead = async (badgeSecret: string) => {
    if (busy || confirmedRef.current) return;
    if (reason.trim().length < 3) {
      toast.error(t.reasonRequired);
      return;
    }
    confirmedRef.current = true;
    await onConfirm({ method: "NFC", badgeSecret, reason: reason.trim() });
  };

  const sendWhatsappOtp = async () => {
    if (!action || otpBusy) return;
    setOtpBusy(true);
    try {
      const res = await api.requestWhatsappOtp(action);
      const data = res.data as { mock?: boolean; mode?: string } | undefined;
      if (data?.mock || data?.mode === "mock") {
        toast(t.otpSentMock, { icon: "🧪" });
      } else {
        toast.success(t.otpSent);
      }
    } catch {
      toast.error(t.otpFail);
    } finally {
      setOtpBusy(false);
    }
  };

  const showOnline = !!action;
  const tabClass = (active: boolean) =>
    `flex-1 min-w-[4.5rem] px-1.5 py-2 text-[11px] font-semibold ${
      active ? "bg-sky-500/20 text-sky-200" : "text-slate-400 hover:bg-white/5"
    }`;

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
            disabled={busy || waitMode === "waiting"}
            className="text-slate-400 hover:text-white disabled:opacity-40"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {waitMode === "waiting" || waitMode === "done" ? (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
              <p className="text-sm font-semibold text-white">{t.waiting}</p>
              <p className="text-xs text-slate-400">{t.waitingHint}</p>
              {expireLeftSec != null ? (
                <p
                  className={`text-sm font-bold tabular-nums ${
                    expireLeftSec <= 60 ? "text-rose-300" : "text-amber-200"
                  }`}
                >
                  {t.expiresIn} {Math.floor(expireLeftSec / 60)}:
                  {String(expireLeftSec % 60).padStart(2, "0")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onCancel}
                className="mt-2 px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5"
              >
                {t.cancel}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.reason}</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 200))}
                  placeholder={t.reasonHint}
                  className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
                />
              </div>
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
              {showOnline ? (
                <button
                  type="button"
                  onClick={() => setMode("ONLINE")}
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-sky-500/30 text-sm text-sky-200 hover:bg-sky-500/10"
                >
                  <Wifi className="w-4 h-4" />
                  {t.tabOnline}
                </button>
              ) : null}
              {mode === "ONLINE" && showOnline ? (
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
                    disabled={busy || requestBusy || !reasonOk}
                    onClick={submitOther}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-sky-500 text-white disabled:opacity-50"
                  >
                    {(busy || requestBusy) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t.tabOnline}
                  </button>
                </div>
              ) : (
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
                    disabled={!checked || busy || !reasonOk}
                    onClick={submitSelf}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t.continue}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap rounded-lg overflow-hidden border border-white/10">
                <button type="button" onClick={() => setMode("PASSWORD")} className={tabClass(mode === "PASSWORD")}>
                  {t.tabPassword}
                </button>
                <button type="button" onClick={() => setMode("PIN")} className={tabClass(mode === "PIN")}>
                  {t.tabPin}
                </button>
                {showOnline ? (
                  <button type="button" onClick={() => setMode("ONLINE")} className={tabClass(mode === "ONLINE")}>
                    {t.tabOnline}
                  </button>
                ) : null}
                {showOnline ? (
                  <button type="button" onClick={() => setMode("WHATSAPP")} className={tabClass(mode === "WHATSAPP")}>
                    {t.tabWhatsapp}
                  </button>
                ) : null}
                <button type="button" onClick={() => setMode("NFC")} className={tabClass(mode === "NFC")}>
                  {t.tabNfc}
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
              ) : mode === "PIN" ? (
                <div className="space-y-3">
                  <label className="block text-xs text-slate-400">{t.pin}</label>
                  <div className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center">
                    <p
                      className="text-2xl font-extrabold text-white tracking-[0.35em] tabular-nums min-h-[1.5rem]"
                      aria-live="polite"
                    >
                      {pin ? "•".repeat(pin.length) : "····"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      ["1", "2", "3", "4", "5", "6", "7", "8", "9", t.pinClear, "0", "⌫"] as const
                    ).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="h-12 rounded-xl bg-white/5 border border-white/10 text-base font-bold text-white hover:bg-white/10 active:bg-amber-500/20"
                        onClick={() => {
                          if (k === t.pinClear) {
                            setPin("");
                            return;
                          }
                          if (k === "⌫") {
                            setPin((prev) => prev.slice(0, -1));
                            return;
                          }
                          setPin((prev) => `${prev}${k}`.replace(/\D/g, "").slice(0, 8));
                        }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="sr-only"
                    autoComplete="one-time-code"
                    aria-label={t.pin}
                  />
                </div>
              ) : mode === "WHATSAPP" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={otpBusy || !action}
                    onClick={sendWhatsappOtp}
                    className="w-full h-10 rounded-lg border border-emerald-500/30 text-sm text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    {otpBusy ? "…" : t.sendOtp}
                  </button>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t.otp}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white tracking-widest"
                    />
                  </div>
                </div>
              ) : mode === "NFC" ? (
                <NfcBadgeReader active={open && mode === "NFC"} onRead={onNfcRead} disabled={!!busy} />
              ) : (
                <p className="text-xs text-slate-400">{t.waitingHint}</p>
              )}

              {mode !== "NFC" ? (
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
                      requestBusy ||
                      otpBusy ||
                      !reasonOk ||
                      (mode === "PASSWORD"
                        ? !email.trim() || !password
                        : mode === "PIN"
                          ? pin.length < 4
                          : mode === "WHATSAPP"
                            ? otp.length !== 6
                            : !action)
                    }
                    onClick={submitOther}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 disabled:opacity-50"
                  >
                    {(busy || requestBusy) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === "ONLINE" ? t.tabOnline : t.submit}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-white/5"
                  >
                    {t.cancel}
                  </button>
                </div>
              )}
            </>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
