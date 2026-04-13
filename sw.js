// みえるんタイマー - Service Worker
const CACHE_VERSION = "v1";
const STATIC_CACHE = "miern-timer-static-" + CACHE_VERSION;
const RUNTIME_CACHE = "miern-timer-runtime-" + CACHE_VERSION;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./i18n.js",
  "./audio.js",
  "./timer-circle.js",
  "./timer-hourglass.js",
  "./timer-feeding.js",
  "./timer-battle.js",
  "./timer-adventure.js",
  "./wakuwaku-manager.js",
  "./rewards.js",
  "./manifest.json",
  "./favicon.svg",
  "./images/icon-192.png",
  "./images/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) {
    fetch(request)
      .then((res) => {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          cache.put(request, res.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (
      res &&
      res.ok &&
      (res.type === "basic" || res.type === "cors" || res.type === "opaque")
    ) {
      const runtime = await caches.open(RUNTIME_CACHE);
      runtime.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const runtime = await caches.open(RUNTIME_CACHE);
    const runtimeCached = await runtime.match(request);
    if (runtimeCached) return runtimeCached;
    throw e;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    throw e;
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});
