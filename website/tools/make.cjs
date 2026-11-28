#!/usr/bin/env node
/* Every picture of the app on the website, remade from the app as it is: one command a set.
   node website/tools/make.cjs <set> [--dist <build>] [--port 5850] [--raw <dir>] [--only <steps>]
     stills       the stills in assets/ (coach-*, player-*, parent-*, junior-*, product-*, partners-*, splash-*)
     log          assets/seq/log          logging a lesson (Home, Product)
     register     assets/seq/register     the register from the day (Story)
     pt-register  assets/seq/pt-register  the clinic's register at 5:10 pm (Partners)
     pd-feed      assets/seq/pd-feed      a player's feed on the putting green (Home, Product)
     feed         assets/seq/feed         the same on the e2e suite's clip (kept for the tools)
     plus         motion-plus-golf.mp4 and seq/plus/plus-scrub.mp4, with their posters
     all          every one of them, from one build
   --dist   a mock build of the app (see lib.cjs); without it, one is built into <tmp>/nosca-site-mock first
   --raw    where the raw frames go, a folder a set (default <tmp>/nosca-site-raw/<set>), there to look at afterwards
   --only   stills only: the shoot.cjs steps to take (home,peek,...), writing only the stills they make
   Needs Playwright (PLAYWRIGHT_MODULE, as the e2e suites), python3 with Pillow, and ffmpeg for plus. */
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../.."), TOOLS = __dirname, ASSETS = path.join(ROOT, "website", "assets");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const set = argv[0];
const SEQS = {
  log: { tool: "seq/seq-log.cjs", spec: "home:1,plus:10,who:8,page:9,chipping:4,putting:4,logged:22", q: 72 },
  register: { tool: "seq/seq-register.cjs", spec: "home:1,peek:7,open:8,m0:5,m1:4,m2:5,m3:4,submit:2", q: 72 },
  "pt-register": { tool: "seq/seq-pt-register.cjs", spec: "home:1,open:8,m0:6,m1:6,m2:6,m3:7,submit:8", q: 74 },
  "pd-feed": { tool: "seq/seq-feed.cjs", args: ["green"], spec: "first:1,to1:14,to2:14", q: 74 },
  feed: { tool: "seq/seq-feed.cjs", args: ["synthetic"], spec: "first:1,to1:14,to2:14", q: 76 },
};
const SETS = ["stills", ...Object.keys(SEQS), "plus"];
if (!SETS.includes(set) && set !== "all") { console.error(`node website/tools/make.cjs <${SETS.join("|")}|all> [--dist <build>] [--port 5850] [--raw <dir>] [--only <steps>]`); process.exit(2); }

const run = (cmd, args, env = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
const port = opt("port", "5850");
/* the raw frames: <tmp>/nosca-site-raw/<set>, cleared first (it is ours); under --raw, <dir>/<set>, which must be new or empty */
const rawFor = (s) => {
  const mine = !opt("raw"), d = path.join(path.resolve(opt("raw", path.join(os.tmpdir(), "nosca-site-raw"))), s);
  if (mine) fs.rmSync(d, { recursive: true, force: true });
  else if (fs.existsSync(d) && fs.readdirSync(d).length) { console.error(`${d} is not empty: give --raw a new folder`); process.exit(2); }
  fs.mkdirSync(d, { recursive: true }); return d;
};

let dist = opt("dist");
if (!dist) {
  dist = path.join(os.tmpdir(), "nosca-site-mock");
  fs.rmSync(dist, { recursive: true, force: true });
  console.log(`building the app against the mock into ${dist}`);
  run("npx", ["vite", "build", "--outDir", dist], { VITE_SUPABASE_URL: "https://mock.supabase.co", VITE_SUPABASE_ANON_KEY: "mock", VITE_SUPPORT_EMAIL: "help@nosca.ie" });
}
dist = path.resolve(dist);

for (const s of set === "all" ? SETS : [set]) {
  const raw = rawFor(s);
  console.log(`\n── ${s} (raw frames in ${raw})`);
  if (s === "stills") {
    const only = opt("only");
    run("node", [path.join(TOOLS, "shoot.cjs"), dist, port, raw, ...(only ? [only] : [])]);
    run("python3", [path.join(TOOLS, "stills.py"), raw, ASSETS, ...(only ? ["--present"] : [])]);
  } else if (s === "plus") {
    run("node", [path.join(TOOLS, "motion.cjs"), dist, port, raw]);
    run("python3", [path.join(TOOLS, "motion-encode.py"), raw, ASSETS]);
  } else {
    const q = SEQS[s];
    run("node", [path.join(TOOLS, q.tool), dist, port, raw, ...(q.args || [])]);
    run("python3", [path.join(TOOLS, "seq", "seq-encode.py"), raw, path.join(ASSETS, "seq", s), s, q.spec, "660", String(q.q)]);
  }
}
console.log("\nDone. Look at what changed before you commit it: git status website/assets");
