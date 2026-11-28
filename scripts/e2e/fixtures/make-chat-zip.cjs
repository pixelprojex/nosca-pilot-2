#!/usr/bin/env node
/* THE IMPORT'S CHAT FIXTURES, written deterministically.
 *
 *   node scripts/e2e/fixtures/make-chat-zip.cjs [outDir]
 *
 * About 45 days of a golf coach's WhatsApp chat with one player, as an
 * iPhone and as an Android export it, zipped with the committed files in
 * fixtures/media (a two-second clip, a small photo, a phone-shaped PNG
 * screenshot, a short Opus voice note). They carry every case the import
 * must meet: text-only lessons and lessons with files; a recap the day
 * after a lesson; a practice day (the player's clip, the coach's words);
 * a sticker, a PDF and a .heic; a file named that is not in the zip; an
 * edited and a deleted message and a caption on each platform's side; a
 * phone number, an email, a link and an Eircode; a health line, "pay
 * attention to your grip" and a payment line; a coach's line naming a
 * sibling; a continuation line that starts with a date and a time; two
 * out-of-order times from different authors; and "read the green" in
 * lower case with a player called Green on the roster.
 *
 * Variants: chat-merge (the player's label changes mid-chat), chat-parent
 * (a parent and the player both writing), chat-group (three authors and a
 * "created group" line), chat-seven (seven authors), chat-year-first
 * (year-first headers), chat-plain.txt (the iPhone chat alone, no files)
 * and not-a-chat.zip (a zip with no chat in it).
 *
 * The zips are STORE-only, written here with no dependency, so the bytes
 * are the same every run. Exported for the suites: DAYS, COACH, PLAYER.
 */
const fs = require("fs");
const path = require("path");

const MEDIA = path.join(__dirname, "media");
const COACH = "Niamh Byrne", PLAYER = "Cian M", PLAYER2 = "Cian Murphy (new)", PARENT = "Orla Kelly", KID = "Saoirse K";
const LRM = "‎";

/* ---- a STORE zip, by hand: local headers, the files, the central directory, the end record ---- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  const DOS_TIME = 0x6000, DOS_DATE = 0x5a8e;   // a fixed moment, so the bytes never change
  for (const { name, data } of files) {
    const nm = Buffer.from(name, "utf8"), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nm, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nm);
    offset += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ---- the days: [day, [time, who, text, file?]] — who is C (coach), P (player), P2 (player's new label), A (parent) ---- */
/* file: { kind: photo|video|audio|sticker|pdf|heic|png|missing, caption } */
const DAYS = [
  ["2025-03-03", [["18:02", "C", "Great first lesson today Cian. We worked on your putting stroke and the setup.\nKeep the putter face square through impact."], ["18:10", "P", "Thanks Niamh, really enjoyed it"]]],
  ["2025-03-08", [["10:15", "P", "What time Thursday?"], ["10:20", "C", "See you Thursday at 10 on the range"]]],
  ["2025-03-13", [["17:45", "C", "Good lesson today. Chipping was much better, landing spot is the key.", { kind: "photo", caption: "Your setup" }], ["17:50", "P", "Brilliant"]]],
  ["2025-03-14", [["09:05", "C", "From yesterday's lesson: keep the hands ahead on the chip shots."]]],
  ["2025-03-20", [["19:00", "P", "Here's my practice from tonight", { kind: "video" }], ["19:30", "C", "Looked at your video. Nice rhythm, keep the tempo smooth."]]],
  ["2025-03-27", [["16:40", "C", "Bunker play today. Open the face and splash the sand.\nTip: commit to the shot.", { kind: "video", caption: "The splash" }]]],
  ["2025-04-02", [["12:00", "C", "Ring me on 087 123 4567 or email niamh.byrne@example.ie about the range at D02 X285"], ["12:05", "P", "Will do"]]],
  ["2025-04-10", [["18:30", "C", "Driver lesson today, full swing work. Pay attention to your grip pressure.\nSee https://example.com/drill for the drill."]]],
  ["2025-04-11", [["08:10", "C", "Your back was sore yesterday, mind it this week"]]],
  ["2025-04-17", [["18:20", "C", "Putting lesson today. You read the green well on the long ones.", { kind: "audio" }], ["18:22", "P", "Cheers", { kind: "sticker" }]]],
  ["2025-04-24", [["17:00", "C", "Paid for April, thanks. €40 for May when you can."]]],
  ["2025-05-01", [["18:00", "C", "Chipping and pitching today. Ellie was brilliant too, bring her again."]]],
  ["2025-05-08", [["18:15", "C", "Course management on the back nine today. Play to the fat side of the green."], ["18:16", "C", "<This message was edited> Club selection on 14 was spot on"]]],
  ["2025-05-15", [["19:10", "P", "Plan for the medal attached", { kind: "pdf" }], ["19:12", "C", "Hmm"]]],
  ["2025-05-22", [["18:40", "C", "Full swing today, the weight shift is coming.", { kind: "heic" }], ["18:41", "P", "This message was deleted"]]],
  ["2025-05-29", [["18:00", "C", "Lesson notes from today", { kind: "missing" }], ["18:05", "C", "Short putts were solid. Pace control next week."]]],
  ["2025-06-05", [["18:30", "C", "Mental game today, the pre-shot routine.\n25/06/2025 10:00 Driving range booked for the next one."]]],
  ["2025-06-12", [["18:00", "P", "Running late, there in 10"], ["17:58", "C", "No bother"]]],
  ["2025-06-14", [["18:20", "C", "Great session today. Wedges inside 100 yards, distance control.", { kind: "video", caption: "Your wedge" }], ["18:21", "C", "Tip: one swing length per club.", { kind: "photo" }], ["18:24", "P", "Thanks!", { kind: "png" }]]],
];
/* the rest of the 45: steady lessons and chat, one a week from July */
const MORE = [
  ["Putting lesson today, green reading on the slopes.", "C"], ["What time Saturday?", "P"], ["Bunker lesson today, plugged lies.", "C"],
  ["Chipping lesson today, club choice around the green.", "C"], ["See you next week", "C"], ["Full swing lesson today, the driver is straighter.", "C"],
  ["Pitching lesson today, trajectory control.", "C"], ["Thanks for today", "P"], ["Putting lesson today, pace on the long putts.", "C"],
  ["On course lesson today, strategy on the par fives.", "C"], ["Mental game lesson today, commitment on every shot.", "C"], ["Grand", "P"],
  ["Chipping lesson today, contact first.", "C"], ["Fitness lesson today, mobility work for the turn.", "C"], ["Full swing lesson today, irons.", "C"],
  ["Putting lesson today, short putts under pressure.", "C"], ["See you Thursday", "P"], ["Bunker lesson today, greenside splash.", "C"],
  ["Pitching lesson today, spin and distance.", "C"], ["Course management lesson today, club selection.", "C"], ["Chipping lesson today, landing spot.", "C"],
  ["Full swing lesson today, ball striking with the hybrids.", "C"], ["Putting lesson today, the stroke is solid now.", "C"], ["Thanks Niamh", "P"],
  ["Full swing lesson today, setup and posture.", "C"], ["Great lesson to finish the season, wedges and putting.", "C"],
];
(function addMore() {
  const d = new Date(2025, 6, 3);
  MORE.forEach(([text, who], i) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lines = [[`${17 + (i % 3)}:${String(10 + i).padStart(2, "0")}`, who, text]];
    if (i === 5) lines.push(["18:40", "C", "Look at the shaft lean here", { kind: "video" }]);
    DAYS.push([iso, lines]);
    d.setDate(d.getDate() + (i % 2 ? 6 : 5));
  });
})();

const AUTHOR = { C: COACH, P: PLAYER, P2: PLAYER2, A: PARENT, K: KID };
const EXT = { photo: "jpg", video: "mp4", audio: "opus", sticker: "webp", pdf: "pdf", heic: "heic", png: "png", missing: "jpg" };
const SRC = { photo: "photo.jpg", video: "clip.mp4", audio: "note.opus", png: "screenshot.png" };
const IPHONE_TAG = { photo: "PHOTO", video: "VIDEO", audio: "AUDIO", sticker: "STICKER", pdf: "Plan for the medal", heic: "PHOTO", png: "PHOTO", missing: "PHOTO" };
const ANDROID_TAG = { photo: "IMG", video: "VID", audio: "PTT", sticker: "STK", pdf: "DOC", heic: "IMG", png: "IMG", missing: "IMG" };

function fileName(platform, kind, iso, time, n) {
  const ext = EXT[kind]; const dd = iso.replace(/-/g, "");
  if (platform === "iphone") {
    if (kind === "pdf") return "Plan for the medal.pdf";
    return `${String(n).padStart(8, "0")}-${IPHONE_TAG[kind]}-${iso}-${time.replace(":", "-")}-00.${ext}`;
  }
  return `${ANDROID_TAG[kind]}-${dd}-WA${String(n).padStart(4, "0")}.${ext}`;
}
const bytesFor = (kind) => (SRC[kind] ? fs.readFileSync(path.join(MEDIA, SRC[kind])) : kind === "pdf" ? Buffer.from("%PDF-1.4\n% plan\n") : kind === "sticker" ? Buffer.from("RIFF0000WEBPVP8 ") : Buffer.from("heic-bytes"));

/* one chat as text, with its files */
function render(platform, days, { yearFirst = false, extra = [] } = {}) {
  const lines = []; const files = []; let n = 0;
  const head = (iso, time) => {
    const [y, m, d] = iso.split("-");
    const date = yearFirst ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
    return platform === "iphone" ? `[${date}, ${time}:00]` : `${date}, ${time} -`;
  };
  if (platform === "iphone") lines.push(`${head(days[0][0], "09:00")} ${PLAYER}: ${LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`);
  else lines.push(`${head(days[0][0], "09:00")} Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.`);
  for (const l of extra) lines.push(l(head));
  for (const [iso, msgs] of days) {
    for (const [time, who, text0, file] of msgs) {
      const author = AUTHOR[who];
      let text = text0;
      if (text.startsWith("<This message was edited> ")) text = `${text.slice(26)}${platform === "iphone" ? "" : " <This message was edited>"}`;
      if (!file) { lines.push(`${head(iso, time)} ${author}: ${text}`); continue; }
      n += 1;
      const name = fileName(platform, file.kind, iso, time, n);
      if (file.kind !== "missing") files.push({ name, data: bytesFor(file.kind) });
      if (platform === "iphone") {
        const cap = file.caption || (text && !file.caption ? null : null);
        if (text) lines.push(`${head(iso, time)} ${author}: ${text}`);
        lines.push(`${LRM}${head(iso, time)} ${author}: ${cap ? cap + " " : ""}${LRM}<attached: ${name}>`);
      } else {
        if (text) lines.push(`${head(iso, time)} ${author}: ${text}`);
        lines.push(`${head(iso, time)} ${author}: ${name} (file attached)`);
        if (file.caption) lines.push(file.caption);
      }
    }
  }
  return { text: lines.join("\n") + "\n", files };
}

function write(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = {};
  const put = (name, buf) => { fs.writeFileSync(path.join(outDir, name), buf); out[name] = buf.length; };
  const ip = render("iphone", DAYS);
  put("chat-iphone.zip", zip([{ name: "_chat.txt", data: Buffer.from(ip.text, "utf8") }, ...ip.files]));
  put("chat-plain.txt", Buffer.from(ip.text, "utf8"));
  const an = render("android", DAYS);
  put("chat-android.zip", zip([{ name: `WhatsApp Chat with ${PLAYER}.txt`, data: Buffer.from(an.text, "utf8") }, ...an.files]));
  /* the player's label changes mid-chat: a saved contact */
  const merged = DAYS.map(([iso, msgs], i) => [iso, msgs.map((m) => (i >= 10 && m[1] === "P" ? [m[0], "P2", m[2], m[3]] : m))]);
  const mg = render("iphone", merged);
  put("chat-merge.zip", zip([{ name: "_chat.txt", data: Buffer.from(mg.text, "utf8") }, ...mg.files]));
  /* a parent and the player both writing, about a junior */
  const fam = DAYS.slice(0, 12).map(([iso, msgs], i) => [iso, msgs.map((m) => (m[1] === "P" ? [m[0], i % 2 ? "K" : "A", m[2], m[3]] : m))]);
  const pr = render("iphone", fam);
  put("chat-parent.zip", zip([{ name: "_chat.txt", data: Buffer.from(pr.text, "utf8") }, ...pr.files]));
  /* a club's group: three authors and WhatsApp's own "created group" line */
  const grp = render("iphone", DAYS.slice(0, 3), { extra: [(h) => `${h("2025-03-01", "08:00")} Range Group: ${LRM}${COACH} created group "Range Group"`, (h) => `${h("2025-03-01", "08:01")} Pat Doyle: Hi all`] });
  put("chat-group.zip", zip([{ name: "_chat.txt", data: Buffer.from(grp.text, "utf8") }]));
  /* seven labels, and no group line */
  const seven = render("iphone", DAYS.slice(0, 3), { extra: ["A1", "A2", "A3", "A4", "A5"].map((a, i) => (h) => `${h("2025-03-02", `0${i + 1}:00`)} ${a} Person: hello`) });
  put("chat-seven.zip", zip([{ name: "_chat.txt", data: Buffer.from(seven.text, "utf8") }]));
  const yf = render("android", DAYS.slice(0, 8), { yearFirst: true });
  put("chat-year-first.zip", zip([{ name: `WhatsApp Chat with ${PLAYER}.txt`, data: Buffer.from(yf.text, "utf8") }, ...yf.files]));
  put("not-a-chat.zip", zip([{ name: "notes.txt", data: Buffer.from("Shopping: balls, tees, glove\n") }]));
  put("not-a-chat.txt", Buffer.from("Shopping list\nballs\ntees\n"));
  return out;
}

module.exports = { DAYS, COACH, PLAYER, PLAYER2, PARENT, KID, render, zip, write };
if (require.main === module) {
  const dir = process.argv[2] || path.join(require("os").tmpdir(), "nosca-chats");
  const out = write(dir);
  console.log(`wrote ${Object.keys(out).length} files to ${dir}: ${Object.entries(out).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
