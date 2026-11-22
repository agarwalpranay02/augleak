/* AugLeak service worker: the audit works offline once its page and scripts are cached. */
const VERSION = "augleak-v2";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE_PAGES = ["/offline", "/audit", "/inspect"];

async function precache() {
  const pages = await caches.open(PAGES);
  const stat = await caches.open(STATIC);
  await Promise.all(PRECACHE_PAGES.map((u) => pages.add(new Request(u, { cache: "reload" })).catch(() => {})));
  try {
    const html = (await Promise.all(PRECACHE_PAGES.map(async (u) => (await pages.match(u))?.text() ?? ""))).join("\n");
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
    await Promise.all(assets.map((u) => stat.add(u).catch(() => {})));
  } catch {
    /* offline during install: pages are cached as they are visited instead */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/demo/") ||
  url.pathname.startsWith("/registry/") ||
  url.pathname.startsWith("/research/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(woff2|svg|png|jpg|webp)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Never answer worker scripts from the cache: the bundler's worker bootstrap reads its config from the URL fragment,
  // and a cached response would carry the fragment of whichever worker was cached first.
  if (req.destination === "worker" || req.destination === "sharedworker" || url.pathname.includes("turbopack-worker")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
          if (hit) return hit;
          return (await cache.match("/offline")) || Response.error();
        })
    );
  }
});
