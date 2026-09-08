/* What the three push functions all need.
 *
 * This lives in a subdirectory on purpose: Netlify turns each file at
 * the top of netlify/functions into an endpoint, and a subdirectory
 * only becomes one when it holds a file of its own name. lib/ never
 * will, so this is a module and not a URL.
 */

import { timingSafeEqual, createPrivateKey, createPublicKey } from "node:crypto";

/* THE PROJECT URL, WHATEVER WAS PASTED IN. Supabase shows both
   "https://<ref>.supabase.co" and the REST endpoint
   "https://<ref>.supabase.co/rest/v1" on its API settings page, and it
   is easy to copy the wrong one. With the second, every read here asked
   for /rest/v1/rest/v1/<table>, which PostgREST answers with 404
   PGRST125 "Invalid path specified in request URL" — a message that
   says nothing about the cause, on a request nobody sees. A trailing
   slash is the same class of mistake. Both are trimmed, so the setting
   cannot be wrong in the two ways it is usually wrong. */
export const projectUrl = (env) =>
  String((env && env.SUPABASE_URL) || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

export const REQUIRED = [
  "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
];

/* THE PUBLIC KEY IS THE PRIVATE KEY'S, NOT AN ENVIRONMENT VARIABLE'S.
   A VAPID pair is one key: the public half is computable from the
   private half, and a push service checks that the token was signed by
   the pair it is shown. Two variables holding two halves is two chances
   to paste the wrong thing, and getting it wrong produces
   `403 BadJwtToken` from Apple — which names neither variable, arrives
   nowhere a person looks, and cost this project three days.
   So the private key is asked, and the public half is derived from it.
   VAPID_PUBLIC_KEY is no longer read, and cannot be wrong. */
const b64u = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
/* a PKCS#8 wrapper for a P-256 private key; the 32-byte scalar follows */
const P256_PKCS8 = Buffer.from("3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420", "hex");

export function publicFromPrivate(privateKey) {
  try {
    const d = unb64u(privateKey);
    if (d.length !== 32) return null;
    const spki = createPublicKey(
      createPrivateKey({ key: Buffer.concat([P256_PKCS8, d]), format: "der", type: "pkcs8" }),
    ).export({ format: "der", type: "spki" });
    /* the uncompressed point is the last 65 bytes of the SPKI */
    return b64u(spki.subarray(spki.length - 65));
  } catch {
    return null;
  }
}

/* WHO IS SENDING THIS, IN A FORM APPLE ACCEPTS. The `sub` claim of the
   VAPID token has to be a `mailto:` or an `https:` URL — Apple is
   strict where web-push is not, and answers anything else with
   `403 BadJwtToken`, which names nothing. A pasted variable arrives
   with a trailing newline; an address arrives without its `mailto:`;
   a site arrives as `http://`. All three pass web-push and all three
   are rejected by Apple. So whatever is configured is put into the one
   shape that works, rather than trusted to already be in it. */
export function vapidSubject(raw) {
  const v = String(raw || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!v) return null;
  /* The space in "mailto: someone@example.com" is what this whole
     function exists for. It is the natural way to type it, it survives
     every check web-push makes, and Apple answers the resulting token
     with 403 BadJwtToken. Neither an address nor a URL may contain
     whitespace, so all of it goes. */
  const addr = (rest) => rest.replace(/\s+/g, "");
  if (/^mailto:/i.test(v)) {
    const a = addr(v.slice(7));
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) ? "mailto:" + a : null;
  }
  if (/^https?:\/\//i.test(v)) {
    const host = addr(v.replace(/^https?:\/\//i, ""));
    return host ? "https://" + host : null;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr(v))) return "mailto:" + addr(v);
  if (/^[^\s/@]+\.[^\s/@]+$/.test(addr(v))) return "https://" + addr(v);
  return null;
}

/* Hands web-push a pair that is a pair, and a subject in the shape
   every push service accepts. Returns both, so a caller can say what it
   signed with, and an error naming the variable when one of them cannot
   be made sense of — better than letting the push service say only
   "bad token". */
export function useVapid(webpush, env) {
  const publicKey = publicFromPrivate(env.VAPID_PRIVATE_KEY);
  if (!publicKey) return { error: "VAPID_PRIVATE_KEY is not a P-256 key (expected 32 bytes, base64url)" };
  const subject = vapidSubject(env.VAPID_SUBJECT);
  if (!subject) return { error: "VAPID_SUBJECT must be an email address or an https:// URL" };
  try {
    webpush.setVapidDetails(subject, publicKey, env.VAPID_PRIVATE_KEY);
  } catch (err) {
    return { error: `VAPID settings rejected: ${err.message}` };
  }
  return { publicKey, subject };
}

/* The notifications worth waking a phone for when someone has asked to
   hear only what matters: their day changing, or a question waiting on
   them. A lesson write-up, a drill, a tip or a family join is news, not
   an interruption — it is in the app when they next open it. The kinds
   are the ones section 10 of nosca.sql writes. */
const URGENT = new Set(["booking", "weather", "request", "accepted", "declined", "message"]);
export function isUrgent(kind) {
  return URGENT.has(typeof kind === "string" ? kind : "");
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function secretMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function restHeaders(serviceKey, extra) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
    ...(extra || {}),
  };
}

export async function loadSubscriptions(env, userId) {
  const url = `${projectUrl(env)}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=endpoint,p256dh,auth`;
  const res = await fetch(url, { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  if (!res.ok) throw new Error(`push_subscriptions read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function removeSubscription(env, endpoint) {
  const url = `${projectUrl(env)}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;
  const res = await fetch(url, { method: "DELETE", headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  return res.ok;
}

/* instant · quiet · digest. Anything unreadable — no row yet, a network
   blip, a column that isn't there — answers "instant", because sending
   a notification that could have waited is a smaller failure than
   swallowing one. */
export async function notifyPreference(env, userId) {
  try {
    const url = `${projectUrl(env)}/rest/v1/preferences?id=eq.${encodeURIComponent(userId)}&select=notify`;
    const res = await fetch(url, { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
    if (!res.ok) return "instant";
    const rows = await res.json();
    const value = Array.isArray(rows) && rows[0] ? rows[0].notify : null;
    return value === "quiet" || value === "digest" ? value : "instant";
  } catch {
    return "instant";
  }
}

/* The push service that holds this subscription — "web.push.apple.com",
   "fcm.googleapis.com". The rest of the endpoint is the device's own
   address and stays out of anything we return. */
const hostOf = (endpoint) => {
  try { return new URL(endpoint).host; } catch { return "?"; }
};

/* One send, with the two failures that mean "this device is gone"
   folded in. Returns { outcome: 'sent' | 'gone' | 'failed', ... } and,
   when it failed, WHY.

   It used to return the word "failed" and put the reason in
   console.error, where it lived in the Netlify function log and nowhere
   a person looking at the database would ever see it. Every caller
   reads this over HTTP, so the answer belongs in the answer: a run that
   reports `failed: 2` and nothing else sends you looking through three
   services to find out that two keys do not match. */
export async function sendTo(webpush, env, sub, message) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message,
      { TTL: 3600 },
    );
    return { outcome: "sent" };
  } catch (err) {
    const status = err && err.statusCode;
    if (status === 404 || status === 410) {
      await removeSubscription(env, sub.endpoint);
      return { outcome: "gone", status, host: hostOf(sub.endpoint) };
    }
    /* the push service's own words, trimmed: Apple answers
       {"reason":"BadJwtToken"}, FCM answers a sentence */
    const raw = (err && (err.body || err.message)) || "";
    const reason = String(raw).replace(/\s+/g, " ").trim().slice(0, 160) || "no reason given";
    console.error("push failed", status, reason);
    return { outcome: "failed", status: status || null, host: hostOf(sub.endpoint), reason };
  }
}

/* What a run did, in the shape every one of these functions returns.
   `errors` carries the distinct reasons rather than one line per device,
   so ten phones behind one bad key read as one problem. */
export function tally(outcomes) {
  const out = { sent: 0, failed: 0, removed: 0 };
  const seen = new Map();
  for (const o of outcomes) {
    if (o.outcome === "sent") out.sent++;
    else if (o.outcome === "gone") out.removed++;
    else {
      out.failed++;
      const key = `${o.status}|${o.reason}|${o.host}`;
      if (!seen.has(key)) seen.set(key, { status: o.status, host: o.host, reason: o.reason });
    }
  }
  if (seen.size) out.errors = [...seen.values()];
  return out;
}

/* When a send is refused, the key it was signed with is the first thing
   anyone asks about. It is a PUBLIC key — it ships in the app bundle —
   so naming it costs nothing and settles the question: if this does not
   match VITE_VAPID_PUBLIC_KEY in the build, every device subscribed to
   a different pair and VAPID_PRIVATE_KEY is the wrong half. */
export function withVapid(out, vapid) {
  if (out.errors && vapid) {
    if (vapid.publicKey) out.signedWith = vapid.publicKey;
    /* the contact address in the token — sent to the push service in
       the clear on every request, and the other thing it can reject */
    if (vapid.subject) out.subject = vapid.subject;
  }
  return out;
}
