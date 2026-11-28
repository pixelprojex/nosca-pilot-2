/* DAYS, SEGMENTS AND THE BLOCK (docs/import/SPEC.md, "Grouping").
 *
 * One calendar day of messages is one proposed lesson. Each of the
 * coach's text messages is cut into segments — at a newline, and after
 * . ! ? where whitespace and a capital (or the line's end) follow; never
 * between digits ("HI 18.4", "9.30"), never after Dr, Mr, Mrs, Ms, St,
 * vs, e.g., i.e. or approx — each { start, end } into the message's own
 * words, so a note is always built from the coach's exact text.
 *
 * What a day sends to be sorted is the block: [before] the last six coach
 * segments of the day before (when it is the calendar day before), [day]
 * every line of the day, [after] the first six of the next. Only the
 * coach's words are sent, scrubbed; every player-side line is [message];
 * a file is a marker on the line of whoever sent it; a held-back line is
 * [omitted] with no number. Only coach text under [day] carries a number.
 */
import { dateOf } from "./whatsapp.js";
import { BUDGET, PROMPT_V, scrub, heldBack, measure } from "../../../netlify/functions/lib/import-shared.mjs";

/* kind and MIME from the extension only — never File.type, never a name's other words */
export const FILE_TYPES = {
  mp4: ["video", "video/mp4"], m4v: ["video", "video/mp4"], mov: ["video", "video/quicktime"], "3gp": ["video", "video/3gpp"],
  jpg: ["photo", "image/jpeg"], jpeg: ["photo", "image/jpeg"], png: ["photo", "image/png"], webp: ["photo", "image/webp"],
  opus: ["audio", "audio/ogg"], ogg: ["audio", "audio/ogg"], m4a: ["audio", "audio/mp4"], mp3: ["audio", "audio/mpeg"], aac: ["audio", "audio/aac"],
};
export const extOf = (name) => { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };
/* a file's place: a clip, a photo or a voice note, or stickers and GIFs, or a document — the last two never uploaded */
export function fileKind(name) {
  const n = String(name || "");
  if (/^STK-|-STICKER-|^GIF-|-GIF-/i.test(n)) return { kind: "sticker" };
  const t = FILE_TYPES[extOf(n)];
  return t ? { kind: t[0], mime: t[1], ext: extOf(n) } : { kind: "document" };
}
export const MARKER_OF = { video: "[video]", photo: "[photo]", audio: "[voice note]" };

/* ---------------------------------------------------------------- segments */
const ABBR_END = /(?:^|[\s(])(?:dr|mr|mrs|ms|st|vs|e\.g|i\.e|approx)\.$/i;
export function segmentsOf(body) {
  const out = []; const s = String(body || ""); let from = 0;
  const push = (a, b) => { while (a < b && /\s/.test(s[a])) a++; while (b > a && /\s/.test(s[b - 1])) b--; if (b > a) out.push({ start: a, end: b }); };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n") { push(from, i); from = i + 1; continue; }
    if (ch === "." || ch === "!" || ch === "?") {
      /* never between digits */
      if (ch === "." && /\d/.test(s[i - 1] || "") && /\d/.test(s[i + 1] || "")) continue;
      /* whitespace, then a capital or the line's end */
      let j = i + 1; while (j < s.length && (s[j] === "." || s[j] === "!" || s[j] === "?")) j++;
      if (j < s.length && s[j] !== " " && s[j] !== "\t" && s[j] !== "\n") continue;
      let k = j; while (k < s.length && (s[k] === " " || s[k] === "\t")) k++;
      if (k < s.length && s[k] !== "\n" && !/\p{Lu}/u.test(s[k])) continue;
      if (ABBR_END.test(s.slice(Math.max(0, i - 8), i + 1))) continue;
      push(from, j); from = j; i = j - 1;
    }
  }
  push(from, s.length);
  return out;
}

/* ---------------------------------------------------------------- days */
/* roles: label → "coach" | "player" | "same:<label>". Every message is the
   coach's side (C) or the player's side (P); a merged label is the label it
   is the same person as. */
export function canonical(label, roles) {
  let l = label, n = 0;
  while (roles && roles[l] && String(roles[l]).startsWith("same:") && n++ < 8) l = String(roles[l]).slice(5);
  return l;
}
export function sideOf(label, roles) {
  const r = roles ? roles[canonical(label, roles)] : null;
  return r === "coach" ? "C" : "P";
}

/* the chat's days, oldest first, each { iso, msgs } — a message keeps its own date even where its time runs backwards */
export function buildDays(parsed, { order, roles }) {
  const by = new Map();
  for (const m of parsed.messages) {
    const iso = dateOf(m, order); if (!iso) continue;
    const side = sideOf(m.author, roles), who = canonical(m.author, roles);
    const file = m.attachment ? { name: m.attachment.name, ...fileKind(m.attachment.name) } : null;
    const segs = side === "C" && m.body ? segmentsOf(m.body).map((sg) => ({ ...sg, held: heldBack(m.body.slice(sg.start, sg.end)) })) : [];
    const msg = { m, iso, side, who, file, segs, body: m.body, omitted: !!m.omitted, h: m.h, min: m.min, sec: m.sec };
    if (!by.has(iso)) by.set(iso, []);
    by.get(iso).push(msg);
  }
  return [...by.keys()].sort().map((iso) => ({ iso, msgs: by.get(iso) }));
}
const prevIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(y, m - 1, d - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

/* the day's lines as they are sent, in order; text is scrubbed, ids are
   not yet given. Each C text segment remembers where it came from. */
export function dayLines(day, scrubOpts) {
  const lines = [];
  day.msgs.forEach((x, mi) => {
    if (x.side === "P") {
      if (x.body && x.body.trim()) lines.push({ a: "P", text: "[message]", mi });
      if (x.file) lines.push({ a: "P", text: MARKER_OF[x.file.kind] || "[file]", mi });
      else if (x.omitted) lines.push({ a: "P", text: "[file]", mi });
      return;
    }
    x.segs.forEach((sg, si) => lines.push(sg.held ? { a: "C", text: "[omitted]", mi, si, held: true }
      : { a: "C", text: scrub(x.body.slice(sg.start, sg.end), scrubOpts), mi, si, start: sg.start, end: sg.end }));
    if (x.file) lines.push({ a: "C", text: MARKER_OF[x.file.kind] || "[file]", mi });
    else if (x.omitted) lines.push({ a: "C", text: "[file]", mi });
  });
  return lines;
}
const coachText = (lines) => lines.filter((l) => l.a === "C" && l.si != null);

/* THE PARTS OF A DAY, each one request: within BUDGET counted over
   everything sent, split at message boundaries with 10% headroom when the
   whole day will not go in one. Each part: { lines, before, after }. */
export function dayParts(days, idx, scrubOpts, budgetScale = 1) {
  const day = days[idx];
  const lines = dayLines(day, scrubOpts);
  const prev = idx > 0 && days[idx - 1].iso === prevIso(day.iso) ? coachText(dayLines(days[idx - 1], scrubOpts)).slice(-BUDGET.context) : [];
  const next = idx + 1 < days.length ? coachText(dayLines(days[idx + 1], scrubOpts)).slice(0, BUDGET.context) : [];
  const fits = (part, k) => {
    const b = bodyFor(part, { sport: scrubOpts.sport, player: scrubOpts.player || "00000000-0000-4000-8000-000000000000" });
    const m = measure(b.body);
    return m.segments <= BUDGET.segments * k && m.textBytes <= BUDGET.textBytes * k && m.bodyBytes <= BUDGET.bodyBytes * k;
  };
  const whole = { lines, before: prev, after: next };
  if (fits(whole, budgetScale)) return [whole];
  /* split at message boundaries, 10% under the budget */
  const k = budgetScale * (1 - BUDGET.headroom);
  const groups = []; let curMi = null, cur = [];
  for (const l of lines) { if (l.mi !== curMi && cur.length) { groups.push(cur); cur = []; } curMi = l.mi; cur.push(l); }
  if (cur.length) groups.push(cur);
  const parts = []; let acc = [];
  const ctxBefore = () => (parts.length ? coachText(parts[parts.length - 1].lines).slice(-BUDGET.context) : prev);
  for (const g of groups) {
    const trial = { lines: [...acc, ...g], before: ctxBefore(), after: next };
    if (acc.length && !fits(trial, k)) { parts.push({ lines: acc, before: ctxBefore(), after: [] }); acc = [...g]; }
    else acc = trial.lines;
    /* one message alone over the budget: its own lines, a few at a time — nothing is truncated */
    while (!fits({ lines: acc, before: ctxBefore(), after: next }, k) && acc.length > 1) {
      let n = acc.length; while (n > 1 && !fits({ lines: acc.slice(0, n), before: ctxBefore(), after: [] }, k)) n--;
      parts.push({ lines: acc.slice(0, n), before: ctxBefore(), after: [] }); acc = acc.slice(n);
    }
  }
  if (acc.length) parts.push({ lines: acc, before: ctxBefore(), after: next });
  /* each part's [after] is the first lines of the part after it */
  for (let i = 0; i < parts.length - 1; i++) parts[i].after = coachText(parts[i + 1].lines).slice(0, BUDGET.context);
  return parts;
}
/* a part split into its two halves, at a message boundary, for the third and fourth calls */
export function halves(part) {
  const mis = [...new Set(part.lines.map((l) => l.mi))];
  if (mis.length < 2) { const n = Math.ceil(part.lines.length / 2); return [{ lines: part.lines.slice(0, n), before: part.before, after: coachText(part.lines.slice(n)).slice(0, BUDGET.context) }, { lines: part.lines.slice(n), before: coachText(part.lines.slice(0, n)).slice(-BUDGET.context), after: part.after }]; }
  const cut = mis[Math.ceil(mis.length / 2)];
  const a = part.lines.filter((l) => l.mi < cut), b = part.lines.filter((l) => l.mi >= cut);
  return [{ lines: a, before: part.before, after: coachText(b).slice(0, BUDGET.context) }, { lines: b, before: coachText(a).slice(-BUDGET.context), after: part.after }];
}

/* THE REQUEST BODY for a part: { v, sport, player, segs } and the map
   from each number given back to the coach's exact words */
export function bodyFor(part, { sport, player }) {
  const segs = []; const ids = new Map(); let n = 0;
  for (const l of part.before) segs.push({ part: "before", a: "C", text: l.text });
  for (const l of part.lines) {
    if (l.a === "C" && l.si != null && !l.held) { n += 1; segs.push({ part: "day", a: "C", id: n, text: l.text }); ids.set(n, { mi: l.mi, si: l.si, start: l.start, end: l.end }); }
    else segs.push({ part: "day", a: l.a, text: l.text });
  }
  for (const l of part.after) segs.push({ part: "after", a: "C", text: l.text });
  return { body: { v: PROMPT_V, sport, player, segs }, ids };
}

/* the first words of a day, for the Left out list: the coach's, else anyone's */
export function firstWords(day) {
  const x = day.msgs.find((m) => m.side === "C" && m.body && m.body.trim()) || day.msgs.find((m) => m.body && m.body.trim());
  const w = x ? x.body.replace(/\s+/g, " ").trim() : "";
  return w.length > 60 ? `${w.slice(0, 57).replace(/\s+\S*$/, "")}…` : w;
}
