"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

export default function BankAccountsPage() {
  const t = useTranslations("erp");
  const tRecon = useTranslations("bankRecon");
  const { company } = useAuthStore();
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/bank-reconciliation"
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700"
        >
          <ArrowLeftRight className="w-4 h-4" />
          {tRecon("title")}
        </Link>
      </div>
      <ErpCrudPage
        title={t("bankTitle")}
        subtitle={t("bankSubtitle")}
        queryKey="bank-accounts"
        emptyLabel={t("bankTitle")}
        currency={company?.currency}
        fetchAll={() => api.getBankAccounts()}
        create={(d) => api.createBankAccount(d)}
        update={(id, d) => api.updateBankAccount(id, d)}
        remove={(id) => api.deleteBankAccount(id)}
        columns={[
          { key: "name", label: t("name") },
          { key: "bankName", label: t("bankName") },
          { key: "accountNumber", label: t("accountNumber") },
          {
            key: "currentBalance",
            label: t("balance"),
            render: (r) =>
              formatMoney(
                Number((r as Record<string, unknown>).currentBalance),
                company?.currency || "OMR"
              ),
          },
        ]}
        fields={[
          { key: "name", label: t("name"), required: true },
          { key: "bankName", label: t("bankName"), required: true },
          { key: "accountNumber", label: t("accountNumber"), required: true },
          { key: "iban", label: t("iban") },
          { key: "openingBalance", label: t("openingBalance"), type: "number" },
          {
            key: "branchId",
            label: t("branch"),
            type: "select",
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
        ]}
      />
    </div>
  );
}
