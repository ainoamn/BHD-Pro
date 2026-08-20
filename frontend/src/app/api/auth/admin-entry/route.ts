import { NextRequest } from "next/server";
import { proxyBhdAuth } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Platform /admin entry via BHD SSO (never local password). */
export async function GET(req: NextRequest) {
  return proxyBhdAuth(req, "/api/auth/admin-entry");
}
