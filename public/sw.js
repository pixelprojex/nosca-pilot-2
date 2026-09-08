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

/* Chrome will not offer "Install" without a fetch handler. This one
   caches NOTHING — it passes navigations straight to the network and,
   only when that fails, answers with a line of text. A cached shell
   would make a deploy appear to do nothing, which is the failure
   CLAUDE.md warns about. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(() =>
      new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\">" +
        "<title>Nosca</title><body style=\"font:16px -apple-system,system-ui,sans-serif;padding:14vh 8vw;color:#12211C\">" +
        "<p>Nosca needs a connection.</p><p style=\"color:#7A8580\">Try again when you are back online.</p>",
        { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 }
      )
    )
  );
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
  const data = payload.data || {};
  /* ONE PER THING, NOT ONE PER EVENT. A tag makes a new notification
     replace the last one carrying the same tag, which is how every
     other app behaves: three messages from the same coach are one
     line on the lock screen, and a booking that is made, confirmed
     and then called off does not leave three contradictory
     notifications sitting there. The tag is the screen and the id the
     notification already carries — a thread per person, a booking per
     booking — so anything genuinely separate still arrives separately.
     `renotify` keeps the buzz: replaced, not silenced. */
  const tag = data.screen ? `${data.screen}:${data.id == null ? "" : data.id}` : "nosca";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag,
    renotify: true,
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* THE BROWSER CHANGES ITS MIND. A push service may retire a
   subscription without anyone asking — a key rotation, a long silence,
   a reinstall — and the row in push_subscriptions becomes a dead
   address. The app repairs this the next time Nosca is opened, but the
   whole point of push is the times it is closed, so re-subscribe here
   and post the new address to the relay.

   The old subscription's `auth` secret goes with it: that is what
   proves the request came from this device, since there is no session
   in a service worker. Everything is best effort — a browser that
   gives us no `oldSubscription` simply waits for the app to be opened,
   which is where it started. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const was = event.oldSubscription || null;
    if (!was || !was.endpoint) return;

    let fresh = event.newSubscription || null;
    if (!fresh) {
      let key = null;
      try { key = was.options && was.options.applicationServerKey; } catch { key = null; }
      if (!key || !self.registration || !self.registration.pushManager) return;
      try {
        fresh = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      } catch { return; }
    }

    const before = typeof was.toJSON === "function" ? was.toJSON() : null;
    const after = fresh && typeof fresh.toJSON === "function" ? fresh.toJSON() : null;
    if (!before || !after || !before.keys || !after.keys || !before.keys.auth) return;

    try {
      await fetch("/.netlify/functions/resub", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          old: { endpoint: was.endpoint, auth: before.keys.auth },
          new: { endpoint: fresh.endpoint, p256dh: after.keys.p256dh, auth: after.keys.auth },
        }),
      });
    } catch { /* the app will put it right when it is next opened */ }
  })());
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
  /* carry the id too: "a lesson was logged" has to land on THAT lesson,
     not on the lessons tab */
  const id = data && data.id != null ? String(data.id) : null;
  const target = screen
    ? "/?open=" + encodeURIComponent(screen) + (id ? "&oid=" + encodeURIComponent(id) : "")
    : "/";

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
