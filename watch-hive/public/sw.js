/* WatchHive service worker — push, offline shell cache, background sync signal */

const CACHE_SHELL = "watchhive-shell-v4";
const SYNC_TAG = "watchhive-sync";

/** Same-origin paths precached for offline shell (layout + assets only). */
const SHELL_PATHS = new Set([
  "/offline.html",
  "/manifest.webmanifest",
  "/beengie/beengie-logo.png",
  /** Offline mascot (PNG); must be listed or img requests fail when offline. */
  "/beengie/no-wifi-beengie.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) =>
        Promise.all(
          [...SHELL_PATHS].map((path) =>
            cache.add(new Request(path, { cache: "reload" })).catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_SHELL && key.startsWith("watchhive-")) {
              return caches.delete(key);
            }
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline.html").then((cached) => {
          if (cached) return cached;
          return new Response(
            "<!DOCTYPE html><html><head><meta charset=utf-8><title>Offline</title></head><body><p>WatchHive needs a network connection.</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }),
      ),
    );
    return;
  }

  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "WATCHHIVE_SYNC" });
        });
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "WatchHive", body: "", url: "/" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/beengie/beengie-logo.png",
      badge: "/beengie/beengie-logo.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/profile/notifications";
  const targetUrl = raw.startsWith("http")
    ? raw
    : new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.focus();
          if (typeof c.navigate === "function") {
            return c.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
