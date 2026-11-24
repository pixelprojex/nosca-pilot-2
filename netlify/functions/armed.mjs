/* Is this site armed to send pushes and summaries? — Netlify Function.
 *
 * The app is deployed to two Netlify sites from this repository (see
 * lib/signpost.mjs). The keys a sender needs — the service role key and
 * the VAPID private key — are secrets, so they live only in a site's own
 * environment, and the app's own site may be built without them. The
 * daily summary must go out exactly once: the signpost's scheduled run
 * asks this endpoint on the app's own site whether that site will send
 * it, and sends it itself when the answer is no (digest.mjs).
 *
 * It answers true or false and nothing else — never a value, never
 * which name is missing.
 */
import { json, REQUIRED } from "./lib/push-shared.mjs";

export default async () => json({ armed: REQUIRED.every((name) => !!process.env[name]) }, 200);
