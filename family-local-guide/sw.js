// Family Local Guide - Service Worker
const CACHE_VERSION = "v2";
const STATIC_CACHE = "family-guide-static-" + CACHE_VERSION;
const RUNTIME_CACHE = "family-guide-runtime-" + CACHE_VERSION;
const NOTIFY_CACHE = "family-guide-notify-v1"; // 通知フラグ用（既存互換）
const MONTH_NOTIFY_PREFIX = "notified-";

// プリキャッシュ対象（オフライン起動に必要なコアアセット）
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css?v=9",
  "./script.js",
  "./manifest.json",
  "./data.json",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/char-bunny.webp",
  "./images/char-puppy.webp",
  "./images/char-star.webp",
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
            if (
              key !== STATIC_CACHE &&
              key !== RUNTIME_CACHE &&
              key !== NOTIFY_CACHE
            ) {
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

  // GET以外はスキップ
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Firebase RealtimeDB など動的APIはSWで扱わない
  if (url.hostname.includes("firebaseio.com") || url.hostname.includes("googleapis.com") && url.pathname.includes("/v1/")) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const isDataJson = isSameOrigin && url.pathname.endsWith("/data.json");
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  // data.json: Network-First（最新優先、失敗時キャッシュ）
  if (isDataJson) {
    event.respondWith(networkFirst(req));
    return;
  }

  // HTMLナビゲーション: Network-First（新しいindex.htmlを優先）
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // それ以外（JS/CSS/画像/外部CDN含む）: Cache-First + バックグラウンド更新
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
    if (res && res.ok && (res.type === "basic" || res.type === "cors" || res.type === "opaque")) {
      const runtime = await caches.open(RUNTIME_CACHE);
      runtime.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    // 最後のフォールバック
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
    // HTMLならindex.htmlにフォールバック
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    throw e;
  }
}

// ===== Periodic Background Sync =====
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "monthly-calendar-check") {
    event.waitUntil(checkAndNotifyMonthly());
  }
});

async function checkAndNotifyMonthly() {
  const now = new Date();
  const day = now.getDate();
  // 月初5日以内のみ通知
  if (day > 5) return;

  const key = MONTH_NOTIFY_PREFIX + now.getFullYear() + "-" + now.getMonth();
  const cache = await caches.open(NOTIFY_CACHE);
  const cached = await cache.match(new Request(key));
  if (cached) return; // 今月はすでに通知済み

  // 子どもデータを IndexedDB 経由で取得を試みる（なければ汎用メッセージ）
  let body = "今月の予定・やることを確認しましょう！";
  try {
    const childrenJson = await getFromIDB("familyGuide_children");
    if (childrenJson) {
      const children = JSON.parse(childrenJson);
      const names = children.map((c) => c.name || "ベビー").join("・");
      if (names) {
        body = `${names}の今月の予定を確認しましょう！`;
      }
    }
  } catch (e) {
    // fallback to generic message
  }

  await self.registration.showNotification("Family Local Guide", {
    body,
    icon: "./images/icon-192.png",
    badge: "./images/icon-192.png",
    tag: "monthly-calendar",
    data: { url: "./index.html" },
  });

  // 今月通知済みフラグを保存
  await cache.put(new Request(key), new Response("1"));
}

// ===== Notification Click =====
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "./index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // 既に開いているタブがあればフォーカス
      for (const client of windowClients) {
        if (client.url.includes("index.html") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ===== IndexedDB Helper (子どもデータ取得用) =====
function getFromIDB(key) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("familyGuideNotify", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction("kv", "readonly");
        const store = tx.objectStore("kv");
        const get = store.get(key);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

function putToIDB(key, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("familyGuideNotify", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

// ===== メッセージ受信（メインスレッドからデータ同期） =====
self.addEventListener("message", (event) => {
  if (event.data?.type === "sync-children") {
    putToIDB("familyGuide_children", event.data.payload);
  }
  if (event.data?.type === "skip-waiting") {
    self.skipWaiting();
  }
});
