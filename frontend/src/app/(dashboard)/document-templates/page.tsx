"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

interface TemplateRow {
  id: string;
  type: string;
  name: string;
  headerText?: string | null;
  footerText?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

const TYPES = ["INVOICE", "QUOTATION", "CREDIT_NOTE", "DELIVERY_NOTE", "RECEIPT"] as const;

export default function DocumentTemplatesPage() {
  const t = useTranslations("documentTemplates");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.setDefaultDocumentTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success(t("defaultSet"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const bool = (v: unknown) => v === true || v === "true";

  return (
    <ErpCrudPage<TemplateRow>
      title={t("title")}
      subtitle={t("subtitle")}
      queryKey="document-templates"
      emptyLabel={t("title")}
      fetchAll={() => api.getDocumentTemplates()}
      create={(d) =>
        api.createDocumentTemplate({
          type: d.type,
          name: d.name,
          headerText: d.headerText || undefined,
          footerText: d.footerText || undefined,
          isDefault: bool(d.isDefault),
          isActive: d.isActive === undefined ? true : bool(d.isActive),
        })
      }
      update={(id, d) =>
        api.updateDocumentTemplate(id, {
          type: d.type,
          name: d.name,
          headerText: d.headerText || undefined,
          footerText: d.footerText || undefined,
          isDefault: bool(d.isDefault),
          isActive: d.isActive === undefined ? true : bool(d.isActive),
        })
      }
      remove={(id) => api.deleteDocumentTemplate(id)}
      toForm={(row) => ({
        type: row.type,
        name: row.name,
        headerText: row.headerText || "",
        footerText: row.footerText || "",
        isDefault: row.isDefault ? "true" : "false",
        isActive: row.isActive ? "true" : "false",
      })}
      columns={[
        {
          key: "type",
          label: t("type"),
          render: (r) => t(`type_${r.type}` as "type_INVOICE"),
        },
        { key: "name", label: t("name") },
        {
          key: "isDefault",
          label: t("default"),
          render: (r) => (r.isDefault ? "✓" : "—"),
        },
        {
          key: "isActive",
          label: t("active"),
          render: (r) => (r.isActive ? "✓" : "—"),
        },
      ]}
      fields={[
        {
          key: "type",
          label: t("type"),
          type: "select",
          required: true,
          options: TYPES.map((type) => ({
            value: type,
            label: t(`type_${type}` as "type_INVOICE"),
          })),
        },
        { key: "name", label: t("name"), required: true },
        {
          key: "headerText",
          label: t("headerText"),
          type: "textarea",
          placeholder: t("headerPlaceholder"),
        },
        {
          key: "footerText",
          label: t("footerText"),
          type: "textarea",
          placeholder: t("footerPlaceholder"),
        },
        {
          key: "isDefault",
          label: t("default"),
          type: "select",
          options: [
            { value: "false", label: t("no") },
            { value: "true", label: t("yes") },
          ],
        },
        {
          key: "isActive",
          label: t("active"),
          type: "select",
          options: [
            { value: "true", label: t("yes") },
            { value: "false", label: t("no") },
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
