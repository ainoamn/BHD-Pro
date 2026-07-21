import { Suspense } from "react";
import PayInvoiceContent from "./pay-content";
import { LoadingSpinner } from "@/components/ui/page-shell";

export default function PayInvoicePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PayInvoiceContent />
    </Suspense>
  );
}
