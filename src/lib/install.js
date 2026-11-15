/* ADD TO HOME SCREEN — what this device is, and the one-tap install
 * where the browser offers it.
 *
 * Chrome (Android, Windows, Mac) and Edge fire `beforeinstallprompt`
 * once a site meets their install criteria — a manifest, HTTPS, a
 * worker — soon after the page loads, and never again for that page.
 * It is caught here, at module load, and kept, so the install guide can
 * offer one button that opens the browser's own install sheet. The
 * event is not cancelled: Chrome's own "Add Nosca to Home screen" bar
 * still shows on Android, and either path installs. Safari and Firefox
 * never fire it; there the guide shows the phone's own steps.
 *
 * Nothing here throws, and every browser API is checked before it is
 * touched — this runs on every open, signed in or not.
 */

let deferred = null;
const listeners = new Set();
const tell = (on) => listeners.forEach((f) => { try { f(on); } catch (e) { /* a listener's own problem */ } });

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeinstallprompt", (e) => { deferred = e; tell(true); });
  window.addEventListener("appinstalled", () => { deferred = null; tell(false); });
}

/* Is the browser offering to install right now? */
export const canPromptInstall = () => !!deferred;

/* Hear when that changes (the event arriving after the guide mounted,
   or an install completing). Returns the way to stop listening. */
export function onInstallPromptChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* Open the browser's install sheet. "accepted" · "dismissed" · "none"
   (nothing to show) · "failed". Call it inside the tap. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return "none";
  deferred = null; tell(false);
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice && choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch (err) {
    return "failed";
  }
}

const hasWindow = () => typeof window !== "undefined" && typeof navigator !== "undefined";
const ua = () => (hasWindow() && navigator.userAgent) || "";

export function isIos() {
  if (!hasWindow()) return false;
  if (/iPad|iPhone|iPod/.test(ua())) return true;
  // iPadOS reports itself as a Mac; the touch points give it away.
  return navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
}

/* Opened from a Home Screen (or a Dock) rather than in a browser tab. */
export function isStandalone() {
  if (!hasWindow()) return false;
  try {
    if (navigator.standalone === true) return true;
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch (e) { /* fine */ }
  return false;
}

/* Which set of steps to open on: "iphone" (an iPad too — Safari's
   Share is the same control, top right there), "android", "computer". */
export function platformOf() {
  if (!hasWindow()) return "computer";
  if (isIos()) return "iphone";
  if (/Android/i.test(ua())) return "android";
  return "computer";
}

/* The browser, for the one or two steps that differ by browser. */
export function browserOf() {
  const s = ua();
  if (/SamsungBrowser/i.test(s)) return "samsung";
  if (/FxiOS|Firefox/i.test(s)) return "firefox";
  if (/EdgiOS|Edg\//i.test(s)) return "edge";
  if (/CriOS|Chrome|Chromium/i.test(s)) return "chrome";
  if (/Safari/i.test(s)) return "safari";
  return "other";
}
