/* A coherent, Irish, believable database for the website's pictures of the app. Every name is made up. One coach
   (Niamh Byrne) and her roster; the same people in every sport, the lessons in that sport's own words
   (SPORTS[x].focus, stages and drills in src/Nosca.jsx). The clock is pinned to Thursday 26 November 2026,
   11:20 am, so a lesson is on now, two are to log and the afternoon is still to come; buildDb(sport, { at }) moves
   the clock within that day (the Partners page's register is shot at 5:10 pm, the clinic on now) and nothing else.
   The shapes are the repository's own mock (scripts/e2e/mock.cjs). */
const M = require("../../../scripts/e2e/mock.cjs");

/* Ireland is on UTC in November, so the clock is written in UTC and read in UTC: the same pictures whatever the
   timezone of the machine that shoots them */
const FIXED = new Date("2026-11-26T11:20:00Z");
const ymd = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const dayFrom = (n) => { const d = new Date(FIXED); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const TODAY = ymd(FIXED);

const IDS = {
  coach: "00000000-0000-4000-8000-00000000c0ac",
  cian: "00000000-0000-4000-8000-0000000c1a01",
  saoirse: "00000000-0000-4000-8000-00000005a0e1",
  orla: "00000000-0000-4000-8000-0000000041a1",
  aoife: "00000000-0000-4000-8000-00000000a0f1",
  darragh: "00000000-0000-4000-8000-00000000da01",
  roisin: "00000000-0000-4000-8000-0000000000e1",
  ciara: "00000000-0000-4000-8000-00000000c1a2",
  tadhg: "00000000-0000-4000-8000-00000000ad01",
  meabh: "00000000-0000-4000-8000-00000000eab1",
  oisin: "00000000-0000-4000-8000-000000000151",
  ellie: "00000000-0000-4000-8000-00000000e111",
};
const FAM = "fa000000-0000-4000-8000-00000000fa01";

/* each sport in its own words */
const SPORT = {
  golf: {
    club: "Hollow Lane GC",
    focus: ["Short game", "Putting", "Full swing", "Chipping", "Pitching", "Bunker play", "On course"],
    cianLevels: ["HI 20.1", "HI 19.4", "HI 18.8", "HI 18.1", "HI 17.6", "HI 16.9", "HI 16.4", "HI 15.8"],
    cianFocus: ["Full swing", "Putting", "Chipping · Putting", "Full swing", "Bunker play", "On course", "Pitching", "Chipping · Putting"],
    junior: "HI 28.4",
    drills: ["Gate drill", "Clock drill", "Towel drill", "Ladder drill"],
    tip: "Quiet hands through the strike",
    note: "Softer grip pressure and the ball came off the face lower and truer. Land it on the towel, let it run.",
    group: "Thursday clinic",
  },
  tennis: {
    club: "Hollow Lane LTC",
    focus: ["Serve", "Forehand", "Backhand", "Net game", "Return", "Movement", "Match play"],
    cianLevels: ["Yellow ball", "Yellow ball", "Yellow ball", "Yellow ball", "Yellow ball", "Yellow ball", "Yellow ball", "Yellow ball"],
    cianFocus: ["Serve", "Forehand", "Serve · Return", "Backhand", "Net game", "Movement", "Match play", "Serve · Forehand"],
    junior: "Green ball · U10",
    drills: ["Serve targets", "Ball toss", "Shadow swings", "Wall rally"],
    tip: "Toss in front, reach up through it",
    note: "Toss is steadier and the second serve has real shape now. Twenty to the T, twenty wide, every day.",
    group: "Thursday clinic",
  },
  rowing: {
    club: "Hollow Lane RC",
    focus: ["Technique", "Rhythm & rating", "Racing", "Erg", "S&C"],
    cianLevels: ["Novice", "Novice", "Club 2", "Club 2", "Club 2", "Club 1", "Club 1", "Club 1"],
    cianFocus: ["Technique", "Erg", "Rhythm & rating", "Technique", "Racing", "Erg", "Rhythm & rating", "Technique · Racing"],
    junior: "J15",
    drills: ["Pause drill", "Square blades", "Roll-ups", "Feet out"],
    tip: "Let the boat run under you",
    note: "Patient on the slide and the catch is sharper. Hold the ratio at rate 20 before we build the pieces.",
    group: "Thursday squad",
  },
  squash: {
    club: "Hollow Lane SC",
    focus: ["Drives", "Volleys", "Front court", "Movement", "Serve & return", "Tactics", "Games"],
    cianLevels: ["Single yellow", "Single yellow", "Single yellow", "Single yellow", "Double yellow", "Double yellow", "Double yellow", "Double yellow"],
    cianFocus: ["Drives", "Movement", "Drives · Volleys", "Front court", "Tactics", "Volleys", "Games", "Drives · Front court"],
    junior: "Red dot",
    drills: ["Straight drives", "Boast and drive", "Drop–drive", "Cross-court length pairs"],
    tip: "Back to the T after every shot",
    note: "Length is landing past the service line now. Volley early when the ball sits up; take it off the side wall.",
    group: "Thursday clinic",
  },
  padel: {
    club: "Hollow Lane Padel",
    focus: ["Net game", "Overheads", "Back wall", "Lob", "Chiquita", "Defence & tactics", "Match play"],
    cianLevels: ["Improver", "Improver", "Improver", "Intermediate", "Intermediate", "Intermediate", "Intermediate", "Intermediate"],
    cianFocus: ["Net game", "Back wall", "Overheads", "Lob", "Net game", "Defence & tactics", "Chiquita", "Overheads · Net game"],
    junior: "Improver",
    drills: ["Bandeja consistency", "Wall volleys", "Back-glass rebounds", "Lob–bandeja rotation"],
    tip: "Bandeja to the corner, then close the net",
    note: "The bandeja is staying low and deep. Let the back glass do the work before you attack.",
    group: "Thursday clinic",
  },
  equestrian: {
    club: "Hollow Lane EC",
    focus: ["Flatwork", "Pole work", "Gridwork", "Showjumping", "Dressage", "Position & seat", "Cross-country"],
    cianLevels: ["Walk & trot", "Walk & trot", "Cantering", "Cantering", "Cantering", "Jumping", "Jumping", "Jumping"],
    cianFocus: ["Flatwork", "Position & seat", "Pole work", "Flatwork", "Gridwork", "Showjumping", "Pole work", "Gridwork · Showjumping"],
    junior: "Cantering",
    drills: ["20m circles", "Transitions every 10 strides", "Trotting poles", "Light seat"],
    tip: "Look up, ride the line to the fence",
    note: "Rhythm held all the way down the grid. Sit up through the turn and keep the leg on to the last pole.",
    group: "Junior jumping",
    horse: "on Bramble",
  },
};

function buildDb(sport = "golf", { at: clock = FIXED } = {}) {
  const S = SPORT[sport];
  const db = M.emptyDb();
  const now = new Date(clock).getTime();
  db.now = () => now;
  const person = (key, email, prof) => { M.addUser(db, { id: IDS[key], email }); return M.addProfile(db, { id: IDS[key], sport, ...prof }); };
  M.addFamily(db, { id: FAM, code: "KEL7Y2", createdBy: IDS.orla });
  person("coach", "niamh@example.ie", { role: "coach", name: "Niamh Byrne", inviteCode: "QW7X2M", club: S.club, createdAt: "2026-03-02T09:00:00Z" });
  person("cian", "cian@example.ie", { role: "player", name: "Cian Murphy", type: "adult", coachId: IDS.coach, dob: "1991-04-04" });
  person("orla", "orla@example.ie", { role: "player", name: "Orla Kelly", type: "parent", familyId: FAM });
  person("saoirse", "saoirse@example.ie", { role: "player", name: "Saoirse Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2014-09-09" });
  person("ellie", "ellie@example.ie", { role: "player", name: "Ellie Kelly", type: "junior", coachId: IDS.coach, familyId: FAM, dob: "2016-05-21" });
  person("aoife", "aoife@example.ie", { role: "player", name: "Aoife Brennan", type: "adult", coachId: IDS.coach, dob: "1988-02-11" });
  person("darragh", "darragh@example.ie", { role: "player", name: "Darragh O'Neill", type: "adult", coachId: IDS.coach, dob: "1979-07-23" });
  person("roisin", "roisin@example.ie", { role: "player", name: "Róisín Walsh", type: "adult", coachId: IDS.coach, dob: "1995-12-01" });
  person("ciara", "ciara@example.ie", { role: "player", name: "Ciara Gallagher", type: "adult", coachId: IDS.coach, dob: "1984-05-30" });
  person("tadhg", "tadhg@example.ie", { role: "player", name: "Tadhg Ryan", type: "adult", coachId: IDS.coach, dob: "1999-10-17" });
  person("meabh", "meabh@example.ie", { role: "player", name: "Méabh Daly", type: "junior", coachId: IDS.coach, dob: "2013-03-14" });
  person("oisin", "oisin@example.ie", { role: "player", name: "Oisín Fitzgerald", type: "junior", coachId: IDS.coach, dob: "2012-06-02" });

  const subsFor = (lvl, extra = []) => [lvl, ...extra, ...(S.horse ? [S.horse] : [])];

  /* Cian's journey: eight lessons over five months, the level falling (or rising) */
  const cianDates = [-182, -158, -136, -112, -84, -56, -28, -7];
  let last = null;
  cianDates.forEach((n, i) => {
    const l = M.addLesson(db, { coachId: IDS.coach, playerId: IDS.cian, date: dayFrom(n), focus: S.cianFocus[i], subs: subsFor(S.cianLevels[i]),
      notes: i === cianDates.length - 1 ? S.note : `${S.cianFocus[i]}. Good work, keep the routine going.`, unread: false });
    if (i === 6) M.addMedia(db, { lessonId: l.id, kind: "video", path: `${IDS.coach}/${l.id}/clip-1.mp4`, createdAt: `${dayFrom(n)}T11:40:00Z` });
    last = l;
  });
  M.addMedia(db, { lessonId: last.id, kind: "video", path: `${IDS.coach}/${last.id}/clip-1.mp4`, createdAt: `${dayFrom(-7)}T11:40:00Z` });
  M.addMedia(db, { lessonId: last.id, kind: "video", path: `${IDS.coach}/${last.id}/clip-2.mp4`, createdAt: `${dayFrom(-7)}T11:41:00Z` });
  /* the register said he was there, all but once */
  cianDates.forEach((n, i) => {
    const sid = `6a000000-0000-4000-8000-0000000000${String(10 + i)}`;
    db.sessions.push({ id: sid, coach_id: IDS.coach, label: "Cian Murphy", session_date: dayFrom(n), created_at: `${dayFrom(n)}T10:00:00Z` });
    db.marks.push({ id: `6e000000-0000-4000-8000-0000000000${String(10 + i)}`, session_id: sid, player_id: IDS.cian, state: i === 3 ? "out" : "in" });
  });

  /* the rest of the roster's lessons, each with a clip so a poster stands in every row */
  const others = [
    ["saoirse", -9, 0], ["ellie", -8, 1], ["aoife", -6, 3], ["darragh", -5, 2], ["roisin", -4, 1], ["meabh", -3, 4], ["tadhg", -2, 6], ["oisin", -12, 5], ["ciara", -15, 1],
  ];
  others.forEach(([k, n, f]) => {
    const l = M.addLesson(db, { coachId: IDS.coach, playerId: IDS[k], date: dayFrom(n), focus: S.focus[f], subs: subsFor(k === "saoirse" || k === "ellie" || k === "meabh" || k === "oisin" ? S.junior : S.cianLevels[3]),
      notes: `${S.focus[f]}. Steady progress.`, unread: false });
    M.addMedia(db, { lessonId: l.id, kind: "video", path: `${IDS.coach}/${l.id}/clip-1.mp4`, createdAt: `${dayFrom(n)}T12:00:00Z` });
  });

  /* drills and tips for Cian */
  const due = [dayFrom(1), dayFrom(4), null, dayFrom(6)];
  S.drills.forEach((t, i) => db.drills.push({ id: `d0000000-0000-4000-8000-0000000000${String(10 + i)}`, coach_id: IDS.coach, player_id: IDS.cian, title: t, done: i === 2, due: due[i], created_at: `${dayFrom(-7)}T12:00:00Z` }));
  db.drills.push({ id: "d0000000-0000-4000-8000-000000000020", coach_id: IDS.coach, player_id: IDS.saoirse, title: S.drills[1], done: false, due: dayFrom(2), created_at: `${dayFrom(-9)}T12:00:00Z` });
  db.drills.push({ id: "d0000000-0000-4000-8000-000000000021", coach_id: IDS.coach, player_id: IDS.ellie, title: S.drills[0], done: false, due: dayFrom(1), created_at: `${dayFrom(-8)}T12:00:00Z` });
  db.tips.push({ id: M.uuid(), coach_id: IDS.coach, player_id: IDS.cian, title: S.tip, body: null, created_at: `${dayFrom(-7)}T12:00:00Z` });

  /* the week's hours */
  M.setPrefs(db, IDS.coach, {
    setup_done: true,
    availability: M.weekOf(["9:00 am", "10:00 am", "11:00 am", "2:00 pm", "3:00 pm", "4:00 pm", "5:00 pm"], [0, 1, 2, 3, 4, 5]),
    groups: [{ id: "g1", name: S.group, members: ["Méabh Daly", "Oisín Fitzgerald", "Tadhg Ryan", "Ciara Gallagher"], memberIds: [IDS.meabh, IDS.oisin, IDS.tadhg, IDS.ciara], day: 3, time: "5:00 pm", weeks: 8, sport }],
  });

  /* today: two to log, one live, the afternoon to come */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.aoife, date: TODAY, time: "9:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.darragh, date: TODAY, time: "10:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.cian, date: TODAY, time: "11:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.roisin, date: TODAY, time: "2:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.saoirse, date: TODAY, time: "4:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, groupName: S.group, date: TODAY, time: "5:00 pm", duration: 60, status: "confirmed" });
  /* tomorrow and the days after */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.tadhg, date: dayFrom(1), time: "9:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.meabh, date: dayFrom(1), time: "3:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.ellie, date: dayFrom(1), time: "4:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.ellie, date: dayFrom(8), time: "4:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.oisin, date: dayFrom(2), time: "10:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.cian, date: dayFrom(7), time: "11:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.aoife, date: dayFrom(5), time: "2:00 pm", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.darragh, date: dayFrom(6), time: "10:00 am", status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, groupName: S.group, date: dayFrom(7), time: "5:00 pm", duration: 60, status: "confirmed" });
  /* the weeks ahead, so the month reads full */
  [[8, "9:00 am", "tadhg"], [8, "2:00 pm", "roisin"], [9, "10:00 am", "aoife"], [11, "11:00 am", "darragh"], [12, "4:00 pm", "saoirse"], [13, "9:00 am", "tadhg"],
   [14, "11:00 am", "cian"], [15, "3:00 pm", "meabh"], [16, "10:00 am", "oisin"], [18, "2:00 pm", "roisin"], [19, "9:00 am", "aoife"], [20, "4:00 pm", "saoirse"],
   [21, "11:00 am", "cian"], [22, "10:00 am", "darragh"], [3, "2:00 pm", "roisin"], [4, "3:00 pm", "meabh"]].forEach(([n, t, k]) =>
    M.addBooking(db, { coachId: IDS.coach, playerId: IDS[k], date: dayFrom(n), time: t, status: "confirmed" }));
  M.addBooking(db, { coachId: IDS.coach, groupName: S.group, date: dayFrom(14), time: "5:00 pm", duration: 60, status: "confirmed" });
  M.addBooking(db, { coachId: IDS.coach, groupName: S.group, date: dayFrom(21), time: "5:00 pm", duration: 60, status: "confirmed" });
  /* one ask waiting */
  M.addBooking(db, { coachId: IDS.coach, playerId: IDS.ciara, date: dayFrom(4), time: "10:00 am", status: "requested" });

  /* Chat */
  const at = (n, hm) => new Date(`${dayFrom(n)}T${hm}:00Z`).toISOString();
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.coach, body: `Lovely session. The clips are on the lesson.`, createdAt: at(-7, "12:10"), readAt: at(-7, "12:30") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.cian, body: "Watched them twice. Big difference already.", createdAt: at(-7, "19:02"), readAt: at(-7, "19:10") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.coach, body: `Keep at the ${S.drills[0].toLowerCase()} this week.`, createdAt: at(-7, "19:15"), readAt: at(-7, "19:20") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.coach, body: "Ten minutes a day is plenty.", createdAt: at(-7, "19:16"), readAt: at(-7, "19:20") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.cian, body: "Will do. See you Thursday at eleven.", createdAt: at(-1, "18:40"), readAt: at(-1, "18:45") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.cian, senderId: IDS.coach, body: "Perfect. Bring the clips with you.", createdAt: at(-1, "18:46"), readAt: at(-1, "18:50") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.coach, body: "Saoirse was brilliant today.", createdAt: at(-9, "16:50"), readAt: at(-9, "17:30") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.coach, body: "Her grip is much better.", createdAt: at(-9, "16:51"), readAt: at(-9, "17:30") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.orla, body: "Thanks Niamh, she can't stop talking about it.", createdAt: at(-9, "19:20"), readAt: at(-9, "19:40") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.saoirse, body: "I did the drill every day this week", createdAt: at(-1, "18:30"), readAt: at(-1, "18:40") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.coach, body: "Brilliant. Show me at four tomorrow.", createdAt: at(-1, "18:41"), readAt: at(-1, "19:00") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.saoirse, senderId: IDS.orla, body: "She's very excited. See you at four.", createdAt: at(0, "09:12") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.roisin, senderId: IDS.roisin, body: "Running ten minutes late, sorry.", createdAt: at(0, "10:55") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.aoife, senderId: IDS.aoife, body: `The ${S.drills[2].toLowerCase()} is working. Thank you.`, createdAt: at(-1, "20:05"), readAt: at(-1, "21:00") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.darragh, senderId: IDS.coach, body: "Great work this morning.", createdAt: at(0, "10:50"), readAt: at(0, "11:00") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.tadhg, senderId: IDS.tadhg, body: "Can we look at the new clips tomorrow?", createdAt: at(-2, "17:30"), readAt: at(-2, "18:00") });
  M.addMessage(db, { coachId: IDS.coach, playerId: IDS.meabh, senderId: IDS.coach, body: "Well done at the weekend, Méabh.", createdAt: at(-3, "12:00"), readAt: at(-3, "13:00") });

  /* the bell */
  M.addNotification(db, { userId: IDS.coach, kind: "booking", title: "Ciara Gallagher asked for a lesson", body: "Mon 30 Nov 10:00 am", data: { screen: "today" }, createdAt: at(0, "08:10") });
  M.addNotification(db, { userId: IDS.cian, kind: "drill", title: `${S.drills[0]} · by Fri 27 Nov`, body: null, data: { screen: "practice" }, createdAt: at(-7, "12:00"), readAt: at(-7, "13:00") });
  return db;
}

module.exports = { buildDb, IDS, FIXED, TODAY, dayFrom, ymd, SPORT, FAM };
