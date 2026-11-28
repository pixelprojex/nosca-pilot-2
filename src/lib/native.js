/* THE NATIVE SHELL — the same app, carried into the App Store and Google
 * Play by Capacitor (capacitor.config.json, ios/, android/; how it is
 * built and shipped is docs/native/README.md).
 *
 * Inside the shell the page is this very bundle, served from the phone
 * (capacitor://localhost on an iPhone, https://localhost on Android), and
 * the native side puts `window.Capacitor` in the page before anything
 * runs. Everything here is behind isNative(): in a browser tab, or on a
 * Home Screen, not one line of it runs, no plugin is fetched, and the app
 * does exactly what it did. Every plugin is a dynamic import, so the web
 * bundle never loads one.
 *
 * What the shell changes, and nothing else:
 *   haptics      the phone's own engine (Haptics) in place of the switch trick
 *   status bar   light words over a dark ground, dark over the white app —
 *                read off whatever is drawn under it (watchScreen)
 *   launch       the native launch screen (the brand ground and the mark)
 *                stays until the app has drawn something that is not the
 *                white loader, then fades — no white flash between them
 *   share        files and codes go out through the phone's share sheet
 *   links        the website opens in the phone's browser; a link handed to
 *                someone else carries the app's public address, never
 *                localhost
 *   back         Android's back is the app's own Back
 *   push         a device token (APNs, FCM) stored the way a web
 *                subscription is (lib/push.js), and a tapped notification
 *                landing where the web one does
 * Never a service worker, an install guide or the signpost's hop
 * (lib/push.js, lib/install.js, index.html).
 */

/* The app's public address: what an invite, a password reset and About
   Nosca point at from inside the shell. The same name as APP_HOST in
   scripts/public-settings.mjs, and the signpost's in index.html and
   netlify/functions/lib/signpost.mjs — a real domain changes all of them. */
export const PUBLIC_ORIGIN = "https://nosca.netlify.app";

const cap = () => (typeof window !== "undefined" ? window.Capacitor : null) || null;

export function isNative() {
  try {
    const c = cap();
    return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform());
  } catch (e) { return false; }
}

/* "ios" | "android" inside the shell, null anywhere else */
export function nativePlatform() {
  if (!isNative()) return null;
  try { const p = cap().getPlatform(); return p === "ios" || p === "android" ? p : null; } catch (e) { return null; }
}

/* the address a link handed to someone else carries */
export const publicOrigin = () => (isNative() ? PUBLIC_ORIGIN : (typeof window !== "undefined" ? window.location.origin : ""));

/* ---------- the plugins, fetched only inside the shell ---------- */
const IMPORTS = {
  core: () => import("@capacitor/core"),
  app: () => import("@capacitor/app"),
  browser: () => import("@capacitor/browser"),
  filesystem: () => import("@capacitor/filesystem"),
  haptics: () => import("@capacitor/haptics"),
  push: () => import("@capacitor/push-notifications"),
  share: () => import("@capacitor/share"),
  splash: () => import("@capacitor/splash-screen"),
};
const asked = {};
const ready = {};
const use = (name) => {
  if (!isNative()) return Promise.resolve(null);
  if (!asked[name]) asked[name] = IMPORTS[name]().then((m) => (ready[name] = m)).catch(() => null);
  return asked[name];
};

/* ---------- haptics ---------- */
/* The web's haptics are vibrate() on Android and a hidden switch on an
   iPhone (Nosca.jsx, HAPTICS). Inside the shell the phone's own engine
   answers instead: a tap by its length, a success and a warning as the
   system's own notification patterns, a commitment as a firmer tap.
   True when the shell took it, so the web path is skipped. Haptics need
   no gesture natively, so a beat that waits for the plugin to load is
   still felt. */
export function nativeHaptic(kind, ms = 8) {
  if (!isNative()) return false;
  const fire = (m) => {
    if (!m) return;
    const { Haptics, ImpactStyle, NotificationType } = m;
    try {
      if (kind === "success") Haptics.notification({ type: NotificationType.Success });
      else if (kind === "warning") Haptics.notification({ type: NotificationType.Warning });
      else if (kind === "commit") Haptics.impact({ style: ImpactStyle.Medium });
      else Haptics.impact({ style: ms >= 14 ? ImpactStyle.Heavy : ms >= 10 ? ImpactStyle.Medium : ImpactStyle.Light });
    } catch (e) { /* a haptic is never worth an error */ }
  };
  if (ready.haptics) fire(ready.haptics); else use("haptics").then(fire);
  return true;
}

/* ---------- links ---------- */
/* The website, a help page: the phone's browser over the app, with its
   own way back. A mailto:, sms: or WhatsApp link needs nothing — the
   shell already hands any address that is not the app's to the phone. */
export async function openExternal(url) {
  if (!isNative()) return false;
  const m = await use("browser");
  try {
    if (m) { await m.Browser.open({ url }); return true; }
  } catch (e) { /* fall through to the system */ }
  try { window.open(url, "_blank"); return true; } catch (e) { return false; }
}

/* ---------- sharing ---------- */
/* A web page shares a file through navigator.share or a download; neither
   is there inside the shell (Android's WebView has no Web Share, and a
   download goes nowhere). So the file is written to the app's cache and
   the phone's own share sheet takes it. "shared" · "cancelled" ·
   "failed", or null outside the shell. */
const cancelled = (e) => /cancel/i.test(String((e && (e.message || e.errorMessage)) || e || ""));
export async function nativeShareFile({ text, name, title }) {
  if (!isNative()) return null;
  const [fs, sh] = await Promise.all([use("filesystem"), use("share")]);
  if (!fs || !sh) return "failed";
  try {
    const safe = String(name || "nosca.txt").replace(/[^\w.-]+/g, "-");
    const w = await fs.Filesystem.writeFile({ path: safe, data: String(text || ""), directory: fs.Directory.Cache, encoding: fs.Encoding.UTF8 });
    await sh.Share.share({ title: title || undefined, files: [w.uri], dialogTitle: title || undefined });
    return "shared";
  } catch (e) {
    return cancelled(e) ? "cancelled" : "failed";
  }
}
/* a code or a link: the share sheet, as navigator.share is on a phone's browser */
export async function nativeShareText({ title, text, url }) {
  if (!isNative()) return null;
  const sh = await use("share");
  if (!sh) return "failed";
  try {
    await sh.Share.share({ title: title || undefined, text: text || undefined, url: url || undefined, dialogTitle: title || undefined });
    return "shared";
  } catch (e) {
    return cancelled(e) ? "cancelled" : "failed";
  }
}

/* A CLIP'S COPY ON THE PHONE. On the web every clip live capture records
   is handed to the browser as a download (Nosca.jsx, saveToDevice). In
   the shell it is written to the app's own Documents — on an iPhone the
   Files app shows them under On My iPhone › Nosca (UIFileSharingEnabled);
   on Android 11 and later the phone's Documents/Nosca. Older Android would
   ask for storage permission, which the app does not take, so there it is
   left. Never awaited, and nothing is said either way. */
export function keepCopy(file, name) {
  if (!isNative() || !file) return false;
  const android = nativePlatform() === "android";
  if (android) {
    const v = /Android (\d+)/.exec((typeof navigator !== "undefined" && navigator.userAgent) || "");
    if (!v || Number(v[1]) < 11) return false;
  }
  const path = (android ? "Nosca/" : "") + String(name || file.name || "clip").replace(/[^\w.-]+/g, "-");
  use("filesystem").then((fs) => {
    if (!fs) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "").replace(/^data:[^,]*,/, "");
      fs.Filesystem.writeFile({ path, data, directory: fs.Directory.Documents, recursive: true }).catch(() => {});
    };
    reader.onerror = () => {};
    reader.readAsDataURL(file);
  });
  return true;
}

/* ---------- notifications on the phone ---------- */
/* Android needs the app's Firebase file to have been built in
   (android/app/google-services.json; vite.config.js says whether it was):
   without it the native push library throws and takes the app down. */
const ANDROID_PUSH = (() => { try { return import.meta.env.VITE_NATIVE_PUSH_ANDROID === "1"; } catch (e) { return false; } })();
const TOKEN_KEY = "nosca.push.native";
let pushPerm = "default";

/* granted · denied · default · unsupported, as lib/push.js's pushSupport() */
export function nativePushSupport() {
  if (nativePlatform() === "android" && !ANDROID_PUSH) return "unsupported";
  return pushPerm;
}
async function readPerm() {
  if (nativePlatform() === "android" && !ANDROID_PUSH) return "unsupported";
  const m = await use("push");
  if (!m) return "unsupported";
  try {
    const p = await m.PushNotifications.checkPermissions();
    pushPerm = p.receive === "granted" ? "granted" : p.receive === "denied" ? "denied" : "default";
  } catch (e) { /* keep what was known */ }
  return pushPerm;
}
export const storedEndpoint = () => { try { return window.localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; } };
const storeEndpoint = (v) => { try { if (v) window.localStorage.setItem(TOKEN_KEY, v); else window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* private storage */ } };

/* register() answers through two events, once */
function tokenOnce(P) {
  return new Promise((resolve) => {
    let over = false;
    const handles = [];
    const finish = (v) => {
      if (over) return; over = true;
      handles.forEach((h) => Promise.resolve(h).then((x) => x && x.remove && x.remove()).catch(() => {}));
      resolve(v);
    };
    handles.push(P.addListener("registration", (t) => finish({ token: t && t.value })));
    handles.push(P.addListener("registrationError", (e) => finish({ error: (e && e.error) || "The phone's push service said no" })));
    setTimeout(() => finish({ error: "The phone's push service didn't answer — try again in a moment" }), 15000);
    P.register().catch((e) => finish({ error: (e && e.message) || "Couldn't turn notifications on" }));
  });
}

/* The device's token as a push_subscriptions row: one row per device, as
   a browser's, the token carried in `endpoint` behind the service that
   delivers to it — "apns:<hex>" on an iPhone, "fcm:<token>" on Android —
   with no keys (those are web push's own). The relay sends web push only
   to https endpoints and leaves these for the native sender
   (docs/native/README.md, "Push"). `ask` asks the person first, inside
   the tap; without it this only re-files a device already turned on. */
export async function nativePushRow(userId, ask) {
  const support = await readPerm();
  if (support === "unsupported") return { ok: false, reason: "Notifications aren't set up in this build of the app yet" };
  const m = await use("push");
  let perm = support;
  if (perm === "default" && ask) {
    try {
      const r = await m.PushNotifications.requestPermissions();
      perm = pushPerm = r.receive === "granted" ? "granted" : r.receive === "denied" ? "denied" : "default";
    } catch (e) { perm = "denied"; }
  }
  if (perm === "denied") return { ok: false, reason: "Notifications are off for Nosca in the phone's Settings" };
  if (perm !== "granted") return { ok: false, reason: "Permission declined" };
  const got = await tokenOnce(m.PushNotifications);
  if (!got.token) return { ok: false, reason: got.error };
  const endpoint = (nativePlatform() === "ios" ? "apns:" : "fcm:") + got.token;
  const was = storedEndpoint();
  return {
    ok: true, was: was && was !== endpoint ? was : null,
    row: { user_id: userId, endpoint, p256dh: "", auth: "", ua: (typeof navigator !== "undefined" && navigator.userAgent) || null },
    keep: () => storeEndpoint(endpoint),
  };
}
/* signed out, or switched off: the token goes from the phone too, so a
   phone that changes hands starts afresh */
export async function nativePushOff() {
  const endpoint = storedEndpoint();
  storeEndpoint(null);
  const m = await use("push");
  try { if (m && nativePushSupport() !== "unsupported") await m.PushNotifications.unregister(); } catch (e) { /* the row still goes */ }
  return endpoint;
}

/* A TAPPED NOTIFICATION LANDS WHERE THE WEB'S DOES. The worker hands the
   app { screen, id, remind_day } (public/sw.js); the native sender puts
   the same keys in the notification's data, and Nosca opens it the same
   way. A tap that launched the app arrives before Nosca is there to
   hear it, so it waits here. */
let pendingOpen = null;
const openers = new Set();
export function onNativeOpen(fn) {
  openers.add(fn);
  if (pendingOpen) { const m = pendingOpen; pendingOpen = null; setTimeout(() => fn(m), 300); }
  return () => { openers.delete(fn); };
}
function opened(n) {
  const raw = (n && n.notification && n.notification.data) || {};
  const d = raw && typeof raw.data === "object" && raw.data ? { ...raw, ...raw.data } : raw;
  const screen = typeof d.screen === "string" && d.screen ? d.screen : null;
  if (!screen) return;
  const m = { screen, data: { screen, ...(d.id != null && d.id !== "" ? { id: String(d.id) } : {}), ...(typeof d.remind_day === "string" && d.remind_day ? { remind_day: d.remind_day } : {}) } };
  if (openers.size) openers.forEach((f) => { try { f(m); } catch (e) { /* the next one still hears */ } }); else pendingOpen = m;
}

/* ---------- Android's back ---------- */
/* The app's own Back, never the WebView's history: the topmost way back
   a finger could reach right now — the camera's or a viewer's Close, an
   open sheet's scrim, the screen's Back (every Back in the app carries
   that label) — is pressed. Nothing to go back to, and the app goes to
   the background, as Android's own apps do at their first screen. */
const reachable = (el, top) => {
  try {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const x = r.left + r.width / 2, y = top ? r.top + 8 : r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit));
  } catch (e) { return false; }
};
export function backInApp() {
  if (typeof document === "undefined") return false;
  const ways = [
    ...Array.from(document.querySelectorAll('button[aria-label="Close"]')).map((el) => [el, false]),
    ...Array.from(document.querySelectorAll("[data-sheet-scrim]")).map((el) => [el, true]),
    ...Array.from(document.querySelectorAll('button[aria-label="Back"]')).map((el) => [el, false]),
  ];
  for (const [el, top] of ways) {
    if (reachable(el, top)) { el.click(); return true; }
  }
  return false;
}

/* ---------- the launch screen and the status bar ---------- */
/* What is drawn under a point: dark or not. A clip, a photo or a canvas
   counts as dark (the feed, the camera, the dark stages); otherwise the
   first background that is mostly opaque decides; nothing at all is the
   white page. */
function darkAt(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el && el.nodeType === 1) {
    const tag = el.tagName;
    if (tag === "VIDEO" || tag === "CANVAS" || tag === "IMG") return true;
    const m = /rgba?\(([^)]+)\)/.exec(window.getComputedStyle(el).backgroundColor || "");
    if (m) {
      const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v));
      if (a >= 0.5) {
        const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.4;
      }
    }
    el = el.parentElement;
  }
  return false;
}
const shown = { top: null, bottom: null };
function setBars(where, dark) {
  if (shown[where] === dark) return;
  shown[where] = dark;
  use("core").then((m) => {
    if (!m || !m.SystemBars) return;
    m.SystemBars.setStyle({ style: dark ? m.SystemBarsStyle.Dark : m.SystemBarsStyle.Light,
      bar: where === "top" ? m.SystemBarType.StatusBar : m.SystemBarType.NavigationBar }).catch(() => {});
  });
}
let launchUp = true;
function hideLaunch() {
  if (!launchUp) return;
  launchUp = false;
  use("splash").then((m) => { if (m) m.SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}); });
}
/* The launch screen goes once the app has drawn something that is not
   the white loader (lib/brandmark.jsx) — the sport splash, the front
   door, the app — two frames on, so it is painted before it is shown;
   ten seconds is the latest, whatever happened. Then the bars follow
   whatever is under them, checked a beat after anything on the page
   changes. */
function watchScreen() {
  const root = document.getElementById("root") || document.body;
  let queued = false;
  const look = () => {
    queued = false;
    if (launchUp) {
      if (!root.firstElementChild || document.querySelector("[data-brand-loader]")) return;
      requestAnimationFrame(() => requestAnimationFrame(hideLaunch));
    }
    const w = window.innerWidth, h = window.innerHeight;
    setBars("top", darkAt(w / 2, 2));
    if (nativePlatform() === "android") setBars("bottom", darkAt(w / 2, h - 2));
  };
  const soon = () => { if (!queued) { queued = true; setTimeout(look, 120); } };
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", soon);
  setTimeout(hideLaunch, 10000);
  soon();
}

/* ---------- start ---------- */
let started = false;
export function startNative() {
  if (started || !isNative() || typeof document === "undefined") return;
  started = true;
  ["core", "haptics", "splash", "app"].forEach(use);
  /* the brand ground is what shows first */
  setBars("top", true);
  if (nativePlatform() === "android") setBars("bottom", true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchScreen); else watchScreen();
  use("app").then((m) => {
    if (!m) return;
    m.App.addListener("backButton", () => { if (!backInApp()) m.App.minimizeApp().catch(() => {}); });
    /* Coming back to the front loads the data again on the web (a focus,
       a pageshow, a visibilitychange; useNoscaData, at most once in 20
       seconds): said here too, in case the WebView keeps quiet about it.
       Leaving is left to the WebView's own visibilitychange — a pagehide
       said on every lost focus (the Control Centre pulled down) would park
       the feed's clip with nothing to bring it back. */
    m.App.addListener("appStateChange", ({ isActive }) => {
      try { if (isActive) window.dispatchEvent(new Event("focus")); } catch (e) { /* nothing depends on it */ }
    });
  });
  readPerm().then((perm) => {
    if (perm === "unsupported") return;
    use("push").then((m) => { if (m) m.PushNotifications.addListener("pushNotificationActionPerformed", opened); });
  });
}
