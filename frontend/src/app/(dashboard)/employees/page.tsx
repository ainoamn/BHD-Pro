"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Plus, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";
import { PageHeader, GlassCard, LoadingSpinner, QueryError } from "@/components/ui/page-shell";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";

type Tab = "employees" | "payroll";

interface PayrollLine {
  id: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  employee?: { id: string; name: string; employeeNumber: string };
}

interface PayrollRun {
  id: string;
  number: string;
  periodMonth: number;
  periodYear: number;
  totalNet: number;
  status: string;
  lines?: PayrollLine[];
}

export default function EmployeesPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const tDual = useTranslations("dualControl");
  const { company, user } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [tab, setTab] = useState<Tab>("employees");
  const queryClient = useQueryClient();
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [payBankId, setPayBankId] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [dualPayOpen, setDualPayOpen] = useState(false);

  const { data: payroll = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () => (await api.getPayrollRuns()).data as PayrollRun[],
    enabled: tab === "payroll",
  });

  const { data: banks = [], isError: banksError, refetch: refetchBanks } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () =>
      (await api.getBankAccounts()).data as { id: string; name: string; bankName: string }[],
    enabled: tab === "payroll",
  });

  const createPayroll = useMutation({
    mutationFn: () =>
      api.createPayrollRun({
        periodMonth,
        periodYear,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      bankAccountId,
      approval,
    }: {
      id: string;
      status: string;
      bankAccountId?: string;
      approval?: DualApprovalPayload;
    }) =>
      api.updatePayrollStatus(id, status, {
        bankAccountId,
        paymentMethod: bankAccountId ? "BANK_TRANSFER" : "CASH",
        approval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setPayingId(null);
      setPayBankId("");
      setDualPayOpen(false);
      toast.success(tCommon("saved"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const markPaid = (id: string) => {
    setPayingId(id);
  };

  const confirmPaid = (id: string) => {
    setPayingId(id);
    setDualPayOpen(true);
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} label={t("employeesTab")} />
          <TabBtn active={tab === "payroll"} onClick={() => setTab("payroll")} label={t("payrollTab")} />
        </div>
        <Link
          href="/employee-claims"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700"
        >
          <Wallet className="w-4 h-4" />
          {t("claimsLink")}
        </Link>
      </div>

      {tab === "employees" ? (
        <ErpCrudPage
          title={t("employeesTitle")}
          subtitle={t("employeesSubtitle")}
          queryKey="employees"
          emptyLabel={t("employeesTab")}
          currency={currency}
          fetchAll={() => api.getEmployees()}
          create={(d) => api.createEmployee(d)}
          update={(id, d) => api.updateEmployee(id, d)}
          remove={(id) => api.deleteEmployee(id)}
          columns={[
            { key: "employeeNumber", label: t("employeeNumber") },
            { key: "name", label: t("name") },
            { key: "jobTitle", label: t("jobTitle") },
            { key: "department", label: t("department") },
            {
              key: "baseSalary",
              label: t("salary"),
              render: (r) =>
                formatMoney(Number((r as Record<string, unknown>).baseSalary), currency),
            },
          ]}
          fields={[
            { key: "employeeNumber", label: t("employeeNumber"), required: true },
            { key: "name", label: t("name"), required: true },
            { key: "jobTitle", label: t("jobTitle") },
            { key: "department", label: t("department") },
            { key: "baseSalary", label: t("salary"), type: "number" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
          ]}
        />
      ) : (
        <div className="space-y-6">
          <PageHeader
            title={t("payrollTab")}
            subtitle={t("employeesSubtitle")}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => createPayroll.mutate()}
                  disabled={createPayroll.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
                >
                  {createPayroll.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t("createPayroll")}
                </button>
              </div>
            }
          />
          {banksError ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-amber-100">{tCommon("error")}</p>
              <button
                type="button"
                onClick={() => void refetchBanks()}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-900"
              >
                {tCommon("retry")}
              </button>
            </div>
          ) : null}
          {isLoading ? (
            <LoadingSpinner />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : payroll.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 text-sm">{t("noPayroll")}</GlassCard>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {payroll.map((p) => (
                  <GlassCard key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold">{p.number}</p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {p.periodMonth}/{p.periodYear}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{p.status}</span>
                    </div>
                    <p className="text-emerald-400 font-medium">
                      {formatMoney(Number(p.totalNet), currency)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 flex items-center gap-1"
                      >
                        {t("viewLines")}
                        {expandedId === p.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {p.status === "DRAFT" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: p.id, status: "APPROVED" })}
                          className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300"
                        >
                          {t("approve")}
                        </button>
                      )}
                      {p.status === "APPROVED" && (
                        <div className="flex flex-col gap-2 w-full">
                          {payingId === p.id ? (
                            <>
                              <select
                                value={payBankId}
                                onChange={(e) => setPayBankId(e.target.value)}
                                className="h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                              >
                                <option value="">{t("optionalBank")}</option>
                                {banks.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => confirmPaid(p.id)}
                                className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300"
                              >
                                {t("confirmPay")}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => markPaid(p.id)}
                              className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300"
                            >
                              {t("markPaid")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {expandedId === p.id && p.lines && p.lines.length > 0 && (
                      <div className="border-t border-slate-800 pt-3 space-y-2">
                        {p.lines.map((line) => (
                          <div key={line.id} className="flex justify-between text-sm">
                            <span className="text-slate-300">
                              {line.employee?.name || "—"}
                            </span>
                            <span className="text-emerald-400">
                              {formatMoney(Number(line.netSalary), currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>

              <GlassCard className="hidden md:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-4 text-right">{t("code")}</th>
                      <th className="p-4 text-right">{t("period")}</th>
                      <th className="p-4 text-right">{t("totalNet")}</th>
                      <th className="p-4 text-right">{t("status")}</th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {payroll.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="border-b border-slate-800/50">
                          <td className="p-4 text-white">{p.number}</td>
                          <td className="p-4 text-slate-300">
                            {p.periodMonth}/{p.periodYear}
                          </td>
                          <td className="p-4 text-emerald-400">
                            {formatMoney(Number(p.totalNet), currency)}
                          </td>
                          <td className="p-4 text-slate-400">{p.status}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId(expandedId === p.id ? null : p.id)
                                }
                                className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 flex items-center gap-1"
                              >
                                {t("viewLines")}
                                {expandedId === p.id ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                              {p.status === "DRAFT" && (
                                <button
                                  onClick={() =>
                                    statusMutation.mutate({ id: p.id, status: "APPROVED" })
                                  }
                                  className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300"
                                >
                                  {t("approve")}
                                </button>
                              )}
                              {p.status === "APPROVED" && (
                                <div className="flex items-center gap-2">
                                  {payingId === p.id ? (
                                    <>
                                      <select
                                        value={payBankId}
                                        onChange={(e) => setPayBankId(e.target.value)}
                                        className="h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                      >
                                        <option value="">{t("optionalBank")}</option>
                                        {banks.map((b) => (
                                          <option key={b.id} value={b.id}>
                                            {b.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => confirmPaid(p.id)}
                                        className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300"
                                      >
                                        {t("confirmPay")}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => markPaid(p.id)}
                                      className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300"
                                    >
                                      {t("markPaid")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === p.id && p.lines && p.lines.length > 0 && (
                          <tr className="bg-slate-900/50">
                            <td colSpan={5} className="p-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-right py-1">{t("employeeNumber")}</th>
                                    <th className="text-right py-1">{t("name")}</th>
                                    <th className="text-right py-1">{t("salary")}</th>
                                    <th className="text-right py-1">{t("totalNet")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.lines.map((line) => (
                                    <tr key={line.id} className="border-t border-slate-800/50">
                                      <td className="py-2 text-slate-400">
                                        {line.employee?.employeeNumber}
                                      </td>
                                      <td className="py-2 text-white">{line.employee?.name}</td>
                                      <td className="py-2 text-slate-300">
                                        {formatMoney(Number(line.baseSalary), currency)}
                                      </td>
                                      <td className="py-2 text-emerald-400">
                                        {formatMoney(Number(line.netSalary), currency)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            </>
          )}
        </div>
      )}

      <DualApprovalModal
        open={dualPayOpen && !!payingId}
        action="PAYROLL_PAY"
        actionLabel={tDual("action.PAYROLL_PAY")}
        payload={payingId ? { payrollRunId: payingId } : undefined}
        summary={
          payingId
            ? payroll.find((p) => p.id === payingId)?.number
            : undefined
        }
        actorRole={user?.role}
        busy={statusMutation.isPending}
        onCancel={() => setDualPayOpen(false)}
        onConfirm={async (approval) => {
          if (!payingId) return;
          await statusMutation.mutateAsync({
            id: payingId,
            status: "PAID",
            bankAccountId: payBankId || undefined,
            approval,
          });
        }}
      />
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        active ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
