// PBL service worker — cache-first for static assets, network-first for HTML.
const CACHE = "pbl-v1";
const STATIC_EXTS = [".js", ".css", ".woff2", ".png", ".svg", ".ico", ".webp"];

function isStaticAsset(url) {
  return STATIC_EXTS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Skip cross-origin requests (Firebase, Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    // Cache-first for immutable static assets
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }),
    );
  } else {
    // Network-first for HTML pages — fall back to cache when offline
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request)),
    );
  }
});

// Show push notification when app is in the background.
// FCM-specific background handler lives in firebase-messaging-sw.js;
// this handles any other push events.
self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const { title, body, icon, data } = e.data.json();
    e.waitUntil(
      self.registration.showNotification(title ?? "PBL", {
        body,
        icon: icon ?? "/favicon.ico",
        badge: "/favicon.ico",
        data,
      }),
    );
  } catch { /* ignore malformed payloads */ }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.href ?? "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url === url && "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
