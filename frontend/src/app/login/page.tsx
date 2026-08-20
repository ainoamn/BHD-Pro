"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function safeNextPath(raw: string | null): string {
  if (!raw || raw === "/") return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function bhdStartUrl(returnTo: string): string {
  return `/api/auth/bhd/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function LoginShell() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next") || searchParams.get("returnTo")),
    [searchParams],
  );
  const local = searchParams.get("local") === "1";
  const bhd = searchParams.get("bhd");
  const isAdminNext = nextPath.startsWith("/admin");

  useEffect(() => {
    if (local && !isAdminNext) return;
    if (isAdminNext) {
      window.location.replace(
        `/api/auth/admin-entry?next=${encodeURIComponent(nextPath)}`,
      );
      return;
    }
    window.location.replace(bhdStartUrl(nextPath));
  }, [local, isAdminNext, nextPath]);

  if (!local || isAdminNext) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fbfaf7] text-[#092d24]">
        <Loader2 className="h-8 w-8 animate-spin text-[#075c45]" />
        <p className="text-sm font-medium">جاري التحويل إلى بوابة BHD…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fbfaf7] px-4 text-[#092d24]">
      <h1 className="text-xl font-bold">حسابي — دخول طوارئ محلي</h1>
      {bhd === "no_user" && (
        <p className="max-w-md text-center text-sm text-amber-800">
          لا يوجد مستخدم حسابي مرتبط بهذا الحساب على الهوية. اطلب دعوة من مدير
          شركتك بنفس البريد، ثم ادخل عبر BHD.
        </p>
      )}
      {bhd === "error" || bhd === "denied" ? (
        <p className="max-w-md text-center text-sm text-red-700">
          تعذّر إكمال الدخول الموحّد. حاول مرة أخرى من بوابة BHD.
        </p>
      ) : null}
      <a
        className="rounded-lg bg-[#075c45] px-4 py-2 text-sm font-semibold text-white"
        href={bhdStartUrl(nextPath)}
      >
        الدخول عبر هوية BHD
      </a>
      <a
        className="text-sm text-[#075c45] underline"
        href={`/api/auth/admin-entry?next=${encodeURIComponent("/admin")}`}
      >
        دخول إدارة المنصة
      </a>
      <p className="max-w-sm text-center text-xs text-stone-500">
        النموذج المحلي معطّل للمستخدم النهائي. استخدم{" "}
        <Link href="https://id.bhd-om.com/login" className="underline">
          id.bhd-om.com
        </Link>
        . للطوارئ فقط أبقِ <code>?local=1</code> مع مسار غير /admin.
      </p>
      <LegacyLocalForm nextPath={nextPath} />
    </div>
  );
}

/** Emergency-only password form (ops break-glass). */
function LegacyLocalForm({ nextPath }: { nextPath: string }) {
  return (
    <form
      className="mt-4 w-full max-w-sm space-y-3 rounded-xl border border-[#d7e2dc] bg-white p-4 shadow-sm"
      action="#"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") || "");
        const password = String(fd.get("password") || "");
        try {
          const { default: api } = await import("@/lib/api");
          await api.login(email, password);
          window.location.replace(nextPath);
        } catch {
          alert("فشل الدخول المحلي");
        }
      }}
    >
      <p className="text-xs font-semibold text-amber-700">
        طوارئ فقط — لا تستخدم للتشغيل اليومي
      </p>
      <input
        name="email"
        type="email"
        required
        placeholder="البريد"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="كلمة المرور"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-stone-800 py-2 text-sm font-semibold text-white"
      >
        دخول محلي
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#075c45]" />
        </div>
      }
    >
      <LoginShell />
    </Suspense>
  );
}
