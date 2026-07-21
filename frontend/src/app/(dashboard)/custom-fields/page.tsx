"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

interface FieldRow {
  id: string;
  entityType: string;
  key: string;
  label: string;
  labelEn?: string | null;
  fieldType: string;
  optionsJson?: string[] | null;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

const ENTITIES = ["CONTACT", "PRODUCT", "INVOICE"] as const;
const TYPES = ["TEXT", "NUMBER", "DATE", "SELECT"] as const;

export default function CustomFieldsPage() {
  const t = useTranslations("customFields");
  const locale = useLocale();

  const bool = (v: unknown) => v === true || v === "true";

  const parseOptions = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") {
      return raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  return (
    <ErpCrudPage<FieldRow>
      title={t("title")}
      subtitle={t("subtitle")}
      queryKey="custom-fields"
      emptyLabel={t("title")}
      fetchAll={() => api.getCustomFields()}
      create={(d) =>
        api.createCustomField({
          entityType: d.entityType,
          key: d.key,
          label: d.label,
          labelEn: d.labelEn || undefined,
          fieldType: d.fieldType,
          options: d.fieldType === "SELECT" ? parseOptions(d.options) : undefined,
          sortOrder: Number(d.sortOrder) || 0,
          isRequired: bool(d.isRequired),
          isActive: d.isActive === undefined ? true : bool(d.isActive),
        })
      }
      update={(id, d) =>
        api.updateCustomField(id, {
          entityType: d.entityType,
          key: d.key,
          label: d.label,
          labelEn: d.labelEn || undefined,
          fieldType: d.fieldType,
          options: d.fieldType === "SELECT" ? parseOptions(d.options) : undefined,
          sortOrder: Number(d.sortOrder) || 0,
          isRequired: bool(d.isRequired),
          isActive: d.isActive === undefined ? true : bool(d.isActive),
        })
      }
      remove={(id) => api.deleteCustomField(id)}
      toForm={(row) => ({
        entityType: row.entityType,
        key: row.key,
        label: row.label,
        labelEn: row.labelEn || "",
        fieldType: row.fieldType,
        options: Array.isArray(row.optionsJson) ? row.optionsJson.join("\n") : "",
        sortOrder: row.sortOrder,
        isRequired: row.isRequired ? "true" : "false",
        isActive: row.isActive ? "true" : "false",
      })}
      columns={[
        {
          key: "entityType",
          label: t("entityType"),
          render: (r) => t(`entity_${r.entityType}` as "entity_CONTACT"),
        },
        { key: "key", label: t("key") },
        {
          key: "label",
          label: t("label"),
          render: (r) => (locale === "en" && r.labelEn ? r.labelEn : r.label),
        },
        {
          key: "fieldType",
          label: t("fieldType"),
          render: (r) => t(`type_${r.fieldType}` as "type_TEXT"),
        },
        {
          key: "isRequired",
          label: t("required"),
          render: (r) => (r.isRequired ? "✓" : "—"),
        },
      ]}
      fields={[
        {
          key: "entityType",
          label: t("entityType"),
          type: "select",
          required: true,
          options: ENTITIES.map((e) => ({
            value: e,
            label: t(`entity_${e}` as "entity_CONTACT"),
          })),
        },
        { key: "key", label: t("key"), required: true, placeholder: "region" },
        { key: "label", label: t("label"), required: true },
        { key: "labelEn", label: t("labelEn") },
        {
          key: "fieldType",
          label: t("fieldType"),
          type: "select",
          required: true,
          options: TYPES.map((type) => ({
            value: type,
            label: t(`type_${type}` as "type_TEXT"),
          })),
        },
        {
          key: "options",
          label: t("options"),
          type: "textarea",
          placeholder: t("optionsHint"),
        },
        { key: "sortOrder", label: t("sortOrder"), type: "number" },
        {
          key: "isRequired",
          label: t("required"),
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
    />
  );
}
