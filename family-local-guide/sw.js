// Family Local Guide - Service Worker
const CACHE_VERSION = "v13";
const STATIC_CACHE = "family-guide-static-" + CACHE_VERSION;
const RUNTIME_CACHE = "family-guide-runtime-" + CACHE_VERSION;
const NOTIFY_CACHE = "family-guide-notify-v1"; // 通知フラグ用（既存互換）
const MONTH_NOTIFY_PREFIX = "notified-";

// ネットワークを待つ上限。これを超えたらキャッシュで即座に描画する
const NETWORK_TIMEOUT_MS = 2000;

// プリキャッシュ対象（オフライン起動に必要なコアアセット）
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css?v=11",
  "./script.js",
  "./manifest.json",
  "./data.json",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/char-bunny.webp",
  "./images/char-puppy.webp",
  "./images/char-star.webp",
  // 起動時に script.js の実行をブロックするCDN依存。キャッシュから返すことで
  // 2回目以降の起動はネットワークを一切待たない
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js",
  "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js",
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

  // data.json: Network-First（最新優先、遅ければキャッシュ）
  if (isDataJson) {
    event.respondWith(networkFirst(req));
    return;
  }

  // HTMLナビゲーション: Network-First（新しいindex.htmlを優先、遅ければキャッシュ）
  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // それ以外（JS/CSS/画像/外部CDN含む）: Cache-First + バックグラウンド更新
  event.respondWith(cacheFirst(req));
});

// STATIC → RUNTIME の順に探す。CDN資産はRUNTIMEに入るため両方見ないと
// キャッシュヒットせず毎回ネットワークから取り直しになる
async function matchAnyCache(request) {
  const opts = { ignoreVary: true };
  const staticCache = await caches.open(STATIC_CACHE);
  const hit = await staticCache.match(request, opts);
  if (hit) return { res: hit, cache: staticCache };
  const runtime = await caches.open(RUNTIME_CACHE);
  const runtimeHit = await runtime.match(request, opts);
  if (runtimeHit) return { res: runtimeHit, cache: runtime };
  return null;
}

async function cacheFirst(request) {
  const found = await matchAnyCache(request);
  if (found) {
    // バックグラウンドで更新（Stale-While-Revalidate）
    fetch(request)
      .then((res) => {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          found.cache.put(request, res.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return found.res;
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
    throw e;
  }
}

// ネットワーク優先だが NETWORK_TIMEOUT_MS を過ぎたらキャッシュで描画する。
// 電波が弱いとき（切断ではなく低速）に起動が固まるのを防ぐのが目的で、
// タイムアウト後もネットワーク応答が届けばキャッシュだけは更新しておく。
async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);

  const network = fetch(request).then((res) => {
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  });

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
    // 時間切れ → キャッシュがあれば即返す。無ければネットワークを待ち続ける
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    return await network;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    // HTMLならindex.htmlにフォールバック
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    throw e;
  } finally {
    clearTimeout(timer);
    network.catch(() => {}); // 未処理rejectionの抑止
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
