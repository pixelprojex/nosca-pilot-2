/* THE MOCKED SUPABASE, shared by every script in this folder.
 *
 * Shaped like the real project after supabase/nosca.sql: the tables the
 * app reads (profiles, families, coach_requests, notifications, lessons
 * through lessons_view, lesson_media, drills, tips, attendance,
 * bookings, competitions, recurring, preferences, messages, reviews,
 * push_subscriptions), the RPCs of sections 6, 8 and 9, the sign-up
 * trigger of section 5, the notification triggers of section 10, and
 * the media / avatars buckets.
 *
 * Every read is filtered the way the row-level security policies
 * filter it, from the caller's JWT — a player never receives a row the
 * database would not give them, so a leak the app has is a leak these
 * tests can see. Every write is checked the way the with-check
 * policies check it and answered 403 when it would be refused.
 *
 * Nothing here talks to the network: attach() answers every request to
 * the mock URL inside page.route, and swallows the realtime socket.
 */
const path = require("path");
const { spawn } = require("child_process");

const SB = "https://mock.supabase.co";
const ROOT = path.resolve(__dirname, "../..");
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let seq = 0;
const uuid = (prefix = "40000000") => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code6 = () => { let s = ""; for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; return s; };
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* tiny real files, served for signed and public URLs */
const MP4 = Buffer.from("AAAAGGZ0eXBpc29tAAAAAGlzb21tcDQxAAAACGZyZWU=", "base64");   // ftyp + free boxes
const WEBM = Buffer.from("GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKChHdlYm1Ch4ECQoWBAhhTgGcBAAAAAAAB", "base64");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9Qz8DAwMAAAA0BAgD8A9wJAAAAAElFTkSuQmCC", "base64"); // 2×2

/* the same sum the database's is_junior_of() does */
const yearsOld = (dob, at = Date.now()) => {
  if (!dob) return null;
  const b = new Date(dob), n = new Date(at);
  if (isNaN(b.getTime())) return null;
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a;
};
const juniorRow = (p, at) => !!p && p.role === "player" && (p.account_type === "junior" || (yearsOld(p.date_of_birth, at) != null && yearsOld(p.date_of_birth, at) < 18));

/* ---------------------------------------------------------------- the database */
function emptyDb() {
  return {
    users: {},            // email -> { id, email, password, meta }
    profiles: {},         // id -> row
    families: {},         // id -> { id, code, name, created_by, created_at }
    requests: [],         // coach_requests rows
    notifications: [],
    lessons: [], media: [], drills: [], tips: [], sessions: [], marks: [],
    bookings: [], competitions: [], recurring: [], messages: [], reviews: [], pushSubs: [],
    prefs: {},            // id -> preferences row
    files: { media: {}, avatars: {} },   // bucket -> path -> { size, type }
    /* what happened, for the checks */
    log: [], posts: [], patches: [], deletes: [], rpcs: [], signups: [], emails: [], userPuts: [], auth: [], uploads: [], signed: [],
    /* knobs */
    now: () => Date.now(),
    confirmEmail: false,
    failUpload: null,     // (path) => response spec | null — a way to refuse one upload
    alive: true,
  };
}
const nowIso = (db) => new Date(db.now()).toISOString();

/* ---------------------------------------------------------------- fixtures */
function addUser(db, { id, email, password = "secret12", meta = {} }) { const u = { id, email: email.toLowerCase(), password, meta }; db.users[u.email] = u; return u; }
function addProfile(db, { id, role, name, sport = "golf", type = null, coachId = null, familyId = null, inviteCode = null, dob = null, phone = null, club = null, avatar = null, bio = null, createdAt = null }) {
  const row = { id, role, name, sport, account_type: type || (role === "coach" ? "coach" : null), coach_id: coachId, family_id: familyId, invite_code: role === "coach" ? (inviteCode || code6()) : null,
    date_of_birth: dob, phone, club, avatar_path: avatar, bio, created_at: createdAt || nowIso(db) };
  db.profiles[id] = row; return row;
}
function addFamily(db, { id = uuid("fa000000"), code = code6(), name = null, createdBy = null }) { const f = { id, code, name, created_by: createdBy, created_at: nowIso(db) }; db.families[id] = f; return f; }
function addLesson(db, { id = uuid("1e000000"), coachId, playerId = null, groupName = null, date, focus, subs = [], notes = null, unread = true, ratingRequested = false }) {
  const row = { id, coach_id: coachId, player_id: playerId, group_name: groupName, kind: groupName ? "group" : "private", focus, subs, notes, lesson_date: date, unread, rating_requested: ratingRequested, created_at: `${date}T10:00:00Z` };
  db.lessons.push(row); return row;
}
function addMedia(db, { id = uuid("2e000000"), lessonId, kind, path: p, createdAt }) { const row = { id, lesson_id: lessonId, kind, storage_path: p, created_at: createdAt || nowIso(db) }; db.media.push(row); db.files.media[p] = { size: 10, type: kind }; return row; }
function addRequest(db, { id = uuid("ce000000"), playerId, coachId, status = "pending", createdAt, notify: tell = false }) {
  const row = { id, player_id: playerId, coach_id: coachId, status, created_at: createdAt || nowIso(db), decided_at: status === "pending" ? null : nowIso(db) };
  db.requests.push(row); if (tell) onRequestInsert(db, row); return row;
}
function addNotification(db, { id = uuid("aa000000"), userId, kind, title, body = null, data = {}, readAt = null, createdAt }) {
  const row = { id, user_id: userId, kind, title, body, data, read_at: readAt, created_at: createdAt || nowIso(db) }; db.notifications.push(row); return row;
}
function addBooking(db, { id = uuid("b0000000"), coachId, playerId = null, groupName = null, date, time, duration = 45, status = "confirmed" }) {
  const row = { id, coach_id: coachId, player_id: playerId, group_name: groupName, booking_date: date, start_time: time, duration, kind: groupName ? "group" : "private", status, logged_id: null, created_at: nowIso(db) };
  db.bookings.push(row); return row;
}
function addDrill(db, { id = uuid("d0000000"), coachId, playerId, title, done = false }) { const row = { id, coach_id: coachId, player_id: playerId, title, done, created_at: nowIso(db) }; db.drills.push(row); return row; }
function addMessage(db, { id = uuid("30000000"), coachId, playerId, senderId, body, readAt = null, createdAt }) { const row = { id, coach_id: coachId, player_id: playerId, sender_id: senderId, body, read_at: readAt, created_at: createdAt || nowIso(db) }; db.messages.push(row); return row; }
function setPrefs(db, id, patch) { db.prefs[id] = { id, log_view: "feed", cal_view: "list", notify: "instant", attendance: "all", show_record: true, show_comps: true, reduce_data: false, ask_for_review: true, custom_drills: {}, availability: {}, groups: [], updated_at: nowIso(db), ...(db.prefs[id] || {}), ...patch }; return db.prefs[id]; }

/* a week of hours in the shape the app saves: Monday-first day keys */
const weekOf = (times = ["9:00 am", "10:00 am", "11:00 am", "2:00 pm", "3:00 pm"], days = [0, 1, 2, 3, 4]) =>
  ({ days: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, days.includes(d) ? times : []])), duration: 45, slots: times, blocked: [] });

function session(u, db) {
  const at = db ? db.now() : Date.now();
  const exp = Math.floor(at / 1000) + 86400;
  const token = `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: u.meta || {},
    identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { email: u.email } }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  return { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "rt_" + u.id, user };
}

/* ---------------------------------------------------------------- section 10: telling people */
const nameOf = (db, id) => (db.profiles[id] || {}).name || "Someone";
const firstOf = (db, id) => nameOf(db, id).split(" ")[0];
const niceDate = (iso) => { const d = new Date(iso); return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${pad(d.getDate())} ${MON[d.getMonth()][0] + MON[d.getMonth()].slice(1).toLowerCase()}`; };
const adultsFor = (db, playerId) => { const j = db.profiles[playerId]; if (!j || !j.family_id || !juniorRow(j, db.now())) return []; return Object.values(db.profiles).filter((a) => a.family_id === j.family_id && a.id !== j.id && !juniorRow(a, db.now())).map((a) => a.id); };
function notify(db, userId, kind, title, body, data) { if (!userId) return null; return addNotification(db, { userId, kind, title, body: body || null, data: data || {} }); }

function onLessonInsert(db, l) {
  if (!l.player_id) return;
  notify(db, l.player_id, "lesson", "New lesson logged", `${l.focus} · ${nameOf(db, l.coach_id)}`, { screen: "lesson", id: l.id });
  adultsFor(db, l.player_id).forEach((a) => notify(db, a, "lesson", `${firstOf(db, l.player_id)}'s lesson was logged`, `${l.focus} · ${nameOf(db, l.coach_id)}`, { screen: "family", id: l.id }));
}
function onRequestInsert(db, r) { notify(db, r.coach_id, "request", `${nameOf(db, r.player_id)} asked to join you`, "Tap to accept or decline.", { screen: "requests", id: r.id }); }
function onRequestDecided(db, r) {
  if (r.status === "accepted") notify(db, r.player_id, "accepted", `${nameOf(db, r.coach_id)} accepted you`, "Your lessons, drills and messages start here.", { screen: "home", id: r.id });
  else if (r.status === "declined") notify(db, r.player_id, "declined", `${nameOf(db, r.coach_id)} couldn't take you on`, "You can ask another coach with their code.", { screen: "home", id: r.id });
}
function onBookingInsert(db, b) {
  if (!b.player_id) return;
  const whn = `${niceDate(b.booking_date)} ${b.start_time}`;
  if (b.status === "requested") notify(db, b.coach_id, "booking", `${nameOf(db, b.player_id)} asked for a lesson`, whn, { screen: "today", id: b.id });
  else if (b.status === "confirmed") {
    notify(db, b.player_id, "booking", "Lesson booked", `${whn} · ${nameOf(db, b.coach_id)}`, { screen: "calendar", id: b.id });
    adultsFor(db, b.player_id).forEach((a) => notify(db, a, "booking", `${firstOf(db, b.player_id)} has a lesson booked`, whn, { screen: "family", id: b.id }));
  }
}
function onBookingUpdate(db, b, old, actor) {
  if (!b.player_id || b.status === old.status) return;
  const whn = `${niceDate(b.booking_date)} ${b.start_time}`;
  const tellAdults = (title, body) => adultsFor(db, b.player_id).forEach((a) => notify(db, a, b.status === "weather" ? "weather" : "booking", title, body, { screen: "family", id: b.id }));
  if (b.status === "confirmed") { notify(db, b.player_id, "booking", "Lesson confirmed", `${whn} · ${nameOf(db, b.coach_id)}`, { screen: "calendar", id: b.id }); tellAdults(`${firstOf(db, b.player_id)}'s lesson is confirmed`, whn); }
  else if (b.status === "weather") { notify(db, b.player_id, "weather", "Called off for weather", `${whn} · ${nameOf(db, b.coach_id)}`, { screen: "calendar", id: b.id }); tellAdults(`${firstOf(db, b.player_id)}'s lesson is called off`, `${whn} · weather`); }
  else if (b.status === "cancelled") {
    if (actor === b.coach_id) { notify(db, b.player_id, "booking", "Lesson cancelled", `${whn} · ${nameOf(db, b.coach_id)}`, { screen: "calendar", id: b.id }); tellAdults(`${firstOf(db, b.player_id)}'s lesson is cancelled`, whn); }
    else notify(db, b.coach_id, "booking", `${nameOf(db, b.player_id)} cancelled`, whn, { screen: "calendar", id: b.id });
  }
}
function onMessageInsert(db, m) {
  const snip = String(m.body || "").slice(0, 90);
  if (m.sender_id === m.coach_id) {
    notify(db, m.player_id, "message", nameOf(db, m.coach_id), snip, { screen: "thread", id: m.player_id });
    adultsFor(db, m.player_id).forEach((a) => notify(db, a, "message", `${nameOf(db, m.coach_id)} → ${firstOf(db, m.player_id)}`, snip, { screen: "thread", id: m.player_id }));
  } else notify(db, m.coach_id, "message", nameOf(db, m.sender_id), snip, { screen: "thread", id: m.player_id });
}
function onDrillsInsert(db, rows) {
  const groups = {}; rows.forEach((r) => { (groups[`${r.player_id}|${r.coach_id}`] = groups[`${r.player_id}|${r.coach_id}`] || []).push(r); });
  Object.values(groups).forEach((g) => { const r = g[0], n = g.length;
    notify(db, r.player_id, "drill", n === 1 ? `New drill: ${r.title}` : `${n} new drills`, nameOf(db, r.coach_id), { screen: "practice" });
    adultsFor(db, r.player_id).forEach((a) => notify(db, a, "drill", `${firstOf(db, r.player_id)} has ${n === 1 ? "a new drill" : `${n} new drills`}`, nameOf(db, r.coach_id), { screen: "family" })); });
}
function onTipInsert(db, t) {
  notify(db, t.player_id, "tip", "Something to work on", `${t.title} · ${nameOf(db, t.coach_id)}`, { screen: "tips" });
  adultsFor(db, t.player_id).forEach((a) => notify(db, a, "tip", `${firstOf(db, t.player_id)} has something to work on`, t.title, { screen: "family" }));
}
function onFamilyJoin(db, p) { if (!p.family_id) return; Object.values(db.profiles).filter((m) => m.family_id === p.family_id && m.id !== p.id).forEach((m) => notify(db, m.id, "family", `${p.name} joined your family`, null, { screen: "family" })); }

/* ---------------------------------------------------------------- section 5: the sign-up trigger */
function signupTrigger(db, u) {
  const m = u.meta || {};
  let role = String(m.role || "").trim().toLowerCase(); if (!["coach", "player"].includes(role)) role = "player";
  const name = String(m.name || "").trim() || u.email.split("@")[0];
  const sport = String(m.sport || "").trim().toLowerCase() || "golf";
  let type = String(m.account_type || "").trim().toLowerCase();
  if (role === "coach") type = "coach"; else if (!["adult", "junior", "parent"].includes(type)) type = null;
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(m.date_of_birth || "") ? m.date_of_birth : null;
  const ccode = String(m.coach_code || "").trim().toUpperCase(), fcode = String(m.family_code || "").trim().toUpperCase();
  const coach = role === "player" && ccode ? Object.values(db.profiles).find((p) => p.role === "coach" && String(p.invite_code || "").toUpperCase() === ccode) : null;
  let fam = fcode ? Object.values(db.families).find((f) => f.code === fcode) : null;
  const row = addProfile(db, { id: u.id, role, name, sport, type, dob, phone: String(m.phone || "").trim() || null, familyId: fam ? fam.id : null });
  if (!fam && type === "parent") { fam = addFamily(db, { createdBy: u.id }); row.family_id = fam.id; }
  if (fam) onFamilyJoin(db, row);
  if (coach) addRequest(db, { playerId: u.id, coachId: coach.id, notify: true });
  return row;
}

/* ---------------------------------------------------------------- what the caller may see */
function scopeFor(db, meId) {
  const mine = db.profiles[meId] || null;
  const all = Object.values(db.profiles);
  const at = db.now();
  const famId = mine ? mine.family_id : null;
  const iAmJunior = mine ? juniorRow(mine, at) : false;
  const famOthers = famId ? all.filter((x) => x.family_id === famId && x.id !== meId) : [];
  const looked = iAmJunior ? [] : famOthers.filter((x) => juniorRow(x, at)).map((x) => x.id);       // my_family_ids()
  const lookedCoaches = looked.map((id) => db.profiles[id].coach_id).filter(Boolean);              // my_family_coach_ids()
  const guardians = [];                                                                             // my_players_guardian_ids()
  all.filter((j) => j.coach_id === meId && j.family_id && juniorRow(j, at)).forEach((j) => all.filter((a) => a.family_id === j.family_id && a.id !== j.id && !juniorRow(a, at)).forEach((a) => guardians.push(a.id)));
  /* a coach you asked: while they decide, and for 30 days after a refusal (my_pending_coach_ids) */
  const pendingCoaches = db.requests.filter((r) => r.player_id === meId && (r.status === "pending"
    || (r.status === "declined" && r.decided_at && Date.now() - new Date(r.decided_at) < 30 * 86400000))).map((r) => r.coach_id);
  const requesting = db.requests.filter((r) => r.coach_id === meId && r.status === "pending").map((r) => r.player_id);
  const profileVisible = (x) => !!mine && (x.id === meId || x.coach_id === meId || x.id === mine.coach_id || (!!x.family_id && x.family_id === famId)
    || lookedCoaches.includes(x.id) || guardians.includes(x.id) || pendingCoaches.includes(x.id) || requesting.includes(x.id));
  const playerScope = (pid) => pid === meId || looked.includes(pid);
  const isCoach = !!mine && mine.role === "coach";
  const lessonVisible = (l) => l.coach_id === meId || playerScope(l.player_id) || (l.kind === "group" && !!mine && l.coach_id === mine.coach_id);
  return { mine, famId, iAmJunior, looked, profileVisible, playerScope, isCoach, lessonVisible };
}

/* lessons as the app reads them: the view of section 11 */
function lessonsView(db) {
  return db.lessons.map((l) => {
    const files = db.media.filter((m) => m.lesson_id === l.id);
    const n = (k) => files.filter((m) => m.kind === k).length;
    const d = new Date(l.lesson_date);
    return { ...l, d: pad(d.getDate()), m: MON[d.getMonth()], videos: n("video"), photos: n("photo"), audio: n("audio"), media: files.length,
             who: l.group_name || (db.profiles[l.player_id] || {}).name || null, coach_name: (db.profiles[l.coach_id] || {}).name || null };
  });
}

/* PostgREST filters the app uses: eq, neq, is, in, gt/gte/lt/lte, order, limit */
function applyQuery(rows, url) {
  let out = rows;
  for (const [k, v] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = /^(eq|neq|is|in|gt|gte|lt|lte)\.(.*)$/s.exec(v); if (!m) continue;
    const [, op, raw] = m;
    out = out.filter((r) => {
      const x = r[k];
      if (op === "eq") return String(x) === raw;
      if (op === "neq") return String(x) !== raw;
      if (op === "is") return raw === "null" ? x == null : raw === "true" ? x === true : raw === "false" ? x === false : false;
      if (op === "in") return raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(x));
      if (op === "gt") return x > raw; if (op === "gte") return x >= raw; if (op === "lt") return x < raw; if (op === "lte") return x <= raw;
      return true;
    });
  }
  const order = url.searchParams.get("order");
  if (order) { const [col, dir] = order.split("."); out = out.slice().sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1)); }
  const limit = Number(url.searchParams.get("limit")); if (limit) out = out.slice(0, limit);
  return out;
}

/* storage listing, one level deep, files with ids and folders without */
function listPrefix(files, prefix) {
  const p = (prefix || "").replace(/\/+$/, ""); const seen = new Map();
  Object.keys(files).forEach((full) => {
    if (p && !full.startsWith(p + "/")) return;
    const rest = p ? full.slice(p.length + 1) : full; const [head, ...more] = rest.split("/");
    if (!head) return;
    if (more.length) { if (!seen.has(head)) seen.set(head, { name: head, id: null, updated_at: "2026-01-01T00:00:00Z", metadata: null }); }
    else seen.set(head, { name: head, id: "f-" + Buffer.from(full).toString("hex").slice(0, 16), updated_at: "2026-01-01T00:00:00Z", metadata: { size: files[full].size || 10 } });
  });
  return Array.from(seen.values());
}

/* ---------------------------------------------------------------- the server */
/* Registers the routes; await it before the first navigation. The
   WebSocket route in particular only takes hold once its promise has
   settled — registered and forgotten, the socket goes out to the network. */
async function attach(page, db, opts = {}) {
  await page.route("https://api.fontshare.com/**", (r) => r.abort());
  /* the notifications channel: the app opens a socket the moment it has a
     person; nothing needs to come down it here */
  if (typeof page.routeWebSocket === "function") await page.routeWebSocket(/realtime/, () => {});
  const confirmOn = !!(opts.confirmEmail || db.confirmEmail);

  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method(), hdr = req.headers();
    const json = (status, body, extra = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...extra }, body: body === undefined ? "" : JSON.stringify(body) });
    const bytes = (buf, type) => route.fulfill({ status: 200, contentType: type, headers: { "access-control-allow-origin": "*", "accept-ranges": "bytes" }, body: buf });
    const me = () => { try { return JSON.parse(Buffer.from((hdr["authorization"] || "").replace(/^Bearer\s+/i, "").split(".")[1], "base64url")).sub; } catch { return null; } };
    const body = (() => { try { return JSON.parse(req.postData() || "null"); } catch { return null; } })();
    db.log.push(`${method} ${p}${url.search}`);
    if (method === "OPTIONS") return json(200, undefined);

    /* ---- auth ---- */
    if (p === "/auth/v1/signup" && method === "POST") {
      const email = String(body.email || "").toLowerCase(); db.signups.push(body);
      if (db.users[email]) {
        if (confirmOn) return json(200, { ...session(db.users[email], db).user, identities: [], user_metadata: body.data });
        return json(422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      }
      const u = addUser(db, { id: uuid("00000000"), email, password: body.password, meta: body.data || {} });
      signupTrigger(db, u);
      if (confirmOn) return json(200, { ...session(u, db).user, email_confirmed_at: null });
      return json(200, session(u, db));
    }
    if (p === "/auth/v1/token" && method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") { const u = db.users[String(body.email || "").toLowerCase()]; db.auth.push({ grant, email: body.email, password: body.password });
        if (!u || u.password !== body.password || !db.alive) return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return json(200, session(u, db)); }
      if (grant === "refresh_token") { const u = Object.values(db.users).find((x) => "rt_" + x.id === body.refresh_token); return u ? json(200, session(u, db)) : json(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }); }
    }
    if (p === "/auth/v1/recover" && method === "POST") { db.emails.push({ kind: "recovery", to: String(body.email || "").toLowerCase(), redirectTo: url.searchParams.get("redirect_to") }); return json(200, {}); }
    if (p === "/auth/v1/resend" && method === "POST") { db.emails.push({ kind: body.type || "signup", to: String(body.email || "").toLowerCase() }); return json(200, {}); }
    if (p === "/auth/v1/user" && method === "PUT") { const u = Object.values(db.users).find((x) => x.id === me()); if (!u) return json(401, { msg: "invalid JWT" }); db.userPuts.push(body); db.auth.push({ method: "PUT", body, by: u.id });
      if (body.password) u.password = body.password; if (body.data) u.meta = { ...u.meta, ...body.data }; return json(200, session(u, db).user); }
    if (p === "/auth/v1/user" && method === "GET") { const u = Object.values(db.users).find((x) => x.id === me()); return u && db.alive ? json(200, session(u, db).user) : json(401, { msg: "invalid JWT" }); }
    if (p === "/auth/v1/logout") return json(204, undefined);

    /* ---- storage ---- */
    if (p.startsWith("/storage/v1/")) {
      const rest = p.replace("/storage/v1/object/", "");
      if (rest.startsWith("sign/") && method === "POST") { const bucket = rest.slice(5); const paths = (body && body.paths) || []; db.signed.push(...paths); db.posts.push({ table: "sign", rows: paths, by: me() });
        /* the storage SELECT policy: your own folder, or a file that hangs
           off a lesson you are allowed to see */
        const scope = scopeFor(db, me());
        const canSee = (pth) => {
          if (String(pth).split("/")[0] === me()) return true;
          const row = db.media.find((m) => m.storage_path === pth);
          if (!row) return false;
          const l = db.lessons.find((x) => x.id === row.lesson_id);
          return !!l && scope.lessonVisible(l);
        };
        return json(200, paths.map((pth) => (canSee(pth)
          ? { error: null, path: pth, signedURL: `/object/sign/${bucket}/${pth}?token=t-${pth.split("/").pop()}` }
          : { error: "Either the object does not exist or you do not have access to it", path: pth, signedURL: null }))); }
      if (rest.startsWith("sign/") && method === "GET") { return bytes(/\.mp4$/.test(p) ? MP4 : /\.(webm|m4a)$/.test(p) ? WEBM : PNG, /\.mp4$/.test(p) ? "video/mp4" : /\.(webm|m4a)$/.test(p) ? "audio/webm" : "image/png"); }
      if (rest.startsWith("public/") && method === "GET") return bytes(PNG, "image/png");
      if (rest.startsWith("list/") && method === "POST") { const bucket = rest.slice(5); return json(200, listPrefix(db.files[bucket] || {}, body && body.prefix)); }
      const [bucket, ...more] = rest.split("/"); const objPath = more.join("/");
      if ((method === "DELETE" || (method === "POST" && body && Array.isArray(body.prefixes))) && !objPath) {
        const gone = (body && body.prefixes) || []; gone.forEach((g) => { if (db.files[bucket]) delete db.files[bucket][g]; }); db.deletes.push({ table: "storage:" + bucket, rows: gone, by: me() });
        return json(200, gone.map((n) => ({ name: n }))); }
      if (method === "POST" && objPath) {
        const spec = db.failUpload ? db.failUpload(objPath, bucket) : null;
        db.uploads.push({ bucket, path: objPath, by: me(), refused: !!spec, size: Number(hdr["content-length"] || 0) });
        if (spec) return json(spec.status || 413, spec.body || { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
        /* upsert:false is what Supabase actually does, and modelling it is
           the only reason the suites can catch two files racing to the same
           path — which is exactly how "only one video uploaded" happened. */
        db.files[bucket] = db.files[bucket] || {};
        if (db.files[bucket][objPath] && String(hdr["x-upsert"]) !== "true") {
          db.uploads[db.uploads.length - 1].refused = true;
          return json(409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
        }
        /* the storage INSERT policy: your own folder only */
        if (String(objPath).split("/")[0] !== me()) {
          db.uploads[db.uploads.length - 1].refused = true;
          return json(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
        }
        db.files[bucket][objPath] = { size: Number(hdr["content-length"] || 0), type: hdr["content-type"] || "" };
        db.posts.push({ table: "upload", rows: [p], by: me() });
        return json(200, { Key: `${bucket}/${objPath}`, Id: uuid("f1000000") }); }
      return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    }

    /* ---- rest ---- */
    const wantObject = /vnd\.pgrst\.object\+json/.test(hdr["accept"] || "");
    const respond = (rows) => wantObject ? (rows.length === 1 ? json(200, rows[0]) : json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `Results contain ${rows.length} rows` })) : json(200, rows, { "content-range": `0-${rows.length}/${rows.length}` });
    const created = (rows) => wantObject ? json(201, rows[0]) : json(201, rows);
    const forbidden = () => json(403, { code: "42501", message: "new row violates row-level security policy" });
    const human = (msg) => json(400, { code: "P0001", message: msg, details: null, hint: null });
    const meId = me(); const S = scopeFor(db, meId); const mine = S.mine;
    const table = p.replace("/rest/v1/", "");

    /* ---- sections 6, 8, 9: the functions ---- */
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop(); const args = body || {}; db.rpcs.push({ fn, args, body: args, by: meId });
      const code = String(args.p_code || "").trim().toUpperCase();
      const famName = (f) => f.name || (f.created_by && db.profiles[f.created_by] ? `${firstOf(db, f.created_by)}'s family` : "A family");
      const members = (fid) => Object.values(db.profiles).filter((x) => x.family_id === fid).length;
      if (fn === "find_coach_by_code") { const c = Object.values(db.profiles).find((x) => x.role === "coach" && String(x.invite_code || "").toUpperCase() === code); return json(200, c ? [{ id: c.id, sport: c.sport, name: c.name }] : []); }
      if (fn === "find_family_by_code") { const f = Object.values(db.families).find((x) => x.code === code); return json(200, f ? [{ id: f.id, name: famName(f), members: members(f.id) }] : []); }
      if (!mine) return json(401, { message: "You need to be signed in to do that." });
      if (fn === "join_coach") {
        if (!code) return human("Enter your coach's code.");
        const c = Object.values(db.profiles).find((x) => x.role === "coach" && String(x.invite_code || "").toUpperCase() === code);
        if (!c) return human("That code doesn't match a coach.");
        if (c.id === meId) return human("That's your own code.");
        if (mine.role === "coach") return human("A coach account can't join another coach as a player.");
        if (mine.coach_id === c.id) return human(`You're with ${c.name} already.`);
        if (mine.coach_id) return human("Leave your current coach first — open their profile from Home.");
        if (!db.requests.some((r) => r.player_id === meId && r.coach_id === c.id && r.status === "pending")) addRequest(db, { playerId: meId, coachId: c.id, notify: true });
        return json(200, { id: c.id, name: c.name, sport: c.sport, status: "pending" });
      }
      if (fn === "respond_to_request") {
        const r = db.requests.find((x) => x.id === args.p_id && x.coach_id === meId && x.status === "pending");
        if (!r) return human("That request isn't waiting any more.");
        r.status = args.p_accept ? "accepted" : "declined"; r.decided_at = nowIso(db);
        if (args.p_accept && db.profiles[r.player_id]) db.profiles[r.player_id].coach_id = meId;
        onRequestDecided(db, r); return json(204, undefined);
      }
      if (fn === "cancel_request") { const r = db.requests.find((x) => x.id === args.p_id && x.player_id === meId && x.status === "pending"); if (r) { r.status = "cancelled"; r.decided_at = nowIso(db); } return json(204, undefined); }
      if (fn === "leave_coach") { mine.coach_id = null; return json(204, undefined); }
      if (fn === "create_family") {
        if (mine.family_id) return human("You're in a family already. Leave it first to start another.");
        const f = addFamily(db, { name: String(args.p_name || "").trim() || null, createdBy: meId }); mine.family_id = f.id;
        return json(200, { id: f.id, code: f.code, name: f.name });
      }
      if (fn === "join_family") {
        if (!code) return human("Enter the family code.");
        const f = Object.values(db.families).find((x) => x.code === code);
        if (!f) return human("That code doesn't match a family.");
        if (mine.family_id === f.id) return human("You're in this family already.");
        if (mine.family_id) return human("You're in a family already. Leave it first to join another.");
        mine.family_id = f.id; onFamilyJoin(db, mine);
        return json(200, { id: f.id, code: f.code, name: f.name, members: members(f.id) });
      }
      if (fn === "rename_family") { if (!mine.family_id) return human("You're not in a family."); if (S.iAmJunior) return human("An adult in the family names it."); db.families[mine.family_id].name = String(args.p_name || "").trim() || null; return json(204, undefined); }
      if (fn === "leave_family") { const fid = mine.family_id; mine.family_id = null; if (fid && !members(fid)) delete db.families[fid]; return json(204, undefined); }
      if (fn === "coach_availability") {
        const who = args.p_player; let coachId = null;
        if (!who || who === meId) coachId = mine.coach_id; else if (S.looked.includes(who)) coachId = (db.profiles[who] || {}).coach_id;
        return json(200, (coachId && db.prefs[coachId] && db.prefs[coachId].availability) || {});
      }
      if (fn === "delete_my_account") {
        Object.values(db.profiles).forEach((x) => { if (x.coach_id === meId) x.coach_id = null; });
        const fid = mine.family_id; mine.family_id = null; if (fid && !members(fid)) delete db.families[fid];
        delete db.profiles[meId]; for (const k of Object.keys(db.users)) if (db.users[k].id === meId) delete db.users[k];
        db.alive = false; db.deletes.push({ table: "account", rows: [meId], by: meId }); return json(204, undefined);
      }
      return json(404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
    }

    /* ---- the tables, each behind its policy ---- */
    const stores = {
      profiles: { rows: () => Object.values(db.profiles), see: (x) => S.profileVisible(x) },
      families: { rows: () => Object.values(db.families), see: (x) => x.id === S.famId },
      coach_requests: { rows: () => db.requests, see: (x) => x.player_id === meId || x.coach_id === meId },
      notifications: { rows: () => db.notifications, see: (x) => x.user_id === meId },
      push_subscriptions: { rows: () => db.pushSubs, see: (x) => x.user_id === meId },
      lessons_view: { rows: () => lessonsView(db), see: (x) => S.lessonVisible(x) },
      lessons: { rows: () => db.lessons, see: (x) => S.lessonVisible(x) },
      lesson_media: { rows: () => db.media, see: (x) => { const l = db.lessons.find((y) => y.id === x.lesson_id); return !!l && S.lessonVisible(l); } },
      drills: { rows: () => db.drills, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) },
      tips: { rows: () => db.tips, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) },
      attendance_sessions: { rows: () => db.sessions, see: (x) => x.coach_id === meId || db.marks.some((m) => m.session_id === x.id && S.playerScope(m.player_id)) },
      attendance_marks: { rows: () => db.marks, see: (x) => S.playerScope(x.player_id) || db.sessions.some((s) => s.id === x.session_id && s.coach_id === meId) },
      bookings: { rows: () => db.bookings, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) || (x.kind === "group" && !!mine && x.coach_id === mine.coach_id) },
      competitions: { rows: () => db.competitions, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) },
      recurring: { rows: () => db.recurring, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) },
      preferences: { rows: () => Object.values(db.prefs), see: (x) => x.id === meId },
      messages: { rows: () => db.messages, see: (x) => x.coach_id === meId || S.playerScope(x.player_id) },
      reviews: { rows: () => db.reviews, see: (x) => x.coach_id === meId || x.player_id === meId },
    };
    const st = stores[table];
    if (!st) return json(404, { code: "42P01", message: `relation "public.${table}" does not exist` });
    if (!mine) return json(401, { message: "JWT expired" });
    const visible = () => applyQuery(st.rows().filter(st.see), url);
    const prefer = hdr["prefer"] || "";

    if (method === "GET") return respond(visible());

    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body || {}]).map((r) => ({ ...r }));
      const ok = (r) => {
        if (table === "lessons") return S.isCoach && r.coach_id === meId;
        if (table === "lesson_media") return S.isCoach && db.lessons.some((l) => l.id === r.lesson_id && l.coach_id === meId);
        if (table === "drills" || table === "tips" || table === "recurring" || table === "attendance_sessions") return S.isCoach && r.coach_id === meId;
        if (table === "attendance_marks") return db.sessions.some((s) => s.id === r.session_id && s.coach_id === meId);
        if (table === "bookings") return S.isCoach ? r.coach_id === meId : (!S.iAmJunior && (r.status || "confirmed") === "requested" && (r.player_id === meId || S.looked.includes(r.player_id)) && r.coach_id === (db.profiles[r.player_id] || {}).coach_id);
        if (table === "competitions") return S.isCoach ? r.coach_id === meId : r.player_id === meId;
        if (table === "messages") return r.sender_id === meId && !S.iAmJunior && (S.isCoach ? r.coach_id === meId : (r.player_id === meId || S.looked.includes(r.player_id)) && r.coach_id === (db.profiles[r.player_id] || {}).coach_id);
        if (table === "preferences" || table === "push_subscriptions") return (r.id || r.user_id) === meId;
        if (table === "reviews") return r.player_id === meId && r.coach_id === mine.coach_id;
        if (table === "coach_requests" || table === "notifications" || table === "profiles" || table === "families") return false;   // functions and triggers only
        return false;
      };
      /* the not-null columns the table would refuse before any policy is asked */
      const REQUIRED = { lessons: ["coach_id", "focus"], bookings: ["coach_id", "booking_date", "start_time"], messages: ["coach_id", "player_id", "sender_id", "body"], drills: ["coach_id", "player_id", "title"], tips: ["coach_id", "player_id", "title"], lesson_media: ["lesson_id", "kind", "storage_path"], recurring: ["coach_id", "weekday", "start_time"], competitions: ["name", "event_date"], attendance_sessions: ["coach_id", "label"], attendance_marks: ["session_id", "player_id", "state"], reviews: ["coach_id", "player_id", "rating"] };
      const missing = rows.flatMap((r) => (REQUIRED[table] || []).filter((k) => r[k] == null));
      if (missing.length) { db.posts.push({ table, rows, by: meId, refused: true }); return json(400, { code: "23502", message: `null value in column "${missing[0]}" of relation "${table}" violates not-null constraint`, details: null, hint: null }); }
      if (!rows.every(ok)) { db.posts.push({ table, rows, by: meId, refused: true }); return forbidden(); }
      const made = rows.map((r) => {
        const base = { id: uuid(), created_at: nowIso(db) };
        if (table === "lessons") Object.assign(base, { player_id: null, group_name: null, kind: "private", subs: [], notes: null, lesson_date: ymd(new Date(db.now())), unread: true, rating_requested: false });
        if (table === "bookings") Object.assign(base, { player_id: null, group_name: null, duration: 45, kind: "private", status: "confirmed", logged_id: null });
        if (table === "drills") Object.assign(base, { done: false });
        if (table === "messages") Object.assign(base, { read_at: null });
        if (table === "attendance_sessions") Object.assign(base, { session_date: ymd(new Date(db.now())) });
        return { ...base, ...r };
      });
      if (table === "preferences") { made.forEach((r) => setPrefs(db, r.id, r)); db.posts.push({ table, rows: made, by: meId, prefer }); return created(made.map((r) => db.prefs[r.id])); }
      if (table === "reviews") { made.forEach((r) => { const i = db.reviews.findIndex((x) => x.coach_id === r.coach_id && x.player_id === r.player_id); if (i >= 0 && /merge-duplicates/.test(prefer)) db.reviews[i] = { ...db.reviews[i], ...r, id: db.reviews[i].id }; else db.reviews.push(r); }); db.posts.push({ table, rows: made, by: meId, prefer }); return created(made); }
      if (table === "push_subscriptions") { made.forEach((r) => { const i = db.pushSubs.findIndex((x) => x.endpoint === r.endpoint); if (i >= 0) db.pushSubs[i] = { ...db.pushSubs[i], ...r }; else db.pushSubs.push(r); }); db.posts.push({ table, rows: made, by: meId, prefer }); return created(made); }
      const target = { lessons: db.lessons, lesson_media: db.media, drills: db.drills, tips: db.tips, attendance_sessions: db.sessions, attendance_marks: db.marks, bookings: db.bookings, competitions: db.competitions, recurring: db.recurring, messages: db.messages }[table];
      target.push(...made);
      made.forEach((r) => { if (table === "lesson_media") db.files.media[r.storage_path] = db.files.media[r.storage_path] || { size: 10 }; });
      if (table === "lessons") made.forEach((r) => onLessonInsert(db, r));
      if (table === "bookings") made.forEach((r) => onBookingInsert(db, r));
      if (table === "messages") made.forEach((r) => onMessageInsert(db, r));
      if (table === "drills") onDrillsInsert(db, made);
      if (table === "tips") made.forEach((r) => onTipInsert(db, r));
      db.posts.push({ table, rows: made, by: meId, prefer });
      return created(made);
    }

    if (method === "PATCH") {
      let upd = visible();
      if (table === "profiles") upd = upd.filter((r) => r.id === meId && (body.coach_id === undefined || body.coach_id === r.coach_id) && (body.family_id === undefined || body.family_id === r.family_id));
      if (table === "notifications" || table === "preferences") upd = upd.filter((r) => (r.user_id || r.id) === meId);
      if (table === "drills") upd = upd.filter((r) => r.coach_id === meId || (S.playerScope(r.player_id) && Object.keys(body).every((k) => k === "done")));
      if (table === "bookings") upd = upd.filter((r) => r.coach_id === meId || (S.playerScope(r.player_id) && body.status === "cancelled"));
      if (table === "lessons") upd = upd.filter((r) => r.coach_id === meId);
      if (table === "messages") upd = upd.filter((r) => r.sender_id !== meId);
      const before = upd.map((r) => ({ ...r }));
      upd.forEach((r) => Object.assign(r, body));
      if (table === "bookings") upd.forEach((r, i) => onBookingUpdate(db, r, before[i], meId));
      db.patches.push({ table, query: url.search, body, n: upd.length, by: meId });
      return json(200, upd);
    }

    if (method === "DELETE") {
      let gone = visible();
      if (table === "notifications") gone = gone.filter((r) => r.user_id === meId);
      if (table === "drills" || table === "recurring" || table === "tips") gone = gone.filter((r) => r.coach_id === meId);
      if (table === "competitions") gone = gone.filter((r) => S.isCoach ? r.coach_id === meId : r.player_id === meId);
      if (table === "push_subscriptions") gone = gone.filter((r) => r.user_id === meId);
      const target = { notifications: db.notifications, drills: db.drills, tips: db.tips, recurring: db.recurring, competitions: db.competitions, bookings: db.bookings, push_subscriptions: db.pushSubs, messages: db.messages, lesson_media: db.media, reviews: db.reviews }[table];
      if (target) gone.forEach((r) => { const i = target.indexOf(r); if (i >= 0) target.splice(i, 1); });
      db.deletes.push({ table, query: url.search, rows: gone, by: meId });
      return json(200, gone);
    }
    return json(405, { message: "method not mocked" });
  });
}

/* ---------------------------------------------------------------- the built app */
async function startServer(distDir, port) {
  const child = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("preview server did not start")), 30000); child.stdout.on("data", (d) => { if (String(d).includes("localhost")) { clearTimeout(t); res(); } }); child.stderr.on("data", (d) => process.stderr.write(d)); });
  return child;
}
const stopServer = (child) => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ } try { child.stdout.destroy(); child.stderr.destroy(); } catch { /* fine */ } };

/* ---------------------------------------------------------------- page helpers */
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const rootText = async (page) => norm(await page.evaluate(() => (document.getElementById("root") || {}).innerText || ""));
const rootEmpty = (page) => page.evaluate(() => !document.getElementById("root") || document.getElementById("root").innerHTML.length === 0);
/* the branded opening holds 5.4 s; then the first-run walkthrough and the
   catch-up overlay may sit over the home screen */
const SPLASH_MS = 7200;
async function settle(page, { carryOn = true, wait = SPLASH_MS } = {}) {
  if (wait) await page.waitForTimeout(wait);
  const skip = page.getByText("Skip", { exact: true }); if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(500); }
  if (carryOn) { const co = page.getByRole("button", { name: "Carry on", exact: true }); if (await co.count()) { await co.first().click().catch(() => {}); await page.waitForTimeout(500); } }
}
/* a stored session, so a script starts inside the app without the sign-in screens */
async function injectSession(page, sess, { seen = true } = {}) {
  await page.addInitScript(([key, s, mark]) => { try { localStorage.setItem(key, JSON.stringify(s)); if (mark) localStorage.setItem("nosca.seen." + s.user.id, "1"); } catch { /* private mode */ } }, ["nosca.auth", sess, seen]);
}
/* the tab bar swallows a click that lands within 150 ms of its own
   pointerup, which is exactly what a synthetic tap does — so tabs are
   clicked as the DOM event */
const tap = async (page, sel, wait = 700) => { await page.locator(sel).first().dispatchEvent("click"); await page.waitForTimeout(wait); };
const byText = (page, t) => page.locator("button", { hasText: t }).first();
const click = async (page, t, wait = 800) => { await byText(page, t).click(); await page.waitForTimeout(wait); };
const back = async (page, wait = 700) => { const b = page.locator('[aria-label="Back"]'); if (await b.count()) { await b.first().dispatchEvent("click"); await page.waitForTimeout(wait); } };
const codeBoxes = (page) => page.locator('input[autocapitalize="characters"]');
/* six boxes; the first takes the whole code and the boxes share it out */
const fillCode = async (page, code, from = 0) => { await codeBoxes(page).nth(from).fill(code); await page.waitForTimeout(900); };
const bellCount = async (page) => { const b = page.locator('[aria-label="Alerts"] span'); return (await b.count()) ? Number(norm(await b.first().innerText())) : 0; };

/* PASS / FAIL lines and a summary; every script exits 0 so the lines are read, not the code */
function checker(label) {
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail == null ? "" : String(detail) }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${String(detail).slice(0, 300)}` : ""}`); return !!ok; };
  const summary = () => { const fails = results.filter((r) => !r.ok).length; console.log(`\n${label}: ${results.length - fails}/${results.length} passed`); return { passed: results.length - fails, total: results.length, results }; };
  return { check, results, summary };
}

const SEEDED = ["Ray Doyle", "ray@hollowbrook", "+353 87 123 4567", "Marcus Tran", "Priya Ellis", "Dan Okafor", "Sofia Reyes",
  "Tom Beckett", "Hannah Doyle", "Hollowbrook", "RD4K9P", "TrackMan", "Breathnach", "Summer clinic", "Junior squad", "Ladies group",
  "Captain's Prize", "Club Championship", "Garda", "Safeguarding", "Face-on", "Down the line", "Marcus T.", "Priya E.", "Dan O.", "1284",
  "24 Jul", "Friday 24", "Good session. Most of it went", "Apple Health", "Keep at what we worked on", "Luca Ferri", "Eoin Breathnach", "Niamh Cronin", "Eoin Hayes"];

module.exports = {
  SB, ROOT, b64u, uuid, code6, pad, ymd, MON, MP4, WEBM, PNG, yearsOld, juniorRow,
  emptyDb, addUser, addProfile, addFamily, addLesson, addMedia, addRequest, addNotification, addBooking, addDrill, addMessage, setPrefs, weekOf,
  session, signupTrigger, notify, scopeFor, lessonsView, attach, startServer, stopServer,
  norm, rootText, rootEmpty, SPLASH_MS, settle, injectSession, tap, byText, click, back, codeBoxes, fillCode, bellCount, checker, SEEDED,
};
