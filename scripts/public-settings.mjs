/* THE APP'S OWN SITE, WITHOUT ITS VARIABLES (24 November).
 *
 * nosca.netlify.app was made with no environment, and the founder cannot
 * set one: built so, its app throws "supabaseUrl is required" on its first
 * line and is a blank page. The three settings it lacks are public by
 * design — the database's address, its anon key and the push service's
 * public key: the first site hands all three to every visitor, inlined in
 * the app's bundle, and row-level security, not the key, guards the data.
 *
 * They are NOT written into the repository: the first site holds the same
 * three as variables, and Netlify's secret scanning fails its build when a
 * site variable's value turns up in a repository file (its deploy preview
 * failed that way). So a Netlify build that names no database reads them
 * from the first site's live app, as a browser would, and checks each one
 * before taking it: the address is a Supabase project's; the key is a
 * Supabase anon key for that same project; the push key is a P-256 point.
 * Anything short of that and the build takes nothing.
 *
 * A build left with no database forwards its own address to the first
 * site (forwardScript), so the app's own address is never a blank page: a
 * person who opens it lands on the app where it has always worked, until
 * the build is given its settings. The first site's signpost (index.html)
 * hops the other way only once /ready.png loads here, which only a build
 * with its database writes — the two never send a person back and forth.
 *
 * A variable set on the site, in the shell or in a .env file wins, and
 * then none of this runs. */

export const FIRST_SITE = "https://nosca-pilot-2.netlify.app";
export const APP_HOST = "nosca.netlify.app";

const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/* the three, read off the scripts a page loads; null unless all of the address and the key check out */
export function settingsFromScripts(scripts) {
  const text = scripts.join("\n");
  const url = (text.match(/https:\/\/([a-z0-9]{20})\.supabase\.co(?![a-z0-9.-])/) || [])[0];
  if (!url) return null;
  const ref = url.slice("https://".length, "https://".length + 20);
  const anon = (text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []).find((t) => {
    try {
      const claims = JSON.parse(fromB64url(t.split(".")[1]).toString("utf8"));
      return claims && claims.iss === "supabase" && claims.role === "anon" && claims.ref === ref;
    } catch { return false; }
  });
  if (!anon) return null;
  const out = { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon };
  /* an uncompressed P-256 point: 65 bytes, the first of them 4 */
  const vapid = (text.match(/["'`](B[A-Za-z0-9_-]{86})["'`]/g) || []).map((q) => q.slice(1, -1)).find((k) => {
    const b = fromB64url(k);
    return b.length === 65 && b[0] === 4;
  });
  if (vapid) out.VITE_VAPID_PUBLIC_KEY = vapid;
  return out;
}

/* the page's own scripts, as its <script src> and modulepreload links name them */
export function scriptsOf(html) {
  const found = new Set();
  for (const m of String(html).matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\/assets\/[^"]+\.js)"[^>]*>/g)) found.add(m[1]);
  return [...found];
}

/* the first site's live app, read the way a browser reads it; never throws, null when anything falls short */
export async function settingsFromSite(home = FIRST_SITE, fetcher = globalThis.fetch, ms = 15000) {
  try {
    const get = async (path) => {
      const res = await fetcher(home + path, { signal: AbortSignal.timeout(ms), headers: { "cache-control": "no-cache" } });
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.text();
    };
    const html = await get("/");
    const paths = scriptsOf(html);
    if (!paths.length) return null;
    return settingsFromScripts(await Promise.all(paths.map(get)));
  } catch {
    return null;
  }
}

/* a build with no database: its own address sends a person to the same page of the first site, before anything loads */
export const forwardScript = (host = APP_HOST, to = FIRST_SITE) =>
  `<script>(function (l) { if (l.hostname === ${JSON.stringify(host)}) l.replace(${JSON.stringify(to)} + l.pathname + l.search + l.hash); })(location);</script>`;
