import { NextRequest } from "next/server";
import { proxyBhdAuth } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clear Hisaby session cookies then redirect to BHD end-session. */
export async function GET(req: NextRequest) {
  return proxyBhdAuth(req, "/api/auth/bhd/logout");
}
