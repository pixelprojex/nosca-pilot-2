import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* THE BUILD KNOWS WHEN IT WAS MADE. The time is stamped into the bundle
   (Settings › Version reads it) and written to /version.json beside
   index.html, which the running app compares itself against whenever
   it comes back to the front. A home-screen app that is only
   backgrounded resumes the bundle it was opened with, so a deploy
   appeared to do nothing until the phone killed and relaunched it —
   and the founder reported the fix missing in between, three times. */
const BUILT = new Date().toISOString();
const buildStamp = () => ({
  name: "nosca-build-stamp",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ built: BUILT }) });
  },
});

export default defineConfig({
  plugins: [react(), buildStamp()],
  define: { "import.meta.env.VITE_BUILD_TIME": JSON.stringify(BUILT) },
});
