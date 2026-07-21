"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, ChevronDown, ChevronLeft, Edit, Trash2, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

interface TreeNode {
  id: string;
  code: string;
  name: string;
  type: string;
  currentBalance: number;
  children: TreeNode[];
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function TreeRow({
  node,
  depth,
  currency,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  currency: string;
  onEdit: (n: TreeNode) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
        <td className="p-3 text-white font-mono" style={{ paddingRight: 12 + depth * 20 }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => setOpen(!open)} className="text-slate-500 hover:text-white">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            {node.code}
          </div>
        </td>
        <td className="p-3 text-slate-200">{node.name}</td>
        <td className="p-3 text-slate-400 text-xs">{node.type}</td>
        <td className="p-3 text-emerald-400">{formatMoney(node.currentBalance, currency)}</td>
        <td className="p-3">
          <div className="flex gap-1 justify-end">
            <button onClick={() => onEdit(node)} className="p-1 text-slate-400 hover:text-white">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(node.id)} className="p-1 text-rose-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {open &&
        node.children.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            currency={currency}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    category: "CURRENT_ASSET",
    parentId: "",
    openingBalance: 0,
  });
  const [editForm, setEditForm] = useState({ code: "", name: "" });

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ["accounts-tree"],
    queryFn: async () => {
      const res = await api.getAccountsTree();
      return res.data as TreeNode[];
    },
  });

  const { data: flat = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.getAccounts();
      return res.data as { id: string; code: string; name: string }[];
    },
  });

  const flatNodes = flattenTree(tree);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.createAccount({
        ...form,
        parentId: form.parentId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-tree"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(tCommon("saved"));
      setOpen(false);
    },
    onError: () => toast.error(tCommon("error")),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateAccount(editId!, editForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-tree"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(tCommon("saved"));
      setEditId(null);
    },
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-tree"] });
      toast.success(tCommon("deleted"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const openEdit = (node: TreeNode) => {
    setEditId(node.id);
    setEditForm({ code: node.code, name: node.name });
  };

  const handleDelete = (id: string) => {
    if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("chartTitle")}
        subtitle={t("chartSubtitle")}
        action={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            {tCommon("add")}
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {flatNodes.map((node) => (
              <GlassCard key={node.id} className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-white font-mono font-semibold">{node.code}</p>
                    <p className="text-sm text-slate-300 mt-0.5">{node.name}</p>
                  </div>
                  <p className="text-emerald-400 text-sm shrink-0">
                    {formatMoney(node.currentBalance, currency)}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{node.type}</p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => openEdit(node)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="p-3 text-right">{t("code")}</th>
                    <th className="p-3 text-right">{t("name")}</th>
                    <th className="p-3 text-right">{t("type")}</th>
                    <th className="p-3 text-right">{t("balance")}</th>
                    <th className="p-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {tree.map((node) => (
                    <TreeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      currency={currency}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">{tCommon("add")}</h2>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <input
              placeholder={t("code")}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <input
              placeholder={t("name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">{t("parentAccount")}</option>
              {flat.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              placeholder={t("openingBalance")}
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {tCommon("save")}
            </button>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">{tCommon("edit")}</h2>
              <button onClick={() => setEditId(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <input
              placeholder={t("code")}
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <input
              placeholder={t("name")}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-2"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {tCommon("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
