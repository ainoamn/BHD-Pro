"use client";

import { useTranslations } from "next-intl";
import {
  Users,
  FileText,
  Receipt,
  CalendarClock,
  FileMinus,
  Banknote,
  Globe,
  ClipboardList,
  Truck,
} from "lucide-react";
import { ModuleHub } from "@/components/hub/module-hub";

export default function SalesHubPage() {
  const t = useTranslations("salesHub");

  const items = [
    {
      href: "/contacts?type=CUSTOMER",
      icon: Users,
      title: t("customers"),
      description: t("customersDesc"),
    },
    {
      href: "/accounting?tab=quotations",
      icon: ClipboardList,
      title: t("quotations"),
      description: t("quotationsDesc"),
    },
    {
      href: "/accounting?tab=sales",
      icon: FileText,
      title: t("invoices"),
      description: t("invoicesDesc"),
    },
    {
      href: "/delivery-notes",
      icon: Truck,
      title: t("deliveryNotes"),
      description: t("deliveryNotesDesc"),
    },
    {
      href: "/sales/receipts",
      icon: Receipt,
      title: t("receipts"),
      description: t("receiptsDesc"),
    },
    {
      href: "/sales/scheduled",
      icon: CalendarClock,
      title: t("scheduled"),
      description: t("scheduledDesc"),
    },
    {
      href: "/accounting?tab=creditNotes",
      icon: FileMinus,
      title: t("creditNotes"),
      description: t("creditNotesDesc"),
    },
    {
      href: "/sales/cash",
      icon: Banknote,
      title: t("cashInvoices"),
      description: t("cashInvoicesDesc"),
    },
    {
      href: "/reports/financial?tab=arAging",
      icon: Globe,
      title: t("aging"),
      description: t("agingDesc"),
    },
  ];

  return <ModuleHub title={t("title")} subtitle={t("subtitle")} items={items} />;
}
