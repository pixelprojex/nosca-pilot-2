/* The daily summary — a Netlify scheduled function.
 *
 * "Once a day" on the Notifications screen used to be a radio button
 * that saved a preference nothing read. This is the half that makes it
 * true: every notification for those people is held by the relay, and
 * once each morning this sends them one push instead of ten.
 *
 * 06:00 UTC is 7am in Ireland from late March to late October and 6am
 * the rest of the year. One country, one cron.
 *
 * The window is everything since the last summary that person was
 * sent, so nothing is counted twice and nothing that arrived while the
 * job was down is missed. `preferences.digest_at` records it. A person
 * with no `digest_at` yet gets the last day only — the first summary
 * should not be a month of history.
 *
 * It reads unread notifications and never marks them read: the bell
 * inside the app is the record, and this is only a nudge towards it.
 *
 * Environment: the same names as push.mjs. No secret header — Netlify
 * only ever invokes this on its own schedule.
 */

import webpush from "web-push";
import { json, restHeaders, loadSubscriptions, sendTo, tally, withVapid, useVapid, projectUrl, REQUIRED } from "./lib/push-shared.mjs";

export const config = { schedule: "0 6 * * *" };

const DAY = 24 * 60 * 60 * 1000;
/* One read per run rather than one per person, so the job costs the
   same whether the pilot has five accounts or five hundred. */
const MAX_PEOPLE = 500;

async function rows(env, path) {
  const res = await fetch(`${projectUrl(env)}/rest/v1/${path}`, { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) });
  if (!res.ok) throw new Error(`${path.split("?")[0]} read failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

/* "3 things since yesterday · A lesson was logged · Orla asked for a
   lesson". One item is not a digest — send that one as itself, so it
   reads exactly as it would have at the time. */
export function summarise(items) {
  if (items.length === 1) {
    const only = items[0];
    return {
      title: only.title || "Nosca",
      body: only.body || "",
      data: only.data && typeof only.data === "object" ? only.data : { screen: "alerts" },
    };
  }
  const named = items.map((n) => n.title).filter(Boolean);
  const shown = named.slice(0, 3);
  const rest = named.length - shown.length;
  return {
    title: `${items.length} things since yesterday`,
    body: shown.join(" · ") + (rest > 0 ? ` · and ${rest} more` : ""),
    data: { screen: "alerts" },
  };
}

async function markSent(env, ids, at) {
  const url = `${projectUrl(env)}/rest/v1/preferences?id=in.(${ids.map(encodeURIComponent).join(",")})`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY, { prefer: "return=minimal" }),
    body: JSON.stringify({ digest_at: at }),
  });
  return res.ok;
}

export default async () => {
  const env = process.env;
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) return json({ error: `missing environment: ${missing.join(", ")}` }, 500);

  const vapid = useVapid(webpush, env);
  if (vapid.error) return json({ error: vapid.error }, 500);

  const now = new Date();
  const nowIso = now.toISOString();
  const dayAgo = new Date(now.getTime() - DAY);

  let people;
  try {
    people = await rows(env, `preferences?notify=eq.digest&select=id,digest_at&limit=${MAX_PEOPLE}`);
  } catch (err) {
    return json({ error: err.message }, 502);
  }
  if (people.length === 0) return json({ people: 0, sent: 0 }, 200);

  /* The earliest window anyone needs, so one query covers everybody;
     each person's own cut-off is applied below. */
  const since = people.reduce((oldest, p) => {
    const at = p.digest_at ? new Date(p.digest_at) : dayAgo;
    const from = Number.isNaN(at.getTime()) || at < dayAgo ? dayAgo : at;
    return from < oldest ? from : oldest;
  }, now);

  const ids = people.map((p) => p.id);
  let news;
  try {
    news = await rows(env, "notifications?" + [
      `user_id=in.(${ids.map(encodeURIComponent).join(",")})`,
      "read_at=is.null",
      `created_at=gt.${encodeURIComponent(since.toISOString())}`,
      "select=user_id,title,body,data,created_at",
      "order=created_at.asc",
    ].join("&"));
  } catch (err) {
    return json({ error: err.message }, 502);
  }

  let sent = 0, failed = 0, removed = 0, told = 0;
  const reasons = new Map();
  const done = [];

  for (const person of people) {
    const at = person.digest_at ? new Date(person.digest_at) : dayAgo;
    const from = Number.isNaN(at.getTime()) || at < dayAgo ? dayAgo : at;
    const mine = news.filter((n) => n.user_id === person.id && new Date(n.created_at) > from);
    if (mine.length === 0) continue;

    let subscriptions;
    try {
      subscriptions = await loadSubscriptions(env, person.id);
    } catch {
      continue;   // their devices are unreadable this morning; try again tomorrow
    }
    /* Nobody to tell is not a failure, but the window still moves on:
       yesterday's news should not queue up for a phone that may never
       subscribe. */
    if (subscriptions.length === 0) { done.push(person.id); continue; }

    const message = JSON.stringify(summarise(mine));
    const outcomes = await Promise.all(subscriptions.map((sub) => sendTo(webpush, env, sub, message)));
    const run = tally(outcomes);
    sent += run.sent; failed += run.failed; removed += run.removed;
    (run.errors || []).forEach((e) => { const k = `${e.status}|${e.reason}|${e.host}`; if (!reasons.has(k)) reasons.set(k, e); });
    if (run.sent > 0) told++;
    done.push(person.id);
  }

  if (done.length) await markSent(env, done, nowIso);
  const out = { people: people.length, told, sent, failed, removed };
  if (reasons.size) out.errors = [...reasons.values()];
  return json(withVapid(out, vapid.publicKey), 200);
};
