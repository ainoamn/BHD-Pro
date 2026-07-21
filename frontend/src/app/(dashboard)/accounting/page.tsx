import { Suspense } from "react";
import { AccountingModule } from "@/components/accounting/accounting-module";
import { LoadingSpinner } from "@/components/ui/page-shell";

export default function AccountingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AccountingModule />
    </Suspense>
  );
}
