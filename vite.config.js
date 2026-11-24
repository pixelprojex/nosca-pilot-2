import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

/* THE BUILD KNOWS WHEN IT WAS MADE. The time is stamped into the bundle
   (Settings › Version reads it) and written to /version.json beside
   index.html, which the running app compares itself against whenever
   it comes back to the front. A home-screen app that is only
   backgrounded resumes the bundle it was opened with, so a deploy
   appeared to do nothing until the phone killed and relaunched it —
   and the founder reported the fix missing in between, three times. */
const BUILT = new Date().toISOString();
/* THE SHELL, LISTED FOR THE PHONE. /precache.json names this build's
   files so the service worker can keep a copy for when there is no
   network — the fallback behind a download, never what an online open
   is served (sw.js goes to the network first for every navigation, so
   a deploy still shows up the moment the app is relaunched). The
   hashed assets are immutable, so a cached one is never wrong. */
const SHELL_EXTRAS = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon.svg", "/icons/badge-96.png"];
/* A BUILD THAT KNOWS ITS DATABASE SAYS SO. /ready.png is written only
   when the build was given the Supabase address and key; without them
   the bundle throws "supabaseUrl is required" on its first line and the
   app is a blank page. The printed business cards' first address hops
   to the app's own only once /ready.png loads there (index.html, the
   signpost): on 24 November the second Netlify site went public built
   without its environment, every scanned card was sent to a blank page,
   and the old probe — a picture every build ships — had said all was
   well. A picture, because a picture loads across sites where a fetch
   may not; a missing one is the catch-all's index.html, which no <img>
   takes for a picture. */
const READY = "ready.png";
const buildStamp = (env) => ({
  name: "nosca-build-stamp",
  generateBundle(_, bundle) {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ built: BUILT }) });
    if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) this.emitFile({ type: "asset", fileName: READY, source: readFileSync(new URL("./public/icons/icon-192.png", import.meta.url)) });
    const built = Object.keys(bundle).filter((f) => !/^(version|precache)\.json$/.test(f) && f !== "sw.js").map((f) => "/" + f);
    const files = Array.from(new Set([...SHELL_EXTRAS, ...built]));
    this.emitFile({ type: "asset", fileName: "precache.json", source: JSON.stringify({ built: BUILT, files }) });
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), buildStamp({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env })],
  define: { "import.meta.env.VITE_BUILD_TIME": JSON.stringify(BUILT) },
}));
