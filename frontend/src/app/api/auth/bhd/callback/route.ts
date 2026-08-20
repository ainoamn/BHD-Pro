import { NextRequest } from "next/server";
import { proxyBhdAuth } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback — must run as a Next route (not only a rewrite) so
 * bhd_access / bhd_refresh Set-Cookie apply to the frontend host.
 */
export async function GET(req: NextRequest) {
  return proxyBhdAuth(req, "/api/auth/bhd/callback");
}
