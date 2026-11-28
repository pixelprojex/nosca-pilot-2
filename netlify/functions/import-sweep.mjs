/* THE IMPORT'S SWEEP — a Netlify scheduled function, hourly (docs/import/SPEC.md).
 *
 * Deleting an imported file is the server's job and nobody else's: no
 * client may delete under import/. Every hour this asks the database which
 * batches are due — finished or removed and touched since their last
 * sweep, or left filling for a week — finishes a week-idle one with what
 * is in (its one notice goes then), lists the batch's folder, and removes
 * every file there that no lesson_media row names: Remove, one lesson, a
 * coach's own delete, a cascade, Mark it up replacing an original, uploads
 * never committed, files the server skipped. Then the batch is marked
 * swept — last, so a touch since makes it due again — and a removed batch
 * with nothing left goes. Storage is deleted through the Storage API only,
 * never from SQL. It logs counts, never a path.
 *
 * One database is swept once an hour, not twice: like digest.mjs it runs
 * on the first site, whose service key has done every server job there
 * has been, and returns at once on the app's own site (lib/signpost.mjs);
 * a single site built from this repository sweeps.
 */
import { json, projectUrl, restHeaders } from "./lib/push-shared.mjs";
import { isAppSite } from "./lib/signpost.mjs";

export const config = { schedule: "17 * * * *" };
const PAGE = 1000, CHUNK = 100;

export function makeSweep({ fetch: doFetch = (...a) => fetch(...a), env = process.env, log = (...a) => console.log(...a) } = {}) {
  const base = () => projectUrl(env);
  const rpc = async (fn, args) => {
    const r = await doFetch(`${base()}/rest/v1/rpc/${fn}`, { method: "POST", headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY), body: JSON.stringify(args || {}) });
    if (!r.ok) throw new Error(`${fn} ${r.status}`);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
  /* every file under import/<id>/, a thousand at a time, until a short page */
  const listAll = async (id) => {
    const names = [];
    for (let offset = 0; ; offset += PAGE) {
      const r = await doFetch(`${base()}/storage/v1/object/list/media`, { method: "POST", headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
        body: JSON.stringify({ prefix: `import/${id}/`, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }) });
      if (!r.ok) throw new Error(`list ${r.status}`);
      const page = await r.json();
      for (const f of page || []) if (f && f.name && f.id !== null) names.push(`import/${id}/${f.name}`);
      if (!page || page.length < PAGE) return names;
    }
  };
  return async (_req, context) => {
    if (isAppSite(env, context)) return json({ skipped: "the app's own site: the first site sweeps" });
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ skipped: "no database keys on this site" });
    const out = { due: 0, expired: 0, removed: 0, swept: 0 };
    try {
      const due = (await rpc("import_sweep_due")) || [];
      out.due = due.length;
      for (const b of due) {
        /* a batch filling is swept only once it is finished: touched since it was found, it is left alone */
        if (b.status === "adding") { const st = await rpc("import_expire", { p_id: b.id }); if (!st) continue; out.expired += 1; }
        const refs = new Set((await rpc("import_refs", { p_id: b.id })) || []);
        const gone = (await listAll(b.id)).filter((p) => !refs.has(p));
        for (let i = 0; i < gone.length; i += CHUNK) {
          const r = await doFetch(`${base()}/storage/v1/object/media`, { method: "DELETE", headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY), body: JSON.stringify({ prefixes: gone.slice(i, i + CHUNK) }) });
          if (!r.ok) throw new Error(`remove ${r.status}`);
          out.removed += Math.min(CHUNK, gone.length - i);
        }
        await rpc("import_swept", { p_id: b.id });
        out.swept += 1;
      }
      log("import-sweep", JSON.stringify(out));
      return json(out);
    } catch (e) {
      log("import-sweep", JSON.stringify({ ...out, error: String((e && e.message) || e).replace(/import\/\S+/g, "…") }));
      return json({ ...out, error: true }, 500);
    }
  };
}

export default makeSweep();
