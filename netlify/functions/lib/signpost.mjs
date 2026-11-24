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
 *
 * THE FIRST SITE SENDS (24 November). The secrets a sender needs live
 * only in a site's own environment. The first site's have sent every
 * push and every summary there has been — the database's `push_url` is
 * its relay — and the app's own site's are not to be trusted to: on the
 * day of the move they were there, so a check that they existed said
 * yes, while its database address did not parse and every read failed.
 * The summary going out from the app's own site that morning would have
 * gone out from nowhere. So the app's own site never sends what a
 * scheduled job sends (isAppSite), the first site always does, and a
 * site that is neither — a single site built from this repository —
 * sends, as before.
 */
export const SIGNPOST_SITE = "nosca-pilot-2";
export const SIGNPOST_HOST = `${SIGNPOST_SITE}.netlify.app`;
/* the app's own site, which the signpost sends every visitor to */
export const APP_SITE = "nosca";
export const APP_HOST = `${APP_SITE}.netlify.app`;

const hostOf = (value) => {
  if (typeof value !== "string" || !value) return "";
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); } catch { return ""; }
};

const isSite = (name, host) => (env = {}, context = undefined) => {
  const names = [env.SITE_NAME, context && context.site && context.site.name];
  if (names.some((n) => typeof n === "string" && n.toLowerCase() === name)) return true;
  const urls = [env.URL, context && context.site && context.site.url];
  return urls.some((u) => hostOf(u) === host);
};

export const isSignpost = isSite(SIGNPOST_SITE, SIGNPOST_HOST);
export const isAppSite = isSite(APP_SITE, APP_HOST);
