"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";
import { PageHeader, GlassCard, LoadingSpinner } from "@/components/ui/page-shell";

type Tab = "employees" | "payroll";

export default function EmployeesPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [tab, setTab] = useState<Tab>("employees");
  const queryClient = useQueryClient();

  const { data: payroll = [], isLoading } = useQuery({
    queryKey: ["payroll"],
    queryFn: async () =>
      (await api.getPayrollRuns()).data as {
        id: string;
        number: string;
        periodMonth: number;
        periodYear: number;
        totalNet: number;
        status: string;
      }[],
    enabled: tab === "payroll",
  });

  const createPayroll = useMutation({
    mutationFn: () => {
      const now = new Date();
      return api.createPayrollRun({
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updatePayrollStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} label={t("employeesTab")} />
        <TabBtn active={tab === "payroll"} onClick={() => setTab("payroll")} label={t("payrollTab")} />
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
            }
          />
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <GlassCard className="overflow-hidden">
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
                    <tr key={p.id} className="border-b border-slate-800/50">
                      <td className="p-4 text-white">{p.number}</td>
                      <td className="p-4 text-slate-300">
                        {p.periodMonth}/{p.periodYear}
                      </td>
                      <td className="p-4 text-emerald-400">{formatMoney(Number(p.totalNet), currency)}</td>
                      <td className="p-4 text-slate-400">{p.status}</td>
                      <td className="p-4">
                        {p.status === "DRAFT" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: p.id, status: "APPROVED" })}
                            className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300"
                          >
                            {t("approve")}
                          </button>
                        )}
                        {p.status === "APPROVED" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: p.id, status: "PAID" })}
                            className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300"
                          >
                            {t("markPaid")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </div>
      )}
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
