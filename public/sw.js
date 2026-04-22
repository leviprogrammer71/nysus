/* Nysus service worker.
 *
 * Two jobs:
 *   1. Install shell — a minimal offline fallback so the app icon
 *      launches even with no network (the actual pages still need a
 *      connection; this just avoids Chrome's scary offline page).
 *   2. Web push — receive a notification payload and surface it.
 *
 * Keep this file plain ES modules — Next's router bundles don't touch
 * service workers, and we need to be able to drop it into a fresh
 * browser without a build step.
 */

const CACHE = "nysus-shell-v1";
const OFFLINE_URLS = ["/", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass everything through. We only cache the shell for offline
  // fallback; real requests go to the network so the PWA behaves
  // like the web app.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/")),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Nysus", body: "Something happened." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const { title, body, url, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag ?? "nysus",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: url ?? "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if ("focus" in c && c.url.endsWith(target)) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
