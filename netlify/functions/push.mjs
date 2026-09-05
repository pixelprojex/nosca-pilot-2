/* Push relay — Netlify Function.
 *
 * A Supabase Database Webhook POSTs here on every INSERT into
 * public.notifications. This looks up the person's push subscriptions
 * and sends the notification to each device with web-push. It never
 * writes a notification itself — the database triggers do that — so
 * in-app notifications keep working with or without this function.
 *
 * Environment (set on Netlify, never in a VITE_ variable):
 *   PUSH_WEBHOOK_SECRET        shared with the webhook's x-nosca-secret header
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  reads and prunes push_subscriptions
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 */

import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function secretMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function restHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
}

async function loadSubscriptions(env, userId) {
  const url = `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=endpoint,p256dh,auth`;
  const res = await fetch(url, { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  if (!res.ok) throw new Error(`push_subscriptions read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function removeSubscription(env, endpoint) {
  const url = `${env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;
  const res = await fetch(url, { method: "DELETE", headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  return res.ok;
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

  const { type, table, record } = payload || {};
  if (type !== "INSERT" || table !== "notifications" || !record || !record.user_id) {
    return json({ status: "ignored" }, 200);
  }

  const env = process.env;
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) return json({ error: `missing environment: ${missing.join(", ")}` }, 500);

  try {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  } catch (err) {
    // A mistyped key or a subject without mailto: — say so rather than crash.
    return json({ error: `VAPID settings rejected: ${err.message}` }, 500);
  }

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

  let sent = 0;
  let failed = 0;
  let removed = 0;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
        { TTL: 3600 },
      ),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      sent++;
      continue;
    }
    const status = result.reason && result.reason.statusCode;
    if (status === 404 || status === 410) {
      // The browser dropped the subscription; forget the row.
      if (await removeSubscription(env, subscriptions[i].endpoint)) removed++;
      else failed++;
    } else {
      failed++;
      console.error("push failed", status, result.reason && result.reason.body);
    }
  }

  return json({ sent, failed, removed }, 200);
};
