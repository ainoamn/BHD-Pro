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

/**
 * After SSO, portal often sends returnTo=/ — Hisaby product home is the dashboard.
 * Do not remap /login (error surfaces) or other app paths.
 */
export function productHomePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/dashboard";
  return pathname;
}

function isSameSiteHost(a: string, b: string): boolean {
  return (
    a.replace(/^www\./i, "").toLowerCase() ===
    b.replace(/^www\./i, "").toLowerCase()
  );
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

function collectSetCookieHeaders(from: Headers): string[] {
  if (typeof from.getSetCookie === "function") {
    const list = from.getSetCookie();
    if (list.length) return list;
  }
  const single = from.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Apply upstream Set-Cookie via Next cookies API (reliable on Vercel).
 * Decode once so Next does not double-encode Express values.
 */
function applyUpstreamCookies(res: NextResponse, from: Headers) {
  const secureDefault =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  for (const raw of collectSetCookieHeaders(from)) {
    const segments = raw.split(";").map((s) => s.trim()).filter(Boolean);
    if (!segments.length) continue;

    const first = segments[0];
    const eq = first.indexOf("=");
    if (eq <= 0) continue;

    const name = first.slice(0, eq).trim();
    let value = first.slice(eq + 1).trim();
    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      try {
        value = decodeURIComponent(value);
      } catch {
        /* keep raw */
      }
    }

    const options: {
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      maxAge?: number;
      sameSite?: "lax" | "strict" | "none";
    } = { path: "/" };
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      const iEq = seg.indexOf("=");
      const key = (iEq === -1 ? seg : seg.slice(0, iEq)).trim().toLowerCase();
      const val = iEq === -1 ? undefined : seg.slice(iEq + 1).trim();
      if (key === "httponly") options.httpOnly = true;
      else if (key === "secure") options.secure = true;
      else if (key === "path" && val) options.path = val;
      else if (key === "max-age" && val) options.maxAge = Number(val);
      else if (key === "expires" && val && options.maxAge == null) {
        const t = Date.parse(val);
        if (!Number.isNaN(t)) {
          options.maxAge = Math.max(0, Math.floor((t - Date.now()) / 1000));
        }
      } else if (key === "samesite" && val) {
        const s = val.toLowerCase();
        if (s === "lax" || s === "strict" || s === "none") {
          options.sameSite = s;
        }
      }
      // never copy Domain — cookies must be host-only on the frontend
    }

    if (secureDefault) options.secure = true;
    if (!options.sameSite) options.sameSite = "lax";

    res.cookies.set(name, value, options);
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
    applyUpstreamCookies(res, upstream.headers);
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, { status });
  const ct = upstream.headers.get("content-type");
  if (ct) res.headers.set("content-type", ct);
  applyUpstreamCookies(res, upstream.headers);
  res.headers.set("cache-control", "no-store");
  return res;
}
