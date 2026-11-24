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
/* THE PUBLISHABLE SETTINGS, IN THE REPOSITORY (24 November). The app's
   database address and its anon key, and the push service's public key,
   are public by design: every visitor's browser is handed all three in
   the bundle, and row-level security — not the key — is what guards the
   data (the service role key and the VAPID private key are secrets, and
   live only on Netlify, read by the functions). They are written here as
   the production build's defaults, so a Netlify site builds a working
   app without anyone setting a variable: the app's own site went public
   blank for want of exactly these, and the founder wants no manual step.
   A value set on the site, in the shell or in a .env file still wins —
   the e2e suites' mock builds name their own — and `vite` on a laptop
   (no build) keeps reading .env only, so nobody develops against the
   live database by accident. The anon key's role is "anon" and its
   project the URL's own; change all three together if the project
   changes. */
const PUBLISHABLE = {
  VITE_SUPABASE_URL: "https://kmihoqnmiokkbohaoxym.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttaWhvcW5taW9ra2JvaGFveHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNzQ2MDcsImV4cCI6MjEwMzg1MDYwN30.y9OuVqKpMx2131wZ-Rx7taCWyNJjiQTmvvcUCXyb7Lo",
  VITE_VAPID_PUBLIC_KEY: "BEBjMP9o0tQu4Kz0dz3sS6_77iKxNC_cTsQCrKIt3xmva1sEtmbHjXQpo5eGBTX8i7a1y80UsWi7FpYj8ROZWCI",
};
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

export default defineConfig(({ mode, command }) => {
  const files = loadEnv(mode, process.cwd(), "VITE_");
  /* a build that names no database takes the publishable set whole (one project's address, key and
     push key belong together — a build that names its own, the e2e mock or another project, takes none
     of it); set into process.env, they reach the bundle by Vite's own VITE_ prefix */
  if (command === "build" && !process.env.VITE_SUPABASE_URL && !files.VITE_SUPABASE_URL)
    for (const [k, v] of Object.entries(PUBLISHABLE)) if (!process.env[k] && !files[k]) process.env[k] = v;
  return {
    plugins: [react(), buildStamp({ ...files, ...process.env })],
    define: { "import.meta.env.VITE_BUILD_TIME": JSON.stringify(BUILT) },
  };
});
