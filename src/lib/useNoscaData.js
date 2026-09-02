import { useState, useEffect, useCallback } from "react";
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
    unread: r.unread,
    note: r.notes,
    who: r.who,
    coach: r.coach_name,
    date: `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`,
  };
};

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
  const [familyCode, setFamilyCode] = useState(null);
  const [family, setFamily] = useState([]);
  const [threads, setThreads] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);

  const isCoach = profile?.role === "coach";

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);

    try {
      /* Everything in parallel — these are independent queries and the
         database applies the same security to each regardless of order. */
      const [pRes, lRes, dRes, tRes, sRes, bRes, cRes, rRes, prRes, mRes, rvRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, invite_code, family_code, guardian_id, created_at"),
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
        .select("invite_code, family_code")
        .eq("id", profile.id)
        .maybeSingle();
      setInviteCode(me?.invite_code || null);
      setFamilyCode(me?.family_code || null);
      /* everyone who points at me as their guardian */
      setFamily(people.filter((x) => x.guardian_id === profile.id).map((x) => ({ id: x.id, name: x.name })));

      /* A player needs their coach's real name. Row-level security means
         the coach's own row is visible to them, so it comes back here. */
      const theCoach = people.find((x) => x.role === "coach");
      setCoachName(theCoach?.name || null);

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
          status: b.status,
          duration: b.duration,
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
        day: DAY_NAMES[r.weekday],
        time: r.start_time,
        every: r.cadence === "fortnightly" ? "Fortnightly"
             : r.cadence === "monthly" ? "Monthly" : "Weekly",
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
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  /* ---------------- writes ---------------- */

  const logLesson = async ({ who, playerId, groupName, focus, subs, note, files, date }) => {
    const { data: lesson, error } = await supabase.from("lessons").insert({
      coach_id: profile.id,
      player_id: groupName ? null : playerId,
      group_name: groupName || null,
      kind: groupName ? "group" : "private",
      focus,
      subs: subs || [],
      notes: note || null,
      ...(date ? { lesson_date: date } : {}),
    }).select().single();
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
         line, in migration-005.sql. */
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

  const cancelBooking = async (id, reason = "cancelled") => {
    const { error } = await supabase.from("bookings").update({ status: reason }).eq("id", id);
    if (!error) await load();
    return { error };
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

  const sendMessage = async (playerId, body) => {
    if (!isCoach && isJunior) {
      return { error: { message: "Messages with your coach are handled by your parent or guardian." } };
    }
    const { error } = await supabase.from("messages").insert({
      coach_id: isCoach ? profile.id : profile.coach_id,
      player_id: isCoach ? playerId : profile.id,
      sender_id: profile.id,
      body,
    });
    if (!error) await load();
    return { error };
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

  /* Joining a coach after the fact — from the empty home screen, or
     from settings. The same code that could have been entered during
     sign-up, doing the same thing. */
  const joinCoach = async (rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (clean.length < 4) return { error: { message: "Enter the full code." } };

    const { data: rows, error: findErr } = await supabase.rpc("find_coach_by_code", { p_code: clean });
    if (findErr) return { error: { message: "Couldn't check that code. Try again." } };
    const coach = rows?.[0];
    if (!coach) return { error: { message: "That code doesn't match a coach." } };

    /* The player's own sport stays as they chose it — joining a coach
       links the two accounts, it doesn't overwrite what the person
       said they play. A coach who teaches something else simply
       becomes one of their sports.

       .select() matters here: without it a row blocked by row-level
       security comes back as success with nothing changed, and the
       screen would say "joined" while the account stayed empty. */
    const { data: updated, error } = await supabase.from("profiles")
      .update({ coach_id: coach.id })
      .eq("id", profile.id)
      .select();
    if (error) return { error };
    if (!updated || updated.length === 0) {
      return { error: { message: "Couldn't join that coach. Please try again." } };
    }
    await load();
    return { coach };
  };

  /* Joining a family — identical in shape to joining a coach. Any
     player can hand out their family code; anyone who enters it joins
     that person's family. */
  const joinFamily = async (rawCode) => {
    const clean = (rawCode || "").trim().toUpperCase();
    if (clean.length < 4) return { error: { message: "Enter the full code." } };
    const { data: rows, error: findErr } = await supabase.rpc("find_guardian_by_code", { p_code: clean });
    if (findErr) return { error: { message: "Couldn't check that code. Try again." } };
    const guardian = rows?.[0];
    if (!guardian) return { error: { message: "That code doesn't match a family." } };
    if (guardian.id === profile.id) return { error: { message: "That's your own code." } };
    const { data: updated, error } = await supabase.from("profiles")
      .update({ guardian_id: guardian.id }).eq("id", profile.id).select();
    if (error) return { error };
    if (!updated || updated.length === 0) return { error: { message: "Couldn't join that family. Please try again." } };
    await load();
    return { guardian };
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

  /* a signed URL for a piece of media, valid for an hour */
  const mediaFor = async (lessonId) => {
    const { data } = await supabase.from("lesson_media").select("*").eq("lesson_id", lessonId);
    return Promise.all((data || []).map(async (m) => {
      const { data: signed } = await supabase.storage.from("media").createSignedUrl(m.storage_path, 3600);
      return { type: m.kind, url: signed?.signedUrl, id: m.id };
    }));
  };

  return {
    loading, loadError, isCoach, inviteCode, coachName, familyCode, family,
    roster, lessons, drills, tips, registers,
    bookings, competitions, recurring, prefs, threads,
    reviewSummary, myReview,
    reload: load,
    logLesson, setDrill, tickDrill, setTip, takeRegister, mediaFor,
    addBooking, cancelBooking,
    addCompetition, removeCompetition,
    addRecurring, removeRecurring,
    savePrefs, sendMessage, submitReview, joinCoach, joinFamily, verifyPassword,
    hasGuardian: !!profile?.guardian_id,
    hasCoach: !!profile?.coach_id,
  };
}
