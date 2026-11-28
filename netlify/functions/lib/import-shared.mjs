/* THE IMPORT'S SHARED RULES (docs/import/SPEC.md).
 *
 * One file, read by the phone (src/lib/chatImport, lazy), by both Netlify
 * functions (lesson-import.mjs, import-sweep.mjs) and by the e2e mock, so
 * nothing can drift between what the phone sends, what the function
 * accepts and what the tests assert. Plain ESM with no Node API: it runs
 * in a browser too. It holds no secret and no prompt — the instructions
 * the model reads live in the function alone.
 *
 *   PROMPT_V     the version of the request's shape and the instructions;
 *                a verdict cached on the phone is keyed by it
 *   BUDGET       what one request may carry, counted over everything sent
 *   MARKERS      the only words a player-side line, a file or a held-back
 *                line is ever sent as
 *   HELD_BACK    health, family and money words: a coach's line carrying
 *                one is never sent and never in a note
 *   scrub*       numbers, emails, links, Eircodes, IBANs, places, names
 *   validate     the function's strict check of a request
 *   schemaFor    the answer's JSON schema, per sport
 */
import { FOCUS } from "../../../src/lib/taxonomy.js";

export const PROMPT_V = "1";
export const SPORTS = ["golf", "tennis", "rowing", "squash", "padel", "equestrian"];

/* 150 segments, 6,000 UTF-8 bytes of text, a 16,384-byte JSON body —
   counted over context, markers and ids alike. A day over it is split at
   message boundaries with 10% headroom. */
export const BUDGET = { segments: 150, textBytes: 6000, bodyBytes: 16384, headroom: 0.1, context: 6, perDayFiles: 200 };

export const MARKERS = ["[message]", "[video]", "[photo]", "[voice note]", "[file]", "[omitted]"];
export const PARTS = ["before", "day", "after"];
export const DAY_KINDS = ["lesson", "practice", "recap", "chat", "unsure"];

/* whether a sport's system prefix is long enough to cache (512 tokens):
   measured with count_tokens at switch-on (phase 7) — false until then, so
   no sport waits on a cache that cannot happen */
export const CACHEABLE = { golf: false, tennis: false, rowing: false, squash: false, padel: false, equestrian: false };

const enc = new TextEncoder();
export const bytesOf = (s) => enc.encode(String(s == null ? "" : s)).length;

/* without regard to case or fadas: "Siobhán" and "SIOBHAN" are one word */
export const fold = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------------------------------------------------------- held back */
/* Whole words or phrases, without regard to case or fadas. Reviewed with
   the DPIA reviewer before ship and frozen. A coach's line that carries one
   is sent as [omitted] with no number, so it can be in no note, and shows
   as "Held back" in the day's Messages. */
export const HELD_BACK = [
  // health and wellbeing
  "injury", "injured", "pain", "painful", "sore", "hurt", "physio", "doctor", "gp", "hospital", "a&e", "sick", "unwell", "ill",
  "surgery", "operation", "concussion", "fracture", "broke", "sprain", "strain", "asthma", "inhaler", "allergy", "allergic",
  "diabetes", "diabetic", "epilepsy", "seizure", "medication", "tablets", "period", "pregnant", "weight", "diet", "eating",
  "anxiety", "anxious", "panic", "depressed", "depression", "therapy", "counsellor", "counselling", "adhd", "autism", "autistic",
  "upset", "crying", "grief", "bereavement",
  // family and safeguarding
  "custody", "separated", "separation", "divorce", "tusla", "garda", "social worker",
  // money
  "€", "paid", "payment", "pay me", "pay you", "invoice", "revolut", "bank", "iban", "transfer", "owe", "owed", "fee", "fees",
];
/* kept, though they hold a word above */
export const HELD_BACK_EXCEPT = ["pay attention", "medicine ball", "bank shot"];
const HELD_RE = HELD_BACK.map((w) => (w === "€" ? /€/ : new RegExp(`(^|[^a-z0-9])${escRe(w)}($|[^a-z0-9])`)));
export function heldBack(text) {
  let t = fold(text);
  for (const ex of HELD_BACK_EXCEPT) t = t.split(ex).join(" ");
  return HELD_RE.some((re) => re.test(t));
}

/* ---------------------------------------------------------------- the scrub */
/* placeholders in angle quotes, so they can never be read as a [marker] */
export const PH = { name: "⟨name⟩", number: "⟨number⟩", email: "⟨email⟩", link: "⟨link⟩", place: "⟨place⟩" };

/* English words that are also names: kept when written in lower case ("read the green") */
export const COMMON = ["green", "long", "wood", "woods", "hill", "park", "rose", "grace", "will", "mark", "chip", "may", "june", "bill", "pat",
  "hunter", "fisher", "rich", "hope", "faith", "joy", "summer", "dawn", "drew", "chase", "grant", "lane", "ray", "rob", "sue", "art", "jack",
  "frank", "ward", "may", "page", "bell", "brown", "black", "white", "gray", "grey", "king", "young", "short", "price", "ball", "rowe", "hart",
  "stone", "field", "ford", "moss", "reed", "lake", "bush", "cliff", "dale", "glen", "heath", "holly", "ivy", "iris", "olive", "ruby", "pearl",
  "penny", "sandy", "storm", "sky", "winter", "autumn", "april", "august", "angel", "carol", "eve", "hazel", "jade", "rowan", "sage", "willow"];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"];
const BALLS = ["red", "orange", "green", "yellow", "blue", "white", "black", "purple", "double", "single", "dot"];
const SMALL = ["i", "ok", "okay", "im", "ive", "id", "ill", "hi", "wtn", "lta", "pga", "the", "a", "an", "and", "but", "so", "or", "if", "then",
  "great", "good", "well", "nice", "thanks", "thank", "yes", "no", "lol", "please", "sorry", "see", "next", "last", "this", "that", "today",
  "tomorrow", "tonight", "morning", "afternoon", "evening", "christmas", "easter", "irish", "ireland", "dublin"];
/* the sport's own words: its areas, sub-areas and stage names */
export function sportWords(sport) {
  const out = new Set();
  for (const a of FOCUS[sport] || []) [a.label, ...(a.subs || [])].forEach((s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => out.add(w)));
  return out;
}
/* a full stop after these ends no sentence (the segments are not split there either) */
export const ABBR = new Set(["dr", "mr", "mrs", "ms", "st", "vs", "eg", "e", "g", "ie", "i", "approx"]);
const allowFor = (sport) => new Set([...WEEKDAYS, ...MONTHS, ...BALLS, ...SMALL, ...ABBR, ...sportWords(sport)]);

/* numbers, emails, links, Eircodes, IBANs and "Location:" lines — the
   patterns, which the server runs again as a backstop */
const RE_EMAIL = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[A-Za-z]{2,}/g;
const RE_LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ie|net|org|co\.uk|io|app|eu|info)(?:\/\S*)?\b/gi;
const RE_IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
const RE_EIRCODE = /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/gi;
const RE_PHONE = /(?:\+|00)?\d(?:[\d\s().-]{5,}\d)/g;
export function scrubPatterns(text) {
  let t = String(text == null ? "" : text);
  if (/^\s*location\s*:/i.test(t)) return PH.place;
  t = t.replace(/\[/g, "(").replace(/\]/g, ")");
  t = t.replace(RE_EMAIL, PH.email);
  t = t.replace(RE_LINK, PH.link);
  t = t.replace(RE_IBAN, PH.number);
  t = t.replace(RE_EIRCODE, (m) => (/\d/.test(m) && /[a-z]/i.test(m) ? PH.place : m));
  t = t.replace(RE_PHONE, (m) => ((m.match(/\d/g) || []).length >= 7 ? PH.number : m));
  return t;
}

/* The words of a line, each with whether it begins a sentence. A token is
   letters (with fadas and apostrophes); the rest is kept as it stands. */
const TOKEN = /[\p{L}][\p{L}'’-]*/gu;
/* names Nosca knows, as whole tokens without regard to case or fadas — kept
   only where a common word is written in lower case ("the green" with a
   Green on the roster) — then any capitalised word that does not begin a
   sentence and is not on the allowlist, as a guess */
export function scrubNames(text, { names = [], sport = "golf" } = {}) {
  const known = new Set();
  for (const n of names) fold(n).split(/[^a-z0-9'’-]+/).filter((w) => w.length > 1).forEach((w) => known.add(w));
  const allow = allowFor(sport), common = new Set([...COMMON, ...sportWords(sport)]);
  let out = "", last = 0, sentenceStart = true, prev = "";
  const src = String(text == null ? "" : text);
  for (const m of src.matchAll(TOKEN)) {
    const before = src.slice(last, m.index);
    /* a sentence begins at the line's start, after a full stop, a question or an exclamation, a colon, a dash or a bracket */
    if ((/[!?:;(\u2013\u2014"\u201c-]\s*$/.test(before) || (/\.\s*$/.test(before) && !ABBR.has(prev))) || /\n\s*$/.test(before) || /^\s*$/.test(src.slice(0, m.index))) sentenceStart = true;
    out += before;
    const w = m[0], f = fold(w).replace(/['’]s$/, "").replace(/['’]/g, "");
    const lower = w === w.toLowerCase();
    const capital = /^\p{Lu}/u.test(w);
    let rep = w;
    if (known.has(f) && !(lower && common.has(f))) rep = PH.name;
    else if (capital && !sentenceStart && !allow.has(f) && !(w.length <= 4 && w === w.toUpperCase())) rep = PH.name;
    out += rep;
    last = m.index + w.length;
    sentenceStart = false; prev = f;
  }
  return out + src.slice(last);
}
/* the phone's scrub: patterns, then names */
export const scrub = (text, opts = {}) => scrubNames(scrubPatterns(text), opts);

/* ---------------------------------------------------------------- the request */
/* { v, sport, player, segs: [{ part, a, id?, text }] } — counted over everything sent */
export function measure(body) {
  const segs = (body && body.segs) || [];
  return { segments: segs.length, textBytes: segs.reduce((n, s) => n + bytesOf(s.text) + bytesOf(s.a) + bytesOf(s.part) + (s.id != null ? String(s.id).length : 0), 0), bodyBytes: bytesOf(JSON.stringify(body || {})) };
}
export const withinBudget = (body, k = 1) => { const m = measure(body); return m.segments <= BUDGET.segments * k && m.textBytes <= BUDGET.textBytes * k && m.bodyBytes <= BUDGET.bodyBytes * k; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The function's strict check. Answers null when the request is good, else
   why not (the function answers 400 without saying it). */
export function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "not an object";
  const keys = Object.keys(body).sort().join(",");
  if (keys !== "player,segs,sport,v") return "unexpected fields";
  if (body.v !== PROMPT_V) return "version";
  if (!SPORTS.includes(body.sport)) return "sport";
  if (typeof body.player !== "string" || !UUID.test(body.player)) return "player";
  if (!Array.isArray(body.segs) || !body.segs.length) return "segments";
  if (!withinBudget(body)) return "budget";
  const ids = new Set();
  for (const s of body.segs) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return "segment";
    const ks = Object.keys(s).filter((k) => k !== "id").sort().join(",");
    if (ks !== "a,part,text") return "segment fields";
    if (s.a !== "C" && s.a !== "P") return "author";
    if (!PARTS.includes(s.part)) return "part";
    if (typeof s.text !== "string" || !s.text.length) return "text";
    if (s.a === "P" && !MARKERS.includes(s.text)) return "a player-side line carries words";
    if ("id" in s) {
      if (!Number.isInteger(s.id) || s.id < 1) return "id";
      if (s.a !== "C" || s.part !== "day") return "an id off a coach's line of the day";
      if (MARKERS.includes(s.text)) return "an id on a marker";
      if (ids.has(s.id)) return "a repeated id";
      ids.add(s.id);
    }
  }
  if (!body.segs.some((s) => s.part === "day")) return "no day";
  return null;
}
/* the numbers a request issued: only these may come back */
export const issuedIds = (body) => new Set(((body && body.segs) || []).filter((s) => s.a === "C" && s.part === "day" && Number.isInteger(s.id)).map((s) => s.id));

/* ---------------------------------------------------------------- the answer */
export function schemaFor(sport) {
  const ids = (FOCUS[sport] || []).map((a) => a.id);
  const ints = { type: "array", items: { type: "integer" } };
  return {
    type: "object", additionalProperties: false,
    required: ["day", "focus", "note", "tip", "drills"],
    properties: {
      day: { type: "string", enum: DAY_KINDS },
      focus: { type: "array", items: { type: "string", enum: ids } },
      note: ints, tip: ints, drills: ints,
    },
  };
}
/* the phone validates again what the function already validated: the
   sport's own ids (in any case, once each), numbers it issued, one tip,
   and a chat day carries nothing */
export function cleanVerdict(v, sport, issued) {
  if (!v || typeof v !== "object" || !DAY_KINDS.includes(v.day)) return null;
  const areaIds = (FOCUS[sport] || []).map((a) => a.id);
  const seen = new Set();
  const focus = (Array.isArray(v.focus) ? v.focus : []).map((x) => areaIds.find((id) => id.toLowerCase() === String(x).toLowerCase())).filter((x) => x && !seen.has(x) && seen.add(x));
  const nums = (xs) => { const s = new Set(); return (Array.isArray(xs) ? xs : []).filter((n) => Number.isInteger(n) && issued.has(n) && !s.has(n) && s.add(n)); };
  if (v.day === "chat") return { day: "chat", focus: [], note: [], tip: [], drills: [] };
  return { day: v.day, focus, note: nums(v.note), tip: nums(v.tip).slice(0, 1), drills: nums(v.drills) };
}
