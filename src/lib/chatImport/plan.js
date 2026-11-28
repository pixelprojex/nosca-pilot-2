/* THE PLAN (docs/import/SPEC.md, "The decision table", "Note", "File defaults").
 *
 * What a sorted day becomes — a lesson ticked or not, and why not, in the
 * caution words the Review screen shows — decided by code from the
 * verdict and what is already there. The model only labelled the day and
 * pointed at numbered coach lines and the sport's area ids; the note is
 * built here from the ORIGINAL, unscrubbed words those numbers point at.
 */
import { FOCUS } from "../taxonomy.js";
import { localIso } from "./whatsapp.js";
import { fold } from "../../../netlify/functions/lib/import-shared.mjs";

export const NOTE_MAX = 4000;
export const REASONS = {
  unsure: "Not sure", chat: "Looks like chat", review: "Check this day", failed: "Not sorted",
  other: "Already a lesson that day", already: "Imported already",
};

/* MERGING A SPLIT DAY: the first in lesson > practice > recap > unsure > chat wins; areas unioned; ids concatenated */
const RANK = ["lesson", "practice", "recap", "unsure", "chat"];
export function mergeVerdicts(list) {
  const ok = list.filter((v) => v && v.day);
  if (!ok.length) return null;
  const day = RANK.find((k) => ok.some((v) => v.day === k));
  const uniq = (xs) => [...new Set(xs)];
  return { day, focus: uniq(ok.flatMap((v) => v.focus || [])), note: ok.flatMap((v) => v.note || []), tip: ok.flatMap((v) => v.tip || []).slice(0, 1), drills: ok.flatMap((v) => v.drills || []) };
}

/* THE NOTE: each run of contiguous chosen segments of one message is the
   original text from the first's start to the last's end; runs joined by
   newlines; then "Tip · <line>" (lifted out of the note) and "Drills ·
   <lines>". Cut at a message boundary at 4,000. refs: [{ mi, si, start, end }]. */
export function buildNote(day, noteRefs, tipRefs = [], drillRefs = []) {
  const key = (r) => `${r.mi}|${r.si}`;
  const tipKeys = new Set(tipRefs.map(key));
  const runsOf = (refs) => {
    const sorted = refs.filter(Boolean).slice().sort((a, b) => a.mi - b.mi || a.si - b.si);
    const runs = []; let cur = null;
    for (const r of sorted) {
      if (cur && cur.mi === r.mi && r.si === cur.lastSi + 1) { cur.end = r.end; cur.lastSi = r.si; }
      else { cur = { mi: r.mi, start: r.start, end: r.end, lastSi: r.si }; runs.push(cur); }
    }
    return runs.map((x) => ({ mi: x.mi, text: day.msgs[x.mi].body.slice(x.start, x.end) }));
  };
  const seen = new Set();
  const dedupe = (refs) => refs.filter((r) => r && !seen.has(key(r)) && seen.add(key(r)));
  const noteRuns = runsOf(dedupe(noteRefs.filter((r) => r && !tipKeys.has(key(r)))));
  const tipRuns = runsOf(dedupe(tipRefs));
  const drillRuns = runsOf(dedupe(drillRefs));
  const pieces = [];
  noteRuns.forEach((r) => pieces.push({ mi: r.mi, text: r.text }));
  if (tipRuns.length) pieces.push({ mi: Infinity, text: `Tip · ${tipRuns.map((r) => r.text).join(" ")}` });
  if (drillRuns.length) pieces.push({ mi: Infinity, text: `Drills · ${drillRuns.map((r) => r.text).join(" · ")}` });
  /* cut at a message boundary: whole messages' runs while they fit */
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    const next = out ? `${out}\n${pieces[i].text}` : pieces[i].text;
    if (next.length > NOTE_MAX) {
      /* back off to the last whole message already in */
      const lastMi = pieces[i].mi;
      while (out && i > 0 && pieces[i - 1].mi === lastMi && lastMi !== Infinity) { out = out.slice(0, Math.max(0, out.lastIndexOf("\n"))); i -= 1; }
      break;
    }
    out = next;
  }
  return out.slice(0, NOTE_MAX);
}

/* the focus: the validated ids as the sport's labels, joined as the log joins them; "Lesson", or "Practice", when none */
export function focusFor(sport, ids, kind) {
  const labels = (ids || []).map((id) => ((FOCUS[sport] || []).find((a) => a.id === id) || {}).label).filter(Boolean);
  return labels.length ? labels.join(" · ") : kind === "practice" ? "Practice" : "Lesson";
}

/* a day whose coach lines name another child of the roster or the family, capitalised, as a whole word */
export function namesOther(day, otherFirstNames) {
  const words = new Set();
  day.msgs.filter((x) => x.side === "C" && x.body).forEach((x) => (x.body.match(/[\p{Lu}][\p{L}'’-]*/gu) || []).forEach((w) => words.add(fold(w))));
  return (otherFirstNames || []).find((n) => n && words.has(fold(n))) || null;
}

/* A FILE'S DEFAULT on a ticked day: the coach's ticked; the main player-side
   label's clips on a lesson or practice day, its photos on a lesson day, its
   voice notes never; a second player-side label's never ("From Pat"); a
   screenshot-shaped photo never ("Looks like a screenshot"). */
export function fileDefault(f, { kind, mainSide }) {
  if (f.screenshot) return { ticked: false, reason: "Looks like a screenshot" };
  if (f.side === "C") return { ticked: true, reason: null };
  if (f.who !== mainSide) return { ticked: false, reason: `From ${String(f.who || "").split(" ")[0]}` };
  if (f.kind === "video") return { ticked: kind === "lesson" || kind === "practice", reason: null };
  if (f.kind === "photo") return { ticked: kind === "lesson", reason: null };
  return { ticked: false, reason: null };
}

/* screenshot-shaped by name alone (a PNG; a JPEG called Screenshot); the pixel check comes once the file is read */
export const screenshotByName = (f) => f.ext === "png" || (/^jpe?g$/.test(f.ext || "") && /screenshot/i.test(f.name || ""));
/* a phone screen's shape: a JPEG with no camera make or model whose long side is 2.0 to 2.3 times its short */
export const screenshotByPixels = (w, h, hasCamera) => !hasCamera && w > 0 && h > 0 && Math.max(w, h) / Math.min(w, h) >= 2.0 && Math.max(w, h) / Math.min(w, h) <= 2.3;

/* THE DECISION TABLE, first match wins. `verdict` is the merged answer or
   { status: "review" | "failed" } or null (not sorted yet); `prior` the
   plan of the calendar day before, for a recap. */
export function decide({ day, verdict, existing, otherLesson, named, playerFiles, prior }) {
  if (existing) {
    const fresh = existing.newFiles || 0;
    if (!fresh) return { state: "already", ticked: false, locked: true, reason: REASONS.already };
    return { state: "append", ticked: !!existing.newAreCoachs, reason: `${REASONS.already} · ${fresh} new ${fresh === 1 ? "file" : "files"}`, add: true };
  }
  if (otherLesson) return { state: "check", ticked: false, reason: REASONS.other };
  if (named) return { state: "check", ticked: false, reason: `Names ${named}` };
  if (!verdict) return { state: "pending", ticked: false, reason: null };
  if (verdict.status === "review") return { state: "review", ticked: false, reason: REASONS.review, sleep: true };
  if (verdict.status === "failed") return { state: "failed", ticked: false, reason: REASONS.failed };
  const d = verdict.day;
  if (d === "lesson") return { state: "lesson", ticked: true, reason: null, kind: "private" };
  if (d === "practice" && playerFiles) return { state: "practice", ticked: true, reason: null, kind: "practice" };
  if (d === "recap" && prior && prior.isLesson) return { state: "recap", ticked: false, leftOut: true, recapInto: prior.iso, reason: null };
  if (d === "chat") return day.msgs.some((x) => x.file) ? { state: "chat", ticked: false, reason: REASONS.chat } : { state: "chat", ticked: false, leftOut: true, reason: null };
  return { state: "unsure", ticked: false, reason: REASONS.unsure };
}

/* the moments a lesson and its files are written with: the day's last message, and each file's own message plus its order in ms */
export function lessonAt(day) {
  const last = day.msgs[day.msgs.length - 1];
  return last ? localIso(day.iso, last.h, last.min, last.sec || 0) : null;
}
export const fileAt = (day, x, order) => localIso(day.iso, x.h, x.min, x.sec || 0, Math.min(999, order));

/* the client's hint of the server's key: hex SHA-256 of nosca-import|<coach>|<player>|<day> */
export async function lessonKey(coachId, playerId, iso) {
  const bytes = new TextEncoder().encode(`nosca-import|${coachId}|${playerId}|${iso}`);
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
