import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

/* THE DATA LAYER
 *
 * One hook that loads everything the signed-in person is entitled to
 * see, and exposes the writes they're allowed to make. Row-level
 * security in the database decides what comes back — a player's query
 * and a coach's query are the same code; the database returns
 * different rows.
 *
 * Shapes are converted here, once, to match what the interface already
 * expects (a lesson wants `d`, `m`, `videos`; the database stores a
 * date and a media table). Doing it in one place means no screen needs
 * to know the database exists.
 */

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

/* THE ONE KEY A REGISTER IS FILED AND FOUND UNDER: the day it was
   taken and what it was called — "14 JUN Summer clinic". The reader
   used the lesson's time and name instead, which the writer never
   produces, so a coach who took the roll saw no sign of it the moment
   the sheet closed, and reopening one offered a blank register. Both
   halves call this now. */
export const registerKey = (label, date) => {
  const dt = date instanceof Date ? date : new Date(date);
  return `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]} ${label}`;
};
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* A DATE COLUMN IS A DAY, NOT A MOMENT. "2026-09-08" handed to
   new Date() is midnight UTC, which is the evening of the 7th on any
   phone west of Greenwich — so a lesson, a booking or a birthday moved
   a day for anyone travelling. Split it and build the local day. */
export const localDate = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(ymd);
};

/* Whole years since a date of birth — the same sum the database's
   is_junior_of() does, so the two never disagree about who is a junior. */
export const yearsOld = (dob) => {
  if (!dob) return null;
  const b = localDate(dob), n = new Date();
  if (isNaN(b.getTime())) return null;
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a;
};
const juniorRow = (p) => p.role === "player" && (p.account_type === "junior" || (yearsOld(p.date_of_birth) != null && yearsOld(p.date_of_birth) < 18));

/* Files bigger than this are refused before an upload is even tried,
   with a message that says so. Supabase's default per-file limit is
   50 MB (Project settings → Storage); set VITE_MAX_UPLOAD_MB to match
   if that limit is raised. */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) > 0 ? Number(import.meta.env.VITE_MAX_UPLOAD_MB) : 50;
const mb = (bytes) => `${Math.max(1, Math.round((bytes || 0) / 1048576))} MB`;
const safeName = (name) => (name || "file").normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-80);
/* Six characters of entropy per file. crypto.randomUUID needs a secure
   context and is missing on older Safari, so this falls back. */
const token = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through */ }
  return Math.random().toString(36).slice(2, 10);
};

/* The public address of a profile picture. The bucket is public and
   the path carries the time it was set, so the URL changes when the
   picture does and nothing caches a stale one. */
export const avatarUrl = (path) => path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : null;

/* database row -> the shape the interface already speaks */
const toLesson = (r, attendeeIds = []) => {
  const dt = localDate(r.lesson_date);
  return {
    id: r.id,
    /* who was marked at this group lesson; empty for a private one,
       which carries its single person in playerId */
    attendeeIds,
    focus: r.focus,
    focusId: (r.focus || "").toLowerCase().replace(/\s+/g, ""),
    subs: r.subs || [],
    d: String(dt.getDate()).padStart(2, "0"),
    m: MONTHS[dt.getMonth()],
    type: r.kind === "group" ? "Group" : "Private",
    videos: r.videos || 0,
    /* everything attached, not just clips — a lesson with one photo
       or one voice note still has media to open */
    media: r.media ?? r.videos ?? 0,
    unread: r.unread,
    note: r.notes,
    who: r.who,
    playerId: r.player_id,
    /* who taught it. A coach may also be somebody's player, so "my
       lessons" and "the lessons I gave" are two different lists and
       both are in here. */
    coachId: r.coach_id,
    coach: r.coach_name,
    date: `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`,
    iso: r.lesson_date,
    ratingRequested: !!r.rating_requested,
    createdAt: r.created_at,
  };
};

/* "now", "8m", "14:20", "3 Sep" — how long ago, in as few characters
   as will do. Notifications and message threads both read it, so a
   time never reads one way in the bell and another in Chat. */
const relTime = (iso) => {
  const d = new Date(iso), now = new Date();
  const mins = Math.round((now - d) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24 && d.getDate() === now.getDate()) return d.toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
};

const toNotification = (n) => ({
  id: n.id, kind: n.kind, title: n.title, body: n.body || "", data: n.data || {},
  readAt: n.read_at || null, createdAt: n.created_at,
  when: relTime(n.created_at),
});

/* A signed URL lasts an hour; anything younger than fifty minutes is
   reused rather than signed again, so opening the same lesson twice
   in a session costs one round trip, not two. */
const MEDIA_TTL = 50 * 60 * 1000;

export function useNoscaData(profile) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [roster, setRoster] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [drills, setDrills] = useState([]);
  const [tips, setTips] = useState([]);
  const [registers, setRegisters] = useState({});
  const [bookings, setBookings] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [coachName, setCoachName] = useState(null);
  const [coachSport, setCoachSport] = useState(null);
  /* the family this person is in — { id, code, name, members } — or null */
  const [family, setFamily] = useState(null);
  /* the juniors an adult in the family looks after (empty for a junior,
     or for anyone not in a family) — the people they may book and
     message for */
  const [dependants, setDependants] = useState([]);
  /* their coaches' hours, by junior id, for booking on their behalf */
  const [hoursByPlayer, setHoursByPlayer] = useState({});
  /* people asking to join this coach; and, for a player, the one
     request they have out */
  const [requests, setRequests] = useState([]);
  const [myRequest, setMyRequest] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [me, setMe] = useState(null);           // this person's own row, read fresh
  const [declinedBy, setDeclinedBy] = useState(null);
  const [threads, setThreads] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviews, setReviews] = useState([]);
  /* a player's coach's weekly hours, read through coach_availability() —
     null until it has been asked for, {} when the coach has set nothing */
  const [coachAvailability, setCoachAvailability] = useState(null);
  /* Who this person is linked to, read fresh on every load rather than
     taken from the cached sign-in profile — so joining a coach or a
     family is reflected the moment it is written, with nothing else
     needing to remember to refresh. */
  const [links, setLinks] = useState(null);
  const mediaCache = useRef(new Map());          // lesson id -> { at, count, items }
  const mediaFlight = useRef(new Map());         // lesson id -> the request in the air

  const isCoach = profile?.role === "coach";

  const load = useCallback(async () => {
    if (!profile) return;
    /* `loading` is true only until the first load lands. Every write
       below calls load() again to pick up its own result, and flipping
       loading back on for those would swap the whole interface for a
       "Loading…" screen — unmounting every sheet, every screen and the
       navigation stack — on every save. */
    setLoadError(null);

    try {
      /* Everything in parallel — these are independent queries and the
         database applies the same security to each regardless of order. */
      const [pRes, lRes, dRes, tRes, sRes, bRes, cRes, rRes, prRes, mRes, rvRes, fRes, qRes, nRes, aRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, sport, invite_code, family_id, coach_id, account_type, date_of_birth, avatar_path, bio, club, created_at"),
        supabase.from("lessons_view").select("*").order("lesson_date", { ascending: false }),
        supabase.from("drills").select("*").order("created_at", { ascending: false }),
        supabase.from("tips").select("*").order("created_at", { ascending: false }),
        supabase.from("attendance_sessions").select("id, label, session_date"),
        supabase.from("bookings").select("*").order("booking_date"),
        supabase.from("competitions").select("*").order("event_date"),
        supabase.from("recurring").select("*"),
        supabase.from("preferences").select("*").eq("id", profile.id).maybeSingle(),
        supabase.from("messages").select("*").order("created_at"),
        supabase.from("reviews").select("*"),
        supabase.from("families").select("*"),
        supabase.from("coach_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
        /* Who was at each group lesson. Security hands a coach every row
           of their own lessons and a player only the ones they were at,
           so both sides count the same lesson the same way. */
        supabase.from("lesson_attendees").select("lesson_id, player_id"),
      ]);

      const people = pRes.data || [];
      const personOf = (id) => people.find((x) => x.id === id) || null;

      /* A group lesson carries a name, not a player, so who was there is
         a table of its own. A project whose nosca.sql predates it simply
         answers with an error, and every lesson keeps an empty list —
         the app then behaves exactly as it did before. */
      const attendeesBy = {};
      if (!aRes.error) {
        (aRes.data || []).forEach((a) => {
          (attendeesBy[a.lesson_id] = attendeesBy[a.lesson_id] || []).push(a.player_id);
        });
      }
      const wasAt = (l, pid) => l.player_id === pid || (attendeesBy[l.id] || []).includes(pid);

      /* Fetch our own row directly — the general people list only
         contains rows RLS lets us see (our players, our coach), and
         our own row may not be in it when we have no connections yet.
         A direct .eq("id", profile.id) always works. */
      const { data: mine } = await supabase.from("profiles")
        .select("id, name, role, sport, invite_code, coach_id, family_id, account_type, date_of_birth, avatar_path, bio, club, phone")
        .eq("id", profile.id)
        .maybeSingle();
      setMe(mine || null);
      setInviteCode(mine?.invite_code || null);
      if (mine) setLinks({ coach: mine.coach_id || null, family: mine.family_id || null });
      const iAmJunior = mine ? juniorRow(mine) : false;

      /* The family: its row (security lets only members read it) and
         everyone in it, each marked adult or junior by their own row.
         An adult's dependants are the juniors; a junior has none. */
      const famRow = (fRes.data || []).find((f) => f.id === mine?.family_id) || null;
      const members = famRow ? people.filter((x) => x.family_id === famRow.id).map((x) => ({
        id: x.id, name: x.name, sport: x.sport || null, dateOfBirth: x.date_of_birth || null,
        junior: juniorRow(x), me: x.id === profile.id, avatarPath: x.avatar_path || null,
        coachId: x.coach_id || null, coachName: (personOf(x.coach_id) || {}).name || null, role: x.role,
      })) : [];
      const creator = famRow ? personOf(famRow.created_by) : null;
      setFamily(famRow ? {
        id: famRow.id, code: famRow.code, name: famRow.name || null,
        displayName: famRow.name || (creator ? `${creator.name.split(" ")[0]}'s family` : "Your family"),
        members: members.sort((a, b) => (a.junior === b.junior ? a.name.localeCompare(b.name) : a.junior ? 1 : -1)),
      } : null);
      const kids = !iAmJunior ? members.filter((m) => m.junior && !m.me) : [];
      setDependants(kids);

      /* The hours a player can book into are their coach's, and the
         coach's preferences row is otherwise theirs alone — so this
         comes through a function that returns just that. An adult in a
         family asks the same for each junior they look after. */
      if (!isCoach) {
        const { data: hours, error: hoursErr } = await supabase.rpc("coach_availability");
        setCoachAvailability(hoursErr ? {} : (hours || {}));
      }
      const withCoach = kids.filter((k) => k.coachId);
      if (withCoach.length) {
        const got = await Promise.all(withCoach.map((k) => supabase.rpc("coach_availability", { p_player: k.id })));
        setHoursByPlayer(Object.fromEntries(withCoach.map((k, i) => [k.id, (got[i] && !got[i].error && got[i].data) || {}])));
      } else {
        setHoursByPlayer({});
      }

      /* A player needs their coach's real name. Row-level security means
         the coach's own row is visible to them, so it comes back here.
         Looked up by the id on their own row, not "any coach in the
         list" — a family member's coach can be visible too. */
      const theCoach = mine?.coach_id ? personOf(mine.coach_id) : null;
      setCoachName(theCoach?.name || null);
      setCoachSport(theCoach?.sport || null);

      /* Requests: the ones waiting on this coach, with who is asking;
         or, for a player, the one they have out, with who they asked. */
      const allReq = qRes.data || [];
      setRequests(allReq.filter((r) => r.coach_id === profile.id && r.status === "pending").map((r) => {
        const who = personOf(r.player_id) || {};
        return { id: r.id, playerId: r.player_id, name: who.name || "Someone", sport: who.sport || null,
                 junior: who.id ? juniorRow(who) : false, dateOfBirth: who.date_of_birth || null, createdAt: r.created_at,
                 when: new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" }) };
      }));
      const out = allReq.find((r) => r.player_id === profile.id && r.status === "pending") || null;
      const asked = out ? personOf(out.coach_id) : null;
      setMyRequest(out ? { id: out.id, coachId: out.coach_id, coachName: asked?.name || "your coach", sport: asked?.sport || null, createdAt: out.created_at } : null);
      /* the last answer, so the home screen can say "declined" once */
      const lastAnswer = allReq.find((r) => r.player_id === profile.id && r.status === "declined") || null;
      setDeclinedBy(lastAnswer && !out ? ((personOf(lastAnswer.coach_id) || {}).name || null) : null);

      setNotifications((nRes.data || []).map(toNotification));

      /* the coach sees their players; a player sees only themselves */
      const players = people.filter((x) => x.role === "player" && (isCoach ? x.coach_id === profile.id : true));
      setRoster(players.map((p) => ({
        id: p.id,
        name: p.name,
        sport: p.sport || null,
        junior: juniorRow(p),
        dateOfBirth: p.date_of_birth || null,
        avatarPath: p.avatar_path || null,
        /* the adults in a junior's family, so the coach knows who to speak to */
        guardians: juniorRow(p) && p.family_id
          ? people.filter((a) => a.family_id === p.family_id && a.id !== p.id && !juniorRow(a)).map((a) => a.name)
          : [],
        /* their private lessons AND the group sessions they were marked
           at — the coach's count and the player's own must agree */
        lessons: (lRes.data || []).filter((l) => wasAt(l, p.id)).length,
        lastLesson: (lRes.data || []).filter((l) => wasAt(l, p.id)).map((l) => l.lesson_date).sort().pop() || null,
        since: new Date(p.created_at).toLocaleDateString("en-IE", { month: "short", year: "numeric" }),
      })));

      setLessons((lRes.data || []).map((r) => toLesson(r, attendeesBy[r.id] || [])));
      setDrills((dRes.data || []).map((d) => ({ id: d.id, t: d.title, done: d.done, playerId: d.player_id, createdAt: d.created_at })));
      /* `tips` carries no focus column, so focus stays null and every
         screen that shows it must check first. The date and the age DO
         exist — they were simply never derived, so a tip set in March
         read "Set this week". */
      setTips((tRes.data || []).map((t) => {
        const dt = new Date(t.created_at);
        return {
          id: t.id, title: t.title, body: t.body, focus: null,
          playerId: t.player_id, createdAt: t.created_at,
          date: `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`,
          weeksAgo: Math.max(0, Math.floor((Date.now() - dt.getTime()) / (7 * 86400000))),
        };
      }));

      /* attendance: keyed the way the interface expects */
      const sessions = sRes.data || [];
      if (sessions.length) {
        const { data: marks } = await supabase
          .from("attendance_marks")
          .select("session_id, player_id, state");
        const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
        const out = {};
        (marks || []).forEach((mk) => {
          const s = byId[mk.session_id];
          if (!s) return;
          const key = registerKey(s.label, s.session_date);
          out[key] = out[key] || {};
          /* KEYED BY PLAYER ID. Keyed by display name, two players called
             the same thing wrote into one entry and the second one had
             no record at all. */
          out[key][mk.player_id] = mk.state;
        });
        setRegisters(out);
      } else {
        setRegisters({});
      }

      /* ---- diary, competitions, recurring, preferences ---- */
      const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));

      /* The diary is keyed "month-day" to match how the agenda looks it
         up, which carries no year — so only the rolling window the diary
         can actually show goes in. Without that, last March's lesson
         made next March's date read as booked and hid a free slot. */
      const byDay = {};
      const dayMs = 86400000;
      /* 320 days wide, so no two dates in it can share a month and day */
      const from = new Date(Date.now() - 120 * dayMs), to = new Date(Date.now() + 200 * dayMs);
      const inWindow = (iso) => {
        const [y, m, d] = String(iso || "").split("-").map(Number);
        if (!y) return false;
        const dt = new Date(y, m - 1, d);
        return dt >= from && dt <= to;
      };
      (bRes.data || []).filter((b) => inWindow(b.booking_date)).forEach((b) => {
        const [by, bm, bd] = String(b.booking_date).split("-").map(Number);
        const dt = new Date(by, bm - 1, bd);
        const key = `${bm}-${String(bd).padStart(2, "0")}`;
        (byDay[key] = byDay[key] || []).push({
          id: b.id,
          time: b.start_time,
          who: b.group_name || nameOf[b.player_id] || "—",
          kind: b.kind === "group" ? `Group · ${b.group_name ? "" : ""}`.trim() || "Group" : "Private",
          group: b.kind === "group",
          groupName: b.group_name || null,
          playerId: b.player_id || null,
          status: b.status,
          duration: b.duration,
          date: b.booking_date,
          m: dt.getMonth() + 1,
          d: dt.getDate(),
        });
      });
      setBookings(byDay);

      /* whole days from local midnight, so "tomorrow" is 1 all evening
         and something that has been and gone reads negative rather than
         sitting at zero forever */
      const now0 = new Date();
      const midnight = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
      setCompetitions((cRes.data || []).map((c) => {
        const [cy, cm, cd] = String(c.event_date || "").split("-").map(Number);
        const dt = cy ? new Date(cy, cm - 1, cd) : new Date(c.event_date);
        const days = Math.round((dt - midnight) / 86400000);
        return {
          id: c.id,
          name: c.name,
          kind: c.kind,
          venue: c.venue,
          days,
          past: days < 0,
          date: `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`,
          mine: !c.player_id,                       // the coach's own
          playerId: c.player_id,
        };
      }));

      setRecurring((rRes.data || []).map((r) => ({
        id: r.id,
        who: r.group_name || nameOf[r.player_id] || "—",
        playerId: r.player_id || null,
        groupName: r.group_name || null,
        /* the database counts Sunday as 0; the interface counts Monday
           as 0 — both are carried so neither side has to convert */
        weekday: r.weekday,
        day: (r.weekday + 6) % 7,
        dayName: DAY_NAMES[r.weekday],
        time: r.start_time,
        freq: r.cadence,
        every: r.cadence === "fortnightly" ? "Fortnightly"
             : r.cadence === "monthly" ? "Monthly" : "Weekly",
        until: r.until_date || null,
        ended: false,
      })));

      /* One thread per player, newest last, so a screen can render it
         as a conversation without further work. */
      const byPlayer = {};
      (mRes.data || []).forEach((msg) => {
        (byPlayer[msg.player_id] = byPlayer[msg.player_id] || []).push({
          id: msg.id,
          body: msg.body,
          mine: msg.sender_id === profile.id,
          at: new Date(msg.created_at).toLocaleTimeString("en-IE", { hour: "numeric", minute: "2-digit" }),
          /* the day it was sent, so a thread can put a divider between
             one day and the next rather than saying "Today" over
             everything ever written */
          iso: msg.created_at,
          unread: !msg.read_at && msg.sender_id !== profile.id,
        });
      });
      setThreads(Object.entries(byPlayer).map(([pid, msgs]) => ({
        playerId: pid,
        who: nameOf[pid] || "—",
        messages: msgs,
        unread: msgs.filter((x) => x.unread).length,
        last: msgs[msgs.length - 1]?.body || "",
        /* when the last thing was said. The Chat list rendered an empty
           string here, so every real conversation sat with no time
           against it. */
        when: msgs.length ? relTime(msgs[msgs.length - 1].iso) : "",
      })));

      setPrefs(prRes.data || null);

    /* The coach's standing (an average of everyone who's reviewed
       them), and — for a player — whichever review is their own, so
       the profile screen can show "you already said this" rather than
       a blank form. */
    const allReviews = rvRes.data || [];
    setReviews(allReviews
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment || "",
        playerId: r.player_id,
        who: nameOf[r.player_id] || "—",
        when: new Date(r.created_at).toLocaleDateString("en-IE", { month: "short", year: "numeric" }),
      })));
    setReviewSummary(
      allReviews.length
        ? { count: allReviews.length, average: allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length }
        : null
    );
    setMyReview(!isCoach ? (allReviews.find((r) => r.player_id === profile.id) || null) : null);
    } catch (e) {
      /* Whatever went wrong — a missing table because a migration
         wasn't run, a network failure, anything — the app must be told,
         not left spinning forever with no way out. */
      setLoadError(e && e.message ? e.message : "Couldn't load your data.");
    } finally {
      setLoading(false);
    }
  /* Keyed on the id, not the profile object: the sign-in context hands
     out a new object on every refresh, and reloading all of this each
     time would be wasted work — every write already reloads itself. */
  }, [profile?.id, isCoach]);

  useEffect(() => { load(); }, [load]);

  /* ---------------- writes ---------------- */

  /* What happened to every file attached to any lesson this session —
     shown on the burst, on Today and on the lesson until each one is in
     or given up on.
     { items: [{ key, lessonId, name, size, status: uploading|done|failed, error }] } */
  const [uploads, setUploads] = useState(null);
  const pendingFiles = useRef(new Map());        // name -> File, for Retry

  const uploadOne = async (lessonId, f) => {
    const name = safeName(f.name);
    /* THE PATH MUST BE UNIQUE PER FILE, NOT PER BATCH.
       Promise.all runs every uploadOne body synchronously up to its
       first await, so every file in one publish read the SAME
       Date.now(). The path then differed only by filename — and an
       iPhone names every camera capture "image.jpg" or "video.mp4".
       Three clips recorded in the wizard became three identical paths;
       upsert:false let the first win and 409'd the rest, so exactly one
       clip reached the lesson. That is the "only one video uploaded"
       everyone kept seeing. A per-file token removes the collision
       whatever the files are called. */
    const path = `${profile.id}/${lessonId}/${Date.now()}-${token()}-${name}`;
    if (f.size > MAX_UPLOAD_MB * 1048576) {
      return { error: `${mb(f.size)} — the limit is ${MAX_UPLOAD_MB} MB. Trim the clip and try again.` };
    }
    const { error: upErr } = await supabase.storage.from("media").upload(path, f, {
      contentType: f.type || undefined, cacheControl: "3600", upsert: false,
    });
    if (upErr) {
      const m = String(upErr.message || upErr.error || "");
      const why = /already exists|duplicate|409/i.test(m) ? "A file with that name is already on this lesson."
        : /exceeded|too large|413|maximum/i.test(m) ? `Too big for the storage limit (${MAX_UPLOAD_MB} MB).`
        : /network|fetch|load failed/i.test(m) ? "The connection dropped."
        : /not allowed|policy|row-level|403/i.test(m) ? "Storage refused it — run supabase/nosca.sql again."
        : m || "The upload failed.";
      return { error: why };
    }
    const { error: rowErr } = await supabase.from("lesson_media").insert({
      lesson_id: lessonId,
      kind: f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "photo",
      storage_path: path,
    });
    if (rowErr) return { error: rowErr.message || "Uploaded, but couldn't be attached." };
    return {};
  };

  /* Every file at once, each reporting for itself; the lesson exists
     before the first byte moves, so a failed clip never loses the
     write-up. Anything that fails stays listed with a reason and a
     Retry, rather than quietly vanishing.

     The list spans every lesson, not one. It used to be
     { lessonId, items }: logging a second lesson while the first was
     still uploading threw the first away, and when its files settled
     the write-back was skipped because the id had moved on — a failed
     clip disappeared with no message and no way to retry it. Each item
     now carries its own lesson and its own key. */
  const uploadFiles = async (lessonId, files) => {
    const list = (files || []).filter(Boolean);
    if (!list.length) return { failed: 0 };
    /* One key per FILE. Name and size are not unique — an iPhone hands
       back "image.jpg" for every capture — so two files could share a
       key and both report whatever the first one did. */
    const keys = list.map((f) => f.__noscaKey || (f.__noscaKey = `${lessonId}:${token()}`));
    list.forEach((f, i) => pendingFiles.current.set(keys[i], f));
    /* a retry re-lists only the files it retries; what already landed stays counted */
    const fresh = list.map((f, i) => ({ key: keys[i], lessonId, name: f.name, size: f.size, kind: (f.type || "").split("/")[0], status: "uploading", error: null }));
    setUploads((u) => ({ items: [...(((u && u.items) || []).filter((it) => !keys.includes(it.key))), ...fresh] }));
    const results = await Promise.all(list.map((f) => uploadOne(lessonId, f).catch((e) => ({ error: (e && e.message) || "The upload failed." }))));
    list.forEach((f, i) => { if (!results[i].error) pendingFiles.current.delete(keys[i]); });
    setUploads((u) => {
      if (!u) return u;
      return { items: u.items.map((it) => {
        const i = keys.indexOf(it.key);
        if (i < 0) return it;                       // another lesson's file: leave it alone
        const r = results[i];
        return r.error ? { ...it, status: "failed", error: r.error } : { ...it, status: "done", error: null };
      }) };
    });
    const failed = results.filter((r) => r.error).length;
    mediaCache.current.delete(lessonId);
    await load();
    return { failed };
  };

  /* Everything that failed, wherever it failed, in one press — grouped
     so each lesson's files go up together. */
  const retryUploads = async () => {
    const u = uploads; if (!u || !u.items) return { failed: 0 };
    const byLesson = new Map();
    u.items.filter((it) => it.status === "failed").forEach((it) => {
      const f = pendingFiles.current.get(it.key);
      if (!f) return;
      if (!byLesson.has(it.lessonId)) byLesson.set(it.lessonId, []);
      byLesson.get(it.lessonId).push(f);
    });
    if (!byLesson.size) return { failed: 0 };
    let failed = 0;
    for (const [id, again] of byLesson) {
      const r = await uploadFiles(id, again);
      failed += (r && r.failed) || 0;
    }
    return { failed };
  };
  const dismissUploads = () => { setUploads(null); pendingFiles.current.clear(); };

  const logLesson = async ({ who, playerId, groupName, focus, subs, note, files, date, ratingRequested, attendeeIds }) => {
    const row = {
      coach_id: profile.id,
      player_id: groupName ? null : playerId,
      group_name: groupName || null,
      kind: groupName ? "group" : "private",
      focus,
      subs: subs || [],
      notes: note || null,
      ...(date ? { lesson_date: date } : {}),
    };
    /* Sent only when asked for, so a project whose nosca.sql predates
       the column still logs lessons; if the column is missing the
       lesson is written without the ask rather than not at all. */
    let res = await supabase.from("lessons").insert(ratingRequested ? { ...row, rating_requested: true } : row).select().single();
    if (res.error && ratingRequested && /rating_requested/.test(res.error.message || "")) {
      res = await supabase.from("lessons").insert(row).select().single();
    }
    const { data: lesson, error } = res;
    if (error) return { error };

    /* WHO WAS THERE. A group lesson has no player_id, so without this
       the session counts for nobody: not on the coach's view of each
       player, and not in the players' own logs. Written from the same
       people the coach just picked. A project whose nosca.sql predates
       the table simply fails this insert and everything else stands. */
    const attendees = (attendeeIds || []).filter(Boolean);
    if (groupName && attendees.length) {
      await supabase.from("lesson_attendees")
        .insert(attendees.map((pid) => ({ lesson_id: lesson.id, player_id: pid })));
    }

    const { failed } = await uploadFiles(lesson.id, files);
    if (!(files || []).length) await load();
    return { lesson, failed };
  };

  /* CHANGING A LESSON ALREADY LOGGED

     A coach mistypes a focus, or writes up the wrong day. The policies
     let the lesson's coach change and remove it, so this is the same
     call the write-up makes, on a row that already exists. .select()
     proves a row was really touched — an update the policy refuses
     comes back as success with nothing changed. */
  const updateLesson = async (id, { focus, subs, note, date, playerId, groupName } = {}) => {
    if (!id) return { error: { message: "No lesson to change." } };
    const patch = {};
    if (focus !== undefined) {
      const clean = (focus || "").trim();
      if (!clean) return { error: { message: "A lesson needs a focus." } };
      patch.focus = clean;
    }
    if (subs !== undefined) patch.subs = subs || [];
    if (note !== undefined) patch.notes = (note || "").trim() || null;
    if (date !== undefined && date) patch.lesson_date = date;
    if (playerId !== undefined || groupName !== undefined) {
      patch.player_id = groupName ? null : (playerId || null);
      patch.group_name = groupName || null;
      patch.kind = groupName ? "group" : "private";
    }
    if (!Object.keys(patch).length) return {};
    const { data: rows, error } = await supabase.from("lessons").update(patch).eq("id", id).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't save that lesson.") } };
    if (!rows || !rows.length) return { error: { message: "Couldn't change that lesson." } };
    mediaCache.current.delete(id);
    await load();
    return {};
  };

  /* Removing a lesson takes its files with it. The paths are read
     first, but nothing is deleted from storage until the row is
     actually gone: a failed delete that had already wiped the files
     would leave the lesson on both people's screens with its clips
     destroyed. An orphaned file can be swept up later; footage cannot
     be brought back. */
  const deleteLesson = async (id) => {
    if (!id) return { error: { message: "No lesson to remove." } };
    const { data: media } = await supabase.from("lesson_media").select("storage_path").eq("lesson_id", id);
    const paths = (media || []).map((m) => m.storage_path).filter(Boolean);
    const { data: rows, error } = await supabase.from("lessons").delete().eq("id", id).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't remove that lesson.") } };
    if (!rows || !rows.length) return { error: { message: "Couldn't remove that lesson." } };
    if (paths.length) { try { await supabase.storage.from("media").remove(paths); } catch (e) { /* already gone */ } }
    mediaCache.current.delete(id);
    await load();
    return {};
  };

  /* One file off a lesson: the row and the file behind it. */
  const removeLessonMedia = async (lessonId, mediaId) => {
    const { data: row } = await supabase.from("lesson_media").select("storage_path").eq("id", mediaId).maybeSingle();
    const { data: rows, error } = await supabase.from("lesson_media").delete().eq("id", mediaId).select("id");
    if (error) return { error: { message: error.message } };
    if (!rows || !rows.length) return { error: { message: "Couldn't remove that file." } };
    if (row && row.storage_path) { try { await supabase.storage.from("media").remove([row.storage_path]); } catch (e) { /* already gone */ } }
    mediaCache.current.delete(lessonId);
    await load();
    return {};
  };

  /* More files onto a lesson already logged — the same upload path the
     write-up uses, with the same per-file status and Retry. */
  const addLessonMedia = async (lessonId, files) => uploadFiles(lessonId, files);

  const setDrill = async (playerId, title) => {
    const { error } = await supabase.from("drills")
      .insert({ coach_id: profile.id, player_id: playerId, title });
    if (!error) await load();
    return { error };
  };

  /* several at once — one insert, one reload */
  const assignDrills = async (playerId, titles) => {
    const rows = (titles || []).filter(Boolean).map((title) => ({ coach_id: profile.id, player_id: playerId, title }));
    if (!rows.length) return { error: { message: "Nothing to set." } };
    const { error } = await supabase.from("drills").insert(rows);
    if (!error) await load();
    return { error };
  };

  /* The coach may rename or remove a drill they set; the policies
     allow exactly that. .select() proves a row was actually touched —
     an update the policy refuses returns success and no rows. */
  const updateDrill = async (id, title) => {
    const clean = (title || "").trim();
    if (!clean) return { error: { message: "A drill needs a name." } };
    const { data: rows, error } = await supabase.from("drills").update({ title: clean }).eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't change that drill." } };
    await load();
    return {};
  };

  const removeDrill = async (id) => {
    const { data: rows, error } = await supabase.from("drills").delete().eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't remove that drill." } };
    await load();
    return {};
  };

  const tickDrill = async (id, done) => {
    setDrills((v) => v.map((d) => (d.id === id ? { ...d, done } : d)));  // optimistic
    const { error } = await supabase.from("drills").update({ done }).eq("id", id);
    if (error) await load();                                            // put it back if it failed
    return { error };
  };

  const setTip = async (playerId, title, body) => {
    const { error } = await supabase.from("tips")
      .insert({ coach_id: profile.id, player_id: playerId, title, body: body || null });
    if (!error) await load();
    return { error };
  };

  const takeRegister = async (label, marks) => {
    const { data: session, error } = await supabase.from("attendance_sessions")
      .insert({ coach_id: profile.id, label }).select().single();
    if (error) return { error };
    const rows = Object.entries(marks).map(([playerId, state]) => ({
      session_id: session.id, player_id: playerId, state,
    }));
    if (rows.length) {
      const { error: markErr } = await supabase.from("attendance_marks").insert(rows);
      if (markErr) {
        /* an empty session helps nobody: take it back out and say so */
        await supabase.from("attendance_sessions").delete().eq("id", session.id);
        return { error: { message: "Couldn't save the register. Try again." } };
      }
    }
    await load();
    return { session };
  };

  /* Whole years since a date of birth — kept in step with the same
     calculation in App.jsx so the two can never disagree. */
  const isJunior = (() => {
    if (isCoach || !profile?.date_of_birth) return false;
    const b = new Date(profile.date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
    return age < 18;
  })();

  /* a booking in the diary. A player creating one may only request; the
     database enforces that, so the status is set accordingly here. */
  const addBooking = async ({ playerId, groupName, date, time, duration = 45 }) => {
    if (!isCoach && isJunior) {
      /* The interface already hides this action for a junior; this is
         the second, independent line — reached if it's ever called
         some other way. The database itself is the third and final
         line, in supabase/nosca.sql. */
      return { error: { message: "Booking is arranged by your coach." } };
    }
    const kin = !isCoach && playerId && playerId !== profile.id ? dependants.find((k) => k.id === playerId) : null;
    if (!isCoach && playerId && playerId !== profile.id && !kin) return { error: { message: "You can only book for someone in your family." } };
    if (kin && !kin.coachId) return { error: { message: `${kin.name.split(" ")[0]} has no coach yet.` } };
    const { error } = await supabase.from("bookings").insert({
      coach_id: isCoach ? profile.id : kin ? kin.coachId : ((links && links.coach) || profile.coach_id),
      player_id: groupName ? null : (playerId || (isCoach ? null : profile.id)),
      group_name: groupName || null,
      booking_date: date,
      start_time: time,
      duration,
      kind: groupName ? "group" : "private",
      status: isCoach ? "confirmed" : "requested",
    });
    if (!error) await load();
    return { error };
  };

  /* Several at once — a standing arrangement or a group books its
     whole run in one insert. Coach only: the database refuses a player
     anything but a single request. */
  const addBookings = async (list) => {
    const rows = (list || []).map(({ playerId, groupName, date, time, duration = 45 }) => ({
      coach_id: profile.id,
      player_id: groupName ? null : (playerId || null),
      group_name: groupName || null,
      booking_date: date,
      start_time: time,
      duration,
      kind: groupName ? "group" : "private",
      status: "confirmed",
    }));
    if (!rows.length) return { count: 0 };
    const { data: made, error } = await supabase.from("bookings").insert(rows).select("id");
    if (!error) await load();
    return { error, count: (made || []).length };
  };

  const cancelBooking = async (id, reason = "cancelled") => {
    const { data: rows, error } = await supabase.from("bookings").update({ status: reason }).eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't change that booking." } };
    await load();
    return {};
  };

  /* CALLING OFF AHEAD

     A coach can see Thursday's forecast on Monday. Everything booked on
     that day is called off in one write, with the reason on each row —
     'weather' or a plain cancellation — and the database's own trigger
     tells each player and the adults who look after them. Returns how
     many were called off, so the app can say it rather than guess.

     A day with nothing booked is not an error: it comes back as 0. */
  const callOffDay = async (date, reason = "weather") => {
    if (!date) return { error: { message: "Which day?" } };
    if (!isCoach) return { error: { message: "Only a coach can call a day off." } };
    const { data: rows, error } = await supabase.from("bookings")
      .update({ status: reason })
      .eq("coach_id", profile.id)
      .eq("booking_date", date)
      .in("status", ["confirmed", "requested"])
      .select("id, player_id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't call that day off.") } };
    await load();
    return { count: (rows || []).length };
  };

  /* Several named bookings at once — the pick-and-choose version of
     the above, for a coach calling off one group but not the rest. */
  const callOffBookings = async (ids, reason = "weather") => {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { count: 0 };
    const { data: rows, error } = await supabase.from("bookings")
      .update({ status: reason }).in("id", list).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't call those off.") } };
    await load();
    return { count: (rows || []).length };
  };

  /* Moving a booking rather than losing it: same row, new day or time.
     Coach only — the policies refuse a player anything but a request
     and a cancellation. */
  const moveBooking = async (id, { date, time, duration } = {}) => {
    const patch = {};
    if (date) patch.booking_date = date;
    if (time) patch.start_time = time;
    if (duration) patch.duration = duration;
    if (!Object.keys(patch).length) return {};
    const { data: rows, error } = await supabase.from("bookings").update(patch).eq("id", id).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't move that lesson.") } };
    if (!rows || !rows.length) return { error: { message: "Couldn't move that lesson." } };
    await load();
    return {};
  };

  /* The coach accepts a player's request. */
  const confirmBooking = async (id) => {
    const { data: rows, error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't confirm that booking." } };
    await load();
    return {};
  };

  /* A player adds their own competition; a coach adds one only they see.
     Which it is follows from who is signed in. */
  const addCompetition = async ({ name, kind, venue, date, playerId }) => {
    const { error } = await supabase.from("competitions").insert({
      /* the fresh link, not the cached profile: a player who joined a
         coach this session still has coach_id null on the sign-in row */
      coach_id: isCoach ? profile.id : ((links && links.coach) || profile.coach_id || null),
      player_id: isCoach ? (playerId || null) : profile.id,
      name, kind: kind || null, venue: venue || null, event_date: date,
    });
    if (!error) await load();
    return { error };
  };

  const removeCompetition = async (id) => {
    const { data: rows, error } = await supabase.from("competitions").delete().eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't remove that." } };
    await load();
    return {};
  };

  const addRecurring = async ({ playerId, groupName, weekday, time, cadence = "weekly" }) => {
    const { error } = await supabase.from("recurring").insert({
      coach_id: profile.id,
      player_id: groupName ? null : playerId,
      group_name: groupName || null,
      weekday, start_time: time, cadence,
    });
    if (!error) await load();
    return { error };
  };

  const removeRecurring = async (id) => {
    const { data: rows, error } = await supabase.from("recurring").delete().eq("id", id).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't end that arrangement." } };
    await load();
    return {};
  };

  /* Preferences are per-person and upserted, so the first save creates
     the row and every later one updates it. */
  const savePrefs = async (patch) => {
    /* The first save creates the row, so until it is read back the
       optimistic object holds only the fields just written — read the
       whole row once so nothing downstream sees a half-filled one. */
    const first = !prefs;
    setPrefs((p) => ({ ...(p || {}), ...patch }));          // optimistic
    const { error } = await supabase.from("preferences")
      .upsert({ id: profile.id, ...patch, updated_at: new Date().toISOString() });
    if (error || first) await load();
    return { error };
  };

  /* A coach's weekly hours and their groups live on their preferences
     row as JSON — the whole value each time, so what is saved is
     exactly what the screen showed. */
  const saveAvailability = (availability) => savePrefs({ availability: availability || {} });
  const saveGroups = (groups) => savePrefs({ groups: groups || [] });

  /* Name, phone and club are the person's own to change. .select()
     proves the row changed — an update the policy refuses comes back
     as success with no rows. The cached sign-in profile is refreshed
     by the caller (App.jsx) so the header follows. */
  const updateProfile = async ({ name, phone, club, bio, sport, dateOfBirth } = {}) => {
    const patch = {};
    if (name !== undefined) {
      const clean = (name || "").trim();
      if (!clean) return { error: { message: "Your name can't be blank." } };
      patch.name = clean;
    }
    if (phone !== undefined) patch.phone = (phone || "").trim() || null;
    if (club !== undefined) patch.club = (club || "").trim() || null;
    if (bio !== undefined) patch.bio = (bio || "").trim().slice(0, 280) || null;
    if (sport !== undefined && sport) patch.sport = sport;
    if (dateOfBirth !== undefined) {
      if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return { error: { message: "That date isn't right." } };
      patch.date_of_birth = dateOfBirth || null;
    }
    if (!Object.keys(patch).length) return {};
    const { data: rows, error } = await supabase.from("profiles").update(patch).eq("id", profile.id).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't save your details.") } };
    if (!rows || !rows.length) return { error: { message: "Couldn't save your details." } };
    await load();
    return {};
  };

  /* A profile picture: squared and shrunk on the device, so a phone
     photo of several megabytes lands as a small JPEG; put in the
     public avatars bucket under this account's own id, with the time
     in the name so the address changes when the picture does. */
  const shrinkImage = (file, size = 512) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
        const c = document.createElement("canvas"); c.width = size; c.height = size;
        c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
        c.toBlob((blob) => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error("Couldn't read that picture.")); }, "image/jpeg", 0.86);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that picture.")); };
    img.src = url;
  });

  const uploadAvatar = async (file) => {
    if (!file || !file.type.startsWith("image/")) return { error: { message: "Choose a photo." } };
    let blob;
    try { blob = await shrinkImage(file); } catch (e) { return { error: { message: e.message || "Couldn't read that picture." } }; }
    const path = `${profile.id}/avatar-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
    if (upErr) return { error: { message: /not found|bucket/i.test(upErr.message || "") ? "The avatars bucket is missing — run supabase/nosca.sql again." : (upErr.message || "Couldn't save the picture.") } };
    const old = me?.avatar_path || null;
    const { data: rows, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id).select("id");
    if (error || !rows || !rows.length) return { error: { message: (error && error.message) || "Couldn't save the picture." } };
    if (old && old !== path) supabase.storage.from("avatars").remove([old]).catch(() => {});
    await load();
    return { url: avatarUrl(path) };
  };

  const removeAvatar = async () => {
    const old = me?.avatar_path || null;
    const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", profile.id).select("id");
    if (error) return { error: { message: error.message } };
    if (old) supabase.storage.from("avatars").remove([old]).catch(() => {});
    await load();
    return {};
  };

  /* A new password for the signed-in account. Supabase checks the
     session; the length rule here matches the sign-up screen. */
  const changePassword = async (password) => {
    if (!password || password.length < 8) return { error: { message: "Use at least 8 characters." } };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: { message: rpcMessage(error, "Couldn't change your password.") } };
    return {};
  };

  /* A thread is one coach and one player. The coach names the player;
     a player writes in their own thread; a guardian may name someone
     in their family and writes to that person's coach. */
  const threadFor = (playerId) => {
    if (isCoach) return { coach_id: profile.id, player_id: playerId };
    const kin = playerId && playerId !== profile.id ? dependants.find((f) => f.id === playerId) : null;
    if (kin) return { coach_id: kin.coachId, player_id: kin.id };
    return { coach_id: (links && links.coach) || profile.coach_id, player_id: profile.id };
  };

  const sendMessage = async (playerId, body) => {
    if (!isCoach && isJunior) {
      return { error: { message: "Messages with your coach are handled by your parent or guardian." } };
    }
    const { error } = await supabase.from("messages").insert({
      ...threadFor(playerId),
      sender_id: profile.id,
      body,
    });
    if (!error) await load();
    return { error };
  };

  /* One message to every player on the roster, as separate threads —
     each person sees it as a message from their coach, nothing else. */
  const broadcast = async (body) => {
    if (!isCoach) return { error: { message: "Only a coach can message everyone." }, count: 0 };
    const rows = roster.map((r) => ({ coach_id: profile.id, player_id: r.id, sender_id: profile.id, body }));
    if (!rows.length) return { error: { message: "Nobody on your roster yet." }, count: 0 };
    const { data: sent, error } = await supabase.from("messages").insert(rows).select("id");
    if (!error) await load();
    return { error, count: (sent || []).length };
  };

  /* Everything the other side sent in this thread, marked read. Local
     state is updated straight away so the badge clears as the thread
     opens; the database write follows. */
  const markRead = async (playerId) => {
    const th = threads.find((t) => t.playerId === playerId);
    if (!th || !th.unread) return {};
    setThreads((v) => v.map((t) => (t.playerId === playerId
      ? { ...t, unread: 0, messages: t.messages.map((m) => ({ ...m, unread: false })) }
      : t)));
    const { error } = await supabase.from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("player_id", playerId)
      .neq("sender_id", profile.id)
      .is("read_at", null)
      .select("id");
    if (error) await load();
    return { error };
  };

  /* The coach asks, after the fact, for a rating on a lesson already
     logged — the burst's button. .select() proves the row changed. */
  const requestRating = async (lessonId) => {
    if (!lessonId) return { error: { message: "No lesson to ask about." } };
    const { data: rows, error } = await supabase.from("lessons")
      .update({ rating_requested: true }).eq("id", lessonId).select("id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't update that lesson." } };
    setLessons((v) => v.map((l) => (l.id === lessonId ? { ...l, ratingRequested: true } : l)));
    return {};
  };

  /* A player leaves this whenever they choose to, from the coach's
     profile — the same table also holds the one that follows a first
     lesson, when the coach has that switched on. Upserting means
     submitting again simply replaces what was there. */
  const submitReview = async (rating, comment) => {
    const coachId = (links && links.coach) || profile.coach_id;
    if (!coachId) return { error: { message: "You're not with a coach yet." } };
    const { data: rows, error } = await supabase.from("reviews")
      .upsert({ coach_id: coachId, player_id: profile.id, rating, comment: comment || null },
              { onConflict: "coach_id,player_id" }).select("coach_id");
    if (error) return { error };
    if (!rows || !rows.length) return { error: { message: "Couldn't save that review." } };
    await load();
    return {};
  };

  /* The database's own words for what went wrong. join_coach and
     join_family raise plain sentences meant to be shown as they are;
     the two failures that aren't theirs get a sentence of their own. */
  const rpcMessage = (error, fallback) => {
    const m = (error && error.message) || "";
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
    if (error && error.code === "PGRST202") return "The database needs updating. Run supabase/nosca.sql, then try again.";
    return m || fallback;
  };

  /* Who a code belongs to — the same lookups the sign-up screen uses,
     for a join link opened by someone already signed in. {id, name,
     sport} for a coach, {id, name} for a family; null when it matches
     nobody. */
  const lookupCode = async (kind, rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (!clean) return { found: null };
    const { data: rows, error } = await supabase.rpc(kind === "family" ? "find_family_by_code" : "find_coach_by_code", { p_code: clean });
    if (error) return { found: null, error: { message: rpcMessage(error, "Couldn't check that code.") } };
    return { found: (rows && rows[0]) || null };
  };

  /* Joining a coach after the fact — from the empty home screen, or
     from settings. The same code that could have been entered during
     sign-up, doing the same thing. One database call does the lookup
     and the link together and returns {id, name, sport} of the coach,
     or raises a message meant to be shown word for word. The player's
     own sport stays as they chose it — joining links the accounts, it
     doesn't overwrite what the person said they play. */
  const joinCoach = async (rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (clean.length < 4) return { error: { message: "Enter the full code." } };
    const { data: coach, error } = await supabase.rpc("join_coach", { p_code: clean });
    if (error) return { error: { message: rpcMessage(error, "Couldn't ask that coach. Please try again.") } };
    await load();
    /* status is 'pending': the coach has to accept before anything is shared */
    return { coach, pending: true };
  };

  /* The coach's answer to a request. Accepting is what links the player. */
  const respondToRequest = async (id, accept) => {
    const { error } = await supabase.rpc("respond_to_request", { p_id: id, p_accept: !!accept });
    if (error) return { error: { message: rpcMessage(error, "Couldn't answer that request.") } };
    await load();
    return {};
  };

  /* A player withdraws the request they have out. */
  const cancelRequest = async (id) => {
    const { error } = await supabase.rpc("cancel_request", { p_id: id || (myRequest && myRequest.id) });
    if (error) return { error: { message: rpcMessage(error, "Couldn't withdraw that.") } };
    await load();
    return {};
  };

  /* Families are made on purpose. create_family returns the code to
     hand out; join_family takes one. Both raise sentences meant to be
     shown as they are. */
  const createFamily = async (name) => {
    const { data: fam, error } = await supabase.rpc("create_family", { p_name: (name || "").trim() || null });
    if (error) return { error: { message: rpcMessage(error, "Couldn't start a family. Please try again.") } };
    await load();
    return { family: fam };
  };

  const joinFamily = async (rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (clean.length < 4) return { error: { message: "Enter the full code." } };
    const { data: fam, error } = await supabase.rpc("join_family", { p_code: clean });
    if (error) return { error: { message: rpcMessage(error, "Couldn't join that family. Please try again.") } };
    await load();
    return { family: fam };
  };

  const renameFamily = async (name) => {
    const { error } = await supabase.rpc("rename_family", { p_name: (name || "").trim() || null });
    if (error) return { error: { message: rpcMessage(error, "Couldn't rename it.") } };
    await load();
    return {};
  };

  /* Notifications are written only by the database. Here they are
     read, marked read (all at once, when the list is opened, or one by
     one), cleared, and — while the app is open — received the moment
     they land, through the realtime channel. A new one also refreshes
     the data, since it always means something changed. */
  const markNotificationsRead = async (ids) => {
    const target = ids && ids.length ? ids : notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (!target.length) return {};
    const at = new Date().toISOString();
    setNotifications((v) => v.map((n) => (target.includes(n.id) ? { ...n, readAt: at } : n)));
    const { error } = await supabase.from("notifications").update({ read_at: at }).in("id", target).is("read_at", null);
    return { error };
  };

  const clearNotification = async (id) => {
    setNotifications((v) => v.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    return { error };
  };

  const clearNotifications = async () => {
    setNotifications([]);
    const { error } = await supabase.from("notifications").delete().eq("user_id", profile.id);
    return { error };
  };

  /* LIVE BETWEEN DEVICES. A notification arriving refreshed the app, and
     that covered most of what one person does to another — but not a
     coach's own second phone, nor anything that writes no notification:
     a lesson edited, a register taken, hours changed, a drill ticked.
     So the channel now listens to every table a person can read, and
     any change on any of them schedules one refresh. The database
     decides what each person is allowed to hear (RLS applies to
     realtime exactly as it does to a read), so there is nothing to
     filter here — a row that is not theirs never arrives. */
  const reloadTimer = useRef(null);
  useEffect(() => {
    if (!profile?.id || typeof supabase.channel !== "function") return;
    const later = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { reloadTimer.current = null; load(); }, 800);
    };
    let channel;
    try {
      channel = supabase.channel(`live:${profile.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, (payload) => {
          const n = payload && payload.new; if (!n) return;
          setNotifications((v) => (v.some((x) => x.id === n.id) ? v : [toNotification(n), ...v]));
          later();
        });
      for (const table of ["lessons", "bookings", "messages", "coach_requests", "drills", "tips", "attendance_sessions", "profiles", "preferences"]) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, later);
      }
      channel = channel.subscribe();
    } catch (e) { channel = null; }
    return () => { if (channel) { try { supabase.removeChannel(channel); } catch (e) { /* already gone */ } } if (reloadTimer.current) clearTimeout(reloadTimer.current); };
  }, [profile?.id, load]);

  const leaveCoach = async () => {
    const { error } = await supabase.rpc("leave_coach");
    if (error) return { error: { message: rpcMessage(error, "Couldn't leave. Please try again.") } };
    await load();
    return {};
  };

  const leaveFamily = async () => {
    const { error } = await supabase.rpc("leave_family");
    if (error) return { error: { message: rpcMessage(error, "Couldn't leave. Please try again.") } };
    await load();
    return {};
  };

  /* Deletes this account and everything belonging to it, for good.
     Uploaded files go first — storage objects can't be reached once
     their rows are gone — then the database call removes the account
     itself and cascades through every table. */
  const deleteAccount = async () => {
    try {
      /* Files live at <person>/<lesson>/<file>. A storage listing is
         one level deep and removing a folder path deletes nothing, so
         each lesson folder is listed in turn and the full file paths
         are removed. An entry with no id is a folder; one with an id
         is a file. */
      const bucket = supabase.storage.from("media");
      const { data: top } = await bucket.list(profile.id);
      const paths = [];
      for (const entry of top || []) {
        if (entry.id) { paths.push(`${profile.id}/${entry.name}`); continue; }
        const { data: inner } = await bucket.list(`${profile.id}/${entry.name}`);
        for (const f of inner || []) if (f.id) paths.push(`${profile.id}/${entry.name}/${f.name}`);
      }
      if (paths.length) await bucket.remove(paths);
      const pics = supabase.storage.from("avatars");
      const { data: mine } = await pics.list(profile.id);
      const picPaths = (mine || []).filter((f) => f.id).map((f) => `${profile.id}/${f.name}`);
      if (picPaths.length) await pics.remove(picPaths);
    } catch (e) { /* nothing uploaded, or already gone */ }

    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { error: { message: error.message } };
    await supabase.auth.signOut();
    return {};
  };

  /* Verifies the password belongs to this account, by signing in again
     with it. Supabase has no "check password" call, and doing it this
     way means a wrong password is rejected by the server rather than
     by anything the app could be tricked into skipping. */
  const verifyPassword = async (password) => {
    const email = profile?.email || (await supabase.auth.getUser()).data?.user?.email;
    if (!email) return { error: "Couldn't confirm your account." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "That password isn't right." };
    return {};
  };

  /* Everything attached to a lesson, each with a signed URL valid for
     an hour, cached for the session (see MEDIA_TTL). One storage call
     signs the whole set. */
  const lessonMedia = async (lessonId, expected) => {
    const hit = mediaCache.current.get(lessonId);
    /* A hit is only good while the lesson still claims the same number
       of files. The other party adding a clip used to be invisible for
       fifty minutes, because nothing on the reader's side ever cleared
       this — deletes only run on the client that did the write. */
    const stale = hit && expected != null && hit.count != null && hit.count !== expected;
    if (hit && !stale && Date.now() - hit.at < MEDIA_TTL) return hit.items;
    const { data: rows, error } = await supabase.from("lesson_media")
      .select("id, kind, storage_path, created_at").eq("lesson_id", lessonId).order("created_at");
    if (error || !rows || !rows.length) return [];
    const paths = rows.map((m) => m.storage_path);
    const { data: signed, error: signErr } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    const urlFor = (path, i) => {
      const s = (signed || []).find((x) => x.path === path) || (signed || [])[i];
      return s && !s.error ? s.signedUrl : null;
    };
    /* Every row is kept, url or not. A file that would not sign is a
       file the person is told about, not one that quietly disappears. */
    const items = rows.map((m, i) => ({
      id: m.id,
      type: m.kind,                                   // video · photo · audio
      kind: m.kind,
      url: urlFor(m.storage_path, i),
      /* strip the "<millis>-<token>-" the upload prefixes, and the older
         "<millis>-" shape from files stored before that changed */
      name: m.storage_path.split("/").pop().replace(/^\d+-[0-9a-z]{6,8}-/i, "").replace(/^\d+-/, ""),
    }));
    /* Only a complete set is worth remembering; a partial one would be
       served as the truth until the TTL ran out. */
    if (!signErr && items.every((m) => m.url)) {
      /* remember the count we were TOLD to expect, not how many rows we
         found — `expected` falls back to the video count, which is not
         the same number as the file count on a lesson with a photo */
      mediaCache.current.set(lessonId, { at: Date.now(), count: expected == null ? null : expected, items });
    }
    return items;
  };
  /* Two callers can want the same lesson at once — the feed prefetch and
     the lesson the person just opened. Without this they both sign the
     same set, because the cache is only written after the round trip.
     One request in the air per lesson, shared by everyone waiting. */
  const lessonMediaShared = (lessonId, expected) => {
    const flying = mediaFlight.current.get(lessonId);
    if (flying) return flying;
    const hit = mediaCache.current.get(lessonId);
    const stale = hit && expected != null && hit.count != null && hit.count !== expected;
    if (hit && !stale && Date.now() - hit.at < MEDIA_TTL) return Promise.resolve(hit.items);
    const p = lessonMedia(lessonId, expected).finally(() => mediaFlight.current.delete(lessonId));
    mediaFlight.current.set(lessonId, p);
    return p;
  };
  const mediaFor = lessonMediaShared;

  return {
    loading, loadError, isCoach, inviteCode, coachName, coachSport,
    /* the family: { id, code, name, displayName, members } or null; the
       juniors an adult looks after; each one's coach's hours */
    family, dependants, hoursByPlayer,
    /* who is asking to join this coach; the request a player has out;
       who last declined them */
    requests, myRequest, declinedBy,
    notifications, unreadCount: notifications.filter((n) => !n.readAt).length,
    markNotificationsRead, clearNotification, clearNotifications,
    me, avatarUrl: avatarUrl(me?.avatar_path || null), uploadAvatar, removeAvatar,
    uploads, retryUploads, dismissUploads,
    roster, lessons, drills, tips, registers,
    bookings, competitions, recurring, prefs, threads,
    reviewSummary, myReview, reviews, coachAvailability,
    reload: load,
    logLesson, updateLesson, deleteLesson, removeLessonMedia, addLessonMedia,
    setDrill, setDrills: assignDrills, updateDrill, removeDrill, tickDrill, setTip, takeRegister, mediaFor, lessonMedia: lessonMediaShared, requestRating,
    addBooking, addBookings, cancelBooking, confirmBooking, callOffDay, callOffBookings, moveBooking,
    addCompetition, removeCompetition,
    addRecurring, removeRecurring,
    savePrefs, saveAvailability, saveGroups, updateProfile, changePassword, sendMessage, broadcast, markRead, submitReview,
    joinCoach, respondToRequest, cancelRequest, leaveCoach,
    createFamily, joinFamily, renameFamily, leaveFamily,
    verifyPassword, deleteAccount, lookupCode,
    hasFamily: links ? !!links.family : !!profile?.family_id,
    hasCoach: links ? !!links.coach : !!profile?.coach_id,
    /* the ids behind those, so a join link can tell "already with them" apart */
    coachId: links ? links.coach : (profile?.coach_id || null),
    familyId: links ? links.family : (profile?.family_id || null),
  };
}
