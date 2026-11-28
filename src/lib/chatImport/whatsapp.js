/* THE WHATSAPP PARSER (docs/import/SPEC.md, "Grammar").
 *
 * A chat's text, as WhatsApp exports it from an iPhone or an Android, read
 * into messages — on the phone, by code, every fact decided here and
 * nowhere else: the day of every message, who wrote it, what file it
 * carries. Nothing is guessed from a time, and nothing is ever lost:
 * messages + continuation lines + system lines + lines before the first
 * message = the lines in.
 *
 *   parseChat(text)  → { ok, error?, shape, order, ambiguous, messages, authors, counts, group }
 *   dateOf(msg, order) → "YYYY-MM-DD", the literal day from the header's digits
 */

/* invisible marks WhatsApp puts round names and attachments */
const INVISIBLE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const SP = "[ \\u202F\\u00A0]";
/* the loose header: any of the shapes WhatsApp has written */
const LOOSE = new RegExp(`^\\[?(\\d{1,4})([./-])(\\d{1,2})\\2(\\d{1,4})(,?)${SP}+(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?(?:${SP}*([AaPp])\\.?${SP}?([Mm])\\.?)?(\\]?)(?:${SP}-)?${SP}`);

/* group chats are refused by WhatsApp's own system lines, never by counting authors */
const GROUP_PHRASES = [
  /^(?:.+ )?created group\b/i, /^(?:.+ )?created this group\b/i, /^.+ added .+/i, /^.+ removed .+/i, /^.+ left$/i,
  /^.+ joined using this group's invite link/i, /^(?:.+ )?changed the subject\b/i, /^(?:.+ )?changed this group's icon/i,
  /^(?:.+ )?changed the group description/i, /^(?:.+ )?changed this group's settings/i, /now an admin/i, /^(?:.+ )?deleted this group's icon/i,
  /^you added .+/i, /^you removed .+/i, /^you left$/i,
];
/* the other lines WhatsApp writes itself */
const SYSTEM_PHRASES = [
  /^messages (?:and calls )?(?:to this chat )?(?:and calls )?are (?:now )?(?:end-to-end encrypted|secured with end-to-end encryption)/i,
  /^your security code with .+ changed/i, /changed their phone number/i, /changed to .+ phone number/i,
  /^missed (?:voice|video) call/i, /^(?:voice|video) call\b/i, /^this chat is with a business account/i,
  /^.*turned (?:on|off) disappearing messages/i, /^disappearing messages/i, /^you (?:blocked|unblocked) this contact/i,
  /^.+ is a contact\.?$/i, /^waiting for this message/i, /^you're now an admin/i, /^.+ pinned a message/i,
];
const DELETED = /^(?:this message was deleted|you deleted this message)\.?$/i;
const EDITED = /\s*<this message was edited>\s*$/i;
const OMITTED = /^<?(?:media omitted|image omitted|video omitted|audio omitted|sticker omitted|gif omitted|document omitted|contact card omitted|vcard omitted)>?$/i;

const isGroupLine = (body) => GROUP_PHRASES.some((re) => re.test(body.trim()));
const isSystemLine = (body) => SYSTEM_PHRASES.some((re) => re.test(body.trim()));

function shapeOf(m, line) {
  return {
    bracket: line.startsWith("["), sep: m[2], comma: m[5] === ",", seconds: m[8] !== undefined,
    ampm: m[9] ? (line.slice(m.index || 0, m[0].length).match(/[AaPp]\.?\s?[Mm]\.?/) || [""])[0].replace(/[AaPp]/, "x").replace(/[Mm]/, "m").replace(/[\u202F\u00A0]/g, " ") : "",
    dash: /-[ \u202F\u00A0]$/.test(m[0]),
    first4: m[1].length === 4,
  };
}
const shapeKey = (s) => JSON.stringify([s.bracket, s.sep, s.comma, s.seconds, s.ampm, s.dash, s.first4]);

/* the date's three numbers and the time, read off a header the locked shape accepts */
function readHeader(line, lock) {
  const m = LOOSE.exec(line);
  if (!m) return null;
  if (shapeKey(shapeOf(m, line)) !== lock) return null;
  let h = Number(m[6]); const min = Number(m[7]), sec = m[8] ? Number(m[8]) : 0;
  if (m[9]) { const pm = /p/i.test(m[9]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  if (h > 23 || min > 59 || sec > 59) return null;
  return { a: m[1], b: m[3], c: m[4], h, min, sec, rest: line.slice(m[0].length) };
}

/* "Name: words" — the author label and what they wrote; a line with no
   label is WhatsApp's own (Android writes its system lines bare) */
function splitAuthor(rest) {
  const i = rest.indexOf(": ");
  if (i <= 0 || i > 80) return null;
  const label = rest.slice(0, i).replace(INVISIBLE, "").trim();
  if (!label || /^\d+$/.test(label)) return null;
  return { label, body: rest.slice(i + 2) };
}

/* the attachment a message carries, and the words beside it */
const ATTACH_IPHONE = /<attached:\s*([^>]+)>/i;
const ATTACH_ANDROID = /^(\S.*?\.[A-Za-z0-9]{2,5}) \(([^()]{2,40})\)\s*$/;
const ATTACH_OLD = /^(\S.*?\.[A-Za-z0-9]{2,5}) <attached>\s*$/i;
function attachmentOf(body) {
  let m = ATTACH_IPHONE.exec(body);
  if (m) return { name: m[1].trim(), caption: (body.slice(0, m.index) + body.slice(m.index + m[0].length)).trim() };
  const lines = body.split("\n"); const first = lines[0];
  m = ATTACH_ANDROID.exec(first) || ATTACH_OLD.exec(first);
  if (m) return { name: m[1].trim(), caption: lines.slice(1).join("\n").trim() };
  return null;
}

/* SHAPE LOCK: the commonest exact header shape among the first 50
   non-empty lines; every new message must be of it. A date-led line of
   another shape ("25/06/2025 10:00 Driving range") continues the message
   it sits in. */
export function lockShape(lines) {
  const tally = new Map(); let seen = 0;
  for (const raw of lines) {
    const line = raw.replace(INVISIBLE, "");
    if (!line.trim()) continue;
    if (++seen > 50) break;
    const m = LOOSE.exec(line); if (!m) continue;
    const k = shapeKey(shapeOf(m, line)); tally.set(k, (tally.get(k) || 0) + 1);
  }
  let best = null, n = 0;
  for (const [k, c] of tally) if (c > n) { best = k; n = c; }
  return best;
}

/* the order of the date's numbers: year first by a four-digit first
   group; else a first number over 12 means day first, a second over 12
   month first; then the reading under which dates never go backwards;
   then the dates in media names; otherwise the person picks */
const valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
const yearOf = (s) => (String(s).length <= 2 ? 2000 + Number(s) : Number(s));
export function dayOf(a, b, c, order) {
  let y, m, d;
  if (order === "ymd") { y = yearOf(a); m = Number(b); d = Number(c); }
  else if (order === "dmy") { d = Number(a); m = Number(b); y = yearOf(c); }
  else { m = Number(a); d = Number(b); y = yearOf(c); }
  if (!valid(y, m, d)) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export const dateOf = (msg, order) => dayOf(msg.a, msg.b, msg.c, order);
const MEDIA_DATE = /(?:IMG|VID|AUD|PTT|STK|DOC)-(\d{4})(\d{2})(\d{2})-WA|\b(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}\b/;
function decideOrder(msgs) {
  if (!msgs.length) return { order: null, ambiguous: false };
  if (msgs[0].a.length === 4) return { order: "ymd", ambiguous: false };
  if (msgs.some((x) => Number(x.a) > 12)) return { order: "dmy", ambiguous: false };
  if (msgs.some((x) => Number(x.b) > 12)) return { order: "mdy", ambiguous: false };
  const never = (order) => { let last = ""; for (const x of msgs) { const d = dateOf(x, order); if (!d) return false; if (d < last) return false; last = d; } return true; };
  const dmy = never("dmy"), mdy = never("mdy");
  if (dmy && !mdy) return { order: "dmy", ambiguous: false };
  if (mdy && !dmy) return { order: "mdy", ambiguous: false };
  let agreeD = 0, agreeM = 0;
  for (const x of msgs) {
    const nm = x.attachment && MEDIA_DATE.exec(x.attachment.name); if (!nm) continue;
    const iso = nm[1] ? `${nm[1]}-${nm[2]}-${nm[3]}` : `${nm[4]}-${nm[5]}-${nm[6]}`;
    if (dateOf(x, "dmy") === iso) agreeD++;
    if (dateOf(x, "mdy") === iso) agreeM++;
  }
  if (agreeD > agreeM) return { order: "dmy", ambiguous: false };
  if (agreeM > agreeD) return { order: "mdy", ambiguous: false };
  return { order: null, ambiguous: true };
}

export function parseChat(text) {
  const lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const lock = lockShape(lines);
  if (!lock) return { ok: false, error: "No messages found" };
  const messages = []; const counts = { lines: lines.length, messages: 0, continuations: 0, system: 0, before: 0, deleted: 0, edited: 0, omitted: 0 };
  let group = false, cur = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]; const clean = raw.replace(INVISIBLE, "");
    const h = readHeader(clean, lock);
    let started = false;
    if (h) {
      /* a body WhatsApp wrote itself (or a file) begins with an invisible mark, U+200E */
      const lead = raw.replace(/^[\u200E\u200F\uFEFF]+/, ""); const hm = LOOSE.exec(lead);
      const lrm = !!hm && /^[^\n]{1,80}?: \u200E/.test(lead.slice(hm[0].length));
      const au = splitAuthor(h.rest);
      if (au) {
        const body = au.body.trim();
        if (lrm && isGroupLine(body)) { group = true; counts.system++; cur = null; started = true; }
        else if (lrm && isSystemLine(body)) { counts.system++; cur = null; started = true; }
        else {
          cur = { i: messages.length, line: i, a: h.a, b: h.b, c: h.c, h: h.h, min: h.min, sec: h.sec, author: au.label, body: au.body, lrm };
          messages.push(cur); counts.messages++; started = true;
        }
      } else if (isGroupLine(h.rest) || isSystemLine(h.rest) || h.rest.trim()) {
        /* Android writes its own lines with no author */
        if (isGroupLine(h.rest)) group = true;
        counts.system++; cur = null; started = true;
      }
    }
    if (started) continue;
    if (cur) { cur.body += "\n" + clean; counts.continuations++; }
    else if (messages.length || counts.system) counts.continuations++;
    else counts.before++;
  }
  /* each message's words, file and fate, once its continuation lines are in */
  const kept = [];
  for (const m of messages) {
    let body = m.body.replace(INVISIBLE, "");
    if (EDITED.test(body)) { body = body.replace(EDITED, ""); counts.edited++; }
    if (DELETED.test(body.trim())) { counts.deleted++; continue; }
    const att = attachmentOf(body);
    if (att) { m.attachment = { name: att.name }; body = att.caption; }
    else if (OMITTED.test(body.trim())) { m.omitted = true; counts.omitted++; body = ""; }
    m.body = body.replace(/\s+$/, "");
    kept.push(m);
  }
  const { order, ambiguous } = decideOrder(kept);
  const authors = new Map();
  for (const m of kept) authors.set(m.author, (authors.get(m.author) || 0) + 1);
  return { ok: true, shape: lock, order, ambiguous, messages: kept, authors, counts, group };
}

/* a .txt's first non-empty line parses as a header: the content check for a loose text file */
export function looksLikeChat(text) {
  const first = String(text || "").split(/\r?\n/).map((l) => l.replace(INVISIBLE, "")).find((l) => l.trim());
  return !!first && LOOSE.test(first);
}

/* a local moment from a message's day and time, as ISO with its offset — never toISOString */
export function localIso(day, h, min, sec = 0, ms = 0) {
  const [y, mo, d] = String(day).split("-").map(Number);
  const dt = new Date(y, mo - 1, d, h, min, sec, ms);
  const off = -dt.getTimezoneOffset(), sign = off >= 0 ? "+" : "-", ab = Math.abs(off);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(dt.getFullYear(), 4)}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}.${p(dt.getMilliseconds(), 3)}${sign}${p(Math.floor(ab / 60))}:${p(ab % 60)}`;
}
