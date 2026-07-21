"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

interface TaxRateRow {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
}

export default function TaxRatesPage() {
  const t = useTranslations("taxRates");
  const tCommon = useTranslations("common");
  const { company, setCompany } = useAuthStore();
  const queryClient = useQueryClient();

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.setDefaultTaxRate(id),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      const rate = Number((res.data as TaxRateRow).rate);
      if (company) {
        setCompany({ ...company, vatRate: rate });
      }
      toast.success(t("defaultSet"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  return (
    <ErpCrudPage<TaxRateRow>
      title={t("title")}
      subtitle={t("subtitle")}
      queryKey="tax-rates"
      emptyLabel={t("title")}
      fetchAll={() => api.getTaxRates()}
      create={(d) =>
        api.createTaxRate({
          ...d,
          rate: Number(d.rate),
          isDefault: d.isDefault === true || d.isDefault === "true",
        })
      }
      update={(id, d) =>
        api.updateTaxRate(id, {
          ...d,
          rate: Number(d.rate),
          isDefault: d.isDefault === true || d.isDefault === "true",
        })
      }
      remove={(id) => api.deleteTaxRate(id)}
      toForm={(row) => ({
        code: row.code,
        name: row.name,
        nameEn: row.nameEn || "",
        rate: Number(row.rate),
        isDefault: row.isDefault ? "true" : "false",
      })}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        {
          key: "rate",
          label: t("rate"),
          render: (r) => `${Number(r.rate)}%`,
        },
        {
          key: "isDefault",
          label: t("default"),
          render: (r) => (r.isDefault ? "✓" : "—"),
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("name"), required: true },
        { key: "nameEn", label: t("nameEn") },
        { key: "rate", label: t("rate"), type: "number", required: true },
        {
          key: "isDefault",
          label: t("default"),
          type: "select",
          options: [
            { value: "false", label: t("no") },
            { value: "true", label: t("yes") },
          ],
        },
      ]}
      rowActions={(row) =>
        !row.isDefault ? (
          <button
            type="button"
            disabled={setDefaultMutation.isPending}
            onClick={() => setDefaultMutation.mutate(row.id)}
            className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          >
            {t("setDefault")}
          </button>
        ) : null
      }
    />
  );
}
