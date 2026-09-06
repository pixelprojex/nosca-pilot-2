/* ACCOUNT DELETION, end to end: You → Your profile → Delete account →
   wrong password refused → right password: files removed by full path
   from both buckets, delete_my_account called, signed out, landing.
   Usage: node delete-account.cjs <distDir> <port> <outDir> */
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const M = require("./mock.cjs");
const [distDir, portArg, outDir] = process.argv.slice(2);
const PORT = Number(portArg || 4197), BASE = `http://localhost:${PORT}`;
fs.mkdirSync(outDir, { recursive: true });

const UID = "00000000-0000-4000-8000-00000000c0ac";
const LESSON_A = "10000000-0000-4000-8000-0000000000aa", LESSON_B = "10000000-0000-4000-8000-0000000000bb";
function freshDb() {
  const db = M.emptyDb();
  M.addUser(db, { id: UID, email: "coach@t.ie" });
  M.addProfile(db, { id: UID, role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", avatar: `${UID}/avatar-1725000000000.jpg` });
  M.addLesson(db, { id: LESSON_A, coachId: UID, date: "2026-08-20", focus: "Putting", groupName: "Tuesday group" });
  M.addLesson(db, { id: LESSON_B, coachId: UID, date: "2026-08-27", focus: "Driving", groupName: "Tuesday group" });
  M.addMedia(db, { lessonId: LESSON_A, kind: "video", path: `${UID}/${LESSON_A}/1-clip.mp4` });
  M.addMedia(db, { lessonId: LESSON_A, kind: "audio", path: `${UID}/${LESSON_A}/2-note.m4a` });
  M.addMedia(db, { lessonId: LESSON_B, kind: "photo", path: `${UID}/${LESSON_B}/3-photo.jpg` });
  db.files.avatars[`${UID}/avatar-1725000000000.jpg`] = { size: 10 };
  return db;
}
const { check, summary } = M.checker("delete-account");

(async () => {
  const server = await M.startServer(distDir, PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const db = freshDb();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await M.attach(page, db);
    await M.injectSession(page, M.session(db.users["coach@t.ie"], db));
    await page.goto(BASE, { waitUntil: "networkidle" }); await M.settle(page);
    const text = () => M.rootText(page);
    /* header avatar → You */
    await M.tap(page, 'button[aria-label="Your profile"]', 800);
    let t = await text();
    check("You opens; a real account has no Delete account row there (it lives on the profile)", t.includes("Sign out") && !t.includes("Delete account") && (await page.locator('[data-tour="settings-profile"]').count()) === 1, t.slice(0, 160));
    await M.tap(page, '[data-tour="settings-profile"]', 900);
    t = await text(); await page.screenshot({ path: path.join(outDir, "profile.png") });
    check("Your profile reached; Delete account row present once", t.includes("Your profile") && (t.match(/Delete account/g) || []).length === 1, t.slice(0, 160));
    await page.locator('[data-tour="profile-delete"]').click(); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, "confirm-sheet.png") });
    const pw = page.locator('input[type="password"]');
    check("the confirm sheet asks for the password", (await pw.count()) === 1);
    if (await pw.count()) {
      await pw.first().fill("wrongpass"); await page.locator("div.z-40").getByRole("button", { name: /Delete/ }).last().click(); await page.waitForTimeout(900);
      t = await text();
      check("a wrong password is refused by the server and the account is untouched", db.alive && db.auth.some((a) => a.grant === "password" && a.password === "wrongpass") && /isn't right|not right|wrong/i.test(t) && !db.rpcs.some((r) => r.fn === "delete_my_account"), t.slice(0, 120));
      await pw.first().fill("secret12"); await page.locator("div.z-40").getByRole("button", { name: /Delete/ }).last().click(); await page.waitForTimeout(3000);
      t = await text();
      check("delete_my_account is called with the right password", !db.alive && db.rpcs.some((r) => r.fn === "delete_my_account"), JSON.stringify(db.rpcs.map((r) => r.fn)));
      const gone = db.deletes.filter((d) => d.table === "storage:media").flatMap((d) => d.rows);
      const want = [`${UID}/${LESSON_A}/1-clip.mp4`, `${UID}/${LESSON_A}/2-note.m4a`, `${UID}/${LESSON_B}/3-photo.jpg`];
      check("all three media files were listed by folder and removed by full path", want.every((w) => gone.includes(w)) && Object.keys(db.files.media).length === 0, JSON.stringify(gone));
      const pics = db.deletes.filter((d) => d.table === "storage:avatars").flatMap((d) => d.rows);
      check("the profile picture was removed from the avatars bucket too", pics.includes(`${UID}/avatar-1725000000000.jpg`) && Object.keys(db.files.avatars).length === 0, JSON.stringify(pics));
      check("the storage removals happened before the account call", db.log.findIndex((l) => /DELETE \/storage\/v1\/object\/media/.test(l)) < db.log.findIndex((l) => /rpc\/delete_my_account/.test(l)), db.log.filter((l) => /storage|delete_my/.test(l)).join(" ; "));
      check("signed out", db.log.some((c) => c.includes("/auth/v1/logout")));
      check("back on the landing screen", /Create account/.test(t), t.slice(0, 100));
      await page.screenshot({ path: path.join(outDir, "after-delete.png") });
    }
    check("no page errors", errors.filter((e) => !/vibrate/.test(e)).length === 0, errors.join(" | ").slice(0, 200));
    await ctx.close();
  } catch (e) {
    console.log("RUN ERROR", e && e.stack || e); check("run completed", false, String(e && e.message || e));
  } finally { await browser.close(); M.stopServer(server); }
  const out = summary();
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ ...out, log: db.log }, null, 2));
  process.exit(0);
})();
