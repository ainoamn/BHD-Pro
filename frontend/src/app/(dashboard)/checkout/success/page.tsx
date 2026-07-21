import { Suspense } from "react";
import CheckoutSuccessContent from "./success-content";
import { LoadingSpinner } from "@/components/ui/page-shell";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
