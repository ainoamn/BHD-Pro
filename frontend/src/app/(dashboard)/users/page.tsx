"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, X, Loader2, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, apiErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, EmptyState, LoadingSpinner, QueryError, GlassCard } from "@/components/ui/page-shell";
import { UserAccessTree } from "@/components/users/user-access-tree";
import {
  defaultsForRole,
  resolveModulePermissions,
  type AccessLevel,
  type ModulePermissions,
} from "@/lib/module-permissions";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  permissions?: Record<string, AccessLevel> | null;
  modulePermissions?: ModulePermissions;
}

const ROLES = [
  "ADMIN",
  "ACCOUNTANT",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "RESTO_MANAGER",
  "VIEWER",
] as const;

export default function UsersPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === "ADMIN";
  const locale = currentUser?.company?.language === "en" ? "en" : "ar";
  const en = locale === "en";

  const [modalOpen, setModalOpen] = useState(false);
  const [permUser, setPermUser] = useState<TeamUser | null>(null);
  const [permDraft, setPermDraft] = useState<ModulePermissions>(defaultsForRole("ACCOUNTANT"));
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ACCOUNTANT",
  });
  const [createPerms, setCreatePerms] = useState<ModulePermissions>(
    defaultsForRole("ACCOUNTANT"),
  );

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.getUsers();
      return res.data as TeamUser[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createUser({
        ...form,
        permissions: form.role === "ADMIN" ? undefined : createPerms,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(t("created"));
      setModalOpen(false);
      setForm({ name: "", email: "", password: "", role: "ACCOUNTANT" });
      setCreatePerms(defaultsForRole("ACCOUNTANT"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, t("createError")));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.updateUser(id, { role, permissions: defaultsForRole(role) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(t("updated"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, t("createError")));
    },
  });

  const updatePermsMutation = useMutation({
    mutationFn: ({
      id,
      permissions,
    }: {
      id: string;
      permissions: ModulePermissions;
    }) => api.updateUser(id, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(en ? "Permissions saved" : "تم حفظ الصلاحيات");
      setPermUser(null);
    },
    onError: (err) => toast.error(apiErrorMessage(err, en ? "Could not save" : "تعذر الحفظ")),
  });

  const openCreate = () => {
    setForm({ name: "", email: "", password: "", role: "ACCOUNTANT" });
    setCreatePerms(defaultsForRole("ACCOUNTANT"));
    setModalOpen(true);
  };

  const onCreateRoleChange = (role: string) => {
    setForm((f) => ({ ...f, role }));
    setCreatePerms(defaultsForRole(role));
  };

  const openPerms = (u: TeamUser) => {
    setPermDraft(
      resolveModulePermissions(u.role, u.modulePermissions || u.permissions),
    );
    setPermUser(u);
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: "bg-rose-500/10 text-rose-400",
      ACCOUNTANT: "bg-emerald-500/10 text-emerald-400",
      MANAGER: "bg-blue-500/10 text-blue-400",
      CASHIER: "bg-amber-500/10 text-amber-400",
      WAITER: "bg-orange-500/10 text-orange-400",
      KITCHEN: "bg-yellow-500/10 text-yellow-400",
      RESTO_MANAGER: "bg-amber-600/15 text-amber-300",
      VIEWER: "bg-slate-500/10 text-slate-400",
    };
    return map[role] || "bg-slate-500/10 text-slate-400";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={
          en
            ? "Pick a role — permissions load as a nested tree you can fine-tune"
            : "اختر الدور — تُحمَّل الصلاحيات كشجرة متداخلة قابلة للتعديل"
        }
        action={
          isAdmin ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              {t("addUser")}
            </button>
          ) : undefined
        }
      />

      {!isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-sm">
          {t("adminOnly")}
        </div>
      )}

      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : users.length === 0 ? (
          <EmptyState icon={Shield} title={t("noUsers")} description={t("addFirst")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("name")}</th>
                  <th className="text-right p-4 font-medium">{t("email")}</th>
                  <th className="text-right p-4 font-medium">{t("role")}</th>
                  <th className="text-right p-4 font-medium">{t("status")}</th>
                  {isAdmin && (
                    <th className="text-right p-4 font-medium">{tCommon("actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-white font-medium">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-emerald-400 mr-2">({t("you")})</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300">{u.email}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          roleColor(u.role),
                        )}
                      >
                        {t(`role_${u.role}`)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          u.isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-500/10 text-slate-400",
                        )}
                      >
                        {u.isActive ? t("active") : t("inactive")}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.id !== currentUser?.id ? (
                            <select
                              value={u.role}
                              onChange={(e) =>
                                updateRoleMutation.mutate({
                                  id: u.id,
                                  role: e.target.value,
                                })
                              }
                              disabled={updateRoleMutation.isPending}
                              className="h-8 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {t(`role_${r}`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                          {u.role !== "ADMIN" && (
                            <button
                              type="button"
                              onClick={() => openPerms(u)}
                              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg bg-teal-700/30 text-teal-200 text-xs font-bold hover:bg-teal-700/50"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              {en ? "Access" : "صلاحيات"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl mb-10">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">{t("addUser")}</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("name")}</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("email")}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("password")}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={8}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("role")}</label>
                  <select
                    value={form.role}
                    onChange={(e) => onCreateRoleChange(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role_${r}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role === "ADMIN" ? (
                <p className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-xl px-3 py-2">
                  {en
                    ? "Company admins always have full access — no overrides."
                    : "مدير الشركة يملك صلاحية كاملة دائماً — لا يمكن تقييدها."}
                </p>
              ) : (
                <UserAccessTree
                  en={en}
                  value={createPerms}
                  onChange={setCreatePerms}
                />
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={
                  !form.name ||
                  !form.email ||
                  form.password.length < 8 ||
                  createMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {t("addUser")}
              </button>
            </div>
          </div>
        </div>
      )}

      {permUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl mb-10">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {en ? "Module access" : "صلاحيات الأقسام"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {permUser.name} · {t(`role_${permUser.role}`)}
                </p>
              </div>
              <button
                onClick={() => setPermUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[65vh] overflow-y-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPermDraft(defaultsForRole(permUser.role))}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 text-teal-200 hover:bg-slate-800"
                >
                  {en ? "Reset to role defaults" : "إعادة لافتراضي الدور"}
                </button>
              </div>
              <UserAccessTree en={en} value={permDraft} onChange={setPermDraft} />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setPermUser(null)} className="px-4 py-2 text-slate-400">
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={updatePermsMutation.isPending}
                onClick={() =>
                  updatePermsMutation.mutate({
                    id: permUser.id,
                    permissions: permDraft,
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {updatePermsMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {tCommon("save") || (en ? "Save" : "حفظ")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
