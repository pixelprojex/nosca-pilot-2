/* Nosca service worker — push only.
 *
 * Deliberately no app-shell caching: Netlify serves the app, and a
 * stale cached shell is worse than none (a fix would appear to do
 * nothing, which is exactly the failure CLAUDE.md warns about). This
 * file exists so the browser can receive a push while the app is
 * closed and land the person on the right screen when they tap it.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* The Netlify function sends JSON { title, body, data }. `data` may
   carry { screen, id } — where a tap should land. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try { payload = { title: "Nosca", body: event.data ? event.data.text() : "" }; } catch { payload = {}; }
  }
  if (!payload || typeof payload !== "object") payload = {};

  const title = payload.title || "Nosca";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* Tap: bring an open Nosca to the front, or open one. When the
   notification names a screen, a fresh window opens with ?open=<screen>
   so the app can go straight there; an already-open window is told the
   same thing by message rather than reloaded, so nothing in progress is
   lost. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const screen = typeof data.screen === "string" && data.screen ? data.screen : null;
  const target = screen ? "/?open=" + encodeURIComponent(screen) : "/";

  event.waitUntil((async () => {
    const origin = self.location.origin;
    let clients = [];
    try {
      clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    } catch { clients = []; }

    const existing = clients.find((c) => typeof c.url === "string" && c.url.indexOf(origin) === 0);
    if (existing) {
      try { if ("focus" in existing) await existing.focus(); } catch { /* fine */ }
      try { existing.postMessage({ type: "nosca:open", screen, data }); } catch { /* fine */ }
      return;
    }
    if (self.clients.openWindow) {
      try { await self.clients.openWindow(target); } catch { /* fine */ }
    }
  })());
});
