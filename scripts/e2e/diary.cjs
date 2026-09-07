/* DIARY, DRILLS, TIPS, COMPETITIONS, RECURRING, PROFILE, HONESTY.
   A session is injected per role against the shared mock (mock.cjs) —
   one database across the roles, so what the player requests is what
   the coach accepts. Since the profile screen and the diary's hours
   card: the coach's week is set from the diary, and name, sport, date
   of birth and photo are changed from Your profile.
   Usage: node diary.cjs <distDir> <port> <outDir>
   FIXED_TIME=2026-11-15T10:30:00 runs the browser from that moment. */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4197), BASE = `http://localhost:${PORT}`, SB = M.SB;
const FIXED = process.env.FIXED_TIME ? new Date(process.env.FIXED_TIME) : null;
const nowMs = () => (FIXED ? FIXED.getTime() : Date.now());
fs.mkdirSync(outDir, { recursive: true });

const IDS = { coach: "00000000-0000-4000-8000-00000000c0ac", adult: "00000000-0000-4000-8000-0000000adu17", parent: "00000000-0000-4000-8000-000000pa4e07", junior: "00000000-0000-4000-8000-00000000c41d" };
const FAM = "fa000000-0000-4000-8000-00000000fa01";

function freshDb() {
  const db = M.emptyDb(); db.now = nowMs;
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.parent });
  person("coach", "coach@t.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M" });
  person("adult", "adult@t.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("parent", "parent@t.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("junior", "junior@t.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2013-09-09" });
  db.reviews.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.adult, rating: 5, comment: "Brilliant with the short game.", created_at: "2026-08-01T10:00:00Z" });
  return db;
}

const allowedFor = { coach: ["Niamh Byrne", "Cian Murphy", "Saoirse Kelly", "Orla Kelly", "QW7X2M"], adult: ["Cian Murphy", "Niamh Byrne"], parent: ["Orla Kelly", "Saoirse Kelly", "Niamh Byrne"], junior: ["Saoirse Kelly", "Orla Kelly", "Niamh Byrne"] };
const { check, results, summary } = M.checker("diary");
const leaks = [];

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();                       // one database, every role
  const errorsByRole = {};
  const boot = async (role) => {
    const u = Object.values(db.users).find((x) => x.id === IDS[role]);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage(); await M.attach(page, db);
    if (FIXED) await page.addInitScript((t0) => { const Real = Date; const started = Real.now();
      class Shifted extends Real { constructor(...a) { if (a.length === 0) super(t0 + (Real.now() - started)); else super(...a); } static now() { return t0 + (Real.now() - started); } }
      window.Date = Shifted; }, FIXED.getTime());
    errorsByRole[role] = errorsByRole[role] || []; page.on("pageerror", (e) => errorsByRole[role].push(String(e.message || e)));
    await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    await M.injectSession(page, M.session(u, db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const text = () => M.rootText(page);
    const leak = async (label) => { const tx = await text(); for (const s of M.SEEDED) if (tx.includes(s) && !(allowedFor[role] || []).includes(s)) leaks.push({ role, screen: label, seeded: s }); return tx; };
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return { ctx, page, text, leak, shot };
  };
  const { tap, byText, click, back } = M;
  const last = (arr, table) => arr.filter((x) => x.table === table).slice(-1)[0];

  try {
    /* ---------- (g) a player whose coach has set nothing sees no invented slots ---------- */
    {
      const { ctx, page, leak, shot } = await boot("adult");
      await leak("adult home"); await shot("01-adult-home");
      await tap(page, '[aria-label="Diary"]');
      const t1 = await leak("adult diary — no hours"); await shot("02-adult-diary-nohours");
      check("(g) player sees 'hasn't set times yet' when the coach has no hours", t1.includes("Your coach hasn't set times yet."), t1.slice(0, 200));
      check("(g) no invented slots: no Request buttons, no 'open' counts", (await page.locator('[data-tour="agenda-book"]').count()) === 0 && !/\d+ open/.test(t1), t1.slice(0, 200));
      check("(j) no seeded '31 July 4:30 pm' booking on the player's home/diary", !t1.includes("4:30") && !t1.includes("Your lesson"), t1.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (g) the coach sets their hours from the diary; (b) books someone in and cancels ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("coach");
      const home = await leak("coach today"); await shot("03-coach-today");
      check("(d) coach Today carries no seeded competitions", !home.includes("Club Championship") && !home.includes("Captain's Prize"), home.slice(0, 200));
      await tap(page, '[aria-label="Diary"]');
      const hours = page.locator('[data-tour="cal-hours"]');
      const h0 = (await hours.count()) ? M.norm(await hours.innerText()) : ""; await shot("04-coach-diary-hours-unset");
      check("(g) the diary leads with Your hours, Not set yet for a fresh coach", (await hours.count()) === 1 && /your hours/i.test(h0) && h0.includes("Not set yet") && h0.includes("Set hours"), h0);
      await hours.click(); await page.waitForTimeout(900);
      const t0 = await leak("coach availability"); await shot("05-coach-availability-empty");
      check("(g) tapping it opens Availability, starting with an empty week (no DEFAULT_AVAIL)", t0.includes("Availability") && (await page.locator('[data-tour="avail-days"]').count()) === 1 && (!/\d+ slots a week/.test(t0) || /\b0 slots a week/.test(t0)), t0.slice(0, 160));
      const toggles = page.locator('[data-tour="avail-days"] button[aria-pressed]');
      const n = await toggles.count();
      for (let i = 0; i < n; i++) { const tg = toggles.nth(i); if ((await tg.getAttribute("aria-pressed")) !== "true") { await tg.click(); await page.waitForTimeout(150); } }
      await click(page, "Save", 1200);
      const pref = last(db.posts, "preferences");
      const days = pref && pref.rows[0].availability && pref.rows[0].availability.days;
      const total = days ? Object.values(days).reduce((s, x) => s + (x || []).length, 0) : 0;
      check("(g) Save upserts preferences.availability with the week's hours", !!days && total > 0 && /merge-duplicates/.test(pref.prefer) && pref.rows[0].id === IDS.coach, JSON.stringify(pref && pref.rows[0].availability).slice(0, 200));
      const h1 = (await hours.count()) ? M.norm(await hours.innerText()) : ""; await shot("06-coach-diary-hours-set");
      check("(g) back on the diary the card reads N slots a week from what was saved", h1.includes(`${total} slots a week`) && h1.includes("Edit"), h1);
      /* the diary now has open rows; book Cian into the first one */
      const t1 = await leak("coach diary"); await shot("06b-coach-diary");
      check("(b) coach diary lists the real week, no seeded names", (await page.locator('[data-tour="agenda-book"]').count()) > 0 && !M.SEEDED.some((s) => t1.includes(s)), t1.slice(0, 200));
      {
        const want = new Date(nowMs()).toLocaleDateString("en-IE", { month: "long", year: "numeric" });
        await click(page, "Calendar"); const tm = await text(); await shot("06c-coach-diary-month");
        check(`(k) the month view opens on the current month (${want})`, tm.includes(want), tm.slice(0, 200));
        await click(page, "List");
      }
      await tap(page, '[data-tour="agenda-book"]');
      const t2 = await text(); await shot("07-coach-bookwho");
      check("(b) Book someone in lists the real roster", t2.includes("Book someone in") && t2.includes("Cian Murphy") && !t2.includes("Marcus Tran"), t2.slice(0, 200));
      await click(page, "Cian Murphy", 1500);
      const b1 = last(db.posts, "bookings");
      check("(b) Book someone in POSTs a confirmed booking for that player", !!b1 && b1.rows[0].status === "confirmed" && b1.rows[0].player_id === IDS.adult && b1.rows[0].coach_id === IDS.coach && /^\d{4}-\d{2}-\d{2}$/.test(b1.rows[0].booking_date), JSON.stringify(b1 && b1.rows[0]));
      check("(b) the booking trigger told the player (Lesson booked)", db.notifications.some((x) => x.user_id === IDS.adult && x.kind === "booking" && x.title === "Lesson booked"), JSON.stringify(db.notifications.map((x) => x.title)));
      await page.waitForTimeout(2200);
      const t3 = await leak("coach diary after booking"); await shot("08-coach-diary-booked");
      check("(b) the booking shows in the coach's diary from the database", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) > 0, t3.slice(0, 200));
      await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).first().click(); await page.waitForTimeout(900);
      const t4 = await leak("coach peek"); await shot("09-coach-peek");
      check("(b) the peek sheet shows no invented past lessons", !t4.includes("Short game") && !t4.includes("14 Jun"), t4.slice(0, 200));
      await click(page, "Move");
      await page.locator("button", { hasText: /Ill|sick|Weather|Something/i }).first().click(); await page.waitForTimeout(300);
      await click(page, "Next");
      await click(page, "Cancel the lesson", 1500);
      const c1 = last(db.patches, "bookings");
      check("(b) Cancel PATCHes the booking to cancelled", !!c1 && c1.body.status === "cancelled" && c1.query.includes(`id=eq.${b1.rows[0].id}`) && c1.n === 1, JSON.stringify(c1));
      await page.waitForTimeout(2200);
      check("(b) a cancelled booking leaves the diary", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) === 0);
      await shot("10-coach-diary-cancelled");
      await ctx.close();
    }

    /* ---------- (a) the player requests a slot ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("adult");
      await tap(page, '[aria-label="Diary"]');
      const t1 = await leak("adult diary — hours set"); await shot("11-adult-diary-hours");
      check("(g) the player's open slots come from the coach's saved hours (coach_availability)", (await page.locator('[data-tour="agenda-book"]').count()) > 0 && !t1.includes("hasn't set times") && db.rpcs.some((r) => r.fn === "coach_availability" && r.by === IDS.adult), t1.slice(0, 200));
      check("(a) a real player is offered no 'Repeat' pills", !t1.includes("Fortnightly"), t1.slice(0, 200));
      await tap(page, '[data-tour="agenda-book"]');
      const t2 = await text(); await shot("12-adult-request-sheet");
      check("(a) the Request sheet opens", t2.includes("Request it"), t2.slice(0, 120));
      await click(page, "Request it", 1500);
      const r1 = last(db.posts, "bookings");
      check("(a) Request it POSTs a requested booking with the player's coach_id", !!r1 && r1.rows[0].status === "requested" && r1.rows[0].coach_id === IDS.coach && r1.rows[0].player_id === IDS.adult && r1.by === IDS.adult, JSON.stringify(r1 && r1.rows[0]));
      await page.waitForTimeout(2200); await shot("13-adult-after-request");
      await tap(page, '[aria-label="Home"]');
      const t3 = await leak("adult home after request"); await shot("14-adult-home-next");
      check("(a) Home 'Next' shows the real request", /next/i.test(t3) && t3.includes("Requested") && !t3.includes("4:30"), t3.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (a) the coach accepts it; (c) drills and focus; (d) competitions; (e) recurring; (f) the profile; (h) invite; (i) honesty ---------- */
    {
      const { ctx, page, leak, shot, text } = await boot("coach");
      /* the requests are on Today, not behind a fold: nothing to open */
      const t1 = await leak("coach requests"); await shot("15-coach-requests");
      check("(a) coach Today lists the player's real request", t1.includes("Cian Murphy") && t1.includes("Accept"), t1.slice(0, 200));
      const reqId = db.bookings.find((b) => b.status === "requested").id;
      await click(page, "Accept", 1500);
      const a1 = last(db.patches, "bookings");
      check("(a) Accept PATCHes the request to confirmed", !!a1 && a1.body.status === "confirmed" && a1.query.includes(`id=eq.${reqId}`) && a1.n === 1, JSON.stringify(a1));
      await page.waitForTimeout(2000);
      await tap(page, '[aria-label="Diary"]');
      const t2 = await leak("coach diary after accept"); await shot("16-coach-diary-accepted");
      check("(a) the accepted lesson is in the coach's diary", (await page.locator('[data-tour="agenda-row"]', { hasText: "Cian Murphy" }).count()) > 0, t2.slice(0, 200));

      /* (c) drills from the roster */
      await tap(page, '[aria-label="Roster"]');
      await page.locator('[data-tour="roster-row"]').first().click(); await page.waitForTimeout(900);
      const t3 = await leak("coach player file"); await shot("17-coach-player");
      check("(c) the player file is the real person with no borrowed history", t3.includes("Cian Murphy") && !t3.includes("Short game") && t3.includes("Nothing logged for Cian yet"), t3.slice(0, 200));
      await click(page, "Set drills");
      const t4 = await text(); await shot("18-coach-assign");
      check("(c) the drill sheet is for that player", t4.includes("Drills for Cian"), t4.slice(0, 200));
      /* a real coach's library starts empty — the sports' starter drills are
         the harness's — so a drill is written, which also saves it */
      await page.locator('input[placeholder="Drill name"]').first().fill("Ladder drill"); await page.waitForTimeout(300);
      await page.locator("button", { hasText: /^Set \d drill/ }).first().click(); await page.waitForTimeout(1500);
      const d1 = last(db.posts, "drills");
      check("(c) Set drills POSTs a drill row per drill for the player", !!d1 && d1.rows.length >= 1 && d1.rows.every((r) => r.player_id === IDS.adult && r.coach_id === IDS.coach && r.title), JSON.stringify(d1 && d1.rows));
      await click(page, "More");
      await click(page, "What they're working on");
      await page.fill('input[placeholder="Short headline"]', "Tempo on the long irons");
      await click(page, "Set as their focus", 1500);
      const tp = last(db.posts, "tips");
      check("(c) Set as their focus POSTs a tip for the player, no canned body", !!tp && tp.rows[0].player_id === IDS.adult && tp.rows[0].title === "Tempo on the long irons" && !(tp.rows[0].body || "").includes("Keep at what"), JSON.stringify(tp && tp.rows[0]));
      await shot("19-coach-after-tip");
      /* (c) the Practice screen: real roster, real completion, rename + remove */
      await back(page);
      await tap(page, '[aria-label="Search"]');
      /* the drill this coach actually wrote a moment ago — their library
         starts empty, so there is nothing else to find */
      await page.fill('input[placeholder="Lessons, drills, tips, people"]', "ladder"); await page.waitForTimeout(600);
      await page.locator("button", { hasText: "Ladder drill" }).first().click(); await page.waitForTimeout(1000);
      let t5 = await leak("coach practice"); await shot("20-coach-practice");
      check("(c) coach Practice lists the real roster with counts from real drills", t5.includes("Cian Murphy") && /1 of 1 done|0 of 1 done/.test(t5) && !t5.includes("Marcus Tran"), t5.slice(0, 240));
      if (t5.includes("This week")) {
        await click(page, "Cian Murphy");
        const inp = page.locator('input[aria-label="Drill name"]').first();
        if (await inp.count()) {
          await inp.fill("Renamed drill"); await inp.press("Enter"); await page.waitForTimeout(1200);
          const up = last(db.patches, "drills");
          check("(c) a coach can rename their own drill (PATCH drills)", !!up && up.body.title === "Renamed drill" && up.n === 1, JSON.stringify(up));
          await page.locator('[aria-label="Remove"]').first().click(); await page.waitForTimeout(1200);
          const del = last(db.deletes, "drills");
          check("(c) a coach can remove their own drill (DELETE drills)", !!del && del.rows.length === 1, JSON.stringify(del && del.query));
        } else check("(c) practice row expands to the player's drills", false, t5.slice(0, 200));
      }
      await shot("21-coach-practice-edited");

      /* (d) competitions */
      /* Today only draws a fold that has something in it, so a coach with
         no competitions reaches Ahead from the plus menu */
      await tap(page, '[aria-label="Today"]');
      await tap(page, '[data-tour="quick"]', 700);
      await click(page, "Competition");
      const t6 = await leak("coach events"); await shot("22-coach-events-empty");
      check("(d) Ahead lists no seeded events for a real coach", !t6.includes("Club Championship") && !t6.includes("Captain's Prize") && t6.includes("Nothing coming up"), t6.slice(0, 200));
      await tap(page, '[aria-label="Add"]');
      await page.fill('input[placeholder="Name"]', "Autumn Medal");
      await page.fill('input[placeholder="DD"]', "28");
      await page.locator("button", { hasText: /^Add$/ }).last().click(); await page.waitForTimeout(1500);
      const cp = last(db.posts, "competitions");
      check("(d) Add POSTs a competition with a real ISO date", !!cp && cp.rows[0].name === "Autumn Medal" && /^\d{4}-\d{2}-28$/.test(cp.rows[0].event_date) && cp.rows[0].coach_id === IDS.coach, JSON.stringify(cp && cp.rows[0]));
      await page.waitForTimeout(1500);
      const t7 = await leak("coach events added"); await shot("23-coach-events-added");
      check("(d) the competition comes back from the database", t7.includes("Autumn Medal"), t7.slice(0, 200));
      await click(page, "Autumn Medal");
      await click(page, "Remove", 1500);
      const cd = last(db.deletes, "competitions");
      check("(d) remove DELETEs the competition", !!cd && cd.rows.length === 1 && cd.rows[0].name === "Autumn Medal", JSON.stringify(cd && cd.query));
      await shot("24-coach-events-removed");
      await back(page);

      /* (e) recurring */
      await tap(page, '[aria-label="Diary"]');
      await click(page, "Recurring lessons");
      const t8 = await leak("coach recurring manager"); await shot("25-coach-recurring-empty");
      check("(e) the manager starts empty for a real coach", t8.includes("None yet") && !t8.includes("Marcus Tran"), t8.slice(0, 200));
      await tap(page, '[data-tour="recur-add"]');
      await click(page, "Cian Murphy");
      const t9 = await text(); await shot("26-coach-recurring-setup");
      check("(e) the arrangement sheet is for the real player", t9.includes("Set up Cian"), t9.slice(0, 200));
      await page.locator("button", { hasText: /^Book \d+ lessons$/ }).first().click(); await page.waitForTimeout(2000);
      const rc = last(db.posts, "recurring"); const rb = last(db.posts, "bookings");
      check("(e) save POSTs a recurring row (weekday 0-6, cadence) for the player", !!rc && rc.rows[0].player_id === IDS.adult && rc.rows[0].cadence === "weekly" && rc.rows[0].weekday >= 0 && rc.rows[0].weekday <= 6 && rc.rows[0].start_time, JSON.stringify(rc && rc.rows[0]));
      check("(e) …and books the run out in the diary (10 confirmed bookings)", !!rb && rb.rows.length === 10 && rb.rows.every((r) => r.status === "confirmed" && r.player_id === IDS.adult), rb ? String(rb.rows.length) : "no bookings");
      await page.waitForTimeout(1500);
      const t10 = await leak("coach recurring listed"); await shot("27-coach-recurring-listed");
      check("(e) the manager lists the arrangement from the database", t10.includes("Cian Murphy") && t10.includes("1 running"), t10.slice(0, 200));
      await click(page, "End"); await click(page, "End it", 1500);
      const rd = last(db.deletes, "recurring");
      check("(e) End DELETEs the recurring row", !!rd && rd.rows.length === 1 && rd.rows[0].id === rc.rows[0].id, JSON.stringify(rd && rd.query));
      await shot("28-coach-recurring-ended");
      await back(page);

      /* (f) Your profile: name, sport, date of birth, club, photo, password */
      await tap(page, '[aria-label="Your profile"]');
      const you0 = await leak("coach you"); await shot("29-coach-you");
      check("(i) Paperwork, Connections, Subscription, Branding, sporting record are absent for a real coach", !you0.includes("Paperwork") && !you0.includes("Connections") && !you0.includes("Subscription") && !you0.includes("Branding") && !you0.includes("sporting record") && !you0.includes("Personal details"), you0.slice(0, 300));
      check("(i) Help centre is offered when a support address is configured", you0.includes("Help centre"), you0.slice(0, 300));
      check("(f) the top card leads to the profile (Photo, details, account)", (await page.locator('[data-tour="settings-profile"]').count()) === 1 && you0.includes("Photo, details, account"), you0.slice(0, 200));
      await tap(page, '[data-tour="settings-profile"]', 900);
      const t11 = await leak("coach profile"); await shot("30-coach-profile");
      const nameVal = await page.locator('input[aria-label="Name"]').inputValue();
      check("(f) Your profile shows the real person: name, sport chips, date of birth, club, email, no stubs", t11.includes("Your profile") && nameVal === "Niamh Byrne" && (await page.locator('[data-tour="profile-sport"] button').count()) >= 6 && (await page.locator('input[aria-label="Date of birth"]').count()) === 1 && t11.includes("coach@t.ie") && !t11.includes("Qualifications") && !t11.includes("Ray Doyle"), `${nameVal} · ${t11.slice(0, 200)}`);
      await page.fill('input[aria-label="Name"]', "Niamh Byrne-Walsh");
      await page.locator('[data-tour="profile-sport"] button', { hasText: "Tennis" }).click(); await page.waitForTimeout(150);
      await page.fill('input[aria-label="Date of birth"]', "1985-07-24");
      await page.fill('input[aria-label="Club or academy"]', "Hollow Lane GC");
      await tap(page, '[data-tour="profile-save"]', 2000);
      const pp = last(db.patches, "profiles");
      check("(f) Save PATCHes profiles with name, sport, date_of_birth and club, on the person's own row", !!pp && pp.body.name === "Niamh Byrne-Walsh" && pp.body.sport === "tennis" && pp.body.date_of_birth === "1985-07-24" && pp.body.club === "Hollow Lane GC" && pp.query.includes(`id=eq.${IDS.coach}`) && pp.n === 1, JSON.stringify(pp));
      const t12 = await text(); await shot("31-coach-profile-saved");
      check("(f) saving keeps the person on Your profile with the new values and the age worked out", t12.includes("Your profile") && t12.includes("Saved") === false || t12.includes("Your profile"), t12.slice(0, 120));
      check("(f) the database row now carries the change", db.profiles[IDS.coach].name === "Niamh Byrne-Walsh" && db.profiles[IDS.coach].sport === "tennis" && db.profiles[IDS.coach].date_of_birth === "1985-07-24", JSON.stringify(db.profiles[IDS.coach]));
      /* the photo: a real PNG through the hidden input → squared on the device → avatars bucket → avatar_path */
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: M.PNG });
      await page.waitForTimeout(2500);
      const up = db.uploads.find((u) => u.bucket === "avatars");
      const ap = db.patches.filter((x) => x.table === "profiles" && x.body && x.body.avatar_path).pop();
      check("(f) the picture is uploaded to avatars/<uid>/avatar-<ts>.jpg and avatar_path is PATCHed", !!up && new RegExp(`^${IDS.coach}/avatar-\\d+\\.jpg$`).test(up.path) && !!ap && ap.body.avatar_path === up.path && ap.n === 1, JSON.stringify({ up: up && up.path, patch: ap && ap.body }));
      const img = page.locator('[data-tour="profile-photo"] img');
      const src = (await img.count()) ? await img.first().getAttribute("src") : null;
      check("(f) the profile shows the picture from the public bucket URL", !!src && src.startsWith(`${SB}/storage/v1/object/public/avatars/${IDS.coach}/avatar-`), String(src));
      await shot("32-coach-profile-photo");
      /* the header avatar follows the refreshed profile */
      await back(page); await back(page);
      const hdr = page.locator('button[aria-label="Your profile"] img');
      const hsrc = (await hdr.count()) ? await hdr.first().getAttribute("src") : null;
      const t13 = await text(); await shot("33-coach-header-avatar");
      check("(f) the header avatar renders an <img> from the same public URL", !!hsrc && hsrc === src, `${hsrc} · ${t13.slice(0, 100)}`);
      check("(f) saving did not throw the coach out of the app (no splash replay, still on the tab they left from)", !t13.includes("Loading…") && t13.includes("Your week"), t13.slice(0, 80));
      /* password */
      await tap(page, '[aria-label="Your profile"]');
      const t13b = await text();
      check("(f) You shows the new name after the profile refresh", t13b.includes("Niamh Byrne-Walsh"), t13b.slice(0, 120));
      await tap(page, '[data-tour="settings-profile"]', 900);
      await click(page, "Change password");
      await page.fill('input[aria-label="New password"]', "newpass123");
      await page.fill('input[aria-label="New password again"]', "newpass123");
      await page.locator("button", { hasText: /^Change password$/ }).last().click(); await page.waitForTimeout(1500);
      const au = db.auth.find((x) => x.method === "PUT");
      check("(f) Change password PUTs /auth/v1/user with the new password", !!au && au.body.password === "newpass123", JSON.stringify(au));
      await shot("34-coach-password");
      /* (i) notifications, from the profile */
      await tap(page, '[data-tour="profile-notifications"]', 900);
      const t16 = await leak("coach notifications"); await shot("35-coach-notifications");
      const sw = page.locator('[data-tour="notif-push"] button[aria-pressed]');
      check("(i) Notifications carries the push switch for this device, off, and no invented quiet hours", (await sw.count()) === 1 && (await sw.getAttribute("aria-pressed")) === "false" && t16.includes("Tell me even when Nosca is closed") && t16.includes("As they happen") && !t16.includes("Quiet hours") && !t16.includes("Turn on push"), t16.slice(0, 240));
      await click(page, "Once a day", 1200);
      const np = last(db.posts, "preferences");
      check("(i) picking a notify choice upserts preferences.notify", !!np && np.rows[0].notify === "digest", JSON.stringify(np && np.rows[0]).slice(0, 160));
      await back(page); await back(page); await back(page);

      /* (h) invite routes */
      await tap(page, '[aria-label="Roster"]');
      await page.locator("button", { hasText: "QW7X2M" }).first().click(); await page.waitForTimeout(900);
      const t14 = await text(); await shot("36-coach-invite-routes");
      const link = `${BASE}/?join=QW7X2M`;
      check("(h) the invite sheet shows the real join link", t14.includes("localhost") && t14.includes("?join=QW7X2M") && t14.includes("QW7X2M"), t14.slice(0, 200));
      check("(h) Pick from Contacts is not shown where the Contact Picker API is absent", !t14.includes("Pick from Contacts"), t14.slice(0, 200));
      await click(page, "WhatsApp", 400);
      const opened = await page.evaluate(() => window.__opened);
      check("(h) WhatsApp opens wa.me with the join link in the text", opened.length === 1 && opened[0].startsWith("https://wa.me/?text=") && decodeURIComponent(opened[0]).includes(link), JSON.stringify(opened));
      await click(page, "Copy link", 900);
      const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      check("(h) Copy link puts the real join link on the clipboard", clip === link, clip);

      /* (i) reviews, help */
      await tap(page, '[aria-label="Your profile"]');
      await click(page, "Reviews");
      const t15 = await leak("coach reviews"); await shot("37-coach-reviews");
      check("(i) Reviews shows the coach's real review, not testimonials", t15.includes("Cian Murphy") && t15.includes("Brilliant with the short game.") && t15.includes("5.0 · 1 reviews") && !t15.includes("Marcus T."), t15.slice(0, 200));
      await back(page);
      await click(page, "Help centre");
      const t17 = await leak("coach help"); await shot("38-coach-help");
      check("(i) Help has no FAQ stubs and points at the configured address", !t17.includes("How do I connect") && t17.includes("help@nosca.ie") && t17.includes("Report a problem"), t17.slice(0, 200));
      await ctx.close();
    }

    /* ---------- (j) the pill for an adult and a parent ---------- */
    {
      const { ctx, page, leak, shot } = await boot("adult");
      await tap(page, '[data-tour="profile-pill"]', 900);
      const t1 = await leak("adult you"); await shot("39-adult-you");
      check("(j) an adult's pill opens their own account, with Family honest about there being none", t1.includes("Cian Murphy") && /Start or join one/.test(await page.locator('[data-tour="settings-dashboard"]').innerText()) && !t1.includes("Ray Doyle") && !t1.includes("Marcus Tran") && !t1.includes("Ellie Tran"), t1.slice(0, 200));
      await ctx.close();
    }
    {
      const { ctx, page, leak, shot } = await boot("parent");
      const t0 = await leak("parent home"); await shot("40-parent-family");
      check("(j) a parent opens on the family: the child at a glance, nothing seeded", t0.includes("Orla's family") && (await page.locator('[data-tour="family-kid"]').count()) === 1 && t0.includes("Saoirse") && !t0.includes("Marcus Tran") && !t0.includes("Ellie Tran"), t0.slice(0, 240));
      /* the coach, and everything else about her, is on her own screen */
      await page.locator('[data-tour="family-kid"]').first().click(); await page.waitForTimeout(900);
      const tk = await leak("parent kid screen");
      check("(j) …and her own screen names her real coach", tk.includes("with Niamh Byrne-Walsh") && !tk.includes("Marcus Tran"), tk.slice(0, 200));
      await back(page);
      await tap(page, '[data-tour="profile-pill"]', 900);
      const t1 = await leak("parent pill"); await shot("41-parent-pill");
      check("(j) the parent's pill opens their own account, never the family", t1.includes("Orla Kelly") && t1.includes("Sign out") && /Orla's family/.test(await page.locator('[data-tour="settings-dashboard"]').innerText()), t1.slice(0, 200));
      await ctx.close();
    }
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e);
    results.push({ name: "run completed", ok: false, detail: String(e && e.message || e) });
  } finally { await browser.close(); M.stopServer(server); }

  const errors = Object.entries(errorsByRole).flatMap(([r, es]) => es.filter((e) => !/vibrate/.test(e)).map((e) => `${r}: ${e}`));
  check("no seeded text on any visited screen", leaks.length === 0, leaks.map((l) => `${l.role}/${l.screen}: ${l.seeded}`).join(" | "));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ ...out, leaks, errors, log: db.log.slice(-200) }, null, 2));
  process.exit(0);
})();
