"use client";

import { useTranslations } from "next-intl";
import {
  Users,
  FileText,
  Receipt,
  FilePlus,
  Banknote,
  ShoppingCart,
  Globe,
} from "lucide-react";
import { ModuleHub } from "@/components/hub/module-hub";

export default function PurchasesHubPage() {
  const t = useTranslations("purchasesHub");

  const items = [
    {
      href: "/contacts?type=SUPPLIER",
      icon: Users,
      title: t("suppliers"),
      description: t("suppliersDesc"),
    },
    {
      href: "/accounting?tab=purchases",
      icon: FileText,
      title: t("invoices"),
      description: t("invoicesDesc"),
    },
    {
      href: "/purchases/receipts",
      icon: Receipt,
      title: t("receipts"),
      description: t("receiptsDesc"),
    },
    {
      href: "/purchases/cash",
      icon: Banknote,
      title: t("cashExpenses"),
      description: t("cashExpensesDesc"),
    },
    {
      href: "/accounting?tab=purchases&docType=DEBIT_NOTE",
      icon: FilePlus,
      title: t("debitNotes"),
      description: t("debitNotesDesc"),
    },
    {
      href: "/purchases/orders",
      icon: ShoppingCart,
      title: t("purchaseOrders"),
      description: t("purchaseOrdersDesc"),
    },
    {
      href: "/reports/financial?tab=apAging",
      icon: Globe,
      title: t("aging"),
      description: t("agingDesc"),
    },
  ];

  return <ModuleHub title={t("title")} subtitle={t("subtitle")} items={items} />;
}
