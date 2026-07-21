"use client";

import { useTranslations } from "next-intl";
import { ReceiptsListPage } from "@/components/receipts/receipts-list-page";

export default function PurchasesReceiptsPage() {
  const t = useTranslations("receipts");

  return (
    <ReceiptsListPage
      direction="PURCHASE"
      title={t("purchaseTitle")}
      subtitle={t("purchaseSubtitle")}
      emptyLabel={t("purchaseEmpty")}
    />
  );
}
