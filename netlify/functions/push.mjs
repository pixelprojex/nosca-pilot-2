/* Push relay — Netlify Function.
 *
 * Something worth telling someone about happens, a trigger in
 * nosca.sql writes a `notifications` row, and that row is POSTed here.
 * This looks up the person's devices and sends the notification to
 * each one with web-push. It never writes a notification itself — the
 * database triggers do that — so the bell inside the app works with or
 * without this function.
 *
 * TWO CALLERS, TWO SHAPES. Section 10b of nosca.sql posts the fields
 * flat, from an after-insert trigger via pg_net. A Supabase Database
 * Webhook set up by hand in the dashboard wraps the same row in
 * { type, table, record }. Both are accepted: reading only the second
 * meant the trigger's own posts were answered "ignored" and no phone
 * ever heard anything.
 *
 * WHEN TO TELL YOU. The person's `preferences.notify` decides:
 *   instant  every notification goes out now  (the default)
 *   quiet    only the ones that change their day or want an answer
 *   digest   nothing now; digest.mjs sends one summary in the morning
 * A preference that cannot be read is treated as `instant` — a
 * notification sent when it might have been held is a smaller failure
 * than one silently dropped.
 *
 * Environment (set on Netlify, never in a VITE_ variable):
 *   PUSH_WEBHOOK_SECRET        shared with the caller's x-nosca-secret header
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  reads preferences and prunes push_subscriptions
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 */

import webpush from "web-push";
import {
  json, secretMatches, loadSubscriptions, sendTo, tally, withVapid, useVapid,
  notifyPreference, isUrgent, REQUIRED,
} from "./lib/push-shared.mjs";

/* The dashboard webhook wraps the row; the trigger in nosca.sql posts
   it flat. Anything else — an UPDATE, another table, a body with no
   user_id — is not ours. */
export function recordFrom(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.record && typeof payload.record === "object") {
    if (payload.type && payload.type !== "INSERT") return null;
    if (payload.table && payload.table !== "notifications") return null;
    return payload.record.user_id ? payload.record : null;
  }
  return payload.user_id ? payload : null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const given = req.headers.get("x-nosca-secret");
  if (!secretMatches(given, process.env.PUSH_WEBHOOK_SECRET)) return json({ error: "unauthorised" }, 401);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "body is not JSON" }, 400);
  }

  const record = recordFrom(payload);
  if (!record) return json({ status: "ignored" }, 200);

  const env = process.env;
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) return json({ error: `missing environment: ${missing.join(", ")}` }, 500);

  /* Ask before doing any work: a held notification costs one read. */
  const when = await notifyPreference(env, record.user_id);
  if (when === "digest") return json({ status: "held", until: "the daily summary" }, 200);
  if (when === "quiet" && !isUrgent(record.kind)) return json({ status: "held", until: "they open Nosca" }, 200);

  const vapid = useVapid(webpush, env);
  if (vapid.error) return json({ error: vapid.error }, 500);

  let subscriptions;
  try {
    subscriptions = await loadSubscriptions(env, record.user_id);
  } catch (err) {
    return json({ error: err.message }, 502);
  }

  const message = JSON.stringify({
    title: record.title || "Nosca",
    body: record.body || "",
    data: record.data || {},
  });

  const outcomes = await Promise.all(subscriptions.map((sub) => sendTo(webpush, env, sub, message)));
  return json(withVapid(tally(outcomes), vapid.publicKey), 200);
};
