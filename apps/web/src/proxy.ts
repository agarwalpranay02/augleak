import { NextResponse, type NextRequest } from "next/server";

/**
 * Builds a strict, nonce-based Content-Security-Policy for every HTML request.
 * - 'strict-dynamic' + nonce: only scripts Next.js renders (or that they load) run.
 * - connect-src is our own origin: images being audited never leave the page.
 * - worker-src 'self' blob: the audit runs in module Web Workers.
 */
function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", "https://lh3.googleusercontent.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'none'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
    "report-uri": ["/api/csp-report"],
  };
  if (!dev) directives["upgrade-insecure-requests"] = [];
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  // Next.js reads the nonce from the request's CSP header during rendering.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next|_vercel|demo|registry|research|opengraph-image|robots.txt|sitemap.xml|sw.js|manifest.webmanifest|icons|.*\\..*).*)",
    },
  ],
};
