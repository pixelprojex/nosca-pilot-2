import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as store from "./offline";

/* DOWNLOADS
 *
 * A lesson saved whole onto the phone — the record (what was worked
 * on, the day, who, the note, the tip, the drills, the register) and
 * every file as a blob — the way a Netflix title is saved: one tap on
 * the disc, a ring while it comes down, a tick when it is there, the
 * size and the day in the Downloads list, and a swipe to let it go.
 * Nothing about it is pretended: a file that will not fetch fails the
 * download with the reason, and Retry picks up where it stopped (the
 * files that landed are kept). The same tap on a downloaded lesson
 * updates it — a clip the coach marked up since, a note edited — and
 * a failed update leaves the old copy where it was.
 *
 *   items[id] = { id, status: saving | saved | failed, progress 0..1,
 *                 bytes, savedAt, error, record }
 */
const NET_RE = /Failed to fetch|Load failed|NetworkError|network|offline/i;
const plain = (x) => { try { return JSON.parse(JSON.stringify(x === undefined ? null : x)); } catch (e) { return null; } };

/* fetch a file as a blob, saying how far along it is */
async function fetchBlob(url, onBytes, signal) {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || typeof res.body.getReader !== "function") { const b = await res.blob(); onBytes(b.size, b.size); return b; }
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal && signal.aborted) { try { reader.cancel(); } catch (e) { /* fine */ } throw Object.assign(new Error("cancelled"), { name: "AbortError" }); }
    chunks.push(value); got += value.byteLength;
    onBytes(got, total);
  }
  return new Blob(chunks, { type });
}

export const fmtBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0)} MB`;
  return `${(b / 1073741824).toFixed(1)} GB`;
};

export function useDownloads({ owner, loader }) {
  const supported = store.offlineSupported();
  const [items, setItems] = useState({});
  const itemsRef = useRef({}); itemsRef.current = items;
  const [ready, setReady] = useState(false);
  const urls = useRef(new Map());          // lessonId → local media items carrying object urls
  const stale = useRef([]);                // urls a newer copy replaced: a page still showing them keeps them until unmount
  const inFlight = useRef(new Set());
  const controllers = useRef(new Map());   // lessonId → the AbortController of the save in the air
  const persistAsked = useRef(false);

  const revoke = (id) => { const list = urls.current.get(id); if (list) { list.forEach((m) => { try { URL.revokeObjectURL(m.url); } catch (e) { /* fine */ } }); urls.current.delete(id); } };

  /* what is on the phone for this account */
  useEffect(() => {
    let on = true;
    setReady(false);
    urls.current.forEach((_, id) => revoke(id));
    if (!owner || !supported) { setItems({}); setReady(true); return undefined; }
    store.listSaved(owner).then((rows) => {
      if (!on) return;
      const next = {};
      (rows || []).forEach((r) => { next[r.id] = { id: r.id, status: "saved", progress: 1, bytes: r.bytes || 0, savedAt: r.savedAt || 0, error: null, record: r, lesson: r.lesson || null }; });
      setItems(next); setReady(true);
    }).catch(() => { if (on) { setItems({}); setReady(true); } });
    return () => { on = false; };
  }, [owner, supported]);
  useEffect(() => () => { urls.current.forEach((_, id) => revoke(id)); stale.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* fine */ } }); stale.current = []; }, []);

  const patch = (id, p) => setItems((m) => ({ ...m, [id]: { ...(m[id] || { id, status: null, progress: 0, bytes: 0, savedAt: 0, error: null, record: null }), ...p } }));

  /* save (or update) one lesson: the files first, then the record */
  const save = useCallback(async (lesson, extras = {}) => {
    if (!lesson || lesson.id == null) return { error: "No lesson" };
    const id = String(lesson.id);
    if (!supported) return { error: "Downloads aren't available in this browser" };
    if (!owner || !loader) return { error: "Not signed in" };
    if (inFlight.current.has(id)) return { busy: true };
    inFlight.current.add(id);
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ac) controllers.current.set(id, ac);
    if (!persistAsked.current) { persistAsked.current = true; store.requestPersist(); }
    const before = (itemsRef.current[id] && itemsRef.current[id].record) || null;
    patch(id, { status: "saving", progress: 0, error: null, lesson: plain(lesson) });
    try {
      const count = lesson.media ?? lesson.videos ?? 0;
      const media = count > 0 ? await loader(lesson.id, count) : [];
      const list = media || [];
      if (list.some((m) => !m.url)) throw new Error("A file could not be reached");
      const have = new Set(await store.fileKeysFor(id));
      const sizes = {}, dones = {};
      let lastTick = 0;
      const report = (force) => {
        const now = Date.now(); if (!force && now - lastTick < 90) return; lastTick = now;
        const tot = Object.values(sizes).reduce((a, b) => a + b, 0);
        const done = Object.values(dones).reduce((a, b) => a + b, 0);
        const landed = Object.keys(dones).filter((k) => sizes[k] && dones[k] >= sizes[k]).length;
        patch(id, { progress: tot > 0 ? Math.min(0.99, done / tot) : (list.length ? landed / list.length : 0.5) });
      };
      const files = await Promise.all(list.map(async (m) => {
        const key = `${id}/${m.id}`;
        if (have.has(key)) {
          const f = await store.getFile(key);
          if (f && f.blob) { sizes[key] = f.size || f.blob.size; dones[key] = sizes[key]; report(true); return { key, id: m.id, type: m.type, name: m.name || "", size: sizes[key] }; }
        }
        const blob = await fetchBlob(m.url, (got, total) => { if (total) sizes[key] = total; dones[key] = got; report(false); }, ac ? ac.signal : undefined);
        sizes[key] = blob.size; dones[key] = blob.size;
        await store.putFile({ key, lessonId: id, blob, type: m.type, name: m.name || "", size: blob.size });
        report(true);
        return { key, id: m.id, type: m.type, name: m.name || "", size: blob.size };
      }));
      /* an update: files no longer on the lesson go */
      const keep = new Set(files.map((f) => f.key));
      for (const k of have) if (!keep.has(k)) await store.removeFile(k);
      const record = { id, owner, savedAt: Date.now(), bytes: files.reduce((a, f) => a + (f.size || 0), 0), lesson: plain(lesson), ...(plain(extras) || {}), files };
      await store.putSaved(record);
      /* the next reader gets the newer files; a lesson page already open
         on the old urls keeps them (revoking now would break its clip) */
      const old = urls.current.get(id);
      if (old) { stale.current.push(...old.map((m) => m.url)); urls.current.delete(id); }
      patch(id, { status: "saved", progress: 1, bytes: record.bytes, savedAt: record.savedAt, error: null, record });
      return { ok: true, record };
    } catch (e) {
      if (e && e.name === "AbortError") {
        /* cancelled: an update keeps the copy that was there; a first
           download leaves nothing behind */
        if (before) patch(id, { status: "saved", progress: 1, error: null, record: before });
        else { try { await store.removeSaved(id); } catch (x) { /* fine */ } setItems((m) => { const n = { ...m }; delete n[id]; return n; }); }
        return { cancelled: true };
      }
      const msg = (e && e.message) || "";
      const why = (typeof navigator !== "undefined" && navigator.onLine === false) || NET_RE.test(msg) ? "No connection"
        : /quota/i.test(msg) || (e && e.name === "QuotaExceededError") ? "Not enough space on this phone"
        : /^HTTP \d{3}$/.test(msg) ? "A file could not be fetched"
        : (msg || "The download failed");
      /* a failed update keeps the copy that was there */
      if (before) patch(id, { status: "saved", progress: 1, error: why, record: before });
      else patch(id, { status: "failed", progress: 0, error: why });
      return { error: why };
    } finally {
      inFlight.current.delete(id);
      controllers.current.delete(id);
    }
  }, [owner, supported, loader]);
  /* a save in the air, stopped */
  const cancel = useCallback((id) => { const ac = controllers.current.get(String(id)); if (ac) ac.abort(); }, []);

  const remove = useCallback(async (id) => {
    const k = String(id);
    revoke(k);
    try { await store.removeSaved(k); } catch (e) { /* the row is dropped from the list either way */ }
    setItems((m) => { const n = { ...m }; delete n[k]; return n; });
  }, []);
  const removeAll = useCallback(async () => {
    const ids = Object.keys(itemsRef.current);
    for (const id of ids) await remove(id);
  }, [remove]);

  /* the lesson's files from the phone, as object urls, in the order the
     record keeps them — the same shape the network loader returns */
  const mediaOf = useCallback(async (id) => {
    const k = String(id);
    const hit = urls.current.get(k); if (hit) return hit;
    const rec = (itemsRef.current[k] && itemsRef.current[k].record) || await store.getSaved(k);
    if (!rec) return [];
    const files = await store.filesFor(k);
    const byKey = Object.fromEntries(files.map((f) => [f.key, f]));
    const list = (rec.files || []).map((f) => {
      const row = byKey[f.key]; if (!row || !row.blob) return null;
      return { id: f.id, type: f.type, kind: f.type, name: f.name || "", url: URL.createObjectURL(row.blob), size: row.size || row.blob.size, local: true };
    }).filter(Boolean);
    urls.current.set(k, list);
    return list;
  }, []);

  const state = useCallback((id) => (id == null ? null : (itemsRef.current[String(id)] || null)), []);
  const record = useCallback((id) => { const it = id == null ? null : itemsRef.current[String(id)]; return it && it.record ? it.record : null; }, []);
  const has = useCallback((id) => { const it = id == null ? null : itemsRef.current[String(id)]; return !!(it && it.status === "saved"); }, []);

  const list = useMemo(() => Object.values(items).sort((a, b) => {
    const rank = (x) => (x.status === "saving" ? 0 : x.status === "failed" ? 1 : 2);
    return rank(a) - rank(b) || (b.savedAt || 0) - (a.savedAt || 0);
  }), [items]);
  const totals = useMemo(() => {
    const saved = Object.values(items).filter((x) => x.status === "saved");
    return { count: saved.length, bytes: saved.reduce((a, x) => a + (x.bytes || 0), 0), saving: Object.values(items).filter((x) => x.status === "saving").length };
  }, [items]);

  return { supported, ready, items, list, totals, state, has, record, save, cancel, remove, removeAll, mediaOf };
}
