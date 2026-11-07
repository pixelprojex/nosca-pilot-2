/* The phone's store. Everything the app writes goes through here:
 * outfits, what was worn when, and edits to items. For now it is
 * localStorage under one key; the same interface will sit on Supabase
 * once the project is chosen, so no screen has to change.
 */
import { useSyncExternalStore } from "react";

const KEY = "life.v1";
const EMPTY = { outfits: [], wears: [], items: {} };

let state = read();
const subs = new Set();

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }; }
  catch { return { ...EMPTY }; }
}
function write(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked: the screen still shows it */ }
  subs.forEach(fn => fn());
}

export function useStore() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => state, () => state);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);

export const store = {
  saveOutfit(outfit) {
    const list = state.outfits.filter(o => o.id !== outfit.id);
    write({ ...state, outfits: [{ ...outfit, updatedAt: new Date().toISOString() }, ...list] });
  },
  removeOutfit(id) { write({ ...state, outfits: state.outfits.filter(o => o.id !== id) }); },
  wear(itemIds, outfitId = null) {
    const day = today();
    const rest = state.wears.filter(w => !(w.day === day && w.outfitId === outfitId && !outfitId));
    write({ ...state, wears: [{ id: uid(), day, itemIds, outfitId }, ...rest].slice(0, 2000) });
  },
  unwearToday(itemId) {
    const day = today();
    write({ ...state, wears: state.wears.map(w => w.day === day ? { ...w, itemIds: w.itemIds.filter(i => i !== itemId) } : w).filter(w => w.itemIds.length) });
  },
  patchItem(id, patch) { write({ ...state, items: { ...state.items, [id]: { ...(state.items[id] || {}), ...patch } } }); },
};

/** Wears of an item: count and the last day. */
export function wornStats(wears, itemId) {
  let n = 0, last = null;
  for (const w of wears) if (w.itemIds.includes(itemId)) { n++; if (!last || w.day > last) last = w.day; }
  return { n, last };
}
export function wornToday(wears, itemId) {
  const day = today();
  return wears.some(w => w.day === day && w.itemIds.includes(itemId));
}
