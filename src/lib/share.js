/* SHARING A CODE
 *
 * One helper for every place a code leaves the app — the coach's
 * arrival screen, the invite sheet, the family screen. The link carries
 * the code as a query string, so opening it on a phone lands on the
 * sign-up with the code already filled in (App.jsx reads ?join= and
 * ?family= once and strips them from the address bar).
 *
 * The OS share sheet is used where there is one. Where there isn't
 * (desktop browsers, some in-app webviews) the text is copied instead,
 * and the caller is told which happened so it can say so. */

export const joinLink = (kind, code) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?${kind === "family" ? "family" : "join"}=${encodeURIComponent(code || "")}`;
};

/* true when the text is on the clipboard */
export async function copyText(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* no permission, or an insecure context — try the old way */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/* "shared" — the share sheet took it; "copied" — no share sheet, the
   text and link are on the clipboard; "cancelled" — they closed the
   sheet; "failed" — nothing worked. */
export async function shareOrCopy({ title, text, url }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(url ? { title, text, url } : { title, text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      /* anything else: the share failed outright — fall back to copying */
    }
  }
  const ok = await copyText(url ? `${text} ${url}` : text);
  return ok ? "copied" : "failed";
}
