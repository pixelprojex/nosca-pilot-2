/* THE IMPORT'S JOB (docs/import/SPEC.md, "The background job").
 *
 * Everything between the file a person chose and the lessons it becomes,
 * on the phone: read the chat (source, whatsapp), count it (Found), sort
 * its days one request at a time (the sort runner: three in flight, four
 * billed calls a part at most, the verdicts cached in the manifest so a
 * part is never billed twice), decide each day by code (plan.js), and on
 * Import upload every ticked file newest lesson first and write each
 * lesson the moment its last file is up, in waves (import_lessons), then
 * mark the batch done in one last call. Only the coach's words leave the
 * phone, scrubbed; no file name, no file, no other person's words.
 *
 * The state the screen draws lives in the eager job store (importJob), so
 * Back, a tab away and a return all find it where it was; what cannot be
 * drawn — the open zip, the chat's days, the verdicts — lives here. The
 * manifest (offline.js, "imports") keeps what a reload must not lose; a
 * reload loses the File, so the job waits, paused, until the same file is
 * chosen again. The hook's functions are reached through importJob.ctx(),
 * never held, so a job that runs on after its screen has gone calls the
 * current ones.
 */
import { importJob } from "../importJob.js";
import { openSource, sha256Hex, READ_ERROR } from "./source.js";
import { parseChat, dayOf } from "./whatsapp.js";
import { buildDays, dayParts, halves, bodyFor, fileKind, firstWords } from "./days.js";
import { mergeVerdicts, buildNote, focusFor, namesOther, fileDefault, screenshotByName, decide, lessonAt, fileAt, lessonKey, REASONS } from "./plan.js";
import { CACHEABLE, PROMPT_V, fold } from "../../../netlify/functions/lib/import-shared.mjs";
import { putImport, getImport, removeImport, listImports } from "../offline.js";

const MB = 1048576;
const IN_FLIGHT = 3, ALIVE = 64 * MB, ALONE = 21 * MB;
const WAVE_WHOLE = 8, WAVE_MS = 20000, WAVE_LESSONS = 50, WAVE_FILES = 600;
const ROOM = 600, PER_DAY = 200, TRIES = 3;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const isoParts = (iso) => String(iso).split("-").map(Number);
const prevIso = (iso) => { const [y, m, d] = isoParts(iso); const t = new Date(y, m - 1, d - 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
/* "Mon 3 Mar 2025" — the range's heading, always with its year */
export const dayWithYear = (iso) => { const [y, m, d] = isoParts(iso); const t = new Date(y, m - 1, d); return `${DOW[t.getDay()]} ${d} ${MON[m - 1]} ${y}`; };
const shortDay = (iso) => { const [y, m, d] = isoParts(iso); return `${d} ${MON[m - 1]} ${y}`; };
const first = (name) => String(name || "").split(" ")[0];
const C = () => importJob.ctx() || {};
const api = () => C().api || {};
const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;
const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16 >> (Number(c) / 4))).toString(16)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- what cannot be drawn */
let SRC = null;          // the open file: { files: Map(name → { size, read }), close }
let PARSED = null;       // parseChat's answer
let DAYS = null;         // buildDays' answer, oldest first
let IDX = new Map();     // iso → index into DAYS
const DAYV = new Map();  // iso → the merged verdict, or { status: "review" | "failed" }
let PARTV = {};          // part hash → { s: answer, n: calls } — the manifest's cache
let EDITS = {};          // iso → the person's own changes to a day
let EXIST = new Map();   // "<pid>|<iso>" → { lessonId, newFiles, newAreCoachs } for a day already imported
let KEYS = new Map();    // "<pid>|<iso>" → the lesson key
let PENDING = null;      // a file read while a different chat waits to be resumed
let SORT = null;         // the sort runner's own: { queue, flight, stopped }
let RUN = null;          // the upload and wave runner's own
let SAVE_T = null;

/* ---------------------------------------------------------------- who is who */
const ctxPeople = () => {
  const c = C(); const out = new Map();
  [...(c.people || [])].forEach((p) => { if (p && p.id && !out.has(p.id)) out.set(p.id, p); });
  return out;
};
const personOf = (id) => ctxPeople().get(id) || null;
const nameOf = (id) => (personOf(id) || {}).name || "";
const isJunior = (id) => !!(personOf(id) || {}).junior;
/* the importer's part toward the player: the coach, the player themselves, or an adult who looks after them */
const modeFor = (pid) => { const c = C(); return c.isCoach ? "coach" : pid === c.meId ? "player" : "adult"; };
const coachOf = (pid) => { const c = C(); return c.isCoach ? { id: c.meId, name: c.meName } : (c.coachFor ? c.coachFor(pid) : null) || { id: null, name: "" }; };

/* ---------------------------------------------------------------- the manifest */
const mkey = (owner, hash) => `${owner}|${hash}`;
function snapshot() {
  const j = importJob.get(); if (!j || !j.chatHash || !j.owner) return null;
  return { key: mkey(j.owner, j.chatHash), owner: j.owner, chatHash: j.chatHash, fileName: j.fileName || "", at: Date.now(),
    roles: j.roles, order: j.order, forId: j.forId, sport: j.sport, mode: j.mode, edits: EDITS, verdicts: PARTV,
    run: RUN ? { batches: RUN.batches, lessons: RUN.lessons.map(stripLesson), done: RUN.doneBatches || {} } : null };
}
const stripLesson = (l) => ({ iso: l.iso, forId: l.forId, kind: l.kind, focus: l.focus, note: l.note, at: l.at, add: !!l.add, lessonId: l.lessonId || null, committed: !!l.committed,
  files: l.files.map((f) => ({ name: f.name, kind: f.kind, ext: f.ext, mime: f.mime, at: f.at, size: f.size, uuid: f.uuid, path: f.path, hash: f.hash || null, up: !!f.up, out: !!f.out, dup: !!f.dup })) });
function save(now = false) {
  if (SAVE_T) clearTimeout(SAVE_T);
  const go = () => { SAVE_T = null; const s = snapshot(); if (s) putImport(s).catch(() => {}); };
  if (now) go(); else SAVE_T = setTimeout(go, 800);
}
async function forget() {
  const j = importJob.get(); if (SAVE_T) { clearTimeout(SAVE_T); SAVE_T = null; }
  if (j && j.owner && j.chatHash) { try { await removeImport(mkey(j.owner, j.chatHash)); } catch (e) { /* gone already */ } }
}

/* ---------------------------------------------------------------- the start: anything interrupted? */
/* On the Import screen's first open, and on the app's own: a manifest of this
   person's with batches begun and not finished is an interrupted import. A
   batch the server has since finished (seven idle days) or removed is done
   with, and its manifest goes. */
export async function lookForInterrupted() {
  const c = C(); if (!c.meId) return null;
  const cur = importJob.get(); if (cur && cur.owner === c.meId && cur.phase && cur.phase !== "done") return cur;
  let rows = []; try { rows = await listImports(c.meId); } catch (e) { return null; }
  const imports = c.imports || [];
  for (const m of rows.sort((a, b) => b.at - a.at)) {
    if (!m.run || !m.run.batches || !Object.keys(m.run.batches).length) continue;
    const states = Object.values(m.run.batches).map((id) => (imports.find((b) => b.id === id) || {}).status || null);
    if (states.every((s) => s === "done" || s === "removed")) { removeImport(m.key).catch(() => {}); continue; }
    const lessons = m.run.lessons || [];
    importJob.set({ owner: c.meId, phase: "paused", view: "start", chatHash: m.chatHash, fileName: m.fileName, roles: m.roles, order: m.order, forId: m.forId, sport: m.sport, mode: m.mode,
      resume: { forId: m.forId, lessons: lessons.length, lessonsIn: lessons.filter((l) => l.committed).length,
                files: lessons.reduce((n, l) => n + l.files.filter((f) => !f.out && !f.dup).length, 0), filesUp: lessons.reduce((n, l) => n + l.files.filter((f) => f.up).length, 0) },
      run: { status: "paused", lessons: lessons.length, lessonsDone: lessons.filter((l) => l.committed).length } });
    return importJob.get();
  }
  return null;
}

/* ---------------------------------------------------------------- choosing a file */
const refuse = (error, extra = {}) => importJob.set((j) => ({ ...(j || {}), reading: false, error, errorAction: null, ...extra }));
export async function choose(fileList) {
  const c = C();
  const prior = importJob.get();
  const resuming = !!(prior && prior.phase === "paused" && prior.owner === c.meId);
  importJob.set({ ...(prior || { owner: c.meId, view: "start" }), owner: c.meId, reading: true, error: null, errorAction: null });
  const src = await openSource(fileList);
  if (!src.ok) return refuse(src.error);
  if (resuming && src.chatHash !== prior.chatHash) { PENDING = src; return refuse("That's a different chat", { errorAction: "restart" }); }
  if (SRC && SRC !== src) { try { SRC.close(); } catch (e) { /* fine */ } }
  SRC = src;
  const parsed = parseChat(src.text);
  if (!parsed.ok || !parsed.messages.length) return refuse(parsed.error || "No messages found");
  if (parsed.group) return refuse("Group chats can't be imported");
  if (parsed.authors.size > 6) return refuse("Only the coach and one family can be in an imported chat");
  PARSED = parsed;
  if (resuming) return resumeWith(prior);
  /* the same chat chosen again: what was sorted is kept, never billed twice */
  let m = null; try { m = await getImport(mkey(c.meId, src.chatHash)); } catch (e) { m = null; }
  if (m && m.run && m.run.batches && Object.keys(m.run.batches).length) {
    importJob.set({ owner: c.meId, phase: "paused", chatHash: m.chatHash, fileName: m.fileName, roles: m.roles, order: m.order, forId: m.forId, sport: m.sport, mode: m.mode, view: "start" });
    return resumeWith(importJob.get());
  }
  PARTV = (m && m.verdicts) || {}; EDITS = (m && m.edits) || {};
  DAYV.clear(); EXIST = new Map(); KEYS = new Map(); DAYS = null; IDX = new Map();
  const found = foundOf(parsed, src, (m && m.order) || parsed.order || null);
  const targets = (c.targets || []).map((x) => x.player_id);
  const forId = m && m.forId ? m.forId : c.forParam && targets.includes(c.forParam) ? c.forParam : !c.isCoach && targets.length === 1 ? targets[0] : null;
  const roles = (m && m.roles) || prefill(parsed, forId);
  importJob.set({ owner: c.meId, phase: "found", view: "found", reading: false, error: null, chatHash: src.chatHash, fileName: [...(fileList || [])].map((f) => f.name)[0] || "",
    found, labels: [...parsed.authors.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    roles, order: (m && m.order) || parsed.order || null, needOrder: !parsed.order, orderTiles: parsed.order ? null : orderTiles(parsed),
    forId, sport: (m && m.sport) || sportFor(forId), mode: forId ? modeFor(forId) : (c.isCoach ? "coach" : "player"),
    rows: [], sort: null, run: null, filter: "all", listView: "list" });
  return importJob.get();
}
/* "Start again with this one": the interrupted import is finished with what is in, or removed when nothing is, and the new file is read */
export async function restartWithPending() {
  const src = PENDING; PENDING = null;
  const j = importJob.get();
  if (j && j.phase === "paused") await finishInterrupted(false);
  if (!src) return null;
  importJob.set(null);
  SRC = src;
  return chooseOpened(src);
}
async function chooseOpened(src) {
  const c = C();
  const parsed = parseChat(src.text);
  if (!parsed.ok || !parsed.messages.length) return refuse(parsed.error || "No messages found");
  if (parsed.group) return refuse("Group chats can't be imported");
  if (parsed.authors.size > 6) return refuse("Only the coach and one family can be in an imported chat");
  PARSED = parsed; PARTV = {}; EDITS = {}; DAYV.clear(); EXIST = new Map(); KEYS = new Map(); DAYS = null;
  const targets = (c.targets || []).map((x) => x.player_id);
  const forId = !c.isCoach && targets.length === 1 ? targets[0] : null;
  importJob.set({ owner: c.meId, phase: "found", view: "found", reading: false, chatHash: src.chatHash, found: foundOf(parsed, src, parsed.order),
    labels: [...parsed.authors.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    roles: prefill(parsed, forId), order: parsed.order || null, needOrder: !parsed.order, orderTiles: parsed.order ? null : orderTiles(parsed),
    forId, sport: sportFor(forId), mode: forId ? modeFor(forId) : (c.isCoach ? "coach" : "player"), rows: [], filter: "all", listView: "list" });
  return importJob.get();
}
const sportFor = (pid) => { const c = C(); const p = pid ? personOf(pid) : null; return (p && p.sport) || c.sport || "golf"; };
/* the pre-filled parts: a label holding the coach's whole name is the coach;
   the account's own whole name is its own side; every row stays a choice */
function prefill(parsed, forId) {
  const c = C(); const roles = {};
  /* the coach: the importer, or the coach of whoever it may be for (a parent's children share one, as a rule) */
  const coaches = c.isCoach ? [c.meName] : [...new Set([forId ? (coachOf(forId) || {}).name : null, ...(c.targets || []).map((x) => (coachOf(x.player_id) || {}).name), c.coachName].filter(Boolean))];
  for (const label of parsed.authors.keys()) {
    const f = fold(label);
    if (coaches.some((n) => f.includes(fold(n)))) roles[label] = "coach";
    else if (!c.isCoach && c.meName && f.includes(fold(c.meName))) roles[label] = "player";
    else roles[label] = null;
  }
  return roles;
}
/* when nothing in the file proves the order, the person picks it on two tiles read off one ambiguous date */
function orderTiles(parsed) {
  const m = parsed.messages.find((x) => Number(x.a) <= 12 && Number(x.b) <= 12 && x.a !== x.b) || parsed.messages[0];
  const out = [];
  for (const order of ["dmy", "mdy"]) { const iso = dayOf(m.a, m.b, m.c, order); if (iso) out.push({ order, label: shortDay(iso) }); }
  return out;
}

/* FOUND: everything counted by code, on the phone; nothing has left it */
function foundOf(parsed, src, order) {
  const c = C(); const maxB = (c.maxMb || 50) * MB;
  const counts = { messages: parsed.messages.length, videos: 0, photos: 0, voice: 0, size: 0 };
  const left = { notInFile: [], over50: [], over200: [], documents: [], stickers: [], notRead: parsed.counts.before || 0 };
  const perDay = new Map(); let firstIso = null, lastIso = null;
  for (const m of parsed.messages) {
    const iso = order ? dayOf(m.a, m.b, m.c, order) : dayOf(m.a, m.b, m.c, "dmy") || dayOf(m.a, m.b, m.c, "mdy");
    if (iso) { if (!firstIso || iso < firstIso) firstIso = iso; if (!lastIso || iso > lastIso) lastIso = iso; }
    if (m.omitted) { left.notInFile.push("<Media omitted>"); continue; }
    if (!m.attachment) continue;
    const name = m.attachment.name, fk = fileKind(name), entry = src.files.get(name);
    if (fk.kind === "sticker") { left.stickers.push(name); continue; }
    if (fk.kind === "document") { left.documents.push(name); continue; }
    if (!entry) { left.notInFile.push(name); continue; }
    if (entry.size > maxB) { left.over50.push(name); continue; }
    const n = (perDay.get(iso) || 0) + 1; perDay.set(iso, n);
    if (n > PER_DAY) { left.over200.push(name); continue; }
    if (fk.kind === "video") counts.videos += 1; else if (fk.kind === "photo") counts.photos += 1; else counts.voice += 1;
    counts.size += entry.size || 0;
  }
  return { first: firstIso, last: lastIso, counts, left, media: counts.videos + counts.photos + counts.voice + left.notInFile.length + left.over50.length + left.over200.length > 0 };
}

/* ---------------------------------------------------------------- the choices on Found */
export function setRole(label, role) {
  importJob.patch((j) => {
    const roles = { ...j.roles };
    /* exactly one coach: choosing a second takes it from the first */
    if (role === "coach") Object.keys(roles).forEach((k) => { if (roles[k] === "coach") roles[k] = null; });
    Object.keys(roles).forEach((k) => { if (roles[k] === `same:${label}` && role && role.startsWith("same:")) roles[k] = null; });
    roles[label] = role;
    return { roles };
  });
  save();
}
export function setFor(pid) {
  importJob.patch((j) => ({ forId: pid, sport: sportFor(pid), mode: modeFor(pid), roles: j.roles }));
  save();
}
export const setSport = (sport) => { importJob.patch({ sport }); save(); };
export function setOrder(order) {
  importJob.patch((j) => ({ order, found: SRC && PARSED ? foundOf(PARSED, SRC, order) : j.found }));
  save();
}
/* every label has a part, exactly one is the coach, For is chosen, the dates are read one way */
export function ready(j = importJob.get()) {
  if (!j || !j.roles || !j.forId || !j.sport) return false;
  if (j.needOrder && !j.order) return false;
  const vals = Object.values(j.roles);
  return vals.every((v) => !!v) && vals.filter((v) => v === "coach").length === 1;
}
/* the main player-side label: the one of the player's side with the most messages */
export function mainSide(j = importJob.get()) {
  const counts = new Map();
  for (const { label, count } of j.labels || []) {
    let l = label, n = 0; while (j.roles[l] && String(j.roles[l]).startsWith("same:") && n++ < 8) l = j.roles[l].slice(5);
    if (j.roles[l] === "player") counts.set(l, (counts.get(l) || 0) + count);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || null;
}
export const coachLabel = (j = importJob.get()) => Object.keys(j.roles || {}).find((k) => j.roles[k] === "coach") || null;
const wordsOf = (s) => fold(s).split(/[^a-z0-9'’-]+/).filter(Boolean);
/* the checks before sorting: the player-side label against the chosen player (a coach), the coach's label against the current coach (anyone else) */
export function checkNeeded(j = importJob.get()) {
  const c = C();
  if (c.isCoach) {
    const label = mainSide(j); const who = nameOf(j.forId);
    if (!label || !who) return null;
    const names = wordsOf(who); const hit = wordsOf(label).some((w) => names.includes(w));
    return hit ? null : { kind: "who", label, name: who };
  }
  const label = coachLabel(j); const coach = coachOf(j.forId);
  if (!label || !coach || !coach.name) return null;
  const names = wordsOf(coach.name); const hit = wordsOf(label).some((w) => names.includes(w));
  return hit ? null : { kind: "coach", label, name: coach.name };
}

/* ---------------------------------------------------------------- sorting */
const knownNames = (j) => {
  const c = C(); const out = new Set(Object.keys(j.roles || {}));
  [...ctxPeople().values()].forEach((p) => p.name && out.add(p.name));
  if (c.meName) out.add(c.meName); if (c.coachName) out.add(c.coachName);
  return [...out];
};
const otherFirsts = (pid) => [...ctxPeople().values()].filter((p) => p.id !== pid && p.role !== "coach" && p.name).map((p) => first(p.name)).filter((n) => n && fold(n) !== fold(first(nameOf(pid))));
/* the day's parts and their bodies — what is sent for it, nothing else */
function partsOf(j, iso) {
  const idx = IDX.get(iso); const pid = (EDITS[iso] && EDITS[iso].forId) || j.forId;
  const opts = { names: knownNames(j), sport: j.sport, player: pid };
  return dayParts(DAYS, idx, opts).map((p) => ({ part: p, ...bodyFor(p, { sport: j.sport, player: pid }) }));
}
/* the request the screen shows under "See what is sent": the first day with the coach's words */
export function previewBody() {
  const j = importJob.get(); if (!j || !PARSED || !ready(j)) return null;
  const days = DAYS || buildDays(PARSED, { order: j.order, roles: j.roles });
  if (!DAYS) { DAYS = days; IDX = new Map(days.map((d, i) => [d.iso, i])); }
  const day = days.find((d) => d.msgs.some((x) => x.side === "C" && x.segs.some((sg) => !sg.held)));
  if (!day) return null;
  const parts = partsOf(j, day.iso);
  return parts.length ? parts[0].body : null;
}
export const blockText = (body) => {
  if (!body) return "";
  const out = []; let part = null;
  for (const s of body.segs) { if (s.part !== part) { part = s.part; out.push(`[${part}]`); } out.push(s.id != null ? `#${s.id} ${s.a}: ${s.text}` : `${s.a}: ${s.text}`); }
  return out.join("\n");
};

export async function startSorting() {
  const j = importJob.get(); if (!j || !ready(j) || !PARSED) return;
  DAYS = buildDays(PARSED, { order: j.order, roles: j.roles }).filter((d) => d.iso <= todayIso() && d.iso >= "2009-01-01");
  IDX = new Map(DAYS.map((d, i) => [d.iso, i]));
  importJob.patch({ phase: "sorting", view: "review", sort: { total: DAYS.length, done: 0, status: "running", failed: 0 }, mode: modeFor(j.forId) });
  save(true);
  await prepareExisting();
  /* days decided by code alone, before anything is sent */
  for (const d of DAYS) {
    const pid = (EDITS[d.iso] && EDITS[d.iso].forId) || j.forId;
    if (EXIST.has(`${pid}|${d.iso}`)) continue;
    const coachWords = d.msgs.some((x) => x.side === "C" && x.segs.some((sg) => !sg.held));
    if (!coachWords) DAYV.set(d.iso, { day: d.msgs.some((x) => x.file) ? "unsure" : "chat", focus: [], note: [], tip: [], drills: [] });
  }
  replan();
  runSorter();
}
/* the days already imported for this player: their keys, and which of their files are new */
async function prepareExisting() {
  const j = importJob.get(); const c = C();
  const lessons = (c.lessons || []).filter((l) => l.imported && l.importKey);
  const byKey = new Map(lessons.map((l) => [l.importKey, l]));
  const coachIdFor = (pid) => (c.isCoach ? c.meId : (coachOf(pid) || {}).id);
  const pids = new Set([j.forId, ...Object.values(EDITS).map((e) => e && e.forId).filter(Boolean)]);
  for (const pid of pids) {
    const cid = coachIdFor(pid); if (!cid) continue;
    for (const d of DAYS) KEYS.set(`${pid}|${d.iso}`, await lessonKey(cid, pid, d.iso));
  }
  const hits = [];
  for (const [k, key] of KEYS) if (byKey.has(key)) hits.push([k, byKey.get(key)]);
  if (!hits.length) return;
  let have = new Map();
  try { const r = await api().importHashes(hits.map(([, l]) => l.id)); have = r && r.data ? r.data : new Map(); } catch (e) { have = new Map(); }
  for (const [k, l] of hits) {
    const iso = k.split("|")[1]; const day = DAYS[IDX.get(iso)];
    const hashes = have.get(l.id) || new Set(); let fresh = 0, coachOnly = true;
    for (const x of day.msgs) {
      if (!x.file || !["video", "photo", "audio"].includes(x.file.kind)) continue;
      const entry = SRC && SRC.files.get(x.file.name); if (!entry || entry.size > (C().maxMb || 50) * MB) continue;
      let h = null; try { h = await sha256Hex(await entry.read(x.file.mime)); } catch (e) { return pauseForRead(); }
      x.file.hash = h;
      if (!hashes.has(h)) { fresh += 1; if (x.side !== "C") coachOnly = false; }
    }
    EXIST.set(k, { lessonId: l.id, newFiles: fresh, newAreCoachs: fresh > 0 && coachOnly, hashes });
  }
}

/* THE SORT RUNNER: newest day first; three in flight (the first of a sport
   alone while its system prefix is cacheable); per part at most four billed
   calls — twice the whole part, then each half once — then "Not sorted";
   busy waits as long as it is told, with jitter; review is never retried;
   paused, over and unavailable stop the runner, and what is sorted stays. */
function runSorter() {
  const j = importJob.get(); if (!j) return;
  const tasks = [];
  for (const d of [...DAYS].reverse()) {
    if (DAYV.has(d.iso)) continue;
    const pid = (EDITS[d.iso] && EDITS[d.iso].forId) || j.forId;
    if (EXIST.has(`${pid}|${d.iso}`)) continue;
    tasks.push(d.iso);
  }
  SORT = { queue: tasks, flight: 0, stopped: false, first: !!CACHEABLE[j.sport], perDay: new Map() };
  if (!tasks.length) return finishSorting();
  pumpSorter();
}
function pumpSorter() {
  const S = SORT; if (!S || S.stopped) return;
  const limit = S.first ? 1 : 3;
  while (S.flight < limit && S.queue.length) {
    const iso = S.queue.shift(); S.flight += 1;
    sortDay(iso).catch(() => { DAYV.set(iso, { status: "failed" }); }).finally(() => {
      S.flight -= 1; S.first = false; tickSort();
      if (!S.stopped) { if (S.queue.length) pumpSorter(); else if (!S.flight) finishSorting(); }
    });
    if (S.first) break;
  }
}
let TICK_T = null;
function tickSort() {
  if (TICK_T) return;
  /* the rows arrive a few at a time, not one render a day */
  TICK_T = setTimeout(() => {
    TICK_T = null;
    const j = importJob.get(); if (!j || !j.sort || !DAYS) return;
    replan();
    importJob.patch((x) => ({ sort: { ...x.sort, done: DAYS.filter((d) => DAYV.has(d.iso) || EXIST.has(`${((EDITS[d.iso] && EDITS[d.iso].forId) || x.forId)}|${d.iso}`)).length } }));
    save();
  }, 120);
}
function finishSorting() {
  if (TICK_T) { clearTimeout(TICK_T); TICK_T = null; }
  const j = importJob.get(); if (!j || !j.sort) return;
  const failed = DAYS.filter((d) => (DAYV.get(d.iso) || {}).status === "failed").length;
  replan();
  importJob.patch((x) => ({ phase: x.phase === "sorting" ? "review" : x.phase, sort: { ...x.sort, done: x.sort.total, status: failed ? "failed" : "done", failed } }));
  save(true);
}
/* the runner stops: the words the progress line says, and Retry where a tap can help */
function stopSorter(status) {
  if (SORT) SORT.stopped = true;
  importJob.patch((x) => ({ sort: { ...(x.sort || {}), status } }));
  save(true);
}
export function retrySorting() {
  const j = importJob.get(); if (!j || !DAYS) return;
  /* a person's Retry gives a day not sorted a fresh go */
  DAYS.forEach((d) => { if ((DAYV.get(d.iso) || {}).status === "failed") DAYV.delete(d.iso); });
  importJob.patch((x) => ({ phase: "sorting", sort: { ...(x.sort || {}), status: "running", failed: 0 } }));
  runSorter();
}
async function sortDay(iso) {
  const j = importJob.get();
  const parts = partsOf(j, iso);
  const answers = [];
  for (const p of parts) {
    const a = await sortPart(p, j.sport, 0);
    if (a === "stop") throw Object.assign(new Error("stopped"), { stop: true });
    answers.push(a);
  }
  if (answers.some((a) => a.status === "review")) DAYV.set(iso, { status: "review" });
  else if (answers.some((a) => a.status === "failed")) DAYV.set(iso, { status: "failed" });
  else DAYV.set(iso, mergeVerdicts(answers.map((a) => a.v)));
}
const partHash = (sport, body) => sha256Hex(`${PROMPT_V}|${sport}|${JSON.stringify(body)}`);
/* one part: its cached answer, or the calls; `stage` 0 is the whole part, 1 a half */
async function sortPart(p, sport, stage) {
  const h = await partHash(sport, p.body);
  const cached = PARTV[h];
  if (cached && cached.s) return refsOf(cached.s, p.ids);
  let calls = (cached && cached.n) || 0;
  const maxWhole = stage === 0 ? 2 : 1;
  while (calls < maxWhole) {
    if (SORT && SORT.stopped) return "stop";
    await online();
    calls += 1; PARTV[h] = { n: calls }; save();
    const ans = await ask(p.body);
    if (ans.status === "ok") { PARTV[h] = { n: calls, s: { status: "ok", day: ans.day, focus: ans.focus, note: ans.note, tip: ans.tip, drills: ans.drills } }; save(); return refsOf(PARTV[h].s, p.ids); }
    if (ans.status === "review") { PARTV[h] = { n: calls, s: { status: "review" } }; save(); return { status: "review" }; }
    if (ans.status === "failed") { PARTV[h] = { n: calls, s: { status: "failed" } }; save(); return { status: "failed" }; }
    if (ans.status === "paused" || ans.status === "unavailable" || ans.status === "refused") { stopSorter("paused"); return "stop"; }
    if (ans.status === "over") { stopSorter("over"); return "stop"; }
    if (ans.status === "signin") { stopSorter("signin"); return "stop"; }
    if (ans.status === "offline") { calls -= 1; PARTV[h] = { n: calls }; continue; }
    if (ans.status === "retry") break;
    /* busy, a timeout, anything not understood: wait as long as it is told, with jitter */
    if (calls < maxWhole) await sleep(((ans.retryAfter || 2) * 1000) * (0.8 + Math.random() * 0.4));
  }
  if (stage > 0) return { status: "failed" };
  /* the third and fourth calls: each half once */
  const [a, b] = halves(p.part).map((x) => ({ part: x, ...bodyFor(x, { sport: p.body.sport, player: p.body.player }) }));
  if (!a.part.lines.length || !b.part.lines.length) return { status: "failed" };
  const ra = await sortPart(a, sport, 1); if (ra === "stop") return "stop";
  const rb = await sortPart(b, sport, 1); if (rb === "stop") return "stop";
  if (ra.status === "review" || rb.status === "review") return { status: "review" };
  if (ra.status === "failed" || rb.status === "failed") return { status: "failed" };
  return { status: "ok", v: mergeVerdicts([ra.v, rb.v]) };
}
/* the numbers given back, turned into where the coach's own words are */
function refsOf(s, ids) {
  if (s.status !== "ok") return { status: s.status };
  const map = (xs) => (xs || []).map((n) => ids.get(n)).filter(Boolean);
  return { status: "ok", v: { day: s.day, focus: s.focus || [], note: map(s.note), tip: map(s.tip), drills: map(s.drills) } };
}
async function online() {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return;
  importJob.patch((x) => ({ sort: x.sort ? { ...x.sort, status: "offline" } : x.sort }));
  await new Promise((r) => window.addEventListener("online", r, { once: true }));
  importJob.patch((x) => ({ sort: x.sort ? { ...x.sort, status: "running" } : x.sort }));
}
async function ask(body) {
  try { return (await api().importSort(body)) || { status: "busy" }; } catch (e) { return { status: "busy" }; }
}

/* ---------------------------------------------------------------- the plan: every day, decided by code */
const dayFiles = (j, day, d, ticked) => {
  const maxB = (C().maxMb || 50) * MB; const main = mainSide(j); const e = EDITS[day.iso] || {};
  const out = []; let n = 0;
  day.msgs.forEach((x, mi) => {
    if (!x.file || !["video", "photo", "audio"].includes(x.file.kind)) return;
    const entry = SRC ? SRC.files.get(x.file.name) : null;
    if (SRC && !entry) return;
    if (entry && entry.size > maxB) return;
    n += 1; if (n > PER_DAY) return;
    const f = { name: x.file.name, kind: x.file.kind, mime: x.file.mime, ext: x.file.ext, side: x.side, who: x.who, mi, size: entry ? entry.size : 0, at: fileAt(day, x, n - 1),
      time: `${pad(x.h % 12 || 12)}:${pad(x.min)} ${x.h < 12 ? "am" : "pm"}`, screenshot: screenshotByName({ ext: x.file.ext, name: x.file.name }) };
    const def = fileDefault({ ...f, who: x.who }, { kind: d.kind || "private", mainSide: main });
    const own = e.files && e.files[f.name];
    f.reason = def.reason; f.ticked = own !== undefined ? own : ticked && def.ticked;
    out.push(f);
  });
  return out;
};
/* the chosen lines of a day: the verdict's, less what the person took out, plus what they added */
const keyOf = (r) => `${r.mi}|${r.si}`;
function chosenOf(iso, v, junior) {
  const e = EDITS[iso] || {}; const off = new Set(e.off || []); const add = e.add || [];
  /* a junior's day builds no note: only the lines a person taps */
  const base = junior ? { note: [], tip: [], drills: [] } : { note: (v && v.note) || [], tip: (v && v.tip) || [], drills: (v && v.drills) || [] };
  const keep = (xs) => xs.filter((r) => !off.has(keyOf(r)));
  return { note: [...keep(base.note), ...add.filter((r) => !off.has(keyOf(r)))], tip: keep(base.tip), drills: keep(base.drills) };
}
export function replan() {
  const j = importJob.get(); if (!j || !DAYS) return;
  const c = C(); const rows = {};
  for (const day of DAYS) {
    const e = EDITS[day.iso] || {};
    const pid = e.forId || j.forId;
    const verdict = DAYV.get(day.iso) || null;
    const ex = EXIST.get(`${pid}|${day.iso}`) || null;
    const other = (c.lessons || []).some((l) => l.iso === day.iso && !(l.imported && l.importKey === KEYS.get(`${pid}|${day.iso}`)) && (l.playerId === pid || (l.attendeeIds || []).includes(pid)));
    const named = namesOther(day, otherFirsts(pid));
    const playerFiles = day.msgs.some((x) => x.side === "P" && x.file && (x.file.kind === "video" || x.file.kind === "photo"));
    const prior = rows[prevIso(day.iso)] || null;
    const merged = verdict && verdict.day ? verdict : null;
    let d = decide({ day, verdict: merged || (verdict && verdict.status ? verdict : null), existing: ex ? { newFiles: ex.newFiles, newAreCoachs: ex.newAreCoachs } : null,
      otherLesson: other, named, playerFiles, prior: prior ? { isLesson: prior.state === "lesson" || prior.state === "practice" || !!prior.made, iso: prior.iso } : null });
    if (e.make && d.leftOut) d = { state: "lesson", ticked: true, kind: "private", reason: null };
    const junior = isJunior(pid);
    const kind = e.kind || d.kind || (merged && merged.day === "practice" ? "practice" : "private");
    let ticked = e.ticked !== undefined && !d.locked ? e.ticked : !!d.ticked;
    if (d.sleep && !e.opened) ticked = false;
    const ch = chosenOf(day.iso, merged, junior);
    const focusIds = e.focus !== undefined ? e.focus : (merged ? merged.focus : []);
    rows[day.iso] = { iso: day.iso, forId: pid, state: d.state, reason: d.reason, locked: !!d.locked, sleep: !!d.sleep && !e.opened, leftOut: !!d.leftOut && !e.make, made: !!e.make,
      recapInto: d.recapInto || null, add: !!d.add, ticked: !!ticked && !d.locked && !(d.leftOut && !e.make), kind, focusIds, chosen: ch,
      pending: d.state === "pending", existingId: ex ? ex.lessonId : null, first: firstWords(day), junior };
  }
  /* a recap's chosen lines join the lesson the day before */
  for (const r of Object.values(rows)) if (r.recapInto && rows[r.recapInto]) (rows[r.recapInto].recaps = rows[r.recapInto].recaps || []).push(r.iso);
  for (const r of Object.values(rows)) {
    const day = DAYS[IDX.get(r.iso)]; const e = EDITS[r.iso] || {};
    let note = buildNote(day, r.chosen.note, r.chosen.tip, r.chosen.drills);
    for (const iso of r.recaps || []) { const rr = rows[iso]; const t = buildNote(DAYS[IDX.get(iso)], rr.chosen.note, rr.chosen.tip, rr.chosen.drills); if (t) note = note ? `${note}\n${t}` : t; }
    r.note = e.note !== undefined ? e.note : note;
    r.focus = focusFor(j.sport, r.focusIds, r.kind);
    r.files = dayFiles(j, day, r, r.ticked);
    r.fileCount = r.files.filter((f) => f.ticked).length;
  }
  const all = Object.values(rows).sort((a, b) => (a.iso < b.iso ? 1 : -1));
  importJob.patch({ rows: all.filter((r) => !r.leftOut && !r.pending), leftOut: all.filter((r) => r.leftOut && !r.pending), rowsByIso: rows });
}

/* ---------------------------------------------------------------- the person's own changes */
const edit = (iso, p) => { EDITS = { ...EDITS, [iso]: { ...(EDITS[iso] || {}), ...p } }; replan(); save(); };
export const setTicked = (iso, on) => edit(iso, { ticked: !!on });
export const setDayFocus = (iso, ids) => edit(iso, { focus: ids });
export const setDayFile = (iso, name, on) => edit(iso, { files: { ...((EDITS[iso] || {}).files || {}), [name]: !!on } });
export const setDayNote = (iso, text) => edit(iso, { note: text });
export const openedDay = (iso) => { if (!(EDITS[iso] || {}).opened) edit(iso, { opened: true }); };
export const makeLesson = (iso) => edit(iso, { make: true, ticked: true });
export function setDayFor(iso, pid) {
  edit(iso, { forId: pid });
  /* a day filed under another player is decided again for them */
  const j = importJob.get(); if (!j || !DAYS) return;
  const cid = C().isCoach ? C().meId : (coachOf(pid) || {}).id;
  if (cid && !KEYS.has(`${pid}|${iso}`)) lessonKey(cid, pid, iso).then((k) => { KEYS.set(`${pid}|${iso}`, k); replan(); });
}
/* a tap on one of the coach's lines in the day's Messages: in the note, or out of it */
export function toggleLine(iso, mi, si) {
  const j = importJob.get(); const row = j && j.rowsByIso && j.rowsByIso[iso]; if (!row) return;
  const day = DAYS[IDX.get(iso)]; const sg = day.msgs[mi].segs[si]; const ref = { mi, si, start: sg.start, end: sg.end };
  const k = keyOf(ref); const e = EDITS[iso] || {};
  const inNote = [...row.chosen.note, ...row.chosen.tip, ...row.chosen.drills].some((r) => keyOf(r) === k);
  const words = day.msgs[mi].body.slice(sg.start, sg.end);
  if (e.note !== undefined) {
    /* the coach typed: the line's words join the end, or leave the text */
    const text = e.note.includes(words) ? e.note.replace(words, "").replace(/\n{2,}/g, "\n").trim() : (e.note ? `${e.note}\n${words}` : words);
    return edit(iso, { note: text, off: inNote ? [...(e.off || []), k] : (e.off || []).filter((x) => x !== k), add: inNote ? (e.add || []).filter((r) => keyOf(r) !== k) : [...(e.add || []), ref] });
  }
  if (inNote) edit(iso, { off: [...new Set([...(e.off || []), k])], add: (e.add || []).filter((r) => keyOf(r) !== k) });
  else edit(iso, { off: (e.off || []).filter((x) => x !== k), add: [...(e.add || []), ref] });
}
export const dayOfIso = (iso) => (DAYS && IDX.has(iso) ? DAYS[IDX.get(iso)] : null);
/* one of the chat's files, read from the zip for the day's viewer; a read that fails is the paused state */
export async function fileBlob(name, mime) {
  const entry = SRC && SRC.files.get(name); if (!entry) return null;
  try { return await entry.read(mime); } catch (e) { pauseForRead(); return null; }
}
export const fileEntry = (name) => (SRC ? SRC.files.get(name) || null : null);
export const view = (v, dayIso) => importJob.patch(dayIso !== undefined ? { view: v, dayIso } : { view: v });
export const setFilter = (f) => importJob.patch({ filter: f });
export const setListView = (v) => importJob.patch({ listView: v });

/* the room a player has: 600 imported lessons at most, less what is in */
export function roomFor(pid) { const c = C(); return Math.max(ROOM - (c.lessons || []).filter((l) => l.imported && (l.playerId === pid)).length, 0); }
export function overRoom(j = importJob.get()) {
  const by = new Map(); (j.rows || []).filter((r) => r.ticked && !r.add).forEach((r) => by.set(r.forId, (by.get(r.forId) || 0) + 1));
  for (const [pid, n] of by) if (n > roomFor(pid)) return { pid, n, room: roomFor(pid) };
  return null;
}

/* ---------------------------------------------------------------- import */
/* Import: one batch a player filed under, each its own fresh id; the
   screen is left at once; the files go up newest lesson first and each
   lesson is written the moment its last file is up, in waves; nobody else
   can read a lesson of the batch until the last call marks it done. */
export async function importNow() {
  const j = importJob.get(); if (!j || !j.rows) return { error: "Nothing to import" };
  const lessons = j.rows.filter((r) => r.ticked).map((r) => {
    const day = DAYS[IDX.get(r.iso)];
    return { iso: r.iso, forId: r.forId, kind: r.kind === "practice" ? "practice" : "private", focus: r.focus, note: r.note || "", at: lessonAt(day), add: !!r.add, lessonId: r.existingId || null,
      files: r.files.filter((f) => f.ticked).map((f) => ({ name: f.name, kind: f.kind, ext: f.ext, mime: f.mime, at: f.at, size: f.size, uuid: uuid(), hash: day.msgs[f.mi].file.hash || null })) };
  });
  if (!lessons.length) return { error: "Nothing to import" };
  const batches = {};
  for (const pid of [...new Set(lessons.map((l) => l.forId))]) {
    const id = uuid();
    const r = await api().importBegin(id, pid, j.sport);
    if (r && r.error) {
      for (const b of Object.values(batches)) await api().undoImport(b, null).catch(() => null);
      importJob.patch({ run: { status: "error", error: r.error.message || "Couldn't import" } }); return { error: r.error.message };
    }
    batches[pid] = id;
  }
  lessons.forEach((l) => l.files.forEach((f) => { f.path = `import/${batches[l.forId]}/${f.uuid}.${f.ext}`; }));
  RUN = { batches, lessons, doneBatches: {}, flight: 0, alive: 0, waveTimer: null, waveSince: 0, stopped: false, added: 0, filesAdded: 0, toast: null };
  importJob.patch({ phase: "uploading", view: "start", resume: null });
  publish(); save(true);
  wake(true);
  pumpUploads();
  return { batches };
}
/* the banner's and the screen's figures */
function publish(extra = {}) {
  const R = RUN; if (!R) return;
  const live = R.lessons.filter((l) => !l.dropped);
  const files = live.flatMap((l) => l.files.filter((f) => !f.out && !f.dup));
  const failed = files.filter((f) => f.failed);
  importJob.patch((x) => ({ run: { ...(x.run || {}), status: x.run && x.run.status === "error" ? "error" : "uploading", ...extra,
    lessons: live.length, lessonsDone: live.filter((l) => l.committed).length, files: files.length, filesDone: files.filter((f) => f.up).length,
    failed: failed.map((f) => ({ key: f.path, name: f.name, error: f.failed })), batches: R.batches } }));
}
const newestFirst = (a, b) => (a.iso < b.iso ? 1 : -1);
function nextFile() {
  for (const l of [...RUN.lessons].sort(newestFirst)) {
    if (l.committed || l.dropped) continue;
    const f = l.files.find((x) => !x.up && !x.out && !x.dup && !x.failed && !x.busy);
    if (f) return { l, f };
  }
  return null;
}
function pumpUploads() {
  const R = RUN; if (!R || R.stopped || R.paused) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { publish({ offline: true }); return; }
  for (;;) {
    /* three at a time, never past 64 MB alive, and a file over 21 MB alone */
    if (R.flight >= IN_FLIGHT || R.alone) break;
    const n = nextFile(); if (!n) break;
    const size = n.f.size || 0;
    if (R.flight > 0 && (size > ALONE || R.alive + size > ALIVE)) break;
    if (size > ALONE) R.alone = true;
    uploadOne(n.l, n.f);
    if (R.alone) break;
  }
  checkWhole();
}
async function uploadOne(l, f) {
  const R = RUN; f.busy = true; R.flight += 1; R.alive += f.size || 0;
  try {
    const entry = SRC ? SRC.files.get(f.name) : null;
    if (!entry) { pauseForRead(); return; }
    let blob;
    try { blob = await entry.read(f.mime); } catch (e) { pauseForRead(); return; }
    if (!f.hash) f.hash = await sha256Hex(blob);
    /* one file twice on one day, or already on the lesson it joins: once */
    if (l.files.some((x) => x !== f && x.hash === f.hash && (x.up || x.busy) && !x.dup)) { f.dup = true; return; }
    const ex = l.add ? EXIST.get(`${l.forId}|${l.iso}`) : null;
    if (ex && ex.hashes && ex.hashes.has(f.hash)) { f.dup = true; return; }
    for (let attempt = 1; ; attempt++) {
      if (R.stopped) return;
      const r = await api().importUpload(f.path, blob, f.mime);
      if (r && !r.error && !r.exists) { f.up = true; f.failed = null; break; }
      if (r && r.exists) {
        /* already there: the same size is this file (an answer lost on the way back); anything else is not */
        const list = await api().importList(R.batches[l.forId], `${f.uuid}.${f.ext}`).catch(() => null);
        const hit = list && list.data ? list.data.find((x) => x.name === `${f.uuid}.${f.ext}`) : null;
        if (hit && Number(hit.size) === Number(blob.size)) { f.up = true; f.failed = null; break; }
        f.failed = "A different file is there"; break;
      }
      if (r && r.network && typeof navigator !== "undefined" && navigator.onLine === false) { f.failed = r.error; f.waitOnline = true; break; }
      if (attempt >= TRIES) { f.failed = (r && r.error) || "The upload failed."; break; }
      await sleep(600 * attempt);
    }
  } finally {
    f.busy = false; R.flight -= 1; R.alive -= f.size || 0; if ((f.size || 0) > ALONE) R.alone = false;
    publish(); save();
    if (!R.stopped && !R.paused) pumpUploads();
  }
}
/* a zip that will not give up an entry: the job waits for the file to be chosen again, never a Retry that cannot work */
function pauseForRead() {
  if (!RUN) {
    /* before Import nothing is begun: the chat is let go and Start says why */
    const j = importJob.get(); abandonNow();
    importJob.set({ owner: j ? j.owner : C().meId, phase: "done", view: "start", error: READ_ERROR });
    return;
  }
  if (RUN) { RUN.paused = true; RUN.stopped = true; }
  if (SORT) SORT.stopped = true;
  try { if (SRC) SRC.close(); } catch (e) { /* fine */ }
  SRC = null;
  save(true); wake(false);
  const j = importJob.get();
  const lessons = RUN ? RUN.lessons : [];
  importJob.set({ ...(j || {}), phase: "paused", view: "start", error: null,
    resume: { forId: j && j.forId, lessons: lessons.length, lessonsIn: lessons.filter((x) => x.committed).length,
              files: lessons.reduce((n, x) => n + x.files.filter((f) => !f.out && !f.dup).length, 0), filesUp: lessons.reduce((n, x) => n + x.files.filter((f) => f.up).length, 0) },
    run: { ...((j && j.run) || {}), status: "paused" } });
}
/* a lesson is whole when every ticked file is up (or left out); whole lessons go in waves */
function checkWhole() {
  const R = RUN; if (!R || R.stopped) return;
  const whole = R.lessons.filter((l) => !l.committed && !l.dropped && !l.inWave && l.files.every((f) => f.up || f.out || f.dup));
  /* eight whole, or twenty seconds, or nothing more on its way to keep them company */
  const more = R.flight > 0 || !!nextFile();
  if (whole.length >= WAVE_WHOLE || (whole.length && !more)) return flushWave();
  if (whole.length && !R.waveTimer) R.waveTimer = setTimeout(() => { R.waveTimer = null; flushWave(); }, WAVE_MS);
  if (!whole.length && !R.flight && !nextFile() && !R.lessons.some((l) => l.inWave)) {
    /* nothing left to write: done, unless a file is waiting on a Retry */
    if (R.lessons.every((l) => l.committed || l.dropped)) finishRun();
  }
}
async function flushWave() {
  const R = RUN; if (!R || R.stopped || R.flushing) return;
  if (R.waveTimer) { clearTimeout(R.waveTimer); R.waveTimer = null; }
  R.flushing = true;
  try {
    for (;;) {
      const whole = R.lessons.filter((l) => !l.committed && !l.dropped && l.files.every((f) => f.up || f.out || f.dup)).sort(newestFirst);
      if (!whole.length) break;
      /* one batch at a time, cut at 50 lessons and 600 files */
      const pid = whole[0].forId; const wave = []; let nf = 0;
      for (const l of whole.filter((x) => x.forId === pid)) {
        const fs = l.files.filter((f) => f.up && !f.dup);
        if (wave.length >= WAVE_LESSONS || nf + fs.length > WAVE_FILES) break;
        wave.push(l); nf += fs.length;
      }
      wave.forEach((l) => { l.inWave = true; });
      const payload = wave.map((l) => ({ day: l.iso, kind: l.kind, focus: l.focus, note: l.note, at: l.at, add: l.add,
        files: l.files.filter((f) => f.up && !f.dup).map((f) => ({ path: f.path, kind: f.kind, at: f.at, hash: f.hash })) }));
      const r = await api().importLessons(R.batches[pid], payload, false);
      wave.forEach((l) => { l.inWave = false; });
      if (r && r.error) {
        const msg = r.error.message || "Couldn't import";
        if (/was removed|with another coach now/i.test(msg)) { await stopForGood(msg); return; }
        publish({ status: "error", error: msg }); return;
      }
      const out = (r && r.data && r.data.lessons) || [];
      for (const l of wave) {
        const o = out.find((x) => x.day === l.iso) || {};
        l.committed = true; l.lessonId = o.id || l.lessonId;
        if (o.state === "added") R.added += 1;
        R.filesAdded += o.files || 0;
      }
      publish({ status: "uploading", error: null }); save();
    }
  } finally { R.flushing = false; }
  checkWhole();
}
async function finishRun() {
  const R = RUN; if (!R || R.finishing || R.stopped) return;
  R.finishing = true;
  for (const [pid, id] of Object.entries(R.batches)) {
    if (R.doneBatches[pid]) continue;
    const r = await api().importLessons(id, [], true);
    if (r && r.error) { R.finishing = false; publish({ status: "error", error: r.error.message || "Couldn't import" }); return; }
    R.doneBatches[pid] = true;
  }
  wake(false);
  const who = [...new Set(R.lessons.map((l) => l.forId))].map(nameOf).filter(Boolean).join(", ");
  const sub = R.added > 0 ? `${plural(R.added, "lesson", "lessons")}${who ? ` · ${who}` : ""}` : R.filesAdded > 0 ? `${plural(R.filesAdded, "file", "files")} imported` : who;
  if (C().done) C().done("Imported", sub);
  await forget();
  RUN = null;
  importJob.set((j) => ({ owner: j ? j.owner : C().meId, phase: "done", view: "start" }));
}
/* the database said the import cannot go on: it stops, the manifest goes, the sweep removes what was uploaded */
async function stopForGood(msg) {
  if (RUN) RUN.stopped = true; wake(false);
  await forget(); RUN = null;
  importJob.set((j) => ({ owner: j ? j.owner : C().meId, phase: "done", view: "start", error: msg }));
  if (C().say) C().say(msg);
}
/* the banner's Retry, and Leave out */
export function retryFailed() {
  const R = RUN; if (!R) return;
  R.lessons.forEach((l) => l.files.forEach((f) => { if (f.failed) { f.failed = null; f.waitOnline = false; } }));
  publish({ status: "uploading", error: null }); pumpUploads();
  if (!R.flight) checkWhole();
}
export function leaveOutFailed() {
  const R = RUN; if (!R) return;
  R.lessons.forEach((l) => l.files.forEach((f) => { if (f.failed) { f.failed = null; f.out = true; } }));
  publish(); save(); checkWhole();
}
export async function retryWave() { publish({ status: "uploading", error: null }); await flushWave(); }
/* back to the front, or the network back: a file that failed for want of it goes again */
export function wakeUp() {
  const R = RUN; if (!R || R.stopped) return;
  R.lessons.forEach((l) => l.files.forEach((f) => { if (f.failed && f.waitOnline) { f.failed = null; f.waitOnline = false; } }));
  publish({ offline: false }); pumpUploads(); wake(true);
}
let LOCK = null;
async function wake(on) {
  try {
    if (!on) { if (LOCK) { await LOCK.release(); LOCK = null; } return; }
    if (LOCK || typeof navigator === "undefined" || !navigator.wakeLock || document.visibilityState !== "visible") return;
    LOCK = await navigator.wakeLock.request("screen");
    LOCK.addEventListener && LOCK.addEventListener("release", () => { LOCK = null; });
  } catch (e) { LOCK = null; }
}

/* ---------------------------------------------------------------- resume */
async function resumeWith(prior) {
  const c = C();
  let m = null; try { m = await getImport(mkey(prior.owner, prior.chatHash)); } catch (e) { m = null; }
  if (!m || !m.run) return refuse(READ_ERROR);
  PARTV = m.verdicts || {}; EDITS = m.edits || {};
  DAYS = buildDays(PARSED, { order: m.order, roles: m.roles }); IDX = new Map(DAYS.map((d, i) => [d.iso, i]));
  /* every resume asks import_begin again: it refreshes the batch's touch */
  for (const [pid, id] of Object.entries(m.run.batches)) {
    const r = await api().importBegin(id, pid, m.sport);
    if (r && r.error) { await forget(); importJob.set({ owner: c.meId, phase: "done", view: "start", error: r.error.message }); return null; }
    if (r && r.data && r.data.status && r.data.status !== "adding") { await forget(); importJob.set({ owner: c.meId, phase: "done", view: "start" }); return null; }
  }
  const lessons = (m.run.lessons || []).map((l) => ({ ...l, files: l.files.map((f) => ({ ...f })) }));
  /* the files already up, by the folder's own list, are never uploaded twice */
  for (const [pid, id] of Object.entries(m.run.batches)) {
    const r = await api().importList(id).catch(() => null);
    const there = new Map(((r && r.data) || []).map((x) => [x.name, Number(x.size)]));
    lessons.filter((l) => l.forId === pid).forEach((l) => l.files.forEach((f) => { if (there.has(`${f.uuid}.${f.ext}`)) f.up = true; }));
  }
  RUN = { batches: m.run.batches, lessons, doneBatches: m.run.done || {}, flight: 0, alive: 0, waveTimer: null, stopped: false, added: 0, filesAdded: 0 };
  importJob.set({ owner: c.meId, phase: "uploading", view: "start", chatHash: m.chatHash, fileName: m.fileName, roles: m.roles, order: m.order, forId: m.forId, sport: m.sport, mode: m.mode, resume: null, reading: false, error: null });
  publish(); save(true); wake(true);
  if (c.land) c.land(m.forId);
  pumpUploads();
  return importJob.get();
}
/* Finish with 38 (the resume box), Keep 38 lessons (Stop): what is in is the import, with its one notice */
export async function finishInterrupted(toast = true) {
  const j = importJob.get(); if (!j) return;
  if (RUN) { RUN.stopped = true; if (RUN.waveTimer) clearTimeout(RUN.waveTimer); }
  let m = null; try { m = await getImport(mkey(j.owner, j.chatHash)); } catch (e) { m = null; }
  const batches = (RUN && RUN.batches) || (m && m.run && m.run.batches) || {};
  const lessons = (RUN && RUN.lessons) || (m && m.run && m.run.lessons) || [];
  const inCount = lessons.filter((l) => l.committed).length;
  for (const id of Object.values(batches)) { const r = await api().importLessons(id, [], true); if (r && r.error && C().say) C().say(r.error.message); }
  wake(false); await forget(); RUN = null;
  const who = [...new Set(lessons.map((l) => l.forId))].map(nameOf).filter(Boolean).join(", ");
  if (toast && C().done) C().done("Stopped", inCount ? `${plural(inCount, "lesson", "lessons")}${who ? ` · ${who}` : ""}` : undefined);
  importJob.set({ owner: j.owner, phase: "done", view: "start" });
}
/* Discard, Stop with nothing in, Remove all: the batches go, and nobody is told — nobody could read them yet */
export async function discardInterrupted(toast = "Stopped") {
  const j = importJob.get(); if (!j) return;
  if (RUN) { RUN.stopped = true; if (RUN.waveTimer) clearTimeout(RUN.waveTimer); }
  if (SORT) SORT.stopped = true;
  let m = null; try { m = await getImport(mkey(j.owner, j.chatHash)); } catch (e) { m = null; }
  const batches = (RUN && RUN.batches) || (m && m.run && m.run.batches) || {};
  for (const id of Object.values(batches)) await api().undoImport(id, null).catch(() => null);
  wake(false); await forget(); RUN = null;
  if (toast && C().done) C().done(toast);
  importJob.set({ owner: j.owner, phase: "done", view: "start" });
}
/* leave Found or Review without importing: the chat is let go */
function abandonNow() {
  if (SORT) SORT.stopped = true;
  try { if (SRC) SRC.close(); } catch (e) { /* fine */ }
  SRC = null; PARSED = null; DAYS = null; DAYV.clear(); EDITS = {}; PARTV = {};
  POSTERS.clear(); ASKED.clear(); releasePreviews();
}
export async function abandon() {
  abandonNow();
  const j = importJob.get(); importJob.set(j ? { owner: j.owner, phase: "done", view: "start" } : null);
}

/* ---------------------------------------------------------------- the show: posters and the preview, from the zip */
/* A row's poster is its first picture, drawn to a 168px JPEG the first time
   the row is on screen — a photo from its blob, a clip's first frame through
   a hidden <video> — kept in memory only, never in the manifest. The Feed
   plays the drafts' files straight from the zip, three object URLs alive at
   most (the card and its neighbours), let go off screen. Nothing is sent. */
const POSTERS = new Map(), ASKED = new Map();
const SIDE = 168;
const draw = (src, w, h) => {
  const c = document.createElement("canvas"); c.width = SIDE; c.height = SIDE;
  const k = Math.max(SIDE / (w || SIDE), SIDE / (h || SIDE));
  c.getContext("2d").drawImage(src, (SIDE - w * k) / 2, (SIDE - h * k) / 2, w * k, h * k);
  return c.toDataURL("image/jpeg", 0.8);
};
async function photoPoster(blob) {
  if (typeof createImageBitmap === "function") { const b = await createImageBitmap(blob); try { return draw(b, b.width, b.height); } finally { if (b.close) b.close(); } }
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.src = url; await img.decode(); return draw(img, img.naturalWidth, img.naturalHeight); } finally { URL.revokeObjectURL(url); }
}
async function clipPoster(blob) {
  const url = URL.createObjectURL(blob); const v = document.createElement("video");
  try {
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("no frame")); setTimeout(() => rej(new Error("slow")), 6000); });
    return draw(v, v.videoWidth, v.videoHeight);
  } finally { v.removeAttribute("src"); try { v.load(); } catch (e) { /* let go */ } URL.revokeObjectURL(url); }
}
/* the file a row shows: its first ticked picture, else its first picture */
export const posterFile = (r) => (r && r.files ? r.files.find((x) => x.ticked && x.kind !== "audio") || r.files.find((x) => x.kind !== "audio") || null : null);
export const posterUrl = (name) => POSTERS.get(name) || null;
export function makePoster(f) {
  if (!f) return Promise.resolve(null);
  if (POSTERS.has(f.name)) return Promise.resolve(POSTERS.get(f.name));
  if (ASKED.has(f.name)) return ASKED.get(f.name);
  const p = (async () => {
    const entry = SRC && SRC.files.get(f.name); if (!entry) return null;
    let blob; try { blob = await entry.read(f.mime); } catch (e) { pauseForRead(); return null; }
    let url = null; try { url = f.kind === "photo" ? await photoPoster(blob) : await clipPoster(blob); } catch (e) { url = null; }
    if (url) { POSTERS.set(f.name, url); importJob.patch((x) => ({ posters: (x.posters || 0) + 1 })); }
    return url;
  })();
  ASKED.set(f.name, p);
  return p;
}
const LIVE = new Map();   // iso → { items, urls }
const trimLive = () => {
  let n = 0; for (const v of LIVE.values()) n += v.urls.length;
  while (n > 3 && LIVE.size > 1) { const [k, v] = LIVE.entries().next().value; v.urls.forEach((u) => URL.revokeObjectURL(u)); LIVE.delete(k); n -= v.urls.length; }
};
/* a draft's files for the Feed: undefined until asked, then what the zip gave */
export const previewCached = (iso) => (LIVE.has(iso) ? LIVE.get(iso).items : undefined);
export async function previewFor(iso) {
  if (LIVE.has(iso)) return LIVE.get(iso).items;
  const j = importJob.get(); const r = j && j.rowsByIso && j.rowsByIso[iso];
  const f = r ? (r.files.find((x) => x.ticked && x.kind !== "audio") || r.files.find((x) => x.ticked)) : null;
  let items = [], urls = [];
  if (f) {
    const entry = SRC && SRC.files.get(f.name);
    if (entry) {
      let blob; try { blob = await entry.read(f.mime); } catch (e) { pauseForRead(); return []; }
      const url = URL.createObjectURL(blob); urls = [url];
      items = [{ id: `draft:${f.name}`, type: f.kind === "audio" ? "audio" : f.kind, url }];
    }
  }
  if (LIVE.has(iso)) { urls.forEach((u) => URL.revokeObjectURL(u)); return LIVE.get(iso).items; }
  LIVE.set(iso, { items, urls }); trimLive();
  importJob.patch((x) => ({ previews: (x.previews || 0) + 1 }));
  return items;
}
export function releasePreviews() { for (const v of LIVE.values()) v.urls.forEach((u) => URL.revokeObjectURL(u)); LIVE.clear(); }
export const committedCount = () => (RUN ? RUN.lessons.filter((l) => l.committed).length : (importJob.get() && importJob.get().resume ? importJob.get().resume.lessonsIn : 0));
export const running = () => !!(RUN && !RUN.stopped);
