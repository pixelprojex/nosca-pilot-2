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
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* database row -> the shape the interface already speaks */
const toLesson = (r) => {
  const dt = new Date(r.lesson_date);
  return {
    id: r.id,
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
    coach: r.coach_name,
    date: `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`,
    iso: r.lesson_date,
    ratingRequested: !!r.rating_requested,
  };
};

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
  const [guardianName, setGuardianName] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [family, setFamily] = useState([]);
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
  const mediaCache = useRef(new Map());          // lesson id -> { at, items }

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
      const [pRes, lRes, dRes, tRes, sRes, bRes, cRes, rRes, prRes, mRes, rvRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, sport, invite_code, family_code, guardian_id, coach_id, date_of_birth, created_at"),
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
      ]);

      const people = pRes.data || [];

      /* Fetch our own row directly — the general people list only
         contains rows RLS lets us see (our players, our coach), and
         our own row may not be in it when we have no connections yet.
         A direct .eq("id", profile.id) always works. */
      const { data: me } = await supabase.from("profiles")
        .select("invite_code, family_code, coach_id, guardian_id")
        .eq("id", profile.id)
        .maybeSingle();
      setInviteCode(me?.invite_code || null);
      setFamilyCode(me?.family_code || null);
      if (me) setLinks({ coach: me.coach_id || null, guardian: me.guardian_id || null });
      /* everyone who points at me as their guardian — with who coaches
         them, because a guardian writes to that coach on their behalf */
      setFamily(people.filter((x) => x.guardian_id === profile.id).map((x) => ({
        id: x.id, name: x.name,
        sport: x.sport || null,
        dateOfBirth: x.date_of_birth || null,
        coachId: x.coach_id || null,
        coachName: (people.find((p) => p.id === x.coach_id) || {}).name || null,
      })));

      /* The hours a player can book into are their coach's, and the
         coach's preferences row is otherwise theirs alone — so this
         comes through a function that returns just that. A project
         whose nosca.sql predates it answers with an error; that reads
         as "nothing set yet", which is the honest answer either way. */
      if (!isCoach) {
        const { data: hours, error: hoursErr } = await supabase.rpc("coach_availability");
        setCoachAvailability(hoursErr ? {} : (hours || {}));
      }

      /* A player needs their coach's real name. Row-level security means
         the coach's own row is visible to them, so it comes back here.
         Looked up by the id on their own row, not "any coach in the
         list" — a guardian or a family member's coach can be visible
         too, and neither of those is this person's coach. */
      const theCoach = me?.coach_id ? people.find((x) => x.id === me.coach_id) : null;
      setCoachName(theCoach?.name || null);
      /* likewise the guardian's — their row is visible for the same reason */
      const theGuardian = me?.guardian_id ? people.find((x) => x.id === me.guardian_id) : null;
      setGuardianName(theGuardian?.name || null);

      /* the coach sees their players; a player sees only themselves */
      const players = people.filter((x) => x.role === "player");
      setRoster(players.map((p) => ({
        id: p.id,
        name: p.name,
        lessons: (lRes.data || []).filter((l) => l.player_id === p.id).length,
        since: new Date(p.created_at).toLocaleDateString("en-IE", { month: "short", year: "numeric" }),
      })));

      setLessons((lRes.data || []).map(toLesson));
      setDrills((dRes.data || []).map((d) => ({ id: d.id, t: d.title, done: d.done, playerId: d.player_id })));
      setTips((tRes.data || []).map((t) => ({
        id: t.id, title: t.title, body: t.body, focus: null, playerId: t.player_id,
      })));

      /* attendance: keyed the way the interface expects */
      const sessions = sRes.data || [];
      if (sessions.length) {
        const { data: marks } = await supabase
          .from("attendance_marks")
          .select("session_id, player_id, state");
        const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
        const nameById = Object.fromEntries(people.map((p) => [p.id, p.name]));
        const out = {};
        (marks || []).forEach((mk) => {
          const s = byId[mk.session_id];
          if (!s) return;
          const dt = new Date(s.session_date);
          const key = `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]} ${s.label}`;
          out[key] = out[key] || {};
          out[key][nameById[mk.player_id] || "—"] = mk.state;
        });
        setRegisters(out);
      } else {
        setRegisters({});
      }

      /* ---- diary, competitions, recurring, preferences ---- */
      const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));

      /* the diary is keyed "month-day" to match how the agenda looks it up */
      const byDay = {};
      (bRes.data || []).forEach((b) => {
        const dt = new Date(b.booking_date);
        const key = `${dt.getMonth() + 1}-${String(dt.getDate()).padStart(2, "0")}`;
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

      const today = new Date();
      setCompetitions((cRes.data || []).map((c) => {
        const dt = new Date(c.event_date);
        return {
          id: c.id,
          name: c.name,
          kind: c.kind,
          venue: c.venue,
          days: Math.max(0, Math.round((dt - today) / 86400000)),
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
          unread: !msg.read_at && msg.sender_id !== profile.id,
        });
      });
      setThreads(Object.entries(byPlayer).map(([pid, msgs]) => ({
        playerId: pid,
        who: nameOf[pid] || "—",
        messages: msgs,
        unread: msgs.filter((x) => x.unread).length,
        last: msgs[msgs.length - 1]?.body || "",
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

  const logLesson = async ({ who, playerId, groupName, focus, subs, note, files, date, ratingRequested }) => {
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

    for (const f of files || []) {
      const path = `${profile.id}/${lesson.id}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, f);
      if (!upErr) {
        await supabase.from("lesson_media").insert({
          lesson_id: lesson.id,
          kind: f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "photo",
          storage_path: path,
        });
      }
    }
    await load();
    return { lesson };
  };

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
    if (rows.length) await supabase.from("attendance_marks").insert(rows);
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
    const { error } = await supabase.from("bookings").insert({
      coach_id: isCoach ? profile.id : profile.coach_id,
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
      coach_id: isCoach ? profile.id : profile.coach_id,
      player_id: isCoach ? (playerId || null) : profile.id,
      name, kind: kind || null, venue: venue || null, event_date: date,
    });
    if (!error) await load();
    return { error };
  };

  const removeCompetition = async (id) => {
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    if (!error) await load();
    return { error };
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
    const { error } = await supabase.from("recurring").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  /* Preferences are per-person and upserted, so the first save creates
     the row and every later one updates it. */
  const savePrefs = async (patch) => {
    setPrefs((p) => ({ ...(p || {}), ...patch }));          // optimistic
    const { error } = await supabase.from("preferences")
      .upsert({ id: profile.id, ...patch, updated_at: new Date().toISOString() });
    if (error) await load();
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
  const updateProfile = async ({ name, phone, club } = {}) => {
    const patch = {};
    if (name !== undefined) {
      const clean = (name || "").trim();
      if (!clean) return { error: { message: "Your name can't be blank." } };
      patch.name = clean;
    }
    if (phone !== undefined) patch.phone = (phone || "").trim() || null;
    if (club !== undefined) patch.club = (club || "").trim() || null;
    if (!Object.keys(patch).length) return {};
    const { data: rows, error } = await supabase.from("profiles").update(patch).eq("id", profile.id).select("id");
    if (error) return { error: { message: rpcMessage(error, "Couldn't save your details.") } };
    if (!rows || !rows.length) return { error: { message: "Couldn't save your details." } };
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
    const kin = playerId && playerId !== profile.id ? family.find((f) => f.id === playerId) : null;
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
    const { error } = await supabase.from("reviews")
      .upsert({ coach_id: profile.coach_id, player_id: profile.id, rating, comment: comment || null },
              { onConflict: "coach_id,player_id" });
    if (!error) await load();
    return { error };
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
    if (error) return { error: { message: rpcMessage(error, "Couldn't join that coach. Please try again.") } };
    await load();
    return { coach };
  };

  /* Joining a family — identical in shape. Any player can hand out
     their family code; anyone who enters it joins that person's family. */
  const joinFamily = async (rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (clean.length < 4) return { error: { message: "Enter the full code." } };
    const { data: guardian, error } = await supabase.rpc("join_family", { p_code: clean });
    if (error) return { error: { message: rpcMessage(error, "Couldn't join that family. Please try again.") } };
    await load();
    return { guardian };
  };

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
  const lessonMedia = async (lessonId) => {
    const hit = mediaCache.current.get(lessonId);
    if (hit && Date.now() - hit.at < MEDIA_TTL) return hit.items;
    const { data: rows, error } = await supabase.from("lesson_media")
      .select("id, kind, storage_path, created_at").eq("lesson_id", lessonId).order("created_at");
    if (error || !rows || !rows.length) return [];
    const paths = rows.map((m) => m.storage_path);
    const { data: signed } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    const urlFor = (path, i) => {
      const s = (signed || []).find((x) => x.path === path) || (signed || [])[i];
      return s && !s.error ? s.signedUrl : null;
    };
    const items = rows.map((m, i) => ({
      id: m.id,
      type: m.kind,                                   // video · photo · audio
      kind: m.kind,
      url: urlFor(m.storage_path, i),
      name: m.storage_path.split("/").pop().replace(/^\d+-/, ""),
    })).filter((m) => m.url);
    mediaCache.current.set(lessonId, { at: Date.now(), items });
    return items;
  };
  const mediaFor = lessonMedia;

  return {
    loading, loadError, isCoach, inviteCode, coachName, guardianName, familyCode, family,
    roster, lessons, drills, tips, registers,
    bookings, competitions, recurring, prefs, threads,
    reviewSummary, myReview, reviews, coachAvailability,
    reload: load,
    logLesson, setDrill, setDrills: assignDrills, updateDrill, removeDrill, tickDrill, setTip, takeRegister, mediaFor, lessonMedia, requestRating,
    addBooking, addBookings, cancelBooking, confirmBooking,
    addCompetition, removeCompetition,
    addRecurring, removeRecurring,
    savePrefs, saveAvailability, saveGroups, updateProfile, changePassword, sendMessage, broadcast, markRead, submitReview, joinCoach, joinFamily, leaveCoach, leaveFamily, verifyPassword, deleteAccount,
    hasGuardian: links ? !!links.guardian : !!profile?.guardian_id,
    hasCoach: links ? !!links.coach : !!profile?.coach_id,
  };
}
