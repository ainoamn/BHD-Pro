"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, Phone, User as UserIcon, AtSign } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { homePathForUser } from "@/lib/user-home";

type InviteInfo = {
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  company?: { name?: string | null } | null;
};

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocaleStore((s) => s.locale);
  const token = useMemo(() => searchParams.get("invite") || "", [searchParams]);
  const en = locale === "en";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.getInvite(token);
        if (cancelled) return;
        const data = res.data as InviteInfo;
        setInvite(data);
        setForm((prev) => ({
          ...prev,
          name: data.name || "",
          phone: data.phone || "",
          username: data.username || "",
        }));
      } catch (err) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (en ? "Invalid or expired invitation" : "الدعوة غير صالحة أو منتهية");
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, en]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error(en ? "Passwords do not match" : "كلمتا المرور غير متطابقتين");
      return;
    }
    setSaving(true);
    try {
      await api.completeInvite({
        token,
        name: form.name,
        phone: form.phone,
        username: form.username,
        password: form.password,
      });
      toast.success(en ? "Account activated" : "تم تفعيل الحساب");
      router.replace(homePathForUser(useAuthStore.getState().user));
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (en ? "Could not complete setup" : "تعذر إكمال التفعيل");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!token || !invite) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold">{en ? "Invitation unavailable" : "الدعوة غير متاحة"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {en
              ? "Ask your company administrator to resend the invite."
              : "اطلب من مدير الشركة إعادة إرسال الدعوة."}
          </p>
          <Link href="/login" className="text-emerald-500 hover:underline">
            {en ? "Go to login" : "الذهاب لتسجيل الدخول"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-lg space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {en ? "Complete your account" : "أكمل تفعيل حسابك"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {en
              ? `You were invited to ${invite.company?.name || "Hisaby"}`
              : `تمت دعوتك إلى ${invite.company?.name || "حسابي"}`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" />
          <span className="truncate">{invite.email}</span>
        </div>

        <div>
          <label className="block text-sm mb-1">{en ? "Full name" : "الاسم الكامل"}</label>
          <div className="relative">
            <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">{en ? "Phone" : "رقم الهاتف"}</label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">{en ? "Username" : "اسم المستخدم"}</label>
            <div className="relative">
              <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase() }))}
                className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">{en ? "Password" : "كلمة المرور"}</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                minLength={8}
                className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">{en ? "Confirm password" : "تأكيد كلمة المرور"}</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                minLength={8}
                className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {en ? "Activate account" : "تفعيل الحساب"}
        </button>
      </form>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-app flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <CompleteProfileForm />
    </Suspense>
  );
}
