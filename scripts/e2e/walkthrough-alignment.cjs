/* Drives the four walkthroughs in the ?demo harness and checks every
   ring against its target. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = require("path").resolve(__dirname, "../..");
const SHOTS = process.env.SHOTS || require("path").join(__dirname, "../../.e2e-out/tour-shots");
const PORT = 4190;
const ONLY = process.argv[2] ? process.argv[2].split(",") : null;

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
  await page.route(/fontshare|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  const consoleLog = [];
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") consoleLog.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => consoleLog.push("pageerror: " + e.message));

  const results = {};
  const roles = [
    ["coach", "Walkthrough — coach"],
    ["player", "Walkthrough — player"],
    ["parent", "Walkthrough — parent"],
    ["under18", "Walkthrough — under 18"],
  ].filter(([k]) => !ONLY || ONLY.includes(k));

  for (const [role, label] of roles) {
    await page.goto(`http://localhost:${PORT}/?demo`, { waitUntil: "load" });
    await page.waitForSelector("text=Scenarios", { timeout: 15000 });
    // the harness lands in the sign-up flow; jump into the app as the persona first so
    // "where it was" is a real screen
    await page.click("text=Scenarios");
    if (role === "coach") await page.click("text=Lesson waiting to be logged");
    else if (role === "parent") { await page.click("text=Brand-new player"); }
    else if (role === "under18") { await page.click("text=Under-18 account"); }
    else await page.click("text=Package running low");
    await sleep(900);
    const before = await page.evaluate(() => {
      const cur = document.querySelector('[aria-current="page"]');
      return { tab: cur ? cur.getAttribute("aria-label") : null, text: document.body.innerText.slice(0, 400) };
    });
    await page.click("text=Scenarios");
    await page.click(`text=${label}`);
    await sleep(2300);

    const rows = [];
    let n = 0;
    for (;;) {
      n++;
      await sleep(200);
      const info = await page.evaluate(() => {
        const ring = document.querySelector("[data-tour-ring]");
        const overlay = ring ? ring.closest("[data-tour-ring]") : null;
        const tourText = (document.querySelector("[data-tour-title]") || {}).textContent || "";
        const counter = (document.querySelector("[data-tour-counter]") || {}).textContent || "";
        if (!ring) return { ring: null, tourText, counter };
        const frame = ring.parentElement;
        const id = ring.getAttribute("data-for");
        const el = frame.querySelector(`[data-tour="${id}"]`);
        const r = ring.getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        const card = frame.parentElement.getBoundingClientRect();
        const k = f.width / 390;
        let e = null, visible = false;
        if (el) {
          const er = el.getBoundingClientRect();
          e = { x: er.left, y: er.top, w: er.width, h: er.height };
          const cs = getComputedStyle(el);
          visible = er.width > 0 && er.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"
            && er.top >= card.top - 1 && er.bottom <= card.bottom + 1 && er.left >= card.left - 1 && er.right <= card.right + 1;
        }
        return { ring: { x: r.left, y: r.top, w: r.width, h: r.height }, id, el: e, visible, k, tourText, counter,
                 card: { x: card.left, y: card.top, w: card.width, h: card.height } };
      });
      const [cur, total] = (info.counter || "0 / 0").split(" / ").map(Number);
      const shot = path.join(SHOTS, `${role}-${String(cur || n).padStart(2, "0")}.png`);
      // clip to the phone frame
      const phone = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll("div")).find((d) => d.style && d.style.borderRadius === "34px" && d.style.height === "768px");
        if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
      await page.screenshot({ path: shot, clip: phone || undefined });

      let dev = null, ok = false;
      if (info.ring && info.el) {
        const pad = 5 * info.k;  // the ring sits 5 frame-px outside the target
        const dx1 = Math.abs(info.ring.x - (info.el.x - pad));
        const dy1 = Math.abs(info.ring.y - (info.el.y - pad));
        const dx2 = Math.abs((info.ring.x + info.ring.w) - (info.el.x + info.el.w + pad));
        const dy2 = Math.abs((info.ring.y + info.ring.h) - (info.el.y + info.el.h + pad));
        dev = Math.max(dx1, dy1, dx2, dy2);
        const encloses = info.ring.x <= info.el.x + 0.5 && info.ring.y <= info.el.y + 0.5
          && info.ring.x + info.ring.w >= info.el.x + info.el.w - 0.5 && info.ring.y + info.ring.h >= info.el.y + info.el.h - 0.5;
        ok = dev <= 6 && encloses && info.visible;
      }
      rows.push({ step: cur || n, total, title: info.tourText, target: info.id || "(no ring)", dev: dev == null ? null : +dev.toFixed(2), visible: info.visible, ok });
      process.stdout.write(`${role} ${cur}/${total} ${info.tourText} → ${info.id || "NO RING"} dev=${dev == null ? "-" : dev.toFixed(2)} ${ok ? "ok" : "FAIL"}\n`);

      const isLast = cur === total;
      if (isLast) {
        await page.click("text=Start using it");
        await sleep(700);
        break;
      }
      await page.locator("button:not([data-tour])", { hasText: /^Next$/ }).last().click();
      await sleep(2100);
      if (n > 120) break;
    }
    const after = await page.evaluate(() => {
      const cur = document.querySelector('[aria-current="page"]');
      return { tab: cur ? cur.getAttribute("aria-label") : null, text: document.body.innerText.slice(0, 400), tourOpen: /Start using it/.test(document.body.innerText) };
    });
    results[role] = { rows, before, after, unchanged: before.tab === after.tab && before.text === after.text };
    process.stdout.write(`${role}: after close tab=${after.tab} unchanged=${results[role].unchanged}\n`);
  }

  fs.writeFileSync(path.join(SHOTS, `results-${(ONLY || ["all"]).join("-")}.json`), JSON.stringify({ results, consoleLog }, null, 2));
  const bad = Object.entries(results).flatMap(([r, v]) => v.rows.filter((x) => !x.ok).map((x) => `${r} ${x.step} ${x.target} dev=${x.dev} vis=${x.visible}`));
  console.log("\nFAILURES:", bad.length ? bad.join("\n") : "none");
  console.log("CONSOLE:", consoleLog.filter((l) => !/fontshare|Failed to load resource|net::ERR/.test(l)).slice(0, 40).join("\n") || "clean");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
