/* Nosca service worker — push, and the shell for when there is no
 * network.
 *
 * THE NETWORK FIRST, ALWAYS, WHEN THERE IS ONE. Every navigation goes
 * to Netlify; the copy kept here answers only when that fails. That is
 * the whole difference from the app-shell caching this file used to
 * refuse: a cached shell served instead of the network made a deploy
 * appear to do nothing, which is the failure CLAUDE.md warns about. A
 * cached shell served only when the network is gone is what lets a
 * downloaded lesson open on a plane. /version.json is never cached, so
 * the app's own check against the server keeps working, and the hashed
 * files under /assets/ are immutable, so a cached one is never wrong.
 *
 * The list of this build's files is /precache.json, written by the
 * build. It is read on install and again whenever the app says
 * "nosca:precache" on opening; a build already kept is left alone, and
 * older builds' caches are dropped.
 */
const SHELL_PREFIX = "nosca-shell-";

async function precache() {
  let manifest;
  try {
    const r = await fetch("/precache.json", { cache: "no-store" });
    if (!r.ok) return;
    manifest = await r.json();
  } catch { return; }
  const name = SHELL_PREFIX + (manifest.built || "0");
  if (!(await caches.has(name))) {
    const c = await caches.open(name);
    await Promise.all((manifest.files || []).map(async (f) => {
      try {
        const res = await fetch(f, { cache: "no-store" });
        if (res && res.ok) await c.put(f, res);
      } catch { /* a file that will not fetch is left out; the fallback is best effort */ }
    }));
  }
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(SHELL_PREFIX) && k !== name).map((k) => caches.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const d = (event && event.data) || {};
  if (d.type === "nosca:precache" && event.waitUntil) event.waitUntil(precache());
});

const offlinePage = () => new Response(
  "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\">" +
  "<title>Nosca</title><body style=\"font:16px -apple-system,system-ui,sans-serif;padding:14vh 8vw;color:#123C30\">" +
  "<p>Nosca needs a connection.</p><p style=\"color:#7A8580\">Try again when you are back online.</p>",
  { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 }
);

/* what is kept: the shell of the current build, or any build still cached */
const fromShell = async (req) => {
  const hit = await caches.match(req);
  if (hit) return hit;
  return null;
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  /* a navigation: the network, and the kept shell only when it fails */
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await fromShell("/index.html")) || (await fromShell("/")) || offlinePage()));
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* the build's hashed files: the copy first — it cannot be stale —
     and the network fills the current build's cache when one is missing */
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const hit = await fromShell(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) {
        try {
          const keys = await caches.keys();
          const k = keys.find((x) => x.startsWith(SHELL_PREFIX));
          if (k) { const c = await caches.open(k); await c.put(req, res.clone()); }
        } catch { /* fine */ }
      }
      return res;
    })());
    return;
  }
  /* icons and the manifest: the network, the copy when it fails */
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(fetch(req).catch(async () => (await fromShell(req)) || Response.error()));
  }
  /* everything else — /version.json, /precache.json, the functions,
     Supabase — is the network and only the network */
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
