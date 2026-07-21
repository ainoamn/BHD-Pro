import { Suspense } from "react";
import PaySuccessContent from "./success-content";
import { LoadingSpinner } from "@/components/ui/page-shell";

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PaySuccessContent />
    </Suspense>
  );
}
