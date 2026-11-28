/* WHAT WAS CHOSEN (docs/import/SPEC.md, "Reading").
 *
 * One .zip, one .txt, or a .txt and its loose files, read on the phone and
 * nowhere else. Checked by what is inside, never by a name or File.type: a
 * zip's PK signature and its end-of-directory record; a text whose first
 * line is a WhatsApp header. A zip is never read whole — zip.js reads its
 * directory, then each entry only when it is asked for (a poster, a
 * preview, an upload), one at a time. Any read error at any stage is the
 * paused state: "Couldn't read the file · choose it again", never a Retry
 * that cannot succeed.
 */
import { looksLikeChat } from "./whatsapp.js";

export const READ_ERROR = "Couldn't read the file · choose it again";
let zipLib = null;
async function zipjs() {
  if (!zipLib) {
    zipLib = await import("@zip.js/zip.js");
    /* no worker: one entry at a time is the whole of the work */
    try { zipLib.configure({ useWebWorkers: false }); } catch (e) { /* the defaults do */ }
  }
  return zipLib;
}

export async function sha256Hex(data) {
  const buf = data instanceof ArrayBuffer ? data : typeof data === "string" ? new TextEncoder().encode(data) : await data.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* the e2e suite's lost file (scripts/e2e/mock.cjs, zipReadFail): the Nth entry read throws, as a phone throws
   NotReadableError for a file it no longer has — set only by a test, read nowhere else */
let READS = 0;
const lostNow = () => { const n = typeof window !== "undefined" ? Number(window.__noscaZipReadFail) : 0; READS += 1; return n > 0 && READS >= n; };
const readEntry = async (fn) => { if (lostNow()) throw Object.assign(new Error("The file could not be read"), { name: "NotReadableError" }); return fn(); };

const bytesAt = async (file, start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
async function isZip(file) {
  if (!file || file.size < 22) return false;
  const head = await bytesAt(file, 0, 4);
  if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) return false;
  /* the end-of-central-directory record, within the last 64 KiB and its own 22 bytes */
  const from = Math.max(0, file.size - 65557);
  const tail = await bytesAt(file, from, file.size);
  for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) return true;
  return false;
}
const CHAT_NAME = /^(?:.*\/)?(?:_chat\.txt|WhatsApp Chat with .+\.txt|WhatsApp Chat - .+\.txt)$/i;
const baseName = (n) => String(n || "").split("/").pop();

/* openSource(files) → { ok, error?, kind, text, chatHash, files: Map(name → { name, size, read(type) }), close } */
export async function openSource(fileList) {
  const files = [...(fileList || [])].filter(Boolean);
  if (!files.length) return { ok: false, error: "That isn't a WhatsApp export" };
  try {
    for (const f of files) {
      if (!(await isZip(f))) continue;
      const z = await zipjs();
      const reader = new z.ZipReader(new z.BlobReader(f));
      const entries = await reader.getEntries();
      const chat = entries.find((e) => !e.directory && CHAT_NAME.test(e.filename));
      if (!chat) { await reader.close().catch(() => {}); return { ok: false, error: "No chat found in that file" }; }
      const text = await chat.getData(new z.TextWriter("utf-8"));
      const map = new Map();
      for (const e of entries) {
        if (e.directory || e === chat) continue;
        const name = baseName(e.filename);
        map.set(name, { name, size: e.uncompressedSize, read: (type) => readEntry(() => e.getData(new z.BlobWriter(type || "application/octet-stream"))) });
      }
      return { ok: true, kind: "zip", text, chatHash: await sha256Hex(text), files: map, close: () => reader.close().catch(() => {}) };
    }
    /* a .txt, and any files chosen beside it */
    let chat = null, text = "";
    for (const f of files) {
      if (f.size > 64 * 1048576) continue;
      const head = await f.slice(0, 4096).text();
      if (looksLikeChat(head)) { chat = f; text = await f.text(); break; }
    }
    if (!chat) return { ok: false, error: "That isn't a WhatsApp export" };
    const map = new Map();
    for (const f of files) if (f !== chat) map.set(baseName(f.name), { name: baseName(f.name), size: f.size, read: (type) => readEntry(async () => (type ? new Blob([f], { type }) : f)) });
    return { ok: true, kind: "txt", text, chatHash: await sha256Hex(text), files: map, close: () => {} };
  } catch (e) {
    return { ok: false, error: READ_ERROR, cause: e && e.name };
  }
}
