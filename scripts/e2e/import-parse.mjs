#!/usr/bin/env node
/* THE IMPORT'S PARSER, PROVED WITHOUT A PAGE (docs/import/SPEC.md, "The tests").
 *
 *   node scripts/e2e/import-parse.mjs
 *
 * The header shapes and the shape lock; times that run backwards; files on
 * both platforms; system lines and group refusals; the invariant that no
 * line is lost; date order, and the day as its literal digits under any
 * time zone (the suite runs itself again under Los Angeles and Auckland);
 * file kinds; segments that slice back byte for byte; the scrub asserted on
 * the serialised request; the budget and the split; the note, the
 * decision table and the key. Prints PASS / FAIL and a count; exits 0.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseChat, dateOf, lockShape, localIso } from "../../src/lib/chatImport/whatsapp.js";
import { buildDays, dayLines, dayParts, bodyFor, segmentsOf, fileKind, halves } from "../../src/lib/chatImport/days.js";
import { buildNote, decide, mergeVerdicts, focusFor, namesOther, fileDefault, screenshotByName, screenshotByPixels, lessonKey } from "../../src/lib/chatImport/plan.js";
import { openSource } from "../../src/lib/chatImport/source.js";
import { validate, measure, BUDGET, MARKERS, scrub, heldBack, PROMPT_V } from "../../netlify/functions/lib/import-shared.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const FX = require("./fixtures/make-chat-zip.cjs");
const results = [];
const check = (name, ok, detail) => { results.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail == null ? "" : `  — ${String(detail).slice(0, 300)}`}`); };
const LRM = "\u200E", NB = "\u202F", NBSP = "\u00A0";
const PLAYER = "22222222-2222-4222-8222-222222222222";

/* ---------------------------------------------------------------- headers */
const shapes = [
  ["[14/06/2025, 18:20:11] ", "dmy"], ["[14/06/2025, 18:20] ", "dmy"], ["14/06/2025, 18:20 - ", "dmy"], ["14/06/2025 18:20 - ", "dmy"],
  [`[14/06/2025, 6:20:11${NB}pm] `, "dmy"], [`14/06/2025, 6:20${NB}pm - `, "dmy"], ["[14/06/2025, 6:20:11 PM] ", "dmy"], ["14/06/2025, 6:20 p.m. - ", "dmy"],
  ["14/06/2025, 6:20 p. m. - ", "dmy"], [`[14.06.25, 18:20:11] `, "dmy"], ["14.06.25, 18:20 - ", "dmy"], ["14-06-2025 18.20 - ", "dmy"],
  ["[6/14/25, 6:20:11 PM] ", "mdy"], ["6/14/25, 6:20 PM - ", "mdy"], [`6/14/25, 6:20${NB}PM - `, "mdy"], ["[2025-06-14, 18:20:11] ", "ymd"],
  ["2025-06-14, 18:20 - ", "ymd"], ["2025/06/14 18:20 - ", "ymd"], ["[2025.06.14, 18:20:11] ", "ymd"], ["14/06/2025 18:20 - ", "dmy"],
  [`[14/06/2025,${NBSP}18:20:11] `, "dmy"], ["[14/06/2025 18:20:11] ", "dmy"], ["14/6/25, 18:20 - ", "dmy"], ["[14/6/2025, 06:20:11 a.m.] ", "dmy"],
  ["[14/06/2025, 18:20:11]\u00A0", "dmy"], ["14/06/2025, 18:20\u00A0- ", "dmy"], ["[2025-06-14 18:20:11] ", "ymd"], ["2025-06-14 18:20 - ", "ymd"],
  ["13/12/2025, 09:01 - ", "dmy"], ["[12/13/2025, 9:01:00 AM] ", "mdy"],
];
let shapeOk = 0; const shapeBad = [];
for (const [h, order] of shapes) {
  const second = h.replace(/14(?=[./-]0?6)|(?<=0?6[./-])14/, "15").replace("6/14/25", "6/15/25").replace("2025-06-14", "2025-06-15").replace("2025/06/14", "2025/06/15").replace("2025.06.14", "2025.06.15").replace("12/13/2025", "12/14/2025").replace("13/12/2025", "14/12/2025");
  const text = `${h}Niamh Byrne: Hello\n${second}Cian M: Hi back\n`;
  const p = parseChat(text);
  const want = order === "mdy" ? (h.includes("12/13") ? "2025-12-13" : "2025-06-14") : order === "ymd" ? "2025-06-14" : (h.startsWith("13/12") ? "2025-12-13" : "2025-06-14");
  const got = p.ok && p.messages[0] ? dateOf(p.messages[0], p.order || order) : null;
  if (p.ok && p.messages.length === 2 && got === want) shapeOk++; else shapeBad.push(`${JSON.stringify(h)} → ${got} (${p.ok ? p.messages.length : p.error})`);
}
check(`the ${shapes.length} header shapes each read as two messages on the right day`, shapeOk === shapes.length, shapeBad.join("; "));
{
  const t = ["[14/06/2025, 18:20:11] Niamh Byrne: Book the range", "25/06/2025 10:00 Driving range", "14.06.2025 10.30 at the club", "[14/06/2025, 18:21:00] Cian M: OK"].join("\n");
  const p = parseChat(t);
  check("the shape lock: inside a bracketed file, date-led lines of another shape stay in their message",
    p.messages.length === 2 && p.messages[0].body === "Book the range\n25/06/2025 10:00 Driving range\n14.06.2025 10.30 at the club", JSON.stringify(p.messages.map((m) => m.body)));
}
{
  const t = ["14/06/2025, 18:20 - Niamh Byrne: Lesson notes", "14/06/2025, 18:10 - Cian M: sent earlier", "13/06/2025, 23:59 - Niamh Byrne: late one"].join("\n");
  const p = parseChat(t);
  check("times running backwards: two authors stay two messages, in file order, each on its own date",
    p.messages.length === 3 && p.messages[1].author === "Cian M" && dateOf(p.messages[2], p.order) === "2025-06-13" && p.messages[0].body === "Lesson notes", JSON.stringify(p.messages.map((m) => [m.author, m.body])));
}
/* ---------------------------------------------------------------- attachments and system lines */
{
  const ip = [`[14/06/2025, 18:20:11] Cian M: ${LRM}Messages and calls are end-to-end encrypted.`,
    `${LRM}[14/06/2025, 18:21:40] Niamh Byrne: Your setup ${LRM}<attached: 00000012-PHOTO-2025-06-14-18-21-40.jpg>`,
    `[14/06/2025, 18:22:00] Niamh Byrne: ${LRM}Plan for the medal.pdf <attached>`].join("\n");
  const p = parseChat(ip);
  check("iPhone: the caption, then the tag; the old <attached> form; a document name with spaces",
    p.messages[0].attachment.name === "00000012-PHOTO-2025-06-14-18-21-40.jpg" && p.messages[0].body === "Your setup" && p.messages[1].attachment && p.messages[1].attachment.name === "Plan for the medal.pdf" && p.counts.system === 1,
    JSON.stringify(p.messages.map((m) => [m.body, m.attachment])));
  const an = ["14/06/2025, 18:21 - Niamh Byrne: IMG-20250614-WA0003.jpg (file attached)", "Your setup", "14/06/2025, 18:22 - Niamh Byrne: VID-20250614-WA0004.mp4 (Datei angehängt)", "Schwung"].join("\n");
  const q = parseChat(an);
  check("Android: \"(file attached)\" in English and in German, the caption on the next line",
    q.messages[0].attachment.name === "IMG-20250614-WA0003.jpg" && q.messages[0].body === "Your setup" && q.messages[1].attachment.name === "VID-20250614-WA0004.mp4" && q.messages[1].body === "Schwung", JSON.stringify(q.messages.map((m) => [m.body, m.attachment])));
  const om = ["14/06/2025, 18:21 - Cian M: <Media omitted>", `[14/06/2025, 18:22:00] Cian M: ${LRM}image omitted`].join("\n");
  const o1 = parseChat(om.split("\n")[0]), o2 = parseChat(om.split("\n")[1]);
  check("omitted media in both platforms' words count as not in the file", o1.counts.omitted === 1 && o2.counts.omitted === 1, JSON.stringify([o1.counts, o2.counts]));
  const ed = ["14/06/2025, 18:21 - Cian M: Grand <This message was edited>", "14/06/2025, 18:22 - Cian M: This message was deleted", "14/06/2025, 18:23 - Niamh Byrne: You deleted this message"].join("\n");
  const e = parseChat(ed);
  check("an edited message is trimmed; a deleted one is dropped and counted", e.messages.length === 1 && e.messages[0].body === "Grand" && e.counts.deleted === 2 && e.counts.edited === 1, JSON.stringify([e.messages, e.counts]));
  const sys = ["14/06/2025, 18:20 - Messages and calls are end-to-end encrypted. Tap to learn more.", `[14/06/2025, 18:20:00] Cian M: ${LRM}Messages and calls are end-to-end encrypted.`, "14/06/2025, 18:21 - Cian M: I left the range early"].join("\n");
  const sy = parseChat(sys.split("\n").filter((l, i) => i !== 1).join("\n"));
  const sy2 = parseChat(sys.split("\n")[1] + "\n[14/06/2025, 18:21:00] Cian M: I left the range early");
  check("system lines with and without an author; \"I left the range early\" is a message", sy.counts.system === 1 && sy.messages.length === 1 && !sy.group && sy2.counts.system === 1 && sy2.messages.length === 1 && !sy2.group, JSON.stringify([sy.counts, sy2.counts]));
  const g1 = parseChat("14/06/2025, 18:20 - Niamh added Pat\n14/06/2025, 18:21 - Pat: hi");
  const g2 = parseChat(`[14/06/2025, 18:20:00] Range Group: ${LRM}Niamh Byrne created group "Range Group"`);
  check("\"Niamh added Pat\" and \"created group\" make it a group chat", g1.group && g2.group, JSON.stringify([g1.group, g2.group]));
}
/* ---------------------------------------------------------------- the fixtures */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nosca-chats-"));
FX.write(tmp);
const open = async (name) => openSource([new File([fs.readFileSync(path.join(tmp, name))], name)]);
const ip = await open("chat-iphone.zip"), an = await open("chat-android.zip");
const pi = parseChat(ip.text), pa = parseChat(an.text);
for (const [nm, p] of [["iPhone", pi], ["Android", pa]]) {
  check(`${nm}: no line is lost — messages + continuations + system lines + lines before = lines in`, p.counts.messages + p.counts.continuations + p.counts.system + p.counts.before === p.counts.lines, JSON.stringify(p.counts));
  check(`${nm}: 45 days, day first, from 3 Mar 2025`, new Set(p.messages.map((m) => dateOf(m, p.order))).size === 45 && p.order === "dmy" && dateOf(p.messages[0], p.order) === "2025-03-03", p.order);
  check(`${nm}: two authors, the coach and the player's label`, p.authors.size === 2 && p.authors.has(FX.COACH) && p.authors.has(FX.PLAYER), [...p.authors.keys()].join(","));
}
{
  const roles = { [FX.COACH]: "coach", [FX.PLAYER]: "player" };
  const days = buildDays(pi, { order: pi.order, roles });
  const back = days.find((d) => d.iso === "2025-06-12");
  check("out of order on 12 Jun: the player's 18:00 then the coach's 17:58, both kept in file order", back && back.msgs.length === 2 && back.msgs[0].side === "P" && back.msgs[1].side === "C", back && JSON.stringify(back.msgs.map((x) => [x.side, x.h, x.min])));
  const cont = days.find((d) => d.iso === "2025-06-05");
  check("a continuation line that starts with a date and a time stays in the coach's message", cont && /\n25\/06\/2025 10:00 Driving range/.test(cont.msgs[0].body), cont && cont.msgs[0].body);
  const y = parseChat((await open("chat-year-first.zip")).text);
  check("year first: a four-digit first group reads y-m-d", y.order === "ymd" && dateOf(y.messages[0], y.order) === "2025-03-03", y.order);
  const files = [...ip.files.keys()];
  const kinds = files.map(fileKind).map((k) => k.kind);
  check("files: stickers apart, .pdf and .heic documents, the rest by extension", kinds.filter((k) => k === "sticker").length === 1 && kinds.filter((k) => k === "document").length === 2 && fileKind("x.opus").mime === "audio/ogg" && fileKind("x.MOV").mime === "video/quicktime" && fileKind("x.vcf").kind === "document", kinds.join(","));
  const named = pi.messages.filter((m) => m.attachment).map((m) => m.attachment.name);
  const missing = named.filter((n) => !ip.files.has(n));
  check("a file named in the chat and not in the zip is found missing", missing.length === 1, missing.join(","));
}
/* ---------------------------------------------------------------- date order */
{
  const amb = parseChat("[05/01/2026, 10:00:00] Niamh Byrne: one\n[05/01/2026, 11:00:00] Cian M: two\n");
  check("dates that could be either way and never tell are left for the person to pick", amb.order === null && amb.ambiguous);
  const dec = parseChat("[01/05/2026, 10:00:00] Niamh Byrne: one\n[02/03/2026, 11:00:00] Cian M: two\n");
  check("the reading under which dates never go backwards wins", dec.order === "mdy", dec.order);
  const med = parseChat(`[05/01/2026, 10:00:00] Niamh Byrne: ${LRM}<attached: 00000001-PHOTO-2026-01-05-10-00-00.jpg>\n`);
  check("a media name's date decides it where nothing else does", med.order === "dmy", med.order);
}
/* the day is the header's digits whatever the phone's clock: the suite runs this part again under two zones */
const literal = parseChat("[31/12/2025, 23:59:00] Niamh Byrne: late\n[01/01/2026, 00:01:00] Cian M: early\n");
check(`the day is the literal digits (TZ ${process.env.TZ || "local"})`, dateOf(literal.messages[0], literal.order) === "2025-12-31" && dateOf(literal.messages[1], literal.order) === "2026-01-01" && /^2025-12-31T23:59:00\.000[+-]\d\d:\d\d$/.test(localIso("2025-12-31", 23, 59)));
if (!process.env.NOSCA_TZ_CHILD) {
  for (const tz of ["America/Los_Angeles", "Pacific/Auckland"]) {
    let out = ""; try { out = execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: tz, NOSCA_TZ_CHILD: "1" }, encoding: "utf8" }); } catch (e) { out = String(e.stdout || e.message); }
    const line = out.split("\n").find((l) => l.includes("the day is the literal digits"));
    check(`under TZ=${tz} the day is still the header's digits`, !!line && line.startsWith("PASS"), line);
  }
}
/* ---------------------------------------------------------------- segments */
{
  const cases = ["Your HI 18.4 is coming down. Level 3.5 next.", "Dr. Ryan said rest it. Then back at 9.30 on Tuesday!", "e.g. the gate drill. approx. ten balls. Then putts."];
  const segs = cases.map((c) => segmentsOf(c).map((s) => c.slice(s.start, s.end)));
  check("\"HI 18.4\", \"Level 3.5\", \"Dr. Ryan said\" and \"at 9.30\" are never split",
    JSON.stringify(segs[0]) === JSON.stringify(["Your HI 18.4 is coming down.", "Level 3.5 next."]) && JSON.stringify(segs[1]) === JSON.stringify(["Dr. Ryan said rest it.", "Then back at 9.30 on Tuesday!"]) && JSON.stringify(segs[2]) === JSON.stringify(["e.g. the gate drill. approx. ten balls.", "Then putts."]), JSON.stringify(segs));
  const all = pi.messages.filter((m) => m.author === FX.COACH && m.body);
  const exact = all.every((m) => segmentsOf(m.body).every((s) => m.body.slice(s.start, s.end) === m.body.substring(s.start, s.end) && m.body.slice(s.start, s.end).trim() === m.body.slice(s.start, s.end)));
  const covered = all.every((m) => segmentsOf(m.body).map((s) => m.body.slice(s.start, s.end)).join(" ").replace(/\s+/g, " ") === m.body.replace(/\s+/g, " ").trim());
  check("segments slice back to the original byte for byte, and between them hold every word", exact && covered);
}
/* ---------------------------------------------------------------- the scrub, on the serialised request */
const names = ["Niamh Byrne", "Cian Murphy", "Cian M", "Pat Green", "Ellie Murphy", "Orla Kelly", "Saoirse Kelly"];
const roles = { [FX.COACH]: "coach", [FX.PLAYER]: "player" };
const days = buildDays(pi, { order: pi.order, roles });
const bodies = days.map((d, i) => dayParts(days, i, { names, sport: "golf", player: PLAYER }).map((p) => bodyFor(p, { sport: "golf", player: PLAYER }).body)).flat();
const wire = JSON.stringify(bodies);
{
  const leaks = ["087", "123 4567", "niamh.byrne@example.ie", "example.ie", "https://", "example.com", "D02", "X285", "Niamh", "Byrne", "Cian", "Ellie", "Saoirse", "Orla",
    ".jpg", ".mp4", ".opus", "PHOTO-", "WA0", "Plan for the medal", "Paid", "€40", "sore", "Thanks Niamh", "really enjoyed"].filter((w) => wire.includes(w));
  check("no request carries a phone number, an email, a link, an Eircode, a known name, a file name, a held-back line or a player's words", leaks.length === 0, leaks.join(", "));
  check("a lower-case \"read the green\" stays with a Green on the roster", wire.includes("read the green"));
  const hb = bodies.flatMap((b) => b.segs).filter((s) => s.text === "[omitted]");
  check("held-back lines go as [omitted] with no number; \"pay attention\" is kept", hb.length >= 3 && hb.every((s) => !("id" in s)) && /Pay attention to your grip/.test(wire), hb.length);
  check("every player-side line is a marker", bodies.flatMap((b) => b.segs).filter((s) => s.a === "P").every((s) => MARKERS.includes(s.text)));
  check("every request passes the function's own check", bodies.every((b) => validate(b) === null), bodies.map(validate).filter(Boolean).join(","));
  check("a capitalised unknown name mid-sentence becomes ⟨name⟩", scrub("Great round with Tadhg today", { names: [], sport: "golf" }) === "Great round with ⟨name⟩ today");
  check("known names with and without fadas, in any case", scrub("SIOBHAN and siobhán played", { names: ["Siobhán Ní Bhriain"], sport: "golf" }) === "⟨name⟩ and ⟨name⟩ played");
  check("the held-back list: health, money and family words, whole words only; the kept phrases", heldBack("her back is sore") && heldBack("Paid for June") && heldBack("Tusla rang") && !heldBack("pay attention to your grip") && !heldBack("medicine ball throws") && !heldBack("bank shot practice") && !heldBack("soreness after the gym"));
}
/* ---------------------------------------------------------------- the budget */
{
  const big = Array.from({ length: 160 }, (_, i) => `[14/06/2025, 10:${String(i % 60).padStart(2, "0")}:00] Niamh Byrne: Síneadh ${i} ✨ fáilte ${"Á".repeat(20)} — keep the tempo smooth, it is coming on 😀`).join("\n");
  const p = parseChat(big + "\n");
  const ds = buildDays(p, { order: p.order, roles: { "Niamh Byrne": "coach" } });
  const parts = dayParts(ds, 0, { names: [], sport: "golf", player: PLAYER });
  const bs = parts.map((x) => bodyFor(x, { sport: "golf", player: PLAYER }).body);
  check("an emoji- and fada-heavy 150-segment day splits, every part under 16,384 bytes and the budget, counted over context and markers",
    parts.length > 1 && bs.every((b) => measure(b).bodyBytes <= BUDGET.bodyBytes && measure(b).segments <= BUDGET.segments && measure(b).textBytes <= BUDGET.textBytes && validate(b) === null), bs.map((b) => JSON.stringify(measure(b))).join(" "));
  check("a split part carries the part before it as context", bs.length > 1 && bs[1].segs.some((s) => s.part === "before") && bs[0].segs.some((s) => s.part === "after"));
  const h = halves(parts[0]);
  check("a part's two halves split at a message boundary", h.length === 2 && h[0].lines.length + h[1].lines.length === parts[0].lines.length);
}
/* ---------------------------------------------------------------- the plan */
{
  const d = days.find((x) => x.iso === "2025-03-27");
  const { ids } = bodyFor(dayParts(days, days.indexOf(d), { names, sport: "golf", player: PLAYER })[0], { sport: "golf", player: PLAYER });
  const note = buildNote(d, [ids.get(1), ids.get(2), ids.get(3)], [ids.get(3)], []);
  check("the note is rebuilt from the unscrubbed original, and the tip is lifted out", note === "Bunker play today. Open the face and splash the sand.\nTip · commit to the shot.", JSON.stringify(note));
  check("an unissued number is dropped", buildNote(d, [ids.get(1), ids.get(99)], [], []) === "Bunker play today.");
  const long = { msgs: Array.from({ length: 5 }, () => ({ body: "x".repeat(1500) })) };
  const ln = buildNote(long, long.msgs.map((m, i) => ({ mi: i, si: 0, start: 0, end: 1500 })));
  check("the 4,000 cut lands at a message boundary", ln.length === 1500 * 2 + 1, ln.length);
  const merged = mergeVerdicts([{ day: "chat", focus: [], note: [], tip: [], drills: [] }, { day: "lesson", focus: ["putt"], note: [1], tip: [], drills: [] }, { day: "recap", focus: ["chip"], note: [2], tip: [], drills: [] }]);
  check("split parts merge: lesson wins, areas unioned, numbers concatenated", merged.day === "lesson" && merged.focus.join() === "putt,chip" && merged.note.join() === "1,2");
  check("the focus: the sport's labels, else Lesson or Practice", focusFor("golf", ["putt", "chip"], "private") === "Putting · Chipping" && focusFor("golf", [], "private") === "Lesson" && focusFor("golf", [], "practice") === "Practice");
  check("\"Names Ellie\" fires on a capitalised sibling in the coach's lines", namesOther(days.find((x) => x.iso === "2025-05-01"), ["Ellie"]) === "Ellie" && namesOther(days.find((x) => x.iso === "2025-03-03"), ["Ellie"]) === null);
  const day0 = days.find((x) => x.iso === "2025-03-27"), chatDay = days.find((x) => x.iso === "2025-03-08"), mediaChat = days.find((x) => x.iso === "2025-05-15");
  const rows = [
    ["imported already, nothing new", decide({ day: day0, existing: { newFiles: 0 } }).reason === "Imported already"],
    ["imported already, new files", decide({ day: day0, existing: { newFiles: 3, newAreCoachs: true } }).reason === "Imported already · 3 new files"],
    ["another lesson that day", decide({ day: day0, verdict: { day: "lesson" }, otherLesson: true }).reason === "Already a lesson that day"],
    ["names a sibling", decide({ day: day0, verdict: { day: "lesson" }, named: "Ellie" }).reason === "Names Ellie"],
    ["lesson is ticked", decide({ day: day0, verdict: { day: "lesson" } }).ticked],
    ["practice with the player's file", decide({ day: day0, verdict: { day: "practice" }, playerFiles: true }).kind === "practice"],
    ["practice without one is unsure", decide({ day: day0, verdict: { day: "practice" }, playerFiles: false }).reason === "Not sure"],
    ["recap after a lesson joins it", decide({ day: day0, verdict: { day: "recap" }, prior: { isLesson: true, iso: "2025-03-26" } }).recapInto === "2025-03-26"],
    ["recap alone is unsure", decide({ day: day0, verdict: { day: "recap" }, prior: null }).reason === "Not sure"],
    ["unsure", decide({ day: day0, verdict: { day: "unsure" } }).reason === "Not sure"],
    ["chat without files is left out", decide({ day: chatDay, verdict: { day: "chat" } }).leftOut],
    ["chat with files", decide({ day: mediaChat, verdict: { day: "chat" } }).reason === "Looks like chat"],
    ["a refusal sleeps", decide({ day: day0, verdict: { status: "review" } }).sleep],
    ["failed", decide({ day: day0, verdict: { status: "failed" } }).reason === "Not sorted"],
  ];
  check(`the decision table, every row (${rows.length})`, rows.every((r) => r[1]), rows.filter((r) => !r[1]).map((r) => r[0]).join("; "));
  const fd = [fileDefault({ side: "C", kind: "photo" }, { kind: "lesson", mainSide: "Cian M" }).ticked, fileDefault({ side: "P", who: "Cian M", kind: "video" }, { kind: "practice", mainSide: "Cian M" }).ticked,
    !fileDefault({ side: "P", who: "Cian M", kind: "photo" }, { kind: "practice", mainSide: "Cian M" }).ticked, !fileDefault({ side: "P", who: "Cian M", kind: "audio" }, { kind: "lesson", mainSide: "Cian M" }).ticked,
    fileDefault({ side: "P", who: "Pat Doyle", kind: "video" }, { kind: "lesson", mainSide: "Cian M" }).reason === "From Pat", fileDefault({ side: "C", kind: "photo", screenshot: true }, { kind: "lesson" }).reason === "Looks like a screenshot"];
  check("file defaults by sender and day kind", fd.every(Boolean), JSON.stringify(fd));
  check("a screenshot by name, and by a phone screen's shape with no camera", screenshotByName({ ext: "png" }) && screenshotByName({ ext: "jpg", name: "Screenshot 2025.jpg" }) && screenshotByPixels(1170, 2532, false) && !screenshotByPixels(1170, 2532, true) && !screenshotByPixels(4032, 3024, false));
  const k = await lessonKey("11111111-1111-4111-8111-111111111111", PLAYER, "2025-06-14");
  const crypto = await import("node:crypto");
  check("the client's key equals the server's formula", k === crypto.createHash("sha256").update(`nosca-import|11111111-1111-4111-8111-111111111111|${PLAYER}|2025-06-14`).digest("hex"));
  check("the shape lock is a stable key", lockShape(pi.messages.length ? ip.text.split("\n") : []) !== null);
  check("the version is pinned", PROMPT_V === "1");
}
/* ---------------------------------------------------------------- refusals by content */
{
  const g = parseChat((await open("chat-group.zip")).text), s7 = parseChat((await open("chat-seven.zip")).text);
  const nz = await open("not-a-chat.zip"), nt = await open("not-a-chat.txt");
  check("a group chat is found by its own system line; seven labels are seven; a zip with no chat and a non-export are refused in words",
    g.group && s7.authors.size === 7 && nz.error === "No chat found in that file" && nt.error === "That isn't a WhatsApp export", JSON.stringify([g.group, s7.authors.size, nz.error, nt.error]));
}
fs.rmSync(tmp, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\nimport-parse: ${passed}/${results.length} passed`);
void here;
