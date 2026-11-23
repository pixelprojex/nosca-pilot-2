/* THE SIGNPOST SITE.
 *
 * The app is deployed from this repository to two Netlify sites: its
 * own (nosca) and the first one (nosca-pilot-2), whose address is in
 * the code printed on the business cards and so can never be given up.
 * The first one is a signpost now — index.html sends every page of it
 * to the same page of the app's own address — but Netlify still runs
 * this repository's scheduled functions on both sites, and a job that
 * sends something would send it twice. A scheduled function asks here
 * first and does nothing on the signpost.
 *
 * Netlify gives every function its site's name and main address as
 * read-only variables (SITE_NAME, URL), and the newer handler context
 * carries them too; all are read, so a runtime that offers only one of
 * them is still recognised. Anything unrecognised is NOT the signpost:
 * the job runs, which is the safe side for a single site.
 *
 * The relay (push.mjs) and resub.mjs are not guarded: each is called
 * by address — the database's `push_url`, a device's own origin — and
 * answers whoever calls it.
 */
export const SIGNPOST_SITE = "nosca-pilot-2";
export const SIGNPOST_HOST = `${SIGNPOST_SITE}.netlify.app`;

const hostOf = (value) => {
  if (typeof value !== "string" || !value) return "";
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); } catch { return ""; }
};

export function isSignpost(env = {}, context = undefined) {
  const names = [env.SITE_NAME, context && context.site && context.site.name];
  if (names.some((n) => typeof n === "string" && n.toLowerCase() === SIGNPOST_SITE)) return true;
  const urls = [env.URL, context && context.site && context.site.url];
  return urls.some((u) => hostOf(u) === SIGNPOST_HOST);
}
