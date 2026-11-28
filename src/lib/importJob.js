/* THE IMPORT'S JOB STORE (docs/import/SPEC.md). Eager and tiny, so the
 * parts of the app that must know whether an import is running — Sync,
 * the reload to a newer build, Today's banner, Settings' row — can ask
 * without loading the import's own chunk (src/lib/chatImport, lazy). The
 * Import screen reads it with useSyncExternalStore, so Back, a tab away
 * and a return all find the job where it was; the chunk's runner writes
 * it. Nothing here touches the network or the phone's storage.
 *
 * The job, while there is one: { phase, ... } — phase is "found" (read,
 * nothing sent), "sorting", "review", "uploading", "paused" or "done".
 */
let state = null;
const subs = new Set();

export const importJob = {
  get: () => state,
  set: (next) => {
    state = typeof next === "function" ? next(state) : next;
    subs.forEach((f) => { try { f(); } catch (e) { /* a reader's own fault */ } });
  },
  subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
};

/* sorting or writing: a reload now would lose the File the job reads from */
export const importBusy = () => !!(state && (state.phase === "sorting" || state.phase === "uploading"));
