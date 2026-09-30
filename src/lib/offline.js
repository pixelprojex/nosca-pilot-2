/* THE OFFLINE STORE
 *
 * Everything the app keeps on the phone: a lesson downloaded whole
 * (its record and every file, as blobs), and the last good load of
 * the person's data, so the app opens on a plane the way Netflix
 * does. IndexedDB, one database, three stores — nothing else here
 * knows about React or Supabase. Every call resolves; a browser with
 * no IndexedDB (a private tab on an old Safari) makes `offlineSupported`
 * false and the app says downloads are not available rather than
 * failing quietly.
 *
 *   lessons    id → { id, owner, savedAt, bytes, lesson, who, coach, tip,
 *                     drills, attendance, files: [{ key, id, type, name, size }] }
 *   files      key ("<lessonId>/<mediaId>") → { key, lessonId, blob, type, name, size }
 *   snapshots  owner → { owner, at, data }
 *
 * Rows carry the account they belong to, and are listed per account:
 * a phone two people sign into never shows one the other's downloads.
 */
const DB_NAME = "nosca-offline";
const DB_VERSION = 1;
let opening = null;

export const offlineSupported = () => typeof indexedDB !== "undefined" && indexedDB !== null;

function open() {
  if (!offlineSupported()) return Promise.reject(new Error("IndexedDB is not available"));
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { opening = null; reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("lessons")) db.createObjectStore("lessons", { keyPath: "id" }).createIndex("owner", "owner");
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "key" }).createIndex("lessonId", "lessonId");
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "owner" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { try { db.close(); } catch (e) { /* fine */ } opening = null; };
      resolve(db);
    };
    req.onerror = () => { opening = null; reject(req.error || new Error("IndexedDB failed to open")); };
    req.onblocked = () => { /* another tab holds an older version; the open resolves when it lets go */ };
  });
  return opening;
}

/* one transaction, one store; `fn` issues the requests and returns the
   one whose result is wanted (or nothing) */
function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    let t;
    try { t = db.transaction(store, mode); } catch (e) { reject(e); return; }
    let out;
    try { out = fn(t.objectStore(store), t); } catch (e) { try { t.abort(); } catch (x) { /* fine */ } reject(e); return; }
    t.oncomplete = () => resolve(out && typeof out === "object" && "result" in out ? out.result : out);
    t.onerror = () => reject(t.error || new Error("IndexedDB transaction failed"));
    t.onabort = () => reject(t.error || new Error("IndexedDB transaction aborted"));
  }));
}

/* ---------- downloaded lessons ---------- */
export const listSaved = (owner) => run("lessons", "readonly", (s) => s.getAll()).then((rows) => (rows || []).filter((r) => !owner || r.owner === owner));
export const getSaved = (id) => run("lessons", "readonly", (s) => s.get(String(id))).then((r) => r || null);
export const putSaved = (record) => run("lessons", "readwrite", (s) => s.put(record));
export const removeSaved = async (id) => {
  const keys = await fileKeysFor(id);
  await run("files", "readwrite", (s) => { keys.forEach((k) => s.delete(k)); });
  await run("lessons", "readwrite", (s) => s.delete(String(id)));
};

/* ---------- the files ---------- */
export const putFile = (file) => run("files", "readwrite", (s) => s.put(file));
export const getFile = (key) => run("files", "readonly", (s) => s.get(key)).then((r) => r || null);
export const removeFile = (key) => run("files", "readwrite", (s) => s.delete(key));
export const fileKeysFor = (lessonId) => run("files", "readonly", (s) => s.index("lessonId").getAllKeys(String(lessonId))).then((k) => k || []);
export const filesFor = (lessonId) => run("files", "readonly", (s) => s.index("lessonId").getAll(String(lessonId))).then((r) => r || []);

/* ---------- the last good load ---------- */
export const putSnapshot = (owner, data) => run("snapshots", "readwrite", (s) => s.put({ owner, at: Date.now(), data }));
export const getSnapshot = (owner) => run("snapshots", "readonly", (s) => s.get(owner)).then((r) => r || null);
export const clearSnapshot = (owner) => run("snapshots", "readwrite", (s) => s.delete(owner));

/* everything of one account's, for a deleted account */
export const clearOwner = async (owner) => {
  const rows = await listSaved(owner);
  for (const r of rows) await removeSaved(r.id);
  try { await clearSnapshot(owner); } catch (e) { /* fine */ }
};

/* Ask the browser to keep this origin's storage rather than evict it
   under pressure. iOS grants it to a home-screen app; a browser tab
   may say no, and the downloads still work until the phone needs the
   room. Best effort, never awaited by anything that matters. */
export const requestPersist = async () => {
  try { if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* fine */ }
  return false;
};
export const storageEstimate = async () => {
  try { if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* fine */ }
  return null;
};
