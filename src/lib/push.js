/* Web push — the browser half.
 *
 * In-app notifications work without any of this: the `notifications`
 * table is read by the app directly. Push is additive — it lets a
 * phone hear about a new row while Nosca is closed. The chain is:
 *
 *   database trigger inserts into notifications
 *     → Supabase Database Webhook POSTs to netlify/functions/push.mjs
 *       → web-push sends to every row in push_subscriptions for that user
 *         → public/sw.js shows the notification
 *
 * This module owns the subscription: asking permission, subscribing
 * the browser with the site's VAPID public key, and keeping the
 * `push_subscriptions` row in step. Every function is safe to call
 * anywhere — nothing here throws, and every browser API is checked
 * before it is touched, so an old Safari or a build without a key just
 * gets a plain answer instead of a crash.
 */

const SW_URL = "/sw.js";

function vapidKey() {
  try {
    return (import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY) || "";
  } catch {
    return "";
  }
}

function hasWindow() {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

function isIos() {
  if (!hasWindow()) return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reports itself as a Mac; the touch points give it away.
  return navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
}

function isStandalone() {
  if (!hasWindow()) return false;
  try {
    if (navigator.standalone === true) return true;
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch { /* fine */ }
  return false;
}

/* "unsupported"     — this browser cannot do web push at all
 * "ios-home-screen" — iPhone/iPad in the browser: web push only works
 *                     once Nosca is added to the Home Screen
 * "denied"          — the person said no, or the site is blocked
 * "granted"         — permission already given
 * "default"         — not asked yet
 */
export function pushSupport() {
  if (!hasWindow()) return "unsupported";
  /* No key in the build means no push, whatever the browser can do.
     Saying so here keeps the prompt and the switch from promising
     something that cannot happen — and from burning their one ask on
     a configuration problem the person cannot fix. */
  if (!vapidKey()) return "unsupported";
  if (isIos() && !isStandalone()) return "ios-home-screen";
  const hasSw = "serviceWorker" in navigator;
  const hasPush = typeof window.PushManager !== "undefined";
  const hasNotif = typeof window.Notification !== "undefined";
  if (!hasSw || !hasPush || !hasNotif) return "unsupported";
  let permission = "default";
  try { permission = window.Notification.permission; } catch { permission = "default"; }
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  return "default";
}

let registration = null;

/* Registers /sw.js once; later calls return the same registration. */
export async function registerSw() {
  if (!hasWindow() || !("serviceWorker" in navigator)) return null;
  if (!registration) {
    registration = navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .catch(() => {
        registration = null;
        return null;
      });
  }
  return registration;
}

/* pushManager.subscribe needs an active worker; on a first visit the
   one we just registered is still installing. `serviceWorker.ready`
   never resolves if registration failed, so wait on the worker itself,
   and give up after a moment rather than hang the caller. */
function whenActive(reg, ms = 10000) {
  return new Promise((resolve) => {
    if (!reg) return resolve(false);
    if (reg.active) return resolve(true);
    const worker = reg.installing || reg.waiting;
    if (!worker) return resolve(false);
    const timer = setTimeout(() => resolve(!!reg.active), ms);
    const onChange = () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        worker.removeEventListener("statechange", onChange);
        resolve(true);
      } else if (worker.state === "redundant") {
        clearTimeout(timer);
        worker.removeEventListener("statechange", onChange);
        resolve(!!reg.active);
      }
    };
    worker.addEventListener("statechange", onChange);
  });
}

/* Old Safari takes a callback; everyone else returns a promise. */
function requestPermission() {
  return new Promise((resolve) => {
    try {
      const result = window.Notification.requestPermission((value) => resolve(value));
      if (result && typeof result.then === "function") result.then(resolve, () => resolve("denied"));
    } catch {
      resolve("denied");
    }
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(subscription, keyBytes) {
  try {
    const current = subscription && subscription.options && subscription.options.applicationServerKey;
    if (!current) return true; // nothing to compare against; keep what we have
    const a = new Uint8Array(current);
    if (a.length !== keyBytes.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== keyBytes[i]) return false;
    return true;
  } catch {
    return true;
  }
}

function reasonFor(err) {
  const name = err && err.name;
  const message = (err && err.message) || "";
  if (name === "NotAllowedError") return "Permission declined";
  if (name === "AbortError") return "The browser's push service didn't answer — try again in a moment";
  if (name === "InvalidStateError") return "This browser already holds a subscription for a different key — turn notifications off and on again";
  if (name === "SecurityError") return "Notifications need a secure (https) address";
  return message ? `Couldn't turn notifications on (${message})` : "Couldn't turn notifications on";
}

function rowFor(subscription, userId) {
  const json = typeof subscription.toJSON === "function" ? subscription.toJSON() : {};
  const keys = (json && json.keys) || {};
  return {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh || "",
    auth: keys.auth || "",
    ua: hasWindow() ? navigator.userAgent : null,
  };
}

async function saveRow(supabase, row) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" })
    .select();
  if (error) return { ok: false, reason: error.message || "The subscription wasn't saved" };
  // An update blocked by RLS returns success with zero rows.
  if (!data || data.length === 0) return { ok: false, reason: "The subscription wasn't saved" };
  return { ok: true };
}

/* Asks for permission if needed, subscribes this browser, and records
   the subscription against the signed-in person. Returns
   { ok: true } or { ok: false, reason } — never throws. */
export async function subscribePush(supabase, userId) {
  try {
    const support = pushSupport();
    if (support === "unsupported") return { ok: false, reason: "This browser can't receive notifications" };
    if (support === "ios-home-screen") {
      return { ok: false, reason: "On iPhone and iPad, add Nosca to your Home Screen first (Share → Add to Home Screen), then turn notifications on from there" };
    }
    if (support === "denied") return { ok: false, reason: "Notifications are blocked for this site in your browser settings" };
    if (!supabase) return { ok: false, reason: "Not connected" };
    if (!userId) return { ok: false, reason: "Not signed in" };

    const key = vapidKey();
    if (!key) return { ok: false, reason: "No VAPID key configured" };
    let keyBytes;
    try { keyBytes = urlBase64ToUint8Array(key); } catch { return { ok: false, reason: "The VAPID key is not valid" }; }

    /* PERMISSION FIRST. Safari ties the prompt to a live user gesture,
       and registering plus waiting for the worker can take longer than
       that window lasts — the ask was being refused before it appeared.
       Nothing below depends on the order. */
    let permission = window.Notification.permission;
    if (permission === "default") permission = await requestPermission();
    if (permission !== "granted") return { ok: false, reason: "Permission declined" };

    const reg = await registerSw();
    if (!reg) return { ok: false, reason: "Couldn't start the service worker" };
    if (!(await whenActive(reg))) return { ok: false, reason: "The service worker didn't start — reload and try again" };
    if (!reg.pushManager) return { ok: false, reason: "This browser can't receive notifications" };

    let subscription = await reg.pushManager.getSubscription();
    if (subscription && !sameKey(subscription, keyBytes)) {
      // The site's key changed since this browser subscribed; start over.
      try { await subscription.unsubscribe(); } catch { /* fine */ }
      subscription = null;
    }
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
    }

    let saved = await saveRow(supabase, rowFor(subscription, userId));
    if (!saved.ok) {
      // A shared phone: this endpoint already belongs to another account
      // and RLS won't let us take it over. A fresh subscription has a
      // fresh endpoint; the old row dies when its endpoint goes 410.
      try { await subscription.unsubscribe(); } catch { /* fine */ }
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      saved = await saveRow(supabase, rowFor(subscription, userId));
      if (!saved.ok) return saved;
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: reasonFor(err) };
  }
}

/* THE ROW AND THE BROWSER DRIFT APART: a 410 prunes the row, an account
   is deleted and takes its rows with it, a phone changes hands, an
   endpoint rotates. Called on every open where permission is already
   granted, this puts them back in step without asking anyone anything.
   It never registers or subscribes — it only re-files a subscription
   the browser already holds. */
export async function syncSubscription(supabase, userId) {
  try {
    if (!supabase || !userId) return { ok: false, reason: "Not signed in" };
    if (pushSupport() !== "granted") return { ok: false, reason: "Not granted" };
    const subscription = await currentSubscription();
    if (!subscription) return { ok: false, reason: "No subscription on this device" };
    return await saveRow(supabase, rowFor(subscription, userId));
  } catch (err) {
    return { ok: false, reason: reasonFor(err) };
  }
}

/* Drops this browser's subscription and its row. Safe to call when
   there is nothing to drop. */
export async function unsubscribePush(supabase) {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    try { await subscription.unsubscribe(); } catch { /* the row still goes */ }
    if (supabase && endpoint) {
      const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      if (error) return { ok: false, reason: error.message || "The subscription wasn't removed" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err && err.message) || "Couldn't turn notifications off" };
  }
}

/* The PushSubscription this browser holds for Nosca, or null. */
export async function currentSubscription() {
  try {
    if (!hasWindow() || !("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg || !reg.pushManager) return null;
    return (await reg.pushManager.getSubscription()) || null;
  } catch {
    return null;
  }
}
