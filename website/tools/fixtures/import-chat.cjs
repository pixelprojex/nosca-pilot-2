/* THE CHAT THE WEBSITE'S IMPORT STILLS ARE TAKEN FROM: a golf coach's WhatsApp with one player, a season of it
   (11 Sep – 13 Nov 2025), exported from an iPhone as WhatsApp writes it, zipped with its files. The text and the zip
   are written by the e2e suite's own writer (scripts/e2e/fixtures/make-chat-zip.cjs), so the shape is the one the
   import is tested on; the files are the real coaching clips and stills beside this file (a full swing, a chip, a
   putt: CREDITS.md), each clip in the .mp4 an export carries (the headless browser plays the WebM inside it). The
   days are a coach's ordinary season: lessons with and without files, a practice the player filmed, a day of
   arranging (Left out) and one the coach's words leave unsure (Not sure, unticked). The people are the site's
   fictional ones (Niamh Byrne, and Cian Murphy saved as "Cian M").
     node website/tools/fixtures/import-chat.cjs [outDir]   → <outDir>/chat-season.zip */
const fs = require("fs"), path = require("path");
const FX = require("../../../scripts/e2e/fixtures/make-chat-zip.cjs");

/* [day, [[time, who (C coach · P player), words, file?]]]; a file's name ends in the clip or still it carries */
const DAYS = [
  ["2025-09-11", [["18:05", "C", "First lesson today. Full swing basics: grip, posture and ball position."], ["18:06", "C", "", { kind: "photo", caption: "Your setup", use: "swing" }], ["18:20", "P", "Thanks Niamh, really enjoyed it"]]],
  ["2025-09-18", [["18:10", "C", "Mental game today, the pre-shot routine. Same routine on every shot."]]],
  ["2025-09-25", [["17:55", "C", "Putting lesson today. Green reading on the slopes, then short putts to finish.", { kind: "video", caption: "Short putts", use: "putt" }]]],
  ["2025-09-28", [["20:15", "C", "Have a think about what you want from the winter, and we'll plan it from there."], ["20:30", "P", "Will do, thanks"]]],
  ["2025-10-02", [["18:00", "C", "Chipping today. Hands ahead, one lever back and through.", { kind: "video", use: "chip" }], ["18:12", "P", "That felt so much better"]]],
  ["2025-10-09", [["18:25", "C", "On course lesson today on the back nine. Play to the fat side of the green."]]],
  ["2025-10-14", [["12:30", "P", "What time Thursday?"], ["12:41", "C", "See you Thursday at 10 on the range"]]],
  ["2025-10-16", [["18:15", "C", "Wedges inside 100 yards today, distance control. One swing length per club.", { kind: "video", caption: "Your wedge", use: "swing" }], ["18:16", "C", "", { kind: "photo", use: "swing" }]]],
  ["2025-10-23", [["18:05", "C", "Bunker play today. Open the face and splash the sand."], ["18:06", "C", "Tip: commit to the shot."]]],
  ["2025-10-26", [["19:40", "P", "Gate drill tonight", { kind: "video", use: "putt" }], ["20:02", "C", "Looks good. The stroke is much smoother, keep the face square through the gate."]]],
  ["2025-10-30", [["18:20", "C", "Full swing today. Tempo held all the way to the top.", { kind: "video", caption: "Your swing", use: "swing" }], ["18:21", "C", "Feel the left side lead the way down."]]],
  ["2025-11-06", [["18:10", "C", "Putting lesson today. Pace first, then line.", { kind: "video", use: "putt" }], ["18:11", "C", "Let the stroke swing through; never hit at it.", { kind: "photo", use: "putt" }], ["18:30", "P", "Will do the gate drill every day this week"]]],
  ["2025-11-13", [["17:40", "C", "Great session today. Chipping: land it on the towel and let it run.", { kind: "video", caption: "Your chip", use: "chip" }], ["17:41", "C", "", { kind: "photo", use: "chip" }], ["17:52", "P", "Thanks Niamh, that clicked"]]],
];

function write(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const r = FX.render("iphone", DAYS);
  /* the writer numbers the files in order; each takes the bytes of the clip or still its day names */
  const uses = DAYS.flatMap(([, msgs]) => msgs.filter((m) => m[3]).map((m) => m[3]));
  const files = r.files.map((f, i) => {
    const u = uses[i] || {}; const video = /\.mp4$/.test(f.name);
    return { name: f.name, data: fs.readFileSync(path.join(__dirname, `${u.use || "swing"}.${video ? "webm" : "jpg"}`)) };
  });
  const out = path.join(outDir, "chat-season.zip");
  fs.writeFileSync(out, FX.zip([{ name: "_chat.txt", data: Buffer.from(r.text, "utf8") }, ...files]));
  return out;
}

module.exports = { DAYS, write };
if (require.main === module) console.log(write(process.argv[2] || require("os").tmpdir()));
