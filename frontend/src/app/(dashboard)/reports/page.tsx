"use client";

import { useTranslations } from "next-intl";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Receipt,
  BookOpen,
  Clock,
  Users,
  FileSpreadsheet,
} from "lucide-react";
import { ModuleHub } from "@/components/hub/module-hub";

export default function ReportsHubPage() {
  const t = useTranslations("reportsHub");

  const items = [
    {
      href: "/reports/financial",
      icon: BarChart3,
      title: t("financial"),
      description: t("financialDesc"),
    },
    {
      href: "/reports/sales",
      icon: TrendingUp,
      title: t("sales"),
      description: t("salesDesc"),
    },
    {
      href: "/reports/purchases",
      icon: TrendingDown,
      title: t("purchases"),
      description: t("purchasesDesc"),
    },
    {
      href: "/reports/vat",
      icon: Receipt,
      title: t("vat"),
      description: t("vatDesc"),
    },
    {
      href: "/reports/ledger",
      icon: BookOpen,
      title: t("ledger"),
      description: t("ledgerDesc"),
    },
    {
      href: "/reports/financial?tab=arAging",
      icon: Clock,
      title: t("arAging"),
      description: t("arAgingDesc"),
    },
    {
      href: "/reports/financial?tab=apAging",
      icon: Clock,
      title: t("apAging"),
      description: t("apAgingDesc"),
    },
    {
      href: "/reports/financial?tab=contactStatement",
      icon: Users,
      title: t("contactStatement"),
      description: t("contactStatementDesc"),
    },
    {
      href: "/reports/financial?tab=trialBalance",
      icon: FileSpreadsheet,
      title: t("trialBalance"),
      description: t("trialBalanceDesc"),
    },
  ];

  return <ModuleHub title={t("title")} subtitle={t("subtitle")} items={items} />;
}
