import { NextRequest, NextResponse } from "next/server";

/** Nest API base (Render in prod, local in dev). */
export function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    (process.env.VERCEL
      ? "https://hisaby-api.onrender.com"
      : "http://localhost:3001")
  ).replace(/\/$/, "");
}

/** Host-only cookies on the frontend origin — drop any upstream Domain=. */
function stripCookieDomain(setCookie: string): string {
  return setCookie
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^domain=/i.test(p))
    .join("; ");
}

function appendSetCookies(from: Headers, to: Headers) {
  const list =
    typeof from.getSetCookie === "function" ? from.getSetCookie() : [];
  if (list.length > 0) {
    for (const c of list) {
      to.append("set-cookie", stripCookieDomain(c));
    }
    return;
  }
  const single = from.get("set-cookie");
  if (single) {
    to.append("set-cookie", stripCookieDomain(single));
  }
}

/**
 * After SSO, portal often sends returnTo=/ — Hisaby product home is the dashboard.
 */
export function productHomePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/dashboard";
  return pathname;
}

function isSameSiteHost(a: string, b: string): boolean {
  return a.replace(/^www\./i, "").toLowerCase() === b.replace(/^www\./i, "").toLowerCase();
}

function resolveRedirect(location: string | null, req: NextRequest): string {
  const origin = req.nextUrl.origin;
  if (!location) return `${origin}/dashboard`;

  if (location.startsWith("/")) {
    const pathOnly = location.split("?")[0] || "/";
    const qs = location.includes("?")
      ? location.slice(location.indexOf("?"))
      : "";
    return `${origin}${productHomePath(pathOnly)}${qs}`;
  }

  try {
    const u = new URL(location);
    const frontendHost = new URL(origin).host;
    let backendHost = "";
    try {
      backendHost = new URL(backendBase()).host;
    } catch {
      /* ignore */
    }

    // Keep absolute redirects to Identity (id.bhd-om.com) and other externals.
    // Only rewrite when Nest pointed at the API host or our own frontend host.
    const onFrontend = isSameSiteHost(u.host, frontendHost);
    const onApi = backendHost && isSameSiteHost(u.host, backendHost);
    if (!onFrontend && !onApi) {
      return location;
    }

    const path = productHomePath(u.pathname || "/");
    return `${origin}${path}${u.search}${u.hash}`;
  } catch {
    return `${origin}/dashboard`;
  }
}

/**
 * Proxy BHD SSO endpoints through the Next origin so Set-Cookie lands on
 * hisaby.* (Vercel external rewrites alone often drop / mis-scope cookies).
 */
export async function proxyBhdAuth(
  req: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  const url = new URL(req.url);
  const target = `${backendBase()}${apiPath}${url.search}`;
  const host = req.headers.get("host") || url.host;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "") ||
    "https";

  const upstream = await fetch(target, {
    method: "GET",
    headers: {
      cookie: req.headers.get("cookie") || "",
      "user-agent": req.headers.get("user-agent") || "",
      accept: req.headers.get("accept") || "*/*",
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
    },
    redirect: "manual",
    cache: "no-store",
  });

  const status = upstream.status;
  const location = upstream.headers.get("location");

  if (status >= 300 && status < 400 && location) {
    const dest = resolveRedirect(location, req);
    const res = NextResponse.redirect(
      dest,
      status as 301 | 302 | 303 | 307 | 308,
    );
    appendSetCookies(upstream.headers, res.headers);
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, { status });
  const ct = upstream.headers.get("content-type");
  if (ct) res.headers.set("content-type", ct);
  appendSetCookies(upstream.headers, res.headers);
  res.headers.set("cache-control", "no-store");
  return res;
}
