"use client";

import { useTranslations } from "next-intl";
import { ReceiptsListPage } from "@/components/receipts/receipts-list-page";

export default function SalesReceiptsPage() {
  const t = useTranslations("receipts");

  return (
    <ReceiptsListPage
      direction="SALES"
      title={t("salesTitle")}
      subtitle={t("salesSubtitle")}
      emptyLabel={t("salesEmpty")}
    />
  );
}
