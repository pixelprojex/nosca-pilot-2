/* A device's subscription rotated — Netlify Function.
 *
 * A browser can replace a push subscription without asking: a key
 * rotation, a long silence, a reinstall. The old endpoint stops
 * working and the row in `push_subscriptions` becomes a dead address.
 * The app repairs this the next time it is opened (syncSubscription in
 * src/lib/push.js), but the whole point of push is the times it is
 * closed — so the service worker sends the new address here instead of
 * waiting.
 *
 * WHAT MAKES THIS SAFE. There is no session in a service worker at
 * this moment, so the request proves itself with the OLD subscription's
 * `auth` secret: sixteen random bytes the push service gave that one
 * device, held nowhere else but in that row. The update matches on
 * endpoint AND auth together, and touches exactly the row that proves
 * both. Knowing an endpoint alone changes nothing.
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { json, restHeaders, projectUrl } from "./lib/push-shared.mjs";

const str = (v) => (typeof v === "string" ? v.trim() : "");

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "body is not JSON" }, 400);
  }

  const was = (payload && payload.old) || {};
  const now = (payload && payload.new) || {};
  const oldEndpoint = str(was.endpoint), oldAuth = str(was.auth);
  const endpoint = str(now.endpoint), p256dh = str(now.p256dh), auth = str(now.auth);
  if (!oldEndpoint || !oldAuth || !endpoint || !p256dh || !auth) return json({ error: "incomplete" }, 400);

  const env = process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "missing environment" }, 500);

  const url = `${projectUrl(env)}/rest/v1/push_subscriptions`
    + `?endpoint=eq.${encodeURIComponent(oldEndpoint)}&auth=eq.${encodeURIComponent(oldAuth)}`;

  let res;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY, { prefer: "return=representation" }),
      body: JSON.stringify({ endpoint, p256dh, auth }),
    });
  } catch (err) {
    return json({ error: err.message }, 502);
  }

  /* A conflict means this browser already has a row under the new
     endpoint — the app got there first. Nothing to do, and not a
     failure. */
  if (res.status === 409) return json({ status: "already known" }, 200);
  if (!res.ok) return json({ error: `update failed: ${res.status}` }, 502);

  const updated = await res.json().catch(() => []);
  /* Zero rows means the pair did not match anything: an endpoint
     without its secret, or a row already pruned by a 410. Same answer
     either way — nothing here to move. */
  if (!Array.isArray(updated) || updated.length === 0) return json({ status: "no such subscription" }, 200);
  return json({ status: "moved" }, 200);
};
