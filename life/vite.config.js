import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build time is stamped into the bundle so Settings can say which
// build a phone is running (the lesson from Nosca: a home-screen app
// that is only backgrounded keeps the bundle it opened with).
export default defineConfig({
  plugins: [react()],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
