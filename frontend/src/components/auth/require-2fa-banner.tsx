"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth";

/** Banner when policy requires TOTP but the user has not enabled it yet. */
export function Require2faBanner() {
  const user = useAuthStore((s) => s.user);
  if (!user?.twoFactorRequired || user.twoFactorEnabled) return null;

  const past = !!user.twoFactorPastGrace;
  const daysLeft = user.twoFactorDaysLeft;

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        past
          ? "border-rose-500/40 bg-rose-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <ShieldAlert
          className={`w-5 h-5 shrink-0 mt-0.5 ${past ? "text-rose-400" : "text-amber-400"}`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${past ? "text-rose-100" : "text-amber-100"}`}
          >
            {past
              ? "انتهت مهلة تفعيل المصادقة الثنائية"
              : "المصادقة الثنائية مطلوبة لدورك"}
          </p>
          <p
            className={`text-xs mt-0.5 ${past ? "text-rose-200/80" : "text-amber-200/80"}`}
          >
            {past
              ? "فعّل 2FA من الإعدادات للمتابعة — التعديلات على النظام موقوفة حتى التفعيل."
              : daysLeft != null
                ? `يتبقى ${daysLeft} يومًا لتفعيل 2FA قبل قفل التعديلات. لا يمكن إيقافها بعد التفعيل طالما السياسة سارية.`
                : "فعّل 2FA من الإعدادات لحماية حساب المدير. لا يمكن إيقافها بعد التفعيل طالما السياسة سارية."}
          </p>
        </div>
      </div>
      <Link
        href="/settings#two-factor"
        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-center ${
          past
            ? "bg-rose-500 text-white hover:bg-rose-400"
            : "bg-amber-500 text-slate-950 hover:bg-amber-400"
        }`}
      >
        تفعيل الآن
      </Link>
    </div>
  );
}
