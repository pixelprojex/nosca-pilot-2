/* The push relay, without a network.
 *
 * Nothing here talks to Supabase or to a push service: global fetch is
 * replaced with a small stub that answers the two REST reads the relay
 * makes, and web-push is never reached because the stub returns no
 * devices. What this proves is the part that has actually gone wrong —
 * which payloads the relay recognises, and which notifications it
 * holds back.
 *
 *   node scripts/e2e/push-relay.mjs
 */

const ENV = {
  PUSH_WEBHOOK_SECRET: "s3cret",
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  VAPID_PUBLIC_KEY: "BJ2mVQxTn0Vd7bB8jVAI1XcMEZLQfhX4Rl9Nqj-9lPJcm6jS3T3v1MP-oJ7lZKk8sN0Vq1WcOxwq1mYvY3lQ4kE",
  VAPID_PRIVATE_KEY: "Hs8s0FZzq3Yy0iVQhV_JXWJnPPqYQ7QpV4z8xg2WwJo",
  VAPID_SUBJECT: "mailto:help@nosca.ie",
};
Object.assign(process.env, ENV);

let pref = "instant";
let subs = [];
const seen = [];

globalThis.fetch = async (url, init = {}) => {
  const href = String(url);
  seen.push(`${init.method || "GET"} ${href}`);
  if (href.includes("/preferences?")) return Response.json(pref === null ? [] : [{ notify: pref }]);
  if (href.includes("/push_subscriptions?")) return Response.json(subs);
  return Response.json([]);
};

const { default: relay, recordFrom } = await import("../../netlify/functions/push.mjs");
const { isUrgent, projectUrl, sendTo, tally } = await import("../../netlify/functions/lib/push-shared.mjs");
const { summarise } = await import("../../netlify/functions/digest.mjs");

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  if (ok) { pass++; console.log("PASS ", name); }
  else { fail++; console.log("FAIL ", name, got === undefined ? "" : ` — ${JSON.stringify(got)}`); }
};

const post = (body, secret = "s3cret") =>
  relay(new Request("https://nosca.ie/.netlify/functions/push", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-nosca-secret": secret }) },
    body: JSON.stringify(body),
  }));

const answer = async (res) => ({ status: res.status, body: await res.json() });

const ROW = { user_id: "11111111-1111-4111-8111-111111111111", kind: "lesson", title: "New lesson logged", body: "Putting", data: { screen: "lesson", id: "l1" } };

/* ---------- who is allowed to call it ---------- */
{
  const r = await answer(await post(ROW, "wrong"));
  check("a wrong secret is refused", r.status === 401, r);
}
{
  const r = await answer(await post(ROW, null));
  check("no secret at all is refused", r.status === 401, r);
}
{
  const res = await relay(new Request("https://nosca.ie/.netlify/functions/push", { method: "GET" }));
  check("GET is refused", res.status === 405, res.status);
}

/* ---------- the two payload shapes ----------
   nosca.sql's notify_push() trigger posts the fields flat; a Supabase
   Database Webhook wraps them. Reading only the second is what left
   every trigger-sent push answered "ignored". */
check("the flat body from the database trigger is a notification", !!recordFrom(ROW));
check("the dashboard webhook's envelope is one too", !!recordFrom({ type: "INSERT", table: "notifications", record: ROW }));
check("an UPDATE is not", recordFrom({ type: "UPDATE", table: "notifications", record: ROW }) === null);
check("another table is not", recordFrom({ type: "INSERT", table: "lessons", record: ROW }) === null);
check("a body with no user_id is not", recordFrom({ title: "hello" }) === null);
check("an empty body is not", recordFrom({}) === null);

{
  const r = await answer(await post(ROW));
  check("a flat body is accepted end to end", r.status === 200 && r.body.sent === 0 && r.body.failed === 0, r);
}
{
  const r = await answer(await post({ type: "INSERT", table: "notifications", record: ROW }));
  check("a wrapped body is accepted end to end", r.status === 200 && "sent" in r.body, r);
}
{
  const r = await answer(await post({ type: "UPDATE", table: "notifications", record: ROW }));
  check("an UPDATE is ignored, not sent", r.body.status === "ignored", r);
}

/* ---------- when to tell you ---------- */
{
  pref = "digest";
  const r = await answer(await post(ROW));
  check("'Once a day' holds it for the morning", r.body.status === "held", r);
}
{
  pref = "quiet";
  const r = await answer(await post({ ...ROW, kind: "lesson" }));
  check("'Only urgent' holds a lesson write-up", r.body.status === "held", r);
}
{
  pref = "quiet";
  const r = await answer(await post({ ...ROW, kind: "weather" }));
  check("'Only urgent' still sends a lesson called off", "sent" in r.body, r);
}
{
  pref = "quiet";
  const r = await answer(await post({ ...ROW, kind: "message" }));
  check("'Only urgent' still sends a message", "sent" in r.body, r);
}
{
  pref = "instant";
  const r = await answer(await post({ ...ROW, kind: "drill" }));
  check("'As they happen' sends everything", "sent" in r.body, r);
}
{
  pref = null;   // nobody has saved a preference yet
  const r = await answer(await post({ ...ROW, kind: "tip" }));
  check("no preference row means everything is sent", "sent" in r.body, r);
}
{
  const before = seen.length;
  pref = "digest";
  await post({ ...ROW, kind: "lesson" });
  const after = seen.slice(before);
  check("a held notification never asks for the person's devices",
        !after.some((s) => s.includes("push_subscriptions")), after);
}

check("every urgent kind is one the database actually writes",
      ["booking", "weather", "request", "accepted", "declined", "message"].every(isUrgent)
      && !isUrgent("lesson") && !isUrgent("drill") && !isUrgent("tip") && !isUrgent("family") && !isUrgent(""));

/* ---------- the project URL, however it was pasted in ----------
   Supabase's settings page shows the project URL and the REST endpoint
   side by side. With the REST one in SUPABASE_URL every read asked for
   /rest/v1/rest/v1/<table> and PostgREST answered 404 PGRST125, which
   names nothing and is invisible from the app. */
{
  const want = "https://mock.supabase.co";
  check("the project URL is taken as it is", projectUrl({ SUPABASE_URL: want }) === want);
  check("a trailing slash is trimmed", projectUrl({ SUPABASE_URL: want + "/" }) === want);
  check("several are trimmed", projectUrl({ SUPABASE_URL: want + "///" }) === want);
  check("the REST endpoint is accepted too", projectUrl({ SUPABASE_URL: want + "/rest/v1" }) === want);
  check("…with its own trailing slash", projectUrl({ SUPABASE_URL: want + "/rest/v1/" }) === want);
  check("surrounding space is ignored", projectUrl({ SUPABASE_URL: "  " + want + "  " }) === want);
  check("nothing at all is an empty string, not a crash", projectUrl({}) === "" && projectUrl() === "");
}
{
  const before = seen.length;
  pref = "instant";
  process.env.SUPABASE_URL = "https://mock.supabase.co/rest/v1";
  await post({ ...ROW, kind: "booking" });
  process.env.SUPABASE_URL = "https://mock.supabase.co";
  const asked = seen.slice(before).find((x) => x.includes("push_subscriptions"));
  check("a relay configured with the REST endpoint still reads the right path",
        !!asked && asked.includes("/rest/v1/push_subscriptions") && !asked.includes("/rest/v1/rest/v1/"), asked);
}

/* ---------- why a send failed ----------
   A run that answers `failed: 2` and nothing else is a dead end: the
   reason lived in console.error, inside the Netlify function log. Two
   devices behind one bad key are one problem, and it says so. */
{
  const gone = { statusCode: 410 };
  const apple = Object.assign(new Error("x"), { statusCode: 403, body: '{"reason":"BadJwtToken"}' });
  const stub = {
    sendNotification: async (sub) => {
      if (sub.endpoint.includes("ok")) return;
      throw sub.endpoint.includes("gone") ? gone : apple;
    },
  };
  const sub = (id) => ({ endpoint: `https://web.push.apple.com/${id}`, p256dh: "p", auth: "a" });
  const outcomes = [];
  for (const id of ["ok", "bad1", "bad2", "gone"]) outcomes.push(await sendTo(stub, ENV, sub(id), "{}"));

  check("a send that worked says so", outcomes[0].outcome === "sent", outcomes[0]);
  check("a rejected send carries the status and the service's own words",
        outcomes[1].outcome === "failed" && outcomes[1].status === 403
        && outcomes[1].reason.includes("BadJwtToken") && outcomes[1].host === "web.push.apple.com", outcomes[1]);
  check("a 410 is a device that is gone, not a failure", outcomes[3].outcome === "gone", outcomes[3]);

  const t = tally(outcomes);
  check("the tally counts each outcome", t.sent === 1 && t.failed === 2 && t.removed === 1, t);
  check("two devices behind one reason are one reason", t.errors.length === 1, t.errors);
  check("…and it names the status, the service and why", t.errors[0].status === 403
        && t.errors[0].host === "web.push.apple.com" && t.errors[0].reason.includes("BadJwtToken"), t.errors[0]);
  check("a clean run carries no errors key", tally([{ outcome: "sent" }]).errors === undefined);
  check("nothing of the endpoint but its host is reported",
        !JSON.stringify(t.errors).includes("bad1"), t.errors);
}

/* ---------- the daily summary ---------- */
{
  const one = summarise([{ title: "Lesson booked", body: "Thu 9:00 am", data: { screen: "diary" } }]);
  check("a summary of one thing is that one thing", one.title === "Lesson booked" && one.data.screen === "diary", one);
}
{
  const many = summarise([{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }, { title: "E" }]);
  check("a summary of five counts them", many.title === "5 things since yesterday", many);
  check("…and names three, then says how many more", many.body === "A · B · C · and 2 more", many.body);
  check("…and lands on the alerts screen", many.data.screen === "alerts", many);
}

console.log(`\npush-relay: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
