/* What the three push functions all need.
 *
 * This lives in a subdirectory on purpose: Netlify turns each file at
 * the top of netlify/functions into an endpoint, and a subdirectory
 * only becomes one when it holds a file of its own name. lib/ never
 * will, so this is a module and not a URL.
 */

import { timingSafeEqual } from "node:crypto";

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
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
];

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

/* One send, with the two failures that mean "this device is gone"
   folded in. Returns 'sent' | 'gone' | 'failed'. */
export async function sendTo(webpush, env, sub, message) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message,
      { TTL: 3600 },
    );
    return "sent";
  } catch (err) {
    const status = err && err.statusCode;
    if (status === 404 || status === 410) {
      await removeSubscription(env, sub.endpoint);
      return "gone";
    }
    console.error("push failed", status, err && err.body);
    return "failed";
  }
}
