// Family Local Guide - Service Worker
const CACHE_NAME = "family-guide-notify-v1";
const MONTH_NOTIFY_PREFIX = "notified-";

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
  const cache = await caches.open(CACHE_NAME);
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

// ===== Install & Activate =====
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
