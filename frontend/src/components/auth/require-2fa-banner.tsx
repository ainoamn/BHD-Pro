"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth";

/** Banner when policy requires TOTP but the user has not enabled it yet. */
export function Require2faBanner() {
  const user = useAuthStore((s) => s.user);
  if (!user?.twoFactorRequired || user.twoFactorEnabled) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">
            المصادقة الثنائية مطلوبة لدورك
          </p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            فعّل 2FA من الإعدادات لحماية حساب المدير. لا يمكن إيقافها بعد التفعيل
            طالما السياسة سارية.
          </p>
        </div>
      </div>
      <Link
        href="/settings#two-factor"
        className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 text-center"
      >
        تفعيل الآن
      </Link>
    </div>
  );
}
