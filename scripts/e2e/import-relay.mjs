#!/usr/bin/env node
/* THE SORTING FUNCTION, WITHOUT A NETWORK (the push-relay.mjs pattern).
 *
 *   node scripts/e2e/import-relay.mjs
 *
 * netlify/functions/lesson-import.mjs is built with makeHandler({ fetch,
 * anthropic, now }): fetch answers the gate as the database would, the
 * model's client is a stub that records what it was asked and answers or
 * throws the SDK's own error classes, the clock is ours. Nothing reaches
 * Anthropic or Supabase. count_tokens is not called here (no key): the
 * cache flags are filled at switch-on.
 */
import Anthropic from "@anthropic-ai/sdk";
import { makeHandler, INSTRUCTIONS, taxonomyBlock, renderBlock, MODEL } from "../../netlify/functions/lesson-import.mjs";
import { PROMPT_V, schemaFor, BUDGET } from "../../netlify/functions/lib/import-shared.mjs";
import { FOCUS } from "../../src/lib/taxonomy.js";

let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) { pass++; console.log("PASS ", name); } else { fail++; console.log("FAIL ", name, got === undefined ? "" : ` — ${JSON.stringify(got).slice(0, 300)}`); } };
const ENV = { ANTHROPIC_API_KEY: "test-key", SUPABASE_URL: "https://mock.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" };
const PLAYER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "Bearer aaaa.bbbb.cccc";
const day = (extra = {}) => ({ v: PROMPT_V, sport: "golf", player: PLAYER, segs: [
  { part: "before", a: "C", text: "From last week, keep at it." },
  { part: "day", a: "C", id: 1, text: "Putting lesson today, green reading." },
  { part: "day", a: "P", text: "[message]" },
  { part: "day", a: "C", id: 2, text: "Tip: pace first." },
  { part: "day", a: "C", text: "[photo]" },
  { part: "after", a: "C", text: "See you Thursday." }], ...extra });

/* a world: what the gate says, what the model does, and everything they were asked */
function world({ gate = "ok", gateStatus = 200, answer = null, throws = null, env = ENV, clock = null } = {}) {
  const calls = { fetch: [], create: [], beta: [], opts: [] };
  const fetch = async (url, init = {}) => { calls.fetch.push({ url: String(url), init }); return new Response(JSON.stringify(gate), { status: gateStatus, headers: { "content-type": "application/json" } }); };
  const reply = (params) => {
    if (throws) throw (typeof throws === "function" ? throws() : throws);
    return answer || { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ day: "lesson", focus: ["putt"], note: [1], tip: [2], drills: [] }) }], usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 0, inference_geo: "us" } };
  };
  const anthropic = (opts) => { calls.opts.push(opts); return { messages: { create: async (p) => { calls.create.push(p); return reply(p); } }, beta: { messages: { create: async (p) => { calls.beta.push(p); return reply(p); } } } }; };
  let t = 1_000_000;
  const now = clock || (() => t);
  const logs = [];
  const h = makeHandler({ fetch, anthropic, now, env, log: (...a) => logs.push(a.join(" ")) });
  const post = async (body, headers = {}) => {
    const res = await h(new Request("https://nosca.netlify.app/.netlify/functions/lesson-import", { method: "POST", headers: { authorization: TOKEN, "content-type": "application/json", "x-nf-client-connection-ip": "1.2.3.4", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  return { calls, post, logs, h };
}

/* ---------- GET ---------- */
{
  const get = async (env) => (await (await makeHandler({ env })(new Request("https://x/.netlify/functions/lesson-import"))).json()).ready;
  check("GET is ready only with all three settings", (await get(ENV)) === true && (await get({ ...ENV, ANTHROPIC_API_KEY: "" })) === false && (await get({ ...ENV, SUPABASE_URL: "" })) === false && (await get({ ...ENV, SUPABASE_SERVICE_ROLE_KEY: "" })) === false);
}
/* ---------- the order of refusals ---------- */
{
  const w = world({ env: { ...ENV, ANTHROPIC_API_KEY: "" } });
  const r = await w.post(day());
  check("no key: unavailable, and nothing asked", r.status === 200 && r.body.status === "unavailable" && w.calls.fetch.length === 0, r);
}
{
  const w = world();
  const r = await w.post(day(), { authorization: "" });
  const r2 = await w.post(day(), { authorization: "Bearer not-a-jwt" });
  check("no bearer of three parts: 401, with no fetch at all", r.status === 401 && r2.status === 401 && w.calls.fetch.length === 0, [r, r2]);
}
{
  const w = world({ gate: "ok" });
  let last = null; for (let i = 0; i < 121; i++) last = await w.post(day(), { "x-nf-client-connection-ip": "9.9.9.9" });
  const other = await w.post(day(), { "x-nf-client-connection-ip": "8.8.8.8" });
  check("the address's bucket: the 121st in a minute is busy, another address is not", last.body.status === "busy" && last.body.retryAfter === 30 && other.body.status === "ok", [last, other]);
}
{
  const w = world();
  const big = await w.post("x".repeat(BUDGET.bodyBytes + 1));
  const over = await w.post(day({ segs: Array.from({ length: BUDGET.segments + 1 }, (_, i) => ({ part: "day", a: "C", id: i + 1, text: "Line." })) }));
  const words = await w.post(day({ segs: [{ part: "day", a: "P", text: "I'm sick this week" }, { part: "day", a: "C", id: 1, text: "Putting." }] }));
  const pid = await w.post(day({ segs: [{ part: "day", a: "P", id: 1, text: "[message]" }] }));
  const ver = await w.post(day({ v: "0" }));
  const extra = await w.post({ ...day(), name: "Cian" });
  check("over 16,384 bytes, over budget, a player-side line carrying words, a number on a player-side line, a wrong version, a field too many: 400, and no gate",
    [big, over, words, pid, ver, extra].every((r) => r.status === 400) && w.calls.fetch.length === 0, [big.status, over.status, words.status, pid.status, ver.status, extra.status]);
}
{
  const a = world({ gateStatus: 401, gate: { message: "JWT expired" } }); const ra = await a.post(day());
  const b = world({ gate: "no" }); const rb = await b.post(day());
  const c = world({ gate: "over" }); const rc = await c.post(day());
  check("the gate: 401 → 401, no → 403, over → over, and no call to the model", ra.status === 401 && rb.status === 403 && rc.body.status === "over" && !a.calls.create.length && !b.calls.create.length && !c.calls.create.length, [ra, rb, rc]);
  const g = a.calls.fetch[0];
  check("the gate is asked as the user: their bearer in Authorization, the service key as apikey, the player in the body",
    g.url === "https://mock.supabase.co/rest/v1/rpc/import_gate" && g.init.headers.authorization === TOKEN && g.init.headers.apikey === "service-role" && JSON.parse(g.init.body).p_player === PLAYER, g);
}
/* ---------- the request to the model ---------- */
{
  const w = world();
  const r = await w.post(day());
  const p = w.calls.create[0] || {};
  check("one call: the model, low effort, US inference, a JSON schema", r.body.status === "ok" && p.model === "claude-opus-5-5" && MODEL === "claude-opus-5-5" && p.output_config.effort === "low" && p.inference_geo === "us" && p.output_config.format.type === "json_schema" && p.max_tokens === 8000, p);
  check("no fallbacks and no betas by default", !("fallbacks" in p) && !("betas" in p) && w.calls.beta.length === 0);
  check("two system blocks, the cache on the second only", Array.isArray(p.system) && p.system.length === 2 && !p.system[0].cache_control && p.system[1].cache_control && p.system[1].cache_control.type === "ephemeral" && p.system[0].text === INSTRUCTIONS);
  check("no temperature, top_p, top_k, thinking, tool_choice, tools, stream or prefill", ["temperature", "top_p", "top_k", "thinking", "tool_choice", "tools", "stream"].every((k) => !(k in p)) && p.messages.length === 1 && p.messages[0].role === "user");
  check("no retries, and the timeout is min(7000, the deadline)", w.calls.opts[0].maxRetries === 0 && w.calls.opts[0].timeout === 7000, w.calls.opts[0]);
  const w2 = world({ env: { ...ENV, NOSCA_IMPORT_FALLBACK: "on", NOSCA_IMPORT_MODEL: "claude-opus-5-5", NOSCA_IMPORT_EFFORT: "medium" } });
  await w2.post(day());
  const b = w2.calls.beta[0] || {};
  check("with the fallback switched on, the beta call names claude-opus-4-8", b.betas && b.betas[0] === "server-side-fallback-2026-07-01" && b.fallbacks[0].model === "claude-opus-4-8" && b.output_config.effort === "medium" && !w2.calls.create.length, b);
  let t = 0; const slow = world({ clock: () => { t += 3000; return t; } });
  const rs = await slow.post(day());
  check("a deadline under three seconds answers busy and calls nothing", rs.body.status === "busy" && rs.body.retryAfter === 2 && slow.calls.create.length === 0, rs);
  const lim = world({ env: { ...ENV, NOSCA_FN_LIMIT_MS: "8000" } }); await lim.post(day());
  check("the timeout follows the function's own limit", lim.calls.opts[0].timeout === 6500, lim.calls.opts[0]);
  const two = world(); await two.post(day()); await two.post(day({ segs: [{ part: "day", a: "C", id: 1, text: "Bunker lesson today." }] }));
  check("the system text is byte-identical across two days of one sport, and holds no name", JSON.stringify(two.calls.create[0].system) === JSON.stringify(two.calls.create[1].system) && !/Niamh|Cian|Saoirse/.test(JSON.stringify(two.calls.create[0].system)));
  check("the schema's areas are each sport's own ids, all six", ["golf", "tennis", "rowing", "squash", "padel", "equestrian"].every((s) => JSON.stringify(schemaFor(s).properties.focus.items.enum) === JSON.stringify(FOCUS[s].map((a) => a.id))));
  check("the taxonomy block is built from the sport's areas", taxonomyBlock("golf").startsWith("Sport: Golf. Areas:\nswing — Full swing (Driver, Fairway woods"));
  check("the block numbers only the coach's lines of the day", renderBlock(day()).split("\n").filter((l) => l.startsWith("#")).length === 2 && /\[before\]\nC: From last week/.test(renderBlock(day())));
}
/* ---------- answers and errors ---------- */
{
  const ok = (answer) => world({ answer });
  const ref = await ok({ stop_reason: "refusal", content: [], usage: {} }).post(day());
  const mt = await ok({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }], usage: {} }).post(day());
  check("a refusal is review, max_tokens is retry", ref.body.status === "review" && mt.body.status === "retry", [ref, mt]);
  const H = (h) => new Headers(h || {});
  const err = (status, body, headers) => () => Anthropic.APIError.generate(status, body, "x", H(headers));
  const cases = [
    ["a spend limit", err(429, { type: "error", error: { type: "rate_limit_error", message: "m", details: { error_code: "enforced_spend_limit_reached" } } }), { status: "paused" }],
    ["a 429 with retry-after", err(429, { type: "error", error: { type: "rate_limit_error", message: "m" } }, { "retry-after": "12" }), { status: "busy", retryAfter: 12 }],
    ["a 429 without", err(429, { type: "error", error: { type: "rate_limit_error", message: "m" } }), { status: "busy", retryAfter: 5 }],
    ["402", err(402, { type: "error", error: { type: "billing_error", message: "m" } }), { status: "paused" }],
    ["401 from the model", err(401, { type: "error", error: { type: "authentication_error", message: "m" } }), { status: "unavailable" }],
    ["403 from the model", err(403, { type: "error", error: { type: "permission_error", message: "m" } }), { status: "unavailable" }],
    ["413", err(413, { type: "error", error: { type: "request_too_large", message: "m" } }), { status: "retry" }],
    ["400", err(400, { type: "error", error: { type: "invalid_request_error", message: "m" } }), { status: "failed" }],
    ["529", err(529, { type: "error", error: { type: "overloaded_error", message: "m" } }), { status: "busy", retryAfter: 2 }],
    ["500", err(500, { type: "error", error: { type: "api_error", message: "m" } }), { status: "busy", retryAfter: 2 }],
    ["a connection error", () => new Anthropic.APIConnectionError({ message: "down" }), { status: "busy", retryAfter: 2 }],
    ["a timeout", () => new Anthropic.APIConnectionTimeoutError(), { status: "busy", retryAfter: 2 }],
  ];
  for (const [name, thrower, want] of cases) {
    const e = thrower();
    const r = await world({ throws: thrower }).post(day());
    check(`${name} (${e.constructor.name}) → ${JSON.stringify(want)}`, r.status === 200 && JSON.stringify(r.body) === JSON.stringify(want), r);
  }
  const odd = await world({ throws: () => new TypeError("boom") }).post(day());
  check("anything else is a 500 that reads busy", odd.status === 500 && odd.body.status === "busy", odd);
  const dirty = await ok({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ day: "lesson", focus: ["PUTT", "driving", "putt"], note: [1, 7, 1], tip: [2, 1], drills: [3] }) }], usage: {} }).post(day());
  check("an unknown area and an unissued number are removed, a tip is one", JSON.stringify(dirty.body) === JSON.stringify({ status: "ok", day: "lesson", focus: ["putt"], note: [1], tip: [2], drills: [] }), dirty.body);
  const chat = await ok({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ day: "chat", focus: ["putt"], note: [1], tip: [2], drills: [] }) }], usage: {} }).post(day());
  check("chat empties the lists", JSON.stringify(chat.body) === JSON.stringify({ status: "ok", day: "chat", focus: [], note: [], tip: [], drills: [] }), chat.body);
}
/* ---------- what is logged ---------- */
{
  const spy = []; const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(orig)) console[k] = (...a) => spy.push(a.join(" "));
  const w = makeHandler({ fetch: async () => new Response('"ok"', { status: 200 }), env: ENV, anthropic: () => ({ messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ day: "lesson", focus: ["putt"], note: [1], tip: [], drills: [] }) }], usage: { input_tokens: 5, cache_read_input_tokens: 3, inference_geo: "us" } }) } }) });
  await w(new Request("https://x/.netlify/functions/lesson-import", { method: "POST", headers: { authorization: TOKEN, "x-nf-client-connection-ip": "4.4.4.4" }, body: JSON.stringify(day()) }));
  for (const k of Object.keys(orig)) console[k] = orig[k];
  const all = spy.join("\n");
  check("the log holds counts, usage and the stop reason, never the chat or the answer", spy.length >= 1 && /cache_read_input_tokens/.test(all) && /inference_geo/.test(all) && !/Putting lesson|green reading|pace first|"focus"|"note"|opus/i.test(all), all);
}
console.log(`\nimport-relay: ${pass}/${pass + fail} passed`);
