/* JOIN REQUESTS ARE PERSON ROWS. The coach's Requests screen — who has
   used their code and waits to be accepted — is the app's one person row
   per request, in one boxed list on the sport's edge: the face, the whole
   name, one grey line of facts (the sport, Under 18, the day they asked
   in the app's one date form), and Accept · Decline as the row's text
   actions, Accept in ink, beside the name where it fits and on a line of
   their own under it where it does not — the shape Today's booking
   requests and the bell's have. With nothing waiting the screen is a
   line, and the subtitle goes. Each request was a card with a 46px face,
   a filled success-green Accept and an outlined Decline, and the empty
   state a card with a tick in a disc and a sentence.
   Usage: node join-requests.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4362), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", eoin: "00000000-0000-4000-8000-000000e01e01", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";
const LONG = "Maximiliano Ó Súilleabháin";
const TODAY = M.ymd(new Date());
const dayFrom = (n) => { const x = new Date(`${TODAY}T12:00:00`); x.setDate(x.getDate() + n); return x; };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = (x) => `${DAYS[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]}`;
const EDGE_GOLF = "rgba(47, 107, 58, 0.72)";

function freshDb() {
  const db = M.emptyDb();
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("eoin", "eoin@t.ie", { role: "player", name: "Eoin Walsh", type: "adult", dob: "1994-06-06" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: LONG, type: "junior", familyId: FAM, dob: "2012-05-05" });
  M.setPrefs(db, IDS.coach, { availability: M.weekOf(["9:00 am", "10:00 am", "4:00 pm"], [0, 1, 2, 3, 4, 5, 6]) });
  /* two asking: an adult two days ago, a junior yesterday */
  M.addRequest(db, { playerId: IDS.eoin, coachId: IDS.coach, notify: true, createdAt: `${M.ymd(dayFrom(-2))}T10:00:00` });
  M.addRequest(db, { playerId: IDS.junior, coachId: IDS.coach, notify: true, createdAt: `${M.ymd(dayFrom(-1))}T16:00:00` });
  return db;
}

const { check, results, summary } = M.checker("join-requests");

/* every request row on the screen: the box it sits in, its face, name, grey line and actions */
const rows = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cut = (e) => { if (!e) return false; const s = getComputedStyle(e);
    return (s.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) || (s.webkitLineClamp && s.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 1); };
  return [...document.querySelectorAll('[data-tour="request-card"]')].filter(vis).map((row) => {
    /* in an `.nsc-list` every child is its own box: the row carries the edge, the list holds the rows */
    const box = row, bs = getComputedStyle(box), br = box.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const face = row.children[0], fr = face.getBoundingClientRect();
    const nameEl = row.querySelector("[data-name]"), subEl = row.querySelector("[data-sub]");
    const nr = nameEl.getBoundingClientRect(), ncs = getComputedStyle(nameEl);
    const acts = row.querySelector(":scope > .ml-auto");
    const btns = acts ? [...acts.querySelectorAll("button")].map((b) => { const cs = getComputedStyle(b), r = b.getBoundingClientRect(); return { label: b.textContent.trim(), bg: cs.backgroundColor, bw: cs.borderTopWidth, bs: cs.borderTopStyle, fg: cs.color, h: Math.round(r.height), right: Math.round(r.right) }; }) : [];
    return { name: nameEl.textContent.trim(), person: row.hasAttribute("data-person-row"), tag: row.tagName,
             inList: row.parentElement.classList.contains("nsc-list"), edge: `${bs.borderTopWidth} ${bs.borderTopStyle} ${bs.borderTopColor}`, radius: bs.borderTopLeftRadius,
             boxRight: Math.round(br.right), rowRight: Math.round(rr.right), face: Math.round(fr.width), inset: Math.round(nr.left - fr.left),
             fs: ncs.fontSize, fw: ncs.fontWeight, ink: ncs.color, nameCut: cut(nameEl), wrapped: nr.height > parseFloat(ncs.fontSize) * 1.8,   // a second line (the line height reads "normal")
             sub: subEl ? { t: subEl.textContent.replace(/\s+/g, " ").trim(), fs: getComputedStyle(subEl).fontSize, over: subEl.scrollWidth > subEl.clientWidth + 1 } : null,
             btns, actsH: acts ? Math.round(acts.getBoundingClientRect().height) : null, under: acts ? acts.getBoundingClientRect().top >= nr.bottom - 1 : null, rowH: Math.round(rr.height) };
  });
});
const line = (r) => `${r.name.slice(0, 14)} face ${r.face} ${r.fs}/${r.fw} sub "${r.sub && r.sub.t}" acts ${r.btns.map((b) => `${b.label} ${b.h} ${b.bg} ${b.bw}`).join(",")} under ${r.under} edge ${r.edge}`;

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];
  const boot = async (db, role, width = 375) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => errors.push(`${role}@${width}: ${String(e.message || e)}`));
    await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`)); await M.attach(page, db);
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text: () => M.rootText(page), shot };
  };
  const { tap } = M;
  const toRequests = async (page) => { await tap(page, '[aria-label="Today"]', 900); await tap(page, '[data-tour="today-requests"]', 1000); };
  const rowOf = (page, who) => page.locator('[data-tour="request-card"]', { hasText: who }).first();

  try {
    /* ---------- the rows, at 375 ---------- */
    {
      const db = freshDb();
      const { ctx, page, text, shot } = await boot(db, "coach", 375);
      await toRequests(page);
      const t0 = await text(); const R = await rows(page); await shot("01-requests-375");
      check("(a) Requests opens from Today's strip, its subtitle the count — two waiting — and each request is a person row in one boxed list on golf's edge, 8px corners, no card",
        /Requests/.test(t0) && /2 waiting/.test(t0) && R.length === 2 && R.every((r) => r.person && r.inList && /^1\.5px solid|^1px solid|^2px solid/.test(r.edge) && r.edge.endsWith(EDGE_GOLF) && r.radius === "8px") && (await page.locator('[data-scroll="screen"] .nsc-list').count()) === 1,
        `${t0.slice(0, 80)} · ${R.map(line).join(" | ")}`);
      check("(b) the one row: the face 40, the name 54px in at 14.5px/400, the grey line 12px", R.length === 2 && R.every((r) => r.face === 40 && r.inset === 54 && r.fs === "14.5px" && r.fw === "400" && r.sub && r.sub.fs === "12px"), R.map(line).join(" | "));
      const eoin = R.find((r) => r.name === "Eoin Walsh"), max = R.find((r) => r.name === LONG);
      check("(c) the grey line is the facts, the day in the app's one date form: Eoin's \"Golf · " + nice(dayFrom(-2)) + "\", the junior's \"Golf · Under 18 · " + nice(dayFrom(-1)) + "\" (it read \"8 Nov\")",
        !!eoin && eoin.sub.t === `Golf · ${nice(dayFrom(-2))}` && !!max && max.sub.t === `Golf · Under 18 · ${nice(dayFrom(-1))}`, `${eoin && eoin.sub.t} | ${max && max.sub.t}`);
      check("(d) Accept · Decline are the row's text actions — no outline, no fill, 44 tall, Accept in ink and Decline quieter — beside Eoin's short name at 375",
        R.every((r) => r.btns.length === 2 && r.btns[0].label === "Accept" && r.btns[1].label === "Decline" && r.btns.every((b) => b.bg === "rgba(0, 0, 0, 0)" && (b.bw === "0px" || b.bs === "none") && b.h >= 44) && r.btns[0].fg === r.ink && r.btns[1].fg !== r.ink && r.actsH >= 44) && !!eoin && eoin.under === false,
        R.map(line).join(" | "));
      check("(e) nothing is cut at 375: both names whole — the long one on a second line beside its actions, as the one row keeps a pair beside a name at 375 — no grey line past its box, both buttons inside the row", R.every((r) => !r.nameCut && r.sub && !r.sub.over && r.btns.every((b) => b.right <= r.boxRight)) && !!max && max.wrapped && max.under === false, R.map((r) => `${r.name.slice(0, 12)} cut ${r.nameCut} wrapped ${r.wrapped} over ${r.sub && r.sub.over} right ${r.btns.map((b) => b.right).join("/")} box ${r.boxRight}`).join(" | "));
      /* no card: nothing of the old shape — a 46px face, a filled Accept, a disc with a tick */
      const old = await page.evaluate(() => {
        const fills = [...document.querySelectorAll('[data-scroll="screen"] button')].filter((b) => b.textContent.trim() === "Accept" && getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)").length;
        const big = [...document.querySelectorAll('[data-scroll="screen"] [data-tour="request-card"] > *')].filter((e) => Math.round(e.getBoundingClientRect().width) === 46).length;
        return { fills, big };
      });
      check("(f) no filled Accept and no 46px face anywhere on the screen", old.fills === 0 && old.big === 0, JSON.stringify(old));

      /* the answers still go where they went */
      await rowOf(page, "Eoin Walsh").locator("button", { hasText: /^Accept$/ }).click(); await page.waitForTimeout(1800);
      const acc = db.rpcs.filter((x) => x.fn === "respond_to_request").pop(); const eoinReq = db.requests.find((r) => r.player_id === IDS.eoin);
      const t1 = await text(); const R1 = await rows(page); await shot("02-after-accept");
      check("(g) Accept on Eoin's row calls respond_to_request with his request and yes; his row goes and the subtitle reads 1 waiting",
        !!acc && acc.args.p_id === eoinReq.id && acc.args.p_accept === true && eoinReq.status === "accepted" && R1.length === 1 && R1[0].name === LONG && /1 waiting/.test(t1), `${JSON.stringify(acc && acc.args)} · ${R1.map((r) => r.name).join()} · ${t1.slice(0, 80)}`);
      await rowOf(page, LONG).locator("button", { hasText: /^Decline$/ }).click(); await page.waitForTimeout(1800);
      const dec = db.rpcs.filter((x) => x.fn === "respond_to_request").pop(); const maxReq = db.requests.find((r) => r.player_id === IDS.junior);
      const t2 = await text(); await shot("03-empty");
      const empty = await page.evaluate(() => {
        const screen = document.querySelector('[data-scroll="screen"]');
        const lists = screen ? screen.querySelectorAll(".nsc-list").length : -1;
        const discs = screen ? [...screen.querySelectorAll("span")].filter((s) => Math.round(s.getBoundingClientRect().width) === 52 && Math.round(s.getBoundingClientRect().height) === 52 && s.querySelector("svg")).length : -1;
        const line = screen ? [...screen.querySelectorAll("p")].find((p) => p.textContent.trim() === "Nothing waiting") : null;
        return { lists, discs, line: !!line, lineSize: line ? getComputedStyle(line).fontSize : null, h1: screen ? (screen.querySelector("h1") || {}).textContent : null };
      });
      check("(h) Decline on the junior's row calls respond_to_request with no; emptied, the screen is the line \"Nothing waiting\" — no box, no disc with a tick, no sentence, and the subtitle gone",
        !!dec && dec.args.p_id === maxReq.id && dec.args.p_accept === false && empty.lists === 0 && empty.discs === 0 && empty.line && !/All clear|will appear here/.test(t2) && !/\d waiting/.test(t2) && (t2.match(/Nothing waiting/g) || []).length === 1,
        `${JSON.stringify(dec && dec.args)} · ${JSON.stringify(empty)} · ${t2.slice(0, 120)}`);
      await ctx.close();
    }

    /* ---------- 320: the actions drop under the long name ---------- */
    {
      const db = freshDb();
      const { ctx, page, shot } = await boot(db, "coach", 320);
      await toRequests(page);
      const R = await rows(page); await shot("04-requests-320");
      const eoin = R.find((r) => r.name === "Eoin Walsh"), max = R.find((r) => r.name === LONG);
      /* with the pair under it the long name has the row's width and sits on one line at 320 */
      check("(i) at 320 the long name is whole with Accept · Decline on a line of their own under it, 44 tall; Eoin's keep beside his name; nothing runs past its box",
        R.length === 2 && !!max && !max.nameCut && max.under === true && max.btns.every((b) => b.h >= 44) && !!eoin && !eoin.nameCut && eoin.under === false && R.every((r) => r.sub && !r.sub.over && r.btns.every((b) => b.right <= r.boxRight)),
        R.map((r) => `${line(r)} wrapped ${r.wrapped} cut ${r.nameCut} right ${r.btns.map((b) => b.right).join("/")} box ${r.boxRight}`).join(" | "));
      await ctx.close();
    }

    check("(n) no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("(x) the suite ran to the end", false, String(e && e.stack || e).slice(0, 400));
  } finally {
    summary();
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await browser.close(); M.stopServer(server); process.exit(0);
  }
})();
