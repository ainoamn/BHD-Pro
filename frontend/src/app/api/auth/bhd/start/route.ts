import { NextRequest } from "next/server";
import { proxyBhdAuth } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Begin BHD Identity SSO — proxies Nest and forwards oauth state cookie. */
export async function GET(req: NextRequest) {
  return proxyBhdAuth(req, "/api/auth/bhd/start");
}
