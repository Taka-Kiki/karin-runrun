// 今日なに？ - Service Worker
const CACHE_VERSION = "v2";
const STATIC_CACHE = "kyou-nani-static-" + CACHE_VERSION;
const RUNTIME_CACHE = "kyou-nani-runtime-" + CACHE_VERSION;

// プリキャッシュ対象（オフライン起動に必要なコアアセット）
// クエリ文字列は index.html の参照と完全一致させること
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css?v=7",
  "./script.js?v=7",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./images/header.png",
  "./images/icon-32.png",
  "./images/icon-180.png",
  "./images/icon-192.png",
  "./images/icon-512.png",
];

// ===== Install: プリキャッシュ =====
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

// ===== Activate: 古いキャッシュを削除 =====
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

// ===== Fetch: キャッシュ戦略 =====
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Firebase RealtimeDB など動的APIはSWで扱わない
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasedatabase.app") ||
    (url.hostname.includes("googleapis.com") && url.pathname.includes("/v1/"))
  ) {
    return;
  }

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  // HTMLナビゲーション: Network-First（新しいindex.htmlを優先）
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // それ以外（JS/CSS/画像/Firebase SDK等のCDN）: Cache-First + バックグラウンド更新
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) {
    // バックグラウンドで更新（Stale-While-Revalidate）
    fetch(request)
      .then((res) => {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          cache.put(request, res.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }
  // キャッシュなし → ネットワーク取得しつつ保存
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

// ===== メッセージ受信 =====
self.addEventListener("message", (event) => {
  if (event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});
