"use client";

import { useEffect } from "react";
import { installClientErrorReporting } from "@/lib/client-error-reporter";

/** Mount once under app shell to forward browser errors to the API. */
export function ClientErrorBeacon() {
  useEffect(() => installClientErrorReporting(), []);
  return null;
}
