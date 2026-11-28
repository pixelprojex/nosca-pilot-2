#!/usr/bin/env node
/* THE IMPORT'S HOURLY SWEEP, WITHOUT A NETWORK.
 *
 *   node scripts/e2e/import-sweep.mjs
 *
 * netlify/functions/import-sweep.mjs is built with makeSweep({ fetch, env,
 * log }): fetch here is a little Supabase — the four functions and the
 * Storage API's list and delete over an in-memory bucket — so the test reads
 * exactly which calls were made, in which order, and what was removed.
 */
import { makeSweep } from "../../netlify/functions/import-sweep.mjs";

let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) { pass++; console.log("PASS ", name); } else { fail++; console.log("FAIL ", name, got === undefined ? "" : ` — ${JSON.stringify(got).slice(0, 300)}`); } };
const ENV = { SUPABASE_URL: "https://mock.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" };
const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const name = (i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000.mp4`;

/* a world: the batches due, the files in the bucket, the paths a lesson_media row still names */
function world({ due = [], files = {}, refs = {}, expire = {}, failDelete = false, env = ENV } = {}) {
  const calls = [];
  const bucket = new Set(Object.entries(files).flatMap(([id, n]) => Array.from({ length: n }, (_, i) => `import/${id}/${name(i)}`)));
  const ok = (body) => new Response(body === undefined ? "" : JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const fetch = async (url, init = {}) => {
    const u = new URL(String(url)); const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ path: u.pathname, method: init.method, body, auth: init.headers && (init.headers.Authorization || init.headers.authorization), apikey: init.headers && init.headers.apikey });
    if (u.pathname === "/rest/v1/rpc/import_sweep_due") return ok(due);
    if (u.pathname === "/rest/v1/rpc/import_expire") return ok(expire[body.p_id] === undefined ? "done" : expire[body.p_id]);
    if (u.pathname === "/rest/v1/rpc/import_refs") return ok(refs[body.p_id] || []);
    if (u.pathname === "/rest/v1/rpc/import_swept") return ok();
    if (u.pathname === "/storage/v1/object/list/media") {
      const all = [...bucket].filter((p) => p.startsWith(body.prefix)).sort().map((p) => ({ name: p.slice(body.prefix.length), id: "x" }));
      return ok(all.slice(body.offset, body.offset + body.limit));
    }
    if (u.pathname === "/storage/v1/object/media" && init.method === "DELETE") {
      if (failDelete) return new Response("{}", { status: 500 });
      for (const p of body.prefixes) bucket.delete(p);
      return ok(body.prefixes.map((p) => ({ name: p })));
    }
    return new Response("{}", { status: 404 });
  };
  const logs = [];
  const sweep = makeSweep({ fetch, env, log: (...a) => logs.push(a.join(" ")) });
  return { calls, bucket, logs, run: async (context) => { const r = await sweep(new Request("https://x/.netlify/functions/import-sweep", { method: "POST" }), context); return { status: r.status, body: await r.json() }; } };
}

{
  const app = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 }, env: { ...ENV, SITE_NAME: "nosca" } });
  const r = await app.run();
  const byUrl = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 }, env: { ...ENV, URL: "https://nosca.netlify.app" } });
  const r2 = await byUrl.run();
  const byCtx = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 } });
  const r3 = await byCtx.run({ site: { name: "nosca", url: "https://nosca.netlify.app" } });
  check("on the app's own site it does nothing at all, by its name, its address or the handler's context", [r, r2, r3].every((x) => x.status === 200 && x.body.skipped) && !app.calls.length && !byUrl.calls.length && !byCtx.calls.length, [r, r2, r3]);
  const first = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 }, env: { ...ENV, SITE_NAME: "nosca-pilot-2", URL: "https://nosca-pilot-2.netlify.app" } });
  const rf = await first.run();
  const single = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 }, env: { ...ENV, SITE_NAME: "nosca-coach" } });
  const rs = await single.run();
  check("the first site sweeps, and so does a single site", rf.body.removed === 3 && rs.body.removed === 3 && first.bucket.size === 0 && single.bucket.size === 0, [rf, rs]);
}
{
  const w = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 3 }, env: { SUPABASE_URL: "https://mock.supabase.co" } });
  const r = await w.run();
  check("without the service key it says so and asks nothing", r.body.skipped && !w.calls.length, r);
}
{
  const w = world({ due: [], files: { [B1]: 3 } });
  const r = await w.run();
  check("nothing due: one question, nothing removed", w.calls.length === 1 && w.calls[0].path === "/rest/v1/rpc/import_sweep_due" && r.body.due === 0 && w.bucket.size === 3, r);
  check("every call carries the service key", w.calls.every((c) => c.apikey === "service-role" && /^Bearer service-role$/.test(c.auth || "")), w.calls[0]);
}
{
  const w = world({ due: [{ id: B1, status: "adding" }], files: { [B1]: 4 }, refs: { [B1]: [`import/${B1}/${name(0)}`, `import/${B1}/${name(1)}`] } });
  const r = await w.run();
  const order = w.calls.map((c) => c.path.replace(/^\/rest\/v1\/rpc\/|^\/storage\/v1\/object\//, ""));
  check("an idle batch is finished first, then swept", order[1] === "import_expire" && w.calls[1].body.p_id === B1 && r.body.expired === 1 && r.body.removed === 2 && w.bucket.has(`import/${B1}/${name(0)}`) && !w.bucket.has(`import/${B1}/${name(2)}`), { order, r });
  const t = world({ due: [{ id: B1, status: "adding" }], files: { [B1]: 4 }, expire: { [B1]: null } });
  const rt = await t.run();
  check("a batch touched since it was found is not expired and nothing of it is removed", rt.body.expired === 0 && rt.body.removed === 0 && t.bucket.size === 4 && !t.calls.some((c) => /list|import_swept|import_refs/.test(c.path)), rt);
}
{
  const refs = Array.from({ length: 20 }, (_, i) => `import/${B1}/${name(i * 10)}`);
  const w = world({ due: [{ id: B1, status: "removed" }, { id: B2, status: "done" }], files: { [B1]: 250, [B2]: 2 }, refs: { [B1]: refs, [B2]: [`import/${B2}/${name(0)}`, `import/${B2}/${name(1)}`] } });
  const r = await w.run();
  const dels = w.calls.filter((c) => c.method === "DELETE");
  const b1 = dels.filter((c) => c.body.prefixes.every((p) => p.includes(B1)));
  const sweptAt = w.calls.findIndex((c) => c.path.endsWith("import_swept") && c.body.p_id === B1);
  const lastDel = w.calls.map((c, i) => (c.method === "DELETE" && c.body.prefixes[0].includes(B1) ? i : -1)).filter((i) => i >= 0).pop();
  check("only the unreferenced are removed: 230 of 250, the 20 named kept", r.body.removed === 230 && refs.every((p) => w.bucket.has(p)) && [...w.bucket].filter((p) => p.includes(B1)).length === 20, r);
  check("a hundred at a time", b1.length === 3 && b1[0].body.prefixes.length === 100 && b1[1].body.prefixes.length === 100 && b1[2].body.prefixes.length === 30, b1.map((c) => c.body.prefixes.length));
  check("import_swept comes last for each batch, after its every removal", sweptAt > lastDel && w.calls.filter((c) => c.path.endsWith("import_swept")).length === 2, { sweptAt, lastDel });
  check("a batch whose files are all named loses none", [...w.bucket].filter((p) => p.includes(B2)).length === 2 && !dels.some((c) => c.body.prefixes.some((p) => p.includes(B2))));
  check("nothing outside the batch's own folder is ever asked for", w.calls.filter((c) => c.path.endsWith("/list/media")).every((c) => /^import\/[0-9a-f-]{36}\/$/.test(c.body.prefix)) && dels.every((c) => c.body.prefixes.every((p) => /^import\/[0-9a-f-]{36}\/[^/]+$/.test(p))));
}
{
  const w = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 1000 } });
  const r = await w.run();
  const lists = w.calls.filter((c) => c.path.endsWith("/list/media"));
  check("a page of exactly 1,000 asks for the next, and all 1,000 go", lists.length === 2 && lists[0].body.limit === 1000 && lists[1].body.offset === 1000 && r.body.removed === 1000 && w.bucket.size === 0, { lists: lists.map((c) => c.body), r });
  const w2 = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 1005 }, refs: { [B1]: [`import/${B1}/${name(1004)}`] } });
  const r2 = await w2.run();
  check("1,005 files over two pages: 1,004 removed, the one named kept", r2.body.removed === 1004 && w2.bucket.size === 1 && w2.bucket.has(`import/${B1}/${name(1004)}`), r2);
}
{
  const w = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 5 }, failDelete: true });
  const r = await w.run();
  check("a refused removal is a 500 and the batch is not marked swept, so the next hour finds it again", r.status === 500 && !w.calls.some((c) => c.path.endsWith("import_swept")), r);
  check("the log holds counts, never a path", w.logs.length === 1 && !/import\/[0-9a-f]/.test(w.logs.join("")) && /"due":1/.test(w.logs[0]), w.logs);
  const ok = world({ due: [{ id: B1, status: "done" }], files: { [B1]: 5 } }); await ok.run();
  check("a clean run logs its counts in one line", ok.logs.length === 1 && /"removed":5/.test(ok.logs[0]) && !/import\//.test(ok.logs[0]), ok.logs);
}
console.log(`\nimport-sweep: ${pass}/${pass + fail} passed`);
