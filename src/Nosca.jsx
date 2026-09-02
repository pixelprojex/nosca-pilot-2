import React, { useState, useEffect, useRef, useMemo, useContext, createContext } from "react";
import { useCapture } from "./lib/useCapture";
import {
  ChevronLeft, ChevronRight, Check, Play, Pause, Plus, Minus, X, Mic, Square, Home, Library,
  Calendar, CalendarDays, MessageCircle, Send, Users, User, ArrowRight, QrCode, Share2,
  Delete, Lock, Mail, Apple, Camera, Image as ImageIcon, ChevronDown, Search, Wallet,
  Receipt, Banknote, Bell, FileText, HelpCircle, LogOut, Trash2, ShieldCheck,
  ExternalLink, Tag, Phone, Paperclip, Clock, ListChecks, Download, Palette, Zap,
  TrendingUp, Eye, Minimize2, Sparkles, Lightbulb, Volume2, VolumeX, UserPlus, Radio, Building2, Edit3, Trophy, Award, Star
} from "lucide-react";

/* ==================================================================
   BRAND · NOSCA (provisional) — from Irish nasc / nascadh, "to link"
================================================================== */
export const BRAND = "NOSCA";
const VERSION = "1.2.0 (38)";

export function Mark({ size = 34, color = "#16201A" }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 40 25" aria-label={BRAND}>
      <circle cx="14" cy="12.5" r="8.6" fill="none" stroke={color} strokeWidth={2.1} />
      <circle cx="26" cy="12.5" r="8.6" fill="none" stroke={color} strokeWidth={2.1} />
      <path d="M19.6 5.7 A 8.6 8.6 0 0 1 19.6 19.3" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </svg>
  );
}

const SWATCHES = [
  { id: "sport",  name: "Sport default", accent: null,      onAccent: null },
  { id: "navy",   name: "Navy",          accent: "#26405F", onAccent: "#FFFFFF" },
  { id: "claret", name: "Claret",        accent: "#7B2D3B", onAccent: "#FFFFFF" },
  { id: "forest", name: "Forest",        accent: "#265744", onAccent: "#FFFFFF" },
  { id: "sand",   name: "Sand",          accent: "#C2A15A", onAccent: "#1B2117" },
  { id: "slate",  name: "Slate",         accent: "#41505A", onAccent: "#FFFFFF" },
  { id: "plum",   name: "Plum",          accent: "#5C4370", onAccent: "#FFFFFF" },
  { id: "brick",  name: "Brick",         accent: "#9C4A2E", onAccent: "#FFFFFF" },
];

/* ==================================================================
   PLANS · coach pays, players are free. Tiered on roster size, which
   is the number a coach actually knows about themselves.
================================================================== */
const PLANS = [
  { id: "solo",    name: "Solo",    price: 24, cap: 20,   blurb: "Up to 20 on your roster",
    lines: ["Unlimited lessons and video", "Drills, tips and messaging", "Bookings and payments"] },
  { id: "studio",  name: "Studio",  price: 44, cap: 60,   blurb: "Up to 60 on your roster", popular: true,
    lines: ["Everything in Solo", "Recurring groups and clinics", "Your own branding"] },
  { id: "academy", name: "Academy", price: 89, cap: null, blurb: "Unlimited roster",
    lines: ["Everything in Studio", "Multiple coaches on one club", "Shared drill library"] },
];
/* A code gets someone into the queue, not onto the roster. The coach
   accepts — which matters most where the people involved are minors. */
/* What a coach needs to know about someone in the moment before a
   lesson. Kept in one place so the calendar block, the home prompt and
   the profile all say the same thing. */
const PLAYER_FILE = {
  "Marcus Tran":  { done: 12, lastFocus: "Short game", lastOn: "14 Jun",
                    tip: "Trust the shallow", goal: "Break 90 at the club champs", note: "Prefers mornings" },
  "Priya Ellis":  { done: 8,  lastFocus: "Driving", lastOn: "02 Jun",
                    tip: "Tempo over speed", goal: "Play the county foursomes", note: "Pays in cash" },
  "Dan Okafor":   { done: 5,  lastFocus: "Putting", lastOn: "18 May",
                    tip: "Same routine every putt", goal: null, note: "New to the game" },
  "Sofia Reyes":  { done: 3,  lastFocus: "Long game", lastOn: "04 May",
                    tip: "Commit to the shape", goal: null, note: "" },
  "Tom Beckett":  { done: 1,  lastFocus: "Short game", lastOn: "20 Apr",
                    tip: null, goal: null, note: "Left-handed" },
};
/* Set once, at sign-in. While true, every seed generator below returns
   nothing — so no screen, sheet or tab can surface invented history,
   whether or not it remembered to ask for the live data. */
let LIVE_ACCOUNT = false;
export const setLiveAccount = (v) => { LIVE_ACCOUNT = !!v; };

const EMPTY_FILE = { done: 0, lastFocus: null, lastOn: null, tip: null, goal: null, note: "", lessons: [] };
const fileFor = (n) => LIVE_ACCOUNT ? EMPTY_FILE : (PLAYER_FILE[n] || EMPTY_FILE);

/* Lessons per month, for the little bar chart on both sides. */
/* The kit each sport actually uses. A photo of the screen is the
   honest first step — reading it automatically comes later, and a
   coach shouldn't have to retype numbers in the meantime. */
const CAPTURE = {
  golf:       { device: "TrackMan", fields: ["Club speed", "Ball speed", "Carry", "Smash", "Launch", "Spin"],
                sample: ["112 mph", "165 mph", "271 yd", "1.47", "12.4°", "2,480"] },
  tennis:     { device: "Serve radar", fields: ["1st serve", "2nd serve", "Avg speed", "In %"],
                sample: ["186 km/h", "142 km/h", "168 km/h", "61%"] },
  rowing:     { device: "Erg screen", fields: ["Distance", "Time", "Split", "Rate", "Watts"],
                sample: ["2,000 m", "7:12.4", "1:48.1", "24 spm", "241 W"] },
  squash:     { device: "Match sheet", fields: ["Games", "Points", "Winners", "Errors"],
                sample: ["3–1", "44", "12", "9"] },
  padel:      { device: "Match sheet", fields: ["Sets", "Games", "Net points", "Smashes"],
                sample: ["2–1", "16", "62%", "9"] },
  equestrian: { device: "Test sheet", fields: ["Score", "Collectives", "Penalties", "Time"],
                sample: ["66.4%", "7.5", "0", "72.4s"] },
};

/* What people are actually training towards. A date in the calendar
   changes how the weeks before it feel — for the player and for the
   coach planning them. */
const EVENTS = {
  golf:       [{ name: "Club Championship", when: "Sat 8 Aug", days: 15, kind: "Competition" },
               { name: "Captain's Prize", when: "Sun 6 Sep", days: 44, kind: "Competition" }],
  tennis:     [{ name: "County Championships", when: "Fri 14 Aug", days: 21, kind: "Tournament" }],
  rowing:     [{ name: "Head of the River", when: "Sat 12 Sep", days: 50, kind: "Regatta" }],
  squash:     [{ name: "Club Ladder Final", when: "Thu 6 Aug", days: 13, kind: "Match" }],
  padel:      [{ name: "Summer Doubles Cup", when: "Sat 15 Aug", days: 22, kind: "Tournament" }],
  equestrian: [{ name: "Regional Dressage", when: "Sun 17 Aug", days: 24, kind: "Competition" }],
};

/* Garda Vetting runs on a three-year cycle under the National Vetting
   Bureau Acts 2012–2016, and Sport Ireland Safeguarding 1 is refreshed
   on the same rhythm. Coaches lose work by letting these lapse, so the
   app tracks the dates — it never stores the disclosure itself. */
const CREDENTIALS = [
  { id: "vetting",  name: "Garda Vetting",        body: "National Vetting Bureau", expires: "14 Mar 2028", months: 31, required: true },
  { id: "safe1",    name: "Safeguarding 1",       body: "Sport Ireland",           expires: "02 Nov 2026", months: 15, required: true },
  { id: "firstaid", name: "First Aid",            body: "Irish Red Cross",         expires: "20 Sep 2026", months: 13 },
  { id: "insure",   name: "Public liability",     body: "Coaching Ireland",        expires: "31 Dec 2026", months: 16 },
  { id: "pga",      name: "Coaching qualification", body: "PGA Ireland",           expires: null, months: null },
];

/* The number each sport actually uses to describe a player. Ignoring
   these means a coach has to keep them somewhere else. */
const RATINGS = {
  golf:       { label: "Handicap",       body: "CONGU",     value: "11.4", lower: true,  confidence: 3, hint: "Lower is better" },
  tennis:     { label: "UTR",            body: "Universal Tennis", value: "6.42", lower: false, confidence: 2, hint: "1 to 16.5" },
  padel:      { label: "Level",          body: "Playtomic", value: "3.25", lower: false, confidence: 2, hint: "0 to 7, in quarters" },
  squash:     { label: "Club rating",    body: "England Squash", value: "1,840", lower: false, confidence: 1, hint: "Points based" },
  rowing:     { label: "2K split",       body: "Concept2",  value: "1:48.1", lower: true,  hint: "Per 500m" },
  equestrian: { label: "Dressage avg",   body: "Last 5 tests", value: "66.4%", lower: false, hint: "Percentage" },
};

/* Lesson times a player has asked for, waiting on the coach. Distinct
   from SEED_REQUESTS below, which is people asking to join a roster. */
const SEED_ASKS = [
  { id: 1, who: "Priya Ellis",  m: 7, d: 29, time: "6:00 pm", note: "Any chance of the Tuesday?" },
  { id: 2, who: "Dan Okafor",   m: 7, d: 31, time: "9:00 am", note: "" },
];

/* Players ask; the coach decides. Nothing lands in the diary until
   they do. */
const LESSON_REQUESTS = [
  { id: 1, who: "Priya Ellis", when: "Thu 31 Jul", time: "5:30 pm", note: "Any chance of the later slot?" },
  { id: 2, who: "Dan Okafor",  when: "Sat 2 Aug",  time: "9:00 am", note: "" },
];

const MONTHLY = [["Mar", 2], ["Apr", 3], ["May", 5], ["Jun", 4], ["Jul", 6], ["Aug", 0]];


/* ==================================================================
   THE BREATHNACH FAMILY
   A real household rather than sample data: two parents, five children,
   two coaches, two sports, and the ordinary mess that comes with it —
   a rained-off lesson, a child with no coach yet, and one very
   competitive fourteen-year-old.

   Kept entirely separate from the default seeds so the existing
   prototypes are untouched. Loaded from the toolbar.
================================================================== */
const BREATHNACH = {
  coaches: {
    tennis: { name: "Conor Twomey", club: "Bishopstown Lawn Tennis Club" },
    golf:   { name: "Shane Irwin",  club: "Monkstown Golf Club" },
  },

  /* Gráinne manages the children's accounts, so she is profile 1. */
  people: [
    { id: 1, name: "Gráinne O'Donnell", age: null, sport: "tennis", lessons: 50,
      role: "manager",
      tip: "Split-step before every return",
      goal: "Win the club doubles",
      note: "Manages the children's accounts",
      event: { name: "Club Doubles", kind: "Competition", when: "Sat 12 Sep", where: "Bishopstown LTC", time: "10:00 am", days: 22 } },

    { id: 2, name: "Eoin Breathnach", age: null, sport: "golf", lessons: 20,
      second: { sport: "tennis", lessons: 5 },
      tip: "Finish the turn through it",
      goal: "Get to single figures",
      note: "Plays both. Golf is the serious one.",
      event: { name: "Winter League", kind: "League", when: "Sun 6 Dec", where: "Monkstown Golf Club", time: "8:30 am", days: 138 } },

    { id: 3, name: "Fionn Breathnach", age: 15, turns18: "March 2029", sport: "golf", lessons: 1,
      tip: "One swing thought, not four",
      goal: "Break 100 by the spring",
      note: "First proper block. Two hours, covered everything.",
      rainedOff: true },

    { id: 4, name: "Róisín Breathnach", age: 14, turns18: "August 2030", sport: "tennis", lessons: 500,
      tip: "Recover to the middle after every ball",
      goal: "Provincial singles",
      note: "Trains most days. Video after nearly every session.",
      event: { name: "Leinster Junior Open", kind: "Tournament", when: "Mon 28 Jul", where: "Bishopstown LTC", time: "9:00 am", days: 4 } },

    { id: 5, name: "Eimear Breathnach", age: 12, turns18: "June 2032", sport: "tennis", lessons: 60,
      tip: "Toss a little further in front",
      goal: "First serve in more often",
      event: { name: "Leinster Junior Open", kind: "Tournament", when: "Mon 28 Jul", where: "Bishopstown LTC", time: "11:00 am", days: 4 } },

    { id: 6, name: "Síofra Breathnach", age: 10, turns18: "January 2034", sport: "tennis", lessons: 5,
      tip: "Watch the ball onto the strings",
      event: { name: "Leinster Junior Open", kind: "Tournament", when: "Mon 28 Jul", where: "Bishopstown LTC", time: "2:00 pm", days: 4 } },

    { id: 7, name: "Órna Breathnach", age: 7, turns18: "November 2036", sport: null, lessons: 0 },
  ],

  /* What Shane and Conor have actually been doing with them. */
  history: {
    "Eoin Breathnach": [
      { d: "18 Jul", focus: "Short game", note: "Bump and run from a tight lie.", videos: 2 },
      { d: "04 Jul", focus: "Driving",    note: "Held the finish. Cleanest strike in months.", videos: 1 },
      { d: "20 Jun", focus: "Long game",  note: "Five iron from 180. Trap it.", videos: 2 },
      { d: "06 Jun", focus: "Putting",    note: "Pace on the long ones.", videos: 0 },
      { d: "23 May", focus: "On course",  note: "Played nine. Course management.", videos: 1 },
    ],
    "Gráinne O'Donnell": [
      { d: "21 Jul", focus: "Serve",   note: "Second serve with more shape.", videos: 1 },
      { d: "14 Jul", focus: "Net play", note: "Doubles positioning with Conor feeding.", videos: 2 },
      { d: "07 Jul", focus: "Return",  note: "Split-step timing.", videos: 0 },
    ],
    "Fionn Breathnach": [
      { d: "17 Jul", focus: "Everything", note: "Two hours. Driver, irons, wedges, putter. Long way to go but he'll get there.", videos: 3 },
    ],
    "Róisín Breathnach": [
      { d: "22 Jul", focus: "Backhand",  note: "Down the line under pressure.", videos: 3 },
      { d: "21 Jul", focus: "Movement",  note: "Recovery step after the wide ball.", videos: 2 },
      { d: "19 Jul", focus: "Serve",     note: "Kick serve to the backhand.", videos: 4 },
      { d: "18 Jul", focus: "Match play", note: "Practice sets. Held her nerve at 4-4.", videos: 1 },
      { d: "16 Jul", focus: "Forehand",  note: "Heavier ball cross-court.", videos: 2 },
    ],
    "Eimear Breathnach": [
      { d: "20 Jul", focus: "Serve",    note: "Toss drifting behind her.", videos: 1 },
      { d: "13 Jul", focus: "Forehand", note: "Good depth. Watch the grip.", videos: 1 },
    ],
    "Síofra Breathnach": [
      { d: "19 Jul", focus: "Rallying", note: "Ten in a row for the first time.", videos: 0 },
    ],
  },

  /* Everything currently happening to this family at once. */
  today: [
    { time: "8:00 am",  who: "Eoin Breathnach",  kind: "Private",   sport: "golf",   done: true, hoursUntil: -3.2 },
    { time: "10:00 am", who: "Róisín Breathnach", kind: "Private",  sport: "tennis", done: true, hoursUntil: -1.2 },
    { time: "4:00 pm",  who: "Junior squad",     kind: "Group · 6", sport: "tennis", hoursUntil: 4.5 },
    { time: "6:00 pm",  who: "Fionn Breathnach", kind: "Private",   sport: "golf",   hoursUntil: 6.5, calledOff: true },
  ],

  alerts: [
    { who: "Shane Irwin", what: "Called off Fionn's 6pm — range is flooded", when: "20 min ago", kind: "weather" },
    { who: "Conor Twomey", what: "New tip for Róisín · recover to the middle", when: "1 hour ago", kind: "tip" },
    { who: "Junior squad", what: "Conor: Bring a spare grip on Saturday", when: "2 hours ago", kind: "group" },
    { who: "Conor Twomey", what: "Three of yours are drawn at Fitzwilliam on Monday", when: "Yesterday", kind: "comp" },
  ],
};

/* Reshapes the fixture into the state the app already understands. */
const loadBreathnach = () => {
  const profiles = BREATHNACH.people.map((p) => ({ id: p.id, name: p.name, age: p.age, turns18: p.turns18 }));
  const conns = [];
  let cid = 1;
  BREATHNACH.people.forEach((p) => {
    if (p.sport) {
      const c = BREATHNACH.coaches[p.sport];
      conns.push({ id: cid++, profileId: p.id, sport: p.sport, coach: c.name, club: c.club, seeded: true });
    }
    if (p.second) {
      const c = BREATHNACH.coaches[p.second.sport];
      conns.push({ id: cid++, profileId: p.id, sport: p.second.sport, coach: c.name, club: c.club, seeded: true });
    }
  });
  return { profiles, conns };
};

const bFile = (name) => {
  const p = BREATHNACH.people.find((x) => x.name === name);
  const h = BREATHNACH.history[name] || [];
  if (!p) return null;
  return { done: p.lessons, tip: p.tip || null, goal: p.goal || null, note: p.note || "",
           lastFocus: h[0] ? h[0].focus : null, lastOn: h[0] ? h[0].d : null, recent: h, event: p.event || null };
};

const FAMILY_CODE = "TR7M2K";

/* A coach's full history, built from the sport's lesson shapes spread
   across the roster so it reads like a real archive rather than five
   repeated rows. */
function buildArchive(cfg) {
  if (LIVE_ACCOUNT) return [];        // a real account has no archive until it earns one
  const out = [];
  const months = [["JUL", 7], ["JUN", 6], ["MAY", 5], ["APR", 4]];
  let id = 1;
  months.forEach(([mLabel, mIdx], mi) => {
    cfg.lessons.forEach((l, li) => {
      ROSTER.forEach((r, ri) => {
        if ((li + ri + mi) % 3 !== 0) return;
        const day = ((li * 5 + ri * 3 + mi * 7) % 27) + 1;
        out.push({
          id: id++, who: r.name, focus: l.focus, focusId: l.focusId, subs: l.subs,
          d: String(day).padStart(2, "0"), m: mLabel, mIdx,
          type: (li + ri) % 4 === 0 ? "Group" : "Private", videos: (li + ri) % 3,
        });
      });
    });
  });
  return out.sort((a, b) => b.mIdx - a.mIdx || Number(b.d) - Number(a.d));
}

const SEED_REQUESTS = [
  { name: "Aoife Brennan", when: "12m ago", note: "Code RD4K9P" },
  { name: "Cian Murphy",   when: "2h ago",  note: "Code RD4K9P" },
];

const ROSTER_BANDS = ["Just starting out", "Under 20", "20 to 60", "More than 60"];
/* Ireland set the GDPR digital age of consent at 16, which is what
   decides whether a child can hold their own account here. */
/* Optical borders: a hairline that carries a little of the ink beneath
   it sits on the page, where a flat grey sits on top of it. */
export const HAIR = (ink, a = 0.09) => `${ink}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
/* Radius carries meaning rather than decoration: a control you press is
   nearly square, a surface that holds content is softer, and only the
   things that are genuinely pill-shaped are pills. Uniform curvature
   everywhere is what flattens an interface into a template. */
export const R = {
  field:   6,    // inputs and time cells — crisp, typographic
  control: 9,    // buttons: firm, not bubbly
  surface: 14,   // cards and sheets hold content
  sheet:   22,   // the bottom sheet is the softest thing on screen
  pill:    999,  // only for actual pills
};

const ADULT_AGE = 18;
export const CONSENT_AGE = ADULT_AGE;   // one number, used everywhere
const BAND_TO_PLAN = { "Just starting out": "solo", "Under 20": "solo", "20 to 60": "studio", "More than 60": "academy" };


export const NEUTRAL = {
  ink: "#1A1815", sub: "#6B6560", faint: "#A39C93",
  hair: "#E8E3DA", page: "#FFFFFF", surface: "#FFFFFF",
  wash: "#F2EDE4", mark: "#1A1815", accent: "#1A1815", onAccent: "#FAF7F2",
};
/* Three states, learned once, applied everywhere — the WHOOP model.
   Anything outside this set is decoration and does not belong. */
/* ------------------------------------------------------------------
   SEMANTIC COLOUR

   The sport tints the app; these four say what something MEANS, and
   they are identical in every sport. A red badge is red whether you
   coach golf or padel — that is the whole point. Learn them once.
------------------------------------------------------------------ */
export const DANGER  = "#C4342A";   // no · cancelled · missed · destructive
export const CAUTION = "#D08A1E";   // waiting on you · soon · unresolved
export const STEADY  = "#2E7D4B";   // yes · done · confirmed · on track
const GROUP   = "#6E5A93";   // a group rather than one person

/* Every count badge in the app resolves through here, so a number can
   never be coloured by accident. */
const meaning = {
  waiting:  CAUTION,   // needs a decision from you
  overdue:  DANGER,    // should already have happened
  done:     STEADY,    // settled
  neutral:  null,      // just a quantity
};

/* Lessons a person actually had. Empty for a real account — the sport
   config's own list is a catalogue of focus areas for suggestions, not
   a history, and must never be shown as one. */
const hadLessons = (cfg) => (LIVE_ACCOUNT ? [] : (cfg?.lessons || []));

export const SPORTS = {
  golf: {
    noun: "player", nouns: "players",
    label: "Golf", tagline: "Swing, short game, course play",
    theme: { ink: "#14180F", sub: "#5A6350", faint: "#A8AE9C", hair: "#EDEAE1",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#F1ECDF", mark: "#8C6D28", accent: "#8C6D28", onAccent: "#FFFFFF" },
    focus: [
      { id: "driving", label: "Driving",    subs: ["Tee shots", "Distance", "Accuracy", "Setup"] },
      { id: "long",    label: "Long game",  subs: ["Irons", "Hybrids", "Fairway woods", "Ball striking"] },
      { id: "short",   label: "Short game", subs: ["Chipping", "Pitching", "Bunker play", "Distance control"] },
      { id: "putting", label: "Putting",    subs: ["Stroke", "Green reading", "Lag putting", "Short putts"] },
      { id: "course",  label: "On course",  subs: ["Strategy", "Club selection", "Course management", "Mental game"] },
    ],
    angles: ["Face-on", "Down the line", "Overhead", "Slow motion"],
    drills: [
      { t: "Alignment stick gate", d: "Two sticks at the shaft plane. 20 balls.", focus: "driving" },
      { t: "Ladder drill",         d: "60, 80, 100 yd. Ten each, note the carry.", focus: "short" },
      { t: "Putting gate",         d: "Six feet, tees just wider than the head.", focus: "putting" },
      { t: "Half swings",          d: "Waist to waist with a 7-iron.", focus: "long" },
      { t: "Two-tee bunker drill", d: "Enter the sand behind the back tee.", focus: "short" },
      { t: "Clock putting",        d: "Six balls at 3, 6 and 9 feet, all the way round.", focus: "putting" },
      { t: "Impact bag",           d: "Twenty hits. Feel the lag into the bag, not the arms.", focus: "long" },
      { t: "Nine-shot ladder",     d: "Draw, straight, fade — low, mid, high with one club.", focus: "course" },
      { t: "One-club nine",        d: "Play nine holes with a 7-iron only.", focus: "course" },
      { t: "Towel under both arms",d: "Twenty half swings, keep the towel in.", focus: "driving" },
    ],
    tipLibrary: [
      { t: "Trust the shallow",    d: "The shaft gets shallower at the top — keep trusting it rather than steepening back up to save it.", focus: "driving" },
      { t: "Tempo over speed",     d: "You're at your best with a slower backswing. Chasing extra yards costs more than it gives.", focus: "driving" },
      { t: "Finish balanced",      d: "Hold the finish for a full three count — rushing off the ball is costing solid contact.", focus: "long" },
      { t: "Let the putter fall",  d: "Pendulum from the shoulders, not the wrists — let gravity do the work on the stroke.", focus: "putting" },
      { t: "Commit to the number", d: "Once you've picked the club, commit fully — indecision is the real distance killer.", focus: "course" },
      { t: "Widen the stance in the wind", d: "A wider base holds up better when it's blowing — don't fight it standing tall.", focus: "course" },
    ],
    goals: [
      "Break 90", "Get the handicap under 18", "Consistent contact off the tee",
      "Confident inside 10 feet", "Play a full round without a blow-up hole",
    ],
    statCatalog: [
      { id: "handicap", l: "Handicap", u: "", manual: true },
      { id: "drive",    l: "Drive",    u: "yd" },
      { id: "greens",   l: "Greens",   u: "%" },
      { id: "putts",    l: "Putts",    u: "/rnd" },
      { id: "upDown",   l: "Up & down", u: "%" },
      { id: "fairways", l: "Fairways", u: "%" },
      { id: "scramble", l: "Scrambling", u: "%" },
      { id: "prox",     l: "Proximity", u: "ft" },
    ],
    statValues: {
      handicap: { v: "12.4" }, drive: { v: "248", m: "+11" }, greens: { v: "42", m: "+7" },
      putts: { v: "33", m: "−2" }, upDown: { v: "58", m: "+5" }, fairways: { v: "64", m: "+3" },
      scramble: { v: "47", m: "+9" }, prox: { v: "28", m: "−4" },
    },
    defaultStats: ["drive", "greens", "putts"],
    chart: { label: "Scoring average", note: "Lower is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [94,93,91,90,89,88] },
    transcript: "Good session. Most of it went on distance control from inside a hundred yards, and your contact is far more consistent now. Keep the ladder drill going before we meet again — sixty, eighty, a hundred, ten balls each, and write down the carry.",
    lessons: [
      { id:1, focus:"Short game", focusId:"short", subs:["Distance control","Pitching"], d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Putting",    focusId:"putting", subs:["Green reading","Lag putting"], d:"31", m:"MAY", type:"Private", videos:1 },
      { id:3, focus:"Driving",    focusId:"driving", subs:["Accuracy","Setup"],           d:"17", m:"MAY", type:"Group",   videos:3 },
      { id:4, focus:"Long game",  focusId:"long",   subs:["Irons","Ball striking"],      d:"03", m:"MAY", type:"Private", videos:2 },
      { id:5, focus:"Short game", focusId:"short", subs:["Bunker play"],                d:"19", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Short game", focusId:"short", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Short game", focusId:"short", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Short game", focusId:"short", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Short game", focusId:"short", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Short game", focusId:"short", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Short game", focusId:"short", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Short game", focusId:"short", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Short game", focusId:"short", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Short game", focusId:"short", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Short game", focusId:"short", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Short game", focusId:"short", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Short game", focusId:"short", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Short game", focusId:"short", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Short game", focusId:"short", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Short game", focusId:"short", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
  tennis: {
    noun: "player", nouns: "players",
    label: "Tennis", tagline: "Serve, groundstrokes, match play",
    theme: { ink: "#0A2222", sub: "#476865", faint: "#96ADA9", hair: "#E1EDEB",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#E8F1EE", mark: "#0F7A69", accent: "#0F7A69", onAccent: "#FFFFFF" },
    focus: [
      { id:"serve",  label:"Serve",         subs:["First serve","Second serve","Placement","Toss"] },
      { id:"ground", label:"Groundstrokes", subs:["Forehand","Backhand","Topspin","Slice"] },
      { id:"net",    label:"Net play",      subs:["Volleys","Overheads","Approach","Drop shots"] },
      { id:"move",   label:"Movement",      subs:["Footwork","Recovery","Split step","Court coverage"] },
      { id:"match",  label:"Match play",    subs:["Tactics","Point construction","Mental game","Return"] },
    ],
    angles: ["Behind baseline", "Side on", "Court level", "Slow motion"],
    drills: [
      { t: "Shadow serve",      d: "Twenty reps. Toss and reach, no ball.", focus: "serve" },
      { t: "Cross-court rally", d: "Twenty in a row, backhand only.", focus: "ground" },
      { t: "Split-step ladder", d: "Three sets of ten.", focus: "move" },
      { t: "Volley wall taps",  d: "Two minutes continuous, soft hands.", focus: "net" },
      { t: "Serve targets",     d: "Ten to each corner, first serve only.", focus: "serve" },
      { t: "Approach and volley", d: "Ten short balls, approach then close.", focus: "net" },
      { t: "Down-the-line pattern", d: "Fifteen cross-court, finish down the line.", focus: "ground" },
      { t: "Second serve spin",  d: "Twenty kick serves, high bounce target.", focus: "serve" },
      { t: "Return blocks",      d: "Twenty returns, block deep, no backswing.", focus: "match" },
      { t: "Recovery sprints",   d: "Corner to corner, ten reps, full recovery each time.", focus: "move" },
    ],
    tipLibrary: [
      { t: "Get the toss out front", d: "A hand's width in front of your front foot lets you swing up through it, not down.", focus: "serve" },
      { t: "Split step on contact", d: "Time the split to their contact, not your own movement — reacting, not guessing.", focus: "move" },
      { t: "Finish the backhand high", d: "Let the follow-through finish above the shoulder — it's what keeps the ball down.", focus: "ground" },
      { t: "Take the return early", d: "Step in and take it on the rise — staying back gives them time to recover.", focus: "match" },
      { t: "Racquet head speed, not arm speed", d: "The power comes from a loose wrist through contact, not muscling the shot.", focus: "ground" },
      { t: "Play the percentages at 30-30", d: "Big points aren't the time to go for lines — find the middle of the box.", focus: "match" },
    ],
    goals: [
      "Land 60% of first serves", "Hold serve consistently", "Confident cross-court backhand",
      "Compete in a first tournament", "Reduce unforced errors on the forehand",
    ],
    statCatalog: [
      { id: "wtn",     l: "WTN",       u: "", manual: true },
      { id: "serve",   l: "1st serve", u: "%" },
      { id: "winners", l: "Winners",   u: "/set" },
      { id: "errors",  l: "Errors",    u: "/set" },
      { id: "aces",    l: "Aces",      u: "/match" },
      { id: "matches", l: "Matches",   u: "played" },
      { id: "breaks",  l: "Break pts", u: "won %" },
      { id: "netpts",  l: "Net points", u: "won %" },
    ],
    statValues: {
      wtn: { v: "11.2" }, serve: { v: "58", m: "+10" }, winners: { v: "14", m: "+4" },
      errors: { v: "24", m: "−6" }, aces: { v: "6", m: "+2" }, matches: { v: "11", m: "+3" },
      breaks: { v: "38", m: "+7" }, netpts: { v: "61", m: "+5" },
    },
    defaultStats: ["serve", "winners", "errors"],
    chart: { label: "First serve percentage", note: "Higher is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [48,50,51,54,56,58] },
    transcript: "Good session. Most of it went on the first serve — your toss is landing in the same spot now and you're getting up into the ball instead of pushing it. Keep the shadow serve going before we meet again: twenty reps, no ball, just the toss and the reach.",
    lessons: [
      { id:1, focus:"Serve",         focusId:"serve", subs:["First serve","Toss"],    d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Groundstrokes", focusId:"ground", subs:["Backhand","Topspin"],    d:"02", m:"JUN", type:"Private", videos:1 },
      { id:3, focus:"Net play",      focusId:"net", subs:["Volleys","Approach"],    d:"18", m:"MAY", type:"Group",   videos:3 },
      { id:4, focus:"Movement",      focusId:"move", subs:["Split step","Recovery"], d:"04", m:"MAY", type:"Private", videos:2 },
      { id:5, focus:"Match play",    focusId:"match", subs:["Point construction"],    d:"20", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Groundstrokes", focusId:"ground", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Groundstrokes", focusId:"ground", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Groundstrokes", focusId:"ground", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Groundstrokes", focusId:"ground", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Groundstrokes", focusId:"ground", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Groundstrokes", focusId:"ground", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Groundstrokes", focusId:"ground", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Groundstrokes", focusId:"ground", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Groundstrokes", focusId:"ground", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Groundstrokes", focusId:"ground", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Groundstrokes", focusId:"ground", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Groundstrokes", focusId:"ground", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Groundstrokes", focusId:"ground", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Groundstrokes", focusId:"ground", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Groundstrokes", focusId:"ground", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
  rowing: {
    noun: "rower", nouns: "rowers",
    label: "Rowing", tagline: "Catch, drive, rhythm",
    theme: { ink: "#10222E", sub: "#4E6473", faint: "#93A6B2", hair: "#E2EAEF",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#E9F1F5", mark: "#2E6E8E", accent: "#2E6E8E", onAccent: "#FFFFFF" },
    focus: [
      { id: "catch",  label: "Catch",    subs: ["Blade entry", "Reach", "Timing", "Connection"] },
      { id: "drive",  label: "Drive",    subs: ["Leg drive", "Sequencing", "Body swing", "Power"] },
      { id: "finish", label: "Finish",   subs: ["Extraction", "Tap down", "Hands away", "Clean release"] },
      { id: "rhythm", label: "Rhythm",   subs: ["Ratio", "Slide control", "Stroke rate", "Crew timing"] },
      { id: "race",   label: "Race craft", subs: ["Starts", "Pacing", "Steering", "Mental game"] },
    ],
    angles: ["Side on", "Bow mounted", "From the launch", "Slow motion"],
    drills: [
      { t: "Pause at the finish", d: "Ten strokes, hold two seconds each.", focus: "finish" },
      { t: "Square blade rowing", d: "Five minutes, no feathering.", focus: "catch" },
      { t: "Legs only",           d: "Bottom quarter of the slide, twenty strokes.", focus: "drive" },
      { t: "Ratio pyramid",       d: "18, 20, 22, 20, 18 spm. Two minutes each.", focus: "rhythm" },
      { t: "Feet out",            d: "Two minutes. Stay connected through the finish.", focus: "finish" },
      { t: "Pick drill",          d: "Arms, arms and body, half slide, full slide.", focus: "drive" },
      { t: "Cutting the cake",    d: "Blade just off the water, ten strokes.", focus: "catch" },
      { t: "Pause at the catch",  d: "Ten strokes, hold at full compression.", focus: "catch" },
      { t: "Race starts",         d: "Five strokes short, build to race pace.", focus: "race" },
      { t: "Negative split piece",d: "Two by ten minutes, faster in the second half.", focus: "race" },
    ],
    tipLibrary: [
      { t: "Hands away before the body", d: "Let the hands clear the knees before you start to swing — sequencing, not speed.", focus: "finish" },
      { t: "Send, don't rush",   d: "Match the recovery speed to the boat's run — rushing up the slide checks it.", focus: "rhythm" },
      { t: "Square early",       d: "Roll the blade square well before the catch, not as you enter — smooths the stroke.", focus: "catch" },
      { t: "Drive with the legs first", d: "Legs, then back, then arms — the order matters more than the effort.", focus: "drive" },
      { t: "Relax the grip",     d: "A tight grip on the recovery is costing you the connection at the catch.", focus: "catch" },
      { t: "Breathe with the stroke", d: "One breath per stroke keeps the rhythm honest, especially over longer pieces.", focus: "rhythm" },
    ],
    goals: [
      "Hold a steady 20 spm for 20 minutes", "Row in the club's first eight", "Improve 2k erg time",
      "Row confidently in rough water", "Master the single scull",
    ],
    statCatalog: [
      { id: "twok",   l: "2k time",  u: "", manual: true },
      { id: "split",  l: "Split",    u: "/500m" },
      { id: "rate",   l: "Rate",     u: "spm" },
      { id: "dist",   l: "Distance", u: "km/wk" },
      { id: "drag",   l: "Drag",     u: "factor" },
      { id: "sess",   l: "Sessions", u: "/wk" },
      { id: "hr",     l: "Avg HR",   u: "bpm" },
      { id: "power",  l: "Watts",    u: "avg" },
    ],
    statValues: { twok: { v: "7:12" }, split: { v: "1:58", m: "−4s" }, rate: { v: "24", m: "+2" },
                  dist: { v: "62", m: "+8" }, drag: { v: "118" }, sess: { v: "5", m: "+1" },
                  hr: { v: "162", m: "−4" }, power: { v: "241", m: "+12" } },
    defaultStats: ["split", "rate", "dist"],
    chart: { label: "2k split", note: "Lower is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [126,124,123,121,119,118] },
    transcript: "Good session. Most of it went on the catch — you're getting the blade in before the legs go now, instead of the other way round. Keep the square blade work going before we meet again, five minutes at a low rate.",
    lessons: [
      { id:1, focus:"Catch",      focusId:"catch",  subs:["Blade entry","Timing"],   d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Rhythm",     focusId:"rhythm", subs:["Ratio","Slide control"],  d:"02", m:"JUN", type:"Group",   videos:1 },
      { id:3, focus:"Drive",      focusId:"drive",  subs:["Leg drive","Sequencing"], d:"18", m:"MAY", type:"Private", videos:3 },
      { id:4, focus:"Race craft", focusId:"race",   subs:["Starts","Pacing"],        d:"04", m:"MAY", type:"Group",   videos:2 },
      { id:5, focus:"Finish",     focusId:"finish", subs:["Extraction"],             d:"20", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Race craft", focusId:"race", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Race craft", focusId:"race", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Race craft", focusId:"race", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Race craft", focusId:"race", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Race craft", focusId:"race", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Race craft", focusId:"race", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Race craft", focusId:"race", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Race craft", focusId:"race", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Race craft", focusId:"race", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Race craft", focusId:"race", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Race craft", focusId:"race", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Race craft", focusId:"race", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Race craft", focusId:"race", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Race craft", focusId:"race", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Race craft", focusId:"race", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
  squash: {
    noun: "player", nouns: "players",
    label: "Squash", tagline: "Length, volley, movement",
    theme: { ink: "#241A14", sub: "#6B584C", faint: "#AC9C90", hair: "#EFE7E0",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#F4EBE4", mark: "#B5562E", accent: "#B5562E", onAccent: "#FFFFFF" },
    focus: [
      { id: "length",  label: "Length",     subs: ["Drives", "Depth", "Width", "Height"] },
      { id: "volley",  label: "Volley",     subs: ["Interception", "Straight volley", "Volley drop", "Cross-court"] },
      { id: "move",    label: "Movement",   subs: ["T position", "Lunge", "Recovery", "Split step"] },
      { id: "short",   label: "Short game", subs: ["Drop shot", "Boast", "Kill", "Trickle boast"] },
      { id: "match",   label: "Match play", subs: ["Tactics", "Serve", "Return", "Pressure"] },
    ],
    angles: ["Back wall", "Side on", "Court level", "Slow motion"],
    drills: [
      { t: "Solo drives",       d: "Fifty each side, back of the service box.", focus: "length" },
      { t: "Boast drive drive", d: "Ten minutes, swap after five.", focus: "short" },
      { t: "Ghosting",          d: "Six corners, three sets of ninety seconds.", focus: "move" },
      { t: "Figure of eight",   d: "Two minutes continuous volleying.", focus: "volley" },
      { t: "Length target",     d: "Twenty balls past the service line.", focus: "length" },
      { t: "Serve and length",  d: "Ten serves, each followed by a length return.", focus: "match" },
      { t: "Kill shot practice",d: "Twenty from mid-court, low and hard.", focus: "short" },
      { t: "Cross-court volleys", d: "Two minutes, both hands, no floor bounce.", focus: "volley" },
      { t: "Conditioned game — length only", d: "First to eleven, length shots only.", focus: "match" },
      { t: "Front-back ghosting", d: "Six reps, boast corner to back corner.", focus: "move" },
    ],
    tipLibrary: [
      { t: "Get back to the T",  d: "Recovery to the T after every shot, not just the good ones.", focus: "move" },
      { t: "Watch the ball onto the racquet", d: "Eyes on contact, not the opponent — mishits come from looking up early.", focus: "length" },
      { t: "Hit with height, not just pace", d: "A higher length ball buys more recovery time than a flat hard one.", focus: "length" },
      { t: "Take the racquet back early", d: "Early preparation is what's giving you the extra split second on the volley.", focus: "volley" },
      { t: "Vary the pace, not just the length", d: "A slower ball disrupts their rhythm more than raw pace does.", focus: "match" },
      { t: "Stay low through the lunge", d: "Bend the knee, not the back — it's saving your reach on the wide ball.", focus: "move" },
    ],
    goals: [
      "Win a club league match", "Improve length consistency", "Confident with the boast",
      "Compete in a first tournament", "Sustain a 90-second rally",
    ],
    statCatalog: [
      { id: "rank",    l: "Ranking",  u: "", manual: true },
      { id: "length",  l: "Length",   u: "%" },
      { id: "winners", l: "Winners",  u: "/game" },
      { id: "errors",  l: "Errors",   u: "/game" },
      { id: "matches", l: "Matches",  u: "played" },
      { id: "rallies", l: "Rallies",  u: "won %" },
      { id: "tpos",    l: "T position", u: "%" },
      { id: "lets",    l: "Lets",     u: "/game" },
    ],
    statValues: { rank: { v: "142" }, length: { v: "61", m: "+9" }, winners: { v: "8", m: "+3" },
                  errors: { v: "11", m: "−4" }, matches: { v: "14", m: "+4" }, rallies: { v: "54", m: "+6" },
                  tpos: { v: "68", m: "+8" }, lets: { v: "2.1", m: "−0.8" } },
    defaultStats: ["length", "winners", "errors"],
    chart: { label: "Length accuracy", note: "Higher is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [48,51,53,56,59,61] },
    transcript: "Good session. Most of it went on length — you're getting the ball behind the service line far more often, which is buying you the T. Keep the solo drives going before we meet again, fifty each side.",
    lessons: [
      { id:1, focus:"Length",     focusId:"length", subs:["Drives","Depth"],        d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Volley",     focusId:"volley", subs:["Interception"],          d:"02", m:"JUN", type:"Private", videos:1 },
      { id:3, focus:"Movement",   focusId:"move",   subs:["T position","Lunge"],    d:"18", m:"MAY", type:"Group",   videos:3 },
      { id:4, focus:"Short game", focusId:"short",  subs:["Drop shot","Boast"],     d:"04", m:"MAY", type:"Private", videos:2 },
      { id:5, focus:"Match play", focusId:"match",  subs:["Tactics"],               d:"20", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Short game", focusId:"short", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Match play", focusId:"match", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Short game", focusId:"short", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Match play", focusId:"match", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Short game", focusId:"short", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Match play", focusId:"match", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Short game", focusId:"short", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Match play", focusId:"match", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Short game", focusId:"short", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Match play", focusId:"match", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Short game", focusId:"short", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Match play", focusId:"match", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Short game", focusId:"short", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Match play", focusId:"match", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Short game", focusId:"short", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
  padel: {
    noun: "player", nouns: "players",
    label: "Padel", tagline: "Walls, net play, pairs",
    theme: { ink: "#1E1830", sub: "#5C5473", faint: "#A199B4", hair: "#E9E5F0",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#EFEBF7", mark: "#6B4E9E", accent: "#6B4E9E", onAccent: "#FFFFFF" },
    focus: [
      { id: "walls",  label: "Wall play",     subs: ["Back wall", "Side wall", "Double wall", "Defensive lob"] },
      { id: "serve",  label: "Serve & return", subs: ["Underarm serve", "Placement", "Return depth", "Positioning"] },
      { id: "net",    label: "Net play",      subs: ["Volleys", "Bandeja", "Víbora", "Smash"] },
      { id: "ground", label: "Groundstrokes", subs: ["Forehand", "Backhand", "Lob", "Chiquita"] },
      { id: "pairs",  label: "Pair play",     subs: ["Positioning", "Communication", "Point construction", "Pressure"] },
    ],
    angles: ["Behind the glass", "Side on", "Court level", "Slow motion"],
    drills: [
      { t: "Wall rebound rally", d: "Twenty off the back glass, no volley.", focus: "walls" },
      { t: "Bandeja repetition", d: "Thirty, alternating deep and short.", focus: "net" },
      { t: "Lob and recover",    d: "Ten lobs, sprint back to the net each time.", focus: "ground" },
      { t: "Chiquita drill",     d: "Twenty low balls to their feet.", focus: "ground" },
      { t: "Pair shadowing",     d: "Five minutes moving as a unit, no ball.", focus: "pairs" },
      { t: "Serve and move",     d: "Ten serves, follow each one in to the net.", focus: "serve" },
      { t: "Víbora repetition",  d: "Twenty, alternating sides.", focus: "net" },
      { t: "Double wall defence",d: "Fifteen off the back and side glass together.", focus: "walls" },
      { t: "Smash and recover",  d: "Ten overheads, reset position after each one.", focus: "net" },
      { t: "Two-against-one pressure", d: "Three minutes, rotate the pair every point.", focus: "pairs" },
    ],
    tipLibrary: [
      { t: "Let the ball drop for the bandeja", d: "Don't rush it — let it come down to shoulder height before playing it soft.", focus: "net" },
      { t: "Use the walls, don't fight them", d: "Read the rebound early rather than turning your back to it.", focus: "walls" },
      { t: "Chiquita to bring them forward", d: "The soft low ball at their feet pulls them out of position more than any big hit.", focus: "ground" },
      { t: "Communicate before the point", d: "Call the ball early and often — most net errors are two players going for the same shot.", focus: "pairs" },
      { t: "Serve to set up the point", d: "It doesn't need to be a winner — it needs to get you to the net first.", focus: "serve" },
      { t: "Defensive lob height", d: "When in trouble, get real height on it — a flat lob is a free smash for them.", focus: "walls" },
    ],
    goals: [
      "Master the bandeja", "Confident at the net as a pair", "Win a club social tournament",
      "Consistent underarm serve", "Read the wall rebound reliably",
    ],
    statCatalog: [
      { id: "level",   l: "Level",     u: "", manual: true },
      { id: "bandeja", l: "Bandeja",   u: "%" },
      { id: "lobs",    l: "Lobs won",  u: "%" },
      { id: "errors",  l: "Errors",    u: "/set" },
      { id: "net",     l: "Net points", u: "won %" },
      { id: "matches", l: "Matches",   u: "played" },
      { id: "smash",   l: "Smash",     u: "won %" },
      { id: "walls",   l: "Wall shots", u: "%" },
    ],
    statValues: { level: { v: "3.5" }, bandeja: { v: "64", m: "+11" }, lobs: { v: "58", m: "+7" },
                  errors: { v: "9", m: "−3" }, net: { v: "62", m: "+8" }, matches: { v: "16", m: "+5" },
                  smash: { v: "71", m: "+9" }, walls: { v: "66", m: "+10" } },
    defaultStats: ["bandeja", "lobs", "net"],
    chart: { label: "Net points won", note: "Higher is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [48,51,54,57,60,62] },
    transcript: "Good session. Most of it went on the bandeja — you're holding the net instead of getting pushed back, and the contact point is much more consistent. Keep the repetition drill going before we meet again, thirty of them.",
    lessons: [
      { id:1, focus:"Net play",      focusId:"net",    subs:["Bandeja"],                d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Wall play",     focusId:"walls",  subs:["Back wall"],              d:"02", m:"JUN", type:"Private", videos:1 },
      { id:3, focus:"Pair play",     focusId:"pairs",  subs:["Positioning"],            d:"18", m:"MAY", type:"Group",   videos:3 },
      { id:4, focus:"Groundstrokes", focusId:"ground", subs:["Lob","Chiquita"],         d:"04", m:"MAY", type:"Private", videos:2 },
      { id:5, focus:"Serve & return", focusId:"serve", subs:["Placement"],              d:"20", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Groundstrokes", focusId:"ground", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Serve & return", focusId:"serve", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Groundstrokes", focusId:"ground", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Serve & return", focusId:"serve", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Groundstrokes", focusId:"ground", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Serve & return", focusId:"serve", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Groundstrokes", focusId:"ground", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Serve & return", focusId:"serve", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Groundstrokes", focusId:"ground", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Serve & return", focusId:"serve", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Groundstrokes", focusId:"ground", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Serve & return", focusId:"serve", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Groundstrokes", focusId:"ground", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Serve & return", focusId:"serve", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Groundstrokes", focusId:"ground", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
  equestrian: {
    noun: "rider", nouns: "riders",
    label: "Equestrian", tagline: "Dressage and show jumping",
    theme: { ink: "#241A1D", sub: "#6A585D", faint: "#AB9AA0", hair: "#EEE6E8",
             page: "#FFFFFF", surface: "#FFFFFF", wash: "#F4EBEE", mark: "#7A3B4A", accent: "#7A3B4A", onAccent: "#FFFFFF" },
    focus: [
      { id: "flat",     label: "Flatwork",   subs: ["Rhythm", "Contact", "Straightness", "Transitions"] },
      { id: "dressage", label: "Dressage",   subs: ["Test accuracy", "Centre line", "Halt", "Movements"] },
      { id: "jumping",  label: "Jumping",    subs: ["Approach", "Take-off", "Release", "Landing"] },
      { id: "course",   label: "Course craft", subs: ["Striding", "Turns", "Related distances", "Pace"] },
      { id: "position", label: "Rider position", subs: ["Seat", "Leg", "Hands", "Balance"] },
    ],
    angles: ["Side on", "Head on", "Arena corner", "Slow motion"],
    drills: [
      { t: "Transitions on a circle", d: "Walk-trot every eight strides, both reins.", focus: "flat" },
      { t: "Grid work",               d: "Placing pole, cross, one stride, upright.", focus: "jumping" },
      { t: "Poles on a circle",       d: "Four poles, twenty metre circle, keep the rhythm.", focus: "flat" },
      { t: "Shoulder-in",             d: "Long side, both reins, three times each.", focus: "flat" },
      { t: "Halt and salute",         d: "Down the centre line, ten times.", focus: "dressage" },
      { t: "No-stirrup work",         d: "Five minutes rising and sitting trot, both reins.", focus: "position" },
      { t: "Related distances",       d: "Five and six strides between two fences, count out loud.", focus: "course" },
      { t: "Turn on the forehand",    d: "Both reins, focus on quiet hands throughout.", focus: "position" },
      { t: "Related distance course", d: "Four fences on related lines, hold the canter.", focus: "course" },
      { t: "Test movements in order", d: "Ride the test from memory, no letters called.", focus: "dressage" },
    ],
    tipLibrary: [
      { t: "Ride from back to front", d: "Inside leg to outside rein — contact should follow from the hind leg, not the hands.", focus: "flat" },
      { t: "Look up and ahead",  d: "Eyes to where you're going, not down at the fence — the horse follows where you look.", focus: "jumping" },
      { t: "Soft hands, following the motion", d: "The elbow should give with the horse's mouth, not brace against it.", focus: "flat" },
      { t: "Ride the corners properly", d: "Use every corner to rebalance — cutting them costs the quality of what's next.", focus: "course" },
      { t: "Keep the leg on after the jump", d: "Don't drop the contact on landing — stay in balance and keep riding forward.", focus: "jumping" },
      { t: "Rhythm before accuracy", d: "A rushed, uneven stride will beat you every time — rhythm first, then the lines.", focus: "dressage" },
    ],
    goals: [
      "Confident at Prelim dressage", "Jump a clear round at 80cm", "Ride a balanced canter transition",
      "Compete at a first show", "Improve position over fences",
    ],
    statCatalog: [
      { id: "score",   l: "Dressage", u: "%", manual: true },
      { id: "clears",  l: "Clears",   u: "%" },
      { id: "faults",  l: "Faults",   u: "/round" },
      { id: "comps",   l: "Events",   u: "entered" },
      { id: "hours",   l: "Schooling", u: "hrs/wk" },
      { id: "jumpoff", l: "Jump-offs", u: "reached" },
      { id: "time",    l: "Time faults", u: "/round" },
      { id: "height",  l: "Height",    u: "cm" },
    ],
    statValues: { score: { v: "66.4" }, clears: { v: "58", m: "+12" }, faults: { v: "3.2", m: "−1.8" },
                  comps: { v: "9", m: "+3" }, hours: { v: "6", m: "+1" }, jumpoff: { v: "5", m: "+2" },
                  time: { v: "0.4", m: "−0.9" }, height: { v: "115", m: "+10" } },
    defaultStats: ["score", "clears", "faults"],
    chart: { label: "Dressage score", note: "Higher is better", labels: ["Feb","Mar","Apr","May","Jun","Jul"], data: [61,62,63,64,65,66] },
    transcript: "Good session. Most of it went on straightness through the corners — she's not falling in on the left rein nearly as much now. Keep the shoulder-in going before we meet again, three times each way.",
    lessons: [
      { id:1, focus:"Flatwork",       focusId:"flat",     subs:["Straightness","Contact"], d:"14", m:"JUN", type:"Private", videos:2, unread:true },
      { id:2, focus:"Dressage",       focusId:"dressage", subs:["Centre line","Halt"],     d:"02", m:"JUN", type:"Private", videos:1 },
      { id:3, focus:"Jumping",        focusId:"jumping",  subs:["Approach","Take-off"],    d:"18", m:"MAY", type:"Group",   videos:3 },
      { id:4, focus:"Course craft",   focusId:"course",   subs:["Striding","Turns"],       d:"04", m:"MAY", type:"Private", videos:2 },
      { id:5, focus:"Rider position", focusId:"position", subs:["Seat","Balance"],         d:"20", m:"APR", type:"Private", videos:1 },
      { id:6, focus:"Rider position", focusId:"position", subs:[], d:"28", m:"APR", type:"Group", videos:0 },
      { id:7, focus:"Rider position", focusId:"position", subs:[], d:"14", m:"APR", type:"Private", videos:1 },
      { id:8, focus:"Rider position", focusId:"position", subs:[], d:"02", m:"APR", type:"Private", videos:2 },
      { id:9, focus:"Rider position", focusId:"position", subs:[], d:"21", m:"MAR", type:"Group", videos:3 },
      { id:10, focus:"Rider position", focusId:"position", subs:[], d:"09", m:"MAR", type:"Private", videos:0 },
      { id:11, focus:"Rider position", focusId:"position", subs:[], d:"24", m:"FEB", type:"Private", videos:1 },
      { id:12, focus:"Rider position", focusId:"position", subs:[], d:"11", m:"FEB", type:"Group", videos:2 },
      { id:13, focus:"Rider position", focusId:"position", subs:[], d:"29", m:"JAN", type:"Private", videos:3 },
      { id:14, focus:"Rider position", focusId:"position", subs:[], d:"16", m:"JAN", type:"Private", videos:0 },
      { id:15, focus:"Rider position", focusId:"position", subs:[], d:"04", m:"JAN", type:"Group", videos:1 },
      { id:16, focus:"Rider position", focusId:"position", subs:[], d:"18", m:"DEC", type:"Private", videos:2 },
      { id:17, focus:"Rider position", focusId:"position", subs:[], d:"06", m:"DEC", type:"Private", videos:3 },
      { id:18, focus:"Rider position", focusId:"position", subs:[], d:"22", m:"NOV", type:"Group", videos:0 },
      { id:19, focus:"Rider position", focusId:"position", subs:[], d:"08", m:"NOV", type:"Private", videos:1 },
      { id:20, focus:"Rider position", focusId:"position", subs:[], d:"25", m:"OCT", type:"Private", videos:2 },
    ],
  },
};

/* ==================================================================
   WHAT ACTUALLY DIFFERS BETWEEN SPORTS
   Each sport gets one tool that only makes sense for that sport, and
   its own tip prompts. A yardage book is meaningless in rowing; an erg
   test is meaningless in equestrian. This is where the app stops being
   one product with six colour schemes.
================================================================== */
const TOOLS = {
  golf: {
    id: "yardage", label: "Yardage book", icon: "Tag",
    blurb: "Your carry with every club",
    columns: ["Club", "Carry", "Total"],
    rows: [["Driver","248","271"],["3 wood","215","233"],["5 iron","178","186"],
           ["7 iron","158","164"],["9 iron","135","140"],["PW","118","122"],["SW","92","95"]],
    addLabel: "Add a club",
    note: "Measured on the launch monitor. Update after a fitting.",
  },
  tennis: {
    id: "matches", label: "Match log", icon: "Trophy",
    blurb: "Results and what decided them",
    columns: ["Opponent", "Score", "Result"],
    rows: [["R. Kavanagh","6–4 3–6 7–5","Won"],["M. Byrne","4–6 2–6","Lost"],
           ["S. Doyle","6–2 6–3","Won"],["T. Nolan","7–6 6–4","Won"]],
    addLabel: "Log a match",
    note: "Your coach sees these and can spot the pattern across a season.",
  },
  rowing: {
    id: "ergs", label: "Erg tests", icon: "TrendingUp",
    blurb: "Every test piece, in order",
    columns: ["Piece", "Time", "Split"],
    rows: [["2k","7:12.4","1:48.1"],["5k","19:04.2","1:54.4"],["30r20","8,240m","1:49.0"],
           ["1k","3:24.8","1:42.4"]],
    addLabel: "Add a test",
    note: "Drag factor and date are recorded with each piece.",
  },
  squash: {
    id: "ladder", label: "Ladder & matches", icon: "TrendingUp",
    blurb: "Where you sit at the club",
    columns: ["Opponent", "Score", "Result"],
    rows: [["D. Fitzgerald","11–8 11–6 9–11 11–7","Won"],["A. Kelly","7–11 9–11 11–13","Lost"],
           ["P. Ryan","11–5 11–9 11–7","Won"]],
    addLabel: "Log a match",
    note: "Club ladder position updates when you record a result.",
  },
  padel: {
    id: "partners", label: "Partners", icon: "Users",
    blurb: "Who you play with, and how it goes",
    columns: ["Partner", "Played", "Won"],
    rows: [["Jack Whelan","14","9"],["Marta Ruiz","8","6"],["Diego Sanz","5","2"]],
    addLabel: "Add a partner",
    note: "Padel is a pairs game — form depends on who's beside you.",
  },
  equestrian: {
    id: "horses", label: "Horses", icon: "Award",
    blurb: "Each horse, and how they go",
    columns: ["Horse", "Age", "Working on"],
    rows: [["Bracken","9","Straightness on the left rein"],
           ["Corrib Lad","7","Confidence into doubles"],
           ["Willow","12","Maintaining rhythm in the test"]],
    addLabel: "Add a horse",
    note: "Every lesson records which horse you rode.",
  },
};

/* Tip prompts a coach in that sport would actually write. */
const TIP_PROMPTS = {
  golf:       ["Tempo over speed", "Commit to the shape", "Same routine every shot", "Take one more club"],
  tennis:     ["First serve percentage", "Recover to the middle", "Height over the net", "Play the big points simply"],
  rowing:     ["Ratio, not rate", "Send the boat", "Hold the finish", "Breathe on the recovery"],
  squash:     ["Take the T back every time", "Length before width", "Volley earlier", "Watch the ball onto the racquet"],
  padel:      ["Lob when you're under pressure", "Let the glass do the work", "Bandeja, don't smash", "Move as a pair"],
  equestrian: ["Rhythm before everything", "Ride the corners", "Soften when she gives", "Look up and plan the turn"],
};

const COACHES = {
  golf:       [{ name: "Ray Doyle", club: "" }, { name: "Anna Vance", club: "Deerfield GC" }],
  tennis:     [{ name: "Luca Ferri", club: "Westside Courts" }, { name: "Nina Park", club: "Riverbank LTC" }],
  rowing:     [{ name: "Cormac Bell", club: "Neptune RC" }, { name: "Ida Sørensen", club: "Commercial RC" }],
  squash:     [{ name: "Rory Nolan", club: "Fitzwilliam LTC" }, { name: "Mei Chen", club: "Sutton Squash" }],
  padel:      [{ name: "Sofía Márquez", club: "Padel Dublin" }, { name: "Jack Whelan", club: "Sandyford Padel" }],
  equestrian: [{ name: "Aoife Kearns", club: "Bracken Hill" }, { name: "Piet van Dam", club: "Ashfield Equestrian" }],
};

/* ==================================================================
   LANGUAGE — covers the interface itself. Lesson content, drills and
   coach-written notes stay in whatever language they were written in,
   which is the honest behaviour: we don't machine-translate a coach.
================================================================== */
/* Region first, then language — the way Apple and Google do it, and the
   way people actually think about it. Region also decides date format
   and currency, so it is not a cosmetic choice. */
/* ==================================================================
   EUROPE
   Every country in Europe, each mapped to the languages actually
   spoken there. A person picks a country, then a language — and from
   that point the app is in that language only. No English fallback in
   the interface, because a half-translated app tells someone they were
   an afterthought.
================================================================== */
const REGIONS = [
  { id: "al", name: "Shqipëri",            en: "Albania",        langs: ["sq"] },
  { id: "at", name: "Österreich",          en: "Austria",        langs: ["de"] },
  { id: "be", name: "België · Belgique",   en: "Belgium",        langs: ["nl", "fr", "de"] },
  { id: "ba", name: "Bosna i Hercegovina", en: "Bosnia",         langs: ["hr", "sr"] },
  { id: "bg", name: "България",            en: "Bulgaria",       langs: ["bg"] },
  { id: "hr", name: "Hrvatska",            en: "Croatia",        langs: ["hr"] },
  { id: "cy", name: "Κύπρος",              en: "Cyprus",         langs: ["el", "tr"] },
  { id: "cz", name: "Česko",               en: "Czechia",        langs: ["cs"] },
  { id: "dk", name: "Danmark",             en: "Denmark",        langs: ["da"] },
  { id: "ee", name: "Eesti",               en: "Estonia",        langs: ["et"] },
  { id: "fi", name: "Suomi",               en: "Finland",        langs: ["fi", "sv"] },
  { id: "fr", name: "France",              en: "France",         langs: ["fr"] },
  { id: "de", name: "Deutschland",         en: "Germany",        langs: ["de"] },
  { id: "gr", name: "Ελλάδα",              en: "Greece",         langs: ["el"] },
  { id: "hu", name: "Magyarország",        en: "Hungary",        langs: ["hu"] },
  { id: "is", name: "Ísland",              en: "Iceland",        langs: ["is"] },
  { id: "ie", name: "Éire · Ireland",      en: "Ireland",        langs: ["en", "ga"] },
  { id: "it", name: "Italia",              en: "Italy",          langs: ["it"] },
  { id: "lv", name: "Latvija",             en: "Latvia",         langs: ["lv"] },
  { id: "lt", name: "Lietuva",             en: "Lithuania",      langs: ["lt"] },
  { id: "lu", name: "Luxembourg",          en: "Luxembourg",     langs: ["fr", "de"] },
  { id: "mt", name: "Malta",               en: "Malta",          langs: ["mt", "en"] },
  { id: "md", name: "Moldova",             en: "Moldova",        langs: ["ro"] },
  { id: "me", name: "Crna Gora",           en: "Montenegro",     langs: ["sr"] },
  { id: "nl", name: "Nederland",           en: "Netherlands",    langs: ["nl"] },
  { id: "mk", name: "Северна Македонија",  en: "North Macedonia", langs: ["mk"] },
  { id: "no", name: "Norge",               en: "Norway",         langs: ["no"] },
  { id: "pl", name: "Polska",              en: "Poland",         langs: ["pl"] },
  { id: "pt", name: "Portugal",            en: "Portugal",       langs: ["pt"] },
  { id: "ro", name: "România",             en: "Romania",        langs: ["ro"] },
  { id: "rs", name: "Србија",              en: "Serbia",         langs: ["sr"] },
  { id: "sk", name: "Slovensko",           en: "Slovakia",       langs: ["sk"] },
  { id: "si", name: "Slovenija",           en: "Slovenia",       langs: ["sl"] },
  { id: "es", name: "España",              en: "Spain",          langs: ["es", "ca", "eu", "gl"] },
  { id: "se", name: "Sverige",             en: "Sweden",         langs: ["sv"] },
  { id: "ch", name: "Schweiz · Suisse",    en: "Switzerland",    langs: ["de", "fr", "it"] },
  { id: "tr", name: "Türkiye",             en: "Türkiye",        langs: ["tr"] },
  { id: "ua", name: "Україна",             en: "Ukraine",        langs: ["uk"] },
  { id: "gb", name: "United Kingdom",      en: "United Kingdom", langs: ["en", "cy"] },
];

/* Regional-indicator pairs render as the actual flag on iOS. Derived
   from the country code so there is no asset to ship or keep in sync. */
const flagOf = (id) => id.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

const LANGS = [
  { id: "en", native: "English" },      { id: "ga", native: "Gaeilge" },
  { id: "es", native: "Español" },      { id: "fr", native: "Français" },
  { id: "de", native: "Deutsch" },      { id: "it", native: "Italiano" },
  { id: "pt", native: "Português" },    { id: "nl", native: "Nederlands" },
  { id: "pl", native: "Polski" },       { id: "sv", native: "Svenska" },
  { id: "da", native: "Dansk" },        { id: "no", native: "Norsk" },
  { id: "fi", native: "Suomi" },        { id: "el", native: "Ελληνικά" },
  { id: "cs", native: "Čeština" },      { id: "ro", native: "Română" },
  { id: "hu", native: "Magyar" },       { id: "hr", native: "Hrvatski" },
  { id: "bg", native: "Български" },    { id: "sk", native: "Slovenčina" },
  { id: "sl", native: "Slovenščina" },  { id: "lt", native: "Lietuvių" },
  { id: "lv", native: "Latviešu" },     { id: "et", native: "Eesti" },
  { id: "uk", native: "Українська" },   { id: "tr", native: "Türkçe" },
  { id: "is", native: "Íslenska" },     { id: "mt", native: "Malti" },
  { id: "ca", native: "Català" },       { id: "eu", native: "Euskara" },
  { id: "gl", native: "Galego" },       { id: "sr", native: "Српски" },
  { id: "sq", native: "Shqip" },        { id: "mk", native: "Македонски" },
  { id: "cy", native: "Cymraeg" },
];

/* Interface strings. Keys are deliberately few and heavily reused, so a
   new language is one block rather than a scattered hunt. */
export const STRINGS = {
  en: { today:"Today", calendar:"Calendar", log:"Log", roster:"Roster", chats:"Messages", home:"Home", lessons:"Lessons", practice:"Practice", family:"Family", you:"You", settings:"Settings", search:"Search", alerts:"Alerts", save:"Save", cancel:"Cancel", done:"Done", skip:"Skip", continue:"Continue", publish:"Publish", back:"Back", language:"Language", region:"Country", appearance:"Appearance", darkMode:"Dark mode", textSize:"Text size", sound:"Sound", haptics:"Haptics", logLesson:"Log lesson", workingOn:"Working on", nextLesson:"Next lesson", players:"players", showOriginal:"Show original", showTranslation:"Show translation", translatedFor:"Translated for you", whereAreYou:"Country", yourLanguage:"Your language", yourSport:"Your sport", whichAreYou:"Which are you?", coach:"Coach", player:"Player", whoIsItFor:"Who is it for?", forMe:"It's for me", forMyChild:"It's for my child", imUnder18:"I'm under 18", yourDetails:"Your details", fullName:"Full name", email:"Email", mobile:"Mobile", password:"Password", dateOfBirth:"Date of birth", haveAccount:"Have an account?", signIn:"Sign in", getStarted:"Begin", teachAndEarn:"You teach and get paid", takeLessons:"You take lessons — always free", manageChild:"You manage someone under 18", parentSetUp:"A parent has already set you up", overEighteen:"You're 18 or over" },
  ga: { today:"Inniu", calendar:"Féilire", log:"Logáil", roster:"Rolla", chats:"Teachtaireachtaí", home:"Baile", lessons:"Ceachtanna", practice:"Cleachtadh", family:"Teaghlach", you:"Tusa", settings:"Socruithe", search:"Cuardaigh", alerts:"Foláirimh", save:"Sábháil", cancel:"Cealaigh", done:"Déanta", skip:"Scipeáil", continue:"Ar aghaidh", publish:"Foilsigh", back:"Ar ais", language:"Teanga", region:"Tír", appearance:"Cuma", darkMode:"Mód dorcha", textSize:"Méid téacs", sound:"Fuaim", haptics:"Aiseolas tadhaill", logLesson:"Logáil ceacht", workingOn:"Ag obair ar", nextLesson:"An chéad cheacht eile", players:"imreoirí", showOriginal:"Taispeáin an bunleagan", showTranslation:"Taispeáin an t-aistriúchán", translatedFor:"Aistrithe duitse", whereAreYou:"Cá bhfuil tú?", yourLanguage:"Do theanga", yourSport:"Do spórt", whichAreYou:"Cé acu tusa?", coach:"Traenálaí", player:"Imreoir", whoIsItFor:"Cé dó é?", forMe:"Domsa atá sé", forMyChild:"Do mo pháiste", imUnder18:"Táim faoi 18", yourDetails:"Do shonraí", fullName:"Ainm iomlán", email:"Ríomhphost", mobile:"Fón póca", password:"Pasfhocal", dateOfBirth:"Dáta breithe", haveAccount:"Cuntas agat?", signIn:"Sínigh isteach", getStarted:"Tosaigh", teachAndEarn:"Múineann tú agus faigheann tú íocaíocht", takeLessons:"Glacann tú ceachtanna — saor in aisce", manageChild:"Bainistíonn tú duine faoi 18", parentSetUp:"Tá tuismitheoir tar éis tú a shocrú", overEighteen:"Tá tú 18 nó níos sine" },
  es: { today:"Hoy", calendar:"Calendario", log:"Registrar", roster:"Alumnos", chats:"Mensajes", home:"Inicio", lessons:"Clases", practice:"Práctica", family:"Familia", you:"Tú", settings:"Ajustes", search:"Buscar", alerts:"Avisos", save:"Guardar", cancel:"Cancelar", done:"Hecho", skip:"Omitir", continue:"Continuar", publish:"Publicar", back:"Atrás", language:"Idioma", region:"País", appearance:"Apariencia", darkMode:"Modo oscuro", textSize:"Tamaño del texto", sound:"Sonido", haptics:"Vibración", logLesson:"Registrar clase", workingOn:"Trabajando en", nextLesson:"Próxima clase", players:"alumnos", showOriginal:"Ver original", showTranslation:"Ver traducción", translatedFor:"Traducido para ti", whereAreYou:"¿Dónde estás?", yourLanguage:"Tu idioma", yourSport:"Tu deporte", whichAreYou:"¿Qué eres?", coach:"Entrenador", player:"Jugador", whoIsItFor:"¿Para quién es?", forMe:"Es para mí", forMyChild:"Es para mi hijo/a", imUnder18:"Soy menor de 18", yourDetails:"Tus datos", fullName:"Nombre completo", email:"Correo", mobile:"Móvil", password:"Contraseña", dateOfBirth:"Fecha de nacimiento", haveAccount:"¿Ya tienes cuenta?", signIn:"Iniciar sesión", getStarted:"Empezar", teachAndEarn:"Enseñas y cobras", takeLessons:"Recibes clases — siempre gratis", manageChild:"Gestionas a un menor de 18", parentSetUp:"Un padre ya te ha dado de alta", overEighteen:"Tienes 18 años o más" },
  fr: { today:"Aujourd'hui", calendar:"Calendrier", log:"Séance", roster:"Élèves", chats:"Messages", home:"Accueil", lessons:"Leçons", practice:"Exercices", family:"Famille", you:"Vous", settings:"Réglages", search:"Rechercher", alerts:"Alertes", save:"Enregistrer", cancel:"Annuler", done:"Terminé", skip:"Passer", continue:"Continuer", publish:"Publier", back:"Retour", language:"Langue", region:"Pays", appearance:"Apparence", darkMode:"Mode sombre", textSize:"Taille du texte", sound:"Son", haptics:"Retour haptique", logLesson:"Noter la leçon", workingOn:"Travail en cours", nextLesson:"Prochaine leçon", players:"élèves", showOriginal:"Voir l'original", showTranslation:"Voir la traduction", translatedFor:"Traduit pour vous", whereAreYou:"Où êtes-vous ?", yourLanguage:"Votre langue", yourSport:"Votre sport", whichAreYou:"Vous êtes ?", coach:"Entraîneur", player:"Joueur", whoIsItFor:"C'est pour qui ?", forMe:"C'est pour moi", forMyChild:"C'est pour mon enfant", imUnder18:"J'ai moins de 18 ans", yourDetails:"Vos informations", fullName:"Nom complet", email:"E-mail", mobile:"Mobile", password:"Mot de passe", dateOfBirth:"Date de naissance", haveAccount:"Déjà un compte ?", signIn:"Se connecter", getStarted:"Commencer", teachAndEarn:"Vous enseignez et êtes payé", takeLessons:"Vous prenez des cours — toujours gratuit", manageChild:"Vous gérez un mineur", parentSetUp:"Un parent vous a déjà inscrit", overEighteen:"Vous avez 18 ans ou plus" },
  de: { today:"Heute", calendar:"Kalender", log:"Erfassen", roster:"Spieler", chats:"Nachrichten", home:"Start", lessons:"Stunden", practice:"Übungen", family:"Familie", you:"Du", settings:"Einstellungen", search:"Suchen", alerts:"Hinweise", save:"Sichern", cancel:"Abbrechen", done:"Fertig", skip:"Überspringen", continue:"Weiter", publish:"Veröffentlichen", back:"Zurück", language:"Sprache", region:"Land", appearance:"Darstellung", darkMode:"Dunkelmodus", textSize:"Schriftgröße", sound:"Ton", haptics:"Haptik", logLesson:"Stunde erfassen", workingOn:"Aktueller Fokus", nextLesson:"Nächste Stunde", players:"Spieler", showOriginal:"Original anzeigen", showTranslation:"Übersetzung anzeigen", translatedFor:"Für dich übersetzt", whereAreYou:"Wo bist du?", yourLanguage:"Deine Sprache", yourSport:"Deine Sportart", whichAreYou:"Was bist du?", coach:"Trainer", player:"Spieler", whoIsItFor:"Für wen ist es?", forMe:"Für mich", forMyChild:"Für mein Kind", imUnder18:"Ich bin unter 18", yourDetails:"Deine Angaben", fullName:"Vollständiger Name", email:"E-Mail", mobile:"Mobil", password:"Passwort", dateOfBirth:"Geburtsdatum", haveAccount:"Schon ein Konto?", signIn:"Anmelden", getStarted:"Loslegen", teachAndEarn:"Du unterrichtest und wirst bezahlt", takeLessons:"Du nimmst Stunden — immer kostenlos", manageChild:"Du verwaltest jemanden unter 18", parentSetUp:"Ein Elternteil hat dich eingerichtet", overEighteen:"Du bist 18 oder älter" },
  it: { today:"Oggi", calendar:"Calendario", log:"Registra", roster:"Allievi", chats:"Messaggi", home:"Home", lessons:"Lezioni", practice:"Esercizi", family:"Famiglia", you:"Tu", settings:"Impostazioni", search:"Cerca", alerts:"Avvisi", save:"Salva", cancel:"Annulla", done:"Fatto", skip:"Salta", continue:"Continua", publish:"Pubblica", back:"Indietro", language:"Lingua", region:"Paese", appearance:"Aspetto", darkMode:"Modo scuro", textSize:"Dimensione testo", sound:"Suono", haptics:"Vibrazione", logLesson:"Registra lezione", workingOn:"Al lavoro su", nextLesson:"Prossima lezione", players:"allievi", showOriginal:"Vedi originale", showTranslation:"Vedi traduzione", translatedFor:"Tradotto per te", whereAreYou:"Dove sei?", yourLanguage:"La tua lingua", yourSport:"Il tuo sport", whichAreYou:"Chi sei?", coach:"Allenatore", player:"Giocatore", whoIsItFor:"Per chi è?", forMe:"È per me", forMyChild:"È per mio figlio", imUnder18:"Ho meno di 18 anni", yourDetails:"I tuoi dati", fullName:"Nome completo", email:"Email", mobile:"Cellulare", password:"Password", dateOfBirth:"Data di nascita", haveAccount:"Hai già un account?", signIn:"Accedi", getStarted:"Inizia", teachAndEarn:"Insegni e vieni pagato", takeLessons:"Prendi lezioni — sempre gratis", manageChild:"Gestisci un minore di 18 anni", parentSetUp:"Un genitore ti ha già registrato", overEighteen:"Hai 18 anni o più" },
  pt: { today:"Hoje", calendar:"Calendário", log:"Registar", roster:"Alunos", chats:"Mensagens", home:"Início", lessons:"Aulas", practice:"Treino", family:"Família", you:"Tu", settings:"Definições", search:"Pesquisar", alerts:"Alertas", save:"Guardar", cancel:"Cancelar", done:"Concluído", skip:"Ignorar", continue:"Continuar", publish:"Publicar", back:"Voltar", language:"Idioma", region:"País", appearance:"Aparência", darkMode:"Modo escuro", textSize:"Tamanho do texto", sound:"Som", haptics:"Vibração", logLesson:"Registar aula", workingOn:"A trabalhar em", nextLesson:"Próxima aula", players:"alunos", showOriginal:"Ver original", showTranslation:"Ver tradução", translatedFor:"Traduzido para ti", whereAreYou:"Onde estás?", yourLanguage:"O teu idioma", yourSport:"O teu desporto", whichAreYou:"O que és?", coach:"Treinador", player:"Jogador", whoIsItFor:"Para quem é?", forMe:"É para mim", forMyChild:"É para o meu filho", imUnder18:"Tenho menos de 18", yourDetails:"Os teus dados", fullName:"Nome completo", email:"Email", mobile:"Telemóvel", password:"Palavra-passe", dateOfBirth:"Data de nascimento", haveAccount:"Já tens conta?", signIn:"Entrar", getStarted:"Começar", teachAndEarn:"Ensinas e recebes", takeLessons:"Tens aulas — sempre grátis", manageChild:"Geres um menor de 18", parentSetUp:"Um adulto já te registou", overEighteen:"Tens 18 anos ou mais" },
  nl: { today:"Vandaag", calendar:"Agenda", log:"Vastleggen", roster:"Spelers", chats:"Berichten", home:"Start", lessons:"Lessen", practice:"Oefenen", family:"Gezin", you:"Jij", settings:"Instellingen", search:"Zoeken", alerts:"Meldingen", save:"Opslaan", cancel:"Annuleren", done:"Klaar", skip:"Overslaan", continue:"Doorgaan", publish:"Publiceren", back:"Terug", language:"Taal", region:"Land", appearance:"Weergave", darkMode:"Donkere modus", textSize:"Tekstgrootte", sound:"Geluid", haptics:"Trillen", logLesson:"Les vastleggen", workingOn:"Werkt aan", nextLesson:"Volgende les", players:"spelers", showOriginal:"Origineel tonen", showTranslation:"Vertaling tonen", translatedFor:"Voor jou vertaald", whereAreYou:"Waar ben je?", yourLanguage:"Jouw taal", yourSport:"Jouw sport", whichAreYou:"Wat ben je?", coach:"Coach", player:"Speler", whoIsItFor:"Voor wie is het?", forMe:"Voor mezelf", forMyChild:"Voor mijn kind", imUnder18:"Ik ben onder de 18", yourDetails:"Jouw gegevens", fullName:"Volledige naam", email:"E-mail", mobile:"Mobiel", password:"Wachtwoord", dateOfBirth:"Geboortedatum", haveAccount:"Al een account?", signIn:"Inloggen", getStarted:"Beginnen", teachAndEarn:"Je geeft les en wordt betaald", takeLessons:"Je krijgt les — altijd gratis", manageChild:"Je beheert iemand onder de 18", parentSetUp:"Een ouder heeft je aangemeld", overEighteen:"Je bent 18 of ouder" },
  pl: { today:"Dziś", calendar:"Kalendarz", log:"Zapisz", roster:"Zawodnicy", chats:"Wiadomości", home:"Start", lessons:"Lekcje", practice:"Trening", family:"Rodzina", you:"Ty", settings:"Ustawienia", search:"Szukaj", alerts:"Powiadomienia", save:"Zapisz", cancel:"Anuluj", done:"Gotowe", skip:"Pomiń", continue:"Dalej", publish:"Opublikuj", back:"Wstecz", language:"Język", region:"Kraj", appearance:"Wygląd", darkMode:"Tryb ciemny", textSize:"Rozmiar tekstu", sound:"Dźwięk", haptics:"Wibracje", logLesson:"Zapisz lekcję", workingOn:"Pracuje nad", nextLesson:"Następna lekcja", players:"zawodnicy", showOriginal:"Pokaż oryginał", showTranslation:"Pokaż tłumaczenie", translatedFor:"Przetłumaczone dla ciebie", whereAreYou:"Gdzie jesteś?", yourLanguage:"Twój język", yourSport:"Twój sport", whichAreYou:"Kim jesteś?", coach:"Trener", player:"Zawodnik", whoIsItFor:"Dla kogo to jest?", forMe:"Dla mnie", forMyChild:"Dla mojego dziecka", imUnder18:"Mam mniej niż 18 lat", yourDetails:"Twoje dane", fullName:"Imię i nazwisko", email:"E-mail", mobile:"Telefon", password:"Hasło", dateOfBirth:"Data urodzenia", haveAccount:"Masz już konto?", signIn:"Zaloguj się", getStarted:"Zaczynajmy", teachAndEarn:"Uczysz i zarabiasz", takeLessons:"Bierzesz lekcje — zawsze za darmo", manageChild:"Zarządzasz osobą poniżej 18 lat", parentSetUp:"Rodzic już cię zarejestrował", overEighteen:"Masz 18 lat lub więcej" },
  sv: { today:"Idag", calendar:"Kalender", log:"Logga", roster:"Spelare", chats:"Meddelanden", home:"Hem", lessons:"Lektioner", practice:"Träning", family:"Familj", you:"Du", settings:"Inställningar", search:"Sök", alerts:"Aviseringar", save:"Spara", cancel:"Avbryt", done:"Klar", skip:"Hoppa över", continue:"Fortsätt", publish:"Publicera", back:"Tillbaka", language:"Språk", region:"Land", appearance:"Utseende", darkMode:"Mörkt läge", textSize:"Textstorlek", sound:"Ljud", haptics:"Vibration", logLesson:"Logga lektion", workingOn:"Arbetar med", nextLesson:"Nästa lektion", players:"spelare", showOriginal:"Visa original", showTranslation:"Visa översättning", translatedFor:"Översatt åt dig", whereAreYou:"Var är du?", yourLanguage:"Ditt språk", yourSport:"Din sport", whichAreYou:"Vad är du?", coach:"Tränare", player:"Spelare", whoIsItFor:"Vem är det för?", forMe:"Det är för mig", forMyChild:"Det är för mitt barn", imUnder18:"Jag är under 18", yourDetails:"Dina uppgifter", fullName:"Fullständigt namn", email:"E-post", mobile:"Mobil", password:"Lösenord", dateOfBirth:"Födelsedatum", haveAccount:"Har du ett konto?", signIn:"Logga in", getStarted:"Kom igång", teachAndEarn:"Du undervisar och får betalt", takeLessons:"Du tar lektioner — alltid gratis", manageChild:"Du hanterar någon under 18", parentSetUp:"En förälder har redan registrerat dig", overEighteen:"Du är 18 eller äldre" },
  da: { today:"I dag", calendar:"Kalender", log:"Log", roster:"Spillere", chats:"Beskeder", home:"Hjem", lessons:"Lektioner", practice:"Træning", family:"Familie", you:"Dig", settings:"Indstillinger", search:"Søg", alerts:"Notifikationer", save:"Gem", cancel:"Annuller", done:"Færdig", skip:"Spring over", continue:"Fortsæt", publish:"Udgiv", back:"Tilbage", language:"Sprog", region:"Land", appearance:"Udseende", darkMode:"Mørk tilstand", textSize:"Tekststørrelse", sound:"Lyd", haptics:"Vibration", logLesson:"Log lektion", workingOn:"Arbejder med", nextLesson:"Næste lektion", players:"spillere", showOriginal:"Vis original", showTranslation:"Vis oversættelse", translatedFor:"Oversat til dig", whereAreYou:"Hvor er du?", yourLanguage:"Dit sprog", yourSport:"Din sport", whichAreYou:"Hvad er du?", coach:"Træner", player:"Spiller", whoIsItFor:"Hvem er det til?", forMe:"Det er til mig", forMyChild:"Det er til mit barn", imUnder18:"Jeg er under 18", yourDetails:"Dine oplysninger", fullName:"Fulde navn", email:"E-mail", mobile:"Mobil", password:"Adgangskode", dateOfBirth:"Fødselsdato", haveAccount:"Har du en konto?", signIn:"Log ind", getStarted:"Kom i gang", teachAndEarn:"Du underviser og får betaling", takeLessons:"Du får lektioner — altid gratis", manageChild:"Du styrer en under 18", parentSetUp:"En forælder har oprettet dig", overEighteen:"Du er 18 eller derover" },
  no: { today:"I dag", calendar:"Kalender", log:"Logg", roster:"Spillere", chats:"Meldinger", home:"Hjem", lessons:"Timer", practice:"Trening", family:"Familie", you:"Du", settings:"Innstillinger", search:"Søk", alerts:"Varsler", save:"Lagre", cancel:"Avbryt", done:"Ferdig", skip:"Hopp over", continue:"Fortsett", publish:"Publiser", back:"Tilbake", language:"Språk", region:"Land", appearance:"Utseende", darkMode:"Mørk modus", textSize:"Tekststørrelse", sound:"Lyd", haptics:"Vibrasjon", logLesson:"Logg time", workingOn:"Jobber med", nextLesson:"Neste time", players:"spillere", showOriginal:"Vis original", showTranslation:"Vis oversettelse", translatedFor:"Oversatt for deg", whereAreYou:"Hvor er du?", yourLanguage:"Ditt språk", yourSport:"Din idrett", whichAreYou:"Hva er du?", coach:"Trener", player:"Spiller", whoIsItFor:"Hvem er det for?", forMe:"Det er for meg", forMyChild:"Det er for barnet mitt", imUnder18:"Jeg er under 18", yourDetails:"Dine opplysninger", fullName:"Fullt navn", email:"E-post", mobile:"Mobil", password:"Passord", dateOfBirth:"Fødselsdato", haveAccount:"Har du konto?", signIn:"Logg inn", getStarted:"Kom i gang", teachAndEarn:"Du underviser og får betalt", takeLessons:"Du tar timer — alltid gratis", manageChild:"Du styrer en under 18", parentSetUp:"En forelder har registrert deg", overEighteen:"Du er 18 eller eldre" },
  fi: { today:"Tänään", calendar:"Kalenteri", log:"Kirjaa", roster:"Pelaajat", chats:"Viestit", home:"Koti", lessons:"Tunnit", practice:"Harjoittelu", family:"Perhe", you:"Sinä", settings:"Asetukset", search:"Haku", alerts:"Ilmoitukset", save:"Tallenna", cancel:"Peruuta", done:"Valmis", skip:"Ohita", continue:"Jatka", publish:"Julkaise", back:"Takaisin", language:"Kieli", region:"Maa", appearance:"Ulkoasu", darkMode:"Tumma tila", textSize:"Tekstin koko", sound:"Ääni", haptics:"Värinä", logLesson:"Kirjaa tunti", workingOn:"Työn alla", nextLesson:"Seuraava tunti", players:"pelaajat", showOriginal:"Näytä alkuperäinen", showTranslation:"Näytä käännös", translatedFor:"Käännetty sinulle", whereAreYou:"Missä olet?", yourLanguage:"Kielesi", yourSport:"Lajisi", whichAreYou:"Kuka olet?", coach:"Valmentaja", player:"Pelaaja", whoIsItFor:"Kenelle tämä on?", forMe:"Se on minulle", forMyChild:"Se on lapselleni", imUnder18:"Olen alle 18", yourDetails:"Tietosi", fullName:"Koko nimi", email:"Sähköposti", mobile:"Puhelin", password:"Salasana", dateOfBirth:"Syntymäaika", haveAccount:"Onko sinulla tili?", signIn:"Kirjaudu", getStarted:"Aloita", teachAndEarn:"Opetat ja saat palkkaa", takeLessons:"Otat tunteja — aina ilmaista", manageChild:"Hallinnoit alle 18-vuotiasta", parentSetUp:"Vanhempi on jo rekisteröinyt sinut", overEighteen:"Olet 18 tai vanhempi" },
  el: { today:"Σήμερα", calendar:"Ημερολόγιο", log:"Καταγραφή", roster:"Αθλητές", chats:"Μηνύματα", home:"Αρχική", lessons:"Μαθήματα", practice:"Προπόνηση", family:"Οικογένεια", you:"Εσύ", settings:"Ρυθμίσεις", search:"Αναζήτηση", alerts:"Ειδοποιήσεις", save:"Αποθήκευση", cancel:"Ακύρωση", done:"Έτοιμο", skip:"Παράλειψη", continue:"Συνέχεια", publish:"Δημοσίευση", back:"Πίσω", language:"Γλώσσα", region:"Χώρα", appearance:"Εμφάνιση", darkMode:"Σκούρο θέμα", textSize:"Μέγεθος κειμένου", sound:"Ήχος", haptics:"Δόνηση", logLesson:"Καταγραφή μαθήματος", workingOn:"Δουλεύουμε σε", nextLesson:"Επόμενο μάθημα", players:"αθλητές", showOriginal:"Πρωτότυπο", showTranslation:"Μετάφραση", translatedFor:"Μεταφράστηκε για σένα", whereAreYou:"Πού βρίσκεσαι;", yourLanguage:"Η γλώσσα σου", yourSport:"Το άθλημά σου", whichAreYou:"Τι είσαι;", coach:"Προπονητής", player:"Αθλητής", whoIsItFor:"Για ποιον είναι;", forMe:"Για μένα", forMyChild:"Για το παιδί μου", imUnder18:"Είμαι κάτω των 18", yourDetails:"Τα στοιχεία σου", fullName:"Ονοματεπώνυμο", email:"Email", mobile:"Κινητό", password:"Κωδικός", dateOfBirth:"Ημερομηνία γέννησης", haveAccount:"Έχεις λογαριασμό;", signIn:"Σύνδεση", getStarted:"Ξεκίνα", teachAndEarn:"Διδάσκεις και πληρώνεσαι", takeLessons:"Κάνεις μαθήματα — πάντα δωρεάν", manageChild:"Διαχειρίζεσαι ανήλικο", parentSetUp:"Ένας γονέας σε έχει ήδη εγγράψει", overEighteen:"Είσαι 18 ή άνω" },
  cs: { today:"Dnes", calendar:"Kalendář", log:"Zapsat", roster:"Hráči", chats:"Zprávy", home:"Domů", lessons:"Lekce", practice:"Trénink", family:"Rodina", you:"Ty", settings:"Nastavení", search:"Hledat", alerts:"Upozornění", save:"Uložit", cancel:"Zrušit", done:"Hotovo", skip:"Přeskočit", continue:"Pokračovat", publish:"Zveřejnit", back:"Zpět", language:"Jazyk", region:"Země", appearance:"Vzhled", darkMode:"Tmavý režim", textSize:"Velikost textu", sound:"Zvuk", haptics:"Vibrace", logLesson:"Zapsat lekci", workingOn:"Pracujeme na", nextLesson:"Další lekce", players:"hráči", showOriginal:"Zobrazit originál", showTranslation:"Zobrazit překlad", translatedFor:"Přeloženo pro tebe", whereAreYou:"Kde jsi?", yourLanguage:"Tvůj jazyk", yourSport:"Tvůj sport", whichAreYou:"Kdo jsi?", coach:"Trenér", player:"Hráč", whoIsItFor:"Pro koho to je?", forMe:"Pro mě", forMyChild:"Pro mé dítě", imUnder18:"Je mi méně než 18", yourDetails:"Tvé údaje", fullName:"Celé jméno", email:"E-mail", mobile:"Mobil", password:"Heslo", dateOfBirth:"Datum narození", haveAccount:"Máš účet?", signIn:"Přihlásit se", getStarted:"Začít", teachAndEarn:"Učíš a dostáváš zaplaceno", takeLessons:"Chodíš na lekce — vždy zdarma", manageChild:"Spravuješ osobu do 18 let", parentSetUp:"Rodič tě už zaregistroval", overEighteen:"Je ti 18 nebo více" },
  ro: { today:"Azi", calendar:"Calendar", log:"Înregistrează", roster:"Sportivi", chats:"Mesaje", home:"Acasă", lessons:"Lecții", practice:"Antrenament", family:"Familie", you:"Tu", settings:"Setări", search:"Caută", alerts:"Alerte", save:"Salvează", cancel:"Anulează", done:"Gata", skip:"Omite", continue:"Continuă", publish:"Publică", back:"Înapoi", language:"Limbă", region:"Țară", appearance:"Aspect", darkMode:"Mod întunecat", textSize:"Mărimea textului", sound:"Sunet", haptics:"Vibrații", logLesson:"Înregistrează lecția", workingOn:"Lucrăm la", nextLesson:"Următoarea lecție", players:"sportivi", showOriginal:"Vezi originalul", showTranslation:"Vezi traducerea", translatedFor:"Tradus pentru tine", whereAreYou:"Unde ești?", yourLanguage:"Limba ta", yourSport:"Sportul tău", whichAreYou:"Ce ești?", coach:"Antrenor", player:"Jucător", whoIsItFor:"Pentru cine este?", forMe:"Este pentru mine", forMyChild:"Este pentru copilul meu", imUnder18:"Am sub 18 ani", yourDetails:"Datele tale", fullName:"Nume complet", email:"Email", mobile:"Telefon", password:"Parolă", dateOfBirth:"Data nașterii", haveAccount:"Ai deja cont?", signIn:"Conectează-te", getStarted:"Începe", teachAndEarn:"Predai și ești plătit", takeLessons:"Iei lecții — mereu gratuit", manageChild:"Administrezi un minor", parentSetUp:"Un părinte te-a înregistrat deja", overEighteen:"Ai 18 ani sau mai mult" },
  hu: { today:"Ma", calendar:"Naptár", log:"Rögzítés", roster:"Játékosok", chats:"Üzenetek", home:"Kezdőlap", lessons:"Órák", practice:"Gyakorlás", family:"Család", you:"Te", settings:"Beállítások", search:"Keresés", alerts:"Értesítések", save:"Mentés", cancel:"Mégse", done:"Kész", skip:"Kihagyás", continue:"Tovább", publish:"Közzététel", back:"Vissza", language:"Nyelv", region:"Ország", appearance:"Megjelenés", darkMode:"Sötét mód", textSize:"Szövegméret", sound:"Hang", haptics:"Rezgés", logLesson:"Óra rögzítése", workingOn:"Ezen dolgozunk", nextLesson:"Következő óra", players:"játékosok", showOriginal:"Eredeti megtekintése", showTranslation:"Fordítás megtekintése", translatedFor:"Neked lefordítva", whereAreYou:"Hol vagy?", yourLanguage:"A nyelved", yourSport:"A sportod", whichAreYou:"Ki vagy?", coach:"Edző", player:"Játékos", whoIsItFor:"Kinek szól?", forMe:"Nekem", forMyChild:"A gyermekemnek", imUnder18:"18 év alatti vagyok", yourDetails:"Adataid", fullName:"Teljes név", email:"E-mail", mobile:"Mobil", password:"Jelszó", dateOfBirth:"Születési dátum", haveAccount:"Van már fiókod?", signIn:"Bejelentkezés", getStarted:"Kezdjük", teachAndEarn:"Tanítasz és fizetést kapsz", takeLessons:"Órákat veszel — mindig ingyenes", manageChild:"18 év alattit kezelsz", parentSetUp:"Egy szülő már regisztrált téged", overEighteen:"18 éves vagy idősebb vagy" },
  hr: { today:"Danas", calendar:"Kalendar", log:"Zabilježi", roster:"Igrači", chats:"Poruke", home:"Početna", lessons:"Treninzi", practice:"Vježbe", family:"Obitelj", you:"Ti", settings:"Postavke", search:"Traži", alerts:"Obavijesti", save:"Spremi", cancel:"Odustani", done:"Gotovo", skip:"Preskoči", continue:"Nastavi", publish:"Objavi", back:"Natrag", language:"Jezik", region:"Država", appearance:"Izgled", darkMode:"Tamni način", textSize:"Veličina teksta", sound:"Zvuk", haptics:"Vibracija", logLesson:"Zabilježi trening", workingOn:"Radimo na", nextLesson:"Sljedeći trening", players:"igrači", showOriginal:"Prikaži izvornik", showTranslation:"Prikaži prijevod", translatedFor:"Prevedeno za tebe", whereAreYou:"Gdje si?", yourLanguage:"Tvoj jezik", yourSport:"Tvoj sport", whichAreYou:"Tko si?", coach:"Trener", player:"Igrač", whoIsItFor:"Za koga je?", forMe:"Za mene", forMyChild:"Za moje dijete", imUnder18:"Imam manje od 18", yourDetails:"Tvoji podaci", fullName:"Puno ime", email:"E-pošta", mobile:"Mobitel", password:"Lozinka", dateOfBirth:"Datum rođenja", haveAccount:"Imaš račun?", signIn:"Prijavi se", getStarted:"Započni", teachAndEarn:"Podučavaš i zarađuješ", takeLessons:"Ideš na treninge — uvijek besplatno", manageChild:"Upravljaš osobom mlađom od 18", parentSetUp:"Roditelj te već registrirao", overEighteen:"Imaš 18 ili više" },
  tr: { today:"Bugün", calendar:"Takvim", log:"Kaydet", roster:"Sporcular", chats:"Mesajlar", home:"Ana sayfa", lessons:"Dersler", practice:"Antrenman", family:"Aile", you:"Sen", settings:"Ayarlar", search:"Ara", alerts:"Bildirimler", save:"Kaydet", cancel:"İptal", done:"Tamam", skip:"Atla", continue:"Devam", publish:"Yayınla", back:"Geri", language:"Dil", region:"Ülke", appearance:"Görünüm", darkMode:"Koyu mod", textSize:"Yazı boyutu", sound:"Ses", haptics:"Titreşim", logLesson:"Dersi kaydet", workingOn:"Üzerinde çalışılan", nextLesson:"Sonraki ders", players:"sporcular", showOriginal:"Orijinali göster", showTranslation:"Çeviriyi göster", translatedFor:"Senin için çevrildi", whereAreYou:"Neredesin?", yourLanguage:"Dilin", yourSport:"Sporun", whichAreYou:"Kimsin?", coach:"Antrenör", player:"Sporcu", whoIsItFor:"Kimin için?", forMe:"Benim için", forMyChild:"Çocuğum için", imUnder18:"18 yaşından küçüğüm", yourDetails:"Bilgilerin", fullName:"Ad soyad", email:"E-posta", mobile:"Cep telefonu", password:"Şifre", dateOfBirth:"Doğum tarihi", haveAccount:"Hesabın var mı?", signIn:"Giriş yap", getStarted:"Başla", teachAndEarn:"Ders verir, ücret alırsın", takeLessons:"Ders alırsın — her zaman ücretsiz", manageChild:"18 yaş altını yönetirsin", parentSetUp:"Bir veli seni kaydetti", overEighteen:"18 yaşında veya daha büyüksün" },
  uk: { today:"Сьогодні", calendar:"Календар", log:"Записати", roster:"Спортсмени", chats:"Повідомлення", home:"Головна", lessons:"Заняття", practice:"Тренування", family:"Сім'я", you:"Ти", settings:"Налаштування", search:"Пошук", alerts:"Сповіщення", save:"Зберегти", cancel:"Скасувати", done:"Готово", skip:"Пропустити", continue:"Далі", publish:"Опублікувати", back:"Назад", language:"Мова", region:"Країна", appearance:"Вигляд", darkMode:"Темний режим", textSize:"Розмір тексту", sound:"Звук", haptics:"Вібрація", logLesson:"Записати заняття", workingOn:"Працюємо над", nextLesson:"Наступне заняття", players:"спортсмени", showOriginal:"Показати оригінал", showTranslation:"Показати переклад", translatedFor:"Перекладено для тебе", whereAreYou:"Де ти?", yourLanguage:"Твоя мова", yourSport:"Твій спорт", whichAreYou:"Хто ти?", coach:"Тренер", player:"Гравець", whoIsItFor:"Для кого це?", forMe:"Для мене", forMyChild:"Для моєї дитини", imUnder18:"Мені менше 18", yourDetails:"Твої дані", fullName:"Повне ім'я", email:"Ел. пошта", mobile:"Мобільний", password:"Пароль", dateOfBirth:"Дата народження", haveAccount:"Вже маєш акаунт?", signIn:"Увійти", getStarted:"Почати", teachAndEarn:"Ти навчаєш і отримуєш оплату", takeLessons:"Ти береш заняття — завжди безкоштовно", manageChild:"Ти керуєш особою до 18", parentSetUp:"Батьки вже зареєстрували тебе", overEighteen:"Тобі 18 або більше" },
};

/* Day and month names — a calendar in your own language is the most
   basic form of respect an app can show. */
const CAL_I18N = {
  en: { d:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], m:["January","February","March","April","May","June","July","August","September","October","November","December"] },
  ga: { d:["Luan","Máirt","Céadaoin","Déardaoin","Aoine","Satharn","Domhnach"], m:["Eanáir","Feabhra","Márta","Aibreán","Bealtaine","Meitheamh","Iúil","Lúnasa","Meán Fómhair","Deireadh Fómhair","Samhain","Nollaig"] },
  es: { d:["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"], m:["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"] },
  fr: { d:["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"], m:["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"] },
  de: { d:["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"], m:["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"] },
  it: { d:["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"], m:["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"] },
  pt: { d:["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"], m:["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"] },
  nl: { d:["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"], m:["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"] },
  pl: { d:["Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota","Niedziela"], m:["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"] },
  sv: { d:["Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag","Söndag"], m:["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"] },
  da: { d:["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"], m:["Januar","Februar","Marts","April","Maj","Juni","Juli","August","September","Oktober","November","December"] },
  no: { d:["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"], m:["Januar","Februar","Mars","April","Mai","Juni","Juli","August","September","Oktober","November","Desember"] },
  fi: { d:["Maanantai","Tiistai","Keskiviikko","Torstai","Perjantai","Lauantai","Sunnuntai"], m:["Tammikuu","Helmikuu","Maaliskuu","Huhtikuu","Toukokuu","Kesäkuu","Heinäkuu","Elokuu","Syyskuu","Lokakuu","Marraskuu","Joulukuu"] },
  el: { d:["Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο","Κυριακή"], m:["Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος","Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος"] },
  cs: { d:["Pondělí","Úterý","Středa","Čtvrtek","Pátek","Sobota","Neděle"], m:["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"] },
  ro: { d:["Luni","Marți","Miercuri","Joi","Vineri","Sâmbătă","Duminică"], m:["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"] },
  hu: { d:["Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat","Vasárnap"], m:["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"] },
  hr: { d:["Ponedjeljak","Utorak","Srijeda","Četvrtak","Petak","Subota","Nedjelja"], m:["Siječanj","Veljača","Ožujak","Travanj","Svibanj","Lipanj","Srpanj","Kolovoz","Rujan","Listopad","Studeni","Prosinac"] },
  tr: { d:["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"], m:["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"] },
  uk: { d:["Понеділок","Вівторок","Середа","Четвер","П'ятниця","Субота","Неділя"], m:["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"] },
};

/* Languages we have fully translated. A country whose language isn't
   here still works, but we say so plainly rather than silently serving
   English and pretending. */
const TRANSLATED = Object.keys(STRINGS);

/* The sign-up as one list, so no screen can disagree with another
   about how far along you are. */
const JOURNEY = {
  coach:  ["role", "sport", "account"],
  player: ["role", "sport", "connect", "account"],
};
const stepOf = (path, key) => Math.max(0, (JOURNEY[path] || JOURNEY.player).indexOf(key));
const stepsIn = (path) => (JOURNEY[path] || JOURNEY.player).length;

/* ==================================================================
   PHRASES
   Keyed by the English source so a translator can see the sentence in
   context rather than a bare key. tr() resolves against whichever
   language is live; anything missing falls back to the source, and the
   coverage check below tells us honestly where the gaps are.
================================================================== */
const PHRASES = {
  // --- navigation and chrome ---
  "Back":{es:"Atrás",fr:"Retour",de:"Zurück",it:"Indietro",pt:"Voltar",nl:"Terug",pl:"Wstecz",ga:"Ar ais"},
  "Skip":{es:"Omitir",fr:"Passer",de:"Überspringen",it:"Salta",pt:"Ignorar",nl:"Overslaan",pl:"Pomiń",ga:"Scipeáil"},
  "Save":{es:"Guardar",fr:"Enregistrer",de:"Sichern",it:"Salva",pt:"Guardar",nl:"Opslaan",pl:"Zapisz",ga:"Sábháil"},
  "Cancel":{es:"Cancelar",fr:"Annuler",de:"Abbrechen",it:"Annulla",pt:"Cancelar",nl:"Annuleren",pl:"Anuluj",ga:"Cealaigh"},
  "Continue":{es:"Continuar",fr:"Continuer",de:"Weiter",it:"Continua",pt:"Continuar",nl:"Doorgaan",pl:"Dalej",ga:"Ar aghaidh"},
  "Close":{es:"Cerrar",fr:"Fermer",de:"Schließen",it:"Chiudi",pt:"Fechar",nl:"Sluiten",pl:"Zamknij",ga:"Dún"},
  "Add":{es:"Añadir",fr:"Ajouter",de:"Hinzufügen",it:"Aggiungi",pt:"Adicionar",nl:"Toevoegen",pl:"Dodaj",ga:"Cuir leis"},
  "Remove":{es:"Quitar",fr:"Retirer",de:"Entfernen",it:"Rimuovi",pt:"Remover",nl:"Verwijderen",pl:"Usuń",ga:"Bain"},
  "Delete":{es:"Eliminar",fr:"Supprimer",de:"Löschen",it:"Elimina",pt:"Eliminar",nl:"Verwijderen",pl:"Usuń",ga:"Scrios"},
  "Send":{es:"Enviar",fr:"Envoyer",de:"Senden",it:"Invia",pt:"Enviar",nl:"Versturen",pl:"Wyślij",ga:"Seol"},
  "Search":{es:"Buscar",fr:"Rechercher",de:"Suchen",it:"Cerca",pt:"Pesquisar",nl:"Zoeken",pl:"Szukaj",ga:"Cuardaigh"},
  "Clear":{es:"Borrar",fr:"Effacer",de:"Leeren",it:"Cancella",pt:"Limpar",nl:"Wissen",pl:"Wyczyść",ga:"Glan"},
  "Share":{es:"Compartir",fr:"Partager",de:"Teilen",it:"Condividi",pt:"Partilhar",nl:"Delen",pl:"Udostępnij",ga:"Roinn"},
  "Book":{es:"Reservar",fr:"Réserver",de:"Buchen",it:"Prenota",pt:"Reservar",nl:"Boeken",pl:"Rezerwuj",ga:"Cuir in áirithe"},
  "Message":{es:"Mensaje",fr:"Message",de:"Nachricht",it:"Messaggio",pt:"Mensagem",nl:"Bericht",pl:"Wiadomość",ga:"Teachtaireacht"},
  "Undo":{es:"Deshacer",fr:"Annuler",de:"Rückgängig",it:"Annulla",pt:"Anular",nl:"Ongedaan maken",pl:"Cofnij",ga:"Cealaigh"},
  "More":{es:"Más",fr:"Plus",de:"Mehr",it:"Più",pt:"Mais",nl:"Meer",pl:"Więcej",ga:"Níos mó"},
  "Fewer":{es:"Menos",fr:"Moins",de:"Weniger",it:"Meno",pt:"Menos",nl:"Minder",pl:"Mniej",ga:"Níos lú"},
  "Stop":{es:"Parar",fr:"Arrêter",de:"Stopp",it:"Ferma",pt:"Parar",nl:"Stop",pl:"Zatrzymaj",ga:"Stad"},
  "Details":{es:"Detalles",fr:"Détails",de:"Details",it:"Dettagli",pt:"Detalhes",nl:"Details",pl:"Szczegóły",ga:"Sonraí"},
  "Preview":{es:"Vista previa",fr:"Aperçu",de:"Vorschau",it:"Anteprima",pt:"Pré-visualização",nl:"Voorbeeld",pl:"Podgląd",ga:"Réamhamharc"},
  "Offline":{es:"Sin conexión",fr:"Hors ligne",de:"Offline",it:"Offline",pt:"Offline",nl:"Offline",pl:"Offline",ga:"As líne"},
  "Nothing found.":{es:"No hay resultados.",fr:"Aucun résultat.",de:"Nichts gefunden.",it:"Nessun risultato.",pt:"Nada encontrado.",nl:"Niets gevonden.",pl:"Nic nie znaleziono.",ga:"Níor aimsíodh faic."},

  // --- screens ---
  "Practice":{es:"Práctica",fr:"Exercices",de:"Übungen",it:"Esercizi",pt:"Treino",nl:"Oefenen",pl:"Trening",ga:"Cleachtadh"},
  "Messages":{es:"Mensajes",fr:"Messages",de:"Nachrichten",it:"Messaggi",pt:"Mensagens",nl:"Berichten",pl:"Wiadomości",ga:"Teachtaireachtaí"},
  "Drills":{es:"Ejercicios",fr:"Exercices",de:"Übungen",it:"Esercizi",pt:"Exercícios",nl:"Oefeningen",pl:"Ćwiczenia",ga:"Druileanna"},
  "Alerts":{es:"Avisos",fr:"Alertes",de:"Hinweise",it:"Avvisi",pt:"Alertas",nl:"Meldingen",pl:"Powiadomienia",ga:"Foláirimh"},
  "Stats":{es:"Estadísticas",fr:"Statistiques",de:"Statistiken",it:"Statistiche",pt:"Estatísticas",nl:"Statistieken",pl:"Statystyki",ga:"Staitisticí"},
  "Family":{es:"Familia",fr:"Famille",de:"Familie",it:"Famiglia",pt:"Família",nl:"Gezin",pl:"Rodzina",ga:"Teaghlach"},
  "You":{es:"Tú",fr:"Vous",de:"Du",it:"Tu",pt:"Tu",nl:"Jij",pl:"Ty",ga:"Tusa"},
  "Help":{es:"Ayuda",fr:"Aide",de:"Hilfe",it:"Aiuto",pt:"Ajuda",nl:"Hulp",pl:"Pomoc",ga:"Cabhair"},
  "Subscription":{es:"Suscripción",fr:"Abonnement",de:"Abonnement",it:"Abbonamento",pt:"Subscrição",nl:"Abonnement",pl:"Subskrypcja",ga:"Síntiús"},
  "Branding":{es:"Marca",fr:"Identité",de:"Branding",it:"Brand",pt:"Marca",nl:"Huisstijl",pl:"Marka",ga:"Brandáil"},
  "Availability":{es:"Disponibilidad",fr:"Disponibilités",de:"Verfügbarkeit",it:"Disponibilità",pt:"Disponibilidade",nl:"Beschikbaarheid",pl:"Dostępność",ga:"Infhaighteacht"},
  "Waitlist":{es:"Lista de espera",fr:"Liste d'attente",de:"Warteliste",it:"Lista d'attesa",pt:"Lista de espera",nl:"Wachtlijst",pl:"Lista oczekujących",ga:"Liosta feithimh"},
  "Requests":{es:"Solicitudes",fr:"Demandes",de:"Anfragen",it:"Richieste",pt:"Pedidos",nl:"Verzoeken",pl:"Prośby",ga:"Iarratais"},
  "To log":{es:"Por registrar",fr:"À rédiger",de:"Nachzutragen",it:"Da registrare",pt:"Por registar",nl:"Nog vastleggen",pl:"Do zapisania",ga:"Le scríobh"},
  "All lessons":{es:"Todas las clases",fr:"Toutes les leçons",de:"Alle Stunden",it:"Tutte le lezioni",pt:"Todas as aulas",nl:"Alle lessen",pl:"Wszystkie lekcje",ga:"Gach ceacht"},
  "Your groups":{es:"Tus grupos",fr:"Vos groupes",de:"Deine Gruppen",it:"I tuoi gruppi",pt:"Os teus grupos",nl:"Jouw groepen",pl:"Twoje grupy",ga:"Do ghrúpaí"},
  "Notifications":{es:"Notificaciones",fr:"Notifications",de:"Mitteilungen",it:"Notifiche",pt:"Notificações",nl:"Meldingen",pl:"Powiadomienia",ga:"Fógraí"},
  "Personal details":{es:"Datos personales",fr:"Informations personnelles",de:"Persönliche Daten",it:"Dati personali",pt:"Dados pessoais",nl:"Persoonlijke gegevens",pl:"Dane osobowe",ga:"Sonraí pearsanta"},
  "Downloads":{es:"Descargas",fr:"Téléchargements",de:"Downloads",it:"Download",pt:"Transferências",nl:"Downloads",pl:"Pobrane",ga:"Íoslódálacha"},
  "Mark it up":{es:"Anotar",fr:"Annoter",de:"Markieren",it:"Annota",pt:"Anotar",nl:"Markeren",pl:"Zaznacz",ga:"Marcáil"},

  // --- actions and rows ---
  "Set drills":{es:"Asignar ejercicios",fr:"Définir les exercices",de:"Übungen festlegen",it:"Assegna esercizi",pt:"Definir exercícios",nl:"Oefeningen instellen",pl:"Ustaw ćwiczenia",ga:"Socraigh druileanna"},
  "Add a coach":{es:"Añadir entrenador",fr:"Ajouter un entraîneur",de:"Trainer hinzufügen",it:"Aggiungi allenatore",pt:"Adicionar treinador",nl:"Coach toevoegen",pl:"Dodaj trenera",ga:"Cuir traenálaí leis"},
  "Add a tip":{es:"Añadir consejo",fr:"Ajouter un conseil",de:"Tipp hinzufügen",it:"Aggiungi consiglio",pt:"Adicionar dica",nl:"Tip toevoegen",pl:"Dodaj wskazówkę",ga:"Cuir leid leis"},
  "Log a lesson":{es:"Registrar una clase",fr:"Noter une leçon",de:"Stunde erfassen",it:"Registra una lezione",pt:"Registar uma aula",nl:"Les vastleggen",pl:"Zapisz lekcję",ga:"Logáil ceacht"},
  "Book a lesson":{es:"Reservar una clase",fr:"Réserver une leçon",de:"Stunde buchen",it:"Prenota una lezione",pt:"Reservar uma aula",nl:"Les boeken",pl:"Zarezerwuj lekcję",ga:"Cuir ceacht in áirithe"},
  "Set your hours":{es:"Define tus horarios",fr:"Définissez vos horaires",de:"Zeiten festlegen",it:"Imposta i tuoi orari",pt:"Define os teus horários",nl:"Stel je uren in",pl:"Ustaw swoje godziny",ga:"Socraigh do chuid uaireanta"},
  "Create a group":{es:"Crear un grupo",fr:"Créer un groupe",de:"Gruppe erstellen",it:"Crea un gruppo",pt:"Criar um grupo",nl:"Groep maken",pl:"Utwórz grupę",ga:"Cruthaigh grúpa"},
  "Message everyone":{es:"Mensaje a todos",fr:"Message à tous",de:"Nachricht an alle",it:"Messaggio a tutti",pt:"Mensagem a todos",nl:"Bericht aan iedereen",pl:"Wiadomość do wszystkich",ga:"Teachtaireacht chuig cách"},
  "Edit stats":{es:"Editar estadísticas",fr:"Modifier les statistiques",de:"Statistiken bearbeiten",it:"Modifica statistiche",pt:"Editar estatísticas",nl:"Statistieken bewerken",pl:"Edytuj statystyki",ga:"Cuir staitisticí in eagar"},
  "Choose your stats":{es:"Elige tus estadísticas",fr:"Choisissez vos statistiques",de:"Statistiken wählen",it:"Scegli le statistiche",pt:"Escolhe as estatísticas",nl:"Kies je statistieken",pl:"Wybierz statystyki",ga:"Roghnaigh do staitisticí"},
  "Sign out":{es:"Cerrar sesión",fr:"Se déconnecter",de:"Abmelden",it:"Esci",pt:"Terminar sessão",nl:"Uitloggen",pl:"Wyloguj się",ga:"Logáil amach"},
  "Delete account":{es:"Eliminar cuenta",fr:"Supprimer le compte",de:"Konto löschen",it:"Elimina account",pt:"Eliminar conta",nl:"Account verwijderen",pl:"Usuń konto",ga:"Scrios cuntas"},
  "Change password":{es:"Cambiar contraseña",fr:"Changer le mot de passe",de:"Passwort ändern",it:"Cambia password",pt:"Alterar palavra-passe",nl:"Wachtwoord wijzigen",pl:"Zmień hasło",ga:"Athraigh pasfhocal"},
  "Contact us":{es:"Contáctanos",fr:"Nous contacter",de:"Kontakt",it:"Contattaci",pt:"Contacta-nos",nl:"Contact",pl:"Kontakt",ga:"Déan teagmháil"},
  "Help centre":{es:"Centro de ayuda",fr:"Centre d'aide",de:"Hilfecenter",it:"Centro assistenza",pt:"Centro de ajuda",nl:"Helpcentrum",pl:"Centrum pomocy",ga:"Ionad cabhrach"},
  "Report a problem":{es:"Informar de un problema",fr:"Signaler un problème",de:"Problem melden",it:"Segnala un problema",pt:"Reportar um problema",nl:"Probleem melden",pl:"Zgłoś problem",ga:"Tuairiscigh fadhb"},
  "Terms of Service":{es:"Términos del servicio",fr:"Conditions d'utilisation",de:"Nutzungsbedingungen",it:"Termini di servizio",pt:"Termos de serviço",nl:"Voorwaarden",pl:"Regulamin",ga:"Téarmaí seirbhíse"},
  "Privacy Policy":{es:"Política de privacidad",fr:"Politique de confidentialité",de:"Datenschutz",it:"Privacy",pt:"Política de privacidade",nl:"Privacybeleid",pl:"Polityka prywatności",ga:"Polasaí príobháideachta"},
  "Licences":{es:"Licencias",fr:"Licences",de:"Lizenzen",it:"Licenze",pt:"Licenças",nl:"Licenties",pl:"Licencje",ga:"Ceadúnais"},
  "Data & permissions":{es:"Datos y permisos",fr:"Données et autorisations",de:"Daten und Berechtigungen",it:"Dati e permessi",pt:"Dados e permissões",nl:"Gegevens en rechten",pl:"Dane i uprawnienia",ga:"Sonraí agus ceadanna"},
  "Family dashboard":{es:"Panel familiar",fr:"Tableau familial",de:"Familienübersicht",it:"Pannello famiglia",pt:"Painel da família",nl:"Gezinsoverzicht",pl:"Panel rodziny",ga:"Painéal teaghlaigh"},
  "Drill library":{es:"Biblioteca de ejercicios",fr:"Bibliothèque d'exercices",de:"Übungsbibliothek",it:"Libreria esercizi",pt:"Biblioteca de exercícios",nl:"Oefeningenbibliotheek",pl:"Biblioteka ćwiczeń",ga:"Leabharlann druileanna"},
  "Weekly availability":{es:"Disponibilidad semanal",fr:"Disponibilités hebdomadaires",de:"Wöchentliche Verfügbarkeit",it:"Disponibilità settimanale",pt:"Disponibilidade semanal",nl:"Wekelijkse beschikbaarheid",pl:"Dostępność tygodniowa",ga:"Infhaighteacht sheachtainiúil"},
  "Roster & groups":{es:"Alumnos y grupos",fr:"Élèves et groupes",de:"Spieler und Gruppen",it:"Allievi e gruppi",pt:"Alunos e grupos",nl:"Spelers en groepen",pl:"Zawodnicy i grupy",ga:"Rolla agus grúpaí"},
  "Requests & waitlist":{es:"Solicitudes y lista de espera",fr:"Demandes et liste d'attente",de:"Anfragen und Warteliste",it:"Richieste e lista d'attesa",pt:"Pedidos e lista de espera",nl:"Verzoeken en wachtlijst",pl:"Prośby i lista oczekujących",ga:"Iarratais agus liosta feithimh"},
  "Coaches & profiles":{es:"Entrenadores y perfiles",fr:"Entraîneurs et profils",de:"Trainer und Profile",it:"Allenatori e profili",pt:"Treinadores e perfis",nl:"Coaches en profielen",pl:"Trenerzy i profile",ga:"Traenálaithe agus próifílí"},
  "Invite code & QR":{es:"Código de invitación y QR",fr:"Code d'invitation et QR",de:"Einladungscode und QR",it:"Codice invito e QR",pt:"Código de convite e QR",nl:"Uitnodigingscode en QR",pl:"Kod zaproszenia i QR",ga:"Cód cuiridh agus QR"},
  "Family code":{es:"Código familiar",fr:"Code famille",de:"Familiencode",it:"Codice famiglia",pt:"Código de família",nl:"Gezinscode",pl:"Kod rodzinny",ga:"Cód teaghlaigh"},
  "Your profile":{es:"Tu perfil",fr:"Votre profil",de:"Dein Profil",it:"Il tuo profilo",pt:"O teu perfil",nl:"Jouw profiel",pl:"Twój profil",ga:"Do phróifíl"},
  "Your drills":{es:"Tus ejercicios",fr:"Vos exercices",de:"Deine Übungen",it:"I tuoi esercizi",pt:"Os teus exercícios",nl:"Jouw oefeningen",pl:"Twoje ćwiczenia",ga:"Do dhruileanna"},
  "Latest lesson":{es:"Última clase",fr:"Dernière leçon",de:"Letzte Stunde",it:"Ultima lezione",pt:"Última aula",nl:"Laatste les",pl:"Ostatnia lekcja",ga:"An ceacht is déanaí"},
  "Lesson log":{es:"Registro de clases",fr:"Journal des leçons",de:"Stundenprotokoll",it:"Registro lezioni",pt:"Registo de aulas",nl:"Lesoverzicht",pl:"Dziennik lekcji",ga:"Loga ceachtanna"},
  "Empty for now":{es:"Aquí no hay nada aún",fr:"Rien pour l'instant",de:"Noch nichts hier",it:"Ancora niente qui",pt:"Ainda nada aqui",nl:"Nog niets hier",pl:"Jeszcze nic tu nie ma",ga:"Faic anseo fós"},
  "All clear":{es:"Todo en orden",fr:"Tout est clair",de:"Alles erledigt",it:"Tutto a posto",pt:"Tudo em ordem",nl:"Alles is klaar",pl:"Wszystko czyste",ga:"Gach rud glan"},
  "Still current":{es:"Sigue vigente",fr:"Toujours d'actualité",de:"Weiterhin aktuell",it:"Ancora attuale",pt:"Ainda atual",nl:"Nog actueel",pl:"Wciąż aktualne",ga:"Fós reatha"},
  "Which sport?":{es:"¿Qué deporte?",fr:"Quel sport ?",de:"Welche Sportart?",it:"Quale sport?",pt:"Que desporto?",nl:"Welke sport?",pl:"Jaki sport?",ga:"Cén spórt?"},
  "What are they working on?":{es:"¿En qué están trabajando?",fr:"Sur quoi travaillent-ils ?",de:"Woran arbeiten sie?",it:"Su cosa stanno lavorando?",pt:"Em que estão a trabalhar?",nl:"Waar werken ze aan?",pl:"Nad czym pracują?",ga:"Cad air a bhfuil siad ag obair?"},
  "What you've worked on":{es:"En lo que has trabajado",fr:"Ce que vous avez travaillé",de:"Woran du gearbeitet hast",it:"Su cosa hai lavorato",pt:"No que trabalhaste",nl:"Waar je aan hebt gewerkt",pl:"Nad czym pracowałeś",ga:"Ar ar oibrigh tú"},
  "Set as their focus":{es:"Fijar como su enfoque",fr:"Définir comme objectif",de:"Als Fokus setzen",it:"Imposta come focus",pt:"Definir como foco",nl:"Als focus instellen",pl:"Ustaw jako cel",ga:"Socraigh mar fhócas"},
  "Recurring lessons & package":{es:"Clases recurrentes y bono",fr:"Leçons récurrentes et forfait",de:"Serientermine und Paket",it:"Lezioni ricorrenti e pacchetto",pt:"Aulas recorrentes e pacote",nl:"Terugkerende lessen en pakket",pl:"Lekcje cykliczne i pakiet",ga:"Ceachtanna rialta agus pacáiste"},
  "Remove from roster":{es:"Quitar de la lista",fr:"Retirer de la liste",de:"Von der Liste entfernen",it:"Rimuovi dall'elenco",pt:"Remover da lista",nl:"Van de lijst halen",pl:"Usuń z listy",ga:"Bain den rolla"},
  "Only you can see this":{es:"Solo tú puedes ver esto",fr:"Vous seul voyez ceci",de:"Nur du siehst das",it:"Solo tu puoi vederlo",pt:"Só tu vês isto",nl:"Alleen jij ziet dit",pl:"Tylko ty to widzisz",ga:"Ní fheiceann ach tusa é seo"},

  // --- subtitles and secondary copy ---
  "Approve who joins and who fills cancellations":{es:"Aprueba quién entra y quién cubre las cancelaciones",fr:"Validez qui rejoint et qui reprend les annulations",de:"Genehmige Beitritte und Nachrücker",it:"Approva chi entra e chi copre le disdette",pt:"Aprova quem entra e quem ocupa as desistências",nl:"Keur goed wie meedoet en wie annuleringen opvult",pl:"Zatwierdzaj, kto dołącza i kto zajmuje odwołane terminy",ga:"Ceadaigh cé a thagann isteach"},
  "Who's waiting for a slot":{es:"Quién espera un hueco",fr:"Qui attend un créneau",de:"Wer auf einen Termin wartet",it:"Chi aspetta un posto",pt:"Quem espera por uma vaga",nl:"Wie wacht op een plek",pl:"Kto czeka na termin",ga:"Cé atá ag fanacht ar sliotán"},
  "Days and times you coach":{es:"Días y horas que entrenas",fr:"Jours et heures où vous enseignez",de:"Tage und Zeiten, an denen du trainierst",it:"Giorni e orari in cui alleni",pt:"Dias e horas em que treinas",nl:"Dagen en tijden dat je lesgeeft",pl:"Dni i godziny, w których trenujesz",ga:"Laethanta agus amanna a dhéanann tú traenáil"},
  "Your reusable library":{es:"Tu biblioteca reutilizable",fr:"Votre bibliothèque réutilisable",de:"Deine wiederverwendbare Bibliothek",it:"La tua libreria riutilizzabile",pt:"A tua biblioteca reutilizável",nl:"Je herbruikbare bibliotheek",pl:"Twoja biblioteka wielokrotnego użytku",ga:"Do leabharlann inathúsáidte"},
  "Everyone you manage, in one place":{es:"Todos los que gestionas, en un solo lugar",fr:"Toutes les personnes que vous gérez, au même endroit",de:"Alle, die du verwaltest, an einem Ort",it:"Tutti quelli che gestisci, in un posto",pt:"Todos os que geres, num só lugar",nl:"Iedereen die je beheert, op één plek",pl:"Wszyscy, którymi zarządzasz, w jednym miejscu",ga:"Gach duine a bhainistíonn tú, in aon áit"},
  "Logo, colour, club name":{es:"Logo, color, nombre del club",fr:"Logo, couleur, nom du club",de:"Logo, Farbe, Vereinsname",it:"Logo, colore, nome del club",pt:"Logo, cor, nome do clube",nl:"Logo, kleur, clubnaam",pl:"Logo, kolor, nazwa klubu",ga:"Lógó, dath, ainm an chlub"},
  "Add a young person or another coach":{es:"Añade a un menor o a otro entrenador",fr:"Ajoutez un mineur ou un autre entraîneur",de:"Füge einen Jugendlichen oder Trainer hinzu",it:"Aggiungi un minore o un altro allenatore",pt:"Adiciona um jovem ou outro treinador",nl:"Voeg een jongere of coach toe",pl:"Dodaj młodą osobę lub trenera",ga:"Cuir duine óg nó traenálaí eile leis"},
  "Videos saved for offline":{es:"Vídeos guardados sin conexión",fr:"Vidéos enregistrées hors ligne",de:"Offline gespeicherte Videos",it:"Video salvati offline",pt:"Vídeos guardados offline",nl:"Video's offline opgeslagen",pl:"Filmy zapisane offline",ga:"Físeáin sábháilte as líne"},
  "Sessions you train with others":{es:"Sesiones en las que entrenas con otros",fr:"Séances où vous vous entraînez à plusieurs",de:"Einheiten, in denen du mit anderen trainierst",it:"Sessioni in cui ti alleni con altri",pt:"Sessões em que treinas com outros",nl:"Sessies waarin je met anderen traint",pl:"Zajęcia, na których trenujesz z innymi",ga:"Seisiúin a dhéanann tú le daoine eile"},
  "Choose who, and what they practise":{es:"Elige a quién y qué practican",fr:"Choisissez qui, et ce qu'ils travaillent",de:"Wähle wen, und was geübt wird",it:"Scegli chi, e cosa esercitano",pt:"Escolhe quem, e o que praticam",nl:"Kies wie, en wat ze oefenen",pl:"Wybierz kogo i co ćwiczą",ga:"Roghnaigh cé, agus cad a chleachtann siad"},
  "Choose what reaches you, and when":{es:"Elige qué te llega y cuándo",fr:"Choisissez ce qui vous parvient, et quand",de:"Wähle, was dich erreicht, und wann",it:"Scegli cosa ti arriva, e quando",pt:"Escolhe o que te chega, e quando",nl:"Kies wat je bereikt, en wanneer",pl:"Wybierz, co do ciebie dociera i kiedy",ga:"Roghnaigh cad a shroicheann tú, agus cathain"},
  "Everyone":{es:"Todos",fr:"Tout le monde",de:"Alle",it:"Tutti",pt:"Todos",nl:"Iedereen",pl:"Wszyscy",ga:"Gach duine"},
  "Everyone's calendar":{es:"Calendario de todos",fr:"Calendrier de tous",de:"Kalender aller",it:"Calendario di tutti",pt:"Calendário de todos",nl:"Ieders agenda",pl:"Kalendarz wszystkich",ga:"Féilire gach duine"},
  "Accept":{es:"Aceptar",fr:"Accepter",de:"Annehmen",it:"Accetta",pt:"Aceitar",nl:"Accepteren",pl:"Akceptuj",ga:"Glac"},
  "Decline":{es:"Rechazar",fr:"Refuser",de:"Ablehnen",it:"Rifiuta",pt:"Recusar",nl:"Weigeren",pl:"Odrzuć",ga:"Diúltaigh"},
  "Done":{es:"Hecho",fr:"Terminé",de:"Fertig",it:"Fatto",pt:"Concluído",nl:"Klaar",pl:"Gotowe",ga:"Déanta"},
  "Account":{es:"Cuenta",fr:"Compte",de:"Konto",it:"Account",pt:"Conta",nl:"Account",pl:"Konto",ga:"Cuntas"},
  "Calendar":{es:"Calendario",fr:"Calendrier",de:"Kalender",it:"Calendario",pt:"Calendário",nl:"Agenda",pl:"Kalendarz",ga:"Féilire"},
  "Attendance":{es:"Asistencia",fr:"Présence",de:"Anwesenheit",it:"Presenza",pt:"Presença",nl:"Aanwezigheid",pl:"Obecność",ga:"Tinreamh"},
  "Categories":{es:"Categorías",fr:"Catégories",de:"Kategorien",it:"Categorie",pt:"Categorias",nl:"Categorieën",pl:"Kategorie",ga:"Catagóirí"},
  "Current plan":{es:"Plan actual",fr:"Formule actuelle",de:"Aktueller Tarif",it:"Piano attuale",pt:"Plano atual",nl:"Huidig abonnement",pl:"Obecny plan",ga:"Plean reatha"},
  "Change plan":{es:"Cambiar de plan",fr:"Changer de formule",de:"Tarif wechseln",it:"Cambia piano",pt:"Mudar de plano",nl:"Abonnement wijzigen",pl:"Zmień plan",ga:"Athraigh plean"},
  "Add goal":{es:"Añadir objetivo",fr:"Ajouter un objectif",de:"Ziel hinzufügen",it:"Aggiungi obiettivo",pt:"Adicionar objetivo",nl:"Doel toevoegen",pl:"Dodaj cel",ga:"Cuir sprioc leis"},
  "Assign this":{es:"Asignar esto",fr:"Attribuer",de:"Zuweisen",it:"Assegna",pt:"Atribuir",nl:"Toewijzen",pl:"Przypisz",ga:"Sann é seo"},
  "Add another":{es:"Añadir otro",fr:"En ajouter un autre",de:"Weitere hinzufügen",it:"Aggiungine un altro",pt:"Adicionar outro",nl:"Nog een toevoegen",pl:"Dodaj kolejny",ga:"Cuir ceann eile leis"},
  "Did they turn up?":{es:"¿Asistieron?",fr:"Sont-ils venus ?",de:"Waren sie da?",it:"Si sono presentati?",pt:"Apareceram?",nl:"Kwamen ze opdagen?",pl:"Czy się pojawili?",ga:"Ar tháinig siad?"},
  "Which numbers do you track?":{es:"¿Qué datos registras?",fr:"Quels chiffres suivez-vous ?",de:"Welche Zahlen verfolgst du?",it:"Quali numeri segui?",pt:"Que números registas?",nl:"Welke cijfers volg je?",pl:"Jakie liczby śledzisz?",ga:"Cé na huimhreacha a leanann tú?"},
  "Which drills do you use?":{es:"¿Qué ejercicios usas?",fr:"Quels exercices utilisez-vous ?",de:"Welche Übungen nutzt du?",it:"Quali esercizi usi?",pt:"Que exercícios usas?",nl:"Welke oefeningen gebruik je?",pl:"Jakich ćwiczeń używasz?",ga:"Cé na druileanna a úsáideann tú?"},
  "Which days do you coach?":{es:"¿Qué días entrenas?",fr:"Quels jours enseignez-vous ?",de:"An welchen Tagen trainierst du?",it:"In quali giorni alleni?",pt:"Em que dias treinas?",nl:"Op welke dagen geef je les?",pl:"W jakie dni trenujesz?",ga:"Cé na laethanta a dhéanann tú traenáil?"},
  "And at what times?":{es:"¿Y a qué horas?",fr:"Et à quelles heures ?",de:"Und zu welchen Zeiten?",it:"E a che ora?",pt:"E a que horas?",nl:"En op welke tijden?",pl:"I o jakich godzinach?",ga:"Agus cén t-am?"},
  "Pick up to three. You can change these any time.":{es:"Elige hasta tres. Puedes cambiarlo cuando quieras.",fr:"Choisissez-en jusqu'à trois. Modifiable à tout moment.",de:"Bis zu drei. Jederzeit änderbar.",it:"Scegline fino a tre. Modificabile quando vuoi.",pt:"Escolhe até três. Podes mudar quando quiseres.",nl:"Kies er maximaal drie. Altijd te wijzigen.",pl:"Wybierz do trzech. Możesz to zmienić w każdej chwili.",ga:"Suas le trí. Is féidir a athrú am ar bith."},
  "Your starting library. Add your own as you go.":{es:"Tu biblioteca inicial. Añade las tuyas sobre la marcha.",fr:"Votre bibliothèque de départ. Ajoutez les vôtres au fil du temps.",de:"Deine Startbibliothek. Eigene jederzeit ergänzen.",it:"La tua libreria iniziale. Aggiungi le tue col tempo.",pt:"A tua biblioteca inicial. Acrescenta as tuas.",nl:"Je startbibliotheek. Voeg later je eigen toe.",pl:"Twoja startowa biblioteka. Dodawaj własne.",ga:"Do leabharlann tosaigh. Cuir do chinn féin leis."},
  "These become the slots players can book.":{es:"Estos serán los huecos que podrán reservar.",fr:"Ce seront les créneaux réservables.",de:"Das werden die buchbaren Termine.",it:"Diventeranno gli orari prenotabili.",pt:"Estes serão os horários reserváveis.",nl:"Dit worden de boekbare tijden.",pl:"To będą terminy do rezerwacji.",ga:"Is iad seo na sliotáin is féidir a chur in áirithe."},
  "Finish set-up":{es:"Finalizar configuración",fr:"Terminer la configuration",de:"Einrichtung abschließen",it:"Completa la configurazione",pt:"Concluir configuração",nl:"Instellen voltooien",pl:"Zakończ konfigurację",ga:"Críochnaigh an socrú"},
  "Lesson length":{es:"Duración de la clase",fr:"Durée de la leçon",de:"Dauer der Stunde",it:"Durata della lezione",pt:"Duração da aula",nl:"Lesduur",pl:"Długość lekcji",ga:"Fad an cheachta"},
  "Start times":{es:"Horas de inicio",fr:"Heures de début",de:"Startzeiten",it:"Orari di inizio",pt:"Horas de início",nl:"Starttijden",pl:"Godziny rozpoczęcia",ga:"Amanna tosaigh"},
  "Add your own drill":{es:"Añade tu propio ejercicio",fr:"Ajoutez votre exercice",de:"Eigene Übung hinzufügen",it:"Aggiungi il tuo esercizio",pt:"Adiciona o teu exercício",nl:"Eigen oefening toevoegen",pl:"Dodaj własne ćwiczenie",ga:"Cuir do dhruil féin leis"},
  "slots on":{es:"huecos en",fr:"créneaux sur",de:"Termine an",it:"posti su",pt:"horários em",nl:"tijden op",pl:"terminów w",ga:"sliotán ar"},
  "days":{es:"días",fr:"jours",de:"Tagen",it:"giorni",pt:"dias",nl:"dagen",pl:"dni",ga:"lá"},
  "and recurring groups":{es:"y grupos recurrentes",fr:"et groupes réguliers",de:"und feste Gruppen",it:"e gruppi ricorrenti",pt:"e grupos recorrentes",nl:"en vaste groepen",pl:"i stałe grupy",ga:"agus grúpaí rialta"},
  "How they see the app":{es:"Cómo ven la app",fr:"Ce qu'ils voient",de:"Wie sie die App sehen",it:"Come vedono l'app",pt:"Como veem a app",nl:"Hoe zij de app zien",pl:"Jak widzą aplikację",ga:"Conas a fheiceann siad an aip"},
  "Support":{es:"Soporte",fr:"Assistance",de:"Support",it:"Assistenza",pt:"Apoio",nl:"Ondersteuning",pl:"Wsparcie",ga:"Tacaíocht"},
  "Legal":{es:"Legal",fr:"Mentions légales",de:"Rechtliches",it:"Note legali",pt:"Legal",nl:"Juridisch",pl:"Informacje prawne",ga:"Dlíthiúil"},
  "Made in Ireland":{es:"Hecho en Irlanda",fr:"Conçu en Irlande",de:"Hergestellt in Irland",it:"Fatto in Irlanda",pt:"Feito na Irlanda",nl:"Gemaakt in Ierland",pl:"Zrobione w Irlandii",ga:"Déanta in Éirinn"},
};

/* Resolve any user-facing string. Falls back to the source rather than
   to a third language, so nobody ever sees a sentence in a language
   they did not choose. */

/* The remaining languages, written as one block each. tr() checks the
   per-phrase table first, then here — so adding a language is a single
   contiguous edit rather than 120 scattered ones. */
const PHRASES_BY_LANG = {
  el: { "Support":"Υποστήριξη","Help centre":"Κέντρο βοήθειας","Contact us":"Επικοινωνία","Legal":"Νομικά","Made in Ireland":"Φτιαγμένο στην Ιρλανδία","Report a problem":"Αναφορά προβλήματος","Back":"Πίσω","Skip":"Παράλειψη","Save":"Αποθήκευση","Cancel":"Ακύρωση","Continue":"Συνέχεια","Close":"Κλείσιμο","Add":"Προσθήκη","Remove":"Αφαίρεση","Delete":"Διαγραφή","Send":"Αποστολή","Search":"Αναζήτηση","Clear":"Καθαρισμός","Share":"Κοινοποίηση","Book":"Κράτηση","Message":"Μήνυμα","More":"Περισσότερα","Fewer":"Λιγότερα","Done":"Έτοιμο","Details":"Λεπτομέρειες","Preview":"Προεπισκόπηση","Practice":"Προπόνηση","Messages":"Μηνύματα","Drills":"Ασκήσεις","Alerts":"Ειδοποιήσεις","Stats":"Στατιστικά","Family":"Οικογένεια","You":"Εσύ","Help":"Βοήθεια","Subscription":"Συνδρομή","Branding":"Ταυτότητα","Availability":"Διαθεσιμότητα","Waitlist":"Λίστα αναμονής","Requests":"Αιτήματα","All lessons":"Όλα τα μαθήματα","Your groups":"Οι ομάδες σου","Notifications":"Ειδοποιήσεις","Personal details":"Προσωπικά στοιχεία","Set drills":"Ορισμός ασκήσεων","Add a coach":"Προσθήκη προπονητή","Log a lesson":"Καταγραφή μαθήματος","Book a lesson":"Κράτηση μαθήματος","Set your hours":"Όρισε τις ώρες σου","Account":"Λογαριασμός","Calendar":"Ημερολόγιο","Attendance":"Παρουσίες","Sign out":"Αποσύνδεση","Delete account":"Διαγραφή λογαριασμού","Terms of Service":"Όροι χρήσης","Privacy Policy":"Πολιτική απορρήτου","Licences":"Άδειες","Data & permissions":"Δεδομένα και άδειες","Weekly availability":"Εβδομαδιαία διαθεσιμότητα","Roster & groups":"Αθλητές και ομάδες","Your reusable library":"Η βιβλιοθήκη σου","Days and times you coach":"Μέρες και ώρες που προπονείς","Who's waiting for a slot":"Ποιος περιμένει θέση","Approve who joins and who fills cancellations":"Ενέκρινε ποιος μπαίνει","Nothing here yet":"Τίποτα εδώ ακόμα","Working on":"Δουλεύουμε σε","Goal":"Στόχος","Last lesson":"Τελευταίο μάθημα","Profile":"Προφίλ","Completed":"Ολοκληρωμένα","On time":"Στην ώρα","No shows":"Απουσίες","Lessons":"Μαθήματα","Late":"Αργοπορία","Did not show":"Δεν ήρθε","Did they turn up?":"Ήρθαν;","Today's schedule":"Το πρόγραμμα σήμερα","You're free today":"Είσαι ελεύθερος σήμερα","Nothing booked.":"Καμία κράτηση." },
  sv: { "Support":"Support","Help centre":"Hjälpcenter","Contact us":"Kontakta oss","Legal":"Juridik","Made in Ireland":"Gjord i Irland","Report a problem":"Rapportera problem","Back":"Tillbaka","Skip":"Hoppa över","Save":"Spara","Cancel":"Avbryt","Continue":"Fortsätt","Close":"Stäng","Add":"Lägg till","Remove":"Ta bort","Delete":"Radera","Send":"Skicka","Search":"Sök","Clear":"Rensa","Share":"Dela","Book":"Boka","Message":"Meddelande","More":"Fler","Fewer":"Färre","Done":"Klar","Details":"Detaljer","Preview":"Förhandsvisning","Practice":"Träning","Messages":"Meddelanden","Drills":"Övningar","Alerts":"Aviseringar","Stats":"Statistik","Family":"Familj","You":"Du","Help":"Hjälp","Subscription":"Prenumeration","Branding":"Profil","Availability":"Tillgänglighet","Waitlist":"Väntelista","Requests":"Förfrågningar","All lessons":"Alla lektioner","Your groups":"Dina grupper","Notifications":"Aviseringar","Personal details":"Personuppgifter","Set drills":"Ange övningar","Add a coach":"Lägg till tränare","Log a lesson":"Logga lektion","Book a lesson":"Boka lektion","Set your hours":"Ange dina tider","Account":"Konto","Calendar":"Kalender","Attendance":"Närvaro","Sign out":"Logga ut","Delete account":"Radera konto","Terms of Service":"Användarvillkor","Privacy Policy":"Integritetspolicy","Licences":"Licenser","Data & permissions":"Data och behörigheter","Weekly availability":"Veckotillgänglighet","Roster & groups":"Spelare och grupper","Your reusable library":"Ditt bibliotek","Days and times you coach":"Dagar och tider du tränar","Who's waiting for a slot":"Vem väntar på en tid","Approve who joins and who fills cancellations":"Godkänn vem som får gå med","Nothing here yet":"Inget här än","Working on":"Arbetar med","Goal":"Mål","Last lesson":"Senaste lektionen","Profile":"Profil","Completed":"Genomförda","On time":"I tid","No shows":"Uteblivna","Lessons":"Lektioner","Late":"Sen","Did not show":"Kom inte","Did they turn up?":"Kom de?","Today's schedule":"Dagens schema","You're free today":"Du är ledig idag","Nothing booked.":"Inget bokat." },
  da: { "Support":"Support","Help centre":"Hjælpecenter","Contact us":"Kontakt os","Legal":"Juridisk","Made in Ireland":"Lavet i Irland","Report a problem":"Rapportér et problem","Back":"Tilbage","Skip":"Spring over","Save":"Gem","Cancel":"Annuller","Continue":"Fortsæt","Close":"Luk","Add":"Tilføj","Remove":"Fjern","Delete":"Slet","Send":"Send","Search":"Søg","Clear":"Ryd","Share":"Del","Book":"Book","Message":"Besked","More":"Flere","Fewer":"Færre","Done":"Færdig","Details":"Detaljer","Preview":"Forhåndsvisning","Practice":"Træning","Messages":"Beskeder","Drills":"Øvelser","Alerts":"Notifikationer","Stats":"Statistik","Family":"Familie","You":"Dig","Help":"Hjælp","Subscription":"Abonnement","Branding":"Profil","Availability":"Tilgængelighed","Waitlist":"Venteliste","Requests":"Anmodninger","All lessons":"Alle lektioner","Your groups":"Dine hold","Notifications":"Notifikationer","Personal details":"Personlige oplysninger","Set drills":"Angiv øvelser","Add a coach":"Tilføj træner","Log a lesson":"Log lektion","Book a lesson":"Book lektion","Set your hours":"Angiv dine tider","Account":"Konto","Calendar":"Kalender","Attendance":"Fremmøde","Sign out":"Log ud","Delete account":"Slet konto","Terms of Service":"Vilkår","Privacy Policy":"Privatlivspolitik","Licences":"Licenser","Data & permissions":"Data og tilladelser","Weekly availability":"Ugentlig tilgængelighed","Roster & groups":"Spillere og hold","Your reusable library":"Dit bibliotek","Days and times you coach":"Dage og tider du træner","Who's waiting for a slot":"Hvem venter på en tid","Approve who joins and who fills cancellations":"Godkend hvem der kommer med","Nothing here yet":"Intet her endnu","Working on":"Arbejder med","Goal":"Mål","Last lesson":"Sidste lektion","Profile":"Profil","Completed":"Gennemførte","On time":"Til tiden","No shows":"Udeblivelser","Lessons":"Lektioner","Late":"Forsinket","Did not show":"Mødte ikke op","Did they turn up?":"Kom de?","Today's schedule":"Dagens program","You're free today":"Du har fri i dag","Nothing booked.":"Intet booket." },
  no: { "Support":"Støtte","Help centre":"Hjelpesenter","Contact us":"Kontakt oss","Legal":"Juridisk","Made in Ireland":"Laget i Irland","Report a problem":"Rapporter et problem","Back":"Tilbake","Skip":"Hopp over","Save":"Lagre","Cancel":"Avbryt","Continue":"Fortsett","Close":"Lukk","Add":"Legg til","Remove":"Fjern","Delete":"Slett","Send":"Send","Search":"Søk","Clear":"Tøm","Share":"Del","Book":"Book","Message":"Melding","More":"Flere","Fewer":"Færre","Done":"Ferdig","Details":"Detaljer","Preview":"Forhåndsvisning","Practice":"Trening","Messages":"Meldinger","Drills":"Øvelser","Alerts":"Varsler","Stats":"Statistikk","Family":"Familie","You":"Du","Help":"Hjelp","Subscription":"Abonnement","Branding":"Profil","Availability":"Tilgjengelighet","Waitlist":"Venteliste","Requests":"Forespørsler","All lessons":"Alle timer","Your groups":"Dine grupper","Notifications":"Varsler","Personal details":"Personopplysninger","Set drills":"Angi øvelser","Add a coach":"Legg til trener","Log a lesson":"Logg time","Book a lesson":"Book time","Set your hours":"Angi tidene dine","Account":"Konto","Calendar":"Kalender","Attendance":"Oppmøte","Sign out":"Logg ut","Delete account":"Slett konto","Terms of Service":"Vilkår","Privacy Policy":"Personvern","Licences":"Lisenser","Data & permissions":"Data og tillatelser","Weekly availability":"Ukentlig tilgjengelighet","Roster & groups":"Spillere og grupper","Your reusable library":"Ditt bibliotek","Days and times you coach":"Dager og tider du trener","Who's waiting for a slot":"Hvem venter på en time","Approve who joins and who fills cancellations":"Godkjenn hvem som blir med","Nothing here yet":"Ingenting her ennå","Working on":"Jobber med","Goal":"Mål","Last lesson":"Forrige time","Profile":"Profil","Completed":"Fullførte","On time":"Presis","No shows":"Uteblitt","Lessons":"Timer","Late":"Forsinket","Did not show":"Møtte ikke","Did they turn up?":"Kom de?","Today's schedule":"Dagens program","You're free today":"Du er ledig i dag","Nothing booked.":"Ingenting booket." },
  fi: { "Support":"Tuki","Help centre":"Ohjekeskus","Contact us":"Ota yhteyttä","Legal":"Oikeudellinen","Made in Ireland":"Tehty Irlannissa","Report a problem":"Ilmoita ongelmasta","Back":"Takaisin","Skip":"Ohita","Save":"Tallenna","Cancel":"Peruuta","Continue":"Jatka","Close":"Sulje","Add":"Lisää","Remove":"Poista","Delete":"Poista","Send":"Lähetä","Search":"Haku","Clear":"Tyhjennä","Share":"Jaa","Book":"Varaa","Message":"Viesti","More":"Enemmän","Fewer":"Vähemmän","Done":"Valmis","Details":"Tiedot","Preview":"Esikatselu","Practice":"Harjoittelu","Messages":"Viestit","Drills":"Harjoitukset","Alerts":"Ilmoitukset","Stats":"Tilastot","Family":"Perhe","You":"Sinä","Help":"Ohje","Subscription":"Tilaus","Branding":"Ilme","Availability":"Saatavuus","Waitlist":"Jonotuslista","Requests":"Pyynnöt","All lessons":"Kaikki tunnit","Your groups":"Ryhmäsi","Notifications":"Ilmoitukset","Personal details":"Omat tiedot","Set drills":"Aseta harjoitukset","Add a coach":"Lisää valmentaja","Log a lesson":"Kirjaa tunti","Book a lesson":"Varaa tunti","Set your hours":"Aseta aikasi","Account":"Tili","Calendar":"Kalenteri","Attendance":"Läsnäolo","Sign out":"Kirjaudu ulos","Delete account":"Poista tili","Terms of Service":"Käyttöehdot","Privacy Policy":"Tietosuoja","Licences":"Lisenssit","Data & permissions":"Tiedot ja luvat","Weekly availability":"Viikoittainen saatavuus","Roster & groups":"Pelaajat ja ryhmät","Your reusable library":"Kirjastosi","Days and times you coach":"Päivät ja ajat jolloin valmennat","Who's waiting for a slot":"Kuka odottaa paikkaa","Approve who joins and who fills cancellations":"Hyväksy kuka liittyy","Nothing here yet":"Ei vielä mitään","Working on":"Työn alla","Goal":"Tavoite","Last lesson":"Viime tunti","Profile":"Profiili","Completed":"Suoritettu","On time":"Ajoissa","No shows":"Poissaolot","Lessons":"Tunnit","Late":"Myöhässä","Did not show":"Ei tullut","Did they turn up?":"Tulivatko he?","Today's schedule":"Tämän päivän ohjelma","You're free today":"Sinulla on vapaata tänään","Nothing booked.":"Ei varauksia." },
  cs: { "Support":"Podpora","Help centre":"Centrum nápovědy","Contact us":"Kontaktujte nás","Legal":"Právní","Made in Ireland":"Vyrobeno v Irsku","Report a problem":"Nahlásit problém","Back":"Zpět","Skip":"Přeskočit","Save":"Uložit","Cancel":"Zrušit","Continue":"Pokračovat","Close":"Zavřít","Add":"Přidat","Remove":"Odebrat","Delete":"Smazat","Send":"Odeslat","Search":"Hledat","Clear":"Vymazat","Share":"Sdílet","Book":"Rezervovat","Message":"Zpráva","More":"Více","Fewer":"Méně","Done":"Hotovo","Details":"Podrobnosti","Preview":"Náhled","Practice":"Trénink","Messages":"Zprávy","Drills":"Cvičení","Alerts":"Upozornění","Stats":"Statistiky","Family":"Rodina","You":"Ty","Help":"Nápověda","Subscription":"Předplatné","Branding":"Značka","Availability":"Dostupnost","Waitlist":"Čekací listina","Requests":"Žádosti","All lessons":"Všechny lekce","Your groups":"Tvoje skupiny","Notifications":"Oznámení","Personal details":"Osobní údaje","Set drills":"Nastavit cvičení","Add a coach":"Přidat trenéra","Log a lesson":"Zapsat lekci","Book a lesson":"Rezervovat lekci","Set your hours":"Nastav své hodiny","Account":"Účet","Calendar":"Kalendář","Attendance":"Docházka","Sign out":"Odhlásit se","Delete account":"Smazat účet","Terms of Service":"Podmínky","Privacy Policy":"Ochrana údajů","Licences":"Licence","Data & permissions":"Data a oprávnění","Weekly availability":"Týdenní dostupnost","Roster & groups":"Hráči a skupiny","Your reusable library":"Tvoje knihovna","Days and times you coach":"Dny a časy, kdy trénuješ","Who's waiting for a slot":"Kdo čeká na termín","Approve who joins and who fills cancellations":"Schval, kdo se přidá","Nothing here yet":"Zatím tu nic není","Working on":"Pracujeme na","Goal":"Cíl","Last lesson":"Poslední lekce","Profile":"Profil","Completed":"Dokončeno","On time":"Včas","No shows":"Neúčasti","Lessons":"Lekce","Late":"Pozdě","Did not show":"Nepřišel","Did they turn up?":"Přišli?","Today's schedule":"Dnešní rozvrh","You're free today":"Dnes máš volno","Nothing booked.":"Nic není rezervováno." },
  ro: { "Support":"Asistență","Help centre":"Centru de ajutor","Contact us":"Contactează-ne","Legal":"Legal","Made in Ireland":"Făcut în Irlanda","Report a problem":"Raportează o problemă","Back":"Înapoi","Skip":"Omite","Save":"Salvează","Cancel":"Anulează","Continue":"Continuă","Close":"Închide","Add":"Adaugă","Remove":"Elimină","Delete":"Șterge","Send":"Trimite","Search":"Caută","Clear":"Golește","Share":"Distribuie","Book":"Rezervă","Message":"Mesaj","More":"Mai multe","Fewer":"Mai puține","Done":"Gata","Details":"Detalii","Preview":"Previzualizare","Practice":"Antrenament","Messages":"Mesaje","Drills":"Exerciții","Alerts":"Alerte","Stats":"Statistici","Family":"Familie","You":"Tu","Help":"Ajutor","Subscription":"Abonament","Branding":"Brand","Availability":"Disponibilitate","Waitlist":"Listă de așteptare","Requests":"Cereri","All lessons":"Toate lecțiile","Your groups":"Grupurile tale","Notifications":"Notificări","Personal details":"Date personale","Set drills":"Setează exerciții","Add a coach":"Adaugă antrenor","Log a lesson":"Înregistrează lecția","Book a lesson":"Rezervă o lecție","Set your hours":"Setează-ți orele","Account":"Cont","Calendar":"Calendar","Attendance":"Prezență","Sign out":"Deconectare","Delete account":"Șterge contul","Terms of Service":"Termeni","Privacy Policy":"Confidențialitate","Licences":"Licențe","Data & permissions":"Date și permisiuni","Weekly availability":"Disponibilitate săptămânală","Roster & groups":"Sportivi și grupuri","Your reusable library":"Biblioteca ta","Days and times you coach":"Zilele și orele în care antrenezi","Who's waiting for a slot":"Cine așteaptă un loc","Approve who joins and who fills cancellations":"Aprobă cine se alătură","Nothing here yet":"Încă nimic aici","Working on":"Lucrăm la","Goal":"Obiectiv","Last lesson":"Ultima lecție","Profile":"Profil","Completed":"Finalizate","On time":"La timp","No shows":"Absențe","Lessons":"Lecții","Late":"Întârziat","Did not show":"Nu a venit","Did they turn up?":"Au venit?","Today's schedule":"Programul de azi","You're free today":"Ești liber azi","Nothing booked.":"Nimic rezervat." },
  hu: { "Support":"Támogatás","Help centre":"Súgóközpont","Contact us":"Kapcsolat","Legal":"Jogi","Made in Ireland":"Írországban készült","Report a problem":"Hiba jelentése","Back":"Vissza","Skip":"Kihagyás","Save":"Mentés","Cancel":"Mégse","Continue":"Tovább","Close":"Bezárás","Add":"Hozzáadás","Remove":"Eltávolítás","Delete":"Törlés","Send":"Küldés","Search":"Keresés","Clear":"Törlés","Share":"Megosztás","Book":"Foglalás","Message":"Üzenet","More":"Több","Fewer":"Kevesebb","Done":"Kész","Details":"Részletek","Preview":"Előnézet","Practice":"Gyakorlás","Messages":"Üzenetek","Drills":"Gyakorlatok","Alerts":"Értesítések","Stats":"Statisztika","Family":"Család","You":"Te","Help":"Súgó","Subscription":"Előfizetés","Branding":"Arculat","Availability":"Elérhetőség","Waitlist":"Várólista","Requests":"Kérések","All lessons":"Összes óra","Your groups":"Csoportjaid","Notifications":"Értesítések","Personal details":"Személyes adatok","Set drills":"Gyakorlatok beállítása","Add a coach":"Edző hozzáadása","Log a lesson":"Óra rögzítése","Book a lesson":"Óra foglalása","Set your hours":"Állítsd be az időpontjaid","Account":"Fiók","Calendar":"Naptár","Attendance":"Jelenlét","Sign out":"Kijelentkezés","Delete account":"Fiók törlése","Terms of Service":"Feltételek","Privacy Policy":"Adatvédelem","Licences":"Licencek","Data & permissions":"Adatok és engedélyek","Weekly availability":"Heti elérhetőség","Roster & groups":"Játékosok és csoportok","Your reusable library":"Könyvtárad","Days and times you coach":"Napok és időpontok, amikor edzel","Who's waiting for a slot":"Ki vár időpontra","Approve who joins and who fills cancellations":"Hagyd jóvá, ki csatlakozik","Nothing here yet":"Még nincs itt semmi","Working on":"Ezen dolgozunk","Goal":"Cél","Last lesson":"Utolsó óra","Profile":"Profil","Completed":"Teljesítve","On time":"Időben","No shows":"Hiányzások","Lessons":"Órák","Late":"Késett","Did not show":"Nem jött el","Did they turn up?":"Eljöttek?","Today's schedule":"Mai program","You're free today":"Ma szabad vagy","Nothing booked.":"Nincs foglalás." },
  hr: { "Support":"Podrška","Help centre":"Centar za pomoć","Contact us":"Kontaktiraj nas","Legal":"Pravno","Made in Ireland":"Izrađeno u Irskoj","Report a problem":"Prijavi problem","Back":"Natrag","Skip":"Preskoči","Save":"Spremi","Cancel":"Odustani","Continue":"Nastavi","Close":"Zatvori","Add":"Dodaj","Remove":"Ukloni","Delete":"Izbriši","Send":"Pošalji","Search":"Traži","Clear":"Očisti","Share":"Podijeli","Book":"Rezerviraj","Message":"Poruka","More":"Više","Fewer":"Manje","Done":"Gotovo","Details":"Detalji","Preview":"Pregled","Practice":"Vježbe","Messages":"Poruke","Drills":"Vježbe","Alerts":"Obavijesti","Stats":"Statistika","Family":"Obitelj","You":"Ti","Help":"Pomoć","Subscription":"Pretplata","Branding":"Brend","Availability":"Dostupnost","Waitlist":"Lista čekanja","Requests":"Zahtjevi","All lessons":"Svi treninzi","Your groups":"Tvoje grupe","Notifications":"Obavijesti","Personal details":"Osobni podaci","Set drills":"Postavi vježbe","Add a coach":"Dodaj trenera","Log a lesson":"Zabilježi trening","Book a lesson":"Rezerviraj trening","Set your hours":"Postavi svoje termine","Account":"Račun","Calendar":"Kalendar","Attendance":"Dolasci","Sign out":"Odjava","Delete account":"Izbriši račun","Terms of Service":"Uvjeti","Privacy Policy":"Privatnost","Licences":"Licence","Data & permissions":"Podaci i dopuštenja","Weekly availability":"Tjedna dostupnost","Roster & groups":"Igrači i grupe","Your reusable library":"Tvoja biblioteka","Days and times you coach":"Dani i termini kad treniraš","Who's waiting for a slot":"Tko čeka termin","Approve who joins and who fills cancellations":"Odobri tko se pridružuje","Nothing here yet":"Ovdje još nema ničega","Working on":"Radimo na","Goal":"Cilj","Last lesson":"Zadnji trening","Profile":"Profil","Completed":"Završeno","On time":"Na vrijeme","No shows":"Nedolasci","Lessons":"Treninzi","Late":"Kasnio","Did not show":"Nije došao","Did they turn up?":"Jesu li došli?","Today's schedule":"Današnji raspored","You're free today":"Danas si slobodan","Nothing booked.":"Ništa rezervirano." },
  bg: { "Support":"Поддръжка","Help centre":"Помощен център","Contact us":"Свържете се","Legal":"Правно","Made in Ireland":"Направено в Ирландия","Report a problem":"Съобщи за проблем","Back":"Назад","Skip":"Пропусни","Save":"Запази","Cancel":"Отказ","Continue":"Продължи","Close":"Затвори","Add":"Добави","Remove":"Премахни","Delete":"Изтрий","Send":"Изпрати","Search":"Търсене","Clear":"Изчисти","Share":"Сподели","Book":"Резервирай","Message":"Съобщение","More":"Още","Fewer":"По-малко","Done":"Готово","Details":"Подробности","Preview":"Преглед","Practice":"Тренировка","Messages":"Съобщения","Drills":"Упражнения","Alerts":"Известия","Stats":"Статистика","Family":"Семейство","You":"Ти","Help":"Помощ","Subscription":"Абонамент","Branding":"Бранд","Availability":"Наличност","Waitlist":"Списък на чакащите","Requests":"Заявки","All lessons":"Всички уроци","Your groups":"Твоите групи","Notifications":"Известия","Personal details":"Лични данни","Set drills":"Задай упражнения","Add a coach":"Добави треньор","Log a lesson":"Запиши урок","Book a lesson":"Резервирай урок","Set your hours":"Задай часовете си","Account":"Профил","Calendar":"Календар","Attendance":"Присъствие","Sign out":"Изход","Delete account":"Изтрий профила","Terms of Service":"Условия","Privacy Policy":"Поверителност","Licences":"Лицензи","Data & permissions":"Данни и разрешения","Weekly availability":"Седмична наличност","Roster & groups":"Спортисти и групи","Your reusable library":"Твоята библиотека","Days and times you coach":"Дни и часове, в които тренираш","Who's waiting for a slot":"Кой чака място","Approve who joins and who fills cancellations":"Одобри кой се присъединява","Nothing here yet":"Още няма нищо тук","Working on":"Работим по","Goal":"Цел","Last lesson":"Последен урок","Profile":"Профил","Completed":"Завършени","On time":"Навреме","No shows":"Неявявания","Lessons":"Уроци","Late":"Закъснял","Did not show":"Не дойде","Did they turn up?":"Дойдоха ли?","Today's schedule":"Днешната програма","You're free today":"Днес си свободен","Nothing booked.":"Няма резервации." },
  sk: { "Support":"Podpora","Help centre":"Centrum pomoci","Contact us":"Kontaktujte nás","Legal":"Právne","Made in Ireland":"Vyrobené v Írsku","Report a problem":"Nahlásiť problém","Back":"Späť","Skip":"Preskočiť","Save":"Uložiť","Cancel":"Zrušiť","Continue":"Pokračovať","Close":"Zavrieť","Add":"Pridať","Remove":"Odstrániť","Delete":"Vymazať","Send":"Odoslať","Search":"Hľadať","Clear":"Vymazať","Share":"Zdieľať","Book":"Rezervovať","Message":"Správa","More":"Viac","Fewer":"Menej","Done":"Hotovo","Details":"Podrobnosti","Preview":"Náhľad","Practice":"Tréning","Messages":"Správy","Drills":"Cvičenia","Alerts":"Upozornenia","Stats":"Štatistiky","Family":"Rodina","You":"Ty","Help":"Pomoc","Subscription":"Predplatné","Branding":"Značka","Availability":"Dostupnosť","Waitlist":"Čakacia listina","Requests":"Žiadosti","All lessons":"Všetky lekcie","Your groups":"Tvoje skupiny","Notifications":"Oznámenia","Personal details":"Osobné údaje","Set drills":"Nastaviť cvičenia","Add a coach":"Pridať trénera","Log a lesson":"Zapísať lekciu","Book a lesson":"Rezervovať lekciu","Set your hours":"Nastav svoje hodiny","Account":"Účet","Calendar":"Kalendár","Attendance":"Dochádzka","Sign out":"Odhlásiť sa","Delete account":"Vymazať účet","Terms of Service":"Podmienky","Privacy Policy":"Ochrana údajov","Licences":"Licencie","Data & permissions":"Údaje a povolenia","Weekly availability":"Týždenná dostupnosť","Roster & groups":"Hráči a skupiny","Your reusable library":"Tvoja knižnica","Days and times you coach":"Dni a časy, keď trénuješ","Who's waiting for a slot":"Kto čaká na termín","Approve who joins and who fills cancellations":"Schváľ, kto sa pridá","Nothing here yet":"Zatiaľ tu nič nie je","Working on":"Pracujeme na","Goal":"Cieľ","Last lesson":"Posledná lekcia","Profile":"Profil","Completed":"Dokončené","On time":"Načas","No shows":"Neúčasti","Lessons":"Lekcie","Late":"Neskoro","Did not show":"Neprišiel","Did they turn up?":"Prišli?","Today's schedule":"Dnešný rozvrh","You're free today":"Dnes máš voľno","Nothing booked.":"Nič rezervované." },
  sl: { "Support":"Podpora","Help centre":"Center za pomoč","Contact us":"Kontaktiraj nas","Legal":"Pravno","Made in Ireland":"Izdelano na Irskem","Report a problem":"Prijavi težavo","Back":"Nazaj","Skip":"Preskoči","Save":"Shrani","Cancel":"Prekliči","Continue":"Naprej","Close":"Zapri","Add":"Dodaj","Remove":"Odstrani","Delete":"Izbriši","Send":"Pošlji","Search":"Iskanje","Clear":"Počisti","Share":"Deli","Book":"Rezerviraj","Message":"Sporočilo","More":"Več","Fewer":"Manj","Done":"Končano","Details":"Podrobnosti","Preview":"Predogled","Practice":"Vadba","Messages":"Sporočila","Drills":"Vaje","Alerts":"Opozorila","Stats":"Statistika","Family":"Družina","You":"Ti","Help":"Pomoč","Subscription":"Naročnina","Branding":"Znamka","Availability":"Razpoložljivost","Waitlist":"Čakalni seznam","Requests":"Zahteve","All lessons":"Vse ure","Your groups":"Tvoje skupine","Notifications":"Obvestila","Personal details":"Osebni podatki","Set drills":"Nastavi vaje","Add a coach":"Dodaj trenerja","Log a lesson":"Zabeleži uro","Book a lesson":"Rezerviraj uro","Set your hours":"Nastavi svoje termine","Account":"Račun","Calendar":"Koledar","Attendance":"Prisotnost","Sign out":"Odjava","Delete account":"Izbriši račun","Terms of Service":"Pogoji","Privacy Policy":"Zasebnost","Licences":"Licence","Data & permissions":"Podatki in dovoljenja","Weekly availability":"Tedenska razpoložljivost","Roster & groups":"Igralci in skupine","Your reusable library":"Tvoja knjižnica","Days and times you coach":"Dnevi in ure, ko treniraš","Who's waiting for a slot":"Kdo čaka na termin","Approve who joins and who fills cancellations":"Odobri, kdo se pridruži","Nothing here yet":"Tukaj še ni ničesar","Working on":"Delamo na","Goal":"Cilj","Last lesson":"Zadnja ura","Profile":"Profil","Completed":"Zaključeno","On time":"Pravočasno","No shows":"Odsotnosti","Lessons":"Ure","Late":"Zamuda","Did not show":"Ni prišel","Did they turn up?":"So prišli?","Today's schedule":"Današnji urnik","You're free today":"Danes si prost","Nothing booked.":"Nič rezerviranega." },
  lt: { "Support":"Pagalba","Help centre":"Pagalbos centras","Contact us":"Susisiekite","Legal":"Teisinė","Made in Ireland":"Pagaminta Airijoje","Report a problem":"Pranešti apie problemą","Back":"Atgal","Skip":"Praleisti","Save":"Išsaugoti","Cancel":"Atšaukti","Continue":"Tęsti","Close":"Uždaryti","Add":"Pridėti","Remove":"Pašalinti","Delete":"Ištrinti","Send":"Siųsti","Search":"Ieškoti","Clear":"Išvalyti","Share":"Bendrinti","Book":"Rezervuoti","Message":"Žinutė","More":"Daugiau","Fewer":"Mažiau","Done":"Atlikta","Details":"Išsamiau","Preview":"Peržiūra","Practice":"Treniruotė","Messages":"Žinutės","Drills":"Pratimai","Alerts":"Pranešimai","Stats":"Statistika","Family":"Šeima","You":"Tu","Help":"Pagalba","Subscription":"Prenumerata","Branding":"Prekės ženklas","Availability":"Prieinamumas","Waitlist":"Laukiančiųjų sąrašas","Requests":"Prašymai","All lessons":"Visos pamokos","Your groups":"Tavo grupės","Notifications":"Pranešimai","Personal details":"Asmens duomenys","Set drills":"Nustatyti pratimus","Add a coach":"Pridėti trenerį","Log a lesson":"Įrašyti pamoką","Book a lesson":"Rezervuoti pamoką","Set your hours":"Nustatyk savo valandas","Account":"Paskyra","Calendar":"Kalendorius","Attendance":"Lankomumas","Sign out":"Atsijungti","Delete account":"Ištrinti paskyrą","Terms of Service":"Sąlygos","Privacy Policy":"Privatumas","Licences":"Licencijos","Data & permissions":"Duomenys ir leidimai","Weekly availability":"Savaitinis prieinamumas","Roster & groups":"Žaidėjai ir grupės","Your reusable library":"Tavo biblioteka","Days and times you coach":"Dienos ir laikas, kai treniruoji","Who's waiting for a slot":"Kas laukia laisvos vietos","Approve who joins and who fills cancellations":"Patvirtink, kas prisijungia","Nothing here yet":"Čia dar nieko nėra","Working on":"Dirbame ties","Goal":"Tikslas","Last lesson":"Paskutinė pamoka","Profile":"Profilis","Completed":"Užbaigta","On time":"Laiku","No shows":"Neatvyko","Lessons":"Pamokos","Late":"Vėlavo","Did not show":"Neatvyko","Did they turn up?":"Ar jie atvyko?","Today's schedule":"Šiandienos tvarkaraštis","You're free today":"Šiandien esi laisvas","Nothing booked.":"Nieko nerezervuota." },
  uk: { "Support":"Підтримка","Help centre":"Центр допомоги","Contact us":"Звʼязатися","Legal":"Правове","Made in Ireland":"Зроблено в Ірландії","Report a problem":"Повідомити про проблему","Back":"Назад","Skip":"Пропустити","Save":"Зберегти","Cancel":"Скасувати","Continue":"Далі","Close":"Закрити","Add":"Додати","Remove":"Прибрати","Delete":"Видалити","Send":"Надіслати","Search":"Пошук","Clear":"Очистити","Share":"Поділитися","Book":"Забронювати","Message":"Повідомлення","More":"Більше","Fewer":"Менше","Done":"Готово","Details":"Деталі","Preview":"Попередній перегляд","Practice":"Тренування","Messages":"Повідомлення","Drills":"Вправи","Alerts":"Сповіщення","Stats":"Статистика","Family":"Сім'я","You":"Ти","Help":"Довідка","Subscription":"Підписка","Branding":"Бренд","Availability":"Доступність","Waitlist":"Список очікування","Requests":"Запити","All lessons":"Усі заняття","Your groups":"Твої групи","Notifications":"Сповіщення","Personal details":"Особисті дані","Set drills":"Задати вправи","Add a coach":"Додати тренера","Log a lesson":"Записати заняття","Book a lesson":"Забронювати заняття","Set your hours":"Встанови свої години","Account":"Обліковий запис","Calendar":"Календар","Attendance":"Відвідуваність","Sign out":"Вийти","Delete account":"Видалити акаунт","Terms of Service":"Умови","Privacy Policy":"Конфіденційність","Licences":"Ліцензії","Data & permissions":"Дані та дозволи","Weekly availability":"Тижнева доступність","Roster & groups":"Спортсмени та групи","Your reusable library":"Твоя бібліотека","Days and times you coach":"Дні та години, коли ти тренуєш","Who's waiting for a slot":"Хто чекає на місце","Approve who joins and who fills cancellations":"Затвердь, хто приєднується","Nothing here yet":"Тут поки нічого немає","Working on":"Працюємо над","Goal":"Ціль","Last lesson":"Останнє заняття","Profile":"Профіль","Completed":"Завершено","On time":"Вчасно","No shows":"Пропуски","Lessons":"Заняття","Late":"Запізнився","Did not show":"Не прийшов","Did they turn up?":"Вони прийшли?","Today's schedule":"Сьогоднішній розклад","You're free today":"Сьогодні ти вільний","Nothing booked.":"Нічого не заброньовано." },
  tr: { "Support":"Destek","Help centre":"Yardım merkezi","Contact us":"Bize ulaşın","Legal":"Yasal","Made in Ireland":"İrlanda'da yapıldı","Report a problem":"Sorun bildir","Back":"Geri","Skip":"Atla","Save":"Kaydet","Cancel":"İptal","Continue":"Devam","Close":"Kapat","Add":"Ekle","Remove":"Kaldır","Delete":"Sil","Send":"Gönder","Search":"Ara","Clear":"Temizle","Share":"Paylaş","Book":"Rezerve et","Message":"Mesaj","More":"Daha fazla","Fewer":"Daha az","Done":"Tamam","Details":"Ayrıntılar","Preview":"Önizleme","Practice":"Antrenman","Messages":"Mesajlar","Drills":"Çalışmalar","Alerts":"Bildirimler","Stats":"İstatistikler","Family":"Aile","You":"Sen","Help":"Yardım","Subscription":"Abonelik","Branding":"Marka","Availability":"Uygunluk","Waitlist":"Bekleme listesi","Requests":"İstekler","All lessons":"Tüm dersler","Your groups":"Gruplarýn","Notifications":"Bildirimler","Personal details":"Kişisel bilgiler","Set drills":"Çalışma belirle","Add a coach":"Antrenör ekle","Log a lesson":"Ders kaydet","Book a lesson":"Ders rezerve et","Set your hours":"Saatlerini belirle","Account":"Hesap","Calendar":"Takvim","Attendance":"Katılım","Sign out":"Çıkış yap","Delete account":"Hesabı sil","Terms of Service":"Koşullar","Privacy Policy":"Gizlilik","Licences":"Lisanslar","Data & permissions":"Veri ve izinler","Weekly availability":"Haftalık uygunluk","Roster & groups":"Sporcular ve gruplar","Your reusable library":"Kütüphanen","Days and times you coach":"Antrenman verdiğin gün ve saatler","Who's waiting for a slot":"Kim yer bekliyor","Approve who joins and who fills cancellations":"Kimin katılacağını onayla","Nothing here yet":"Burada henüz bir şey yok","Working on":"Üzerinde çalışılan","Goal":"Hedef","Last lesson":"Son ders","Profile":"Profil","Completed":"Tamamlanan","On time":"Zamanında","No shows":"Gelmeyenler","Lessons":"Dersler","Late":"Geç","Did not show":"Gelmedi","Did they turn up?":"Geldiler mi?","Today's schedule":"Bugünkü program","You're free today":"Bugün boştasın","Nothing booked.":"Rezervasyon yok." },
};

export const tr = (str) => {
  if (!str || LANG === "en") return str;
  const e = PHRASES[str];
  if (e && e[LANG]) return e[LANG];
  const byLang = PHRASES_BY_LANG[LANG];
  return (byLang && byLang[str]) || str;
};



const LangCtx = createContext(STRINGS.en);
const useL = () => useContext(LangCtx);

/* ==================================================================
   DARK MODE — one deep neutral palette that keeps each sport's accent,
   rather than six hand-tuned dark themes to drift out of sync.
================================================================== */
function darkify(theme) {
  return {
    ...theme,
    ink: "#F2F4F3", sub: "#A6B0AE", faint: "#6D7876",
    hair: "#232A2C", page: "#FFFFFF", surface: "#FFFFFF", wash: "#1C2325",
  };
}

/* Per-sport context captured on a lesson — the detail that actually
   matters to that sport and nowhere else. */
const CONTEXTS = {
  golf:       { label: "Where", options: ["Range", "On course", "Short game area", "Studio"] },
  tennis:     { label: "Surface", options: ["Hard", "Clay", "Grass", "Indoor"] },
  rowing:     { label: "Session", options: ["Water", "Erg", "Tank", "Land training"] },
  squash:     { label: "Court", options: ["Glass back", "Standard", "Doubles"] },
  padel:      { label: "Court", options: ["Indoor", "Outdoor", "Panoramic"] },
  equestrian: { label: "Discipline", options: ["Flatwork", "Dressage test", "Show jumping", "Hacking"] },
};

export const ThemeCtx = createContext(NEUTRAL);
export const useT = () => useContext(ThemeCtx);
export const display = "'Cabinet Grotesk', ui-sans-serif, -apple-system, sans-serif";
/* One editorial serif, used only for a single emphasised phrase inside a
   heading — never for a whole block. Oura's technique; it is the thing
   that makes a sentence feel written rather than generated. */
const editorial = "'Zodiak', 'Cabinet Grotesk', ui-serif, Georgia, serif";
export const ui = "'Switzer', 'Instrument Sans', ui-sans-serif, -apple-system, sans-serif";

/* ------------------------------------------------------------------
   TYPE SCALE
   One ladder, tightening as it climbs. Optical letter-spacing matters
   more than size: large display text needs negative tracking to stop
   looking loose, small caps need positive tracking to stay legible.
------------------------------------------------------------------ */
/* opsz is doing real work here: large sizes get the high-contrast,
   tightly-fitted cut, small sizes get the sturdier one. SOFT rounds the
   terminals very slightly so it reads warm rather than clinical. */
/* Gabarito carries a heading through weight and tight tracking rather
   than size — which is why headings here are smaller than before but
   read louder. Less shouting, more presence. */
export const TYPE = {
  /* Large sizes go LIGHTER, not heavier — that is the whole trick. A
     32px heading at weight 300 with tight tracking reads considered;
     the same heading at 700 reads like a warning sign. */
  hero:    { fontFamily: display, fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.03em",  fontWeight: 300 },
  title:   { fontFamily: display, fontSize: 23, lineHeight: 1.16, letterSpacing: "-0.024em", fontWeight: 400 },
  heading: { fontFamily: display, fontSize: 18, lineHeight: 1.28, letterSpacing: "-0.018em", fontWeight: 500 },
  subhead: { fontFamily: display, fontSize: 15.5, lineHeight: 1.38, letterSpacing: "-0.012em", fontWeight: 500 },
  figure:  { fontFamily: display, fontSize: 30, lineHeight: 1,    letterSpacing: "-0.035em", fontWeight: 300, fontVariantNumeric: "tabular-nums lining" },
  body:    { fontFamily: ui,      fontSize: 14.5, lineHeight: 1.5, letterSpacing: "-0.005em", fontWeight: 400 },
  small:   { fontFamily: ui,      fontSize: 12.5, lineHeight: 1.45, letterSpacing: "-0.002em", fontWeight: 400 },
  caption: { fontFamily: ui,      fontSize: 11, lineHeight: 1.4, fontWeight: 400 },
  eyebrow: { fontFamily: ui,      fontSize: 9.5, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 },
};

/* Depth as a system. Three levels only — anything more and the screen
   stops having a clear surface. */
export const ELEV = {
  flat:  "none",
  rest:  "0 1px 2px rgba(14,20,26,0.03), 0 2px 8px rgba(14,20,26,0.02)",
  raise: "0 2px 6px rgba(14,20,26,0.04), 0 12px 28px rgba(14,20,26,0.05)",
  float: "0 6px 16px rgba(14,20,26,0.06), 0 22px 48px rgba(14,20,26,0.08)",
};

/* ==================================================================
   FEEDBACK — haptics + restrained sound. Sound is opt-out, synthesized
   (no audio files to host), and only fires at a handful of meaningful
   moments rather than on every tap — that restraint is the point.
================================================================== */
let SOUND_ON = true;
const setSoundOn = (v) => { SOUND_ON = v; };
let audioCtx = null;
function ctx() {
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  return audioCtx;
}
function tone(freq, dur, vol, delay = 0) {
  if (!SOUND_ON) return;
  const c = ctx();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch (e) {}
}
const chime   = () => { tone(660, 0.16, 0.05); tone(990, 0.2, 0.045, 0.09); };
const swell   = () => { tone(523, 0.18, 0.04); tone(784, 0.22, 0.038, 0.10); tone(1047, 0.26, 0.03, 0.20); };
export const soft    = () => tone(880, 0.09, 0.028);
const decline = () => { tone(392, 0.14, 0.04); tone(294, 0.2, 0.035, 0.09); };
let HAPTICS_ON = true;
const setHapticsEnabled = (v) => { HAPTICS_ON = v; };
/* HAPTICS

   navigator.vibrate does not exist on iOS Safari — it is an Android and
   desktop API. Every haptic in this prototype was silently doing
   nothing on an iPhone or iPad, which is why none could be felt.

   The one route iOS does give a web page is a switch-style checkbox:
   since iOS 17.4, activating a <label> bound to
   <input type="checkbox" switch> produces a real system haptic. We keep
   one hidden pair in the document and click the label. It is a trick,
   but it is the only honest way to get a tap on iOS from the web. */
let _hapticEl = null;
const _iosTick = () => {
  if (typeof document === "undefined") return false;
  if (!_hapticEl) {
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none";
    wrap.innerHTML = '<input type="checkbox" switch id="nosca-haptic" style="appearance:none"><label for="nosca-haptic"></label>';
    document.body.appendChild(wrap);
    _hapticEl = wrap.querySelector("label");
  }
  try { _hapticEl.click(); return true; } catch (e) { return false; }
};

export const haptic = (ms = 8) => {
  if (!HAPTICS_ON) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    _iosTick();
  } catch (e) {}
};

/* Distinct patterns, so the hand learns the difference between a tap,
   a commitment, and something going wrong. On iOS we can only fire the
   one tick, so patterns become a short burst of them. */
const buzz = (pattern) => {
  if (!HAPTICS_ON) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    const beats = Math.min(3, Math.ceil(pattern.length / 2));
    for (let i = 0; i < beats; i++) setTimeout(_iosTick, i * 70);
  } catch (e) {}
};
export const hapticSuccess = () => buzz([14, 40, 26]);
export const hapticWarn    = () => buzz([28, 60, 28]);
export const hapticCommit  = () => buzz([10, 30, 10, 30, 22]);

const ROSTER = [
  { name: "Marcus Tran",  lessons: 12, since: "Feb 2026", pack: [8, 10], last: 10 },
  { name: "Priya Ellis",  lessons: 8,  since: "Mar 2026", pr: [3, 3], pack: [2, 10], last: 1 },
  { name: "Dan Okafor",   lessons: 5,  since: "Apr 2026", pr: [0, 2], last: 21 },
  { name: "Sofia Reyes",  lessons: 3,  since: "May 2026", pr: [1, 4], last: 8 },
  { name: "Tom Beckett",  lessons: 1,  since: "Jul 2026", last: 2 },
  { name: "Aoife Nolan",    lessons: 34, since: "Sep 2025", pack: [4, 10], last: 3 },
  { name: "Tom Beckett",    lessons: 19, since: "Nov 2025", pack: [6, 10], last: 2 },
  { name: "Hannah Doyle",   lessons: 27, since: "Aug 2025", pr: [2, 4], last: 5 },
  { name: "Eoin Breathnach",lessons: 41, since: "Jan 2025", pack: [1, 10], last: 1 },
  { name: "Sinead Walsh",   lessons: 15, since: "Feb 2026", last: 8 },
  { name: "Cian Murphy",    lessons: 22, since: "Oct 2025", pack: [9, 10], last: 4 },
  { name: "Orla Fitzgerald",lessons: 11, since: "Apr 2026", last: 6 },
  { name: "Declan Ryan",    lessons: 38, since: "Jun 2025", pr: [5, 6], last: 2 },
  { name: "Maeve Kelleher", lessons: 7,  since: "May 2026", last: 12 },
  { name: "Rory Gallagher", lessons: 29, since: "Dec 2025", pack: [3, 10], last: 3 },
];
const PLAYERS = ROSTER.map((r) => r.name);

/* ==================================================================
   CALENDAR · June – October 2026, so "months ahead" has real room
================================================================== */
/* One live pointer so module-level date helpers can localise without
   every call site having to thread the language through. */
let LANG = "en";
const setLangGlobal = (l) => { LANG = CAL_I18N[l] ? l : "en"; };
const cal = () => CAL_I18N[LANG] || CAL_I18N.en;

const DOW_FOR = () => cal().d.map((x) => x.slice(0, 1).toUpperCase());
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = new Proxy([], { get: (_, k) => (typeof k === "string" && /^\d+$/.test(k) ? cal().d[Number(k)] : cal().d[k] ?? Array.prototype[k]) });
const MONTH_SHAPE = [
  { idx: 6,  days: 30, start: 0 }, { idx: 7,  days: 31, start: 2 },
  { idx: 8,  days: 31, start: 5 }, { idx: 9,  days: 30, start: 1 },
  { idx: 10, days: 31, start: 3 },
];
/* name resolves against whichever language is live */
const MONTHS = MONTH_SHAPE.map((m) => Object.defineProperty({ ...m }, "name", {
  get() { return cal().m[this.idx - 1] + " 2026"; }, enumerable: true,
}));
const MONTHS_FULL = new Proxy([], { get: (_, k) => (typeof k === "string" && /^\d+$/.test(k) ? cal().m[Number(k)] : cal().m[k] ?? Array.prototype[k]) });
const TODAY = { m: 7, d: 24 };
const DURATIONS = [30, 45, 60, 90];
/* "9:00 am" + 45 -> "9:45 am". Booking without a finish time is how
   coaches end up double-booked. */
function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec((str || "").trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}
function fmtTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60), mm = m % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ampm}`;
}
const endTime = (start, mins) => { const t0 = parseTime(start); return t0 == null ? "" : fmtTime(t0 + mins); };
const span = (start, mins) => `${start.replace(/\s?(am|pm)$/i, "")}–${endTime(start, mins)}`;

const ALL_TIMES = ["8:00 am", "9:00 am", "10:00 am", "11:00 am", "2:00 pm", "3:30 pm", "4:30 pm", "5:30 pm"];

/* Availability, bookings, groups and libraries are all keyed by sport.
   Generating them from SPORTS means a new sport needs no plumbing. */
const WEEK_PATTERNS = [
  { 0: [], 1: ["8:00 am","9:00 am","10:00 am","4:30 pm","5:30 pm"], 2: ["9:00 am","10:00 am","11:00 am","4:30 pm","5:30 pm"],
    3: ["8:00 am","9:00 am","10:00 am","11:00 am","2:00 pm"], 4: ["8:00 am","9:00 am","10:00 am","11:00 am","2:00 pm","3:30 pm","4:30 pm"],
    5: ["8:00 am","9:00 am","10:00 am","11:00 am"], 6: [] },
  { 0: [], 1: ["9:00 am","10:00 am","3:30 pm","4:30 pm"], 2: ["8:00 am","9:00 am","4:30 pm","5:30 pm"],
    3: ["9:00 am","10:00 am","11:00 am","3:30 pm"], 4: [], 5: ["9:00 am","10:00 am","11:00 am","3:30 pm","4:30 pm"], 6: ["9:00 am","10:00 am"] },
  { 0: ["8:00 am","9:00 am"], 1: ["8:00 am","9:00 am","5:30 pm"], 2: ["8:00 am","9:00 am","5:30 pm"],
    3: ["8:00 am","9:00 am","5:30 pm"], 4: ["8:00 am","9:00 am"], 5: ["8:00 am","9:00 am","10:00 am"], 6: ["9:00 am","10:00 am"] },
];
const DEFAULT_AVAIL = Object.fromEntries(
  Object.keys(SPORTS).map((id, i) => [id, WEEK_PATTERNS[i % WEEK_PATTERNS.length]])
);


/* A busy fortnight ahead, generated so the diary carries a real load:
   roughly sixty bookings, evenly split between private and group. */
const BUSY_AHEAD = (() => {
  const out = {};
  const names = ["Marcus Tran","Priya Ellis","Dan Okafor","Aoife Nolan","Tom Beckett","Hannah Doyle",
                 "Eoin Breathnach","Sinead Walsh","Cian Murphy","Orla Fitzgerald","Declan Ryan",
                 "Maeve Kelleher","Rory Gallagher","Sofia Reyes"];
  const groups = ["Summer clinic","Junior squad","Ladies group","Sunday scramble","Winter league"];
  let n = 0;
  for (let day = 22; day <= 31; day++) {
    const k = `7-${String(day).padStart(2, "0")}`;
    const rows = [];
    for (let j = 0; j < 3 + (day % 3); j++) {
      const grp = n % 2 === 0;
      const hr = 8 + j * 2;
      rows.push({ time: `${hr > 12 ? hr - 12 : hr}:${j % 2 ? "30" : "00"} ${hr < 12 ? "am" : "pm"}`,
                  who: grp ? groups[n % groups.length] : names[n % names.length],
                  kind: grp ? `Group · ${4 + (n % 6)}` : "Private", group: grp });
      n++;
    }
    out[k] = rows;
  }
  for (let day = 1; day <= 14; day++) {
    const k = `8-${String(day).padStart(2, "0")}`;
    const rows = [];
    for (let j = 0; j < 2 + (day % 3); j++) {
      const grp = n % 2 === 0;
      const hr = 9 + j * 2;
      rows.push({ time: `${hr > 12 ? hr - 12 : hr}:${j % 2 ? "30" : "00"} ${hr < 12 ? "am" : "pm"}`,
                  who: grp ? groups[n % groups.length] : names[n % names.length],
                  kind: grp ? `Group · ${4 + (n % 6)}` : "Private", group: grp });
      n++;
    }
    out[k] = rows;
  }
  return out;
})();

const SEED_BOOKINGS = {
  ...Object.fromEntries(Object.keys(SPORTS).map((id) => [id, { ...BUSY_AHEAD }])),
  golf: {
    "7-22": [{ time: "10:00 am", who: "Tom Beckett", kind: "Private" }],
    "7-24": [{ time: "11:00 am", who: "Marcus Tran", kind: "Private" },
             { time: "2:00 pm",  who: "Summer clinic", kind: "Group · 9", group: true },
             { time: "4:30 pm",  who: "Priya Ellis", kind: "Private" }],
    "7-28": [{ time: "8:00 am",  who: "Dan Okafor", kind: "Private" }],
    "7-29": [{ time: "5:30 pm",  who: "Sofia Reyes", kind: "Private" }],
    "8-04": [{ time: "9:00 am",  who: "Priya Ellis", kind: "Private" }],
  },
  tennis: {
    "7-25": [{ time: "4:30 pm", who: "Junior squad", kind: "Group · 6", group: true }],
    "7-29": [{ time: "9:00 am", who: "Ellie Tran", kind: "Private" }],
  },
};

/* Sessions that have already happened and were never logged.
   Without this they'd silently vanish, which is the worst outcome. */
const UNLOGGED = [
  { who: "Tom Beckett", m: 7, d: 22, time: "10:00 am", kind: "Private" },
  { who: "Dan Okafor",  m: 7, d: 18, time: "8:00 am",  kind: "Private" },
  { who: "Summer clinic", m: 7, d: 17, time: "2:00 pm", kind: "Group · 9" },
];

const key = (m, d) => `${m}-${String(d).padStart(2, "0")}`;
const dowOf = (m, d) => { const mo = MONTHS.find((x) => x.idx === m); return (mo.start + d - 1) % 7; };
const isPast = (m, d) => m < TODAY.m || (m === TODAY.m && d < TODAY.d);

function openTimes(m, d, avail, blocked, mine, seedBooked) {
  if (isPast(m, d)) return [];
  const base = avail[dowOf(m, d)] || [];
  const taken = (seedBooked[key(m, d)] || []).map((b) => b.time);
  const off = blocked.filter((b) => b.m === m && b.d === d).map((b) => b.time);
  const own = mine.filter((b) => b.m === m && b.d === d).map((b) => b.time);
  return base.filter((t) => !taken.includes(t) && !off.includes(t) && !own.includes(t));
}
function earliestSlot(avail, blocked, mine, seedBooked) {
  for (const mo of MONTHS) {
    for (let d = 1; d <= mo.days; d++) {
      if (isPast(mo.idx, d)) continue;
      const times = openTimes(mo.idx, d, avail, blocked, mine, seedBooked);
      if (times.length) return { m: mo.idx, d, time: times[0], month: mo.name.split(" ")[0] };
    }
  }
  return null;
}
/* Walks forward day by day collecting the next N occurrences of a weekday —
   powers recurring-group scheduling, months out if the range allows it. */
/* Walks forward from today collecting occurrences, honouring the gap
   between them: weekly, fortnightly or monthly. */
function seriesOccurrences(dowTarget, count, freq, fromM, fromD) {
  const stepWeeks = freq === "fortnightly" ? 2 : freq === "monthly" ? 4 : 1;
  const out = [];
  let mi = MONTHS.findIndex((m) => m.idx === (fromM || TODAY.m));
  if (mi < 0) mi = 0;
  let d = (fromD || TODAY.d) + 1, m = MONTHS[mi], hits = 0;
  while (out.length < count && mi < MONTHS.length) {
    if (d > m.days) { d = 1; mi += 1; if (mi >= MONTHS.length) break; m = MONTHS[mi]; continue; }
    if (dowOf(m.idx, d) === dowTarget) {
      if (hits % stepWeeks === 0) out.push({ m: m.idx, d });
      hits += 1;
    }
    d += 1;
  }
  return out;
}

function nextOccurrences(dowTarget, count) {
  const out = [];
  let mi = MONTHS.findIndex((m) => m.idx === TODAY.m);
  let d = TODAY.d + 1, m = MONTHS[mi];
  while (out.length < count && mi < MONTHS.length) {
    if (d > m.days) { d = 1; mi += 1; if (mi >= MONTHS.length) break; m = MONTHS[mi]; continue; }
    if (dowOf(m.idx, d) === dowTarget) out.push({ m: m.idx, d });
    d += 1;
  }
  return out;
}

/* ==================================================================
   NOTIFICATIONS
================================================================== */
const NOTIFS = {
  coach: [
    { k: "booking",  icon: Calendar,   t: "Priya Ellis booked Wed 29 Jul", s: "5:30 pm · private", when: "9m", fresh: true },
    { k: "practice", icon: ListChecks, t: "Marcus completed the ladder drill", s: "3 of 3 done this week", when: "1h", fresh: true },
    { k: "video",    icon: Eye,        t: "Marcus watched 95% of your review", s: "Short game · 14 Jun", when: "2h", fresh: true },
    { k: "risk",     icon: TrendingUp, t: "Dan Okafor hasn't booked in 21 days", s: "Consider a check-in", when: "Yesterday" },
    { k: "milestone",icon: Sparkles,   t: "You've coached 100 lessons on Nosca", s: "Since February", when: "Wed" },
  ],
  player: [
    { k: "lesson",   icon: Library,    t: "Ray published your short game review", s: "2 clips · 14 Jun", when: "20m", fresh: true },
    { k: "practice", icon: ListChecks, t: "Two drills still to do this week", s: "Set by Ray", when: "3h" },
    { k: "booking",  icon: Calendar,   t: "Lesson tomorrow at 4:30 pm", s: "12°C, light wind", when: "Yesterday" },
    { k: "milestone",icon: Sparkles,   t: "Handicap down to 12.4", s: "From 14.1 in February", when: "Mon" },
  ],
};
const NOTIF_CATS = {
  coach:  [["Bookings", "New, cancelled and rescheduled"], ["Weekly calendar check", "Every Sunday, to confirm the week ahead"], ["Practice", "When they complete drills"],
           ["Video engagement", "When they watch a review"], ["Your subscription", "Renewals and billing"],
           ["Who needs attention", "Inactivity and follow-ups"], ["Milestones", "Streaks and anniversaries"]],
  player: [["Lessons", "When your coach publishes"], ["Practice", "New drills and reminders"],
           ["Bookings", "Reminders and changes"], ["Messages", "Direct from your coach"],
           ["Milestones", "Progress worth celebrating"], ["News from Nosca", "Occasional product updates"]],
};

/* ==================================================================
   MESSAGES — urgent, logistical, text only
================================================================== */
/* Every message carries the language it was written in, plus what it
   becomes in each of ours. Translation is offered, never forced —
   "show original" has to be one tap away or you have taken something
   from the person who wrote it. */
/* Every message is stored once with the language it was written in.
   Each person reads it in their own language — so an Irish coach and a
   Spanish player have one conversation, in two languages, and neither
   is reading the other's. The original is always one tap away. */
const MSG_I18N = {
  m1: { src:"en", en:"Might be ten minutes late on Monday — is that alright?", ga:"B'fhéidir go mbeidh mé deich nóiméad déanach Dé Luain — an bhfuil sé sin ceart go leor?", es:"Puede que llegue diez minutos tarde el lunes, ¿te viene bien?", fr:"Je risque d'avoir dix minutes de retard lundi — ça vous va ?", de:"Am Montag komme ich vielleicht zehn Minuten später — ist das in Ordnung?", it:"Lunedì potrei arrivare dieci minuti tardi — va bene?", pt:"Posso chegar dez minutos atrasado na segunda — tudo bem?", nl:"Ik ben maandag misschien tien minuten later — is dat goed?", pl:"W poniedziałek mogę się spóźnić dziesięć minut — czy to w porządku?", sv:"Jag kan bli tio minuter sen på måndag — går det bra?", el:"Ίσως αργήσω δέκα λεπτά τη Δευτέρα — είναι εντάξει;", uk:"У понеділок можу запізнитися на десять хвилин — це нормально?", tr:"Pazartesi on dakika geç kalabilirim — uygun mu?" },
  m2: { src:"en", en:"No bother, we'll still get the full session in.", ga:"Fadhb ar bith, gheobhaidh muid an seisiún iomlán isteach fós.", es:"Sin problema, aun así haremos la sesión completa.", fr:"Pas de souci, on fera quand même la séance complète.", de:"Kein Problem, wir schaffen die volle Einheit trotzdem.", it:"Nessun problema, faremo comunque la sessione completa.", pt:"Sem problema, faremos a sessão completa na mesma.", nl:"Geen probleem, we doen alsnog de volledige sessie.", pl:"Żaden problem, i tak zrobimy pełny trening.", sv:"Inga problem, vi hinner ändå hela passet.", el:"Κανένα πρόβλημα, θα κάνουμε ολόκληρη την προπόνηση.", uk:"Не проблема, ми все одно проведемо повне заняття.", tr:"Sorun değil, yine de tam seansı yaparız." },
  m3: { src:"en", en:"Perfect, see you Monday.", ga:"Foirfe, feicfidh mé Dé Luain thú.", es:"Perfecto, nos vemos el lunes.", fr:"Parfait, à lundi.", de:"Perfekt, bis Montag.", it:"Perfetto, ci vediamo lunedì.", pt:"Perfeito, até segunda.", nl:"Perfect, tot maandag.", pl:"Świetnie, do poniedziałku.", sv:"Perfekt, vi ses på måndag.", el:"Τέλεια, τα λέμε Δευτέρα.", uk:"Чудово, побачимось у понеділок.", tr:"Harika, pazartesi görüşürüz." },
  m4: { src:"en", en:"Hi Ray — something's come up Wednesday afternoon.", ga:"Dia duit a Ray — tháinig rud éigin aníos tráthnóna Dé Céadaoin.", es:"Hola Ray, me ha surgido algo el miércoles por la tarde.", fr:"Bonjour Ray — j'ai un imprévu mercredi après-midi.", de:"Hallo Ray — mir ist am Mittwochnachmittag etwas dazwischengekommen.", it:"Ciao Ray — mi è capitato un imprevisto mercoledì pomeriggio.", pt:"Olá Ray — surgiu-me algo na quarta à tarde.", nl:"Hoi Ray — er is iets tussengekomen woensdagmiddag.", pl:"Cześć Ray — coś mi wypadło w środę po południu.", sv:"Hej Ray — något har kommit emellan på onsdag eftermiddag.", el:"Γεια σου Ρέι — μου προέκυψε κάτι την Τετάρτη το απόγευμα.", uk:"Привіт, Рей — у середу по обіді дещо трапилось.", tr:"Merhaba Ray — çarşamba öğleden sonra bir işim çıktı." },
  m5: { src:"en", en:"Could we move Wednesday to six?", ga:"An bhféadfaimis Dé Céadaoin a bhogadh go dtí a sé?", es:"¿Podríamos mover el miércoles a las seis?", fr:"Pourrait-on décaler mercredi à dix-huit heures ?", de:"Könnten wir Mittwoch auf achtzehn Uhr verschieben?", it:"Potremmo spostare mercoledì alle sei?", pt:"Podemos mudar quarta para as seis?", nl:"Kunnen we woensdag naar zes uur verzetten?", pl:"Czy możemy przenieść środę na szóstą?", sv:"Kan vi flytta onsdag till sex?", el:"Μπορούμε να μεταφέρουμε την Τετάρτη στις έξι;", uk:"Чи можемо перенести середу на шосту?", tr:"Çarşambayı altıya alabilir miyiz?" },
  m6: { src:"en", en:"Course is closed for the medal on Saturday, so we'll use the range.", ga:"Tá an cúrsa dúnta don bhonn Dé Sathairn, mar sin bainfimid úsáid as an raon.", es:"El campo está cerrado por el medal del sábado, así que usaremos el campo de prácticas.", fr:"Le parcours est fermé pour le medal samedi, on utilisera donc le practice.", de:"Der Platz ist am Samstag wegen des Medals gesperrt, also nutzen wir die Range.", it:"Il campo è chiuso per la medal di sabato, useremo il driving range.", pt:"O campo está fechado no sábado, por isso usamos o driving range.", nl:"De baan is zaterdag dicht, dus we gebruiken de range.", pl:"Pole jest zamknięte w sobotę, więc skorzystamy z driving range.", sv:"Banan är stängd på lördag, så vi använder rangen.", el:"Το γήπεδο είναι κλειστό το Σάββατο, οπότε θα χρησιμοποιήσουμε το range.", uk:"Поле закрите в суботу, тож будемо на драйв-рейнджі.", tr:"Saha cumartesi kapalı, o yüzden range kullanacağız." },
  m7: { src:"en", en:"Grand, thanks for the heads up.", ga:"Go breá, go raibh maith agat as an rabhadh.", es:"Genial, gracias por avisar.", fr:"Très bien, merci pour l'info.", de:"Alles klar, danke für den Hinweis.", it:"Ottimo, grazie per l'avviso.", pt:"Ótimo, obrigado pelo aviso.", nl:"Prima, bedankt voor het laten weten.", pl:"Świetnie, dzięki za info.", sv:"Toppen, tack för att du sa till.", el:"Ωραία, ευχαριστώ για την ενημέρωση.", uk:"Чудово, дякую, що попередив.", tr:"Harika, haber verdiğin için sağ ol." },
  m8: { src:"en", en:"Saturday is on. Meet at the short game area at eight.", ga:"Tá Dé Sathairn ar siúl. Buailimis le chéile ag an limistéar cluiche ghearr ar a hocht.", es:"El sábado sigue en pie. Nos vemos en la zona de juego corto a las ocho.", fr:"Samedi est maintenu. Rendez-vous à l'aire de petit jeu à huit heures.", de:"Samstag findet statt. Treffpunkt um acht im Kurzspielbereich.", it:"Sabato si fa. Ci vediamo all'area di gioco corto alle otto.", pt:"Sábado mantém-se. Encontro na zona de jogo curto às oito.", nl:"Zaterdag gaat door. Om acht uur bij het korte spel.", pl:"Sobota aktualna. Spotykamy się przy short game o ósmej.", sv:"Lördag gäller. Vi ses vid närspelsområdet klockan åtta.", el:"Το Σάββατο ισχύει. Ραντεβού στο short game στις οκτώ.", uk:"Субота в силі. Зустрічаємось на зоні короткої гри о восьмій.", tr:"Cumartesi var. Sekizde kısa oyun alanında buluşuyoruz." },
  m9: { src:"en", en:"Bring a wedge on Saturday.", ga:"Tabhair wedge leat Dé Sathairn.", es:"Trae un wedge el sábado.", fr:"Apportez un wedge samedi.", de:"Bring am Samstag ein Wedge mit.", it:"Porta un wedge sabato.", pt:"Traz um wedge no sábado.", nl:"Neem zaterdag een wedge mee.", pl:"Weź wedge na sobotę.", sv:"Ta med en wedge på lördag.", el:"Φέρε ένα wedge το Σάββατο.", uk:"Візьми ведж у суботу.", tr:"Cumartesi bir wedge getir." },
  m10: { src:"en", en:"Range is packed at six this evening.", ga:"Tá an raon plódaithe ar a sé tráthnóna inniu.", es:"El campo de prácticas está lleno a las seis esta tarde.", fr:"Le practice est bondé à dix-huit heures ce soir.", de:"Die Range ist heute Abend um sechs voll.", it:"Il range è pieno alle sei stasera.", pt:"O driving range está cheio às seis hoje.", nl:"De range is vanavond om zes uur vol.", pl:"Driving range jest zapchany o szóstej.", sv:"Rangen är full klockan sex ikväll.", el:"Το range είναι γεμάτο στις έξι απόψε.", uk:"Драйв-рейндж переповнений о шостій.", tr:"Range bu akşam altıda dolu." },
  m11: { src:"en", en:"Come at half five if you can.", ga:"Tar ar leathuair tar éis a cúig más féidir leat.", es:"Ven a las cinco y media si puedes.", fr:"Venez à dix-sept heures trente si vous pouvez.", de:"Komm um halb sechs, wenn du kannst.", it:"Vieni alle cinque e mezza se puoi.", pt:"Vem às cinco e meia se puderes.", nl:"Kom om half zes als je kunt.", pl:"Przyjdź o wpół do szóstej, jeśli możesz.", sv:"Kom halv sex om du kan.", el:"Έλα στις πέντε και μισή αν μπορείς.", uk:"Приходь о пів на шосту, якщо можеш.", tr:"Yapabilirsen beş buçukta gel." },
};
/* Resolve a message into the reader's language, falling back to the
   language it was written in — never to a third language. */
const readMsg = (id, lang) => {
  const e = MSG_I18N[id];
  if (!e) return null;
  return { text: e[lang] || e[e.src], original: e[e.src], translated: !!(e[lang] && lang !== e.src), src: e.src };
};

const THREADS = {
  coach: [
    { name: "Priya Ellis",   lastId: "m5",  when: "09:15",     unread: 2 },
    { name: "Marcus Tran",   lastId: "m3",  when: "11:42",     unread: 0 },
    { name: "Dan Okafor",    lastId: "m7",  when: "Yesterday", unread: 0 },
    { name: "Summer clinic", lastId: "m9",  when: "Wed",       unread: 0, group: true, n: 9 },
  ],
  player: [{ name: "Ray Doyle", lastId: "m11", when: "11:42", unread: 1 }],
};
const SEEDS = {
  "Marcus Tran":  [{ from: "player", id: "m1", at: "11:31" }, { from: "coach", id: "m2", at: "11:38" }, { from: "player", id: "m3", at: "11:42" }],
  "Priya Ellis":  [{ from: "player", id: "m4", at: "09:12" }, { from: "player", id: "m5", at: "09:15" }],
  "Dan Okafor":   [{ from: "coach", id: "m6", at: "17:20" }, { from: "player", id: "m7", at: "18:40" }],
  "Summer clinic":[{ from: "coach", id: "m8", at: "12:10" }, { from: "coach", id: "m9", at: "12:11" }],
  "Ray Doyle":    [{ from: "coach", id: "m10", at: "11:40" }, { from: "coach", id: "m11", at: "11:42" }],
};
const REPLIES = {
  coach:  ["Grand, that works.", "Thanks Ray.", "See you then."],
  player: ["No problem, I'll sort it.", "That works, see you then.", "Grand, I'll have it booked."],
};

const LEGAL = {
  terms: { title: "Terms of Service", updated: "Last updated 1 July 2026", body: [
    ["Agreement", `These terms govern your use of ${BRAND}. By creating an account you accept them. If you use ${BRAND} on behalf of a club or academy, you confirm you may bind that organisation.`],
    ["Accounts", "You must be 16 or older to hold an account, or have a parent or guardian create one on your behalf. A parent account may add linked profiles for their children. Keep your login details private."],
    ["Coach and player relationship", `Coaching is arranged directly between coaches and players. ${BRAND} provides the software; it does not employ coaches, supervise lessons, or guarantee outcomes.`],
    ["Content", "You keep ownership of the video and audio you upload. You grant us the licence needed to store it, process it, and show it to the people you share it with."],
    ["Subscription", "Your Nosca subscription is billed through the App Store, and refunds follow Apple's policy. Nosca does not process lesson fees — what you charge and how you collect it stays between you and your players."],
    ["Ending your account", "You can close your account at any time from Settings. We may suspend accounts that breach these terms or put other people at risk."],
    ["Governing law", "These terms are governed by the laws of Ireland, and the Irish courts have jurisdiction."],
  ]},
  privacy: { title: "Privacy Policy", updated: "Last updated 1 July 2026", body: [
    ["Who we are", `${BRAND} is an Irish company and the data controller for the information described here. Reach our data protection contact at privacy@nosca.app.`],
    ["What we collect", "Your name, email, mobile and date of birth; lessons, video, audio, drills, notes and messages; basic device and usage information; and payment records held by our processor."],
    ["Health and injury information", "Coaching notes often touch on injuries, physical limitations, recovery and fitness. Under GDPR this is special category data and carries a higher bar than ordinary personal data. We ask for your explicit consent before a coach can record it against your profile, we never use it for anything but delivering your coaching, and you can withdraw that consent or delete the notes at any time."],
    ["Coaches' obligations", "A coach recording health information about a player is a controller of that data in their own right. Our terms require coaches to collect only what coaching genuinely needs, keep it confidential, and delete it when a player leaves. We provide the tools; the coach remains responsible for what they write."],
    ["Children", `Accounts are for people aged ${CONSENT_AGE} and over, which is Ireland's digital age of consent. A younger player takes part through a profile managed by their parent or guardian, who can see that profile's lessons, notes and coach messages. Coaches are told when a profile is parent-managed.`],
    ["Video, audio and messages", "Lesson media and messages are visible only to the coach, the player, and — for a parent-managed profile — the managing parent. Everything is encrypted in transit and at rest."],
    ["Your rights", "Under GDPR you can request access to your data, correct it, export it, restrict how it's used, or have it erased. Use Data & permissions in Settings, or email us. We respond within one month."],
    ["Retention", "We keep your content while your account is open, and delete it within 30 days of closure unless we must keep records for tax or legal reasons. Health-related notes are deleted as soon as a coaching relationship ends."],
    ["Complaints", "If you are unhappy with how we handle your data you can complain to the Irish Data Protection Commission."],
  ]},
  record: { title: "Your sporting record", updated: "Portability and sharing", body: [
    ["What it is", "Everything logged about your coaching: lessons, video, drills, stats, goals and any notes. Taken together it is a record of how you have developed, and it belongs to you."],
    ["Changing or adding a coach", "You choose what a new coach can see, part by part, before they see anything. Nothing transfers automatically. If you would rather start fresh, that is a valid choice and we do not push against it."],
    ["What your previous coach keeps", "A coach retains their own record of lessons they personally gave. That is their work and their own legal record, and sharing your file with someone new does not erase it. They lose access to anything logged after you leave."],
    ["Injury and health notes", "Treated as special category data under GDPR Article 9. It is never included by default, is marked separately whenever you are choosing, and requires you to opt in explicitly each time."],
    ["Withdrawing access", "You can withdraw sharing at any time in Settings. Access ends immediately. Anything the new coach had already downloaded is outside our control, which is why the choice is presented carefully in the first place."],
    ["Where this comes from", "Article 20 of the GDPR gives you the right to receive your data and have it moved to another provider. This feature exists to make that right usable rather than theoretical."],
    ["Under-18s", "Where a profile is parent-managed, the parent makes these decisions. When the young person turns 18 and takes over the account, the choices become theirs."],
  ]},
  messaging: { title: "Messaging privacy", updated: "How the messaging centre works", body: [
    ["What messaging is for", "Direct messages carry short, practical things — a change of time, a closed court, running late. Lessons, drills and progress notes have their own place in the app and are not part of this."],
    ["Who can read a message", "Only the people in the conversation: the coach and the player, or every member of a group thread. Nobody at Nosca reads your messages as a matter of course, and we do not use their contents for advertising, profiling or training AI models."],
    ["Parent-managed profiles", "Where a player's profile is managed by a parent, that parent can read the coach's messages to that profile. Both the coach and the player are told this is the case. It is a deliberate safeguarding decision, not a technical accident, and it cannot be switched off while the profile is parent-managed."],
    ["Group threads", "Anyone added to a group can read everything sent to that group from the moment they join. They cannot see messages sent before they joined. Leaving a group ends their access immediately."],
    ["Storage and encryption", "Messages are encrypted in transit and at rest on servers in the European Union. They are stored so that you can scroll back through your own history — this is not end-to-end encrypted messaging, and you should not use it for anything you would not want restored from a backup."],
    ["Attachments", "Photos you attach follow the same rules as the message itself. They are not added to a player's lesson record unless you put them there deliberately."],
    ["Health and personal information", "Please keep injury details, medical information and anything similar in a coaching note rather than a message. Notes carry the explicit-consent protections that special category data requires under GDPR; a casual message does not."],
    ["Retention and deletion", "Deleting a message removes it for everyone in the conversation. Closing your account deletes your messages within 30 days. Reported messages are held for up to 90 days so we can investigate."],
    ["Reporting", "Any message can be reported. Reports are reviewed by a person, not automatically, and we may suspend an account that puts someone at risk — particularly where a minor is involved."],
  ]},
  data: { title: "Data & permissions", updated: "What the app asks for and why", body: [
    ["Camera", "Needed to record lesson video in the app. Only used while the camera screen is open."],
    ["Microphone", "Needed for voice notes. Recording only starts when you tap the record button."],
    ["Photos", "Needed to pick existing clips from your library. We only read the files you choose."],
    ["Notifications", "Used for lessons, drills, tips, messages, bookings and payments. Every category can be turned off."],
    ["Messaging", "See the separate messaging privacy note for who can read what."],
    ["Sound", "A handful of short confirmation tones. Off switches it everywhere."],
    ["Health notes", "Your coach must ask before recording injury or fitness details. You can withdraw that at any time, and the notes go with it."],
    ["Your data", "Request an export or deletion of everything tied to your account at any time."],
  ]},
  licences: { title: "Licences", updated: "Open-source software used in this app", body: [
    ["Third-party components", "This build includes open-source libraries released under permissive licences. Full attribution text ships with the app."],
  ]},
};

/* ==================================================================
   LOADING
================================================================== */
function useLoad(ms = 560) {
  const [done, setDone] = useState(false);
  useEffect(() => { const x = setTimeout(() => setDone(true), ms); return () => clearTimeout(x); }, [ms]);
  return done;
}
function Bone({ w = "100%", h = 14, r = 8, mb = 0 }) {
  const t = useT();
  return (
    <div style={{ width: w, height: h, borderRadius: r, marginBottom: mb, background: t.hair,
                  backgroundImage: `linear-gradient(90deg, ${t.hair} 0%, ${t.wash} 50%, ${t.hair} 100%)`,
                  backgroundSize: "220% 100%", animation: "shim 1.3s ease-in-out infinite" }} />
  );
}
const ShimmerCSS = () => (
  <style>{`@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@200,300,400,500,700,800,900&f[]=switzer@300,400,500,600,700&f[]=zodiak@300i,400i,500i&display=swap');
    @keyframes shim{0%{background-position:120% 0}100%{background-position:-120% 0}}
    @keyframes sp{to{transform:rotate(360deg)}}
    @keyframes bl{0%,60%,100%{opacity:.3}30%{opacity:1}}
    @keyframes pop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes ping{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.5);opacity:0}}
    @keyframes draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
    @keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes tighten{from{opacity:0;letter-spacing:0.62em}to{opacity:1;letter-spacing:0.34em}}
    @keyframes trackFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes glow{0%,100%{opacity:.25}50%{opacity:.55}}
    @keyframes splashOut{from{opacity:1}to{opacity:0}}
    @keyframes ripple{0%{transform:scale(.55);opacity:.5}70%{opacity:0}100%{transform:scale(2.1);opacity:0}}
    @keyframes orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes converge{0%{transform:translateX(var(--from))}100%{transform:translateX(0)}}
    @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
    @keyframes dashRun{0%{stroke-dashoffset:0;opacity:0}10%{opacity:.5}85%{opacity:.5}100%{stroke-dashoffset:-108;opacity:0}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes popIn{0%{transform:scale(1)}45%{transform:scale(1.22)}100%{transform:scale(1)}}
    @keyframes tickIn{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}
    @keyframes rowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes cheer{0%{transform:translateY(0) scale(.9);opacity:0}30%{opacity:1}100%{transform:translateY(-26px) scale(1.1);opacity:0}}
    @keyframes sheen{from{transform:translateX(-120%)}to{transform:translateX(220%)}}
    @keyframes liftIn{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes nudge{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
    @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}50%{box-shadow:0 0 0 6px rgba(0,0,0,0.04)}}
    @keyframes ringPop{0%{transform:scale(.3);opacity:0}55%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
    @keyframes tickDraw{to{stroke-dashoffset:0}}
    @keyframes haloOut{0%{transform:scale(.6);opacity:.55}100%{transform:scale(2.4);opacity:0}}
    @keyframes celebFade{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
    @keyframes spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
    @keyframes labelUp{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes orbitA{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes orbitB{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
    @keyframes hueCycle{0%{stroke:var(--c0)}20%{stroke:var(--c1)}40%{stroke:var(--c2)}60%{stroke:var(--c3)}80%{stroke:var(--c4)}100%{stroke:var(--c0)}}
    @keyframes chase{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-170}}
    @keyframes pulseDot{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
    /* Seamless loops only — every one ends exactly where it began, so
       nothing visibly restarts. */
    @keyframes spinSlow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes spinBack{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
    @keyframes hueRoll{0%{stroke:var(--h0)}17%{stroke:var(--h1)}34%{stroke:var(--h2)}51%{stroke:var(--h3)}68%{stroke:var(--h4)}85%{stroke:var(--h5)}100%{stroke:var(--h0)}}
    @keyframes turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes turnBack{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
    @keyframes linkBreathe{0%,100%{opacity:.2}50%{opacity:.85}}
    @keyframes markBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
    @keyframes ringFlash{0%{transform:scale(.85);opacity:.9}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}
    @keyframes ringHold{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.85}}
    @keyframes slideFrom{0%{opacity:0;transform:translateX(28px) scale(.98)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes dotGrow{0%{width:6px}100%{width:20px}}
    @keyframes ringDraw{from{stroke-dashoffset:290}}
    @keyframes nudgeX{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
    /* the overture: mark draws in, whole thing lifts away */
    @keyframes overtureMark{0%{transform:scale(.7) rotate(-8deg);opacity:0}55%{transform:scale(1.06) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
    @keyframes overtureOut{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}
    @keyframes ruleDraw{0%{transform:scaleX(0);opacity:0}100%{transform:scaleX(1);opacity:.7}}
    @keyframes wiggle{0%,100%{transform:rotate(-0.7deg)}50%{transform:rotate(0.7deg)}}
    /* Choreography: the header settles first, then content rises under
       it. Staggering by role rather than by index is what stops a
       screen looking like a list of things that all arrived together. */
    @keyframes headerSettle{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes contentRise{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes figureCount{0%{opacity:0;transform:translateY(12px) scale(.94)}60%{opacity:1;transform:translateY(-2px) scale(1.02)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes edgeGlow{0%,100%{opacity:0}50%{opacity:.5}}
    @keyframes shimmerOnce{0%{transform:translateX(-140%)}100%{transform:translateX(240%)}}
    /* --- motion added this pass --- */
    /* a tick that draws itself rather than appearing */
    @keyframes checkPop{0%{transform:scale(.4) rotate(-14deg);opacity:0}55%{transform:scale(1.14) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
    /* a count that lands rather than switches */
    @keyframes countIn{0%{transform:translateY(-7px) scale(.82);opacity:0}60%{transform:translateY(1px) scale(1.06)}100%{transform:translateY(0) scale(1);opacity:1}}
    /* the accent bar under a fold as it opens */
    @keyframes railOut{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
    /* a row settling into place under your thumb */
    @keyframes settle{0%{transform:translateY(9px);opacity:0}100%{transform:translateY(0);opacity:1}}
    /* the quiet pulse on something that needs a decision */
    @keyframes waitPulse{0%,100%{box-shadow:0 0 0 0 rgba(208,138,30,0)}50%{box-shadow:0 0 0 5px rgba(208,138,30,.16)}}
    /* a card lifting as it becomes the active one in the deck */
    @keyframes deckRise{0%{transform:translateY(10px) scale(.985);opacity:.6}100%{transform:translateY(0) scale(1);opacity:1}}
    @keyframes stampIn{0%{transform:scale(2.4) rotate(-14deg);opacity:0}55%{transform:scale(.92) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
    @keyframes shockwave{0%{transform:scale(.2);opacity:.7;border-width:14px}100%{transform:scale(2.6);opacity:0;border-width:1px}}
    @keyframes streakUp{0%{transform:translateY(24px);opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes barFill{from{width:0}to{width:var(--w)}}
    @keyframes tally{0%{transform:translateY(14px) scale(.7);opacity:0}60%{transform:translateY(-3px) scale(1.06);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
    /* Honour the system setting. Everything still works, it just stops
       moving — which is the point of the preference. */
    .calm *, .calm *::before, .calm *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    @media (prefers-reduced-motion:reduce){*{animation:none!important}}`}</style>
);
function HomeSkeleton() {
  return (
    <div className="px-6">
      <Bone h={92} r={22} mb={16} />
      <Card className="p-5 mb-4">
        <div className="flex gap-4">
          {[0,1,2].map((i) => (<div key={i} className="flex-1"><Bone w="70%" h={10} mb={10} /><Bone w="55%" h={26} r={10} /></div>))}
        </div>
        <div className="mt-5"><Bone h={70} r={14} /></div>
      </Card>
      <Bone w="34%" h={11} mb={14} />
      <Bone h={190} r={24} />
    </div>
  );
}

/* ==================================================================
   SPLASH
   The first thing anyone sees, so it carries the whole tone: deep
   near-black, the mark drawing itself rather than appearing, and the
   wordmark settling from wide to set. The accent is picked from one of
   the six sports each time it opens — so it's alive across sessions
   without ever being loud.
================================================================== */
function Splash({ onDone, replayKey, sport, roleLabel }) {
  /* the mark landing, the wordmark, then the lift away — each gets its
     own pulse, so the sequence is felt as well as seen */
  useEffect(() => {
    const a = setTimeout(() => haptic(12), 180);
    const b = setTimeout(() => haptic(8), 620);
    const c = setTimeout(() => hapticSuccess(), 1180);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [replayKey]);
  /* Before sign-up there is no sport, so the opening is the brand alone. */
  const branded = !sport;
  const cfg = SPORTS[sport] || null;
  const accent = branded ? "#B79A5C" : cfg.theme.accent;
  const bg = branded ? "#080A09" : cfg.theme.ink;
  const [leaving, setLeaving] = useState(false);

  const HOLD = branded ? 5400 : 4000;
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), HOLD);
    const b = setTimeout(() => onDone && onDone(), HOLD + 700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone, replayKey, HOLD]);

  const R = 8.6, CIRC = 2 * Math.PI * R, ARC = 27;
  const T = branded
    ? { r1: 350, r2: 800, join: 1750, link: 2150, word: 2800, rule: 3300, sub: 3700, foot: 4200 }
    : { r1: 250, r2: 600, join: 1350, link: 1700, word: 2200, rule: 2600, sub: 2950, foot: 3350 };

  return (
    <button onClick={() => { haptic(8); setLeaving(true); setTimeout(() => onDone && onDone(), 400); }}
            className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
            style={{ background: bg, zIndex: 60, cursor: "pointer",
                     animation: leaving ? "splashOut 680ms cubic-bezier(.4,0,.2,1) forwards" : "none" }}
            aria-label={tr("Skip")}>

      {/* slow colour pool */}
      <span className="absolute rounded-full" style={{ width: 380, height: 380, background: accent, filter: "blur(120px)",
                     opacity: branded ? 0.2 : 0.28, animation: "glow 6s ease-in-out infinite" }} />

      {/* ripples pushing out from where the rings meet */}
      {[0, 1, 2].map((i) => (
        <span key={i} className="absolute rounded-full" aria-hidden="true"
              style={{ width: 190, height: 190, border: `1px solid ${accent}`, opacity: 0,
                       animation: `ripple 3.6s cubic-bezier(.2,.6,.3,1) ${T.link + i * 900}ms infinite` }} />
      ))}

      {/* a slow orbiting dashed ring behind everything */}
      <svg className="absolute" width={230} height={230} viewBox="0 0 100 100" aria-hidden="true"
           style={{ opacity: 0.16, animation: `orbit 26s linear ${T.r1}ms infinite` }}>
        <circle cx="50" cy="50" r="42" fill="none" stroke={accent} strokeWidth="0.4"
                strokeDasharray="3 7" strokeLinecap="round" />
      </svg>

      <div style={{ position: "relative", animation: `breathe 5s ease-in-out ${T.link}ms infinite` }}>
        <svg width={148} height={92} viewBox="0 0 40 25" style={{ overflow: "visible" }} aria-label={BRAND}>
          {/* the rings draw, then slide together into their linked position */}
          <g style={{ "--from": "-7px", animation: `converge 900ms cubic-bezier(.32,.72,0,1) ${T.join}ms both` }}>
            <circle cx="14" cy="12.5" r={R} fill="none" stroke="#F4F6F3" strokeWidth={1.6} strokeLinecap="round"
                    style={{ "--len": CIRC, strokeDasharray: CIRC, strokeDashoffset: CIRC,
                             animation: `draw 1250ms cubic-bezier(.35,0,.15,1) ${T.r1}ms forwards` }} />
          </g>
          <g style={{ "--from": "7px", animation: `converge 900ms cubic-bezier(.32,.72,0,1) ${T.join}ms both` }}>
            <circle cx="26" cy="12.5" r={R} fill="none" stroke="#F4F6F3" strokeWidth={1.6} strokeLinecap="round"
                    style={{ "--len": CIRC, strokeDasharray: CIRC, strokeDashoffset: CIRC,
                             animation: `draw 1250ms cubic-bezier(.35,0,.15,1) ${T.r2}ms forwards` }} />
          </g>
          {/* the link, drawn last, then a travelling dash that keeps running */}
          <path d="M19.6 5.7 A 8.6 8.6 0 0 1 19.6 19.3" fill="none" stroke={accent} strokeWidth={1.6} strokeLinecap="round"
                style={{ "--len": ARC, strokeDasharray: ARC, strokeDashoffset: ARC,
                         animation: `draw 850ms cubic-bezier(.35,0,.15,1) ${T.link}ms forwards` }} />
          {/* Starts fully transparent. Without this it parks a white
              segment at the top of the arc for the whole delay — which
              reads as a stray floating line between the rings. */}
          <path d="M19.6 5.7 A 8.6 8.6 0 0 1 19.6 19.3" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round"
                style={{ strokeDasharray: "4 104", strokeDashoffset: 0, opacity: 0,
                         animation: `dashRun 2.6s linear ${T.link + 900}ms infinite` }} />
        </svg>
      </div>

      <div style={{ position: "relative", fontFamily: display, fontSize: 20, color: "#F4F6F3", marginTop: 34,
                    opacity: 0, animation: `tighten 1200ms cubic-bezier(.32,.72,0,1) ${T.word}ms forwards` }}>{BRAND}</div>

      <div style={{ position: "relative", width: 54, height: 1, background: accent, marginTop: 26,
                    transformOrigin: "center", transform: "scaleX(0)",
                    animation: `trackFill 950ms cubic-bezier(.35,0,.15,1) ${T.rule}ms forwards` }} />

      <div style={{ position: "relative", marginTop: 24, fontFamily: ui, fontSize: 10.5, letterSpacing: "0.3em",
                    textTransform: "uppercase", color: accent, opacity: 0,
                    animation: `fadeUp 900ms cubic-bezier(.32,.72,0,1) ${T.sub}ms forwards` }}>
        {branded ? "Coaching that carries" : `${cfg.label} · ${roleLabel}`}
      </div>

      <div className="absolute" style={{ bottom: 46, fontFamily: ui, fontSize: 10, letterSpacing: "0.26em",
                    textTransform: "uppercase", color: "rgba(244,246,243,0.3)", opacity: 0,
                    animation: `fadeUp 900ms ease ${T.foot}ms forwards` }}>{tr("Made in Ireland")}</div>
    </button>
  );
}

/* ==================================================================
   LOADER
   Deliberately not the splash. The splash is a statement; this is a
   machine at work — two rings orbiting in opposite directions with a
   chasing arc that cycles through all six sport colours, because the
   loader belongs to the whole app rather than to one sport.
================================================================== */
function Loader({ label, onTap }) {
  useEffect(() => { haptic(7); }, []);
  const t = useT();
  const cols = Object.values(SPORTS).map((sp) => sp.theme.accent);
  const hues = cols.reduce((a, c, i) => ({ ...a, [`--h${i}`]: c }), {});

  /* Deliberately the splash's mark, held still. The rings don't move —
     a light travels around each one, inward past the link and out
     again. Only rotation is animated, and a full turn ends exactly
     where it began, so there is no seam to notice however long
     someone waits. */
  const R = 8.6, CIRC = 2 * Math.PI * R;   // 54.03
  const ARC = CIRC * 0.26;                  // the travelling light

  return (
    <button onClick={onTap} aria-label={tr("Loading")}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: t.page, zIndex: 65, cursor: onTap ? "pointer" : "default" }}>

      <svg width={168} height={105} viewBox="0 0 40 25" style={{ ...hues, overflow: "visible",
             animation: "markBreathe 5.5s ease-in-out infinite" }}>
        {/* the mark itself, steady */}
        <circle cx="14" cy="12.5" r={R} fill="none" stroke={t.hair} strokeWidth={1.6} />
        <circle cx="26" cy="12.5" r={R} fill="none" stroke={t.hair} strokeWidth={1.6} />

        {/* the link, breathing between them */}
        <path d="M19.6 5.7 A 8.6 8.6 0 0 1 19.6 19.3" fill="none" strokeWidth={1.6} strokeLinecap="round"
              style={{ animation: "linkBreathe 2.8s ease-in-out infinite, hueRoll 12s linear infinite" }} />

        {/* a light running each ring, turning inward towards the link */}
        <circle cx="14" cy="12.5" r={R} fill="none" strokeWidth={1.6} strokeLinecap="round"
                style={{ strokeDasharray: `${ARC} ${CIRC - ARC}`, transformOrigin: "14px 12.5px",
                         animation: "turn 2.8s linear infinite, hueRoll 12s linear infinite" }} />
        <circle cx="26" cy="12.5" r={R} fill="none" strokeWidth={1.6} strokeLinecap="round"
                style={{ strokeDasharray: `${ARC} ${CIRC - ARC}`, transformOrigin: "26px 12.5px",
                         animation: "turnBack 2.8s linear infinite, hueRoll 12s linear infinite" }} />
      </svg>

      <div className="mt-9" style={{ fontFamily: display, fontSize: 13, letterSpacing: "0.34em",
                    textTransform: "uppercase", color: t.faint }}>{label || BRAND}</div>

      {onTap && (
        <div className="absolute" style={{ bottom: 44, fontFamily: ui, fontSize: 10.5, letterSpacing: "0.18em",
                      textTransform: "uppercase", color: t.hair }}>{tr("Tap to continue")}</div>
      )}
    </button>
  );
}

/* Photos in a lesson come in two kinds and they behave differently: a
   readout is data to be kept beside the numbers, an action shot is
   coaching material. Keeping them apart matters more than it looks. */
function PhotoCapture({ sport, photos, setPhotos, say }) {
  const t = useT();
  const cap = CAPTURE[sport];
  const [reading, setReading] = useState(null);

  const add = (kind) => {
    haptic(10); soft();
    const shot = { kind, at: Date.now(), values: null };
    setPhotos([...photos, shot]);
    if (kind === "data") {
      /* Stands in for reading the screen. Until that is real, the
         numbers are offered for the coach to confirm, never assumed. */
      setReading(shot.at);
      setTimeout(() => {
        setPhotos((ps) => ps.map((x) => (x.at === shot.at ? { ...x, values: cap.sample } : x)));
        setReading(null); hapticSuccess(); soft();
      }, 1400);
    }
  };

  return (
    <>
      <div className="flex gap-3 mb-3">
        <button onClick={() => add("data")} className="flex-1 flex flex-col items-center justify-center gap-2 active:opacity-60"
                style={{ minHeight: 84, borderRadius: R.surface, border: `1px solid ${t.hair}`, background: t.surface }}>
          <Receipt size={19} color={t.accent} strokeWidth={1.6} />
          <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink }}>{cap.device}</span>
          
        </button>
        <button onClick={() => add("action")} className="flex-1 flex flex-col items-center justify-center gap-2 active:opacity-60"
                style={{ minHeight: 84, borderRadius: R.surface, border: `1px solid ${t.hair}`, background: t.surface }}>
          <ImageIcon size={19} color={t.sub} strokeWidth={1.6} />
          <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink }}>{tr("Action shot")}</span>
          
        </button>
      </div>

      {photos.map((ph, i) => (
        <div key={ph.at} className="mb-2.5" style={{ animation: "liftIn 400ms cubic-bezier(.22,1,.36,1) both" }}>
          <Tile className="px-4 py-3.5" accent={ph.kind === "data" ? t.accent : null}>
            <div className="flex items-center gap-3">
              <span className="rounded-xl flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, background: "#191D1B" }}>
                {ph.kind === "data" ? <Receipt size={17} color="rgba(255,255,255,0.8)" /> : <ImageIcon size={17} color="rgba(255,255,255,0.8)" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>
                  {ph.kind === "data" ? cap.device : tr("Action shot")}
                </span>
                <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                  {reading === ph.at ? tr("Reading the numbers…") : ph.values ? tr("Confirm these") : tr("Attached")}
                </span>
              </span>
              <button onClick={() => { haptic(6); setPhotos(photos.filter((x) => x.at !== ph.at)); }} aria-label={tr("Remove")}>
                <X size={14} color={t.faint} />
              </button>
            </div>

            {reading === ph.at && (
              <div className="mt-3 flex gap-2">
                {cap.fields.slice(0, 3).map((f, k) => (
                  <div key={f} className="flex-1"><Bone h={30} /></div>
                ))}
              </div>
            )}

            {ph.values && (
              <div className="mt-3.5" style={{ animation: "liftIn 380ms cubic-bezier(.22,1,.36,1) both" }}>
                <div className="flex flex-wrap gap-2">
                  {cap.fields.map((f, k) => (
                    <span key={f} className="px-3 py-2" style={{ borderRadius: R.field, background: t.wash }}>
                      <span className="block" style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: t.faint }}>{f}</span>
                      <span className="block mt-0.5" style={{ fontFamily: display, fontSize: 14, color: t.ink }}>{ph.values[k]}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-3" style={{ fontFamily: ui, fontSize: 11, lineHeight: 1.55, color: t.faint }}>
                  {tr("Read from the photo. Tap any number to correct it before publishing.")}
                </p>
              </div>
            )}
          </Tile>
        </div>
      ))}
    </>
  );
}

/* Two clips side by side, scrubbed together. The point is to make
   improvement visible — a coach saying "you're better" is worth less
   than a player seeing it. */
function VideoCompare({ cfg, lessons, onClose }) {
  const t = useT();
  const [a, setA] = useState(lessons[lessons.length - 1] || lessons[0]);
  const [b, setB] = useState(lessons[0]);
  const [pos, setPos] = useState(38);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => setPos((p) => (p >= 100 ? 0 : p + 1.4)), 40);
    return () => clearInterval(i);
  }, [playing]);

  const Pane = ({ lesson, side, onPick }) => (
    <div className="flex-1 min-w-0">
      <button onClick={onPick} className="w-full flex items-center gap-1.5 mb-2 active:opacity-60">
        <span className="flex-1 text-left truncate" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.sub }}>
          {lesson.d} {lesson.m}
        </span>
        <ChevronDown size={12} color={t.faint} />
      </button>
      <div className="relative overflow-hidden" style={{ borderRadius: R.control, aspectRatio: "3/4", background: "#191D1B" }}>
        <span className="absolute" style={{ left: 0, right: 0, top: `${pos}%`, height: 1, background: t.accent, opacity: 0.5 }} />
        <span className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontFamily: ui, fontSize: 10.5, color: "rgba(255,255,255,0.3)" }}>{side}</span>
        </span>
      </div>
    </div>
  );

  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Side by side")}</h2>
      

      <div className="flex gap-3 mb-4">
        <Pane lesson={a} side={tr("Then")} onPick={() => { haptic(6); setA(lessons[(lessons.indexOf(a) + 1) % lessons.length]); }} />
        <Pane lesson={b} side={tr("Now")} onPick={() => { haptic(6); setB(lessons[(lessons.indexOf(b) + 1) % lessons.length]); }} />
      </div>

      <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))}
             className="w-full mb-4" style={{ accentColor: t.accent }} aria-label={tr("Scrub")} />

      <div className="flex gap-2.5">
        <button onClick={() => { haptic(8); setPlaying(!playing); }} className="flex-1 flex items-center justify-center gap-2 active:opacity-70"
                style={{ minHeight: 48, borderRadius: R.control, background: t.accent, fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.onAccent }}>
          {playing ? <Pause size={16} color={t.onAccent} /> : <Play size={16} color={t.onAccent} />}
          {playing ? tr("Pause") : tr("Play both")}
        </button>
        <button onClick={() => { haptic(7); onClose && onClose(); }} className="px-5 active:opacity-60"
                style={{ minHeight: 48, borderRadius: R.control, border: `1px solid ${t.hair}`, fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.sub }}>
          {tr("Close")}
        </button>
      </div>
    </>
  );
}

/* A coach making a group. They run it — adding, removing and setting
   the group's own drills and goals — which is why the group is created
   from their side and never a player's. */
function CreateGroup({ roster, nouns, onCreate, close, say }) {
  const t = useT();
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [day, setDay] = useState(5);
  const [time, setTime] = useState("2:00 pm");
  const [weeks, setWeeks] = useState(6);
  const toggle = (n) => { haptic(6); soft(); setMembers(members.includes(n) ? members.filter((x) => x !== n) : [...members, n]); };

  return (
    <>
      <h2 className="mb-5" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{tr("New group")}</h2>
      <div className="mb-5"><VoiceInput value={name} onChange={setName} ph={tr("Group name")} autoFocus /></div>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>
        {members.length ? `${members.length} ${nouns}` : tr("Members")}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {roster.map((r, i) => {
          const on = members.includes(r.name);
          return (
            <button key={r.name} onClick={() => { haptic(9); soft(); toggle(r.name); }} className="pl-1.5 pr-3.5 flex items-center gap-2 active:opacity-60"
                    style={{ minHeight: 42, borderRadius: R.pill, background: on ? t.ink : t.surface,
                             border: `1px solid ${on ? t.ink : t.hair}`, transition: "background 220ms cubic-bezier(.22,1,.36,1)",
                             animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>
              <Avatar name={r.name} size={30} />
              <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{r.name.split(" ")[0]}</span>
              {on && <Check size={12} color={STEADY} strokeWidth={2.1} />}
            </button>
          );
        })}
      </div>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("When")}</div>
      <div className="flex gap-1.5 mb-3">
        {DAY_NAMES.map((d, i) => {
          const on = day === i;
          return (<button key={i} onClick={() => { haptic(5); setDay(i); }} className="flex-1 active:opacity-60"
                          style={{ minHeight: 42, borderRadius: R.control, background: on ? STEADY : t.wash,
                                   fontFamily: ui, fontSize: 12, fontWeight: 600, color: on ? t.onAccent : t.sub,
                                   transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>{d.slice(0, 2)}</button>);
        })}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {ALL_TIMES.slice(0, 6).map((tm) => {
          const on = time === tm;
          return (<button key={tm} onClick={() => { haptic(5); setTime(tm); }} className="px-3.5 active:opacity-60"
                          style={{ minHeight: 38, borderRadius: R.pill, background: on ? t.accent : t.wash,
                                   fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{tm}</button>);
        })}
      </div>

      <div className="flex items-center justify-between mb-6">
        <span style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{tr("How many weeks")}</span>
        <span className="flex items-center gap-3">
          <button onClick={() => { haptic(5); setWeeks(Math.max(1, weeks - 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("Fewer")}><Minus size={15} color={t.ink} /></button>
          <span style={{ fontFamily: display, fontSize: 22, color: t.ink, minWidth: 26, textAlign: "center" }}>{weeks}</span>
          <button onClick={() => { haptic(5); setWeeks(Math.min(20, weeks + 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("More")}><Plus size={15} color={t.ink} /></button>
        </span>
      </div>

      <Button disabled={!name.trim() || members.length < 2}
              onClick={() => { onCreate({ name: name.trim(), members, day, time, weeks }); close(); }}>
        {tr("Create group")}
      </Button>
      <p className="mt-3 text-center" style={{ ...TYPE.caption, color: t.faint }}>{tr("You'll manage it")}</p>
    </>
  );
}

/* Some drills are "two minutes continuous", not "twenty reps". Those
   need a timer in the hand, not a stopwatch app in the other one. */
const DRILL_SECONDS = (text) => {
  const m = /(\d+)\s*(second|sec|minute|min)/i.exec(text || "");
  if (!m) return null;
  const n = Number(m[1]);
  return /min/i.test(m[2]) ? n * 60 : n;
};

function DrillTimer({ seconds, onDone }) {
  const t = useT();
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) { setRunning(false); hapticSuccess(); swell(); onDone && onDone(); return; }
    const x = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(x);
  }, [running, left, onDone]);

  const pct = seconds ? ((seconds - left) / seconds) * 100 : 0;
  const mm = Math.floor(left / 60), ss = left % 60;

  return (
    <div className="mt-3 px-4 py-3.5" style={{ borderRadius: R.control, background: t.wash }}>
      <div className="flex items-center gap-3.5">
        <button onClick={() => { haptic(10); soft(); if (left <= 0) setLeft(seconds); setRunning(!running); }}
                className="rounded-full flex items-center justify-center shrink-0 active:opacity-70"
                style={{ width: 42, height: 42, background: running ? t.ink : t.accent,
                         transition: "background 220ms" }}
                aria-label={running ? tr("Pause") : tr("Start")}>
          {running ? <Pause size={17} color="#fff" /> : <Play size={17} color={t.onAccent} />}
        </button>
        <span className="flex-1">
          <span className="block" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.02em", color: t.ink,
                         fontVariantNumeric: "tabular-nums" }}>
            {mm}:{String(ss).padStart(2, "0")}
          </span>
          <span className="block rounded-full overflow-hidden mt-2" style={{ height: 4, background: t.hair }}>
            <span className="block h-full" style={{ width: `${pct}%`, background: t.accent,
                           transition: "width 950ms linear" }} />
          </span>
        </span>
        {left <= 0 && <Check size={19} color={STEADY} strokeWidth={2.1} style={{ animation: "tickIn 380ms cubic-bezier(.34,1.56,.64,1)" }} />}
      </div>
    </div>
  );
}

/* A season, read as a season rather than a dashboard.

   The stat-card row and bar chart is the single most recognisable
   generated-app layout, so this is built the other way round: one
   sentence stating what happened, the figures set inline in the type
   at a size that makes them the subject, and the months as a plain
   ruled column you read down rather than a chart you decode. */
function SeasonPanel({ role, monthly, priv, grp, hours, streak, arc }) {
  const t = useT();
  const total = priv + grp;
  const best = monthly.reduce((a, b) => (b[1] > a[1] ? b : a), monthly[0]);
  const quiet = monthly.filter((m) => m[1] === 0);
  const peak = Math.max(...monthly.map((m) => m[1]), 1);

  return (
    <>
      {/* the sentence first — figures set into it, not beside it */}
      <p className="mb-9" style={{ ...TYPE.title, fontSize: 23, lineHeight: 1.45, color: t.ink }}>
        {tr("You've done")}{" "}
        <span style={{ ...TYPE.figure, fontSize: 34, color: t.accent }}>{total}</span>{" "}
        {total === 1 ? tr("lesson") : tr("lessons")} {tr("this season")} —{" "}
        <span style={{ ...TYPE.figure, fontSize: 34, color: t.ink }}>{hours}</span>{" "}
        {tr("hours on the ground")}.{" "}
        {streak > 2 && (<>{tr("You've kept it up")} <span style={{ ...TYPE.figure, fontSize: 34, color: t.ink }}>{streak}</span> {tr("weeks running")}.</>)}
      </p>

      {/* private against group, as one ruled line rather than a card */}
      <div className="mb-9">
        <div className="flex items-baseline justify-between mb-3">
          <span style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Private")}</span>
          <span style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Group")}</span>
        </div>
        <div className="flex items-center gap-1" style={{ height: 3 }}>
          <div style={{ width: `${(priv / Math.max(total, 1)) * 100}%`, height: 3, background: t.accent,
                        transformOrigin: "left", animation: "barGrow 700ms cubic-bezier(.22,1,.36,1) both" }} />
          <div style={{ width: `${(grp / Math.max(total, 1)) * 100}%`, height: 3, background: t.hair,
                        transformOrigin: "left", animation: "barGrow 700ms cubic-bezier(.22,1,.36,1) 120ms both" }} />
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          <span style={{ ...TYPE.figure, fontSize: 17, color: t.ink }}>{priv}</span>
          <span style={{ ...TYPE.figure, fontSize: 17, color: t.faint }}>{grp}</span>
        </div>
      </div>

      {/* months as a ruled column: read down it like a ledger */}
      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
        {monthly.map(([m, n], i) => (
          <div key={m} className="flex items-center gap-4"
               style={{ minHeight: 46, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                        animation: `settle 360ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>
            <span className="shrink-0" style={{ width: 42, ...TYPE.eyebrow, color: n ? t.sub : t.faint }}>{m}</span>
            <span className="flex-1 flex items-center">
              <span style={{ height: 1.5, width: `${(n / peak) * 100}%`, minWidth: n ? 8 : 0,
                             background: n ? t.accent : "transparent", transformOrigin: "left",
                             animation: `barGrow 620ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }} />
            </span>
            <span className="shrink-0 text-right" style={{ width: 26, marginRight: -1, ...TYPE.figure, fontSize: 15,
                           color: n ? t.ink : t.faint }}>{n || "—"}</span>
          </div>
        ))}
      </div>

      {/* THE ARC — what the season was actually about, then one focus.
          A report shows what happened; this tells you what to do. */}
      {arc && (
        <div className="mt-8 pt-6" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
          <div className="mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("The season, in short")}</div>
          <p style={{ ...TYPE.body, fontSize: 15.5, lineHeight: 1.65, color: t.ink }}>
            {tr("You kept coming back to")} <span style={{ fontWeight: 600 }}>{arc.theme.toLowerCase()}</span>
            {" — "}{arc.share}% {tr("of everything you did")}.{" "}
            {arc.moved && <>{tr("The clearest shift was in")} <span style={{ fontWeight: 600 }}>{arc.moved.toLowerCase()}</span>. </>}
          </p>

          {/* one thing, set apart, in the sport's colour */}
          <div className="mt-5 px-4 py-4" style={{ borderRadius: R.control, background: `${t.accent}0F`,
                 borderLeft: `2.5px solid ${t.accent}` }}>
            <span className="block" style={{ ...TYPE.eyebrow, fontSize: 9, color: t.accent }}>{tr("Next, work on")}</span>
            <span className="block mt-1.5" style={{ ...TYPE.subhead, fontSize: 17, color: t.ink }}>{arc.next}</span>
            <span className="block mt-1" style={{ ...TYPE.caption, color: t.faint }}>{arc.why}</span>
          </div>
        </div>
      )}

      {/* the honest footnote — a quiet month is information */}
      <p className="mt-6" style={{ ...TYPE.small, lineHeight: 1.65, color: t.faint }}>
        {best[1] > 0 && <>{tr("Busiest was")} {best[0]}, {best[1]} {best[1] === 1 ? tr("lesson") : tr("lessons")}. </>}
        {quiet.length > 0 && <>{quiet.length === 1 ? `${quiet[0][0]} ${tr("was quiet")}.` : `${quiet.length} ${tr("quiet months")}.`}</>}
      </p>
    </>
  );
}


/* The whole diary as one scroll. A coach thinks in days, not in a
   grid — so every day gets its own block with the lessons and the gaps
   between them, running as far forward as they want to look. */
function AgendaList({ role, avail, blocked, seedBooked, duration, monthIdx, slotKinds,
                     onOpen, onEditDay, onBookInto, onRecurring, push, juvenile }) {
  const t = useT();
  /* Names are stripped for anyone who is not the coach. A player has no
     business knowing who else is on the sheet, and filtering at render
     is not good enough — the data must not reach them. */
  const isCoach = role === "coach";
  const days = [];
  MONTHS.forEach((mo) => {
    if (mo.idx < monthIdx) return;
    for (let d = 1; d <= mo.days; d++) {
      if (mo.idx === TODAY.m && d < TODAY.d) continue;
      const hours = avail[dowOf(mo.idx, d)] || [];
      if (!hours.length) continue;
      days.push({ m: mo.idx, d, mo, hours,
                  booked: isCoach ? (seedBooked[key(mo.idx, d)] || [])
                                  : (seedBooked[key(mo.idx, d)] || []).map((b) => ({ time: b.time })),
                  blockedHere: blocked.filter((b) => b.m === mo.idx && b.d === d).map((b) => b.time) });
      if (days.length >= 20) break;
    }
  });

  const [focus, setFocus] = useState(null);   // day jumped to from the ticker
  const shown = focus ? days.filter((x) => x.m === focus.m && x.d === focus.d) : days;

  return (
    <div className="pb-2">
      {/* THE DAY TICKER
          A week at a glance: how many slots each day holds and how many
          are taken, so the shape of the week is legible before you
          scroll into it. Tap a day to isolate it, tap again to release. */}
      <div className="flex gap-1.5 overflow-x-auto px-6 pb-4" style={{ scrollbarWidth: "none" }}>
        {days.slice(0, 10).map((day) => {
          const taken = day.booked.length;
          const total = day.hours.length;
          const on = focus && focus.m === day.m && focus.d === day.d;
          const isToday = day.m === TODAY.m && day.d === TODAY.d;
          const full = total > 0 && taken >= total;
          return (
            <button key={key(day.m, day.d)}
                    onClick={() => { haptic(7); soft(); setFocus(on ? null : { m: day.m, d: day.d }); }}
                    className="shrink-0 flex flex-col items-center justify-center active:opacity-70"
                    style={{ width: 52, minHeight: 66, borderRadius: R.control,
                             background: on ? t.accent : isToday ? t.wash : "transparent",
                             border: `0.5px solid ${on ? t.accent : isToday ? "transparent" : HAIR(t.ink, 0.14)}`,
                             transition: "background 200ms, border-color 200ms" }}>
              <span style={{ ...TYPE.eyebrow, fontSize: 8.5,
                             color: on ? t.onAccent : t.faint }}>{DAY_NAMES[dowOf(day.m, day.d)].slice(0, 2)}</span>
              <span className="mt-0.5" style={{ ...TYPE.figure, fontSize: 17,
                             color: on ? t.onAccent : isToday ? t.accent : t.ink }}>{day.d}</span>
              {/* load: one dot per slot, filled where booked */}
              <span className="flex gap-0.5 mt-1.5">
                {day.hours.slice(0, 5).map((h, k) => {
                  const isBooked = !!day.booked.find((b) => b.time === h);
                  return (
                    <span key={k} className="rounded-full"
                          style={{ width: 3.5, height: 3.5,
                                   background: on ? (isBooked ? t.onAccent : `${t.onAccent}55`)
                                     : isBooked ? (full ? DANGER : t.accent) : HAIR(t.ink, 0.28) }} />
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      {focus && (
        <button onClick={() => { haptic(6); setFocus(null); }}
                className="mx-6 mb-3 flex items-center gap-1.5 active:opacity-50"
                style={{ ...TYPE.small, color: t.accent }}>
          <ChevronLeft size={14} color={t.accent} strokeWidth={2.2} /> {tr("All days")}
        </button>
      )}

      <div className="px-6">
      {shown.map((day, di) => {
        const isToday = day.m === TODAY.m && day.d === TODAY.d;
        const free = day.hours.filter((h) => !day.booked.find((b) => b.time === h) && !day.blockedHere.includes(h));
        /* A player is here to find a time, so only open slots are
           shown. A coach is here to see their day, so everything is. */
        const rows = isCoach ? day.hours : free;
        if (!rows.length) return null;

        return (
          <div key={`${day.m}-${day.d}`} className="mb-6"
               style={{ animation: `liftIn 400ms cubic-bezier(.22,1,.36,1) ${Math.min(di, 7) * 50}ms both` }}>

            {/* one quiet line, not a header competing with the rows */}
            <div className="flex items-center gap-2.5 mb-2.5 px-1">
              <span style={{ ...TYPE.heading, fontSize: 16, color: isToday ? t.accent : t.ink }}>
                {DAY_NAMES[dowOf(day.m, day.d)]} {day.d}
              </span>
              <span style={{ ...TYPE.caption, color: t.faint }}>
                {role === "coach" ? `${day.booked.length}/${day.hours.length}` : `${free.length} ${tr("open")}`}
              </span>
              <span className="flex-1" />
              {role === "coach" && (
                <button onClick={() => { haptic(9); soft(); onEditDay(day); }} className="p-1.5 active:opacity-50"
                        aria-label={tr("Edit this day")}>
                  <Edit3 size={14} color={t.faint} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* one card, rows inside — the chaos was every slot being
                its own floating box */}
            <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
              {rows.map((h, ri) => {
                const bk = day.booked.find((b) => b.time === h);
                const isBlocked = day.blockedHere.includes(h);
                const isGroup = bk && bk.kind && bk.kind.startsWith("Group");
                const kind = slotKinds[`${day.m}-${day.d}-${h}`] || "either";
                const last = ri === rows.length - 1;
                const line = { borderBottom: last ? "none" : `1px solid ${t.hair}` };

                if (bk && isCoach) return (
                  <button key={h} onClick={() => { haptic(7); soft(); onOpen(day, bk); }}
                          className="w-full flex items-center gap-3 px-4 text-left active:opacity-50"
                          style={{ minHeight: 56, ...line }}>
                    <span className="shrink-0" style={{ width: 62, ...TYPE.small, color: t.ink, fontVariantNumeric: "tabular-nums" }}>{h.replace(/ (am|pm)/, "")}</span>
                    <span className="rounded-full shrink-0" style={{ width: 3, height: 26, background: isGroup ? GROUP : t.accent }} />
                    <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{bk.who}</span>
                    <ChevronRight size={14} color={t.faint} />
                  </button>
                );

                if (isBlocked) return (
                  <div key={h} className="flex items-center gap-3 px-4" style={{ minHeight: 48, ...line }}>
                    <span className="shrink-0" style={{ width: 62, ...TYPE.small, color: t.faint, fontVariantNumeric: "tabular-nums" }}>{h.replace(/ (am|pm)/, "")}</span>
                    <span className="flex-1" style={{ ...TYPE.small, color: t.faint }}>{tr("Blocked")}</span>
                  </div>
                );

                if (role !== "coach" && kind === "group") return null;
                if (role === "player" && juvenile) return (
                  <div key={h} className="flex items-center gap-3 px-4" style={{ minHeight: 48, ...line }}>
                    <span className="shrink-0" style={{ width: 62, ...TYPE.small, color: t.faint, fontVariantNumeric: "tabular-nums" }}>{h.replace(/ (am|pm)/, "")}</span>
                    <span className="flex-1" style={{ ...TYPE.small, color: t.faint }}>
                      {kind === "group" ? tr("Group") : kind === "private" ? tr("Private") : tr("Open")}
                    </span>
                  </div>
                );

                return (
                  <div key={h} className="flex items-center gap-3 px-4" style={{ minHeight: 52, ...line }}>
                    <span className="shrink-0" style={{ width: 62, ...TYPE.small, color: t.faint, fontVariantNumeric: "tabular-nums" }}>{h.replace(/ (am|pm)/, "")}</span>
                    <span className="flex-1 min-w-0" style={{ ...TYPE.small, color: t.faint }}>
                      {kind === "group" ? tr("Group") : kind === "private" ? tr("Private") : tr("Open")}
                    </span>
                    <button onClick={() => { hapticCommit(); soft(); onBookInto(day, h, kind); }}
                            onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                            onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                            className="shrink-0 px-3 active:opacity-70"
                            style={{ minHeight: 30, borderRadius: R.surface, background: `${t.accent}0F`, willChange: "transform",
                                     transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                                     ...TYPE.caption, fontWeight: 500, color: t.accent }}>
                      {role === "coach" ? tr("Book") : tr("Request")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="py-6 text-center" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>
        {role === "coach" ? tr("That's as far as your hours are set.") : tr("That's everything open.")}
      </p>
      </div>
    </div>
  );
}

/* Either side can cancel. The convention across booking platforms is
   that a reason is required, the other party is told immediately, and
   a replacement time is offered in the same breath — cancelling and
   rebooking as one action rather than two. */
const CANCEL_REASONS = {
  coach: ["Unwell", "Course closed", "Double booked", "Family reasons", "Something else"],
  player: ["Unwell", "Work or school", "Away", "Injured", "Something else"],
};

function CancelLesson({ role, lesson, slots, duration, onDone, close }) {
  const t = useT();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState(null);
  const [stage, setStage] = useState("why");
  const other = role === "coach" ? tr("your player") : tr("your coach");

  if (stage === "when") return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Offer another time")}</h2>
      
      <div className="flex flex-wrap gap-2 mb-6">
        {slots.map((sl, i) => {
          const on = offer === sl;
          return (
            <button key={sl} onClick={() => { haptic(7); soft(); setOffer(on ? null : sl); }} className="px-3.5 active:opacity-60"
                    style={{ minHeight: 44, borderRadius: R.pill, background: on ? t.accent : t.surface,
                             border: `1px solid ${on ? t.accent : t.hair}`, fontFamily: ui, fontSize: 13,
                             fontWeight: 600, color: on ? t.onAccent : t.sub,
                             transition: "background 220ms cubic-bezier(.22,1,.36,1)",
                             animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>
              {span(sl, duration)}
            </button>
          );
        })}
      </div>
      <Button tone="danger" onClick={() => { hapticWarn(); decline(); onDone({ reason, note, offer }); close(); }}>
        {offer ? tr("Cancel and offer this time") : tr("Cancel the lesson")}
      </Button>
      <button onClick={() => { haptic(6); setStage("why"); }} className="w-full mt-3 py-3 active:opacity-50"
              style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("Back")}</button>
    </>
  );

  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Cancel lesson")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{lesson}</p>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Why")}</div>
      <div className="flex flex-col gap-2 mb-5">
        {CANCEL_REASONS[role === "coach" ? "coach" : "player"].map((r, i) => {
          const on = reason === r;
          return (
            <button key={r} onClick={() => { haptic(7); soft(); setReason(r); }}
                    className="w-full flex items-center gap-3 px-4 text-left"
                    style={{ minHeight: 52, borderRadius: R.control, background: on ? `${t.accent}0F` : t.surface,
                             border: `1px solid ${on ? `${t.accent}22` : t.hair}`, transition: "background 220ms cubic-bezier(.22,1,.36,1)",
                             animation: `fadeUp 320ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>
              <span className="flex-1" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr(r)}</span>
              {on && <Check size={16} color={STEADY} strokeWidth={2.1} style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />}
            </button>
          );
        })}
      </div>

      {reason === "Something else" && (
        <div className="mb-5" style={{ animation: "liftIn 320ms cubic-bezier(.22,1,.36,1) both" }}>
          <VoiceArea value={note} onChange={setNote} rows={2} ph={tr("What happened?")} />
        </div>
      )}

      <div className="p-4 mb-5" style={{ borderRadius: R.control, background: t.wash }}>
        <p style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: t.sub }}>
          {tr("We'll tell")} {other} {tr("straight away with the reason. A cancelled lesson is not counted.")}
        </p>
      </div>

      <Button tone="ink" disabled={!reason} onClick={() => { haptic(9); setStage("when"); }}>{tr("Next")}</Button>
    </>
  );
}

/* What the other side gets: the reason, and a one-tap answer. */
function CancelNotice({ from, lesson, reason, offer, duration, onAccept, onPickOther, onDismiss }) {
  const t = useT();
  return (
    <Tile accent={DANGER} className="px-5 py-4 mb-3">
      <div className="flex items-center gap-3 mb-2.5">
        <X size={15} color={DANGER} strokeWidth={2.1} />
        <span className="flex-1" style={{ fontFamily: ui, fontSize: 12, color: t.sub }}>
          {from} {tr("cancelled")}
        </span>
      </div>
      <div style={{ ...TYPE.subhead, color: t.ink }}>{lesson}</div>
      <div className="mt-1.5" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{tr(reason)}</div>

      {offer ? (
        <>
          <div className="mt-4 px-4 py-3" style={{ borderRadius: R.control, background: t.wash }}>
            <span className="block uppercase mb-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Offered instead")}</span>
            <span style={{ fontFamily: display, fontSize: 17, color: t.ink }}>{span(offer, duration)}</span>
          </div>
          <div className="flex gap-2.5 mt-3.5">
            <button onClick={() => { haptic(8); onPickOther(); }} className="px-4 active:opacity-60"
                    style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}`,
                             fontFamily: ui, fontSize: 13.5, fontWeight: 500, color: t.sub }}>{tr("Another time")}</button>
            <button onClick={() => { hapticSuccess(); chime(); onAccept(offer); }} className="flex-1 active:opacity-75"
                    style={{ minHeight: 44, borderRadius: R.control, background: STEADY,
                             fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>{tr("Take it")}</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2.5 mt-4">
          <button onClick={onDismiss} className="px-4 active:opacity-60"
                  style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}`,
                           fontFamily: ui, fontSize: 13.5, fontWeight: 500, color: t.sub }}>{tr("Close")}</button>
          <button onClick={() => { hapticCommit(); onPickOther(); }} className="flex-1 active:opacity-75"
                  style={{ minHeight: 44, borderRadius: R.control, background: t.accent,
                           fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>{tr("Find another time")}</button>
        </div>
      )}
    </Tile>
  );
}

/* A player's record belongs to the player, not the coach. Changing
   coach shouldn't mean starting again — but it also shouldn't hand a
   stranger everything by default. So: the player initiates it, chooses
   what travels, and can withdraw it later. That is the GDPR position
   (portability under Article 20) and it is also just decent. */
const RECORD_PARTS = [
  { id: "lessons",  label: "Lesson history",     note: "Dates, focus areas and notes", always: false },
  { id: "video",    label: "Video and mark-ups", note: "Clips your coach recorded",    always: false },
  { id: "stats",    label: "Stats and progress", note: "Your numbers over time",       always: false },
  { id: "goals",    label: "Goals and focus",    note: "What you're working towards",  always: false },
  { id: "drills",   label: "Drill history",      note: "What you've practised",        always: false },
  { id: "health",   label: "Injury notes",       note: "Special category data",        sensitive: true },
];

function RecordTransfer({ name, fromCoach, toCoach, onDone, close }) {
  const t = useT();
  const [parts, setParts] = useState(["lessons", "stats", "goals"]);
  const [stage, setStage] = useState("choose");
  const toggle = (id) => { haptic(6); soft(); setParts(parts.includes(id) ? parts.filter((x) => x !== id) : [...parts, id]); };

  if (stage === "confirm") return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Share with")} {toCoach}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.55, color: t.faint }}>
        {parts.length} {tr("of")} {RECORD_PARTS.length} {tr("parts of your record")}
      </p>
      <div className="flex flex-col gap-2 mb-5">
        {RECORD_PARTS.filter((r) => parts.includes(r.id)).map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3" style={{ borderRadius: R.control, background: t.wash }}>
            <Check size={14} color={STEADY} strokeWidth={2.1} style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />
            <span className="flex-1" style={{ fontFamily: ui, fontSize: 13.5, color: t.ink }}>{tr(r.label)}</span>
            {r.sensitive && <span className="rounded-full px-2 py-0.5" style={{ background: `${DANGER}18`, fontFamily: ui, fontSize: 9.5, fontWeight: 600, color: DANGER }}>{tr("Sensitive")}</span>}
          </div>
        ))}
      </div>
      <div className="p-4 mb-5" style={{ borderRadius: R.control, background: t.wash }}>
        <p style={{ fontFamily: ui, fontSize: 12, lineHeight: 1.65, color: t.sub }}>
          {fromCoach} {tr("keeps their own copy of lessons they gave — that is their record too. You can withdraw this sharing at any time in Settings, and")} {toCoach} {tr("loses access immediately.")}
        </p>
      </div>
      <Button onClick={() => { hapticSuccess(); chime(); onDone(parts); close(); }}>{tr("Share my record")}</Button>
      <button onClick={() => { haptic(6); setStage("choose"); }} className="w-full mt-3 py-3 active:opacity-50"
              style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("Back")}</button>
    </>
  );

  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Your record")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.55, color: t.faint }}>
        {tr("Choose what")} {toCoach} {tr("can see. You can change this later.")}
      </p>

      <div className="flex flex-col gap-2 mb-5">
        {RECORD_PARTS.map((r, i) => {
          const on = parts.includes(r.id);
          return (
            <button key={r.id} onClick={() => { haptic(9); soft(); toggle(r.id); }} className="w-full flex items-center gap-3.5 px-4 text-left"
                    style={{ minHeight: 66, borderRadius: R.control,
                             background: on ? (r.sensitive ? `${DANGER}0D` : `${t.accent}0D`) : t.surface,
                             border: `1px solid ${on ? (r.sensitive ? `${DANGER}3A` : `${t.accent}3A`) : t.hair}`,
                             transition: "background 200ms, border-color 200ms",
                             animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>
              <span className="flex items-center justify-center shrink-0"
                    style={{ width: 22, height: 22, borderRadius: R.control,
                             border: `1.5px solid ${on ? (r.sensitive ? DANGER : t.accent) : t.hair}`,
                             background: on ? (r.sensitive ? DANGER : t.accent) : "transparent" }}>
                {on && <Check size={12} color="#fff" strokeWidth={2.1} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr(r.label)}</span>
                <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 11.5, color: r.sensitive ? DANGER : t.faint }}>{tr(r.note)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Button tone="ink" disabled={!parts.length} onClick={() => { haptic(9); setStage("confirm"); }}>{tr("Next")}</Button>
      <button onClick={close} className="w-full mt-3 py-3 active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>
        {tr("Start fresh instead")}
      </button>
    </>
  );
}

/* Counting down to something real. The closer it gets the warmer it
   reads — quietly at six weeks, unmistakably at one. */
function EventCard({ event, sport, onPress, delay = 0 }) {
  const t = useT();
  const near = event.days <= 7;
  const soon = event.days <= 21;
  const tone = near ? CAUTION : soon ? t.accent : null;
  return (
    <Tile accent={tone} className="px-5 py-4 mb-2.5" onPress={onPress} delay={delay}>
      <div className="flex items-center gap-3.5">
        <span className="rounded-2xl flex flex-col items-center justify-center shrink-0"
              style={{ width: 52, height: 52, background: tone ? `${tone}1A` : t.wash,
                       animation: near ? "breathe 2.6s ease-in-out infinite" : "none" }}>
          <span style={{ fontFamily: display, fontSize: 19, lineHeight: 1, letterSpacing: "-0.02em",
                         color: tone || t.ink }}>{event.days}</span>
          <span className="uppercase" style={{ fontFamily: ui, fontSize: 7.5, letterSpacing: "0.14em", color: t.faint }}>
            {event.days === 1 ? tr("day") : tr("days")}
          </span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block uppercase mb-1" style={{ fontFamily: ui, fontSize: 8.5, letterSpacing: "0.2em",
                         fontWeight: 600, color: tone || t.faint }}>{tr(event.kind)}</span>
          <span className="block truncate" style={{ ...TYPE.subhead, color: t.ink }}>{event.name}</span>
          <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{event.when}</span>
        </span>
        <ChevronRight size={15} color={t.faint} />
      </div>
    </Tile>
  );
}

/* Everything a coach and player are working towards, and what the
   weeks between now and then should hold. */
function EventsScreen({ sport, cfg, role, pop, say }) {
  const t = useT();
  const list = EVENTS[sport] || [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(tr("Competition"));
  const [where, setWhere] = useState("");
  const [dd, setDd] = useState("");
  const [mm, setMm] = useState(TODAY.m);
  const [time, setTime] = useState("9:00 am");
  const [extra, setExtra] = useState([]);
  const all = [...extra, ...list].sort((a, b) => a.days - b.days);

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Ahead")} onBack={pop} meta={`${all.length} ${tr("coming up")}`}
              action={<button onClick={() => { haptic(9); soft(); setAdding(!adding); }}
                              className="rounded-full flex items-center justify-center active:opacity-70"
                              style={{ width: 40, height: 40, background: t.accent, boxShadow: `0 4px 14px ${t.accent}22` }}
                              aria-label={tr("Add")}>
                        <Plus size={19} color={t.onAccent} strokeWidth={2.1} />
                      </button>}>
        <div className="px-6 pb-2">
          {adding && (
            <div className="mb-6 p-5" style={{ background: t.surface, borderRadius: R.surface, boxShadow: ELEV.rest,
                   animation: "contentRise 340ms cubic-bezier(.22,1,.36,1) both" }}>
              <VoiceInput value={name} onChange={setName} ph={tr("Name")} autoFocus />

              <div className="mt-4 mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Kind")}</div>
              <div className="flex flex-wrap gap-2">
                {[tr("Competition"), tr("Tournament"), tr("Match"), tr("Regatta"), tr("Trial")].map((k) => (
                  <button key={k} onClick={() => { haptic(6); soft(); setKind(k); }} className="px-3.5 active:opacity-60"
                          style={{ minHeight: 38, borderRadius: R.pill, background: kind === k ? t.accent : t.wash,
                                   ...TYPE.small, fontWeight: 500, color: kind === k ? t.onAccent : t.sub }}>{k}</button>
                ))}
              </div>

              <div className="mt-4 mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Date")}</div>
              <div className="flex gap-2">
                <input value={dd} onChange={(e) => setDd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                       placeholder="DD" inputMode="numeric" className="outline-none text-center"
                       style={{ width: 58, minHeight: 48, borderRadius: R.field, background: t.wash, ...TYPE.body, color: t.ink }} />
                <select value={mm} onChange={(e) => setMm(e.target.value)} className="flex-1 outline-none px-3"
                        style={{ minHeight: 48, borderRadius: R.field, background: t.wash, ...TYPE.body, color: t.ink, border: "none" }}>
                  {MONTHS.map((mo) => <option key={mo.idx} value={mo.idx}>{mo.name}</option>)}
                </select>
              </div>

              <div className="mt-4 mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Time")}</div>
              <div className="flex flex-wrap gap-2">
                {ALL_TIMES.filter((_, i) => i % 2 === 0).slice(0, 6).map((tm) => (
                  <button key={tm} onClick={() => { haptic(6); setTime(tm); }} className="px-3 active:opacity-60"
                          style={{ minHeight: 38, borderRadius: R.pill, background: time === tm ? t.accent : t.wash,
                                   ...TYPE.small, fontWeight: 500, color: time === tm ? t.onAccent : t.sub }}>{tm}</button>
                ))}
              </div>

              <div className="mt-4 mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Where")}</div>
              <VoiceInput value={where} onChange={setWhere} ph={tr("Club or venue")} />

              <div className="mt-5">
                <Button disabled={!name.trim() || !dd} onClick={() => {
                  const d = Number(dd), mo = Number(mm);
                  const days = Math.max(1, (mo - TODAY.m) * 30 + (d - TODAY.d));
                  setExtra([{ name: name.trim(), kind, where: where.trim(), time,
                              when: `${DAY_NAMES[dowOf(mo, d)].slice(0, 3)} ${d} ${MONTHS.find((x) => x.idx === mo)?.name.split(" ")[0]}`,
                              days }, ...extra]);
                  setName(""); setWhere(""); setDd(""); setAdding(false); hapticSuccess(); chime(); }}>{tr("Add")}</Button>
              </div>
            </div>
          )}

          {all.map((e, i) => (
            <EventCard key={e.name} event={e} sport={sport} delay={i * 70}
                       onPress={() => say(role === "coach" ? tr("Plan the weeks into this") : tr("Your coach is planning for this"))} />
          ))}

          {all.length > 0 && all[0].days <= 21 && (
            <Tile className="px-5 py-[18px] mt-4" delay={200}>
              <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>
                {tr("Between now and then")}
              </div>
              <p style={{ fontFamily: display, fontSize: 15.5, lineHeight: 1.65, color: t.ink }}>
                {role === "coach"
                  ? `${tr("About")} ${Math.max(1, Math.round(all[0].days / 7))} ${tr("sessions left before")} ${all[0].name}. ${tr("Worth sharpening")} ${cfg.focus[0].label.toLowerCase()}.`
                  : `${tr("About")} ${Math.max(1, Math.round(all[0].days / 7))} ${tr("sessions left. Your coach is building towards it.")}`}
              </p>
            </Tile>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* A coach's paperwork, and how long it has left. Expiry is the whole
   point — a lapsed vetting certificate stops someone coaching minors,
   and nobody remembers the date. */
function Credentials({ pop, say }) {
  const t = useT();
  const [docs, setDocs] = useState(CREDENTIALS);
  const soon = docs.filter((d) => d.months !== null && d.months <= 16);

  const tone = (m) => (m === null ? t.faint : m <= 3 ? DANGER : m <= 16 ? CAUTION : t.accent);

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Paperwork")} onBack={pop}
              meta={soon.length ? `${soon.length} ${tr("renewing within the year")}` : tr("All current")}>
        <div className="px-6 pb-2">
          {soon.length > 0 && (
            <Tile accent={CAUTION} className="px-5 py-4 mb-4">
              <div className="flex items-center gap-3">
                <Radio size={16} color={CAUTION} strokeWidth={2} />
                <span className="flex-1" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.5, color: t.ink }}>
                  {tr("We'll remind you three months before each one runs out.")}
                </span>
              </div>
            </Tile>
          )}

          {docs.map((d, i) => (
            <Tile key={d.id} accent={d.months !== null && d.months <= 3 ? DANGER : null}
                  className="px-5 py-4 mb-2.5" delay={i * 55}
                  onPress={() => say(d.expires ? tr("Opens the document") : tr("Add this document"))}>
              <div className="flex items-center gap-3.5">
                <span className="rounded-xl flex items-center justify-center shrink-0"
                      style={{ width: 42, height: 42, background: t.wash }}>
                  <ShieldCheck size={18} color={tone(d.months)} strokeWidth={1.6} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate" style={{ ...TYPE.body, color: t.ink }}>{tr(d.name)}</span>
                    {d.required && <span className="rounded-full px-2 py-0.5 shrink-0"
                                         style={{ background: t.wash, fontFamily: ui, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: t.sub }}>
                                     {tr("Required")}</span>}
                  </span>
                  <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{d.body}</span>
                </span>
                <span className="text-right shrink-0">
                  {d.expires ? (<>
                    <span className="block" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: tone(d.months) }}>
                      {d.months <= 12 ? `${d.months} ${tr("months")}` : tr("Current")}
                    </span>
                    <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 10.5, color: t.faint }}>{d.expires}</span>
                  </>) : (
                    <span style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, color: t.accent }}>{tr("Add")}</span>
                  )}
                </span>
              </div>
            </Tile>
          ))}

          <p className="px-1 mt-5 pb-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.65, color: t.faint }}>
            {tr("Nosca stores the certificate and its date, never the contents of a vetting disclosure. Your players see only that you are up to date.")}
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Social proof, asked for at the right moment and shown where it does
   work — on the profile a prospective player sees. */
function Testimonials({ role, pop, say }) {
  const t = useT();
  const reviews = [
    { who: "Marcus T.", score: 5, when: "Jul", text: "Completely changed how I practise. The video breakdowns are worth it on their own.", tags: ["Clear", "Practical"] },
    { who: "Priya E.",  score: 5, when: "Jun", text: "Patient, and explains the why. My handicap is down four in a season.", tags: ["Encouraging"] },
    { who: "Dan O.",    score: 4, when: "Jun", text: "Good structure to every session. Would like a bit more on course management.", tags: ["Well paced"] },
  ];
  const avg = (reviews.reduce((n, r) => n + r.score, 0) / reviews.length).toFixed(1);

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Reviews")} onBack={pop} meta={`${avg} · ${reviews.length} ${tr("reviews")}`}>
        <div className="px-6 pb-2">
          <Tile className="px-5 py-5 mb-4">
            <div className="flex items-center gap-4">
              <span style={{ fontFamily: display, fontSize: 40, lineHeight: 1, letterSpacing: "-0.035em", color: t.ink,
                             animation: "countUp 620ms cubic-bezier(.22,1,.36,1) both" }}>{avg}</span>
              <span className="flex-1">
                <span className="flex gap-1 mb-2">
                  {[1,2,3,4,5].map((n) => (
                    <span key={n} className="rounded-full" style={{ width: 8, height: 8,
                                   background: n <= Math.round(avg) ? t.accent : t.hair,
                                   animation: `ringPop 420ms cubic-bezier(.34,1.56,.64,1) ${n * 60}ms both` }} />
                  ))}
                </span>
                <span style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>
                  {tr("Shown on your profile to new")} {tr("players")}
                </span>
              </span>
            </div>
          </Tile>

          {reviews.map((r, i) => (
            <Tile key={i} className="px-5 py-4 mb-2.5" delay={i * 70}>
              <div className="flex items-center gap-3 mb-2.5">
                <Avatar name={r.who} size={32} />
                <span className="flex-1" style={{ fontFamily: ui, fontSize: 13.5, color: t.ink }}>{r.who}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: r.score }).map((_, k) => (
                    <span key={k} className="rounded-full" style={{ width: 5, height: 5, background: t.accent }} />
                  ))}
                </span>
                <span style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{r.when}</span>
              </div>
              <p style={{ fontFamily: display, fontSize: 14.5, lineHeight: 1.6, color: t.ink }}>{r.text}</p>
              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.tags.map((tg) => (
                    <span key={tg} className="px-2.5 py-1" style={{ borderRadius: R.control, background: t.wash,
                                   fontFamily: ui, fontSize: 10.5, color: t.sub }}>{tr(tg)}</span>
                  ))}
                </div>
              )}
            </Tile>
          ))}

          <button onClick={() => { hapticCommit(); say(tr("Link copied — share it anywhere")); }}
                  className="w-full mt-4 flex items-center justify-center gap-2 active:opacity-70"
                  style={{ minHeight: 54, borderRadius: R.surface, background: t.accent,
                           fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.onAccent }}>
            <Share2 size={16} color={t.onAccent} />
            {tr("Share your profile")}
          </button>
          <div style={{ height: 26 }} />
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* One row shape for everything attached to a lesson — a clip, a device
   readout, a photo. Same height, same rhythm, so a slide with six
   attachments still reads calmly. */
function MediaRow({ item, cfg, sport, onAnnotate, onTranscribe, onRemove, delay = 0 }) {
  const t = useT();
  const cap = CAPTURE[sport];
  const isVideo = item.kind === "video";
  const isData = item.kind === "data";
  const isVoice = item.kind === "voice";
  const isNote = item.kind === "note";
  const label = isVideo ? item.angle : isData ? cap.device
    : isVoice ? tr("Voice note") : isNote ? (item.text || tr("Note")) : tr("Photo");
  const Icon = isVideo ? Play : isData ? Receipt : isVoice ? Mic : isNote ? Edit3 : Tag;

  return (
    <Tile className="px-4 py-3.5" delay={delay}>
      <div className="flex items-center gap-3.5">
        <span className="rounded-xl flex items-center justify-center shrink-0"
              style={{ width: 46, height: 46, background: "#191D1B" }}>
          <Icon size={17} color="rgba(255,255,255,0.85)" strokeWidth={1.6} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{label}</span>
          <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>
            {isVideo || isVoice ? `0:${String(item.secs || 0).padStart(2, "0")}`
              : isNote ? tr("Attached")
              : item.reading ? tr("Reading the numbers…")
              : item.values ? tr("Tap a number to correct it")
              : tr("Attached")}
          </span>
        </span>
        {(isVideo || isVoice) && (
          <button onClick={onAnnotate} className="rounded-full flex items-center justify-center shrink-0 active:opacity-60"
                  style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("Mark it up")}>
            <Palette size={15} color={t.sub} />
          </button>
        )}
        <button onClick={onRemove} className="shrink-0 active:opacity-50 p-1.5" aria-label={tr("Remove")}>
          <X size={14} color={t.faint} />
        </button>
      </div>

      {item.reading && (
        <div className="flex gap-2 mt-3">
          {[0, 1, 2].map((k) => <div key={k} className="flex-1"><Bone h={28} /></div>)}
        </div>
      )}

      {item.values && (
        <div className="flex flex-wrap gap-1.5 mt-3" style={{ animation: "liftIn 340ms cubic-bezier(.22,1,.36,1) both" }}>
          {cap.fields.map((f, k) => (
            <span key={f} className="px-2.5 py-1.5" style={{ borderRadius: R.field, background: t.wash }}>
              <span className="block" style={{ fontFamily: ui, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: t.faint }}>{f}</span>
              <span className="block" style={{ fontFamily: display, fontSize: 13, color: t.ink }}>{item.values[k]}</span>
            </span>
          ))}
        </div>
      )}

      {isVideo && !item.transcript && !item.working && (
        <button onClick={onTranscribe} className="w-full mt-3 flex items-center justify-center gap-2 active:opacity-60"
                style={{ minHeight: 38, borderRadius: R.field, border: `1px solid ${t.hair}` }}>
          <FileText size={12} color={t.sub} />
          <span style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, color: t.ink }}>{tr("Turn the talking into notes")}</span>
        </button>
      )}
      {isVideo && item.working && <div className="mt-3"><Bone h={30} /></div>}
      {isVideo && item.transcript && (
        <p className="mt-3 px-1" style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.55, color: t.sub }}>{item.transcript}</p>
      )}
    </Tile>
  );
}

/* The coach's moment. Deliberately not the same as booking or goals —
   this one lands like a stamp and counts up what the day amounted to.
   It is the reward for the one job the whole app exists to make easy. */
function PublishedBurst({ lesson, tally, onAskRating, onLogNext, remaining = 0, onDone }) {
  const t = useT();
  const first = (lesson.who[0] || "").split(" ")[0];
  useEffect(() => {
    hapticCommit(); swell();
    const a = setTimeout(() => { hapticSuccess(); tone(1180, 0.1, 0.035); }, 620);
    const b = setTimeout(() => onDone && onDone(), 2600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);

  const rows = [
    lesson.groupName ? `${lesson.who.length} ${tr("in the group")}` : first,
    lesson.focus,
    lesson.videos && lesson.videos.length ? `${lesson.videos.length} ${tr("clips")}` : null,
    lesson.nextDrills && lesson.nextDrills.length ? `${lesson.nextDrills.length} ${tr("drills set")}` : null,
    lesson.nextTip ? tr("Focus set") : null,
  ].filter(Boolean);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-9" aria-live="polite"
         style={{ zIndex: 70, background: t.ink, animation: "celebFade 2600ms ease both" }}>
      {/* shockwave out from the stamp */}
      <span className="absolute rounded-full" aria-hidden="true"
            style={{ width: 130, height: 130, border: `1px solid ${t.accent}`,
                     animation: "shockwave 900ms cubic-bezier(.2,.7,.3,1) 180ms both" }} />

      <span className="rounded-full flex items-center justify-center"
            style={{ width: 94, height: 94, background: t.accent,
                     boxShadow: `0 12px 40px ${t.accent}66`,
                     animation: "stampIn 620ms cubic-bezier(.34,1.56,.64,1) both" }}>
        <Check size={42} color="#fff" strokeWidth={2.1} />
      </span>

      <div className="mt-8 text-center" style={{ animation: "streakUp 520ms cubic-bezier(.22,1,.36,1) 460ms both" }}>
        <div style={{ fontFamily: display, fontSize: 32, letterSpacing: "-0.035em", color: "#F4F6F3" }}>{tr("Logged")}</div>
      </div>

      {/* what it amounted to, counting in */}
      <div className="mt-6 flex flex-col items-center gap-1.5">
        {rows.map((r, i) => (
          <span key={i} style={{ fontFamily: ui, fontSize: 13.5, color: "rgba(244,246,243,0.62)",
                        animation: `tally 420ms cubic-bezier(.34,1.56,.64,1) ${700 + i * 110}ms both` }}>{r}</span>
        ))}
      </div>

      {/* the running count for the day */}
      <div className="absolute flex items-baseline gap-2" style={{ bottom: 76,
             animation: "streakUp 560ms cubic-bezier(.22,1,.36,1) 1250ms both" }}>
        <span style={{ fontFamily: display, fontSize: 38, letterSpacing: "-0.04em", color: t.accent }}>{tally}</span>
        <span style={{ fontFamily: ui, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(244,246,243,0.4)" }}>
          {tally === 1 ? tr("logged today") : tr("logged today")}
        </span>
      </div>

      {onLogNext && (
        <button onClick={(e) => { e.stopPropagation(); hapticCommit(); soft(); onLogNext(); }}
                className="flex items-center gap-2 px-6 mt-8 active:opacity-80"
                style={{ minHeight: 48, borderRadius: R.pill, background: "rgba(255,255,255,0.14)",
                         animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 1150ms both" }}>
          <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: "#fff" }}>
            {tr("Log next")} — {remaining} {remaining === 1 ? tr("left") : tr("left")}
          </span>
          <ArrowRight size={14} color="#fff" strokeWidth={2.2} />
        </button>
      )}

      {onAskRating && (
        <button onClick={(e) => { e.stopPropagation(); hapticCommit(); soft(); onAskRating(); }}
                className="absolute flex items-center gap-2 px-5 active:opacity-60"
                style={{ bottom: 22, minHeight: 44, borderRadius: R.pill, border: "0.5px solid rgba(255,255,255,0.28)",
                         fontFamily: ui, fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.92)",
                         animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 1250ms both" }}>
          <Sparkles size={13} color="rgba(255,255,255,0.92)" strokeWidth={1.9} />
          {tr("Ask for a rating")}
        </button>
      )}
    </div>
  );
}

/* What a player sees on opening the app to something new. It carries
   them into the lesson rather than leaving a badge to notice — the
   whole point is that the work the coach just did gets seen. */
function NewLessonArrival({ lesson, coach, onOpen }) {
  const t = useT();
  useEffect(() => {
    hapticCommit(); swell();
    const x = setTimeout(() => onOpen && onOpen(), 2400);
    return () => clearTimeout(x);
  }, [onOpen]);

  return (
    <button onClick={() => { haptic(10); onOpen && onOpen(); }}
            className="absolute inset-0 flex flex-col items-center justify-center px-9"
            style={{ zIndex: 70, background: t.ink, cursor: "pointer" }} aria-live="polite">
      <span className="absolute rounded-full" aria-hidden="true"
            style={{ width: 150, height: 150, border: `1px solid ${t.accent}`,
                     animation: "haloOut 1600ms cubic-bezier(.2,.6,.3,1) 300ms infinite" }} />

      <span className="rounded-full flex items-center justify-center"
            style={{ width: 86, height: 86, background: t.accent, boxShadow: `0 12px 40px ${t.accent}55`,
                     animation: "stampIn 660ms cubic-bezier(.34,1.56,.64,1) both" }}>
        <Play size={34} color={t.onAccent} strokeWidth={2.1} />
      </span>

      <div className="mt-8 text-center" style={{ animation: "streakUp 520ms cubic-bezier(.22,1,.36,1) 420ms both" }}>
        <div style={{ fontFamily: ui, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: t.accent }}>
          {tr("From")} {coach}
        </div>
        <div className="mt-3" style={{ fontFamily: display, fontSize: 30, letterSpacing: "-0.035em", lineHeight: 1.1, color: "#F4F6F3" }}>
          {lesson.focus}
        </div>
        <div className="mt-2.5" style={{ fontFamily: ui, fontSize: 13.5, color: "rgba(244,246,243,0.55)" }}>
          {lesson.videos} {lesson.videos === 1 ? tr("clip") : tr("clips")} · {tr("your notes are in")}
        </div>
      </div>

      <div className="absolute" style={{ bottom: 60, animation: "streakUp 520ms cubic-bezier(.22,1,.36,1) 900ms both" }}>
        <span className="flex items-center gap-2" style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: "rgba(244,246,243,0.55)" }}>
          {tr("Opening it now")} <ArrowRight size={14} color="rgba(244,246,243,0.55)" />
        </span>
      </div>
    </button>
  );
}

/* THE LESSON SHEET

   Rebuilt from nothing. A coach opening this wants six facts and one
   action — who, when, how long, what today is for, what the last couple
   of sessions were, and anything they're building towards. Everything
   else was noise. */
function LessonPeek({ booking, duration, sport, cfg, agreed, past, comps = [],
                      onProfile, onLog, onNoShow, onCancel, onWeather, onCapture, onHistory, onEditComp, close }) {
  const t = useT();
  const f = fileFor(booking.who);
  const isGroup = booking.kind && booking.kind.startsWith("Group");
  const focus = agreed || f.tip;

  const lessons = (past || f.recent || [
    { d: "14 Jun", focus: "Short game", note: "Cleaner contact off a tight lie." },
    { d: "31 May", focus: "Driving",    note: "Tempo over speed." },
    { d: "17 May", focus: "Putting",    note: "Same routine every putt." },
  ]).slice(0, 2);

  return (
    <>
      {/* who, when, how long */}
      <div className="flex items-center gap-3.5 mb-5">
        {isGroup
          ? <span className="rounded-full flex items-center justify-center shrink-0"
                  style={{ width: 46, height: 46, background: `${GROUP}18` }}><Users size={19} color={GROUP} strokeWidth={1.6} /></span>
          : <Avatar name={booking.who} size={46} />}
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ ...TYPE.title, color: t.ink }}>{booking.who}</span>
          <span className="block mt-0.5" style={{ ...TYPE.small, color: t.faint }}>
            {booking.time} · {duration} {tr("min")}
          </span>
        </span>
      </div>

      {/* what today is for */}
      {focus && (
        <div className="px-4 py-3.5 mb-5" style={{ borderRadius: R.control, background: `${t.accent}0F` }}>
          <span className="block" style={{ ...TYPE.eyebrow, fontSize: 9, color: t.accent }}>{tr("Today")}</span>
          <span className="block mt-1" style={{ ...TYPE.subhead, color: t.ink }}>{focus}</span>
        </div>
      )}

      {/* the last couple */}
      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
        {lessons.map((l, i) => (
          <button key={i} onClick={() => { haptic(7); onHistory && onHistory(); }}
                  className="w-full flex items-baseline gap-4 py-3 text-left active:opacity-50"
                  style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                           animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>
            <span className="shrink-0" style={{ width: 50, ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>{l.d}</span>
            <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.body, color: t.ink }}>{l.focus}</span>
          </button>
        ))}
      </div>

      <button onClick={() => { haptic(8); soft(); onHistory && onHistory(); }}
              className="w-full py-3 mb-5 text-left active:opacity-50"
              style={{ ...TYPE.small, color: t.accent }}>
        {tr("All")} {f.done} {tr("lessons")}
      </button>

      {/* what they're building towards — the player's own, plus yours */}
      {comps.length > 0 && (
        <div className="mb-5" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
          {comps.map((c, i) => (
            <div key={i} className="flex items-baseline gap-4 py-3"
                 style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
              <span className="shrink-0" style={{ width: 50, ...TYPE.eyebrow, fontSize: 9,
                             color: c.days <= 7 ? CAUTION : t.faint }}>{c.days}d</span>
              <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.body, color: t.ink }}>{c.name}</span>
              {c.mine && <span style={{ ...TYPE.caption, fontSize: 10, color: t.faint }}>{tr("Yours")}</span>}
            </div>
          ))}
        </div>
      )}

      {/* one action, and the ways out */}
      <button onClick={() => { hapticCommit(); onLog(); }}
              onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
              onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              className="w-full flex items-center justify-center gap-2 active:opacity-90"
              style={{ minHeight: 56, borderRadius: R.control, background: t.accent, willChange: "transform",
                       boxShadow: `0 6px 18px ${t.accent}2E`,
                       transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)",
                       ...TYPE.subhead, color: t.onAccent }}>
        {tr("Log lesson")}
        <ArrowRight size={16} color={t.onAccent} strokeWidth={2.1} />
      </button>

      <div className="flex mt-3" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}`, paddingTop: 12 }}>
        {[{ Ico: User,         lbl: tr("Profile"), act: onProfile,  tone: null },
          { Ico: Camera,       lbl: tr("Capture"), act: onCapture,  tone: null },
          { Ico: CalendarDays, lbl: tr("Move"),    act: onCancel,   tone: null },
          { Ico: Radio,        lbl: tr("Weather"), act: onWeather,  tone: DANGER },
          { Ico: X,            lbl: tr("No show"), act: onNoShow,   tone: DANGER }].map(({ Ico, lbl, act, tone }) => (
          <button key={lbl} onClick={() => { haptic(7); soft(); act && act(); }}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="flex-1 flex flex-col items-center gap-1.5 py-1 active:opacity-60"
                  style={{ willChange: "transform", transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)" }}>
            <span className="rounded-full flex items-center justify-center"
                  style={{ width: 38, height: 38, background: tone ? `${tone}12` : t.wash }}>
              <Ico size={16} color={tone || t.sub} strokeWidth={1.6} />
            </span>
            <span style={{ ...TYPE.caption, fontSize: 10, color: tone || t.faint }}>{lbl}</span>
          </button>
        ))}
      </div>
    </>
  );
}





/* Editing one day's hours. A coach's week changes — a slot moves, one
   gets dropped, another gets added — so all three are here rather than
   buried in a separate availability screen. */
function EditDay({ day, slots, duration, avail, setAvail, slotKinds, setSlotKinds, onWeather, close, say }) {
  const t = useT();
  const dow = dowOf(day.m, day.d);
  const hours = avail[dow] || day.hours || [];
  const kindOf = (h) => slotKinds[`${day.m}-${day.d}-${h}`] || "either";
  const taken = (h) => (day.booked || []).find((b) => b.time === h);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(null);

  const write = (next) => setAvail({ ...avail, [dow]: next.slice().sort((a, b) => parseTime(a) - parseTime(b)) });
  const addSlot = (tm) => { hapticSuccess(); soft(); write([...hours, tm]); setAdding(false); };
  const dropSlot = (h) => { hapticWarn(); write(hours.filter((x) => x !== h)); };
  const moveSlot = (from, to) => { hapticSuccess(); soft(); write([...hours.filter((x) => x !== from), to]); setMoving(null); };
  const cycle = (h) => {
    const order = ["either", "private", "group"];
    haptic(6); soft();
    setSlotKinds({ ...slotKinds, [`${day.m}-${day.d}-${h}`]: order[(order.indexOf(kindOf(h)) + 1) % 3] });
  };
  const free = slots.filter((tm) => !hours.includes(tm));

  const TimeGrid = ({ onPick, onCancel, label }) => (
    <div style={{ animation: "contentRise 320ms cubic-bezier(.22,1,.36,1) both" }}>
      <div className="mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{label}</div>
      <div className="flex flex-wrap gap-2">
        {free.map((tm, i) => (
          <button key={tm} onClick={() => onPick(tm)} className="px-3.5 active:opacity-60"
                  style={{ minHeight: 42, borderRadius: R.pill, background: t.wash,
                           fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink,
                           animation: `fadeUp 280ms cubic-bezier(.22,1,.36,1) ${i * 22}ms both` }}>{tm}</button>
        ))}
      </div>
      <button onClick={() => { haptic(6); onCancel(); }} className="mt-4 py-2 active:opacity-50"
              style={{ ...TYPE.small, color: t.sub }}>{tr("Cancel")}</button>
    </div>
  );

  return (
    <>
      <h2 style={{ ...TYPE.title, color: t.ink }}>{DAY_NAMES[dow]} {day.d}</h2>
      <p className="mt-1.5 mb-6" style={{ ...TYPE.small, color: t.faint }}>
        {hours.length} {hours.length === 1 ? tr("slot") : tr("slots")}
      </p>

      {moving ? <TimeGrid label={tr("Move to")} onPick={(tm) => moveSlot(moving, tm)} onCancel={() => setMoving(null)} />
       : adding ? <TimeGrid label={tr("Add a time")} onPick={addSlot} onCancel={() => setAdding(false)} />
       : (
        <>
          <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
            {hours.map((h, i) => {
              const bk = taken(h);
              const k = kindOf(h);
              return (
                <div key={h} className="flex items-center gap-3"
                     style={{ minHeight: 56, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                              animation: `fadeUp 300ms cubic-bezier(.22,1,.36,1) ${i * 35}ms both` }}>
                  <button onClick={() => { if (!bk) { haptic(7); setMoving(h); } }}
                          className="shrink-0 text-left active:opacity-50"
                          style={{ width: 100, ...TYPE.figure, fontSize: 15, color: bk ? t.faint : t.ink }}>
                    {span(h, duration)}
                  </button>
                  <button onClick={() => { if (!bk) cycle(h); }} className="flex-1 text-left min-w-0 active:opacity-50">
                    <span className="block truncate" style={{ ...TYPE.small, color: bk ? t.faint : t.sub }}>
                      {bk ? bk.who : k === "either" ? tr("Private or group") : k === "group" ? tr("Group only") : tr("Private only")}
                    </span>
                  </button>
                  {!bk && (
                    <button onClick={() => dropSlot(h)} className="shrink-0 p-2 active:opacity-50" aria-label={tr("Remove")}>
                      <X size={15} color={t.faint} />
                    </button>
                  )}
                </div>
              );
            })}
            {hours.length === 0 && (
              <p className="py-8 text-center" style={{ ...TYPE.small, color: t.faint }}>{tr("No hours this day.")}</p>
            )}
          </div>

          <button onClick={() => { haptic(9); soft(); setAdding(true); }}
                  className="w-full flex items-center gap-2.5 mt-5 active:opacity-50" style={{ minHeight: 48 }}>
            <Plus size={16} color={t.accent} strokeWidth={2.1} />
            <span style={{ ...TYPE.body, fontWeight: 600, color: t.accent }}>{tr("Add a time")}</span>
          </button>

          {(day.booked || []).length > 0 && (
            <button onClick={() => { onWeather(); close(); }} className="w-full py-3 text-left active:opacity-50"
                    style={{ ...TYPE.small, color: DANGER }}>{tr("Weather call-off")}</button>
          )}
        </>
      )}
    </>
  );
}


/* Capture happens during the lesson, not afterwards at a desk. This
   opens straight from the schedule so a coach can film a swing or
   photograph a screen while it is in front of them; whatever is taken
   is waiting in the log later. */
function CaptureNow({ booking, sport, cfg, captured, setCaptured, pop, say }) {
  const t = useT();
  const cap = CAPTURE[sport];
  const mine = captured[booking.who] || [];
  const add = (kind, angle) => {
    haptic(12); soft();
    const at = Date.now();
    const item = { id: at, kind, angle, values: null, reading: kind === "data" };
    setCaptured({ ...captured, [booking.who]: [...mine, item] });
    if (kind === "data") setTimeout(() => {
      setCaptured((c) => ({ ...c, [booking.who]: (c[booking.who] || []).map((x) => (x.id === at ? { ...x, values: cap.sample, reading: false } : x)) }));
      hapticSuccess(); soft();
    }, 1300);
  };

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Capture")} onBack={pop} meta={booking.who}>
        <div className="px-6 pb-2">
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: tr("Film a clip"), sub: cfg.angles[0], Icon: Camera, act: () => add("video", cfg.angles[0]) },
              { label: tr("Second angle"), sub: cfg.angles[1] || cfg.angles[0], Icon: Camera, act: () => add("video", cfg.angles[1] || cfg.angles[0]) },
              { label: cap.device, sub: tr("Photo of the screen"), Icon: Receipt, act: () => add("data") },
              { label: tr("Action shot"), sub: tr("A position"), Icon: Tag, act: () => add("action") },
            ].map((o, i) => (
              <button key={o.label} onClick={o.act}
                      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      className="flex flex-col items-start justify-center gap-1.5 px-4 active:opacity-70"
                      style={{ minHeight: 96, borderRadius: R.surface, background: t.surface, border: `1px solid ${t.hair}`,
                               willChange: "transform", transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                               animation: `liftIn 420ms cubic-bezier(.22,1,.36,1) ${i * 60}ms both` }}>
                <o.Icon size={20} color={i < 2 ? t.accent : t.sub} strokeWidth={1.6} />
                <span className="truncate w-full text-left" style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.ink }}>{o.label}</span>
                <span className="truncate w-full text-left" style={{ fontFamily: ui, fontSize: 10.5, color: t.faint }}>{o.sub}</span>
              </button>
            ))}
          </div>

          {mine.length === 0 ? (
            <p className="py-10 text-center" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>
              {tr("Nothing captured yet")}
            </p>
          ) : (
            <>
              <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>
                {mine.length} {tr("saved to this lesson")}
              </div>
              <div className="flex flex-col gap-2.5">
                {mine.map((it, i) => (
                  <MediaRow key={it.id} item={{ ...it, secs: 12 }} cfg={cfg} sport={sport} delay={i * 55}
                            onAnnotate={() => say(tr("Mark it up in the log"))}
                            onTranscribe={() => {}}
                            onRemove={() => setCaptured({ ...captured, [booking.who]: mine.filter((x) => x.id !== it.id) })} />
                ))}
              </div>
            </>
          )}

          <p className="mt-6 px-1 pb-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.6, color: t.faint }}>
            
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Rolling lessons rather than packages. Most coaches don't sell blocks
   of ten — they have someone on a Tuesday at four until one of them
   says otherwise. So a series runs until it is ended, and an end date
   is offered rather than required. */
function RecurringManager({ series, roster, duration, onEnd, onExtend, onEdit, onNew, pop, say }) {
  const t = useT();
  const [confirming, setConfirming] = useState(null);
  const live = series.filter((x) => !x.ended);
  const past = series.filter((x) => x.ended);

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Recurring lessons")} onBack={pop}
              meta={live.length ? `${live.length} ${tr("running")}` : tr("None yet")}
              action={<button onClick={() => { hapticCommit(); soft(); onNew(); }}
                              className="rounded-full flex items-center justify-center active:opacity-70"
                              style={{ width: 40, height: 40, background: t.accent, boxShadow: `0 4px 14px ${t.accent}22` }}
                              aria-label={tr("Add")}>
                        <Plus size={19} color={t.onAccent} strokeWidth={2.1} />
                      </button>}>
        <div className="px-6 pb-2">
          {live.length === 0 && (
            <p className="py-12 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>
              {""}
            </p>
          )}

          {live.map((x, i) => (
            <Tile key={x.who + i} className="px-5 py-4 mb-2.5" delay={i * 60}>
              <div className="flex items-center gap-3.5">
                <Avatar name={x.who} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ ...TYPE.subhead, color: t.ink }}>{x.who}</span>
                  <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>
                    {DAY_NAMES[x.day]} · {span(x.time, duration)} · {tr(x.freq || "Weekly")}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block" style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>
                    {x.until ? tr("Until") : tr("Open ended")}
                  </span>
                  {x.until && <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{x.until}</span>}
                </span>
              </div>

              {confirming === x ? (
                <div className="flex gap-2.5 mt-4" style={{ animation: "liftIn 300ms cubic-bezier(.22,1,.36,1) both" }}>
                  <button onClick={() => { haptic(6); setConfirming(null); }} className="px-4 active:opacity-60"
                          style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}`,
                                   fontFamily: ui, fontSize: 13.5, fontWeight: 500, color: t.sub }}>{tr("Keep it")}</button>
                  <button onClick={() => { hapticWarn(); decline(); onEnd(x); setConfirming(null); }} className="flex-1 active:opacity-75"
                          style={{ minHeight: 44, borderRadius: R.control, background: DANGER,
                                   fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{tr("End it")}</button>
                </div>
              ) : (
                <>
                  {/* day, time and how often — a standing lesson moves
                      more often than people expect */}
                  <div className="flex gap-1 mt-4">
                    {DAY_NAMES.map((d, k) => {
                      const on = x.day === k;
                      return (<button key={k} onClick={() => { haptic(5); soft(); onEdit(x, { day: k }); }}
                                      className="flex-1 active:opacity-60"
                                      style={{ minHeight: 36, borderRadius: R.field, background: on ? STEADY : t.wash,
                                               fontFamily: ui, fontSize: 10.5, fontWeight: 600,
                                               color: on ? t.onAccent : t.faint, transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>
                                {d.slice(0, 2)}</button>);
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["Weekly", "Fortnightly", "Monthly"].map((f) => {
                      const on = (x.freq || "Weekly") === f;
                      return (<button key={f} onClick={() => { haptic(5); soft(); onEdit(x, { freq: f }); }}
                                      className="px-3 active:opacity-60"
                                      style={{ minHeight: 34, borderRadius: R.pill, background: on ? t.accent : t.wash,
                                               fontFamily: ui, fontSize: 11.5, fontWeight: 600,
                                               color: on ? "#fff" : t.sub, transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>{tr(f)}</button>);
                    })}
                    <span className="flex-1" />
                    <button onClick={() => { haptic(8); onExtend(x, "month"); }} className="px-3 active:opacity-60"
                            style={{ minHeight: 34, borderRadius: R.pill, border: `1px solid ${t.hair}`,
                                     fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{tr("+1 month")}</button>
                    <button onClick={() => { haptic(8); onExtend(x, "open"); }} className="px-3 active:opacity-60"
                            style={{ minHeight: 34, borderRadius: R.pill, border: `1px solid ${t.hair}`,
                                     fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{tr("No end")}</button>
                    <button onClick={() => { haptic(9); setConfirming(x); }} className="px-3 active:opacity-60"
                            style={{ minHeight: 34, borderRadius: R.pill, border: `1px solid ${t.hair}`,
                                     fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: DANGER }}>{tr("End")}</button>
                  </div>
                </>
              )}
            </Tile>
          ))}

          {past.length > 0 && (
            <>
              <div className="uppercase mt-7 mb-3 px-1" style={{ ...TYPE.eyebrow, color: t.faint }}>
                {tr("Ended")}
              </div>
              {past.map((x, i) => (
                <div key={x.who + i} className="flex items-center gap-3.5 px-5 py-3.5 mb-2"
                     style={{ borderRadius: R.surface, border: `1px solid ${t.hair}`, opacity: 0.6 }}>
                  <Avatar name={x.who} size={32} />
                  <span className="flex-1 truncate" style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{x.who}</span>
                  <span style={{ ...TYPE.caption, color: t.faint }}>{DAY_NAMES[x.day]}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ height: 26 }} />
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* ==================================================================
   WALKTHROUGH
   Shown once on first open, and available afterwards from Help. Each
   card is a small drawing of the screen being described with a pulsing
   ring on the control in question — pointing at the thing beats
   describing it, and it survives translation better too.
================================================================== */
const TOUR = {
  /* One line each. A walkthrough people read is short; a walkthrough
     people skip is long. Every step names a screen they'll actually
     land on. */
  coach: [
    { title: "Your day", body: "Every lesson you're teaching, in order.",
      shot: "today", ring: { x: 50, y: 34, w: 84, h: 15 } },
    { title: "Log a lesson", body: "Who, what you covered, and one thing to work on.",
      shot: "log", ring: { x: 50, y: 72, w: 70, h: 12 } },
    { title: "Film it there and then", body: "Video, photos or a voice note, saved to the lesson.",
      shot: "capture", ring: { x: 50, y: 40, w: 80, h: 34 } },
    { title: "Your diary", body: "Tap any open slot to book someone in.",
      shot: "calendar", ring: { x: 50, y: 48, w: 84, h: 14 } },
    { title: "Standing lessons", body: "Same time every week? Set it once.",
      shot: "recurring", ring: { x: 50, y: 34, w: 84, h: 14 } },
  ],
  player: [
    { title: "Your next lesson", body: "When it is, and what you're working on.",
      shot: "home", ring: { x: 50, y: 30, w: 84, h: 20 } },
    { title: "Watch it back", body: "Your coach marks up your video.",
      shot: "lesson", ring: { x: 50, y: 40, w: 84, h: 38 } },
    { title: "Your practice", body: "Tick things off as you do them.",
      shot: "practice", ring: { x: 50, y: 34, w: 84, h: 14 } },
    { title: "Book a time", body: "Ask for an open slot; your coach confirms.",
      shot: "calendar", ring: { x: 50, y: 48, w: 84, h: 14 } },
    { title: "Your record", body: "Lessons, attendance and goals over the season.",
      shot: "season", ring: { x: 50, y: 48, w: 84, h: 14 } },
  ],
  parent: [
    { title: "Everyone in one place", body: "Each child and their next lesson.",
      shot: "family", ring: { x: 50, y: 30, w: 84, h: 15 } },
    { title: "You do the booking", body: "Lessons for under-18s are arranged by you.",
      shot: "calendar", ring: { x: 50, y: 48, w: 84, h: 14 } },
    { title: "Watch their lessons back", body: "The same video and notes they see.",
      shot: "lesson", ring: { x: 50, y: 40, w: 84, h: 38 } },
  ],
  juvenile: [
    { title: "Your lessons", body: "What you worked on, and your coach's video.",
      shot: "home", ring: { x: 50, y: 30, w: 84, h: 20 } },
    { title: "Your practice", body: "Tick things off as you do them.",
      shot: "practice", ring: { x: 50, y: 34, w: 84, h: 14 } },
    { title: "Watch it back", body: "Your coach draws on your video.",
      shot: "lesson", ring: { x: 50, y: 40, w: 84, h: 38 } },
    { title: "A grown-up does the rest", body: "Booking and messages are handled by your parent.",
      shot: "family", ring: { x: 50, y: 30, w: 84, h: 15 } },
  ],
};

/* A REAL LOOK AT THE SCREEN

   The old version drew grey bars — every step looked like the same
   blank card, so the walkthrough taught nothing. This draws what each
   screen actually contains: the words on it, the icons, the shapes a
   person will recognise thirty seconds later when they get there. */
function TourShot({ kind, ring, accent }) {
  const t = useT();

  const Row = ({ y, label, meta, on }) => (
    <g>
      <rect x="7" y={y} width="86" height="15" rx="5" fill={on ? accent : t.wash} opacity={on ? 1 : 0.8} />
      <text x="12" y={y + 7.4} style={{ fontFamily: ui, fontSize: 5, fontWeight: 500 }}
            fill={on ? "#fff" : t.ink} dominantBaseline="middle">{label}</text>
      {meta && <text x="88" y={y + 7.4} textAnchor="end" style={{ fontFamily: ui, fontSize: 4.2 }}
                     fill={on ? "rgba(255,255,255,0.75)" : t.faint} dominantBaseline="middle">{meta}</text>}
    </g>
  );

  const Title = ({ children }) => (
    <text x="8" y="22" style={{ fontFamily: display, fontSize: 8, letterSpacing: "-0.02em" }}
          fill={t.ink} dominantBaseline="middle">{children}</text>
  );

  return (
    <div className="relative mx-auto" style={{ width: 176, height: 232 }}>
      <svg viewBox="0 0 100 132" width={176} height={232}
           style={{ borderRadius: R.surface, background: t.surface, border: `1px solid ${t.hair}` }}>

        {kind === "today" && (<>
          <Title>Today</Title>
          <Row y={30} label="9:00  Sarah M." meta="Log" on />
          <Row y={49} label="11:30  Group" meta="4" />
          <Row y={68} label="2:00  James K." meta="" />
          <text x="8" y="95" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>3 lessons today</text>
        </>)}

        {kind === "log" && (<>
          <Title>What you covered</Title>
          <rect x="7" y="30" width="41" height="16" rx="5" fill={accent} />
          <text x="27.5" y="38.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 5, fontWeight: 500 }}
                fill="#fff" dominantBaseline="middle">Serve</text>
          <rect x="52" y="30" width="41" height="16" rx="5" fill={t.wash} />
          <text x="72.5" y="38.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 5 }}
                fill={t.ink} dominantBaseline="middle">Volley</text>
          <rect x="7" y="50" width="41" height="16" rx="5" fill={t.wash} />
          <text x="27.5" y="58.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 5 }}
                fill={t.ink} dominantBaseline="middle">Footwork</text>
          <rect x="52" y="50" width="41" height="16" rx="5" fill={t.wash} />
          <text x="72.5" y="58.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 5 }}
                fill={t.ink} dominantBaseline="middle">Return</text>
          <rect x="15" y="88" width="70" height="14" rx="7" fill={accent} />
          <text x="50" y="95.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 5, fontWeight: 600 }}
                fill="#fff" dominantBaseline="middle">Continue</text>
        </>)}

        {kind === "capture" && (<>
          <Title>Capture</Title>
          <rect x="7" y="30" width="86" height="46" rx="6" fill={t.ink} opacity="0.88" />
          <circle cx="50" cy="53" r="9" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
          <circle cx="50" cy="53" r="5.5" fill="#fff" opacity="0.95" />
          <rect x="12" y="35" width="15" height="6" rx="3" fill="#C4342A" />
          <text x="19.5" y="38.4" textAnchor="middle" style={{ fontFamily: ui, fontSize: 3.6, fontWeight: 600 }}
                fill="#fff" dominantBaseline="middle">REC</text>
          <text x="8" y="86" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>Film · Photo · Voice</text>
        </>)}

        {kind === "calendar" && (<>
          <Title>Diary</Title>
          <Row y={30} label="Mon 9:00" meta="Booked" />
          <Row y={49} label="Mon 10:30" meta="Open" on />
          <Row y={68} label="Tue 2:00" meta="Booked" />
          <text x="8" y="95" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>Tap an open slot to book</text>
        </>)}

        {kind === "recurring" && (<>
          <Title>Every week</Title>
          <Row y={30} label="Tue 4:00  Sarah" meta="Weekly" on />
          <Row y={49} label="Thu 5:30  Group" meta="Weekly" />
          <text x="8" y="76" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>Set once, repeats itself</text>
        </>)}

        {kind === "home" && (<>
          <Title>Next lesson</Title>
          <rect x="7" y="28" width="86" height="24" rx="6" fill={accent} />
          <text x="12" y="38" style={{ fontFamily: ui, fontSize: 5.2, fontWeight: 500 }} fill="#fff">Thu 4:00 · Serve</text>
          <text x="12" y="46" style={{ fontFamily: ui, fontSize: 4.2 }} fill="rgba(255,255,255,0.75)">with Ray Doyle</text>
          <text x="8" y="63" style={{ fontFamily: ui, fontSize: 4.6, fontWeight: 500 }} fill={t.ink}>To practise</text>
          <Row y={68} label="Shadow serve  ×20" meta="" />
          <Row y={87} label="Wall rally  2 min" meta="" />
        </>)}

        {kind === "lesson" && (<>
          <Title>Your video</Title>
          <rect x="7" y="28" width="86" height="48" rx="6" fill={t.ink} opacity="0.9" />
          <path d="M45 46 L58 52 L45 58 Z" fill="#fff" opacity="0.95" />
          <circle cx="30" cy="42" r="6" fill="none" stroke={accent} strokeWidth="1.6" />
          <text x="8" y="86" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>Your coach drew on this</text>
        </>)}

        {kind === "practice" && (<>
          <Title>Practice</Title>
          <Row y={30} label="✓  Shadow serve" meta="" on />
          <Row y={49} label="Wall rally" meta="2 min" />
          <Row y={68} label="Split step ×10" meta="" />
          <text x="8" y="95" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>Tick them off as you go</text>
        </>)}

        {kind === "season" && (<>
          <Title>Your record</Title>
          <Row y={30} label="Lessons" meta="12" />
          <Row y={49} label="Attended" meta="92%" on />
          <Row y={68} label="Goals met" meta="3 of 5" />
        </>)}

        {kind === "family" && (<>
          <Title>Your family</Title>
          <Row y={30} label="Emma · Thu 4:00" meta="" on />
          <Row y={49} label="Jack · Sat 10:00" meta="" />
          <text x="8" y="76" style={{ fontFamily: ui, fontSize: 4.4 }} fill={t.faint}>You book for both</text>
        </>)}

        {/* tab bar — same on every screen, so it reads as one app */}
        <rect x="10" y="112" width="80" height="12" rx="6" fill={t.wash} />
        {[0,1,2,3].map((i) => <circle key={i} cx={22 + i * 19} cy="118" r="2.4" fill={i === 0 ? accent : t.hair} />)}
      </svg>

      {ring && (
        <>
          <span className="absolute rounded-full" aria-hidden="true"
                style={{ left: `${ring.x}%`, top: `${ring.y}%`, width: `${ring.w}%`, height: `${ring.h}%`,
                         transform: "translate(-50%,-50%)", border: `2px solid ${accent}`,
                         animation: "ringFlash 1.8s cubic-bezier(.2,.6,.3,1) infinite" }} />
          <span className="absolute rounded-full" aria-hidden="true"
                style={{ left: `${ring.x}%`, top: `${ring.y}%`, width: `${ring.w}%`, height: `${ring.h}%`,
                         transform: "translate(-50%,-50%)", border: `2px solid ${accent}`,
                         animation: "ringHold 1.8s ease-in-out infinite" }} />
        </>
      )}
    </div>
  );
}


function Walkthrough({ role, juvenile, isParent, onClose }) {
  const t = useT();
  const key = juvenile ? "juvenile" : isParent ? "parent" : role === "coach" ? "coach" : "player";
  const cards = TOUR[key] || TOUR.player;
  const [i, setI] = useState(0);
  const last = i === cards.length - 1;
  const card = cards[i];

  const next = () => { if (last) { hapticSuccess(); chime(); onClose(); } else { haptic(9); soft(); setI(i + 1); } };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ zIndex: 72, background: t.page,
           animation: "liftIn 420ms cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex items-center px-5 shrink-0" style={{ height: 56 }}>
        <Mark size={19} color={t.mark} />
        <span className="ml-2.5" style={{ fontFamily: display, fontSize: 10.5, letterSpacing: "0.3em", color: t.ink }}>{BRAND}</span>
        <span className="flex-1" />
        <button onClick={() => { haptic(6); onClose(); }} className="px-2 py-1 active:opacity-50"
                style={{ ...TYPE.small, color: t.faint }}>{tr("Skip")}</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        <div key={`s${i}`} style={{ animation: "slideFrom 460ms cubic-bezier(.22,1,.36,1) both" }}>
          <TourShot kind={card.shot} ring={card.ring} accent={t.accent} />
        </div>
        <div key={`t${i}`} className="text-center mt-9" style={{ animation: "slideFrom 460ms cubic-bezier(.22,1,.36,1) 80ms both" }}>
          <h2 style={{ fontFamily: display, fontSize: 25, lineHeight: 1.12, letterSpacing: "-0.032em", color: t.ink }}>{tr(card.title)}</h2>
          <p className="mt-3.5" style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.6, color: t.sub }}>{tr(card.body)}</p>
        </div>
      </div>

      <div className="px-8 pb-9 shrink-0">
        <div className="flex justify-center gap-1.5 mb-6">
          {cards.map((_, k) => (
            <span key={k} className="rounded-full" style={{ height: 6, width: k === i ? 20 : 6,
                     background: k === i ? t.accent : t.hair,
                     transition: "width 320ms cubic-bezier(.34,1.56,.64,1), background 320ms" }} />
          ))}
        </div>
        <div className="flex gap-2.5">
          {i > 0 && (
            <button onClick={() => { haptic(6); setI(i - 1); }} className="px-5 active:opacity-60"
                    style={{ minHeight: 56, borderRadius: R.surface, border: `1px solid ${t.hair}`,
                             fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.sub }}>{tr("Back")}</button>
          )}
          <button onClick={next}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="flex-1 flex items-center justify-center gap-2.5 active:opacity-90"
                  style={{ minHeight: 56, borderRadius: R.surface, background: t.accent,
                           boxShadow: `0 6px 22px ${t.accent}22`, willChange: "transform",
                           transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                           fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: t.onAccent }}>
            {last ? tr("Start using it") : tr("Next")}
            {!last && <ArrowRight size={17} color={t.onAccent} strokeWidth={2.1} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* The player's number, wherever it comes from. Shown with its source
   so nobody mistakes a club rating for a national one. */
function RatingTile({ sport, editable, onEdit, delay = 0 }) {
  const t = useT();
  const r = RATINGS[sport];
  if (!r) return null;
  return (
    <Tile className="px-5 py-[18px]" delay={delay} onPress={editable ? onEdit : null}>
      <div className="flex items-center gap-3.5">
        <span className="rounded-xl flex items-center justify-center shrink-0"
              style={{ width: 46, height: 46, background: `${t.accent}0D` }}>
          <Award size={19} color={t.accent} strokeWidth={1.6} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block uppercase" style={{ ...TYPE.eyebrow, color: t.faint }}>{r.label}</span>
          <span className="block mt-1" style={{ ...TYPE.figure, fontSize: 25, color: t.ink,
                         animation: "figureCount 640ms cubic-bezier(.22,1,.36,1) both" }}>{r.value}</span>
        </span>
        <span className="text-right shrink-0">
          <span className="block" style={{ fontFamily: ui, fontSize: 10.5, color: t.faint }}>{r.body}</span>
          {/* how settled the number is — a rating off three results is
              not the same claim as one off forty */}
          <span className="flex items-center justify-end gap-1 mt-1.5">
            {[0, 1, 2].map((k) => (
              <span key={k} className="rounded-full"
                    style={{ width: 12, height: 3, borderRadius: 2,
                             background: k < (r.confidence ?? 2) ? STEADY : HAIR(t.ink, 0.22) }} />
            ))}
          </span>
          <span className="block mt-1" style={{ fontFamily: ui, fontSize: 9.5, color: t.faint }}>
            {(r.confidence ?? 2) >= 3 ? tr("Settled") : (r.confidence ?? 2) === 2 ? tr("Firming up") : tr("Early")}
          </span>
        </span>
      </div>
    </Tile>
  );
}

/* Research flagged these as table stakes for serious amateurs. Nothing
   is claimed to be connected that isn't — each one says plainly whether
   it is on, and what it would bring in. */
const SOURCES = {
  golf:       [{ id: "health", name: "Apple Health", what: "Rounds walked, heart rate", on: true },
               { id: "tm", name: "TrackMan", what: "Session data by CSV", on: false },
               { id: "congu", name: "Handicap record", what: "Your playing handicap", on: false }],
  tennis:     [{ id: "health", name: "Apple Health", what: "Court time and effort", on: true },
               { id: "utr", name: "Universal Tennis", what: "Your UTR and results", on: false }],
  rowing:     [{ id: "c2", name: "Concept2 Logbook", what: "Every erg piece and split", on: false },
               { id: "health", name: "Apple Health", what: "Heart rate and calories", on: true },
               { id: "strava", name: "Strava", what: "On-water sessions", on: false }],
  squash:     [{ id: "health", name: "Apple Health", what: "Court time and effort", on: true }],
  padel:      [{ id: "playtomic", name: "Playtomic", what: "Your level and matches", on: false },
               { id: "health", name: "Apple Health", what: "Court time and effort", on: true }],
  equestrian: [{ id: "health", name: "Apple Health", what: "Ride time and effort", on: true },
               { id: "strava", name: "Strava", what: "Hacks and rides", on: false }],
};

function Sources({ sport, pop, say }) {
  const t = useT();
  const [list, setList] = useState(SOURCES[sport] || []);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Connections")} onBack={pop}
              meta={`${list.filter((x) => x.on).length} ${tr("of")} ${list.length} ${tr("on")}`}>
        <div className="px-6 pb-2">
          {list.map((src, i) => (
            <Tile key={src.id} accent={src.on ? t.accent : null} className="px-5 py-4 mb-2.5" delay={i * 60}>
              <div className="flex items-center gap-3.5">
                <span className="rounded-xl flex items-center justify-center shrink-0"
                      style={{ width: 42, height: 42, background: src.on ? `${t.accent}0F` : t.wash }}>
                  <Radio size={17} color={src.on ? t.accent : t.faint} strokeWidth={1.6} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{src.name}</span>
                  <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{tr(src.what)}</span>
                </span>
                <Toggle on={src.on} onChange={(v) => { haptic(9); soft();
                          setList(list.map((x) => (x.id === src.id ? { ...x, on: v } : x)));
                          say(v ? `${src.name} ${tr("connected")}` : `${src.name} ${tr("disconnected")}`); }} />
              </div>
            </Tile>
          ))}
          <p className="mt-5 px-1 pb-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.65, color: t.faint }}>
            {""}
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Research called this the single highest-leverage thing for a solo
   coach: people don't announce that they're drifting away, they just
   stop booking. Surfacing that early is worth more than any new
   feature, because keeping someone costs less than finding someone. */
function atRisk(roster, series) {
  return (roster || []).map((r) => {
    const f = fileFor(r.name);
    const booked = (series || []).some((x) => x.who === r.name && !x.ended);
    const gap = r.last || 0;
    let why = null, weight = 0;
    if (!booked && gap >= 21) { why = "Nothing booked, and it's been a while"; weight = 3; }
    else if (!booked && gap >= 14) { why = "Nothing in the diary"; weight = 2; }
    else if (gap >= 28) { why = "Long gap since their last lesson"; weight = 2; }
    return why ? { name: r.name, why, weight, gap, done: f.done } : null;
  }).filter(Boolean).sort((a, b) => b.weight - a.weight);
}

function AtRisk({ list, onMessage, onBook, pop }) {
  const t = useT();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Drifting")} onBack={pop}
              meta={list.length ? `${list.length} ${tr("people")}` : tr("Nobody drifting")}>
        <div className="px-6 pb-2">
          {list.length === 0 ? (
            <div className="py-14 text-center">
              <span className="rounded-full inline-flex items-center justify-center mb-5"
                    style={{ width: 62, height: 62, background: t.wash, animation: "breathe 4s ease-in-out infinite" }}>
                <Check size={24} color={STEADY} strokeWidth={2.1} />
              </span>
              <p style={{ ...TYPE.title, color: t.ink }}>{tr("Everyone's booked in")}</p>
            </div>
          ) : list.map((x, i) => (
            <Tile key={x.name} accent={x.weight >= 3 ? CAUTION : null} className="px-5 py-4 mb-2.5" delay={i * 65}>
              <div className="flex items-center gap-3.5">
                <Avatar name={x.name} size={42} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ ...TYPE.subhead, color: t.ink }}>{x.name}</span>
                  <span className="block mt-0.5" style={{ ...TYPE.caption, color: x.weight >= 3 ? CAUTION : t.faint }}>{tr(x.why)}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block" style={{ ...TYPE.figure, fontSize: 19, color: t.ink }}>{x.gap}</span>
                  <span className="block" style={{ ...TYPE.eyebrow, fontSize: 8, color: t.faint }}>{tr("days")}</span>
                </span>
              </div>
              <div className="flex gap-2.5 mt-4">
                <button onClick={() => { haptic(8); onBook(x.name); }} className="flex-1 active:opacity-60"
                        style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}`,
                                 fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.ink }}>{tr("Offer a time")}</button>
                <button onClick={() => { hapticCommit(); onMessage(x.name); }} className="flex-1 active:opacity-75"
                        style={{ minHeight: 44, borderRadius: R.control, background: t.accent,
                                 fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>{tr("Message")}</button>
              </div>
            </Tile>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* What a parent actually wants: proof it is going somewhere, without
   having to go looking for it. */
function ParentDigest({ profiles, cfg, pop }) {
  const t = useT();
  const kids = (profiles || []).filter((p) => p.age);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("This month")} onBack={pop} meta={tr("How everyone's getting on")}>
        <div className="px-6 pb-2">
          {kids.map((k, i) => {
            const f = fileFor(k.name);
            return (
              <Tile key={k.id} className="px-5 py-5 mb-3" delay={i * 80}>
                <div className="flex items-center gap-3.5 mb-4">
                  <Avatar name={k.name} size={44} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...TYPE.heading, color: t.ink }}>{k.name}</span>
                    <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{cfg.label}</span>
                  </span>
                </div>
                <div className="flex mb-4" style={{ borderTop: `1px solid ${t.hair}`, borderBottom: `1px solid ${t.hair}` }}>
                  <Stat value={4} label={tr("Lessons")} />
                  <span style={{ width: 1, background: t.hair }} />
                  <Stat value={"3h"} label={tr("On court")} />
                  <span style={{ width: 1, background: t.hair }} />
                  <Stat value={"9/12"} label={tr("Drills done")} />
                </div>
                <p style={{ ...TYPE.body, lineHeight: 1.65, color: t.ink }}>
                  {tr("Working on")} {(f.tip || cfg.focus[0].label).toLowerCase()}. {tr("Their coach says they're sticking with it.")}
                </p>
              </Tile>
            );
          })}
          {kids.length === 0 && (
            <p className="py-12 text-center" style={{ ...TYPE.body, color: t.faint }}>{tr("Nobody under 18 on this account.")}</p>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Between lessons. Research called this the loop that keeps remote and
   hybrid coaching alive — a player sends a clip, the coach marks it up
   when they have five minutes. It is the only feature here that earns
   money without either party being on court. */
const CHECKIN_SEED = [
  { id: 1, who: "Marcus Tran", when: "2 days ago", note: "Tried the shallower shaft. Feels odd at the top.", state: "waiting", secs: 8 },
  { id: 2, who: "Priya Ellis", when: "5 days ago", note: "Wedge from 60. Better contact I think?", state: "answered", secs: 11,
    reply: "Much better. Keep the chest turning through — you stalled it on the last two." },
];

function CheckIns({ role, list, onAnswer, onSend, pop, say }) {
  const t = useT();
  const waiting = list.filter((x) => x.state === "waiting");

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Between lessons")} onBack={pop}
              meta={role === "coach"
                ? (waiting.length ? `${waiting.length} ${tr("waiting on you")}` : tr("Nothing waiting"))
                : tr("Send something to look at")}
              action={role !== "coach" ? (
                <button onClick={() => { hapticCommit(); soft(); onSend(); }}
                        className="rounded-full flex items-center justify-center active:opacity-70"
                        style={{ width: 40, height: 40, background: t.accent, boxShadow: `0 4px 14px ${t.accent}22` }}
                        aria-label={tr("Send")}>
                  <Plus size={19} color={t.onAccent} strokeWidth={2.1} />
                </button>
              ) : null}>
        <div className="px-6 pb-2">
          {list.length === 0 && (
            <p className="py-14 text-center" style={{ ...TYPE.body, color: t.faint }}>{tr("Empty for now")}</p>
          )}

          {list.map((c, i) => (
            <div key={c.id} className="mb-7" style={{ animation: `contentRise 420ms cubic-bezier(.22,1,.36,1) ${i * 70}ms both` }}>
              <div className="flex items-center gap-3 mb-3">
                {role === "coach" && <Avatar name={c.who} size={30} />}
                <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.small, color: t.ink }}>
                  {role === "coach" ? c.who : tr("You sent")}
                </span>
                <span style={{ ...TYPE.caption, color: t.faint }}>{c.when}</span>
              </div>

              <div className="relative overflow-hidden mb-3"
                   style={{ borderRadius: R.surface, aspectRatio: "16/10", background: "#191D1B" }}>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full flex items-center justify-center"
                        style={{ width: 46, height: 46, background: "rgba(255,255,255,0.14)" }}>
                    <Play size={18} color="#fff" />
                  </span>
                </span>
                <span className="absolute" style={{ bottom: 10, left: 12, ...TYPE.caption, color: "rgba(255,255,255,0.7)" }}>
                  0:{String(c.secs).padStart(2, "0")}
                </span>
              </div>

              {c.note && <p className="mb-3" style={{ ...TYPE.body, color: t.sub }}>{c.note}</p>}

              {c.state === "answered" ? (
                <div className="pl-4" style={{ borderLeft: `2px solid ${t.accent}` }}>
                  <div className="mb-1.5" style={{ ...TYPE.eyebrow, color: t.accent }}>{tr("Your coach")}</div>
                  <p style={{ ...TYPE.body, color: t.ink }}>{c.reply}</p>
                </div>
              ) : role === "coach" ? (
                <div className="flex gap-2.5">
                  <button onClick={() => { haptic(8); say(tr("Opens the mark-up tools")); }} className="px-4 active:opacity-60"
                          style={{ minHeight: 46, borderRadius: R.control, border: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                                   ...TYPE.small, fontWeight: 600, color: t.ink }}>{tr("Mark it up")}</button>
                  <button onClick={() => { hapticCommit(); onAnswer(c); }} className="flex-1 active:opacity-75"
                          style={{ minHeight: 46, borderRadius: R.control, background: t.accent,
                                   ...TYPE.small, fontWeight: 600, color: t.onAccent }}>{tr("Reply")}</button>
                </div>
              ) : (
                <p style={{ ...TYPE.small, color: t.faint }}>{tr("Waiting on your coach")}</p>
              )}
            </div>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* A single phrase in editorial italic inside an otherwise plain heading.
   Used sparingly — one per screen at most, or the effect dies. */
const Em = ({ children }) => (
  <span style={{ fontFamily: editorial, fontStyle: "italic", fontWeight: 400, letterSpacing: "0" }}>{children}</span>
);

/* What the coach said, as the coach said it. A player would rather
   hear their coach than read a transcript of them, so the audio leads
   and the text is one tap away for anyone who wants to skim. */
function VoiceNote({ secs = 42, transcript, delay = 0 }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (at >= secs) { setPlaying(false); setAt(0); return; }
    const x = setTimeout(() => setAt((v) => v + 1), 1000);
    return () => clearTimeout(x);
  }, [playing, at, secs]);

  /* A fixed waveform — it belongs to this recording, so it must not
     reshuffle on every render. */
  const bars = Array.from({ length: 38 }, (_, i) =>
    0.28 + 0.72 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
  const through = at / secs;

  return (
    <div style={{ animation: `liftIn 420ms cubic-bezier(.22,1,.36,1) ${delay}ms both` }}>
      <div className="flex items-center gap-3.5 px-4 py-3.5"
           style={{ borderRadius: R.surface, background: t.surface, boxShadow: ELEV.rest }}>
        <button onClick={() => { haptic(10); soft(); setPlaying(!playing); }}
                onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
                onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                className="rounded-full flex items-center justify-center shrink-0 active:opacity-80"
                style={{ width: 42, height: 42, background: t.accent, willChange: "transform",
                         transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)" }}
                aria-label={playing ? tr("Pause") : tr("Play")}>
          {playing ? <Pause size={16} color={t.onAccent} fill={t.onAccent} />
                   : <Play size={16} color={t.onAccent} fill={t.onAccent} />}
        </button>

        <span className="flex-1 flex items-center gap-[2px]" style={{ height: 30 }}>
          {bars.map((h, i) => (
            <span key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 1,
                     background: i / bars.length <= through ? t.accent : t.hair,
                     transition: "background 180ms" }} />
          ))}
        </span>

        <span className="shrink-0" style={{ ...TYPE.figure, fontSize: 13, color: t.faint }}>
          {Math.floor((secs - at) / 60)}:{String((secs - at) % 60).padStart(2, "0")}
        </span>
      </div>

      {transcript && (<>
        <button onClick={() => { haptic(6); soft(); setShowText(!showText); }}
                className="flex items-center gap-1.5 mt-2.5 px-1 active:opacity-50">
          <span style={{ ...TYPE.small, fontWeight: 500, color: t.accent }}>
            {showText ? tr("Hide transcript") : tr("View transcript")}
          </span>
          <ChevronDown size={12} color={t.accent}
                       style={{ transform: showText ? "rotate(180deg)" : "none",
                                transition: "transform 260ms cubic-bezier(.22,1,.36,1)" }} />
        </button>
        {showText && (
          <p className="mt-2.5 px-1" style={{ ...TYPE.body, lineHeight: 1.65, color: t.sub,
                 animation: "contentRise 320ms cubic-bezier(.22,1,.36,1) both" }}>{transcript}</p>
        )}
      </>)}
    </div>
  );
}

/* A photo, or the initials that stand in until there is one. Kept as
   one sheet so a parent setting up five children does the same thing
   five times rather than learning five screens. */
function PhotoSheet({ name, current, onSet, onClear, close, say }) {
  const t = useT();
  /* Stand-ins until a real picker exists — a tint the person owns. */
  const tints = ["#8C6D28", "#0F7A69", "#6E5A93", "#B4472F", "#4F7A52", "#2F5D8C"];
  return (
    <>
      <h2 className="mb-1" style={{ ...TYPE.title, color: t.ink }}>{tr("Photo")}</h2>
      <p className="mb-6" style={{ ...TYPE.small, color: t.faint }}>{name}</p>

      <div className="flex justify-center mb-7">
        <span className="rounded-full flex items-center justify-center"
              style={{ width: 96, height: 96, background: current || t.wash,
                       animation: "ringPop 460ms cubic-bezier(.28,1.3,.5,1) both" }}>
          <span style={{ ...TYPE.hero, fontSize: 34, color: current ? "#fff" : t.sub }}>
            {(name || "").split(" ").map((x) => x[0]).slice(0, 2).join("")}
          </span>
        </span>
      </div>

      <button onClick={() => { hapticCommit(); soft(); say(tr("Opens your photos")); }}
              className="w-full flex items-center justify-center gap-2.5 mb-3 active:opacity-80"
              style={{ minHeight: 54, borderRadius: R.control, background: t.accent,
                       ...TYPE.subhead, color: t.onAccent }}>
        <Camera size={17} color={t.onAccent} strokeWidth={1.9} />
        {tr("Choose a photo")}
      </button>

      <div className="mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Or a colour")}</div>
      <div className="flex flex-wrap gap-2.5 mb-6">
        {tints.map((c, i) => (
          <button key={c} onClick={() => { haptic(8); soft(); onSet(c); }}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.9)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="rounded-full active:opacity-80"
                  style={{ width: 44, height: 44, background: c, willChange: "transform",
                           border: current === c ? `2.5px solid ${t.ink}` : "none",
                           transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                           animation: `ringPop 400ms cubic-bezier(.28,1.3,.5,1) ${i * 45}ms both` }}
                  aria-label={c} />
        ))}
      </div>

      {current && (
        <button onClick={() => { haptic(6); onClear(); }} className="w-full py-3 active:opacity-50"
                style={{ ...TYPE.small, color: t.faint }}>{tr("Remove")}</button>
      )}
    </>
  );
}

/* Which sport this person plays by default. Someone with one sport
   never sees it; someone with two chooses which the app opens on. */
function DefaultSport({ name, mine, current, onPick, close }) {
  const t = useT();
  return (
    <>
      <h2 className="mb-1" style={{ ...TYPE.title, color: t.ink }}>{tr("Main sport")}</h2>
      <p className="mb-6" style={{ ...TYPE.small, color: t.faint }}>{name}</p>
      <div className="flex flex-col gap-2.5">
        {mine.map((c, i) => {
          const sp = SPORTS[c.sport];
          const on = current === c.sport;
          return (
            <button key={c.id} onClick={() => { hapticSuccess(); soft(); onPick(c.sport); close(); }}
                    className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-70"
                    style={{ minHeight: 74, borderRadius: R.surface,
                             background: on ? `${sp.theme.accent}12` : t.surface,
                             border: on ? `1px solid ${sp.theme.accent}44` : "1px solid transparent",
                             boxShadow: on ? "none" : ELEV.rest,
                             animation: `liftIn 400ms cubic-bezier(.22,1,.36,1) ${i * 60}ms both` }}>
              <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: sp.theme.mark }} />
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...TYPE.subhead, color: t.ink }}>{sp.label}</span>
                <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{c.coach}</span>
              </span>
              {on && <Check size={17} color={STEADY} strokeWidth={2.1} style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* Swipe left to reveal a destructive action. Used anywhere a row can be
   dismissed — an unlogged lesson that never happened, a request, a
   notification. The row springs back if you let go early, so a
   half-swipe is never a commitment. */
function SwipeRow({ children, onDelete, label, deleteLabel }) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const st = useRef(null);
  const OPEN = 88;

  const down = (e) => { st.current = { x: e.clientX, base: dx }; };
  const move = (e) => {
    if (!st.current) return;
    const d = Math.min(0, Math.max(-120, st.current.base + (e.clientX - st.current.x)));
    setDx(d);
  };
  const up = () => {
    if (!st.current) return;
    if (dx < -OPEN * 0.6) { setDx(-OPEN); haptic(9); } else { setDx(0); }
    st.current = null;
  };

  if (gone) return null;

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
      {/* what sits underneath */}
      <button onClick={() => { hapticWarn(); decline(); setGone(true); setTimeout(() => onDelete && onDelete(), 180); }}
              className="absolute inset-y-0 right-0 flex flex-col items-center justify-center active:opacity-80"
              style={{ width: OPEN, background: DANGER }}
              aria-label={deleteLabel || tr("Remove")}>
        <Trash2 size={16} color="#fff" strokeWidth={1.9} />
        <span className="mt-1" style={{ ...TYPE.caption, fontSize: 9.5, color: "#fff" }}>{deleteLabel || tr("Remove")}</span>
      </button>

      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
           style={{ transform: `translateX(${dx}px)`, background: t.surface,
                    transition: st.current ? "none" : "transform 320ms cubic-bezier(.22,1,.36,1)",
                    touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

/* THE QUICK MENU

   Log a lesson leads, then a grid the coach arranges themselves. Long
   press to edit: tiles wiggle, each can be made wide or small, and they
   can be dragged into whatever order suits — the Control Centre idea,
   because no two coaches reach for the same thing second. */
/* THE QUICK MENU

   Arranged the way Control Centre is: a four-column grid of rounded
   tiles the coach lays out themselves.

   The editing had to be rebuilt. The old version reordered on
   `onPointerEnter`, which never fires reliably once a pointer is
   captured — so dragging appeared to do nothing. It now tracks the
   finger directly and hit-tests with elementFromPoint, so the tile
   under your thumb is always the one that moves. */
const QUICK_ACTIONS = {
  attend:  { Ico: Check,         label: "Attendance" },
  capture: { Ico: Camera,        label: "Live capture" },
  tip:     { Ico: Lightbulb,     label: "Set a tip" },
  drills:  { Ico: ListChecks,    label: "Set drills" },
  player:  { Ico: UserPlus,      label: "Add player" },
  group:   { Ico: Users,         label: "New group" },
  message: { Ico: MessageCircle, label: "Message" },
  comp:    { Ico: Trophy,        label: "Competition" },
};
const QUICK_DEFAULT = [
  { id: "attend",  w: 2 }, { id: "capture", w: 2 },
  { id: "tip",     w: 2 }, { id: "drills",  w: 2 },
  { id: "player",  w: 2 }, { id: "group",   w: 2 },
  { id: "message", w: 2 }, { id: "comp",    w: 2 },
];

function QuickMenu({ cfg, layout, setLayout, liveLesson, onLog, onRun, close }) {
  const t = useT();
  const [edit, setEdit] = useState(false);
  const [held, setHeld] = useState(null);        // index being dragged
  const [ghost, setGhost] = useState({ x: 0, y: 0 });
  const D = useRef({ id: null, ox: 0, oy: 0, from: null, armed: null, timer: null });
  const items = layout && layout.length ? layout : QUICK_DEFAULT;

  const move = (from, to) => {
    if (from === to || to < 0 || to >= items.length) return from;
    const next = items.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    setLayout(next); haptic(7);
    return to;
  };

  const resize = (i) => {
    const next = items.slice();
    next[i] = { ...next[i], w: next[i].w === 4 ? 2 : 4 };
    setLayout(next); haptic(9); soft();
  };

  /* ---- dragging ---- */
  /* Hold first, then drag. Without the hold, the smallest movement
     while tapping reshuffled the grid — which is what made editing feel
     unpredictable. */
  const HOLD_MS = 320;

  const grab = (e, i) => {
    if (!edit) return;
    const el = e.currentTarget, pid = e.pointerId;
    D.current.armed = i;                    // pending, not yet dragging
    D.current.timer = setTimeout(() => {
      const r = el.getBoundingClientRect();
      D.current = { ...D.current, id: pid, ox: e.clientX - r.left, oy: e.clientY - r.top, from: i, armed: null };
      try { el.setPointerCapture(pid); } catch (_) {}
      setHeld(i); hapticCommit(); swell();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    clearTimeout(D.current.timer);
    D.current.armed = null;
  };

  const drag = (e) => {
    /* moving before the hold completes cancels it — that was a scroll,
       not a drag */
    if (D.current.armed !== null) { cancelHold(); return; }
    if (D.current.from === null || e.pointerId !== D.current.id) return;
    setGhost({ x: e.clientX - D.current.ox, y: e.clientY - D.current.oy });
    /* whatever tile is genuinely under the finger */
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest ? el.closest("[data-tile]") : null;
    if (!cell) return;
    const over = Number(cell.getAttribute("data-tile"));
    if (!Number.isNaN(over) && over !== D.current.from) {
      D.current.from = move(D.current.from, over);
      setHeld(D.current.from);
    }
  };

  const drop = () => {
    cancelHold();
    if (D.current.from === null) return;
    D.current = { id: null, ox: 0, oy: 0, from: null, armed: null, timer: null };
    setHeld(null); haptic(9);
  };

  const Tile = ({ it, i }) => {
    const A = QUICK_ACTIONS[it.id];
    if (!A) return null;
    const Ico = A.Ico;
    const live = it.id === "attend" && liveLesson;
    const wide = it.w === 4;
    const lifted = held === i;

    return (
      <button data-tile={i}
              onPointerDown={(e) => grab(e, i)}
              onPointerMove={drag}
              onPointerUp={drop}
              onPointerCancel={drop}
              onClick={() => { if (!edit) { haptic(8); soft(); onRun(it.id); } }}
              className="relative flex items-center text-left"
              style={{ height: 84, width: "100%", padding: wide ? "0 18px" : "0 14px",
                       borderRadius: 22, touchAction: edit ? "none" : "auto",
                       background: live ? `${STEADY}12` : t.wash,
                       border: live ? `1px solid ${STEADY}30` : "1px solid transparent",
                       opacity: held !== null && !lifted ? 0.55 : 1,
                       zIndex: lifted ? 40 : 1,
                       transform: lifted ? "scale(1.06)" : "scale(1)",
                       boxShadow: lifted ? ELEV.float : "none",
                       transition: lifted ? "none" : "transform 260ms cubic-bezier(.22,1,.36,1), opacity 200ms, box-shadow 260ms",
                       animation: edit && !lifted
                         ? `wiggle 500ms ease-in-out ${(i % 3) * 70}ms infinite`
                         : (!edit ? `settle 300ms cubic-bezier(.22,1,.36,1) ${70 + i * 26}ms both` : "none"),
                       transformOrigin: "center" }}>

        <span className="rounded-full flex items-center justify-center shrink-0"
              style={{ width: 38, height: 38,
                       background: live ? `${STEADY}1F` : t.surface,
                       boxShadow: live ? "none" : ELEV.rest }}>
          <Ico size={17} color={live ? STEADY : t.accent} strokeWidth={1.8} />
        </span>

        <span className="flex-1 min-w-0" style={{ marginLeft: 12 }}>
          <span className="block truncate" style={{ ...TYPE.small, fontWeight: 500, color: t.ink }}>
            {tr(A.label)}
          </span>
          {live && (
            <span className="flex items-center gap-1.5 mt-1">
              <span className="rounded-full" style={{ width: 5, height: 5, background: STEADY,
                               animation: "pulseDot 1.6s ease-in-out infinite" }} />
              <span className="truncate" style={{ ...TYPE.caption, color: STEADY }}>
                {liveLesson.who} · {tr("on now")}
              </span>
            </span>
          )}
        </span>

        {/* the corner grip, as Control Centre puts it — tap to change width */}
        {edit && (
          <span onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); resize(i); }}
                className="absolute flex items-center justify-center"
                style={{ right: 6, bottom: 6, width: 30, height: 30, borderRadius: 15,
                         background: t.ink, boxShadow: ELEV.rest }}>
            {/* draws the width you'll get, so there's nothing to decode */}
            <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true">
              {wide
                ? <rect x="4.5" y="1.5" width="6" height="8" rx="2" fill="#fff" />
                : <rect x="1" y="1.5" width="13" height="8" rx="2" fill="#fff" />}
            </svg>
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center mb-3.5">
        <span className="flex-1" style={{ ...TYPE.eyebrow, color: edit ? t.accent : t.faint }}>
          {edit ? tr("Drag to move · tap the corner to resize") : tr("Quick actions")}
        </span>
        <button onClick={() => { haptic(10); soft(); setEdit(!edit); setHeld(null); }}
                className="rounded-full flex items-center justify-center active:opacity-60"
                style={{ width: 32, height: 32, background: edit ? t.accent : t.wash,
                         transition: "background 220ms" }}
                aria-label={edit ? tr("Done") : tr("Edit")}>
          {edit ? <Check size={15} color={t.onAccent} strokeWidth={2.4} />
                : <Edit3 size={14} color={t.sub} strokeWidth={1.9} />}
        </button>
      </div>

      {!edit && (
        <button onClick={() => { hapticCommit(); soft(); onLog(); }}
                onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                className="w-full flex items-center gap-3.5 mb-2.5 text-left active:opacity-90"
                style={{ height: 84, padding: "0 18px", borderRadius: 22, background: t.accent,
                         willChange: "transform", boxShadow: `0 8px 22px ${t.accent}2E`,
                         transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)",
                         animation: "liftIn 400ms cubic-bezier(.22,1,.36,1) both" }}>
          <span className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 38, height: 38, background: "rgba(255,255,255,0.16)" }}>
            <Plus size={19} color={t.onAccent} strokeWidth={2.4} />
          </span>
          <span className="flex-1" style={{ ...TYPE.subhead, fontSize: 17, color: t.onAccent }}>{tr("Log a lesson")}</span>
          <ArrowRight size={16} color={t.onAccent} style={{ opacity: 0.7 }} strokeWidth={2} />
        </button>
      )}

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {items.map((it, i) => (
          <span key={it.id} style={{ gridColumn: `span ${it.w}`,
                       transition: "grid-column 260ms cubic-bezier(.22,1,.36,1)" }}>
            <Tile it={it} i={i} />
          </span>
        ))}
      </div>

      {edit && (
        <button onClick={() => { haptic(8); setLayout(QUICK_DEFAULT); }}
                className="w-full py-4 mt-3 active:opacity-50"
                style={{ ...TYPE.small, color: t.faint }}>{tr("Reset layout")}</button>
      )}
    </>
  );
}





/* SOMETHING YOU CANNOT MISS

   A rained-off lesson is the one message that must not sit unread
   behind a badge — someone will otherwise drive to a flooded range.
   So it takes the whole screen on open, states the fact in a sentence,
   and offers the one thing worth doing about it. Used for the same
   class of event: a lesson logged, a new coach, a group you've joined. */
const ANNOUNCE = {
  weather:  { Ico: Radio,         tone: "danger",  eyebrow: "Called off" },
  logged:   { Ico: Library,       tone: "steady",  eyebrow: "New lesson" },
  coach:    { Ico: UserPlus,      tone: "steady",  eyebrow: "New coach" },
  group:    { Ico: Users,         tone: "steady",  eyebrow: "Added to a group" },
  cancelled:{ Ico: CalendarDays,  tone: "danger",  eyebrow: "Cancelled" },
  comp:     { Ico: Trophy,        tone: "caution", eyebrow: "Coming up" },
};

function Announcement({ kind, title, body, action, actionLabel, onDismiss }) {
  const t = useT();
  const cfg = ANNOUNCE[kind] || ANNOUNCE.logged;
  const tone = cfg.tone === "danger" ? DANGER : cfg.tone === "caution" ? CAUTION : STEADY;
  const Ico = cfg.Ico;

  useEffect(() => { cfg.tone === "danger" ? hapticWarn() : hapticSuccess(); swell(); }, [cfg.tone]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-9"
         style={{ zIndex: 80, background: t.page, animation: "liftIn 420ms cubic-bezier(.22,1,.36,1) both" }}>

      <span className="relative flex items-center justify-center mb-9">
        <span className="absolute rounded-full" aria-hidden="true"
              style={{ width: 108, height: 108, border: `1px solid ${tone}`, opacity: 0.25,
                       animation: "shockwave 2.4s cubic-bezier(.2,.6,.3,1) infinite" }} />
        <span className="rounded-full flex items-center justify-center"
              style={{ width: 76, height: 76, background: `${tone}14`,
                       animation: "stampIn 520ms cubic-bezier(.28,1.3,.5,1) both" }}>
          <Ico size={29} color={tone} strokeWidth={1.7} />
        </span>
      </span>

      <span className="mb-3.5" style={{ ...TYPE.eyebrow, color: tone,
                     animation: "fadeUp 480ms cubic-bezier(.22,1,.36,1) 180ms both" }}>
        {tr(cfg.eyebrow)}
      </span>

      <h2 className="text-center" style={{ ...TYPE.hero, fontSize: 29, color: t.ink,
                    animation: "fadeUp 500ms cubic-bezier(.22,1,.36,1) 240ms both" }}>{title}</h2>

      {body && (
        <p className="text-center mt-4" style={{ ...TYPE.body, lineHeight: 1.6, color: t.sub,
                   animation: "fadeUp 500ms cubic-bezier(.22,1,.36,1) 320ms both" }}>{body}</p>
      )}

      <div className="w-full mt-11" style={{ animation: "fadeUp 500ms cubic-bezier(.22,1,.36,1) 420ms both" }}>
        {action && (
          <button onClick={() => { hapticCommit(); action(); }}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="w-full flex items-center justify-center gap-2 mb-3 active:opacity-90"
                  style={{ minHeight: 56, borderRadius: R.control, background: t.accent, willChange: "transform",
                           boxShadow: ELEV.raise, transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)",
                           ...TYPE.subhead, color: "#fff" }}>
            {actionLabel}
            <ArrowRight size={16} color="#fff" strokeWidth={2.1} />
          </button>
        )}
        <button onClick={() => { haptic(7); onDismiss(); }} className="w-full py-3.5 active:opacity-50"
                style={{ ...TYPE.small, color: t.faint }}>{tr("Not now")}</button>
      </div>
    </div>
  );
}

/* WHO IS THIS FOR

   Anything a coach sets — a tip, drills, a standing lesson — has to
   name a person first. Setting it against whoever happens to be top of
   the roster is worse than useless. Search included, because a coach
   with sixty players should not scroll. */
function PickPerson({ roster, title, sub, onPick, close }) {
  const t = useT();
  const [q, setQ] = useState("");
  const list = (roster || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <h2 style={{ ...TYPE.title, color: t.ink }}>{title}</h2>
      {sub && <p className="mt-1 mb-5" style={{ ...TYPE.small, color: t.faint }}>{sub}</p>}

      <div className="flex items-center gap-2.5 px-4 mb-4"
           style={{ minHeight: 46, borderRadius: R.control, background: t.wash }}>
        <Search size={15} color={t.faint} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search")}
               className="flex-1 bg-transparent outline-none"
               style={{ ...TYPE.body, color: t.ink }} />
      </div>

      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}`, maxHeight: 320, overflowY: "auto" }}>
        {list.length === 0 ? (
          <p className="py-8 text-center" style={{ ...TYPE.small, color: t.faint }}>{tr("Nobody by that name.")}</p>
        ) : list.map((r, i) => (
          <button key={r.name} onClick={() => { hapticCommit(); soft(); onPick(r.name); }}
                  className="w-full flex items-center gap-3.5 text-left active:opacity-50"
                  style={{ minHeight: 62, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                           animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 40}ms both` }}>
            <Avatar name={r.name} size={34} />
            <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.body, color: t.ink }}>{r.name}</span>
            <ChevronRight size={14} color={t.faint} />
          </button>
        ))}
      </div>
    </>
  );
}

/* ATTENDANCE

   A register, not part of logging. Pick the lesson, mark each person
   present or absent, submit. Once submitted it is done — a coach should
   never have to remember whether they took the roll.

   Deliberately separate from the lesson log: attendance is a record of
   who turned up, which a club may need for insurance or subsidy, and it
   has to stand on its own whether or not the lesson gets written up. */
function Attendance({ lessons, roster, taken, onSubmit, close, say }) {
  const t = useT();
  const soleLive = (lessons || []).filter((l) => !l.done && (l.hoursUntil ?? 9) <= 0.5);
  const [picked, setPicked] = useState(soleLive.length === 1 ? soleLive[0] : null);
  const [marks, setMarks] = useState(soleLive.length === 1 ? (taken[soleLive[0].time + soleLive[0].who] || {}) : {});

  const membersOf = (l) => (l && l.kind && l.kind.startsWith("Group"))
    ? (roster || []).slice(0, Number((l.kind.match(/\d+/) || [6])[0])).map((r) => r.name)
    : l ? [l.who] : [];

  const open = (l) => {
    haptic(8); soft();
    setPicked(l);
    setMarks(taken[l.time + l.who] || {});   // reopen a register already taken
  };

  const mark = (name, v) => {
    v === "in" ? hapticSuccess() : hapticWarn();
    soft();
    setMarks((m) => ({ ...m, [name]: v }));
  };

  const all = (v) => { haptic(10); soft(); const m = {}; membersOf(picked).forEach((n) => (m[n] = v)); setMarks(m); };

  /* ---------- the register ---------- */
  if (picked) {
    const who = membersOf(picked);
    const done = who.filter((n) => marks[n]).length;
    const present = who.filter((n) => marks[n] === "in").length;
    const ready = done === who.length;

    return (
      <>
        <button onClick={() => { haptic(6); setPicked(null); }}
                className="flex items-center gap-1.5 mb-4 active:opacity-50"
                style={{ ...TYPE.small, color: t.accent }}>
          <ChevronLeft size={15} color={t.accent} strokeWidth={2.2} /> {tr("All lessons")}
        </button>

        <h2 style={{ ...TYPE.title, color: t.ink }}>{picked.who}</h2>
        <p className="mt-1 mb-4" style={{ ...TYPE.small, color: t.faint }}>
          {picked.time} · {who.length} {who.length === 1 ? tr("person") : tr("people")}
        </p>

        {who.length > 1 && (
          <div className="flex gap-2 mb-4">
            {[["in", tr("All present"), STEADY], ["out", tr("All absent"), DANGER]].map(([v, lbl, tone]) => (
              <button key={v} onClick={() => all(v)} className="px-3.5 active:opacity-60"
                      style={{ minHeight: 34, borderRadius: R.pill, border: `0.5px solid ${tone}44`,
                               ...TYPE.caption, fontWeight: 500, color: tone }}>{lbl}</button>
            ))}
          </div>
        )}

        {/* the register itself */}
        <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
          {who.map((name, i) => {
            const m = marks[name];
            return (
              <div key={name} className="flex items-center gap-3"
                   style={{ minHeight: 62, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                            animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${i * 35}ms both` }}>
                <Avatar name={name} size={32} />
                <span className="flex-1 min-w-0 truncate"
                      style={{ ...TYPE.body, color: m === "out" ? t.faint : t.ink }}>{name}</span>

                {[["in", tr("Present"), STEADY], ["out", tr("Absent"), DANGER]].map(([v, lbl, tone]) => {
                  const on = m === v;
                  return (
                    <button key={v} onClick={() => mark(name, v)}
                            className="flex items-center justify-center active:opacity-70"
                            style={{ minWidth: 74, minHeight: 38, borderRadius: R.control,
                                     background: on ? tone : "transparent",
                                     border: `0.5px solid ${on ? tone : HAIR(t.ink, 0.2)}`,
                                     ...TYPE.caption, fontWeight: 600,
                                     color: on ? "#fff" : t.faint,
                                     transition: "background 180ms, color 180ms, border-color 180ms" }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-baseline gap-2 mt-4 mb-5">
          <span style={{ ...TYPE.figure, fontSize: 22, color: t.ink }}>{present}</span>
          <span style={{ ...TYPE.small, color: t.faint }}>{tr("of")} {who.length} {tr("present")}</span>
          <span className="flex-1" />
          {!ready && (
            <span style={{ ...TYPE.caption, color: CAUTION }}>{who.length - done} {tr("unmarked")}</span>
          )}
        </div>

        <button onClick={() => { if (!ready) return; hapticSuccess(); chime();
                                 onSubmit(picked, marks); setPicked(null); }}
                disabled={!ready}
                className="w-full flex items-center justify-center gap-2 active:opacity-90"
                style={{ minHeight: 56, borderRadius: R.control,
                         background: ready ? t.accent : t.wash,
                         boxShadow: ready ? `0 6px 18px ${t.accent}2E` : "none",
                         ...TYPE.subhead, color: ready ? t.onAccent : t.faint,
                         transition: "background 220ms, color 220ms" }}>
          {tr("Submit register")}
          {ready && <Check size={17} color={t.onAccent} strokeWidth={2.4} />}
        </button>
      </>
    );
  }

  /* ---------- pick a lesson ---------- */
  return (
    <>
      <h2 className="mb-1" style={{ ...TYPE.title, color: t.ink }}>{tr("Attendance")}</h2>
      <p className="mb-5" style={{ ...TYPE.small, color: t.faint }}>{tr("Today")}</p>

      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
        {(lessons || []).map((l, i) => {
          const key = l.time + l.who;
          const reg = taken[key];
          const n = reg ? Object.values(reg).filter((x) => x === "in").length : 0;
          const total = membersOf(l).length;
          const live = !l.done && (l.hoursUntil ?? 9) <= 0.5;
          return (
            <button key={key} onClick={() => open(l)}
                    className="w-full flex items-center gap-3.5 text-left active:opacity-50"
                    style={{ minHeight: 66, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                             animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${i * 35}ms both` }}>
              <span className="shrink-0" style={{ width: 58, ...TYPE.small, color: t.faint,
                             fontVariantNumeric: "tabular-nums" }}>{l.time}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate" style={{ ...TYPE.body, color: t.ink }}>{l.who}</span>
                  {live && <span className="rounded-full" style={{ width: 6, height: 6, background: STEADY,
                                   animation: "pulseDot 1.6s ease-in-out infinite" }} />}
                </span>
                {reg && (
                  <span className="block mt-0.5" style={{ ...TYPE.caption, color: STEADY }}>
                    {n} {tr("of")} {total} {tr("present")}
                  </span>
                )}
              </span>
              {reg
                ? <Check size={16} color={STEADY} strokeWidth={2.4}
                         style={{ animation: "checkPop 380ms cubic-bezier(.28,1.4,.5,1) both" }} />
                : <ChevronRight size={14} color={t.faint} />}
            </button>
          );
        })}
      </div>
    </>
  );
}


/* CAPTURE, FOR REAL

   The camera and microphone are the browser's own. What comes back is a
   File, ready to go straight into storage with the lesson — no
   conversion step, no placeholder.

   Recording can fail for ordinary reasons: permission declined, no
   camera on a desktop, a browser that does not support it. Every one of
   those falls back to choosing a file rather than to a dead end. */
function LiveCapture({ lessons, chosen, onChoose, items, onAdd, onDrop, close, say }) {
  const t = useT();
  const [mode, setMode] = useState("video");        // video | photo | audio
  const cap = useCapture();
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  /* Attach the live stream to the preview once both exist. */
  useEffect(() => {
    const el = videoRef.current;
    const stream = cap.stream();
    if (el && stream && mode !== "audio") {
      el.srcObject = stream;
      el.play().catch(() => {});                     /* autoplay policy — harmless */
    }
  }, [cap.state, mode]);

  useEffect(() => () => cap.cancel(), []);           // release the camera on leaving

  const begin = async () => { haptic(10); await cap.start(mode === "audio" ? "audio" : "video"); };

  const shoot = async () => {
    if (cap.state === "recording") {
      const file = await cap.stop(mode === "audio" ? "audio" : "video");
      hapticCommit(); soft();
      if (file) { onAdd({ type: mode === "audio" ? "audio" : "video", file, name: file.name }); say && say(tr("Saved")); }
      return;
    }
    if (mode === "photo") {
      /* A still is a frame off the live stream, drawn to a canvas. */
      const el = videoRef.current;
      if (!el) return;
      const c = document.createElement("canvas");
      c.width = el.videoWidth || 1280; c.height = el.videoHeight || 720;
      c.getContext("2d").drawImage(el, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        hapticCommit(); soft();
        onAdd({ type: "photo", file, name: file.name });
        say && say(tr("Saved"));
      }, "image/jpeg", 0.92);
      return;
    }
    cap.record(mode === "audio" ? "audio" : "video");
    hapticWarn();
  };

  const mmss = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  const live = cap.state === "recording";

  return (
    <Sheet onClose={close} title={tr("Capture")}>
      <div className="px-6 pb-6">
        {/* which kind */}
        <div className="flex gap-1 p-1 mb-5 rounded-full w-fit" style={{ background: t.wash }}>
          {[["video", tr("Film")], ["photo", tr("Photo")], ["audio", tr("Voice")]].map(([id, label]) => (
            <button key={id} disabled={live}
                    onClick={() => { haptic(6); cap.cancel(); setMode(id); }}
                    className="px-4 py-1.5 rounded-full active:opacity-70"
                    style={{ ...TYPE.small, fontWeight: 500,
                             background: mode === id ? "#fff" : "transparent",
                             color: mode === id ? t.ink : t.faint,
                             boxShadow: mode === id ? ELEV.rest : "none",
                             opacity: live && mode !== id ? 0.4 : 1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* the viewfinder */}
        <div className="relative overflow-hidden mb-5"
             style={{ borderRadius: R.surface, background: "#0B0F0C", aspectRatio: "3 / 4" }}>
          {mode !== "audio" && (
            <video ref={videoRef} muted playsInline
                   className="absolute inset-0 w-full h-full"
                   style={{ objectFit: "cover", opacity: cap.state === "idle" ? 0 : 1,
                            transition: "opacity 300ms" }} />
          )}

          {cap.state === "idle" && (
            <button onClick={begin} className="absolute inset-0 flex flex-col items-center justify-center gap-3 active:opacity-70">
              {mode === "audio" ? <Mic size={30} color="rgba(255,255,255,0.8)" strokeWidth={1.6} />
                                : <Camera size={30} color="rgba(255,255,255,0.8)" strokeWidth={1.6} />}
              <span style={{ ...TYPE.small, color: "rgba(255,255,255,0.75)" }}>
                {mode === "audio" ? tr("Tap to use the microphone") : tr("Tap to use the camera")}
              </span>
            </button>
          )}

          {mode === "audio" && cap.state !== "idle" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Mic size={44} color="#fff" strokeWidth={1.4}
                   style={{ animation: live ? "breathe 1600ms ease-in-out infinite" : "none" }} />
            </div>
          )}

          {live && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
                 style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}>
              <span className="rounded-full" style={{ width: 7, height: 7, background: DANGER,
                                                      animation: "breathe 1200ms ease-in-out infinite" }} />
              <span style={{ ...TYPE.small, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{mmss(cap.seconds)}</span>
            </div>
          )}

          {cap.error && (
            <div className="absolute inset-x-0 bottom-0 px-5 py-4" style={{ background: "rgba(0,0,0,0.7)" }}>
              <p style={{ ...TYPE.small, color: "#fff", lineHeight: 1.5 }}>{cap.error}</p>
            </div>
          )}
        </div>

        {/* the shutter */}
        {cap.state !== "idle" && !cap.error && (
          <button onClick={shoot} className="mx-auto block active:opacity-80"
                  style={{ width: 68, height: 68, borderRadius: 999,
                           background: live ? DANGER : "#fff",
                           border: `3px solid ${live ? DANGER : t.ink}`,
                           boxShadow: ELEV.raise,
                           transition: "background 200ms, border-radius 200ms" }}>
            {live && <span className="block mx-auto" style={{ width: 22, height: 22, borderRadius: 4, background: "#fff" }} />}
          </button>
        )}

        {/* always available, whatever the camera does */}
        <button onClick={() => fileRef.current && fileRef.current.click()}
                className="w-full flex items-center justify-center gap-2 mt-5 active:opacity-70"
                style={{ minHeight: 50, borderRadius: R.control, border: `1px solid ${HAIR(t.ink, 0.18)}`,
                         ...TYPE.subhead, fontSize: 15, color: t.ink }}>
          <Paperclip size={15} strokeWidth={1.9} />
          {tr("Choose a file instead")}
        </button>
        <input ref={fileRef} type="file" accept="video/*,image/*,audio/*" multiple className="hidden"
               onChange={(e) => {
                 const files = Array.from(e.target.files || []);
                 files.forEach((f) => onAdd({
                   type: f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "photo",
                   file: f, name: f.name,
                 }));
                 if (files.length) { hapticCommit(); say && say(`${files.length} ${tr("added")}`); }
                 e.target.value = "";
               }} />

        {/* what's been captured so far */}
        {items && items.length > 0 && (
          <div className="mt-6">
            <div className="mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Captured")}</div>
            <Card>
              {items.map((it, i) => (
                <Row key={i} label={it.name || `${it.type} ${i + 1}`}
                     sub={it.type === "audio" ? tr("Voice note") : it.type === "video" ? tr("Clip") : tr("Photo")}
                     last={i === items.length - 1}
                     icon={<I C={it.type === "audio" ? Mic : it.type === "video" ? Play : ImageIcon} />}
                     onToggle={() => onDrop && onDrop(i)} />
              ))}
            </Card>
          </div>
        )}
      </div>
    </Sheet>
  );
}



/* THE COMMAND BAR

   From the research: Superhuman's Cmd+K, where searching and *doing*
   are the same box. Previously search only found things — you then had
   to navigate to the action separately. Now typing a name offers the
   things you'd want to do to that person, so "set a tip for Priya" is
   one field and one tap instead of five.

   Actions rank above content, because someone who opens a command bar
   usually wants to act rather than browse. */
function CommandBar({ role, cfg, roster, lessons, library, go, push, onAct, close }) {
  const t = useT();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const hit = (x) => (x || "").toLowerCase().includes(term);

  /* what a coach can do, and to whom */
  const VERBS = role === "coach" ? [
    { id: "log",     label: "Log a lesson",     Ico: Plus,          needsWho: false },
    { id: "tip",     label: "Set a tip for",    Ico: Lightbulb,     needsWho: true },
    { id: "drills",  label: "Set drills for",   Ico: ListChecks,    needsWho: true },
    { id: "message", label: "Message",          Ico: MessageCircle, needsWho: true },
    { id: "attend",  label: "Take attendance",  Ico: Check,         needsWho: false },
    { id: "capture", label: "Live capture",     Ico: Camera,        needsWho: false },
    { id: "comp",    label: "Add a competition", Ico: Trophy,       needsWho: false },
  ] : [
    { id: "request", label: "Request a lesson", Ico: Plus,          needsWho: false },
    { id: "clip",    label: "Send a clip",      Ico: Play,          needsWho: false },
  ];

  const people = term ? (roster || []).filter((r) => hit(r.name)) : [];

  /* a verb matches either by its own name, or because the typed text is
     a person and the verb takes one */
  const actions = [];
  VERBS.forEach((v) => {
    if (!term) { if (!v.needsWho) actions.push({ v, who: null }); return; }
    if (hit(v.label)) {
      if (v.needsWho) people.slice(0, 3).forEach((r) => actions.push({ v, who: r.name }));
      else actions.push({ v, who: null });
    } else if (v.needsWho) {
      people.slice(0, 2).forEach((r) => actions.push({ v, who: r.name }));
    }
  });

  const found = term ? (lessons || []).filter((l) => hit(l.focus)).slice(0, 3) : [];
  const drills = term ? (library || []).filter((d) => hit(d.t)).slice(0, 3) : [];

  const Line = ({ Ico, label, sub, tone, act, i }) => (
    <button onClick={() => { hapticCommit(); soft(); act(); }}
            className="w-full flex items-center gap-3.5 text-left active:opacity-60"
            style={{ minHeight: 58, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                     animation: `settle 260ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 30}ms both` }}>
      <span className="rounded-lg flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, background: tone ? `${tone}14` : t.wash }}>
        <Ico size={15} color={tone || t.sub} strokeWidth={1.8} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{label}</span>
        {sub && <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{sub}</span>}
      </span>
      <ArrowRight size={13} color={t.faint} />
    </button>
  );

  const Group = ({ title, children }) => (
    <div className="mb-5">
      <div className="mb-1 px-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{title}</div>
      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>{children}</div>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2.5 px-4 mb-5"
           style={{ minHeight: 50, borderRadius: R.control, background: t.wash }}>
        <Search size={16} color={t.faint} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={role === "coach" ? tr("Do something, or find anyone") : tr("Search")}
               className="flex-1 bg-transparent outline-none"
               style={{ ...TYPE.body, fontSize: 16, color: t.ink }} />
        {q && (
          <button onClick={() => { haptic(6); setQ(""); }} className="p-1 active:opacity-50" aria-label={tr("Clear")}>
            <X size={14} color={t.faint} />
          </button>
        )}
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {actions.length > 0 && (
          <Group title={term ? tr("Do this") : tr("Quick actions")}>
            {actions.slice(0, 6).map(({ v, who }, i) => (
              <Line key={v.id + (who || "")} i={i} Ico={v.Ico} tone={t.accent}
                    label={who ? `${tr(v.label)} ${who.split(" ")[0]}` : tr(v.label)}
                    act={() => onAct(v.id, who)} />
            ))}
          </Group>
        )}

        {people.length > 0 && (
          <Group title={cfg.nouns}>
            {people.slice(0, 4).map((r, i) => (
              <Line key={r.name} i={i} Ico={User} label={r.name}
                    sub={`${fileFor(r.name).done} ${tr("lessons")}`}
                    act={() => { close(); push("player:" + r.name); }} />
            ))}
          </Group>
        )}

        {found.length > 0 && (
          <Group title={tr("Lessons")}>
            {found.map((l, i) => (
              <Line key={l.id} i={i} Ico={Library} label={l.focus} sub={`${l.d} ${l.m}`}
                    act={() => { close(); push("lesson"); }} />
            ))}
          </Group>
        )}

        {drills.length > 0 && (
          <Group title={tr("Drills")}>
            {drills.map((d, i) => (
              <Line key={d.t} i={i} Ico={ListChecks} label={d.t}
                    act={() => { close(); push("library"); }} />
            ))}
          </Group>
        )}

        {term && actions.length + people.length + found.length + drills.length === 0 && (
          <p className="py-10 text-center" style={{ ...TYPE.body, color: t.faint }}>
            {tr("Nothing for that.")}
          </p>
        )}
      </div>
    </>
  );
}

/* ==================================================================
   THE LESSON FEED — the statement piece

   Vertical: one lesson per screen, snapped so you are never left
   between two. Horizontal: within a lesson, swipe through everything
   attached to it — clips, photos, launch-monitor readouts — all in the
   same frame, because they are all just evidence of the same session.

   Chrome is kept to two corners and one rail so nothing overlaps the
   photography.
================================================================== */

const seedOf = (str) => {
  let h = 2166136261;
  for (let i = 0; i < (str || "").length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};

/* Composed artwork for a lesson with nothing attached — seeded from
   its own content, so it never changes under you. */
function GeneratedField({ lesson, mark }) {
  const s = seedOf(lesson.focus + lesson.d + lesson.m);
  const angle = 120 + (s % 90);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0"
           style={{ background: `linear-gradient(${angle}deg, #0B0E0F 0%, ${mark} ${18 + (s % 22)}%, #0C0F10 100%)` }} />
      <div className="absolute inset-0"
           style={{ background: `radial-gradient(80% 55% at ${28 + (s % 40)}% ${30 + (s % 30)}%, ${mark}55 0%, transparent 70%)` }} />
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.16, mixBlendMode: "overlay" }}>
        <filter id={`gr${s % 9999}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" /></filter>
        <rect width="100%" height="100%" filter={`url(#gr${s % 9999})`} />
      </svg>
      <div className="absolute" style={{ left: -8, bottom: "30%", right: 0, overflow: "hidden" }}>
        <span style={{ fontFamily: display, fontSize: 76, fontWeight: 300, lineHeight: 0.92,
                       letterSpacing: "-0.045em", color: "#fff", opacity: 0.09, whiteSpace: "nowrap", display: "block" }}>
          {(lesson.focus || "").toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* One piece of evidence: a clip, a photo, or a readout.

   The video is driven from an effect, not an inline ref callback — an
   inline callback is a new function every render, so React detaches and
   reattaches the ref each time, which paused the clip on every state
   change and left a black frame. It also needs preload="auto" and an
   explicit load(), or nothing is painted until first play. */
function Evidence({ item, live, mark }) {
  const vid = useRef(null);
  const [tk, setTk] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = vid.current;
    if (!el) return;
    if (live) { const p = el.play(); if (p) p.catch(() => {}); }
    else el.pause();
  }, [live, item.url]);

  useEffect(() => {
    if (!live || item.type !== "sim") return;
    const x = setInterval(() => setTk((v) => (v + 1) % 100), 90);
    return () => clearInterval(x);
  }, [live, item.type]);

  if (item.type === "video") {
    return (
      <>
        {/* behind, so it can never hide the clip */}
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ background: "#0B0F10", zIndex: 0,
                      opacity: ready ? 0 : 1, transition: "opacity 420ms ease-out" }}>
          <span style={{ opacity: 0.45, animation: "markBreathe 3s ease-in-out infinite" }}>
            <Mark size={24} color={mark} />
          </span>
        </div>
        <video ref={vid} src={item.url} muted loop playsInline autoPlay preload="auto"
               onLoadedMetadata={() => setReady(true)}
               onLoadedData={() => setReady(true)}
               onCanPlay={() => setReady(true)}
               onPlaying={() => setReady(true)}
               onError={() => setFailed(true)}
               className="absolute inset-0 w-full h-full"
               style={{ objectFit: "cover", zIndex: 1 }} />
        {failed && (
          /* say so, rather than showing a blank frame forever */
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8" style={{ zIndex: 2, background: "#0B0F10" }}>
            <X size={22} color={DANGER} strokeWidth={2} />
            <span className="mt-3 text-center" style={{ ...TYPE.small, color: "rgba(255,255,255,0.8)" }}>
              {tr("This clip wouldn't play")}
            </span>
            <span className="mt-1 text-center" style={{ ...TYPE.caption, color: "rgba(255,255,255,0.45)" }}>
              {item.name || tr("Try an MP4")}
            </span>
            <button onClick={() => { haptic(8); setFailed(false); if (vid.current) vid.current.load(); }}
                    className="mt-4 px-4 active:opacity-60"
                    style={{ minHeight: 34, borderRadius: R.pill, border: "0.5px solid rgba(255,255,255,0.3)",
                             ...TYPE.caption, color: "#fff" }}>{tr("Try again")}</button>
          </div>
        )}
      </>
    );
  }

  if (item.type === "photo") {
    return (
      <>
        <div className="absolute inset-0" style={{ background: "#0B0F10", zIndex: 0,
               opacity: ready ? 0 : 1, transition: "opacity 420ms ease-out" }} />
        <img src={item.url} alt="" onLoad={() => setReady(true)} onError={() => setFailed(true)}
             className="absolute inset-0 w-full h-full"
             style={{ objectFit: "cover", zIndex: 1 }} />
      </>
    );
  }

  if (item.type === "data") {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#0B0F10" }}>
        <div className="w-full px-8">
          <div className="mb-5" style={{ ...TYPE.eyebrow, fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{item.device}</div>
          {item.rows.map((r, i) => (
            <div key={r[0]} className="flex items-baseline justify-between py-3"
                 style={{ borderBottom: "0.5px solid rgba(255,255,255,0.12)",
                          animation: live ? `settle 380ms cubic-bezier(.22,1,.36,1) ${i * 70}ms both` : "none" }}>
              <span style={{ ...TYPE.small, color: "rgba(255,255,255,0.6)" }}>{r[0]}</span>
              <span style={{ ...TYPE.figure, fontSize: 26, color: "#fff" }}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "#0C0F10" }} />
      <div className="absolute inset-0"
           style={{ background: `radial-gradient(70% 50% at ${45 + Math.sin(tk / 9) * 10}% ${42 + Math.cos(tk / 11) * 8}%, ${mark}4D 0%, transparent 72%), linear-gradient(180deg, ${mark}22 0%, #0A0D0E 78%)`,
                    transition: "background 220ms linear" }} />
      <div className="absolute" style={{ left: 0, right: 0, top: "46%", height: 1, background: `${mark}44` }} />
    </div>
  );
}


const FeedCard = React.memo(function FeedCard({ lesson, active, index, media, onOpen, near }) {
  const t = useT();
  const [frame, setFrame] = useState(0);
  const rail = useRef(null);
  const items = media && media.length ? media : [];
  const many = items.length > 1;

  const tick = useRef(0);
  const onRailScroll = (e) => {
    const el = e.currentTarget;
    if (tick.current) return;                 /* one read per frame, not per event */
    tick.current = requestAnimationFrame(() => {
      tick.current = 0;
      const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
      if (i !== frame) { setFrame(i); haptic(7); soft(); }
    });
  };

  return (
    <div data-feed-card={index} className="relative"
         style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always", overflow: "hidden" }}>

      {items.length === 0 || !near ? (
        <GeneratedField lesson={lesson} mark={t.mark} />
      ) : (
        <div ref={rail} onScroll={onRailScroll}
             className="absolute inset-0 flex overflow-x-auto"
             style={{ scrollSnapType: "x mandatory", overscrollBehaviorX: "contain", scrollbarWidth: "none" }}>
          {items.map((it, i) => (
            <div key={i} className="relative shrink-0"
                 style={{ width: "100%", height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}>
              <Evidence item={it} live={active && i === frame} mark={t.mark} />
            </div>
          ))}
        </div>
      )}

      {/* one scrim, deeper and reaching further, so type never fights
          the image — Nike's move is to let the photograph run and set
          the words in the clear space it leaves at the bottom */}
      <div className="absolute inset-x-0 bottom-0" aria-hidden="true"
           style={{ height: "64%", zIndex: 10,
                    background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0) 100%)" }} />

      <div className="absolute inset-x-0 bottom-0 px-6" style={{ paddingBottom: 108, zIndex: 25 }}>
        <span className="flex items-center gap-2.5" style={{ ...TYPE.eyebrow, fontSize: 9, letterSpacing: "0.18em",
                       color: "rgba(255,255,255,0.62)",
                       animation: active ? "fadeUp 460ms cubic-bezier(.22,1,.36,1) 60ms both" : "none" }}>
          <span>{lesson.d} {lesson.m}</span>
          <span className="rounded-full" style={{ width: 2.5, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
          <span>{lesson.type === "Group" ? tr("Group") : tr("Private")}</span>
          {lesson.coach && (<>
            <span className="rounded-full" style={{ width: 2.5, height: 2.5, background: "rgba(255,255,255,0.4)" }} />
            <span className="truncate" style={{ maxWidth: 120 }}>{lesson.coach}</span>
          </>)}
        </span>

        {/* the headline runs big and tight, the way Nike sets a drop */}
        <span className="block mt-3" style={{ ...TYPE.hero, fontSize: 46, lineHeight: 0.94, color: "#fff",
                       letterSpacing: "-0.035em", fontWeight: 300,
                       animation: active ? "fadeUp 540ms cubic-bezier(.22,1,.36,1) 130ms both" : "none" }}>
          {lesson.focus}
        </span>

        {lesson.note && (
          <span className="block mt-3.5" style={{ ...TYPE.body, lineHeight: 1.5, maxWidth: "88%",
                         color: "rgba(255,255,255,0.7)",
                         animation: active ? "fadeUp 540ms cubic-bezier(.22,1,.36,1) 200ms both" : "none" }}>
            {lesson.note}
          </span>
        )}

        <button onClick={() => { hapticCommit(); soft(); onOpen && onOpen(lesson); }}
                onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                className="inline-flex items-center gap-2 mt-6 px-6 active:opacity-90"
                style={{ minHeight: 48, borderRadius: R.pill, background: "#fff", willChange: "transform",
                         boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                         transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)",
                         animation: active ? "fadeUp 540ms cubic-bezier(.22,1,.36,1) 280ms both" : "none" }}>
          <span style={{ ...TYPE.small, fontWeight: 600, color: "#111" }}>{tr("Open lesson")}</span>
          <ArrowRight size={15} color="#111" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
});

function LessonFeed({ lessons, mediaFor, view, setView, onOpen, onPickFiles, loaded }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const [prog, setProg] = useState(0);        // 0..1 through the whole feed
  const wrap = useRef(null);

  useEffect(() => {
    const root = wrap.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = Number(e.target.getAttribute("data-feed-card"));
        setActive((prev) => { if (prev !== i) { haptic(10); soft(); } return i; });
      });
    }, { root, threshold: 0.6, rootMargin: "-30% 0px -30% 0px" });
    root.querySelectorAll("[data-feed-card]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [lessons.length]);

  const VIEWS = [
    { id: "feed",  Ico: Play },
    { id: "cards", Ico: Library },
    { id: "list",  Ico: ListChecks },
  ];

  return (
    <div className="absolute inset-0" style={{ background: "#0A0D0E" }}>

      <div className="absolute inset-x-0 pointer-events-none" aria-hidden="true"
           style={{ top: 0, height: 104, zIndex: 20,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }} />

      {/* TEST CONTROL — not part of the product. Sits here because this
          is the screen it loads into. */}
      {onPickFiles && (
        <label className="absolute flex items-center gap-1.5 px-3"
               style={{ top: 70, left: 18, height: 28, borderRadius: 14, zIndex: 30, cursor: "pointer",
                        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                        border: `0.5px dashed rgba(255,255,255,0.4)` }}>
          <Plus size={12} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
          <span style={{ ...TYPE.caption, fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
            {tr("Test media")}{loaded ? ` · ${loaded}` : ""}
          </span>
          <input type="file" accept="video/*,image/*,audio/*" multiple className="hidden"
                 onChange={(e) => { onPickFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        </label>
      )}

      {/* the three views, top left, frosted */}
      <div className="absolute flex gap-0.5 p-1" style={{ top: 28, left: 18, zIndex: 30, borderRadius: 16,
             background: "rgba(0,0,0,0.4)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
             border: "0.5px solid rgba(255,255,255,0.16)" }}>
        {VIEWS.map((v) => {
          const on = view === v.id;
          return (
            <button key={v.id} onClick={() => { hapticCommit(); soft(); setView(v.id); }}
                    className="flex items-center justify-center active:opacity-70"
                    style={{ width: 30, height: 26, borderRadius: 13,
                             background: on ? "rgba(255,255,255,0.92)" : "transparent",
                             transition: "background 220ms" }}
                    aria-label={v.id}>
              <v.Ico size={13} strokeWidth={2} color={on ? "#111" : "rgba(255,255,255,0.7)"} />
            </button>
          );
        })}
      </div>

      <div ref={wrap} className="absolute inset-0 overflow-y-auto"
           style={{ scrollSnapType: "y mandatory", overscrollBehaviorY: "contain", scrollbarWidth: "none",
                    WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}>
        {lessons.map((l, i) => (
          <FeedCard key={l.id ?? i} index={i} lesson={l} active={i === active}
                    near={Math.abs(i - active) <= 1}
                    media={mediaFor(l, i)} onOpen={onOpen} />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none" aria-hidden="true"
           style={{ height: 168, zIndex: 20,
                    background: "linear-gradient(to top, #0A0D0E 12%, rgba(10,13,14,0.75) 50%, transparent 100%)" }} />
    </div>
  );
}




/* One control, used in the feed and on the list screen, so the three
   views read as equals wherever you meet them. */
function ViewSwitch({ view, setView, onDark }) {
  const t = useT();
  const opts = [
    { id: "feed",  Ico: Play,       label: "Feed" },
    { id: "cards", Ico: Library,    label: "Cards" },
    { id: "list",  Ico: ListChecks, label: "List" },
  ];
  return (
    <div className="flex gap-1 p-1" style={{ borderRadius: R.pill,
           background: onDark ? "rgba(255,255,255,0.14)" : t.wash,
           backdropFilter: onDark ? "blur(14px)" : "none", WebkitBackdropFilter: onDark ? "blur(14px)" : "none" }}>
      {opts.map((o) => {
        const on = view === o.id;
        return (
          <button key={o.id} onClick={() => { haptic(9); soft(); setView(o.id); }}
                  className="flex items-center gap-1.5 px-3.5 active:opacity-70"
                  style={{ minHeight: 34, borderRadius: R.pill,
                           background: on ? (onDark ? "rgba(255,255,255,0.92)" : t.surface) : "transparent",
                           boxShadow: on && !onDark ? ELEV.rest : "none",
                           transition: "background 220ms" }}>
            <o.Ico size={13} strokeWidth={2}
                   color={on ? (onDark ? "#111" : t.accent) : (onDark ? "rgba(255,255,255,0.7)" : t.faint)} />
            <span style={{ ...TYPE.caption, fontWeight: 500,
                           color: on ? (onDark ? "#111" : t.ink) : (onDark ? "rgba(255,255,255,0.7)" : t.faint) }}>
              {tr(o.label)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* OPENING A LESSON

   A held beat between the feed and the record. Not a spinner — a
   spinner says "wait". This says "here is the one you asked for":
   the two Nosca rings draw themselves and close around the focus,
   the date rises beneath, and it clears. About 900ms, once.

   It exists because opening a lesson from the feed is the single
   moment the app most wants to feel considered. */
function LessonOverture({ lesson, coach, mark, onDone }) {
  const t = useT();
  useEffect(() => {
    hapticCommit();
    const t1 = setTimeout(() => { haptic(9); swell(); }, 300);      // mark lands
    const t2 = setTimeout(() => haptic(7), 720);                     // date
    const t3 = setTimeout(() => haptic(11), 1020);                   // the focus
    const t4 = setTimeout(() => hapticSuccess(), 1420);              // the rule closes
    const t5 = setTimeout(() => onDone && onDone(), 1680);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-10"
         style={{ zIndex: 90, background: "#0A0D0E",
                  animation: "overtureOut 340ms cubic-bezier(.4,0,1,1) 1340ms both" }}>

      {/* a slow wash of the sport's colour, coming up under everything */}
      <div className="absolute inset-0" aria-hidden="true"
           style={{ background: `radial-gradient(70% 45% at 50% 46%, ${mark}2E 0%, transparent 72%)`,
                    animation: "fadeIn 620ms ease-out both" }} />

      {/* the mark, drawn rather than placed */}
      <span className="relative mb-8" style={{ animation: "overtureMark 900ms cubic-bezier(.22,1,.36,1) both" }}>
        <Mark size={34} color={mark} />
      </span>

      <span className="relative text-center" style={{ ...TYPE.eyebrow, fontSize: 9, color: `${mark}`,
                     animation: "fadeUp 560ms cubic-bezier(.22,1,.36,1) 320ms both" }}>
        {lesson.d} {lesson.m}
      </span>

      <h2 className="relative text-center mt-3"
          style={{ ...TYPE.hero, fontSize: 34, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#fff",
                   animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) 620ms both" }}>
        {lesson.focus}
      </h2>

      {/* a hairline that draws across, the last thing before it clears */}
      <span className="relative mt-7" style={{ height: 1, width: 64, background: `${mark}`,
                     transformOrigin: "center",
                     animation: "ruleDraw 640ms cubic-bezier(.22,1,.36,1) 900ms both" }} />
    </div>
  );
}

/* ATTENDANCE, ON ITS OWN

   One screen, the same for both sides. A ring at the top says the
   whole story in a glance; the list underneath is only there if you
   want it. Nobody has to come here — it is a record, not a chore.

   A coach decides in Settings whether it applies at all, and to which
   kind of lesson. Plenty of coaches never take a register; for them
   this simply doesn't exist. */
function AttendanceScreen({ role, cfg, records, rule, pop }) {
  const t = useT();
  const rows = records || [];
  const present = rows.filter((r) => r.state === "in").length;
  const total = rows.length;
  const pct = total ? Math.round((present / total) * 100) : 100;

  /* the ring */
  const R0 = 46, C = 2 * Math.PI * R0;
  const tone = pct >= 90 ? STEADY : pct >= 75 ? CAUTION : DANGER;

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Attendance")} onBack={pop}
              meta={rule === "off" ? tr("Not being taken") : total ? `${total} ${tr("lessons")}` : ""}>
        <div className="px-6 pb-2">

          {rule === "off" ? (
            <p className="py-14 text-center" style={{ ...TYPE.body, color: t.faint }}>
              {role === "coach" ? tr("You've turned registers off.") : tr("Your coach doesn't take a register.")}
            </p>
          ) : (
            <>
              {/* one number, said plainly */}
              <div className="flex flex-col items-center py-6">
                <span className="relative flex items-center justify-center"
                      style={{ width: 128, height: 128 }}>
                  <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="64" cy="64" r={R0} fill="none" stroke={HAIR(t.ink, 0.12)} strokeWidth="7" />
                    <circle cx="64" cy="64" r={R0} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round"
                            strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100}
                            style={{ animation: "ringDraw 900ms cubic-bezier(.22,1,.36,1) both" }} />
                  </svg>
                  <span className="absolute flex flex-col items-center">
                    <span style={{ ...TYPE.figure, fontSize: 34, color: t.ink,
                                   animation: "countIn 520ms cubic-bezier(.28,1.4,.5,1) 260ms both" }}>{pct}</span>
                    <span style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{tr("Per cent")}</span>
                  </span>
                </span>
                <span className="mt-4" style={{ ...TYPE.small, color: t.sub }}>
                  {present} {tr("of")} {total} {tr("lessons attended")}
                </span>
              </div>

              {/* the record, if anyone wants it */}
              {total > 0 && (
                <div className="mt-4" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-3.5 py-3.5"
                         style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                                  animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 10) * 30}ms both` }}>
                      <span className="shrink-0" style={{ width: 54, ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>
                        {r.date}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{r.who}</span>
                        <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{r.kind}</span>
                      </span>
                      {r.state === "in"
                        ? <Check size={16} color={STEADY} strokeWidth={2.4} />
                        : <X size={15} color={DANGER} strokeWidth={2.4} />}
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-6 pb-4" style={{ ...TYPE.caption, lineHeight: 1.6, color: t.faint }}>
                {rule === "private" ? tr("Taken for private lessons only.")
                  : rule === "group" ? tr("Taken for group lessons only.")
                  : tr("Taken for every lesson.")}
              </p>
            </>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* THE COACH'S PROFILE — SEEN BY A PLAYER

   Who they are, and one honest way to say something about them —
   whenever the player chooses to, not only when asked. A five-star tap
   and an optional line, nothing more ceremonial than that. */
function CoachProfile({ coachName, sport, reviewSummary, myReview, onSubmitReview, onMessage, juvenile, pop }) {
  const t = useT();
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!rating) return;
    hapticCommit(); soft();
    onSubmitReview(rating, comment.trim());
    setSent(true);
  };

  return (
    <SwipeBack onBack={pop}>
      <Screen title={coachName || tr("Your coach")} onBack={pop}
              meta={reviewSummary ? `${reviewSummary.average.toFixed(1)} ★ · ${reviewSummary.count} ${reviewSummary.count === 1 ? tr("review") : tr("reviews")}` : ""}>
        <div className="px-6">
          <div className="flex flex-col items-center py-6 mb-2">
            <Avatar name={coachName || "?"} size={64} />
            <span className="mt-4" style={{ fontFamily: display, fontSize: 22, letterSpacing: "-0.02em", color: t.ink }}>
              {coachName || tr("Your coach")}
            </span>
            {sport && <span className="mt-1" style={{ ...TYPE.small, color: t.faint }}>{SPORTS[sport]?.label || sport}</span>}
          </div>

          {!juvenile && (
            <button onClick={() => { haptic(8); soft(); onMessage(); }}
                    className="w-full flex items-center justify-center gap-2 mb-8 active:opacity-80"
                    style={{ minHeight: 50, borderRadius: R.control, border: `1px solid ${HAIR(t.ink, 0.18)}`,
                             ...TYPE.subhead, fontSize: 15, color: t.ink }}>
              <MessageCircle size={15} strokeWidth={1.9} />
              {tr("Message")}
            </button>
          )}

          {!juvenile && (
            <div className="pt-2" style={{ borderTop: `1px solid ${HAIR(t.ink, 0.14)}` }}>
              <Eyebrow>{myReview ? tr("Your review") : tr("Leave a review")}</Eyebrow>
              <div className="flex items-center justify-center gap-2 py-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => { haptic(6); setRating(n); setSent(false); }} className="active:opacity-60">
                    <Star size={30} strokeWidth={1.6} color={n <= rating ? "#D4A017" : t.hair}
                          fill={n <= rating ? "#D4A017" : "none"} />
                  </button>
                ))}
              </div>
              <VoiceInput value={comment} onChange={(v) => { setComment(v); setSent(false); }}
                          ph={tr("Anything you'd want other players to know (optional)")} rows={3} />
              <button onClick={submit} disabled={!rating || (sent && comment === (myReview?.comment || "") && rating === myReview?.rating)}
                      className="w-full mt-4 active:opacity-80 disabled:opacity-30"
                      style={{ minHeight: 50, borderRadius: R.control, background: t.ink, color: "#fff",
                               ...TYPE.subhead, fontSize: 15 }}>
                {sent ? tr("Saved") : myReview ? tr("Update review") : tr("Submit review")}
              </button>
            </div>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* PREFERENCES

   Durable display, notification and privacy choices live here; the
   things you change constantly stay inline on the screen they affect.
   That split is the whole point — a settings screen people visit once
   and then forget, rather than a dumping ground. */
const PREF_DEFAULTS = {
  logView:    "feed",     // feed · cards · list
  calView:    "list",     // list · grid
  notify:     "instant",  // instant · digest · quiet
  quietFrom:  "9:00 pm",
  showRecord: true,       // let others see lesson count on your profile
  showComps:  true,       // and your upcoming competitions
  reduceData: false,      // don't preload media on cellular
  attendance: "all",      // all · private · group · off
  askForReview: true,     // prompt once, on a player's first lesson only
};

function Preferences({ prefs, setPrefs, role, cfg, pop, say }) {
  const t = useT();
  const set = (k, v) => { haptic(8); soft(); setPrefs((p) => ({ ...p, [k]: v })); };

  const Choice = ({ label, sub, k, options }) => (
    <div className="py-4" style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
      <span className="block" style={{ ...TYPE.body, color: t.ink }}>{label}</span>
      {sub && <span className="block mt-0.5 mb-3" style={{ ...TYPE.caption, color: t.faint }}>{sub}</span>}
      <div className="flex gap-1.5 mt-2.5 p-1" style={{ borderRadius: R.pill, background: t.wash }}>
        {options.map((o) => {
          const on = prefs[k] === o.id;
          return (
            <button key={o.id} onClick={() => set(k, o.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 active:opacity-70"
                    style={{ minHeight: 38, borderRadius: R.pill,
                             background: on ? t.surface : "transparent",
                             boxShadow: on ? ELEV.rest : "none",
                             transition: "background 200ms, box-shadow 200ms" }}>
              {o.Ico && <o.Ico size={13} color={on ? t.accent : t.faint} strokeWidth={1.9} />}
              <span style={{ ...TYPE.caption, fontWeight: 500, color: on ? t.ink : t.faint }}>{tr(o.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const Switch = ({ label, sub, k }) => (
    <button onClick={() => set(k, !prefs[k])}
            className="w-full flex items-center gap-3 py-4 text-left active:opacity-60"
            style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ ...TYPE.body, color: t.ink }}>{label}</span>
        {sub && <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{sub}</span>}
      </span>
      <span className="rounded-full shrink-0 relative"
            style={{ width: 46, height: 28, background: prefs[k] ? STEADY : HAIR(t.ink, 0.22),
                     transition: "background 240ms cubic-bezier(.22,1,.36,1)" }}>
        <span className="absolute rounded-full"
              style={{ width: 22, height: 22, top: 3, left: prefs[k] ? 21 : 3, background: "#fff",
                       boxShadow: ELEV.rest,
                       transition: "left 260ms cubic-bezier(.34,1.56,.64,1)" }} />
      </span>
    </button>
  );

  const Head = ({ children }) => (
    <div className="mt-7 mb-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{children}</div>
  );

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("How it works")} onBack={pop} meta={tr("Yours alone")}>
        <div className="px-6 pb-2">

          <Head>{tr("Lessons")}</Head>
          <Choice k="logView" label={tr("Lesson log")}
                  sub={tr("How your history is shown")}
                  options={[
                    { id: "feed",  label: "Immersive", Ico: Play },
                    { id: "cards", label: "Cards",     Ico: Library },
                    { id: "list",  label: "List",      Ico: ListChecks },
                  ]} />

          <Head>{tr("Diary")}</Head>
          <Choice k="calView" label={tr("Default view")}
                  sub={tr("What opens when you tap Diary")}
                  options={[
                    { id: "list", label: "List",     Ico: ListChecks },
                    { id: "grid", label: "Calendar", Ico: CalendarDays },
                  ]} />

          <Head>{tr("Notifications")}</Head>
          <Choice k="notify" label={tr("When to tell you")}
                  options={[
                    { id: "instant", label: "As they happen" },
                    { id: "digest",  label: "Once a day" },
                    { id: "quiet",   label: "Only urgent" },
                  ]} />
          {prefs.notify === "quiet" && (
            <p className="py-3" style={{ ...TYPE.caption, color: t.faint,
                       animation: "contentRise 300ms cubic-bezier(.22,1,.36,1) both" }}>
              {tr("Cancellations and weather call-offs still come through.")}
            </p>
          )}

          <Head>{tr("What others see")}</Head>
          <Switch k="showRecord" label={tr("Lessons taken")}
                  sub={tr("On your profile, when someone finds you")} />
          <Switch k="showComps" label={tr("Upcoming competitions")} />

          {role === "coach" && (<>
            <Head>{tr("Registers")}</Head>
            <Choice k="attendance" label={tr("Take attendance")}
                    sub={tr("Plenty of coaches never do")}
                    options={[
                      { id: "all",     label: "Every lesson" },
                      { id: "private", label: "Private" },
                      { id: "group",   label: "Group" },
                      { id: "off",     label: "Never" },
                    ]} />
            <Switch k="askForReview" label={tr("Ask for a review")}
                    sub={tr("Once, after a player's first lesson")} />
          </>)}

          <Head>{tr("Data")}</Head>
          <Switch k="reduceData" label={tr("Save data")}
                  sub={tr("Don't load video until you tap it")} />

          <p className="mt-7 pb-4" style={{ ...TYPE.caption, lineHeight: 1.6, color: t.faint }}>
            {tr("These are yours. Nobody you coach — or who coaches you — can change them.")}
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* ==================================================================
   TILES
   Lists of bare text separated by hairlines read as a spreadsheet.
   These give each item its own surface — compartmentalised, with a
   quiet border and a lift on press — without becoming heavy.
================================================================== */
function Tile({ children, onPress, accent, className = "", style = {}, delay = 0 }) {
  const t = useT();
  const Comp = onPress ? "button" : "div";
  return (
    <Comp onClick={onPress ? () => { haptic(7); soft(); onPress(); } : undefined}
          onPointerDown={onPress ? (e) => { e.currentTarget.style.transform = "scale(0.97)"; } : undefined}
          onPointerUp={onPress ? (e) => { e.currentTarget.style.transform = "scale(1)"; } : undefined}
          onPointerLeave={onPress ? (e) => { e.currentTarget.style.transform = "scale(1)"; } : undefined}
          className={`w-full text-left ${className}`}
          /* A single surface. Where something needs emphasis it gets a
             faint wash of the accent rather than a stripe beside it —
             one idea per box reads calmer and more expensive. */
          /* No outline unless it is carrying meaning. Whitespace and a
             hairline do the grouping; a border is reserved for emphasis. */
          style={{ background: accent ? `${accent}0E` : t.surface, borderRadius: R.surface,
                   position: "relative", overflow: "hidden", zIndex: 1,
                   border: accent ? `1px solid ${accent}2E` : "1px solid transparent",
                   boxShadow: accent ? "none" : ELEV.rest,
                   transition: "transform 140ms cubic-bezier(.22,1,.36,1)", willChange: "transform",
                   animation: `liftIn 420ms cubic-bezier(.22,1,.36,1) ${delay}ms both`, ...style }}>
      {/* one pass of light as it arrives, never again */}
      {accent && (
        <span className="absolute pointer-events-none" aria-hidden="true"
              style={{ inset: 0, background: `linear-gradient(105deg, transparent 40%, ${accent}22 50%, transparent 60%)`,
                       animation: `shimmerOnce 1100ms cubic-bezier(.3,0,.4,1) ${delay + 260}ms both` }} />
      )}
      {children}
    </Comp>
  );
}

/* A small figure with a caption. Used wherever numbers matter. */
function Stat({ value, label, tone, wide }) {
  const t = useT();
  return (
    <div className="flex-1 px-3.5 py-3" style={{ minWidth: wide ? 0 : 74 }}>
      <div style={{ ...TYPE.figure, fontSize: 21,
                    color: tone || t.ink, animation: "figureCount 600ms cubic-bezier(.22,1,.36,1) both" }}>{value}</div>
      <div className="mt-1.5 uppercase truncate" style={{ fontFamily: ui, fontSize: 8.5, letterSpacing: "0.16em", color: t.faint }}>{label}</div>
    </div>
  );
}

/* How long until something, in words a person would use. */
function untilText(hoursFromNow) {
  if (hoursFromNow < 0) return tr("Finished");
  if (hoursFromNow < 1) return `${Math.round(hoursFromNow * 60)} ${tr("min away")}`;
  const h = Math.floor(hoursFromNow), m = Math.round((hoursFromNow - h) * 60);
  return m ? `${h}h ${m}m ${tr("away")}` : `${h}h ${tr("away")}`;
}

/* ==================================================================
   CELEBRATION
   The Nosca mark completing itself: the two rings snap in, the link
   draws, and a tick strokes through. Energetic in timing, restrained
   in colour — a moment of lift that still looks like the brand.
================================================================== */
function Celebration({ label, sub, onDone, tone = "accent" }) {
  useEffect(() => { hapticSuccess(); const x = setTimeout(() => haptic(10), 380); return () => clearTimeout(x); }, []);
  const t = useT();
  const colour = tone === "accent" ? t.accent : tone;
  useEffect(() => {
    hapticSuccess();
    swell();
    const x = setTimeout(() => onDone && onDone(), 1750);
    return () => clearTimeout(x);
  }, [onDone]);

  const R = 8.6, CIRC = 2 * Math.PI * R;
  const sparks = [[-42,-30],[40,-26],[-30,34],[34,32],[0,-48],[-52,4],[50,10]];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" aria-live="polite"
         style={{ zIndex: 70, background: `${t.page}F2`, backdropFilter: "blur(6px)",
                  animation: "celebFade 1750ms ease both" }}>
      {/* halo pushing out from the mark */}
      <span className="absolute rounded-full" aria-hidden="true"
            style={{ width: 150, height: 150, border: `1.5px solid ${colour}`,
                     animation: "haloOut 1100ms cubic-bezier(.2,.6,.3,1) 120ms both" }} />
      {sparks.map(([dx, dy], i) => (
        <span key={i} className="absolute rounded-full" aria-hidden="true"
              style={{ width: 5, height: 5, background: colour, "--dx": `${dx}px`, "--dy": `${dy}px`,
                       animation: `spark 900ms cubic-bezier(.2,.6,.3,1) ${180 + i * 45}ms both` }} />
      ))}

      <svg width={128} height={80} viewBox="0 0 40 25" style={{ overflow: "visible",
             animation: "ringPop 620ms cubic-bezier(.22,1,.36,1) both" }}>
        <circle cx="14" cy="12.5" r={R} fill="none" stroke={t.ink} strokeWidth={1.6} opacity={0.22} />
        <circle cx="26" cy="12.5" r={R} fill="none" stroke={t.ink} strokeWidth={1.6} opacity={0.22} />
        <path d="M19.6 5.7 A 8.6 8.6 0 0 1 19.6 19.3" fill="none" stroke={colour} strokeWidth={1.6} strokeLinecap="round"
              style={{ strokeDasharray: 27, strokeDashoffset: 27,
                       animation: "tickDraw 520ms cubic-bezier(.35,0,.15,1) 380ms both" }} />
        {/* the tick, struck through the middle */}
        <path d="M15.4 12.9 L18.7 16.2 L25 9.6" fill="none" stroke={colour} strokeWidth={2.1}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 16, strokeDashoffset: 16,
                       animation: "tickDraw 460ms cubic-bezier(.35,0,.15,1) 700ms both" }} />
      </svg>

      <div className="mt-7 px-10 text-center" style={{ animation: "labelUp 620ms cubic-bezier(.34,1.56,.64,1) 880ms both" }}>
        <div style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.028em", color: t.ink }}>{label}</div>
        {sub && <div className="mt-2" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{sub}</div>}
      </div>
    </div>
  );
}

/* Lessons per month. Small, quiet, and honest about the empty ones —
   a gap in August is information, not something to hide. */
function MonthlyBars({ data, accent }) {
  const t = useT();
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className="flex items-end gap-2" style={{ height: 74 }}>
      {data.map(([m, n], i) => (
        <div key={m} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full rounded-md" style={{ height: `${Math.max(3, (n / max) * 52)}px`,
                 background: n ? (accent || t.accent) : t.hair, opacity: n ? 1 : 0.6,
                 transformOrigin: "bottom", animation: `barGrow 620ms cubic-bezier(.22,1,.36,1) ${i * 70}ms both` }} />
          <span style={{ fontFamily: ui, fontSize: 9, color: t.faint }}>{m}</span>
        </div>
      ))}
    </div>
  );
}

/* After a lesson lands, the player can say how it went. Reviews sit on
   the coach's profile, which is what a new player looks at first. */
function RateLesson({ focus, coach, onDone, close }) {
  const t = useT();
  const [score, setScore] = useState(0);
  const [note, setNote] = useState("");
  const tags = [tr("Clear"), tr("Encouraging"), tr("Well paced"), tr("Challenging"), tr("Practical")];
  const [picked, setPicked] = useState([]);
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{tr("Rate it")}</h2>
      <p className="mb-6" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{focus} · {coach}</p>

      <div className="flex justify-center gap-2.5 mb-7">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= score;
          return (
            <button key={n} onClick={() => { haptic(8); soft(); setScore(n); }}
                    className="rounded-full flex items-center justify-center active:opacity-60"
                    style={{ width: 48, height: 48, background: on ? STEADY : t.wash,
                             transition: "background 200ms, transform 200ms",
                             transform: on ? "scale(1.06)" : "scale(1)" }} aria-label={`${n}`}>
              <span style={{ fontFamily: display, fontSize: 18, color: on ? t.onAccent : t.faint }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tags.map((tg, i) => {
          const on = picked.includes(tg);
          return (
            <button key={tg} onClick={() => { haptic(6); setPicked(on ? picked.filter((x) => x !== tg) : [...picked, tg]); }}
                    className="px-3.5 active:opacity-60"
                    style={{ minHeight: 38, borderRadius: R.pill, background: on ? t.ink : t.surface,
                             border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 12.5,
                             fontWeight: 600, color: on ? "#fff" : t.sub,
                             animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>{tg}</button>
          );
        })}
      </div>

      <div className="mb-5"><VoiceArea value={note} onChange={setNote} rows={2} ph={tr("Anything else? Optional.")} /></div>
      <Button disabled={!score} onClick={() => { onDone({ score, tags: picked, note }); close(); }}>{tr("Send to your coach")}</Button>
      
    </>
  );
}

/* Set straight after a lesson, while the coach is still thinking about
   the person rather than the diary. */
function GoalSheet({ name, cfg, onSave, close }) {
  const t = useT();
  const [text, setText] = useState("");
  const [by, setBy] = useState("");
  const suggestions = [
    tr("Play a full round without a blow-up hole"),
    tr("Be consistent under pressure"),
    `${tr("Improve")} ${cfg.focus[0].label.toLowerCase()}`,
    tr("Enter a first competition"),
  ];
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>
        {tr("Goal for")} {(name || "").split(" ")[0]}
      </h2>
      

      {!text && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((sg, i) => (
            <button key={sg} onClick={() => { haptic(6); soft(); setText(sg); }} className="px-3.5 active:opacity-60"
                    style={{ minHeight: 38, borderRadius: R.pill, background: t.wash, fontFamily: ui, fontSize: 12.5, color: t.sub,
                             animation: `fadeUp 360ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>{sg}</button>
          ))}
        </div>
      )}

      <div className="mb-4"><VoiceArea value={text} onChange={setText} rows={2} ph={tr("The goal")} /></div>
      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("By when")}</div>
      <div className="flex flex-wrap gap-2 mb-6">
        {[tr("End of month"), tr("End of season"), tr("3 months"), tr("This year")].map((w) => {
          const on = by === w;
          return (<button key={w} onClick={() => { haptic(6); setBy(w); }} className="px-3.5 active:opacity-60"
                          style={{ minHeight: 40, borderRadius: R.pill, background: on ? t.ink : t.surface,
                                   border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 12.5,
                                   fontWeight: 600, color: on ? "#fff" : t.sub, transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>{w}</button>);
        })}
      </div>
      <Button disabled={!text.trim() || !by} onClick={() => { onSave(name, text.trim(), by); close(); }}>{tr("Set the goal")}</Button>
    </>
  );
}

/* Starting a conversation. A player can only reach a coach they are
   actually connected to, and a coach only their own roster — the list
   is the safeguard, not a search box over every user. */
function NewThread({ role, roster, conns, onPick, close }) {
  const t = useT();
  const [q, setQ] = useState("");
  const people = role === "coach"
    ? roster.map((r) => ({ name: r.name, sub: `${r.lessons} ${tr("lessons")}` }))
    : conns.map((c) => ({ name: c.coach, sub: `${SPORTS[c.sport].label} · ${c.club}` }));
  const term = q.trim().toLowerCase();
  const shown = people.filter((p) => !term || p.name.toLowerCase().includes(term));
  return (
    <>
      <h2 className="mb-4" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{tr("New message")}</h2>
      <div className="flex items-center gap-2.5 px-4 mb-4" style={{ minHeight: 46, borderRadius: R.surface, background: t.wash }}>
        <Search size={15} color={t.faint} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search")} className="flex-1 outline-none"
               style={{ fontFamily: ui, fontSize: 15, color: t.ink, background: "transparent" }} />
        {q && <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={14} color={t.faint} /></button>}
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("Nothing found.")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((p, i) => (
            <Tile key={p.name} className="px-4 py-3.5" delay={i * 45} onPress={() => { onPick(p.name); close(); }}>
              <div className="flex items-center gap-3.5">
                <Avatar name={p.name} size={38} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{p.name}</span>
                  <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{p.sub}</span>
                </span>
                <ChevronRight size={15} color={t.faint} />
              </div>
            </Tile>
          ))}
        </div>
      )}
    </>
  );
}

/* The player says what they'd like to work on next; the coach confirms
   or changes it. Agreed focus is what both then see against the
   booking, so nobody turns up guessing. */
function SuggestFocus({ cfg, onSend, close }) {
  const t = useT();
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState("");
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{tr("Next time")}</h2>
      
      <div className="flex flex-wrap gap-2 mb-5">
        {cfg.focus.map((f, i) => {
          const on = pick === f.id;
          return (
            <button key={f.id} onClick={() => { haptic(7); soft(); setPick(f.id); }} className="px-4 active:opacity-60"
                    style={{ minHeight: 44, borderRadius: R.pill, background: on ? t.accent : t.surface,
                             border: `1px solid ${on ? t.accent : t.hair}`, fontFamily: ui, fontSize: 13.5,
                             fontWeight: 600, color: on ? t.onAccent : t.sub,
                             transition: "background 220ms cubic-bezier(.22,1,.36,1), transform 220ms cubic-bezier(.34,1.56,.64,1)", transform: on ? "scale(1.03)" : "scale(1)",
                             animation: `fadeUp 360ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>{f.label}</button>
          );
        })}
      </div>
      <div className="mb-5"><VoiceArea value={note} onChange={setNote} rows={2} ph={tr("Anything specific? Optional.")} /></div>
      <Button disabled={!pick} onClick={() => { onSend(cfg.focus.find((f) => f.id === pick).label, note); close(); }}>
        {tr("Send the suggestion")}
      </Button>
    </>
  );
}

/* A suggestion waiting on the coach. Accept keeps it, or they pick
   something else — either way both sides end up with the same answer. */
function FocusRequest({ req, cfg, onAccept, onChange }) {
  const t = useT();
  const [alt, setAlt] = useState(null);
  return (
    <Tile accent={t.accent} className="px-5 py-4 mb-3">
      <div className="flex items-center gap-3 mb-3">
        <Sparkles size={16} color={t.accent} strokeWidth={2} />
        <span className="flex-1" style={{ fontFamily: ui, fontSize: 12.5, color: t.sub }}>
          {req.who.split(" ")[0]} {tr("would like to work on")}
        </span>
      </div>
      <div style={{ ...TYPE.heading, color: t.ink }}>{req.focus}</div>
      {req.note && <p className="mt-2" style={{ fontFamily: ui, fontSize: 13, lineHeight: 1.55, color: t.sub }}>{req.note}</p>}

      {alt === null ? (
        <div className="flex gap-2.5 mt-4">
          <button onClick={() => { haptic(8); setAlt("choose"); }} className="px-4 active:opacity-60"
                  style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}`,
                           fontFamily: ui, fontSize: 13.5, fontWeight: 500, color: t.sub }}>{tr("Something else")}</button>
          <button onClick={() => { hapticSuccess(); onAccept(req, req.focus); }} className="flex-1 active:opacity-75"
                  style={{ minHeight: 44, borderRadius: R.control, background: STEADY,
                           fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>{tr("Agree")}</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-4" style={{ animation: "liftIn 320ms cubic-bezier(.22,1,.36,1) both" }}>
          {cfg.focus.map((f) => (
            <button key={f.id} onClick={() => { hapticSuccess(); onChange(req, f.label); }} className="px-3.5 active:opacity-60"
                    style={{ minHeight: 40, borderRadius: R.pill, background: t.surface, border: `1px solid ${t.hair}`,
                             fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{f.label}</button>
          ))}
        </div>
      )}
    </Tile>
  );
}

/* Calling lessons off for weather. Two deliberate steps, because an
   accidental cancellation costs a coach their day and their players
   their evening. Whole day or a single lesson, and everyone affected
   is offered a new time straight away. */
function WeatherCallOff({ day, bookings, duration, onConfirm, close }) {
  const t = useT();
  const [scope, setScope] = useState(null);     // day | one
  const [pick, setPick] = useState(null);
  const [stage, setStage] = useState("choose"); // choose | confirm
  const affected = scope === "day" ? bookings : bookings.filter((b) => b.time === pick);

  if (stage === "confirm") return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: `${DANGER}14` }}>
          <Radio size={18} color={DANGER} strokeWidth={2} />
        </span>
        <h2 style={{ fontFamily: display, fontSize: 22, letterSpacing: "-0.025em", color: t.ink }}>{tr("Confirm")}</h2>
      </div>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.6, color: t.sub }}>
        {affected.length} {affected.length === 1 ? tr("lesson will be called off") : tr("lessons will be called off")}.
        {" "}{tr("Everyone affected is told immediately and offered a new time.")}
      </p>
      <div className="mb-6 flex flex-col gap-2">
        {affected.map((b, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderRadius: R.control, background: t.wash }}>
            <Avatar name={b.who} size={30} />
            <span className="flex-1" style={{ fontFamily: ui, fontSize: 13.5, color: t.ink }}>{b.who}</span>
            <span style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{span(b.time, duration)}</span>
          </div>
        ))}
      </div>
      <Button tone="danger" onClick={() => { hapticWarn(); decline(); onConfirm(affected, scope); close(); }}>
        {tr("Yes, call it off")}
      </Button>
      <button onClick={() => { haptic(6); setStage("choose"); }} className="w-full mt-3 py-3 active:opacity-50"
              style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("Back")}</button>
    </>
  );

  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: t.ink }}>{tr("Weather call-off")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{day}</p>

      <Tile accent={scope === "day" ? DANGER : null} className="px-5 py-4 mb-2.5" onPress={() => { setScope("day"); setPick(null); }}>
        <div className="flex items-center gap-3.5">
          <CalendarDays size={19} color={scope === "day" ? DANGER : t.sub} strokeWidth={1.6} />
          <span className="flex-1">
            <span className="block" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: t.ink }}>{tr("The whole day")}</span>
            <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{bookings.length} {tr("lessons")}</span>
          </span>
          {scope === "day" && <Check size={17} color={DANGER} strokeWidth={2.1} />}
        </div>
      </Tile>

      <Tile accent={scope === "one" ? DANGER : null} className="px-5 py-4 mb-5" onPress={() => setScope("one")}>
        <div className="flex items-center gap-3.5">
          <Clock size={19} color={scope === "one" ? DANGER : t.sub} strokeWidth={1.6} />
          <span className="flex-1" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: t.ink }}>{tr("Just one lesson")}</span>
          {scope === "one" && <Check size={17} color={DANGER} strokeWidth={2.1} />}
        </div>
      </Tile>

      {scope === "one" && (
        <div className="flex flex-col gap-2 mb-5" style={{ animation: "liftIn 320ms cubic-bezier(.22,1,.36,1) both" }}>
          {bookings.map((b, i) => {
            const on = pick === b.time;
            return (
              <button key={i} onClick={() => { haptic(7); soft(); setPick(b.time); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      style={{ borderRadius: R.control, background: on ? `${DANGER}0F` : t.surface,
                               border: `1px solid ${on ? `${DANGER}44` : t.hair}`, transition: "background 180ms" }}>
                <Avatar name={b.who} size={32} />
                <span className="flex-1" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{b.who}</span>
                <span style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{span(b.time, duration)}</span>
              </button>
            );
          })}
        </div>
      )}

      <Button tone="ink" disabled={!scope || (scope === "one" && !pick)}
              onClick={() => { hapticWarn(); setStage("confirm"); }}>{tr("Next")}</Button>
    </>
  );
}

/* What a player sees when weather takes their lesson. */
function RescheduleOffer({ lesson, slots, duration, onPick, close }) {
  const t = useT();
  const [sel, setSel] = useState(null);
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: t.wash }}>
          <Radio size={18} color={t.sub} strokeWidth={2} />
        </span>
        <h2 style={{ fontFamily: display, fontSize: 22, letterSpacing: "-0.025em", color: t.ink }}>{tr("Called off for weather")}</h2>
      </div>
      <p className="mb-6" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.6, color: t.sub }}>
        {lesson} {tr("won't go ahead. Pick a new time that suits you.")}
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {slots.map((sl, i) => {
          const on = sel === sl;
          return (
            <button key={sl} onClick={() => { haptic(7); soft(); setSel(sl); }} className="px-3.5 active:opacity-60"
                    style={{ minHeight: 44, borderRadius: R.pill, background: on ? t.accent : t.surface,
                             border: `1px solid ${on ? t.accent : t.hair}`, fontFamily: ui, fontSize: 13,
                             fontWeight: 600, color: on ? t.onAccent : t.sub,
                             animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>
              {span(sl, duration)}
            </button>
          );
        })}
      </div>
      <Button disabled={!sel} onClick={() => { onPick(sel); close(); }}>{tr("Take this time")}</Button>
      <button onClick={close} className="w-full mt-3 py-3 active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>
        {tr("I'll pick later")}
      </button>
    </>
  );
}

/* ==================================================================
   SCHEDULE BLOCK
   One lesson, as a box rather than a line. Collapsed it answers who
   and when; expanded it answers everything a coach wants in the two
   minutes before someone walks up.
================================================================== */
function ScheduleBlock({ item, duration, hoursUntil, onOpenLast, onLog, onNoShow, onCancel, push, delay = 0 }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const f = fileFor(item.who);
  const isGroup = item.kind && item.kind.startsWith("Group");
  const accent = isGroup ? GROUP : t.accent;

  return (
    <Tile accent={accent} delay={delay} className="mb-3" style={{ overflow: "hidden" }}>
      <button onClick={() => { haptic(7); soft(); setOpen(!open); }} className="w-full text-left px-5 py-4">
        <div className="flex items-center gap-3.5">
          {!isGroup ? <Avatar name={item.who} size={42} />
            : <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: t.wash }}>
                <Users size={18} color={GROUP} strokeWidth={1.6} /></span>}
          <span className="flex-1 min-w-0">
            <span className="block truncate" style={{ ...TYPE.heading, color: t.ink }}>{item.who}</span>
            <span className="block mt-1" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>
              {span(item.time, duration)} · {item.kind}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className="block" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: item.done ? t.accent : t.sub }}>
              {item.done ? tr("Log lesson") : untilText(hoursUntil)}
            </span>
            <ChevronDown size={15} color={t.faint} className="inline-block mt-1.5"
                         style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 260ms cubic-bezier(.22,1,.36,1)" }} />
          </span>
        </div>
      </button>

      {open && (
        <div style={{ animation: "liftIn 380ms cubic-bezier(.34,1.56,.64,1) both" }}>
          {/* the numbers */}
          <div className="flex mx-5 mb-4" style={{ borderTop: `1px solid ${t.hair}`, borderBottom: `1px solid ${t.hair}` }}>
            <Stat value={f.done} label={tr("Lessons")} />
            <span style={{ width: 1, background: t.hair }} />
            <Stat value={`${duration}m`} label={tr("Length")} />
          </div>

          <div className="px-5 pt-4 pb-5 flex flex-col gap-2">
            {f.tip && (
              <div className="px-4 py-3" style={{ borderRadius: R.control, background: t.wash }}>
                <div className="uppercase mb-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Working on")}</div>
                <div style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{f.tip}</div>
              </div>
            )}
            {f.goal && (
              <div className="px-4 py-3" style={{ borderRadius: R.control, background: t.wash }}>
                <div className="uppercase mb-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Goal")}</div>
                <div style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{f.goal}</div>
              </div>
            )}
            {f.lastFocus && (
              <button onClick={() => { haptic(7); onOpenLast && onOpenLast(item.who); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-60"
                      style={{ borderRadius: R.control, border: `1px solid ${t.hair}` }}>
                <span className="flex-1">
                  <span className="block uppercase mb-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Last lesson")}</span>
                  <span className="block" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{f.lastFocus} · {f.lastOn}</span>
                </span>
                <ChevronRight size={15} color={t.faint} />
              </button>
            )}

            <div className="flex gap-2.5 mt-1.5">
              <button onClick={() => { hapticWarn(); onNoShow && onNoShow(item); }} className="px-4 active:opacity-60"
                      style={{ minHeight: 46, borderRadius: R.control, border: `1px solid ${t.hair}`,
                               fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: DANGER }}>{tr("No show")}</button>
              <button onClick={() => { haptic(8); push("player:" + item.who); }} className="flex-1 active:opacity-60"
                      style={{ minHeight: 46, borderRadius: R.control, border: `1px solid ${t.hair}`,
                               fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.ink }}>{tr("Profile")}</button>
              <button onClick={() => { hapticCommit(); onLog && onLog(item); }} className="flex-1 active:opacity-75"
                      style={{ minHeight: 46, borderRadius: R.control, background: t.accent,
                               fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>
                {tr("Log lesson")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Tile>
  );
}

/* Nothing on today. Worth saying warmly rather than leaving a blank. */
function FreeDay({ onSetHours }) {
  const t = useT();
  return (
    <div className="px-6 py-12 text-center" style={{ animation: "liftIn 480ms cubic-bezier(.22,1,.36,1) both" }}>
      <span className="relative inline-flex items-center justify-center mb-6" style={{ width: 76, height: 76 }}>
        <span className="absolute rounded-full" style={{ inset: 0, border: `1px solid ${t.accent}`, opacity: 0.25,
                       animation: "haloOut 2.6s cubic-bezier(.2,.6,.3,1) infinite" }} />
        <span className="rounded-full flex items-center justify-center" style={{ width: 60, height: 60, background: t.wash,
                       animation: "breathe 4s ease-in-out infinite" }}>
          <Sparkles size={24} color={t.accent} strokeWidth={1.6} />
        </span>
      </span>
      <p style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.03em", color: t.ink }}>{tr("You're free today")}</p>
      <p className="mt-2.5 mb-6" style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{tr("Nothing booked. Enjoy it.")}</p>
      <button onClick={onSetHours} className="active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.accent }}>
        {tr("Open more hours")}
      </button>
    </div>
  );
}

/* ==================================================================
   TAB BAR
   Icons only, one lozenge, nothing else — the reference is right that
   labels are noise once the icons are learned.

   Performance note: dragging moves the lozenge by writing transform
   directly to the DOM node, not through React state. Re-rendering the
   whole shell on every pointermove is what makes bars like this feel
   sticky; this way the only React update is the one commit on release.
================================================================== */
/* THE BAR'S OUTLINE

   Measured, then drawn 1:1 — no preserveAspectRatio stretching, so the
   end caps stay true half-circles and the rise above the plus is the
   exact mirror of the fall below it. */
const BAR_H = 62, BULGE = 13, HALF = BAR_H / 2;
/* Where the other tabs' icons sit, so the raised action can line up
   with them instead of floating above the bar. */
const TAB_ICON = 19, TAB_GAP = 4, TAB_LABEL = 12;
const ICON_CENTRE = (BAR_H - (TAB_ICON + TAB_GAP + TAB_LABEL)) / 2 + TAB_ICON / 2;
const RAISED_OFFSET = ICON_CENTRE - BAR_H / 2;   // −8px
const barPath = (w, raised) => {
  const cx = w / 2, top = BULGE, bot = BULGE + BAR_H;
  if (!raised) {
    /* a plain oval — no raised action on this persona's bar */
    return `M${HALF} ${top} H${w - HALF} A${HALF} ${HALF} 0 0 1 ${w - HALF} ${bot} `
         + `H${HALF} A${HALF} ${HALF} 0 0 1 ${HALF} ${top} Z`;
  }
  const a = 52;                       // wide shoulders: a swell, not a lump
  return [
    `M${HALF} ${top}`,
    `H${cx - a}`,
    `C${cx - a + 26} ${top} ${cx - 30} 0 ${cx} 0`,
    `C${cx + 30} 0 ${cx + a - 26} ${top} ${cx + a} ${top}`,
    `H${w - HALF}`,
    `A${HALF} ${HALF} 0 0 1 ${w - HALF} ${bot}`,
    `H${cx + a}`,
    `C${cx + a - 26} ${bot} ${cx + 30} ${bot + BULGE} ${cx} ${bot + BULGE}`,
    `C${cx - 30} ${bot + BULGE} ${cx - a + 26} ${bot} ${cx - a} ${bot}`,
    `H${HALF}`,
    `A${HALF} ${HALF} 0 0 1 ${HALF} ${top}`,
    "Z",
  ].join(" ");
};

const TabBar = React.memo(function TabBar({ tabs, activeIdx, theme, dark, onSelect }) {
  const clipId = useMemo(() => "barclip" + Math.random().toString(36).slice(2, 8), []);
  const shellRef = useRef(null);
  const [w, setW] = useState(358);
  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      setW(el.offsetWidth || 358);
      /* re-measure so the pill's cell width tracks the real bar */
      S.current.box = el.getBoundingClientRect();
      paint(S.current.idx * (S.current.box.width / tabs.length), false);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el); sync();
    return () => ro.disconnect();
  }, []);
  const hasRaised = tabs.some((x) => x.raised);
  const D = barPath(w, hasRaised);
  const barRef = useRef(null);
  const bubbleRef = useRef(null);
  const iconRefs = useRef([]);
  const S = useRef({ box: null, dragging: false, idx: activeIdx, raf: 0, x: 0, suppress: false, startX: 0, id: null });

  const cell = () => (S.current.box ? S.current.box.width / tabs.length : 0);
  const measure = () => { const el = barRef.current; if (el) S.current.box = el.getBoundingClientRect(); };

  const lit = (i) => iconRefs.current.forEach((el, k) => {
    if (!el) return;
    el.style.transform = k === i ? "scale(1.15)" : "scale(1)";
    el.style.opacity = S.current.dragging && k !== i ? "0.4" : "1";
  });

  /* One writer for the bubble. Transition is set once per mode rather
     than every frame — re-declaring it mid-drag is what made it stutter
     and occasionally stick. */
  const paint = (px, snap) => {
    const b = bubbleRef.current;
    if (!b) return;
    b.style.transition = snap ? "transform 420ms cubic-bezier(.28,1.25,.45,1), opacity 220ms, box-shadow 220ms" : "none";
    b.style.transform = `translate3d(${px}px,0,0) scale(${S.current.dragging ? 1.05 : 1})`;
  };

  const snapTo = (i) => { S.current.idx = i; paint(i * cell(), true); lit(i); };

  const frame = () => {
    S.current.raf = 0;
    if (!S.current.dragging || !S.current.box) return;
    const c = cell();
    const px = Math.max(0, Math.min(S.current.box.width - c, S.current.x - S.current.box.left - c / 2));
    paint(px, false);
    const i = Math.max(0, Math.min(tabs.length - 1, Math.round(px / c)));
    if (i !== S.current.idx) { S.current.idx = i; haptic(6); lit(i); }
  };

  const begin = () => {
    if (S.current.dragging) return;
    S.current.dragging = true;
    hapticCommit();
    const b = bubbleRef.current;
    if (b) { b.style.opacity = "0.24"; b.style.boxShadow = `0 8px 22px ${theme.accent}55`; }
    lit(S.current.idx);
  };

  /* Always safe to call, however the gesture ended. */
  const finish = () => {
    if (S.current.raf) { cancelAnimationFrame(S.current.raf); S.current.raf = 0; }
    if (!S.current.dragging) return;
    S.current.dragging = false;
    const b = bubbleRef.current;
    if (b) { b.style.opacity = "0.12"; b.style.boxShadow = "none"; }
    const target = S.current.idx;
    snapTo(target);
    S.current.suppress = true;
    setTimeout(() => { S.current.suppress = false; }, 150);
    if (target !== activeIdx) { hapticSuccess(); onSelect(tabs[target].id); }
  };

  useEffect(() => { measure(); snapTo(activeIdx); }, [activeIdx, tabs.length]);
  useEffect(() => {
    /* Window-level listeners so a finger that leaves the bar, or a
       pointer the browser takes away, can never leave it stuck. */
    const up = () => finish();
    const cancel = () => finish();
    const resize = () => { measure(); paint(S.current.idx * cell(), false); };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", resize);
      if (S.current.raf) cancelAnimationFrame(S.current.raf);
    };
  }, [activeIdx, tabs.length]);

  return (
    <div className="shrink-0 relative z-30" style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 24, paddingTop: 4 }}>
      <div ref={(el) => { barRef.current = el; shellRef.current = el; }}
           onPointerDown={(e) => {
             measure();
             S.current.startX = e.clientX;
             S.current.id = e.pointerId;
             try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
             /* Press and hold, or simply drag — either begins it. */
             S.current.hold = setTimeout(begin, 140);
           }}
           onPointerMove={(e) => {
             if (!S.current.dragging) {
               if (Math.abs(e.clientX - S.current.startX) < 9) return;
               clearTimeout(S.current.hold);
               begin();
             }
             S.current.x = e.clientX;
             if (!S.current.raf) S.current.raf = requestAnimationFrame(frame);
           }}
           onPointerUp={() => { clearTimeout(S.current.hold); finish(); }}
           onPointerCancel={() => { clearTimeout(S.current.hold); finish(); }}
           onLostPointerCapture={() => { clearTimeout(S.current.hold); finish(); }}
           className="flex items-center relative"
           style={{ height: BAR_H, touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
                    background: "transparent", zIndex: 2 }}>

        {/* ONE CONNECTED OUTLINE
            The top edge rises over the middle and the bottom edge falls
            by the same amount — a lens in the bar itself. The blurred
            layer is clipped to this exact path, so the glass follows the
            curve instead of sitting in a rectangle behind it. */}
        <svg className="absolute pointer-events-none" aria-hidden="true"
             width={w} height={BAR_H + BULGE * 2}
             style={{ left: 0, top: -BULGE, zIndex: 0, overflow: "visible" }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={D} /></clipPath>
            <filter id={`${clipId}-sh`} x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="5" stdDeviation="8"  floodColor="#0E141A" floodOpacity="0.07" />
              <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#0E141A" floodOpacity="0.06" />
            </filter>
          </defs>
          <path d={D} fill={dark ? "rgba(20,25,27,0.84)" : "rgba(255,255,255,0.72)"}
                stroke={`${theme.mark}16`} strokeWidth="1" filter={`url(#${clipId}-sh)`} />
          {/* a faint wash of the sport, so the bar carries a hint of it
              without losing the glass */}
          <path d={D} fill={theme.mark} opacity={dark ? 0.09 : 0.05} />
        </svg>

        {/* the blur, clipped to that exact outline */}
        <span className="absolute pointer-events-none" aria-hidden="true"
              style={{ left: 0, top: -BULGE, width: w, height: BAR_H + BULGE * 2, zIndex: 0,
                       backdropFilter: "saturate(185%) blur(24px)", WebkitBackdropFilter: "saturate(185%) blur(24px)",
                       clipPath: `url(#${clipId})`, WebkitClipPath: `url(#${clipId})` }} />

        <span ref={bubbleRef} className="absolute" aria-hidden="true"
              style={{ left: 4, top: 5, bottom: 5, width: `calc(${100 / tabs.length}% - 8px)`,
                       borderRadius: R.pill, background: theme.mark, opacity: 0.13, zIndex: 1,
                       boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4)`,
                       willChange: "transform", transform: "translate3d(0,0,0)" }} />

        {tabs.map((tb, i) => {
          const Icon = tb.icon;
          const on = i === activeIdx;

          /* The raised action never had its own branch here — every tab,
             including this one, fell through to the small icon-and-label
             treatment below, with a blank label since none was given.
             That is the real reason it stayed small through every
             previous pass. It gets its own render now. */
          if (tb.raised) {
            return (
              <button key={tb.id} aria-label={tb.label || tr("Add")}
                      onClick={() => { if (S.current.suppress) return; haptic(12); soft(); onSelect(tb.id); }}
                      className="flex-1 flex items-center justify-center"
                      style={{ height: BAR_H, position: "relative", zIndex: 2, background: "transparent", touchAction: "none" }}>
                <span className="relative flex items-center justify-center"
                      style={{ width: 56, height: 56, marginTop: RAISED_OFFSET,
                               /* level with the other tabs' icons, derived from
                                  their own metrics rather than hand-tuned */
                               transition: "transform 220ms cubic-bezier(.34,1.56,.64,1)",
                               transform: on ? "scale(0.9)" : "scale(1)", willChange: "transform" }}>
                  <Plus size={32} color={theme.ink} strokeWidth={2.4} />
                </span>
              </button>
            );
          }

          return (
            <button key={tb.id} aria-label={tb.label} aria-current={on ? "page" : undefined}
                    onClick={() => { if (S.current.suppress) return; haptic(11); soft(); onSelect(tb.id); }}
                    className="flex-1 flex items-center justify-center"
                    style={{ height: BAR_H, position: "relative", zIndex: 2, background: "transparent", touchAction: "none" }}>
              <span ref={(el) => { iconRefs.current[i] = el; }} className="relative flex flex-col items-center justify-center gap-1"
                    style={{ transition: "transform 260ms cubic-bezier(.22,1,.36,1), opacity 200ms",
                             transform: on ? "scale(1.04)" : "scale(1)", willChange: "transform" }}>
                <Icon size={19} color={on ? theme.mark : theme.faint} strokeWidth={on ? 2.1 : 1.75} style={{ transition: "color 220ms" }} />
                <span style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.005em",
                               color: on ? theme.mark : theme.faint, transition: "color 220ms", whiteSpace: "nowrap" }}>{tb.label}</span>
                {tb.badge && (<span className="absolute rounded-full" style={{ top: -2, right: -5, width: 7, height: 7, background: DANGER }} />)}
                {tb.count > 0 && (<span className="absolute rounded-full flex items-center justify-center"
                                        style={{ top: -6, right: -9, minWidth: 15, height: 15, padding: "0 4px", background: DANGER,
                                                 fontFamily: ui, fontSize: 9, fontWeight: 600, color: "#fff" }}>{tb.count}</span>)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ==================================================================
   NATIVE PATTERNS
================================================================== */
function Colophon() {
  const t = useT();
  return (
    <div className="flex flex-col items-center py-10" aria-hidden="true">
      <Mark size={17} color={t.hair} />
      <span className="mt-2.5" style={{ fontFamily: display, fontSize: 8, letterSpacing: "0.36em", color: t.hair }}>{BRAND}</span>
    </div>
  );
}

function Screen({ title, meta, onBack, right, action, children, large = true, bare }) {
  const t = useT();
  const [y, setY] = useState(0);
  const shrunk = (y > 24 || !large) && !bare;
  return (
    <div className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="shrink-0 relative z-20"
           style={{ background: shrunk ? `${t.page}E6` : t.page,
                    backdropFilter: shrunk ? "saturate(180%) blur(18px)" : "none",
                    borderBottom: `1px solid ${shrunk ? t.hair : "transparent"}`, transition: "border-color 200ms" }}>
        <div className="flex items-center px-1.5" style={{ height: 46 }}>
          {onBack ? (
            <button onClick={() => { haptic(); onBack(); }} aria-label={tr("Back")} className="p-2 active:opacity-40">
              <ChevronLeft size={25} color={t.accent} strokeWidth={2.1} />
            </button>
          ) : <span style={{ width: 41 }} />}
          <span className="flex-1 text-center truncate px-2"
                style={{ fontFamily: ui, fontSize: 16, fontWeight: 600, color: t.ink,
                         opacity: shrunk ? 1 : 0, transition: "opacity 180ms" }}>{title}</span>
          <span className="flex items-center justify-end gap-2.5 pr-3" style={{ minWidth: 41 }}>{right}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" onScroll={(e) => setY(e.currentTarget.scrollTop)}>
        {large && !bare && (
          <div className="px-6 pb-10 pt-4 flex items-start gap-3 relative"
               style={{ opacity: y > 24 ? 0 : 1, transition: "opacity 180ms",
                        animation: "headerSettle 480ms cubic-bezier(.22,1,.36,1) both" }}>
            <span className="flex-1 min-w-0">
              <h1 style={{ ...TYPE.hero, color: t.ink, marginLeft: -1.5,
                            animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) both" }}>{title}</h1>
              {meta && <p className="mt-2" style={{ ...TYPE.small, fontSize: 12.5, color: t.faint,
                              animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 70ms both" }}>{meta}</p>}
            </span>
            {action}
          </div>
        )}
        {!large && <div style={{ height: 8 }} />}
        {children}
      </div>
    </div>
  );
}
function SwipeBack({ onBack, children }) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const st = useRef(null); const box = useRef(null);
  const down = (e) => { const r = box.current?.getBoundingClientRect(); if (!r || e.clientX - r.left > 60) return; st.current = { x: e.clientX, y: e.clientY }; };
  const move = (e) => { if (!st.current) return; if (Math.abs(e.clientY - st.current.y) > 60) { st.current = null; setDx(0); return; } setDx(Math.max(0, Math.min(e.clientX - st.current.x, 240))); };
  const up = () => { if (dx > 80) { haptic(12); onBack(); } setDx(0); st.current = null; };
  return (
    <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
         className="h-full relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      <div className="h-full" style={{ transform: `translateX(${dx}px)`, transition: st.current ? "none" : "transform 260ms cubic-bezier(.32,.72,0,1)",
                                       boxShadow: dx ? "-16px 0 34px rgba(0,0,0,0.12)" : "none" }}>{children}</div>
      {dx > 18 && (
        <div className="absolute flex items-center justify-center rounded-full"
             style={{ left: 8, top: "50%", width: 32, height: 32, marginTop: -16, background: t.wash, opacity: Math.min(dx / 88, 1) }}>
          <ChevronLeft size={17} color={t.accent} />
        </div>
      )}
    </div>
  );
}
function Sheet({ open, onClose, children }) {
  useEffect(() => { if (open) haptic(9); }, [open]);
  const t = useT();
  const [dy, setDy] = useState(0);
  const st = useRef(null);
  useEffect(() => { if (open) setDy(0); }, [open]);
  const down = (e) => { st.current = e.clientY; };
  const move = (e) => { if (st.current == null) return; setDy(Math.max(0, e.clientY - st.current)); };
  const up = () => { if (dy > 88) { haptic(); onClose(); } setDy(0); st.current = null; };
  return (
    <div className="absolute inset-0 z-40" style={{ pointerEvents: open ? "auto" : "none" }}>
      <div onClick={() => { haptic(7); onClose && onClose(); }} className="absolute inset-0" style={{ background: "rgba(10,16,12,0.26)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
                       opacity: open ? 1 : 0, transition: "opacity 280ms" }} />
      <div className="absolute left-0 right-0 bottom-0 overflow-hidden"
           style={{ background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, transform: `translateY(${open ? dy : 760}px)`,
                    transition: st.current != null ? "none" : "transform 340ms cubic-bezier(.32,.72,0,1)", boxShadow: "0 -8px 40px rgba(10,16,12,0.14)" }}>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} className="flex justify-center py-3.5" style={{ touchAction: "none", cursor: "grab" }}>
          <span className="rounded-full" style={{ width: 36, height: 5, background: t.hair }} />
        </div>
        <div className="px-6 pb-7 overflow-y-auto" style={{ maxHeight: 540 }}>{children}</div>
      </div>
    </div>
  );
}
function Toast({ msg }) {
  const t = useT();
  return (
    <div className="absolute left-0 right-0 flex justify-center z-50 px-6" style={{ bottom: 98 }}>
      <div className="rounded-full px-5 py-3" style={{ background: t.ink, opacity: msg ? 1 : 0,
                    transform: msg ? "translateY(0)" : "translateY(12px)", transition: "opacity 240ms, transform 240ms" }}>
        <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{msg || ""}</span>
      </div>
    </div>
  );
}
function Segmented({ options, value, onChange }) {
  const t = useT();
  return (
    <div className="flex rounded-xl p-0.5" style={{ background: t.wash }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} onClick={() => { haptic(6); onChange(o); }} className="flex-1 rounded-lg"
                  style={{ minHeight: 34, background: on ? t.surface : "transparent", boxShadow: on ? "0 1px 3px rgba(10,16,12,0.09)" : "none",
                           transition: "background 260ms cubic-bezier(.22,1,.36,1), color 260ms, box-shadow 260ms",
                           fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: on ? t.ink : t.sub }}>{o}</button>
        );
      })}
    </div>
  );
}
function Toggle({ on, onChange }) {
  const t = useT();
  return (
    <button onClick={() => { haptic(6); onChange(!on); }} aria-pressed={on} className="rounded-full shrink-0 relative"
            style={{ width: 50, height: 30, background: on ? t.accent : "#D6DAD3", transition: "background 280ms cubic-bezier(.22,1,.36,1)" }}>
      <span className="absolute rounded-full" style={{ width: 26, height: 26, top: 2, left: on ? 22 : 2, background: "#fff",
                     boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms cubic-bezier(.32,.72,0,1)" }} />
    </button>
  );
}

/* ==================================================================
   DICTATION — uses the browser's real speech recognition where it
   exists (Safari and Chrome both ship it under a prefix), and falls
   back to a clearly-labelled simulation everywhere else, so the mic
   never looks broken in a demo or on an unsupported device.
================================================================== */
function speechCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/* Real transcription via the browser's own speech engine. Where the
   engine doesn't exist we say so rather than inserting invented text —
   a mic that quietly makes words up is worse than one that admits it
   can't hear you. */
function useDictation(onText, onNotice) {
  const [state, setState] = useState("idle");   // idle | listening
  const recRef = useRef(null);
  const supported = !!speechCtor();

  const stop = () => {
    try { recRef.current && recRef.current.stop(); } catch (e) {}
    recRef.current = null;
    setState("idle");
  };

  const start = () => {
    haptic(12);
    if (state === "listening") { stop(); return; }
    const Ctor = speechCtor();
    if (!Ctor) { onNotice && onNotice("Dictation needs Safari or Chrome"); hapticWarn(); return; }
    try {
      const rec = new Ctor();
      rec.lang = "en-IE";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      let settled = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) settled += chunk; else interim += chunk;
        }
        onText((settled + interim).replace(/\s+/g, " ").trim(), !!settled);
      };
      rec.onerror = (e) => {
        if (e && e.error === "not-allowed") onNotice && onNotice("Microphone access was declined");
        else if (e && e.error === "no-speech") onNotice && onNotice("Didn't catch that");
        setState("idle"); recRef.current = null; hapticWarn();
      };
      rec.onend = () => { setState("idle"); recRef.current = null; haptic(8); };
      rec.start();
      recRef.current = rec;
      setState("listening");
    } catch (e) { onNotice && onNotice("Couldn't start the microphone"); setState("idle"); }
  };

  useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch (e) {} }, []);
  return { state, start, stop, supported };
}

function MicBtn({ onText, size = 34, tint, onNotice }) {
  const t = useT();
  const { state, start, supported } = useDictation(onText, onNotice);
  const live = state === "listening";
  return (
    <button onClick={start} aria-label={live ? "Stop dictating" : "Dictate"}
            className="rounded-full flex items-center justify-center shrink-0 active:opacity-60 relative"
            style={{ width: size, height: size, background: live ? (tint || t.accent) : "transparent",
                     opacity: supported ? 1 : 0.45, transition: "background 180ms" }}>
      <Mic size={size * 0.46} color={live ? (t.onAccent || "#fff") : t.faint} strokeWidth={1.6} />
      {live && (<span className="absolute rounded-full" style={{ inset: -3, border: `1.5px solid ${tint || t.accent}`, opacity: 0.5, animation: "ping 1.3s ease-out infinite" }} />)}
    </button>
  );
}

/* A single-line input with dictation built in. */
function VoiceInput({ value, onChange, ph, style, autoFocus }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-2xl px-4" style={{ minHeight: 54, background: t.wash, ...style }}>
      <input value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={ph}
             className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 15.5, color: t.ink, background: "transparent" }} />
      <MicBtn onText={(txt) => onChange(value ? value + " " + txt : txt)} />
    </div>
  );
}

/* Multi-line version — the one coaches will actually lean on. */
function VoiceArea({ value, onChange, ph, rows = 3 }) {
  const t = useT();
  return (
    <div className="rounded-2xl px-4 py-1" style={{ background: t.wash }}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={ph}
                className="w-full outline-none resize-none py-3" style={{ fontFamily: ui, fontSize: 15, lineHeight: 1.55, color: t.ink, background: "transparent" }} />
      <div className="flex items-center justify-between pb-2">
        <span style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{tr("Type or talk")}</span>
        <MicBtn onText={(txt) => onChange(value ? value + " " + txt : txt)} />
      </div>
    </div>
  );
}

/* ==================================================================
   PRIMITIVES
================================================================== */
const Card = ({ children, className = "", style = {}, delay = 0 }) => {
  const t = useT();
  return (<div className={className} style={{ background: t.surface, borderRadius: R.surface, boxShadow: ELEV.rest,
                  animation: `liftIn 440ms cubic-bezier(.22,1,.36,1) ${delay}ms both`, ...style }}>{children}</div>);
};
const Eyebrow = ({ children }) => {
  const t = useT();
  return (<div className="mb-3 px-6 mt-1" style={{ marginLeft: 1 }} style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.22em", fontWeight: 600, color: t.faint,
                  animation: "slideIn 460ms cubic-bezier(.22,1,.36,1) both" }}>{children}</div>);
};
export function Button({ children, onClick, tone = "accent", disabled }) {
  const t = useT();
  const looks = {
    accent: { background: t.accent, color: t.onAccent, border: "none" },
    ink:    { background: t.ink, color: "#fff", border: "none" },
    quiet:  { background: "transparent", color: t.ink, border: `1px solid ${t.hair}` },
    danger: { background: DANGER, color: "#fff", border: "none" },
    dangerQuiet: { background: "transparent", color: DANGER, border: `1px solid ${t.hair}` },
  }[tone];
  return (
    <button onClick={() => { if (!disabled) { haptic(10); onClick && onClick(); } }} disabled={disabled}
            className="w-full disabled:opacity-20"
            onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            style={{ minHeight: 54, borderRadius: R.surface, fontFamily: ui, fontSize: 15, fontWeight: 600, letterSpacing: "0.015em",
                     transition: "transform 140ms cubic-bezier(.22,1,.36,1), opacity 140ms", willChange: "transform", ...looks }}>{children}</button>
  );
}
const TextBtn = ({ children, onClick, color }) => {
  const t = useT();
  return (<button onClick={() => { haptic(6); onClick(); }} className="px-1 active:opacity-40" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: color || t.accent }}>{children}</button>);
};
function Row({ label, sub, value, checked, onToggle, radio, last, chevron, dot, icon, danger, right }) {
  const t = useT();
  const Tag = onToggle ? "button" : "div";
  return (
    <Tag onClick={onToggle ? () => { haptic(6); onToggle(); } : undefined}
         className={`w-full flex items-center gap-3.5 px-5 text-left ${onToggle ? "active:opacity-50" : ""}`}
         onPointerDown={(e) => { if (onToggle) e.currentTarget.style.transform = "scale(0.97)"; }}
         onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
         onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
         style={{ minHeight: 62, borderBottom: last ? "none" : `1px solid ${t.hair}`,
                  transition: "transform 130ms cubic-bezier(.22,1,.36,1)", willChange: "transform" }}>
      {icon}
      {onToggle && !chevron && !icon && !right && (
        <span className="flex items-center justify-center shrink-0"
              style={{ width: 22, height: 22, borderRadius: radio ? 11 : 7, border: `1.5px solid ${checked ? t.accent : t.hair}`, background: checked ? t.accent : "transparent" }}>
          {checked && <Check size={13} color="#fff" strokeWidth={2.1} />}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate" style={{ fontFamily: ui, fontSize: 15, letterSpacing: "-0.005em", color: danger ? DANGER : t.ink }}>{label}</span>
          {dot && <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: t.accent }} />}
        </span>
        {sub && <span className="block truncate mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{sub}</span>}
      </span>
      {value && <span className="shrink-0" style={{ fontFamily: ui, fontSize: 14.5, color: t.faint }}>{value}</span>}
      {right}
      {chevron && <ChevronRight size={17} color={t.faint} />}
      {checked && icon && <Check size={18} color={STEADY} strokeWidth={2.1} />}
    </Tag>
  );
}
function Clip({ angle, dur = "0:12", size = "lg", onRemove, onMinimise, saved }) {
  const h = size === "lg" ? 204 : 84;
  return (
    <div className="relative rounded-2xl overflow-hidden shrink-0"
         style={{ height: h, width: size === "lg" ? "100%" : 112, background: "#191D1B" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full flex items-center justify-center" style={{ width: size === "lg" ? 58 : 28, height: size === "lg" ? 58 : 28, background: "rgba(255,255,255,0.2)" }}>
          <Play size={size === "lg" ? 21 : 10} color="#fff" fill="#fff" />
        </span>
      </div>
      {onMinimise && (
        <button onClick={() => { haptic(8); onMinimise(); }} aria-label={tr("Minimise video")}
                className="absolute top-2.5 right-2.5 rounded-full p-2 active:opacity-60" style={{ background: "rgba(0,0,0,0.45)" }}>
          <Minimize2 size={14} color="#fff" />
        </button>
      )}
      {saved && (
        <span className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 flex items-center gap-1.5" style={{ background: "rgba(0,0,0,0.45)" }}>
          <Check size={10} color="#fff" strokeWidth={2.1} /><span style={{ fontFamily: ui, fontSize: 10, fontWeight: 600, color: "#fff" }}>{tr("Offline")}</span>
        </span>
      )}
      <div className="absolute left-0 right-0 bottom-0 flex items-center justify-between px-3 py-2">
        <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 600, color: "#fff" }}>{angle}</span>
        {dur && <span style={{ fontFamily: ui, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{dur}</span>}
      </div>
      {onRemove && (
        <button onClick={() => { haptic(); onRemove(); }} aria-label={`Remove ${angle}`} className="absolute top-2.5 right-2.5 rounded-full p-1.5" style={{ background: "rgba(0,0,0,0.5)" }}>
          <X size={12} color="#fff" />
        </button>
      )}
    </div>
  );
}
function MiniPlayer({ clip, onClose, onExpand }) {
  const t = useT();
  const [playing, setPlaying] = useState(true);
  return (
    <div className="absolute z-40" style={{ right: 12, bottom: 78, animation: "pop 220ms cubic-bezier(.32,.72,0,1)" }}>
      <div className="rounded-2xl overflow-hidden relative" style={{ width: 148, height: 92, background: "#191D1B", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <button onClick={onExpand} className="absolute inset-0" aria-label={tr("Expand video")} />
        <button onClick={(e) => { e.stopPropagation(); haptic(6); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play"}
                className="absolute rounded-full flex items-center justify-center active:opacity-60"
                style={{ width: 32, height: 32, top: "50%", left: "50%", marginTop: -16, marginLeft: -16, background: "rgba(255,255,255,0.22)" }}>
          {playing ? <Pause size={12} color="#fff" fill="#fff" /> : <Play size={12} color="#fff" fill="#fff" />}
        </button>
        <button onClick={() => { haptic(8); onClose(); }} aria-label={tr("Close video")} className="absolute top-1.5 right-1.5 rounded-full p-1.5 active:opacity-60" style={{ background: "rgba(0,0,0,0.5)" }}>
          <X size={11} color="#fff" />
        </button>
        <div className="absolute left-0 right-0 bottom-0 px-2 py-1.5 pointer-events-none"><span style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 600, color: "#fff" }}>{clip}</span></div>
        <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: 0, height: 2, background: "rgba(255,255,255,0.2)" }}><div style={{ height: 2, width: "38%", background: t.accent }} /></div>
      </div>
    </div>
  );
}
function Spark({ chart, color }) {
  const t = useT();
  const c = color || t.accent;
  const w = 320, h = 84, pad = 8;
  const { data, labels } = chart;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [pad + (i * (w - pad * 2)) / (data.length - 1), pad + (h - pad * 2 - 8) * (1 - (v - min) / span)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ display: "block" }} aria-hidden="true">
        <path d={`${line} L${pts[pts.length-1][0]} ${h-pad} L${pts[0][0]} ${h-pad} Z`} fill={c} opacity="0.12"
              style={{ animation: "celebFade 900ms ease 700ms both", animationFillMode: "backwards" }} />
        <path d={line} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: "tickDraw 1200ms cubic-bezier(.35,0,.15,1) 150ms both" }} />
        <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="4.4" fill={c} stroke={t.surface} strokeWidth="2"
                style={{ animation: "ringPop 460ms cubic-bezier(.22,1,.36,1) 1150ms both" }} />
      </svg>
      <div className="flex justify-between mt-1.5">{labels.map((l) => <span key={l} style={{ fontFamily: ui, fontSize: 10.5, color: t.faint }}>{l}</span>)}</div>
    </div>
  );
}
const Avatar = ({ name, size = 44, group, tint }) => {
  const t = useT();
  const initials = (name || "").split(" ").map((x) => x[0]).filter(Boolean).slice(0, 2).join("");
  return (
    <span className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: size, height: size, background: tint || t.wash,
                   fontFamily: display, fontSize: size * 0.36, fontWeight: 500,
                   letterSpacing: "-0.02em", color: tint ? "#fff" : t.sub }}>
      {group ? <Users size={size * 0.42} color={tint ? "#fff" : t.sub} /> : initials}
    </span>
  );
};
const IconBtn = ({ C, onOpen, label, count }) => {
  const t = useT();
  return (
    <button onClick={() => { haptic(6); onOpen(); }} aria-label={label} className="relative active:opacity-50 p-0.5">
      <C size={21} color={t.ink} strokeWidth={1.6} />
      {count > 0 && (<span className="absolute rounded-full flex items-center justify-center" style={{ top: -3, right: -4, minWidth: 15, height: 15, padding: "0 4px", background: DANGER, border: `1.5px solid ${t.page}`, fontFamily: ui, fontSize: 9, fontWeight: 600, color: "#fff" }}>{count}</span>)}
    </button>
  );
};
function CodePad({ value, onChange, compact }) {
  const t = useT();
  const tap = (k) => { haptic(5); k === "del" ? onChange(value.slice(0, -1)) : value.length < 6 && onChange(value + k); };
  return (
    <>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="flex items-center justify-center" style={{ width: compact ? 38 : 41, height: compact ? 50 : 54, borderRadius: R.control, background: t.wash,
                         border: `1.5px solid ${i === value.length ? t.ink : "transparent"}`, fontFamily: display, fontSize: compact ? 23 : 25, color: t.ink }}>{value[i] || ""}</span>
        ))}
      </div>
      <div className="grid grid-cols-3">
        {["1","2","3","4","5","6","7","8","9","A","0","del"].map((k) => (
          <button key={k} onClick={() => tap(k)} className="flex items-center justify-center active:opacity-30"
                  style={{ height: compact ? 46 : 54, fontFamily: display, fontSize: compact ? 22 : 25, color: t.ink }}>{k === "del" ? <Delete size={19} color={t.sub} /> : k}</button>
        ))}
      </div>
    </>
  );
}
function QrSvg({ size = 150, accent, seed = 1234 }) {
  const t = useT();
  const u = size / 21;
  let sd = seed;
  const rnd = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const fin = (fx, fy, x, y) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
  const cells = [];
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { if (fin(0,0,x,y) || fin(14,0,x,y) || fin(0,14,x,y)) continue; if (rnd() > 0.5) cells.push(<rect key={`${x}-${y}`} x={x*u} y={y*u} width={u} height={u} fill={t.ink} />); }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={tr("QR code")}>
      <rect width={size} height={size} fill="#fff" />{cells}
      {[[0,0],[14,0],[0,14]].map(([x, y]) => (<g key={`${x}${y}`}><rect x={x*u} y={y*u} width={7*u} height={7*u} fill="none" stroke={t.ink} strokeWidth={u} /><rect x={(x+2)*u} y={(y+2)*u} width={3*u} height={3*u} fill={accent || t.accent} /></g>))}
    </svg>
  );
}

/* ==================================================================
   CAMERA
================================================================== */
function CameraView({ angles, onCapture, onClose }) {
  const [angle, setAngle] = useState(angles[0]);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => { if (!rec) return; const i = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(i); }, [rec]);
  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "#0A0D0A" }}>
      <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52 }}>
        <button onClick={() => { haptic(); onClose(); }} aria-label={tr("Close")} className="p-2 active:opacity-50"><X size={22} color="#fff" /></button>
        {rec && (<span className="flex items-center gap-2"><span className="rounded-full" style={{ width: 8, height: 8, background: DANGER }} /><span style={{ fontFamily: ui, fontSize: 14, fontWeight: 600, color: "#fff" }}>0:{String(secs % 60).padStart(2, "0")}</span></span>)}
        <span style={{ width: 38 }} />
      </div>
      <div className="flex-1 relative mx-3 rounded-2xl overflow-hidden" style={{ background: "#151917" }}>
        {[["0","0"],["1","0"],["0","1"],["1","1"]].map(([x, y]) => (
          <span key={`${x}${y}`} className="absolute" style={{ width: 26, height: 26, top: y === "0" ? 14 : "auto", bottom: y === "1" ? 14 : "auto", left: x === "0" ? 14 : "auto", right: x === "1" ? 14 : "auto",
                   borderTop: y === "0" ? "2px solid rgba(255,255,255,0.5)" : "none", borderBottom: y === "1" ? "2px solid rgba(255,255,255,0.5)" : "none",
                   borderLeft: x === "0" ? "2px solid rgba(255,255,255,0.5)" : "none", borderRight: x === "1" ? "2px solid rgba(255,255,255,0.5)" : "none" }} />
        ))}
        <div className="absolute left-0 right-0 text-center" style={{ bottom: 16 }}><span style={{ fontFamily: ui, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{rec ? "Recording" : "Frame them inside the guides"}</span></div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-4 shrink-0" style={{ scrollbarWidth: "none" }}>
        {angles.map((a) => { const on = angle === a; return (
          <button key={a} onClick={() => { haptic(6); setAngle(a); }} className="rounded-full px-4 shrink-0"
                  style={{ minHeight: 34, background: on ? "#fff" : "rgba(255,255,255,0.1)", fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#12180F" : "rgba(255,255,255,0.75)" }}>{a}</button>
        ); })}
      </div>
      <div className="flex items-center justify-center shrink-0 pb-7">
        <button onClick={() => { haptic(16); if (rec) { onCapture(angle, secs); setRec(false); setSecs(0); } else { setRec(true); setSecs(0); } }}
                aria-label={rec ? "Stop recording" : "Start recording"} className="rounded-full flex items-center justify-center active:opacity-75" style={{ width: 74, height: 74, border: "3px solid rgba(255,255,255,0.6)" }}>
          <span style={{ width: rec ? 26 : 58, height: rec ? 26 : 58, borderRadius: rec ? 6 : 29, background: DANGER, transition: "all 220ms cubic-bezier(.32,.72,0,1)" }} />
        </button>
      </div>
    </div>
  );
}

/* ==================================================================
   SIGN-UP — a real intake, not a formality. Coaches land on a plan
   sized to their roster; players say who is actually playing.
================================================================== */
/* Every sign-up screen goes through here, so the rail, the mark, the
   numbering and the spacing can only ever be right in one place. */
export function Frame({ step, steps, onBack, children, footer }) {
  const t = useT();
  /* Same reasoning as SignupShell: no progress bar, because the path
     length depends on who you said you are. The wordmark stays — it is
     the one piece of furniture worth keeping.

     This one keeps its scroll: the details step has a date of birth,
     four fields and a legal line, which genuinely can exceed a short
     screen once a keyboard is up. */
  return (
    <div className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
      <div className="shrink-0 pt-3">
        <div className="flex items-center justify-center gap-2 pb-1" style={{ animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) both" }}>
          <Mark size={15} color={t.faint} />
          <span style={{ fontFamily: display, fontSize: 9, letterSpacing: "0.34em", color: t.faint }}>{BRAND}</span>
        </div>
        <div className="flex items-center px-1.5" style={{ height: 46 }}>
          {onBack
            ? <button onClick={() => { haptic(6); onBack(); }} aria-label={tr("Back")} className="p-2 active:opacity-40"><ChevronLeft size={23} color={t.ink} strokeWidth={2} /></button>
            : <span style={{ width: 39 }} />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-7 min-h-0">{children}</div>
      {footer && <div className="px-7 pt-2 shrink-0" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>{footer}</div>}
    </div>
  );
}

export const Headline = ({ children }) => { const t = useT(); return <h1 style={{ fontFamily: display, fontSize: 32, lineHeight: 1.04, letterSpacing: "-0.036em", color: t.ink, animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) both" }}>{children}</h1>; };
export const Sub = ({ children }) => { const t = useT(); return <p className="mt-2.5" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.5, color: t.faint, animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 60ms both" }}>{children}</p>; };

/* A field that lives outside the parent's render, so typing never
   remounts it and loses focus. */
export function Field({ label, value, onChange, ph, type = "text", Icon, autoFocus, error, onBlur, reveal }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const bad = !!error;
  const inputType = reveal && shown ? "text" : type;
  return (
    <div style={{ borderBottom: `1px solid ${bad ? DANGER : t.hair}`, paddingTop: 16, paddingBottom: 14 }}>
      <div className="flex items-center gap-3.5">
        {Icon && <Icon size={17} color={bad ? DANGER : t.faint} strokeWidth={1.6} />}
        <span className="flex-1">
          {label && <span className="block" style={{ fontFamily: ui, fontSize: 11, color: bad ? DANGER : t.faint }}>{label}</span>}
          <input type={inputType} value={value} placeholder={ph} autoFocus={autoFocus} onBlur={onBlur}
                 onChange={(e) => onChange(e.target.value)} className="w-full outline-none"
                 style={{ fontFamily: ui, fontSize: 16.5, color: bad ? DANGER : t.ink, background: "transparent" }} />
        </span>
        {reveal && value.length > 0 && (
          <button onClick={() => { haptic(6); setShown(!shown); }} className="shrink-0 active:opacity-50 p-1"
                  aria-label={shown ? "Hide password" : "Show password"}>
            <Eye size={17} color={shown ? t.accent : t.faint} strokeWidth={1.6} />
          </button>
        )}
      </div>
      {bad && <p className="mt-1.5" style={{ fontFamily: ui, fontSize: 11.5, color: DANGER }}>{error}</p>}
    </div>
  );
}

/* Kept at module scope on purpose. Defined inside a component it would
   be a new type on every keystroke, so React would remount it and the
   keyboard would close after each digit. */
const DobBox = React.forwardRef(function DobBox({ value, onChange, ph, len, bad, onDone }, ref) {
  const t = useT();
  return (
    <input ref={ref} value={value} placeholder={ph} inputMode="numeric" maxLength={len}
           onChange={(e) => {
             const v = e.target.value.replace(/\D/g, "");
             onChange(v);
             /* Only a complete value advances or dismisses the keyboard.
                A timer-based guess here previously fired on every partial
                keystroke — typing "1", "19", "199" and pausing naturally
                while writing a year would trigger it before the date was
                even finished, which felt like the form fighting back. */
             if (v.length === len && onDone) onDone();
           }}
           className="outline-none text-center rounded-xl"
           style={{ width: len === 4 ? 82 : 60, minHeight: 54, background: t.wash,
                    border: `1px solid ${bad ? DANGER : "transparent"}`,
                    fontFamily: ui, fontSize: 17, color: bad ? DANGER : t.ink }} />
  );
});

/* First screen anyone sees. With six sports, competing colour panels
   became noise — so it's a quiet list: one line each, a single accent
   dot, nothing to read but the names. */
/* The first question, before sport or role: where are you and what do
   you read? Everything after this is in that language. */
/* ------------------------------------------------------------------
   COACH SET-UP
   Straight after sign-up. A coach tells us how they actually work —
   which numbers they track, which drills they use, which days and
   times they teach — so the app arrives shaped around them instead of
   around a default they have to undo.
------------------------------------------------------------------ */
function CoachSetup({ cfg, sport, lang, slots, onDone }) {
  const t = useT();
  const L = STRINGS[lang] || STRINGS.en;
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState(cfg.defaultStats.slice(0, 3));
  const [drills, setDrills] = useState(cfg.drills.slice(0, 3).map((d) => d.t));
  const [days, setDays] = useState([1, 3, 4]);
  const [times, setTimes] = useState(["9:00 am", "10:00 am", "4:30 pm"]);
  const [dur, setDur] = useState(45);
  const [newDrill, setNewDrill] = useState("");

  const togg = (arr, set, v, max) => {
    haptic(6); soft();
    if (arr.includes(v)) set(arr.filter((x) => x !== v));
    else if (!max || arr.length < max) set([...arr, v]);
    else hapticWarn();
  };

  const steps = [
    { title: tr("Stats"), sub: tr("Pick up to three. You can change these any time.") },
    { title: tr("Drills"),    sub: tr("Your starting library. Add your own as you go.") },
    { title: tr("Days"),    sub: null },
    { title: tr("Times"),          sub: tr("These become the slots players can book.") },
  ];
  const ready = [stats.length > 0, drills.length > 0, days.length > 0, times.length > 0][step];
  const last = step === steps.length - 1;

  const chosen = [
    stats.length ? `${stats.length} ${tr("stats")}` : null,
    drills.length ? `${drills.length} ${tr("drills")}` : null,
    days.length ? `${days.length} ${tr("days")}` : null,
    step === 3 && times.length ? `${times.length} ${tr("times")}` : null,
  ].filter(Boolean);

  return (
    <SignupShell step={step} steps={4} title={steps[step].title} sub={steps[step].sub}
                 onBack={step ? () => setStep(step - 1) : null}
                 above={chosen.length > 0 && (
                   <div className="flex flex-wrap gap-2 mb-6" style={{ animation: "fadeUp 400ms cubic-bezier(.22,1,.36,1) both" }}>
                     {chosen.map((c) => (
                       <span key={c} className="px-3 py-1.5 flex items-center gap-1.5"
                             style={{ borderRadius: R.surface, background: `${t.accent}0D`, border: `1px solid ${t.accent}1C` }}>
                         <Check size={11} color={STEADY} strokeWidth={2.1} />
                         <span style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{c}</span>
                       </span>
                     ))}
                   </div>
                 )}
                 footer={<Button tone="ink" disabled={!ready}
                           onClick={() => { if (last) { hapticSuccess(); swell(); onDone({ stats, drills, days, times, dur }); }
                                            else { haptic(10); soft(); setStep(step + 1); } }}>
                           {last ? tr("Finish set-up") : L.continue}</Button>}>

      {step === 0 && cfg.statCatalog.map((st, i) => (
        <Choice key={st.id} label={st.l} sub={st.u ? st.u : null} on={stats.includes(st.id)} delay={i * 40}
                onSelect={() => togg(stats, setStats, st.id, 3)} />
      ))}

      {step === 1 && (<>
        {cfg.drills.map((d, i) => (
          <Choice key={d.t} label={d.t} sub={d.d} on={drills.includes(d.t)} delay={i * 40}
                  onSelect={() => togg(drills, setDrills, d.t)} />
        ))}
        <div className="flex gap-2 mt-4">
          <div className="flex-1"><VoiceInput value={newDrill} onChange={setNewDrill} ph={tr("Add your own drill")} /></div>
          <button onClick={() => { if (newDrill.trim()) { hapticSuccess(); soft(); setDrills([...drills, newDrill.trim()]); setNewDrill(""); } }}
                  disabled={!newDrill.trim()} className="shrink-0 active:opacity-60 disabled:opacity-25"
                  style={{ width: 52, minHeight: 52, borderRadius: R.surface, background: t.accent }} aria-label={tr("Add")}>
            <Plus size={18} color={t.onAccent} strokeWidth={2.1} />
          </button>
        </div>
      </>)}

      {step === 2 && (
        <div className="flex flex-col gap-2.5">
          {DAY_NAMES.map((d, i) => (
            <Choice key={i} label={d} on={days.includes(i)} delay={i * 35} onSelect={() => togg(days, setDays, i)} />
          ))}
        </div>
      )}

      {step === 3 && (<>
        <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>
          {tr("Lesson length")}
        </div>
        <div className="flex gap-2 mb-7">
          {DURATIONS.map((d) => {
            const on = dur === d;
            return (<button key={d} onClick={() => { haptic(6); soft(); setDur(d); }} className="flex-1 active:opacity-60"
                            style={{ minHeight: 46, borderRadius: R.control, background: on ? t.accent : t.wash,
                                     fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: on ? "#fff" : t.sub,
                                     transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>{d}m</button>);
          })}
        </div>
        <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>
          {tr("Start times")}
        </div>
        <div className="flex flex-wrap gap-2">
          {slots.map((sl, i) => {
            const on = times.includes(sl);
            return (
              <button key={sl} onClick={() => togg(times, setTimes, sl)} className="px-3.5 active:opacity-60"
                      style={{ minHeight: 42, borderRadius: R.pill, background: on ? t.accent : t.surface,
                               border: `1px solid ${on ? t.accent : t.hair}`, fontFamily: ui, fontSize: 13,
                               fontWeight: 600, color: on ? t.onAccent : t.sub,
                               animation: `fadeUp 380ms cubic-bezier(.22,1,.36,1) ${i * 25}ms both`,
                               transition: "background 180ms, border-color 180ms" }}>
                {span(sl, dur)}
              </button>
            );
          })}
        </div>
        <p className="mt-5" style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: t.faint }}>
          {times.length} {tr("slots on")} {days.length} {tr("days")}.
        </p>
      </>)}
    </SignupShell>
  );
}

/* ------------------------------------------------------------------
   SIGN-UP
   One question per screen, generous space, and from the moment a
   language is chosen every word that follows is in it.
------------------------------------------------------------------ */
export function SignupShell({ step, steps, onBack, title, sub, above, children, footer }) {
  const t = useT();
  /* No progress bar. The number of steps differs by account type — a
     coach and a junior player walk different lengths — so a bar
     promising "3 of 5" would be lying to somebody. A back arrow and a
     title are enough to know where you are.

     The body does not scroll: everything on a sign-up step should be
     visible at once, or the step is doing too much. */
  return (
    <div className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
      <div className="flex items-center px-1.5 shrink-0" style={{ height: 52 }}>
        {onBack
          ? <button onClick={() => { haptic(6); onBack(); }} aria-label={tr("Back")} className="p-2 active:opacity-40"><ChevronLeft size={23} color={t.ink} strokeWidth={2} /></button>
          : <span style={{ width: 39 }} />}
      </div>

      <div className="flex-1 flex flex-col px-7 min-h-0">
        <h1 style={{ ...TYPE.hero, color: t.ink, animation: "fadeUp 560ms cubic-bezier(.22,1,.36,1) both" }}>{title}</h1>
        {sub && <p className="mt-2.5" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.5, color: t.faint,
                     animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 60ms both" }}>{sub}</p>}
        <div className="flex-1 flex flex-col justify-center min-h-0" style={{ paddingTop: 20, paddingBottom: 12 }}>
          {above}{children}
        </div>
      </div>

      {footer && <div className="px-7 pt-2 shrink-0" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>{footer}</div>}
    </div>
  );
}

/* A choice card. Used for every pick in the flow so the whole sign-up
   has one rhythm rather than five different ones. */
export function Choice({ label, sub, icon: Icon, dot, on, onSelect, delay = 0 }) {
  const t = useT();
  return (
    <button onClick={() => { haptic(8); soft(); onSelect(); }}
            className="w-full flex items-center gap-4 px-5 text-left mb-2"
            onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            style={{ minHeight: 62, borderRadius: R.surface, background: on ? t.ink : t.surface,
                     border: `1px solid ${on ? t.ink : t.hair}`, willChange: "transform",
                     transition: "background 220ms, border-color 220ms, transform 150ms cubic-bezier(.22,1,.36,1)",
                     animation: `fadeUp 460ms cubic-bezier(.22,1,.36,1) ${delay}ms both` }}>
      {Icon && <Icon size={20} color={on ? t.accent : t.sub} strokeWidth={1.6} />}
      {dot && <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: dot }} />}
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.022em", color: on ? "#fff" : t.ink }}>{label}</span>
        {sub && <span className="block mt-0.5 truncate" style={{ fontFamily: ui, fontSize: 12.5, color: on ? "rgba(255,255,255,0.6)" : t.faint }}>{sub}</span>}
      </span>
      {on && <Check size={18} color="#fff" strokeWidth={2.1} />}
    </button>
  );
}

export function PickRegion({ region, setRegion, lang, setLang, path = "player", onDone }) {
  const t = useT();
  const [stage, setStage] = useState(region ? "lang" : "region");
  const [q, setQ] = useState("");
  const reg = REGIONS.find((r) => r.id === region);
  const L = STRINGS[lang] || STRINGS.en;

  const term = q.trim().toLowerCase();
  /* Thirty-nine countries in one flat list is a wall. Show the handful
     most likely first; everything else is one search away. */
  const COMMON = ["ie", "gb", "es", "fr", "de", "it", "nl", "pt"];
  const all = REGIONS.filter((r) => !term || r.name.toLowerCase().includes(term) || r.en.toLowerCase().includes(term));
  const shown = term ? all : REGIONS.filter((r) => COMMON.includes(r.id));
  const rest = term ? [] : REGIONS.filter((r) => !COMMON.includes(r.id));
  const choices = reg ? reg.langs.map((id) => LANGS.find((l) => l.id === id)).filter(Boolean) : [];

  if (stage === "region") return (
    <div className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="flex flex-col items-center pt-11 pb-7 shrink-0">
        <Mark size={30} color={t.ink} />
        <div className="mt-2.5" style={{ fontFamily: display, fontSize: 12.5, letterSpacing: "0.34em", fontWeight: 500, color: t.ink }}>{BRAND}</div>
      </div>
      <div className="px-7 shrink-0">
        <h1 className="mb-5" style={{ fontFamily: display, fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.033em", color: t.ink }}>
          Country
        </h1>
        <div className="flex items-center gap-2.5 px-4 mb-1" style={{ minHeight: 46, borderRadius: R.surface, background: t.wash }}>
          <Search size={15} color={t.faint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
                 className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 15, color: t.ink, background: "transparent" }} />
          {q && <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={14} color={t.faint} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-7 pt-4 pb-8 min-h-0">
        {shown.map((r, i) => (
          <button key={r.id} onClick={() => { haptic(10); soft(); setRegion(r.id);
                    if (!r.langs.includes(lang)) setLang(r.langs[0]);
                    setStage("lang"); }}
                  className="w-full flex items-center gap-3.5 text-left active:opacity-40"
                  style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
            <span style={{ fontSize: 22, lineHeight: 1, width: 30 }} aria-hidden="true">{flagOf(r.id)}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: t.ink }}>{r.name}</span>
              <span className="block truncate mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{r.en}</span>
            </span>
            <ChevronRight size={15} color={t.faint} />
          </button>
        ))}
        {shown.length === 0 && <p className="py-10 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("Nothing found.")}</p>}
      </div>
    </div>
  );

  return (
    <SignupShell step={stepOf(path, "region")} steps={stepsIn(path)} onBack={() => setStage("region")}
                 title={tr("Language")} sub={reg.name}
                 footer={<Button tone="ink" onClick={() => { hapticSuccess(); chime(); onDone(); }}>{L.continue}</Button>}>
      {choices.map((l, i) => (
        <Choice key={l.id} label={l.native} on={lang === l.id} delay={i * 55}
                sub={TRANSLATED.includes(l.id) ? null : "Interface in English for now"}
                onSelect={() => setLang(l.id)} />
      ))}
    </SignupShell>
  );
}

/* After choosing Player: is this for you, a child, or both. It decides
   whether the account gets managed profiles, so it belongs here rather
   than buried in settings later. */
export function PickSport({ lang, path = "player", onPick, onBack }) {
  const L = STRINGS[lang] || STRINGS.en;
  const entries = Object.entries(SPORTS);
  const [sel, setSel] = useState(null);
  return (
    <SignupShell step={stepOf(path, "sport")} steps={stepsIn(path)} onBack={onBack} title={tr("Sport")}
                 footer={<Button tone="ink" disabled={!sel} onClick={() => { hapticSuccess(); onPick(sel); }}>{L.continue}</Button>}>
      {entries.map(([id, sp], i) => (
        <Choice key={id} label={sp.label} dot={sp.theme.accent} on={sel === id} delay={i * 45}
                onSelect={() => setSel(id)} />
      ))}
    </SignupShell>
  );
}

export function PickRole({ sport, lang, path = "player", onPick, onBack }) {
  const L = STRINGS[lang] || STRINGS.en;
  const [sel, setSel] = useState(null);
  /* One question at a time. Coach or player first; what kind of coach,
     or what kind of player, comes next. Four options at once made
     someone read all four to find themselves. */
  return (
    <SignupShell onBack={onBack} title={tr("Coach or player")}
                 footer={<Button tone="ink" disabled={!sel} onClick={() => { hapticSuccess(); onPick(sel); }}>{L.continue}</Button>}>
      <Choice label={tr("Coach")}  on={sel === "coach"}  onSelect={() => setSel("coach")} />
      <Choice label={tr("Player")} on={sel === "player"} onSelect={() => setSel("player")} delay={55} />
    </SignupShell>
  );
}

/* Which kind of player: an adult signing themselves up, a parent
   setting up for their child, or someone under 18 joining directly. */
export function PickPlayerType({ lang, onPick, onBack }) {
  const L = STRINGS[lang] || STRINGS.en;
  const [sel, setSel] = useState(null);
  return (
    <SignupShell onBack={onBack} title={tr("Player type")}
                 footer={<Button tone="ink" disabled={!sel} onClick={() => { hapticSuccess(); onPick(sel); }}>{L.continue}</Button>}>
      <Choice label={tr("Adult player")}    on={sel === "adult"}  onSelect={() => setSel("adult")} />
      <Choice label={tr("Under 18")}        on={sel === "junior"} onSelect={() => setSel("junior")} delay={55} />
      <Choice label={tr("Parent")}          on={sel === "parent"} onSelect={() => setSel("parent")} delay={110} />
    </SignupShell>
  );
}

/* Which kind of coach. This shapes what the account can do later, and
   eventually how it is billed — but nothing is charged during the
   pilot, so no pricing is shown or implied here. */
export function PickCoachType({ lang, onPick, onBack }) {
  const L = STRINGS[lang] || STRINGS.en;
  const [sel, setSel] = useState(null);
  return (
    <SignupShell onBack={onBack} title={tr("Coach type")}
                 footer={<Button tone="ink" disabled={!sel} onClick={() => { hapticSuccess(); onPick(sel); }}>{L.continue}</Button>}>
      <Choice label={tr("Head coach")}      on={sel === "head"}      onSelect={() => setSel("head")} />
      <Choice label={tr("Assistant coach")} on={sel === "assistant"} onSelect={() => setSel("assistant")} delay={55} />
    </SignupShell>
  );
}

export function CreateAccount({ role, step = 3, lang, onDone, onBack }) {
  const t = useT(); const L = STRINGS[lang] || STRINGS.en;
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [pass, setPass] = useState(""); const [phone, setPhone] = useState("");
  const [d, setD] = useState(""); const [m, setM] = useState(""); const [y, setY] = useState("");
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const mark = (k) => setTouched((x) => ({ ...x, [k]: true }));
  const dRef = useRef(null), mRef = useRef(null), yRef = useRef(null);
  const dobWrap = useRef(null);
  const [flash, setFlash] = useState(false);

  const age = (() => {
    const dd = Number(d), mm = Number(m), yy = Number(y);
    if (!dd || !mm || y.length !== 4) return null;
    if (dd > 31 || mm > 12) return "invalid";
    const today = new Date(2026, 6, 24);
    const born = new Date(yy, mm - 1, dd);
    if (isNaN(born.getTime()) || born > today) return "invalid";
    let a = today.getFullYear() - yy;
    if (today.getMonth() < mm - 1 || (today.getMonth() === mm - 1 && today.getDate() < dd)) a -= 1;
    return a;
  })();

  const show = (k) => touched[k] || tried;
  const errName  = show("name")  && name.trim().length < 2 ? "Please enter your full name" : null;
  const errEmail = show("email") && !email.includes("@")   ? "That doesn't look like an email address" : null;
  const errPass  = show("pass")  && pass.length < 6        ? "Use at least 6 characters" : null;
  const dobBad   = (show("dob") || tried) && (age === null || age === "invalid" || age < CONSENT_AGE);
  const dobMsg   = age === "invalid" ? "That date doesn't exist"
                 : age !== null && age !== "invalid" && age < CONSENT_AGE
                   ? `You need to be ${CONSENT_AGE} or over. A parent can add you to their account instead.`
                   : "Enter your date of birth";
  const valid = name.trim().length > 1 && email.includes("@") && pass.length >= 6
                && age !== null && age !== "invalid" && age >= CONSENT_AGE;

  return (
    <Frame step={stepOf(role === "coach" ? "coach" : "player", "account")} steps={stepsIn(role === "coach" ? "coach" : "player")} onBack={onBack}
           footer={
             <Button tone="ink" onClick={() => {
               if (valid) { hapticSuccess(); onDone({ name: name.trim(), email: email.trim(), password: pass, phone: phone.trim(), dob: { d, m, y }, age }); return; }
               setTried(true); hapticWarn(); decline();
               const dobIssue = age === null || age === "invalid" || age < CONSENT_AGE;
               if (dobIssue && dobWrap.current) { dobWrap.current.scrollIntoView({ behavior: "smooth", block: "center" }); setFlash(true); setTimeout(() => setFlash(false), 900); }
             }}>{L.continue}</Button>
           }>
      <div className="pt-8">
        <Headline>{L.yourDetails}</Headline>
        <Sub>{role === "coach" ? "The name on your invites and in their app."
              : role === "parent" ? "Your own details — you'll add your children next."
              : "Set up your account."}</Sub>

        {/* Date of birth sits high on the page: it's the one field that
            can stop the whole sign-up, so it shouldn't be found last. */}
        <div ref={dobWrap} className="mt-7 mb-1" style={{ transition: "background 220ms cubic-bezier(.22,1,.36,1)", background: flash ? "#F6E7E4" : "transparent", borderRadius: R.surface, padding: flash ? 10 : 0, margin: flash ? "28px -10px 4px" : "28px 0 4px" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <CalendarDays size={15} color={dobBad ? DANGER : t.faint} strokeWidth={1.6} />
            <span style={{ fontFamily: ui, fontSize: 12.5, color: dobBad ? DANGER : t.sub }}>{L.dateOfBirth}</span>
          </div>
          <div className="flex items-center gap-2">
            <DobBox ref={dRef} value={d} onChange={setD} ph={tr("DD")} len={2} bad={dobBad} onDone={() => mRef.current && mRef.current.focus()} />
            <DobBox ref={mRef} value={m} onChange={setM} ph={tr("MM")} len={2} bad={dobBad} onDone={() => yRef.current && yRef.current.focus()} />
            <DobBox ref={yRef} value={y} onChange={setY} ph={tr("YYYY")} len={4} bad={dobBad} onDone={() => { mark("dob"); yRef.current && yRef.current.blur(); }} />
            {typeof age === "number" && age >= CONSENT_AGE && (
              <span className="flex items-center gap-1.5 ml-1"><Check size={15} color={STEADY} strokeWidth={2.1} />
                <span style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{age}</span></span>
            )}
          </div>
          {dobBad
            ? <p className="mt-2" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.5, color: DANGER }}>{dobMsg}</p>
            : <p className="mt-2" style={{ ...TYPE.caption, color: t.faint }}>{`${CONSENT_AGE}+ only. Under 18s are added by a parent.`}</p>}
        </div>

        <div className="mt-5">
          <Field label={L.fullName} value={name} onChange={setName} onBlur={() => mark("name")} ph={tr("Ray Doyle")} Icon={User} error={errName} />
          <Field label={L.email} value={email} onChange={setEmail} onBlur={() => mark("email")} ph="you@example.ie" Icon={Mail} type="email" error={errEmail} />
          <Field label={L.mobile} value={phone} onChange={setPhone} ph="+353 87 123 4567" Icon={Phone} />
          <Field label={L.password} value={pass} onChange={setPass} onBlur={() => mark("pass")} ph="At least 6 characters" Icon={Lock} type="password" error={errPass} reveal />
        </div>
        <p className="mt-5 text-center pb-6" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.5, color: t.faint }}>
          By continuing you accept the {BRAND} Terms and Privacy Policy.
        </p>
      </div>
    </Frame>
  );
}

/* Where do you coach? A club, or on your own. */
function CoachClub({ sport, onDone, onBack }) {
  const t = useT();
  const [nameText, setNameText] = useState("");
  const ready = nameText.trim().length > 1;
  return (
    <Frame step={stepOf("coach", "club")} steps={stepsIn("coach")} onBack={onBack}
           footer={<Button tone="ink" disabled={!ready} onClick={() => onDone(nameText.trim())}>{tr("Next")}</Button>}>
      <div className="pt-8">
        <Headline>{tr("Your club")}</Headline>
        <Sub>Your club, your academy, or just your own name — whatever players know you by.</Sub>
        <div className="mt-8"><VoiceInput value={nameText} onChange={setNameText} ph={tr("Hollow Brook Golf")} autoFocus /></div>
        {ready && (
          <div className="mt-6">
            <div className="uppercase mb-3" style={{ fontFamily: ui, fontSize: 10.5, letterSpacing: "0.13em", fontWeight: 600, color: t.faint }}>{tr("Preview")}</div>
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${t.accent}0F`, border: `0.5px solid ${t.accent}2E` }}>
              <Mark size={26} color={SPORTS[sport].theme.accent} />
              <span className="flex-1" style={{ fontFamily: display, fontSize: 17, color: "#fff" }}>{nameText.trim()}</span>
            </div>
          </div>
        )}
        <div style={{ height: 26 }} />
      </div>
    </Frame>
  );
}

/* Roster size drives the recommendation; the coach can still override. */
function CoachPlan({ onDone, onBack }) {
  const t = useT();
  const [band, setBand] = useState(null);
  const [plan, setPlan] = useState(null);
  const pick = (b) => { haptic(8); setBand(b); setPlan(BAND_TO_PLAN[b]); };
  return (
    <Frame step={stepOf("coach", "plan")} steps={stepsIn("coach")} onBack={onBack}
           footer={plan ? (<>
             <Button tone="ink" onClick={() => onDone(PLANS.find((p) => p.id === plan))}>Start 30 days free</Button>
             <p className="mt-3 text-center" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.5, color: t.faint }}>
               Nothing is charged today. Cancel any time in the App Store.
             </p>
           </>) : null}>
      <div className="pt-8">
        <Headline>{tr("Your plan")}</Headline>
        <Sub>{tr("Your players never pay. The plan only covers you.")}</Sub>
        <div className="flex flex-wrap gap-2 mt-7">
          {ROSTER_BANDS.map((b) => {
            const on = band === b;
            return (
              <button key={b} onClick={() => pick(b)} className="rounded-full px-4 active:opacity-60"
                      style={{ minHeight: 42, background: on ? t.ink : t.surface, border: `1px solid ${on ? t.ink : t.hair}`,
                               fontFamily: ui, fontSize: 14, fontWeight: 600, color: on ? "#fff" : t.sub }}>{b}</button>
            );
          })}
        </div>

        {band && (
          <div className="mt-8">
            <div className="uppercase mb-3" style={{ fontFamily: ui, fontSize: 10.5, letterSpacing: "0.13em", fontWeight: 600, color: t.faint }}>
              Recommended for you
            </div>
            <div className="flex flex-col gap-3">
              {PLANS.map((p) => {
                const on = plan === p.id;
                const rec = BAND_TO_PLAN[band] === p.id;
                return (
                  <button key={p.id} onClick={() => { haptic(8); setPlan(p.id); }} className="w-full rounded-3xl p-5 text-left"
                          style={{ background: on ? t.ink : t.surface, border: `1px solid ${on ? t.ink : t.hair}`, transition: "background 180ms" }}>
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-2">
                        <span style={{ fontFamily: display, fontSize: 23, color: on ? "#fff" : t.ink }}>{p.name}</span>
                        {rec && <span className="rounded-full px-2.5 py-1" style={{ background: on ? STEADY : t.wash, fontFamily: ui, fontSize: 10, fontWeight: 600, color: on ? t.onAccent : t.ink }}>{tr("BEST FIT")}</span>}
                      </span>
                      <span style={{ fontFamily: display, fontSize: 22, color: on ? "#fff" : t.ink }}>€{p.price}<span style={{ fontFamily: ui, fontSize: 12, color: on ? "rgba(255,255,255,0.55)" : t.faint }}>/mo</span></span>
                    </div>
                    <div className="mt-1" style={{ fontFamily: ui, fontSize: 12.5, color: on ? "rgba(255,255,255,0.6)" : t.faint }}>{p.blurb}</div>
                    <div className="mt-3.5 flex flex-col gap-1.5">
                      {p.lines.map((l) => (
                        <span key={l} className="flex items-center gap-2">
                          <Check size={12} color={on ? t.accent : t.faint} strokeWidth={2.1} />
                          <span style={{ fontFamily: ui, fontSize: 12.5, color: on ? "rgba(255,255,255,0.8)" : t.sub }}>{l}</span>
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ height: 26 }} />
      </div>
    </Frame>
  );
}

function CoachCode({ sport, club, plan, onDone, onBack }) {
  const t = useT(); const s = SPORTS[sport];
  useEffect(() => { chime(); }, []);
  return (
    <Frame step={stepOf("coach", "code")} steps={stepsIn("coach")} onBack={onBack} footer={<Button tone="ink" onClick={onDone}>{tr("Go to dashboard")}</Button>}>
      <div className="pt-8">
        <Headline>{tr("You're set up")}</Headline>
        <Sub>Share this with players. They join free, in seconds.</Sub>
        <div className="flex flex-col items-center mt-9">
          <div style={{ fontFamily: display, fontSize: 44, letterSpacing: "0.16em", color: t.ink }}>RD4K9P</div>
          <div className="rounded-3xl mt-6 p-5" style={{ border: `1px solid ${t.hair}` }}><QrSvg accent={s.theme.accent} /></div>
          <button className="mt-7 flex items-center gap-2 active:opacity-50" style={{ fontFamily: ui, fontSize: 15.5, fontWeight: 600, color: t.ink }}><Share2 size={16} /> Share invite</button>
        </div>
        <Card className="mt-8 mb-4">
          {club && <Row label={tr("Club")} value={club} />}
          {plan && <Row label={tr("Plan")} value={`${plan.name} · €${plan.price}/mo`} />}
          <Row label={tr("Free until")} value="31 August" last />
        </Card>
      </div>
    </Frame>
  );
}

/* Player intake: connect, then say who is actually playing. The child
   question is asked here rather than buried in settings. */
function ConnectPlayer({ sport, onDone, onBack }) {
  const t = useT(); const s = SPORTS[sport];
  const [mode, setMode] = useState("Code"); const [d, setD] = useState(""); const [found, setFound] = useState(false);
  useEffect(() => { if (d.length !== 6) { setFound(false); return; } const x = setTimeout(() => { setFound(true); haptic(14); tone(720, 0.14, 0.045); }, 550); return () => clearTimeout(x); }, [d]);
  const coach = COACHES[sport][0];
  return (
    <Frame step={stepOf("player", "connect")} steps={stepsIn("player")} onBack={onBack} footer={mode === "Code"
      ? <Button tone="ink" disabled={!found} onClick={() => onDone(coach)}>Join {coach.name.split(" ")[0]}</Button>
      : <Button tone="ink" onClick={() => onDone(coach)}>{tr("Simulate a scan")}</Button>}>
      <div className="pt-8">
        <Headline>{tr("Your coach")}</Headline>
        <Sub>{tr("They'll have given you a six-character code.")}</Sub>
        <div className="mt-6"><Segmented options={["Code", "Scan"]} value={mode} onChange={setMode} /></div>
        {mode === "Code" ? (
          <>
            <div className="mt-7 mb-3"><CodePad value={d} onChange={setD} /></div>
            <div className="text-center" style={{ minHeight: 46 }}>
              {found ? (
                <div className="flex items-center gap-3 text-left"><Avatar name={coach.name} size={40} />
                  <span className="flex-1"><span className="block" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.ink }}>{coach.name}</span>
                    <span className="block" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{s.label} · {coach.club}</span></span>
                  <Check size={19} color={s.theme.accent} strokeWidth={2.1} /></div>
              ) : <span style={{ ...TYPE.small, color: t.faint }}>{tr("Six characters from your coach")}</span>}
            </div>
          </>
        ) : (
          <div className="mt-8"><div className="relative rounded-3xl overflow-hidden mx-auto" style={{ width: 224, height: 224, background: "#15201A" }}>
            {[["0","0"],["1","0"],["0","1"],["1","1"]].map(([x, y]) => (<span key={`${x}${y}`} className="absolute" style={{ width: 32, height: 32, top: y === "0" ? 18 : "auto", bottom: y === "1" ? 18 : "auto", left: x === "0" ? 18 : "auto", right: x === "1" ? 18 : "auto",
                     borderTop: y === "0" ? `2.5px solid ${s.theme.accent}` : "none", borderBottom: y === "1" ? `2.5px solid ${s.theme.accent}` : "none", borderLeft: x === "0" ? `2.5px solid ${s.theme.accent}` : "none", borderRight: x === "1" ? `2.5px solid ${s.theme.accent}` : "none", borderRadius: 7 }} />))}
            <div className="absolute inset-0 flex items-center justify-center"><QrCode size={42} color="rgba(255,255,255,0.28)" /></div></div>
          </div>
        )}
      </div>
    </Frame>
  );
}

/* ==================================================================
   LESSON DECK
================================================================== */
const CARD_H = 292, CARD_STEP = CARD_H + 14;

/* A LESSON, AT A GLANCE

   The facts sit at the top in one band — focus, coach, when — then a
   rule, then the first frame of whatever was filmed. Where there is no
   footage the space isn't wasted or apologetic: it carries the mark
   over a field of the sport's own colour. */
function LessonCard({ lesson, onOpen, active, saved }) {
  const t = useT();
  const has = (lesson.videos || 0) > 0;

  return (
    <button onClick={() => { haptic(9); soft(); onOpen && onOpen(); }}
            onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.985)"; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            className="w-full text-left overflow-hidden active:opacity-95"
            style={{ height: CARD_H, borderRadius: R.surface, background: t.surface,
                     boxShadow: active ? ELEV.raise : ELEV.rest, willChange: "transform",
                     transition: "transform 160ms cubic-bezier(.34,1.56,.64,1), box-shadow 280ms" }}>

      {/* the facts, in one band */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline gap-2.5 mb-2">
          <span style={{ ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>
            {lesson.d} {lesson.m}
          </span>
          <span className="rounded-full" style={{ width: 3, height: 3, background: t.hair }} />
          <span style={{ ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>
            {lesson.type === "Group" ? tr("Group") : tr("Private")}
          </span>
          <span className="flex-1" />
          {saved && <Download size={12} color={t.faint} />}
        </div>
        <div className="truncate" style={{ ...TYPE.title, fontSize: 24, color: t.ink }}>{lesson.focus}</div>
        {lesson.coach && (
          <div className="mt-1.5 truncate" style={{ ...TYPE.small, color: t.faint }}>{lesson.coach}</div>
        )}
      </div>

      {/* the rule */}
      <div style={{ height: 0.5, background: HAIR(t.ink, 0.14) }} />

      {/* the first frame, or the mark on the sport's colour */}
      <div className="relative" style={{ height: CARD_H - 118 }}>
        {has ? (
          <>
            {/* a still: horizon band, ground, and the sport's light */}
            <div className="absolute inset-0" style={{ background: "#121618" }} />
            <div className="absolute" style={{ inset: 0,
                   background: `linear-gradient(180deg, ${t.mark}30 0%, ${t.mark}10 46%, #0E1213 47%, #0B0F10 100%)` }} />
            <div className="absolute" style={{ left: 0, right: 0, top: "47%", height: 1,
                   background: `${t.mark}55` }} />
            <div className="absolute" style={{ inset: 0,
                   background: `radial-gradient(60% 45% at 50% 44%, ${t.mark}2E 0%, transparent 70%)` }} />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full flex items-center justify-center"
                    style={{ width: 52, height: 52,
                             background: "rgba(255,255,255,0.14)",
                             backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                             border: "1px solid rgba(255,255,255,0.22)",
                             boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}>
                <Play size={18} color="#fff" style={{ marginLeft: 2 }} />
              </span>
            </span>
            {lesson.videos > 1 && (
              <span className="absolute rounded-full px-2 py-1"
                    style={{ bottom: 12, right: 12, background: "rgba(0,0,0,0.45)",
                             ...TYPE.caption, fontSize: 10, color: "#fff" }}>
                {lesson.videos}
              </span>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
               style={{ background: `radial-gradient(110% 80% at 50% 45%, ${t.mark}1C 0%, ${t.mark}08 70%)` }}>
            <span style={{ opacity: 0.5, animation: "markBreathe 5s ease-in-out infinite" }}>
              <Mark size={34} color={t.mark} />
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function VDeck({ lessons, go, push, saved }) {
  const t = useT(); const [a, setA] = useState(0);
  return (
    <>
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory px-6"
           onScroll={(e) => {
             const n = Math.min(lessons.length - 1, Math.round(e.currentTarget.scrollTop / CARD_STEP));
             if (n !== a) { setA(n); haptic(7); }   /* one tick per card as it lands */
           }}
           style={{ scrollbarWidth: "none", scrollSnapType: "y mandatory", overscrollBehaviorY: "contain" }}>
        {lessons.map((l, i) => (<div key={l.id} className="snap-center" style={{ scrollSnapAlign: "center", scrollSnapStop: "always",
                          paddingBottom: i === lessons.length - 1 ? 24 : 14 }}><LessonCard lesson={l} active={i === a} saved={saved.includes(l.id)} onOpen={() => push("lesson")} /></div>))}
      </div>
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-2.5">{lessons.map((l, i) => (<span key={l.id} className="rounded-full" style={{ width: 5, height: i === a ? 15 : 5, background: i === a ? t.ink : t.hair, transition: "height 200ms" }} />))}</div>
    </>
  );
}

/* ==================================================================
   FAMILY — profiles + coach connections in one switcher
================================================================== */
function FamilyPill({ name, tint, onOpen }) {
  const t = useT();
  return (
    <button onClick={() => { haptic(6); onOpen(); }} className="flex items-center gap-2 rounded-full pl-1.5 pr-2.5 active:opacity-50" style={{ minHeight: 30, background: t.wash }}>
      <Avatar name={name} size={22} tint={tint} />
      <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{(name || "").split(" ")[0]}</span>
      <ChevronDown size={13} color={t.sub} />
    </button>
  );
}
/* Both kept at module scope for the same reason as DobBox above: defined
   inside FamilySheet they'd be new component types on every keystroke. */
function SportListPick({ t, onPick, title, onBack }) {
  return (
    <>
      <div className="flex items-center gap-1 mb-4 -ml-2"><button onClick={onBack} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>
        <h2 style={{ fontFamily: display, fontSize: 23, color: t.ink }}>{title}</h2></div>
      <Card>{Object.entries(SPORTS).map(([id, sp], i, arr) => (
        <Row key={id} label={sp.label} chevron last={i === arr.length - 1}
             icon={<span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: sp.theme.mark }} />}
             onToggle={() => onPick(id)} />
      ))}</Card>
    </>
  );
}
function CoachCodeStep({ t, newSport, code, setCode, found, who, onBack, onJoin }) {
  return (
    <>
      <div className="flex items-center gap-1 mb-1 -ml-2"><button onClick={onBack} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>
        <h2 style={{ fontFamily: display, fontSize: 22, color: t.ink }}>{SPORTS[newSport]?.label} coach code</h2></div>
      <p className="mb-3 px-1" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{who}</p>
      <div className="mb-2"><CodePad value={code} onChange={setCode} compact /></div>
      <div className="mb-4" style={{ minHeight: 44 }}>
        {found ? (
          <div className="flex items-center gap-3"><Avatar name={found.name} size={38} />
            <span className="flex-1"><span className="block" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.ink }}>{found.name}</span>
              <span className="block" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{found.club}</span></span>
            <Check size={19} color={STEADY} strokeWidth={2.1} /></div>
        ) : <p className="text-center pt-3" style={{ ...TYPE.small, color: t.faint }}>{tr("Six characters from the coach")}</p>}
      </div>
      <Button disabled={!found} onClick={() => onJoin(found)}>{found ? `Join ${found.name.split(" ")[0]}` : "Enter code"}</Button>
    </>
  );
}

function FamilySheet({ profiles, activeProfileId, onSwitchProfile, onAddChild, conns, activeConnId, onPickConn, onAddConn, onViewGroups, mySports = [], main, onSetMain, onPhoto, close, say }) {
  const t = useT();
  const [stage, setStage] = useState("root");   // root | child | childSport | childCode | sport | code
  const [childName, setChildName] = useState("");
  const [cd, setCd] = useState(""); const [cm, setCm] = useState(""); const [cy, setCy] = useState("");
  const cmRef = useRef(null), cyRef = useRef(null);
  const childAge = (() => {
    const dd = Number(cd), mm = Number(cm), yy = Number(cy);
    if (!dd || !mm || cy.length !== 4 || dd > 31 || mm > 12) return null;
    const today = new Date(2026, 6, 24), born = new Date(yy, mm - 1, dd);
    if (isNaN(born.getTime()) || born > today) return null;
    let a = today.getFullYear() - yy;
    if (today.getMonth() < mm - 1 || (today.getMonth() === mm - 1 && today.getDate() < dd)) a -= 1;
    return a;
  })();
  const childAdult = typeof childAge === "number" && childAge >= ADULT_AGE;
  /* When they age out, the account should hand itself over rather than
     quietly keep an adult under someone else's management. */
  const turns18 = typeof childAge === "number" && !childAdult
    ? MONTHS_FULL[(Number(cm) || 1) - 1] + " " + (Number(cy) + ADULT_AGE) : null;
  const [newSport, setNewSport] = useState(null); const [code, setCode] = useState(""); const [found, setFound] = useState(null);
  const myConns = conns.filter((c) => c.profileId === activeProfileId);
  const kids = profiles.filter((p) => p.age);

  useEffect(() => {
    if (code.length !== 6 || !newSport) { setFound(null); return; }
    const x = setTimeout(() => { setFound(COACHES[newSport][0]); haptic(14); tone(720, 0.12, 0.04); }, 500);
    return () => clearTimeout(x);
  }, [code, newSport]);


  const SportList = ({ onPick, title, onBack }) => (
    <>
      <div className="flex items-center gap-1 mb-4 -ml-2"><button onClick={onBack} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>
        <h2 style={{ fontFamily: display, fontSize: 23, color: t.ink }}>{title}</h2></div>
      <Card>{Object.entries(SPORTS).map(([id, sp], i, arr) => (
        <Row key={id} label={sp.label} chevron last={i === arr.length - 1}
             icon={<span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: sp.theme.mark }} />}
             onToggle={() => { setNewSport(id); setCode(""); setFound(null); onPick(id); }} />
      ))}</Card>
    </>
  );

  const CodeStep = ({ onBack, onJoin, who }) => (
    <>
      <div className="flex items-center gap-1 mb-1 -ml-2"><button onClick={onBack} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>
        <h2 style={{ fontFamily: display, fontSize: 22, color: t.ink }}>{SPORTS[newSport]?.label} coach code</h2></div>
      <p className="mb-3 px-1" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{who}</p>
      <div className="mb-2"><CodePad value={code} onChange={setCode} compact /></div>
      <div className="mb-4" style={{ minHeight: 44 }}>
        {found ? (
          <div className="flex items-center gap-3"><Avatar name={found.name} size={38} />
            <span className="flex-1"><span className="block" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.ink }}>{found.name}</span>
              <span className="block" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{found.club}</span></span>
            <Check size={19} color={STEADY} strokeWidth={2.1} /></div>
        ) : <p className="text-center pt-3" style={{ ...TYPE.small, color: t.faint }}>{tr("Six characters from the coach")}</p>}
      </div>
      <Button disabled={!found} onClick={() => onJoin(found)}>{found ? `Join ${found.name.split(" ")[0]}` : "Enter code"}</Button>
    </>
  );

  if (stage === "child") return (
    <>
      <div className="flex items-center gap-1 mb-5 -ml-2"><button onClick={() => setStage("root")} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>
        <h2 style={{ fontFamily: display, fontSize: 23, color: t.ink }}>Add someone under 18</h2></div>
      <div className="mb-5"><VoiceInput value={childName} onChange={setChildName} ph={tr("Their name")} autoFocus /></div>

      <div className="mb-2.5" style={{ fontFamily: ui, fontSize: 12.5, color: t.sub }}>{tr("Date of birth")}</div>
      <div className="flex items-center gap-2 mb-4">
        <DobBox value={cd} onChange={setCd} ph={tr("DD")} len={2} bad={childAdult} onDone={() => cmRef.current && cmRef.current.focus()} />
        <DobBox ref={cmRef} value={cm} onChange={setCm} ph={tr("MM")} len={2} bad={childAdult} onDone={() => cyRef.current && cyRef.current.focus()} />
        <DobBox ref={cyRef} value={cy} onChange={setCy} ph={tr("YYYY")} len={4} bad={childAdult} />
        {typeof childAge === "number" && !childAdult && (
          <span className="flex items-center gap-1.5 ml-1"><Check size={15} color={STEADY} strokeWidth={2.1} />
            <span style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{childAge}</span></span>
        )}
      </div>

      {childAdult ? (
        <div className="p-4 mb-5" style={{ borderRadius: R.surface, background: `${DANGER}14` }}>
          <p style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: DANGER }}>
            At {ADULT_AGE} or over they hold their own account — have them sign up themselves and connect to a coach directly.
          </p>
        </div>
      ) : typeof childAge === "number" ? (
        <div className="p-4 mb-5" style={{ borderRadius: R.surface, background: t.wash }}>
          <p style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: t.sub }}>
            You'll manage their coaching until they turn {ADULT_AGE}{turns18 ? ` in ${turns18}` : ""}, when they're invited to take
            over their own account. They can sign in on their own device with your family code.
          </p>
        </div>
      ) : null}

      <Button disabled={!childName.trim() || typeof childAge !== "number" || childAdult} onClick={() => setStage("childSport")}>
        Next — their sport
      </Button>
    </>
  );

  if (stage === "childSport") return <SportListPick t={t} title={`${childName.split(" ")[0]}'s sport`} onBack={() => setStage("child")}
    onPick={(id) => { setNewSport(id); setCode(""); setFound(null); setStage("childCode"); }} />;

  if (stage === "childCode") return (
    <CoachCodeStep t={t} newSport={newSport} code={code} setCode={setCode} found={found}
              who={`${childName.split(" ")[0]} joins this coach.`} onBack={() => setStage("childSport")}
              onJoin={(coach) => { onAddChild(childName.trim(), childAge, newSport, coach, turns18); close(); }} />
  );

  if (stage === "sport") return <SportListPick t={t} title={tr("Sport")} onBack={() => setStage("root")}
    onPick={(id) => { setNewSport(id); setCode(""); setFound(null); setStage("code"); }} />;

  if (stage === "code") return (
    <CoachCodeStep t={t} newSport={newSport} code={code} setCode={setCode} found={found}
              who={`For ${profiles.find((p) => p.id === activeProfileId)?.name.split(" ")[0]}.`} onBack={() => setStage("sport")}
              onJoin={(coach) => { onAddConn(newSport, coach); close(); }} />
  );

  return (
    <>
      <h2 className="mb-5" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>
        {kids.length ? "Profiles" : "Your account"}
      </h2>
      {kids.length > 0 && (
        <Card className="mb-4">
          {profiles.map((pf, i) => (
            <Row key={pf.id} label={pf.name}
                 sub={!pf.age ? "You" : pf.turns18 ? `Age ${pf.age} · yours until ${pf.turns18}` : `Age ${pf.age} · managed by you`}
                 checked={pf.id === activeProfileId} last={i === profiles.length - 1}
                 icon={<Avatar name={pf.name} size={38} />} onToggle={() => { onSwitchProfile(pf.id); close(); }} />
          ))}
        </Card>
      )}

      <Eyebrow>{kids.length ? `${profiles.find((p) => p.id === activeProfileId)?.name.split(" ")[0]}'s coaches` : "Your coaches"}</Eyebrow>
      <Card className="mb-4">
        {myConns.length === 0 ? (
          <div className="p-6 text-center"><p style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{tr("No coach connected yet.")}</p></div>
        ) : myConns.map((c, i) => (
          <Row key={c.id} label={c.coach} sub={`${SPORTS[c.sport].label} · ${c.club}`} checked={c.id === activeConnId} last={i === myConns.length - 1}
               icon={<span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: SPORTS[c.sport].theme.mark }} />}
               onToggle={() => { onPickConn(c.id); close(); }} />
        ))}
      </Card>

      {mySports.length > 1 && (
        <>
          <div className="mb-2.5 px-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Main sport")}</div>
          <div className="flex flex-wrap gap-2 mb-5">
            {mySports.map((sp) => {
              const on = (main || mySports[0]) === sp;
              return (
                <button key={sp} onClick={() => { haptic(6); soft(); onSetMain && onSetMain(sp); }}
                        className="px-4 active:opacity-60"
                        style={{ minHeight: 42, borderRadius: R.pill,
                                 background: on ? SPORTS[sp].theme.accent : t.wash,
                                 ...TYPE.small, fontWeight: 500,
                                 color: on ? SPORTS[sp].theme.onAccent : t.sub,
                                 transition: "background 220ms cubic-bezier(.22,1,.36,1)" }}>
                  {SPORTS[sp].label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Card>
        <Row label={tr("Your groups")} sub={tr("Sessions you train with others")} chevron icon={<Users size={18} color={t.sub} strokeWidth={1.6} />}
             onToggle={() => { close(); onViewGroups && onViewGroups(); }} />
        <Row label={tr("Add a coach")} sub={tr("Pick the sport, then enter their code")} icon={<Plus size={18} color={t.sub} strokeWidth={2} />} onToggle={() => setStage("sport")} />
        <Row label={tr("Photos")}  chevron icon={<Camera size={17} color={t.sub} strokeWidth={1.6} />} onToggle={() => { close(); setTimeout(() => onPhoto && onPhoto(), 220); }} />
        <Row label={tr("Add someone under 18")} sub={inviteCode ? `${tr("They join with")} ${inviteCode}` : tr("Share your code")} last icon={<UserPlus size={18} color={t.sub} strokeWidth={2} />} onToggle={() => setStage("child")} />
      </Card>
    </>
  );
}

/* ==================================================================
   STATS — customizable, WTN/handicap included as headline manual stats
================================================================== */
function StatTiles({ cfg, selected, values }) {
  const t = useT();
  return (
    <div className="flex mb-5">
      {selected.map((id, i) => {
        const def = cfg.statCatalog.find((s) => s.id === id);
        const val = values[id] || cfg.statValues[id] || {};
        if (!def) return null;
        return (
          <div key={id} className="flex-1" style={{ paddingLeft: i ? 14 : 0, borderLeft: i ? `1px solid ${t.hair}` : "none" }}>
            <div style={{ ...TYPE.caption, color: t.faint }}>{def.l}</div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span style={{ fontFamily: display, fontSize: 30, lineHeight: 1, color: t.ink }}>{val.v ?? "—"}</span>
              {def.u && <span style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{def.u}</span>}
            </div>
            <div className="mt-1.5" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: def.manual ? t.faint : t.accent }}>{val.m || (def.manual ? "Self-entered" : "")}</div>
          </div>
        );
      })}
    </div>
  );
}
function StatsEditSheet({ cfg, selected, setSelected, manual, setManual, close, say }) {
  const t = useT();
  const [sel, setSel] = useState(selected);
  const [vals, setVals] = useState(manual);
  const toggle = (id) => {
    haptic(6);
    if (sel.includes(id)) setSel(sel.filter((x) => x !== id));
    else if (sel.length < 3) setSel([...sel, id]);
    else say("Pick 3 — remove one first");
  };
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>{tr("Choose your stats")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>Pick 3 for your home screen.</p>
      <Card className="mb-5">
        {cfg.statCatalog.map((s, i) => (
          <div key={s.id}>
            <Row label={s.l} sub={s.manual ? "Self-entered" : "Tracked from lessons"} checked={sel.includes(s.id)} last={i === cfg.statCatalog.length - 1 && !(s.manual && sel.includes(s.id))} onToggle={() => toggle(s.id)} />
            {s.manual && sel.includes(s.id) && (
              <div className="px-5 pb-4" style={{ borderBottom: i === cfg.statCatalog.length - 1 ? "none" : `1px solid ${t.hair}`, background: t.wash }}>
                <input value={vals[s.id] ?? cfg.statValues[s.id]?.v ?? ""} onChange={(e) => setVals({ ...vals, [s.id]: e.target.value })}
                       placeholder={`Your ${s.l}`} className="w-full outline-none pt-3" style={{ fontFamily: display, fontSize: 20, color: t.ink, background: "transparent" }} />
              </div>
            )}
          </div>
        ))}
      </Card>
      {cfg.statCatalog.some((x) => x.manual) && (
        <p className="mb-5 px-1" style={{ ...TYPE.caption, color: t.faint }}>
          Ratings are entered by you — live sync needs a federation partnership.
        </p>
      )}
      <Button disabled={sel.length === 0} onClick={() => { setSelected(sel); setManual(vals); say("Stats updated"); close(); }}>{tr("Save")}</Button>
    </>
  );
}

/* ==================================================================
   TIPS — the weekly note from the coach, accentuated
================================================================== */
function TipCard({ tip, cfg, onOpenHistory }) {
  const t = useT();
  if (!tip) return null;
  const wks = tip.weeksAgo || 0;
  const age = wks === 0 ? "Set this week" : wks === 1 ? "Set last week" : `Set ${wks} weeks ago`;
  const stale = wks >= 4;
  return (
    <button onClick={() => { haptic(6); onOpenHistory(); }} className="w-full p-5 mb-4 text-left active:opacity-90" style={{ background: t.accent, borderRadius: R.surface }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="uppercase flex items-center gap-1.5" style={{ fontFamily: ui, fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: t.onAccent, opacity: 0.85 }}>
          <Lightbulb size={12} /> Working on
        </span>
        <ChevronRight size={16} color={t.onAccent} style={{ opacity: 0.6 }} />
      </div>
      <div style={{ fontFamily: display, fontSize: 20, lineHeight: 1.25, color: t.onAccent }}>{tip.title}</div>
      <div className="mt-1.5" style={{ fontFamily: ui, fontSize: 13, lineHeight: 1.5, color: t.onAccent, opacity: 0.82 }}>{tip.body}</div>
      <div className="mt-3.5 pt-3.5 flex items-center justify-between" style={{ borderTop: `1px solid ${t.onAccent}`, borderTopColor: t.onAccent, opacity: 0.72 }}>
        <span style={{ fontFamily: ui, fontSize: 11.5, color: t.onAccent }}>{age}{tip.focus ? ` · ${tip.focus}` : ""}</span>
        {stale && <span style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.onAccent }}>{tr("Still current")}</span>}
      </div>
    </button>
  );
}

function TipsHistory({ cfg, tips, pop }) {
  const t = useT();
  const [f, setF] = useState("All");
  const chips = ["All", ...cfg.focus.map((x) => x.label)];
  const shown = f === "All" ? tips : tips.filter((x) => x.focus === f);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("What you've worked on")} onBack={pop} meta={`${tips.length} from your coach`}>
        {tips.length === 0 ? (
          <div className="px-6"><Card className="p-8 text-center"><p style={{ fontFamily: ui, fontSize: 14.5, color: t.sub }}>Nothing yet — your coach will set one after your next lesson.</p></Card></div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto px-6 pb-5" style={{ scrollbarWidth: "none" }}>
              {chips.map((c) => { const on = f === c; return (
                <button key={c} onClick={() => { haptic(6); setF(c); }} className="rounded-full px-4 shrink-0 active:opacity-60"
                        style={{ minHeight: 36, background: on ? t.ink : "transparent", border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 13, fontWeight: 600, color: on ? "#fff" : t.sub }}>{c}</button>
              ); })}
            </div>
            <div className="px-6 pb-4">
              {shown.length === 0 ? (
                <Card className="p-8 text-center"><p style={{ fontFamily: ui, fontSize: 14.5, color: t.sub }}>Nothing under {f} yet.</p></Card>
              ) : shown.map((tip, i) => (
                <Card key={tip.id} className="p-5 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded-full px-2.5 py-1" style={{ background: t.wash, fontFamily: ui, fontSize: 10.5, fontWeight: 600, color: t.ink }}>{tip.focus}</span>
                    <span style={{ ...TYPE.caption, color: t.faint }}>{tip.date}</span>
                  </div>
                  <div style={{ fontFamily: display, fontSize: 18, color: t.ink }}>{tip.title}</div>
                  <p className="mt-1.5" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.55, color: t.sub }}>{tip.body}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </Screen>
    </SwipeBack>
  );
}
function TipBody({ focusLabel, prompts, onSet, close }) {
  const t = useT();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>{tr("What are they working on?")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>Sits at the top of their home until you replace it. Filed under {focusLabel}.</p>
      {prompts && prompts.length > 0 && !title && (
        <div className="flex flex-wrap gap-2 mb-4">
          {prompts.map((pr) => (
            <button key={pr} onClick={() => { haptic(6); setTitle(pr); }} className="px-3.5 active:opacity-60"
                    style={{ minHeight: 36, borderRadius: R.surface, background: t.wash, fontFamily: ui, fontSize: 12.5, color: t.sub }}>{pr}</button>
          ))}
        </div>
      )}
      <div className="mb-3"><VoiceInput value={title} onChange={setTitle} ph={tr("Short headline")} /></div>
      <div className="mb-6"><VoiceArea value={body} onChange={setBody} rows={3} ph={tr("One or two sentences")} /></div>
      <Button disabled={!title.trim()} onClick={() => { onSet({ title: title.trim(), body: body.trim() || "Keep at what we worked on." }); close(); }}>{tr("Set as their focus")}</Button>
    </>
  );
}

/* THE PLAYER'S DAY

   No greeting, no date — a player opening their own app knows who they
   are and what day it is. The screen opens straight onto the thing
   their coach asked them to work on, at a size that makes it the point
   of the app rather than a notice pinned to it.

   Everything under it is one line each, with air. The whole screen
   reads in about three seconds. */
function PlayerHome({ cfg, conn, activeProfile, lessons, go, push, onTick, fresh, right, nextBooking, attendPct,
                      practice, saved, tip, tool, pack, sheetRate, sheetSuggest, agreed,
                      onRequest, calledOff, onReschedule, notice, onAcceptOffer, onDismissNotice, nextEvent, sport,
                      juvenile }) {
  const t = useT();
  const ready = useLoad();
  const todo = practice.filter((x) => !x.done);
  const tipText = typeof tip === "string" ? tip : (tip && (tip.title || tip.text)) || "";
  const tipBody = tip && tip.body;

  const Line = ({ label, value, meta, tone, onPress, delay = 0, last }) => (
    <button onClick={() => { haptic(8); soft(); onPress && onPress(); }}
            className="w-full flex items-center gap-4 text-left active:opacity-50"
            style={{ minHeight: 66, borderBottom: last ? "none" : `0.5px solid ${HAIR(t.ink, 0.12)}`,
                     animation: `settle 400ms cubic-bezier(.22,1,.36,1) ${delay}ms both` }}>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{label}</span>
        <span className="block mt-1.5 truncate" style={{ ...TYPE.subhead, fontSize: 17,
                       color: tone || t.ink }}>{value}</span>
      </span>
      {meta && <span className="shrink-0" style={{ ...TYPE.small, color: t.faint,
                     fontVariantNumeric: "tabular-nums" }}>{meta}</span>}
    </button>
  );

  return (
    <Screen bare right={right}>
      {!ready ? (
        <div className="px-6 pt-2"><Bone h={220} r={22} /></div>
      ) : (
        <div className="px-6 pt-1">

          {/* THE ONE THING
              Full width, tall, and unmistakably a door — the arrow sits
              in a filled disc at the bottom so there is no question
              that pressing it goes somewhere. */}
          {tipText && (
            <button onClick={() => { hapticCommit(); soft(); push("tips"); }}
                    onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.985)"; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    className="w-full text-left relative overflow-hidden mb-9 active:opacity-95"
                    style={{ borderRadius: 26, background: t.accent, minHeight: 250, willChange: "transform",
                             boxShadow: `0 16px 40px ${t.accent}38`,
                             transition: "transform 200ms cubic-bezier(.34,1.56,.64,1)",
                             animation: "liftIn 560ms cubic-bezier(.22,1,.36,1) both" }}>

              {/* the mark, oversized and cropped into the corner */}
              <span className="absolute" style={{ right: -26, top: -20, opacity: 0.09 }} aria-hidden="true">
                <Mark size={150} color="#fff" />
              </span>

              <span className="relative block px-7 pt-7">
                <span className="flex items-center gap-2" style={{ ...TYPE.eyebrow, fontSize: 8.5,
                               color: "rgba(255,255,255,0.6)" }}>
                  <Lightbulb size={12} color="rgba(255,255,255,0.7)" strokeWidth={1.9} />
                  {tr("Working on")}
                </span>

                <span className="block mt-5" style={{ ...TYPE.hero, fontSize: 34, lineHeight: 1.1,
                               letterSpacing: "-0.03em", color: t.onAccent,
                               animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) 140ms both" }}>
                  {tipText}
                </span>
                {tipBody && (
                  <span className="block mt-4" style={{ ...TYPE.body, lineHeight: 1.55, maxWidth: "94%",
                                 color: "rgba(255,255,255,0.72)",
                                 animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) 240ms both" }}>
                    {tipBody}
                  </span>
                )}
              </span>

              {/* the door, said plainly */}
              <span className="relative flex items-center gap-3 px-7 pb-7 pt-6">
                <span className="flex-1 min-w-0">
                  {tip && tip.focus && (
                    <span className="block truncate" style={{ ...TYPE.caption, color: "rgba(255,255,255,0.55)" }}>
                      {tip.focus}
                    </span>
                  )}
                  <span className="block mt-0.5" style={{ ...TYPE.small, fontWeight: 600, color: "#fff" }}>
                    {tr("See what to do")}
                  </span>
                </span>
                <span className="rounded-full flex items-center justify-center shrink-0"
                      style={{ width: 46, height: 46, background: "rgba(255,255,255,0.94)" }}>
                  <ArrowRight size={19} color={t.accent} strokeWidth={2.4} />
                </span>
              </span>
            </button>
          )}

          {/* the rest of the day, one line each */}
          <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.12)}` }}>
            {nextBooking && (
              <Line label={tr("Next")} value={nextBooking.focus || tr("Lesson")}
                    meta={nextBooking.when} delay={60} onPress={() => go("calendar")} />
            )}
            <Line label={tr("To practise")}
                  value={todo.length ? `${todo.length} ${todo.length === 1 ? tr("drill") : tr("drills")}` : tr("All done")}
                  tone={todo.length ? t.ink : STEADY}
                  delay={110} onPress={() => go("practice")} />
            <Line label={tr("Lessons")} value={`${lessons.length} ${tr("logged")}`}
                  meta={lessons[0] ? `${lessons[0].d} ${lessons[0].m}` : ""}
                  delay={160} onPress={() => go("log")} />
            {nextEvent && (
              <Line label={tr("Coming up")} value={nextEvent.name}
                    meta={`${nextEvent.days}d`} tone={nextEvent.days <= 7 ? CAUTION : null}
                    delay={210} onPress={() => go("events")} />
            )}
            {!juvenile && (
              <Line label={tr("Your coach")} value={conn?.coach || tr("Not connected")}
                    delay={260} onPress={() => conn && push("coachProfile")} />
            )}
            <Line label={tr("Attendance")} value={attendPct != null ? `${attendPct}%` : tr("None taken")}
                  tone={attendPct == null ? t.faint : attendPct >= 90 ? STEADY : attendPct >= 75 ? CAUTION : DANGER}
                  delay={310} last onPress={() => push("attendance")} />
          </div>

          {!juvenile && (
            <button onClick={() => { hapticCommit(); soft(); onRequest && onRequest(); }}
                    className="w-full flex items-center justify-center gap-2 mt-8 active:opacity-90"
                    style={{ minHeight: 54, borderRadius: R.control,
                             border: `1px solid ${HAIR(t.ink, 0.18)}`,
                             ...TYPE.subhead, fontSize: 15.5, color: t.ink,
                             animation: "fadeUp 480ms cubic-bezier(.22,1,.36,1) 320ms both" }}>
              <Plus size={16} color={t.ink} strokeWidth={2.2} />
              {tr("Request a lesson")}
            </button>
          )}

          <div style={{ height: 26 }} />
        </div>
      )}
    </Screen>
  );
}



function PlayerLog({ cfg, lessons, go, push, saved, right, empty, lang, prefs, setPrefs, sport, ownMedia, onUpload, onOverture }) {
  const t = useT();
  const ready = useLoad();
  const view = (prefs && prefs.logView) === "list" ? "List" : "Cards";
  const [f, setF] = useState("All");
  const chips = ["All", ...cfg.focus.map((x) => x.label)];
  const shown = f === "All" ? lessons : lessons.filter((l) => l.focus === f);

  /* Immersive is a different animal — it owns the screen, so it is not
     a segment inside this one. */
  if ((prefs && prefs.logView) === "feed" && lessons.length > 0) {
    const mediaFor = (l, i) => {
      const own = (ownMedia && ownMedia[i]) || [];
      if (own.length) return own;
      const n = l.videos || 0;
      const sim = Array.from({ length: n }, () => ({ type: "sim" }));
      /* a readout rides alongside the clips, in the same frame */
      if (n > 1 && CAPTURE[sport]) {
        sim.push({ type: "data", device: CAPTURE[sport].device,
                   rows: CAPTURE[sport].fields.slice(0, 4).map((f, k) => [f, ["112", "1.34", "58", "9.2"][k] || "—"]) });
      }
      return sim;
    };
    return <LessonFeed lessons={lessons} mediaFor={mediaFor}
                       view={prefs.logView} setView={(v) => setPrefs((p2) => ({ ...p2, logView: v }))}
                       onPickFiles={(files) => onUpload && onUpload(0, files)}
                       loaded={Object.keys(ownMedia || {}).length}
                       onOpen={(l) => onOverture(l)} />;
  }

  return (
    <Screen bare right={right}>
      <div className="px-6 pt-1">
        {/* the view switch does the work a title was doing badly */}
        <div className="flex items-center gap-3 mb-4">
          <ViewSwitch view={prefs.logView} setView={(v) => setPrefs((p2) => ({ ...p2, logView: v }))} />
          <span className="flex-1" />
          <span style={{ ...TYPE.small, color: t.faint, fontVariantNumeric: "tabular-nums" }}>
            {lessons.length}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
          {chips.map((c) => {
            const on = f === c;
            return (
              <button key={c} onClick={() => { haptic(6); soft(); setF(c); }}
                      className="rounded-full px-3.5 shrink-0 active:opacity-60"
                      style={{ minHeight: 32, background: on ? t.accent : "transparent",
                               border: `0.5px solid ${on ? t.accent : HAIR(t.ink, 0.2)}`,
                               ...TYPE.small, fontWeight: 500,
                               color: on ? t.onAccent : t.sub,
                               transition: "background 200ms cubic-bezier(.22,1,.36,1)" }}>{c}</button>
            );
          })}
        </div>
      </div>

      {!ready ? (
        <div className="px-6"><Bone h={CARD_H} r={20} /></div>
      ) : shown.length === 0 ? (
        <p className="px-6 py-12 text-center" style={{ ...TYPE.body, color: t.faint }}>
          {lessons.length === 0 ? tr("No lessons yet.") : tr("Nothing under that.")}
        </p>
      ) : view === "Cards" ? (
        <VDeck lessons={shown} go={go} push={push} saved={saved} />
      ) : (
        <div className="px-6 pb-4" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
          {shown.map((l, i) => (
            <button key={l.id} onClick={() => { haptic(8); soft(); push("lesson"); }}
                    className="w-full flex items-center gap-4 text-left active:opacity-50"
                    style={{ minHeight: 64, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                             animation: `settle 320ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 45}ms both` }}>
              <span className="shrink-0" style={{ width: 52, ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>
                {l.d} {l.m}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate" style={{ ...TYPE.subhead, color: t.ink }}>{l.focus}</span>
                  {l.unread && <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: DANGER }} />}
                </span>
              </span>
              {l.videos > 0 && (
                <span className="flex items-center gap-1 shrink-0" style={{ ...TYPE.caption, color: STEADY }}>
                  <Play size={11} color={STEADY} />{l.videos}
                </span>
              )}
              {saved.includes(l.id) && <Download size={13} color={t.faint} />}
              <ChevronRight size={14} color={t.faint} />
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}

/* A LESSON, OPENED

   Rebuilt as one continuous page rather than a stack of boxes. The
   clip runs first, then everything else is text separated by
   hairlines — the way a match report reads. Boxes were being used to
   group things that were already grouped by proximity, which just
   added edges to look at. */
function PlayerLesson({ cfg, conn, lessons, go, push, pop, fresh, saved, toggleSave, minimise, attendance }) {
  const t = useT();
  const base = lessons[0];
  const id = fresh ? 999 : base?.id;
  const l = fresh
    ? { focus: fresh.focus, subs: fresh.subs, date: "Today", type: fresh.type === "group" ? "Group" : "Private",
        videos: fresh.videos.map((v) => v.angle || v), note: fresh.note, tip: fresh.nextTip, drills: fresh.nextDrills }
    : { focus: base?.focus || "Lesson", subs: base?.subs || [], date: base ? `${base.d} ${base.m}` : "",
        type: base?.type || "Private", videos: cfg.angles.slice(0, base?.videos || 0),
        note: base?.note, tip: base?.tip, drills: base?.drills };
  const [a, setA] = useState(0);
  const isSaved = saved.includes(id);

  const Line = ({ label, children, delay = 0 }) => (
    <div className="py-5" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.13)}`,
                 animation: `settle 380ms cubic-bezier(.22,1,.36,1) ${delay}ms both` }}>
      <div className="mb-2" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{label}</div>
      {children}
    </div>
  );

  return (
    <SwipeBack onBack={pop}>
      <Screen bare onBack={pop}
              right={<IconBtn C={Download} label={tr("Save offline")} onOpen={() => { haptic(9); toggleSave(id); }} />}>

        {/* the clip, edge to edge — the reason you opened this */}
        {l.videos.length > 0 ? (
          <div className="mb-6">
            <Clip angle={l.videos[a] || "Clip"} saved={isSaved} onMinimise={() => minimise(l.videos[a] || "Clip")} />
            {l.videos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-6 mt-3" style={{ scrollbarWidth: "none" }}>
                {l.videos.map((v, i) => (
                  <button key={v + i} onClick={() => { haptic(7); soft(); setA(i); }}
                          className="px-3.5 shrink-0 active:opacity-60"
                          style={{ minHeight: 32, borderRadius: R.pill,
                                   background: i === a ? t.accent : "transparent",
                                   border: `0.5px solid ${i === a ? t.accent : HAIR(t.ink, 0.2)}`,
                                   ...TYPE.caption, fontWeight: 500,
                                   color: i === a ? t.onAccent : t.sub }}>{v}</button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="px-6">
          {/* the heading, set as type rather than in a box */}
          <div style={{ animation: "fadeUp 480ms cubic-bezier(.22,1,.36,1) both" }}>
            <span className="flex items-center gap-2.5" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>
              <span>{l.date}</span>
              <span className="rounded-full" style={{ width: 2.5, height: 2.5, background: t.hair }} />
              <span>{l.type === "Group" ? tr("Group") : tr("Private")}</span>
              {conn?.coach && (<>
                <span className="rounded-full" style={{ width: 2.5, height: 2.5, background: t.hair }} />
                <span>{conn.coach}</span>
              </>)}
            </span>
            <h1 className="mt-2.5" style={{ ...TYPE.hero, fontSize: 34, lineHeight: 1.0,
                          letterSpacing: "-0.03em", color: t.ink }}>{l.focus}</h1>
            {l.subs && l.subs.length > 0 && (
              <p className="mt-2" style={{ ...TYPE.small, color: t.sub }}>{l.subs.join(" · ")}</p>
            )}
          </div>

          <div className="mt-7">
            {l.note && (
              <Line label={tr("What happened")} delay={60}>
                <p style={{ ...TYPE.body, fontSize: 15.5, lineHeight: 1.6, color: t.ink }}>{l.note}</p>
              </Line>
            )}

            {l.tip && (
              <Line label={tr("Hold onto this")} delay={120}>
                <p style={{ ...TYPE.body, fontSize: 15.5, lineHeight: 1.6, color: t.ink }}>{l.tip}</p>
              </Line>
            )}

            {l.drills && l.drills.length > 0 && (
              <Line label={tr("To practise")} delay={180}>
                {l.drills.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-3 py-1.5">
                    <span style={{ ...TYPE.caption, color: t.faint, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    <span style={{ ...TYPE.body, color: t.ink }}>{typeof d === "string" ? d : d.t}</span>
                  </div>
                ))}
              </Line>
            )}

            {/* what the coach marked on the day */}
            {attendance && (
              <Line label={tr("Attendance")} delay={220}>
                <span className="flex items-center gap-2">
                  {attendance === "in"
                    ? <><Check size={15} color={STEADY} strokeWidth={2.4} />
                        <span style={{ ...TYPE.body, color: t.ink }}>{tr("Marked present")}</span></>
                    : <><X size={15} color={DANGER} strokeWidth={2.4} />
                        <span style={{ ...TYPE.body, color: t.ink }}>{tr("Marked absent")}</span></>}
                </span>
              </Line>
            )}
          </div>

          {/* two ways on, as text buttons rather than slabs */}
          <div className="flex gap-6 py-6 mt-1" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.13)}` }}>
            <button onClick={() => { hapticCommit(); soft(); go("practice"); }}
                    className="flex items-center gap-1.5 active:opacity-50"
                    style={{ ...TYPE.small, fontWeight: 600, color: t.accent }}>
              {tr("Your drills")} <ArrowRight size={13} color={t.accent} strokeWidth={2.2} />
            </button>
            <button onClick={() => { hapticCommit(); soft(); go("calendar"); }}
                    className="flex items-center gap-1.5 active:opacity-50"
                    style={{ ...TYPE.small, fontWeight: 600, color: t.sub }}>
              {tr("Book again")} <ArrowRight size={13} color={t.sub} strokeWidth={2.2} />
            </button>
          </div>
          <div style={{ height: 26 }} />
        </div>
      </Screen>
    </SwipeBack>
  );
}


/* ==================================================================
   FAMILY DASHBOARD — what a parent with children on the app opens to.
   One screen answering: where does each of them need to be, and what
   still needs doing?
================================================================== */
/* THE FAMILY

   Seven people is a different problem from two. The parent needs to see
   who needs something and who doesn't, without reading seven cards.
   So: anyone with something outstanding rises to the top, everyone else
   is a quiet row, and a child with no coach yet reads as an invitation
   rather than an error. */
function FamilyDashboard({ profiles, conns, practice, tips, bookings, activeProfileId, onSwitch, go, push, right, photos = {}, say }) {
  const t = useT();
  const ready = useLoad();

  const forProfile = (p) => {
    const mine = conns.filter((c) => c.profileId === p.id);
    const conn = mine[0];
    const sport = conn?.sport || null;
    const drills = sport ? (practice[`${p.id}:${sport}`] || []) : [];
    const f = bFile(p.name);
    const booking = bookings.filter((b) => mine.some((c) => c.id === b.connId))
      .sort((a, b) => a.m - b.m || a.d - b.d)[0];
    return { conn, mine, sport, todo: drills.filter((d) => !d.done).length, booking, f };
  };

  const adults = profiles.filter((p) => !p.age);
  const kids = profiles.filter((p) => p.age);
  const all = [...adults, ...kids].map((p) => ({ p, ...forProfile(p) }));

  /* Anything asking for attention, in the order a parent would care. */
  const flagged = all.filter((x) => x.p.name === "Fionn Breathnach" || x.todo > 0 || !x.conn);
  const rest = all;

  const Person = ({ x, big }) => {
    const { p, conn, mine, todo, f } = x;
    const ev = f && f.event;
    const rained = p.name === "Fionn Breathnach";
    return (
      <button onClick={() => { haptic(8); soft(); onSwitch(p.id); }}
              onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-70"
              style={{ minHeight: big ? 76 : 62, willChange: "transform",
                       borderRadius: big ? R.surface : 0,
                       background: big ? t.surface : "transparent",
                       boxShadow: big ? ELEV.rest : "none",
                       borderLeft: big && rained ? `2.5px solid ${DANGER}` : "none",
                       borderBottom: big ? "none" : `0.5px solid ${HAIR(t.ink, 0.14)}`,
                       marginBottom: big ? 8 : 0,
                       transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)" }}>
        <Avatar name={p.name} size={big ? 40 : 34} tint={photos[p.id]} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate" style={{ ...TYPE.subhead, fontSize: big ? 17 : 15,
                           fontWeight: big ? 500 : 400, color: t.ink }}>
              {p.name.split(" ")[0]}
            </span>
            {mine.map((c) => (
              <span key={c.id} className="rounded-full shrink-0"
                    style={{ width: 6, height: 6, background: SPORTS[c.sport].theme.mark }} />
            ))}
          </span>
          <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: rained ? DANGER : t.faint }}>
            {rained ? tr("Tonight called off — rain")
              : !conn ? tr("No coach yet")
              : todo > 0 ? `${todo} ${todo === 1 ? tr("drill") : tr("drills")}`
              : ev ? `${ev.name} · ${ev.days}d`
              : `${f ? f.done : 0} ${tr("lessons")}`}
          </span>
        </span>
        <ChevronRight size={14} color={t.faint} />
      </button>
    );
  };

  return (
    <Screen title={tr("Family")} meta={`${all.length} ${tr("playing")}`} right={right}>
      {!ready ? <HomeSkeleton /> : (
        <div className="px-6">
          {rest.length > 0 && (
            <div className="mb-7">
              <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                {rest.map((x) => <Person key={x.p.id} x={x} />)}
              </div>
            </div>
          )}

          <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
            {[[tr("Everyone's diary"), () => go("calendar")],
              [tr("Messages"), () => go("messages")],
              [tr("This month"), () => push("digest")]].map(([lbl, act], i) => (
              <button key={lbl} onClick={() => { haptic(7); soft(); act(); }}
                      className="w-full flex items-center text-left active:opacity-50"
                      style={{ minHeight: 54, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{lbl}</span>
                <ChevronRight size={14} color={t.faint} />
              </button>
            ))}
          </div>
          <div style={{ height: 26 }} />
        </div>
      )}
    </Screen>
  );
}


/* A section that opens. Sits on a surface like the player's cards
   rather than floating on hairlines, so the day reads as a set of
   objects you can pick up. */
function Fold({ label, count, open, onToggle, tone, cleared, children, delay = 0, last }) {
  const t = useT();
  return (
    <div className="mb-2.5" style={{ animation: `liftIn 420ms cubic-bezier(.22,1,.36,1) ${delay}ms both` }}>
      <div style={{ background: t.surface, borderRadius: R.surface, boxShadow: ELEV.rest, overflow: "hidden" }}>
        <button onClick={() => { haptic(8); soft(); onToggle(); }}
                className="w-full flex items-center gap-3 px-5 text-left active:opacity-70"
                style={{ minHeight: 62 }}>
          <span className="flex-1 min-w-0" style={{ ...TYPE.heading, color: t.ink }}>{label}</span>
          {count === 0 && cleared && (
            <Check size={15} color={STEADY} strokeWidth={2.2}
                   style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />
          )}
          {count > 0 && (
            <span className="rounded-full flex items-center justify-center shrink-0"
                  style={{ minWidth: 24, height: 24, padding: "0 8px",
                           background: tone ? tone : t.wash,
                           ...TYPE.caption, fontWeight: 500, color: tone ? "#fff" : t.sub }}>{count}</span>
          )}
          <ChevronDown size={16} color={t.faint}
                       style={{ transform: open ? "rotate(180deg)" : "none",
                                transition: "transform 300ms cubic-bezier(.22,1,.36,1)" }} />
        </button>
        {open && (
          <div style={{ animation: "contentRise 360ms cubic-bezier(.22,1,.36,1) both",
                        borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>{children}</div>
        )}
      </div>
    </div>
  );
}



/* Lessons a month, drawn as a low ruled column rather than a chart. */
function MonthBars({ data, accent }) {
  const t = useT();
  const peak = Math.max(...data.map((d) => d[1]), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 46 }}>
      {data.map(([m, n], i) => (
        <div key={m} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full" style={{ height: `${Math.max(2, (n / peak) * 32)}px`, borderRadius: 2,
                 background: n ? accent : t.hair, opacity: n ? 1 : 0.5, transformOrigin: "bottom",
                 animation: `barGrow 560ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }} />
          <span style={{ ...TYPE.eyebrow, fontSize: 8, color: t.faint }}>{m[0]}</span>
        </div>
      ))}
    </div>
  );
}

/* THE COACH'S DAY

   A line telling them where they stand, then folds. Nothing else on the
   page — no loose figures, no orphan links. Everything a coach reaches
   for repeatedly lives one tap inside a labelled section. */
function CoachToday({ cfg, coachName, go, push, published, right, fresh, roster, requests, unlogged, today,
                      duration, onLogFor, onCancelLesson, onNoShow, onPeek, focusReqs = [], onSettleFocus,
                      nextEvent, events = [], sport, asks = [], onAccept, onDecline, drifting = 0, checkWaiting = 0,
                      lifetime = 0, monthly = [], push2, say }) {
  const t = useT();
  const done = (today || []).filter((l) => l.done);
  const ahead = (today || []).filter((l) => !l.done);
  const justDone = done[done.length - 1];
  const next = ahead[0];
  const [open, setOpen] = useState(null);   // one fold at a time
  const flip = (k) => setOpen(open === k ? null : k);

  const until = next ? (next.hoursUntil ?? 1) : null;
  const countdown = until === null ? null
    : until < 1 ? `${Math.round(until * 60)}m`
    : `${Math.floor(until)}h ${String(Math.round((until - Math.floor(until)) * 60)).padStart(2, "0")}m`;

  const Row = ({ l, cta, onTap }) => {
    const grp = l.kind && l.kind.startsWith("Group");
    return (
      <button onClick={() => { haptic(7); soft(); onTap(); }}
              className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-50"
              style={{ minHeight: 62, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
        <span className="shrink-0" style={{ width: 58, ...TYPE.small, color: t.faint,
                       fontVariantNumeric: "tabular-nums" }}>{l.time}</span>
        {grp ? (
          <span className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 30, height: 30, background: `${GROUP}18` }}><Users size={13} color={GROUP} /></span>
        ) : <Avatar name={l.who} size={30} />}
        <span className="flex-1 min-w-0 truncate" style={{ ...TYPE.body, color: t.ink }}>{l.who}</span>
        {cta ? <span style={{ ...TYPE.small, fontWeight: 500, color: t.ink }}>{cta}</span>
             : <ChevronRight size={14} color={t.faint} />}
      </button>
    );
  };

  return (
    <Screen bare right={right}>
      <div className="px-6">

        {/* ---- two notices. Less text than the folds below, and set
                apart from them: the first is filled, the second carries
                an accent edge so neither reads as just another row. ---- */}
        {(justDone || next) && (
          <div className="mb-7" style={{ animation: "contentRise 500ms cubic-bezier(.22,1,.36,1) both" }}>
            {justDone && (
              <div className="relative mb-2">
              <button onClick={() => { hapticCommit(); soft(); onLogFor && onLogFor(justDone); }}
                      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      className="w-full flex items-center gap-3 px-5 mb-2 text-left active:opacity-90"
                      style={{ minHeight: 68, borderRadius: R.surface, background: t.accent, willChange: "transform",
                               boxShadow: `0 10px 26px ${t.accent}2E`,
                               transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)" }}>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.onAccent, opacity: 0.7 }}>
                    {tr("Just finished")}
                  </span>
                  <span className="block mt-1 truncate" style={{ ...TYPE.subhead, fontSize: 18, color: t.onAccent }}>{justDone.who}</span>
                </span>
                <ArrowRight size={17} color={t.onAccent} strokeWidth={2.1} style={{ opacity: 0.7 }} />
              </button>
              </div>
            )}

            {next && (
              <button onClick={() => { haptic(8); soft(); onPeek && onPeek(next); }}
                      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      className="w-full flex items-center gap-3 px-5 text-left active:opacity-70"
                      style={{ minHeight: 68, borderRadius: R.surface, background: t.surface, willChange: "transform",
                               borderLeft: `2.5px solid ${t.accent}`, boxShadow: ELEV.rest,
                               transition: "transform 160ms cubic-bezier(.34,1.56,.64,1)" }}>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{tr("Next lesson")}</span>
                  <span className="block mt-1 truncate" style={{ ...TYPE.subhead, fontSize: 18, color: t.ink }}>{next.who}</span>
                </span>
                <span className="shrink-0 flex items-baseline gap-1" style={{ color: t.sub }}>
                  <span style={{ ...TYPE.figure, fontSize: 18 }}>{next.time.replace(/ ?(am|pm)/, "")}</span>
                  <span style={{ ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>
                    {(next.time.match(/(am|pm)/) || [""])[0]}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* ---- the folds. nothing lives outside them ---- */}
        <Fold label={tr("Past lessons")} count={done.length} tone={done.length ? DANGER : null} cleared
              open={open === "past"} onToggle={() => flip("past")} delay={60}>
          {done.length === 0
            ? <p className="px-5 py-6" style={{ ...TYPE.small, color: t.faint }}>{tr("All logged.")}</p>
            : <>
                {done.map((l, i) => (
                  <SwipeRow key={i} deleteLabel={tr("Don't log")}
                            onDelete={() => onNoShow && onNoShow(l)}>
                    <Row l={l} cta={tr("Log")} onTap={() => onLogFor && onLogFor(l)} />
                  </SwipeRow>
                ))}
                <button onClick={() => { haptic(7); push("archive"); }} className="w-full px-5 py-4 text-left active:opacity-50"
                        style={{ ...TYPE.small, color: t.sub }}>{tr("Everything you've logged")}</button>
              </>}
        </Fold>

        <Fold label={tr("Later today")} count={ahead.length} tone={null}
              open={open === "next"} onToggle={() => flip("next")} delay={100}>
          {ahead.length === 0
            ? <p className="px-5 py-6" style={{ ...TYPE.small, color: t.faint }}>{tr("Nothing else today.")}</p>
            : ahead.map((l, i) => <Row key={i} l={l} onTap={() => onPeek && onPeek(l)} />)}
        </Fold>

        <Fold label={tr("Lesson requests")} count={asks.length} tone={asks.length ? DANGER : null} cleared
              open={open === "asks"} onToggle={() => flip("asks")} delay={120}>
          {asks.length === 0
            ? <p className="px-5 py-6" style={{ ...TYPE.small, color: t.faint }}>{tr("None waiting.")}</p>
            : asks.map((r, i) => (
                <div key={r.id} className="px-5 py-4"
                     style={{ borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                              animation: `fadeUp 300ms cubic-bezier(.22,1,.36,1) ${i * 50}ms both` }}>
                  <div className="flex items-center gap-3.5">
                    <Avatar name={r.who} size={32} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{r.who}</span>
                      <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                        {r.d} {MONTHS.find((x) => x.idx === r.m)?.name.split(" ")[0]} · {r.time}
                      </span>
                    </span>
                  </div>
                  {r.note && (
                    <p className="mt-2.5 pl-11" style={{ ...TYPE.caption, color: t.sub }}>{r.note}</p>
                  )}
                  <div className="flex gap-2 mt-3 pl-11">
                    <button onClick={() => { haptic(9); onDecline && onDecline(r); }} className="px-4 active:opacity-60"
                            style={{ minHeight: 40, borderRadius: R.control, border: `0.5px solid ${HAIR(t.ink, 0.2)}`,
                                     ...TYPE.small, fontWeight: 500, color: t.sub }}>{tr("Decline")}</button>
                    <button onClick={() => { hapticCommit(); onAccept && onAccept(r); }} className="flex-1 active:opacity-75"
                            style={{ minHeight: 40, borderRadius: R.control, background: STEADY,
                                     ...TYPE.small, fontWeight: 500, color: t.onAccent }}>{tr("Accept")}</button>
                  </div>
                </div>
              ))}
        </Fold>

        <Fold label={tr("Competitions")} count={events.length} tone={null}
              open={open === "events"} onToggle={() => flip("events")} delay={140}>
          {events.length === 0
            ? <p className="px-5 py-6" style={{ ...TYPE.small, color: t.faint }}>{tr("None yet.")}</p>
            : events.map((e, i) => (
                <button key={i} onClick={() => { haptic(7); push("events"); }}
                        className="w-full flex items-center gap-4 px-5 text-left active:opacity-50"
                        style={{ minHeight: 62, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{e.name}</span>
                    <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{e.when}</span>
                  </span>
                  <ChevronRight size={14} color={t.faint} />
                </button>
              ))}
          <button onClick={() => { hapticCommit(); push("events"); }} className="w-full px-5 py-4 text-left active:opacity-50"
                  style={{ ...TYPE.small, fontWeight: 500, color: t.sub }}>{tr("Add a competition")}</button>
        </Fold>

        <Fold label={tr("Your coaching")} open={open === "stats"} onToggle={() => flip("stats")} delay={180}>
          <div className="px-5 py-5">
            <div className="flex mb-6">
              {[[lifetime, tr("lessons given")], [monthly.reduce((a, b) => a + b[1], 0), tr("this season")]].map(([v, k], i) => (
                <span key={k} className="flex-1" style={{ borderLeft: i ? `0.5px solid ${HAIR(t.ink, 0.14)}` : "none", paddingLeft: i ? 16 : 0 }}>
                  <span className="block" style={{ ...TYPE.figure, fontSize: 26, color: t.ink }}>{v}</span>
                  <span className="block mt-1" style={{ ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>{k}</span>
                </span>
              ))}
            </div>
            <MonthBars data={monthly} accent={t.accent} />
          </div>
        </Fold>
        <div style={{ height: 26 }} />
      </div>
    </Screen>
  );
}










/* Three light pages: who, what, and anything to add. One question at a
   time, and a coach who arrives from an unlogged session skips straight
   past the first because we already know who it was with. */
function Wizard({ cfg, sport, prefill, groups, captured, setCaptured, onAnnotate, showGuide, onDismissGuide, onPublish, onCancel, livePlayers, askReview = true, lessonCounts, onSaveDrill }) {
  const t = useT(); const L = useL();

  const seedWho = prefill
    ? (prefill.kind && prefill.kind.startsWith("Group")
        ? ((groups || []).find((g) => g.name === prefill.who)?.members || [])
        : [prefill.who])
    : [];
  const POOL_W = livePlayers ?? PLAYERS;
  const known = seedWho.filter((n) => POOL_W.includes(n));

  /* A lesson logged from a real booking already carries a date and
     time; asking again would be pointless. One logged ad hoc — the
     plus button, no player picked yet — has neither, and that is
     exactly the case this step exists for. */
  const needsDateTime = !prefill || !prefill.time;
  const startStep = known.length ? (needsDateTime ? 1 : 2) : 0;
  const [step, setStep] = useState(startStep);
  /* The demo's TODAY is a fixed date for the design harness. A real
     log, with nothing booked to anchor it, should default to the
     actual day it's being written on — not July the 24th, whenever
     that happens to be. */
  const realToday = new Date();
  const [logM, setLogM] = useState(prefill?.m ?? (realToday.getMonth() + 1));
  const [logD, setLogD] = useState(prefill?.d ?? realToday.getDate());
  const [logTime, setLogTime] = useState(prefill?.time ?? "");
  const [who, setWho] = useState(known);
  const [pickedGroup, setPickedGroup] = useState(prefill && prefill.kind && prefill.kind.startsWith("Group") ? prefill.who : null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [customDraft, setCustomDraft] = useState(""); const [custom, setCustom] = useState([]);
  const [rec, setRec] = useState("idle"); const [secs, setSecs] = useState(0); const [note, setNote] = useState(null);
  const [videos, setVideos] = useState([]); const [cam, setCam] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [nextDrills, setNextDrills] = useState([]);
  const [nextTip, setNextTip] = useState("");
  const [showWaiting, setShowWaiting] = useState(false);
  const [wantRating, setWantRating] = useState(false);


  /* Anything filmed or noted outside the wizard — via the plus menu's
     Live capture, or "Capture during the lesson" from the player's own
     sheet — waits here under their name until pulled into a write-up. */
  const [pulled, setPulled] = useState([]);
  const waiting = who.flatMap((name) => (captured[name] || [])
    .filter((it) => !pulled.some((p) => p.id === it.id))
    .map((it) => ({ ...it, from: name })));

  /* Videos, photos and anything pulled in, held in one list so the
     slide renders one shape regardless of where it came from. */
  const items = [
    ...videos.map((v, i) => ({ id: `v${i}`, kind: "video", angle: v.angle, secs: v.secs, transcript: v.transcript, working: v.working })),
    ...photos.map((p) => ({ id: `p${p.at}`, kind: p.kind, values: p.values, reading: p.reading })),
    ...pulled.map((it) => ({ ...it, id: `c${it.id}` })),
  ];
  const addPhoto = (kind) => {
    haptic(10); soft();
    const at = Date.now();
    setPhotos((ps) => [...ps, { at, kind, values: null, reading: kind === "data" }]);
    if (kind === "data") setTimeout(() => {
      setPhotos((ps) => ps.map((x) => (x.at === at ? { ...x, values: CAPTURE[sport].sample, reading: false } : x)));
      hapticSuccess(); soft();
    }, 1300);
  };
  const removeItem = (id) => {
    if (id.startsWith("v")) setVideos(videos.filter((_, i) => `v${i}` !== id));
    else if (id.startsWith("c")) setPulled(pulled.filter((it) => `c${it.id}` !== id));
    else setPhotos(photos.filter((p) => `p${p.at}` !== id));
  };
  const pull = (it) => { hapticSuccess(); soft(); setPulled((v) => [...v, it]); };
  const transcribeClip = (id) => {
    const i = Number(id.slice(1));
    haptic(10);
    setVideos((vs) => vs.map((x, j) => (j === i ? { ...x, working: true } : x)));
    setTimeout(() => setVideos((vs) => vs.map((x, j) => (j === i ? { ...x, working: false, transcript: cfg.transcript } : x))), 1300);
  };
  const first = (who[0] || "").split(" ")[0];
  const [ownDrill, setOwnDrill] = useState("");
  const [extraDrills, setExtraDrills] = useState([]);
  const recommended = (cfg.drills || []).filter((d) => focus.includes(d.focus)).concat(cfg.drills.slice(0, 3)).slice(0, 6);

  useEffect(() => { if (rec !== "recording") return; const i = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(i); }, [rec]);
  useEffect(() => { if (rec !== "working") return; const x = setTimeout(() => { setRec("done"); setNote(cfg.transcript); haptic(14); }, 1200); return () => clearTimeout(x); }, [rec, cfg]);

  const chosen = cfg.focus.filter((f) => focus.includes(f.id)).map((f) => f.label).concat(custom);
  const group = who.length > 1 || !!pickedGroup;
  const nouns = cfg.nouns;
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const contexts = CONTEXTS[sport];

  const suggestion = (() => {
    if (who.length !== 1) return null;
    const last = hadLessons(cfg)[0];
    return last ? { ids: [last.focusId], subs: last.subs, label: `Carry on from ${last.focus.toLowerCase()}` } : null;
  })();

  const matches = POOL_W.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  const canAdvance = [who.length > 0, !!logTime, chosen.length > 0, true, true, true, true][step];
  const showReviewAsk = askReview && who.length === 1 && !pickedGroup
    && (lessonCounts ? (lessonCounts[who[0]] || 0) === 0 : false);
  const finish = () => onPublish({
    type: group ? "group" : "private", who, groupName: pickedGroup, focus: chosen.join(" · "),
    focusList: chosen, focusIds: focus, custom, subs, ctx,
    note: note || videos.map((v) => v.transcript).filter(Boolean).join(" ") || null, videos, photos, secs,
    nextDrills, nextTip, wantRating, m: logM, d: logD, time: logTime,
  });

  const titles = [tr("Who"), tr("When"), tr("Focus"), tr("Notes"), tr("Media"), tr("Drills"), tr("Takeaway")];
  /* A single-answer page moves on by itself. Anything multi-select
     waits, because auto-advancing on the first tap would be wrong. */
  const advance = () => { setTimeout(() => setStep((v) => Math.min(v + 1, 5)), 260); };
  const back = () => (step === 0 || (step === startStep && known.length) ? onCancel() : setStep(step - 1));

  return (
    <SwipeBack onBack={back}>
      <div className="flex flex-col h-full relative" style={{ background: t.page }}>
        <div className="shrink-0" style={{ background: t.page }}>
          <div className="flex items-center px-1.5" style={{ height: 48 }}>
            <button onClick={() => { haptic(); back(); }} aria-label={L.back} className="p-2 active:opacity-40"><ChevronLeft size={24} color={t.ink} strokeWidth={2} /></button>
            <span className="flex-1" />
            <span className="flex items-center gap-3 pr-4">
              {step >= 2 && step < 5 && <TextBtn onClick={() => { haptic(6); setStep(step + 1); }}>{tr("Skip")}</TextBtn>}
              <span style={{ fontFamily: ui, fontSize: 11.5, letterSpacing: "0.06em", color: t.faint }}>{step + 1} / {7}</span>
            </span>
          </div>
          <div className="flex gap-1 px-6 pb-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="flex-1 rounded-full" style={{ height: 2, background: i <= step ? t.accent : t.hair, transition: "background 260ms" }} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-8">
          <h1 className="px-6 mb-2" style={{ fontFamily: display, fontSize: 32, lineHeight: 1.02, letterSpacing: "-0.036em", color: t.ink,
                     animation: "fadeUp 460ms cubic-bezier(.22,1,.36,1) both" }}>{titles[step]}</h1>

          {/* ---------- 1 · who ---------- */}
          {step === 0 && (<>

            <div className="px-6 mb-5">
              <div className="flex items-center gap-2.5 px-4" style={{ minHeight: 48, borderRadius: R.surface, background: t.wash }}>
                <Search size={16} color={t.faint} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search your ${nouns}`} className="flex-1 outline-none"
                       style={{ fontFamily: ui, fontSize: 15, color: t.ink, background: "transparent" }} />
                {q ? <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={15} color={t.faint} /></button>
                   : <MicBtn onText={(txt) => setQ(txt)} size={28} />}
              </div>
            </div>

            {!q && groups.length > 0 && (<>
              <Eyebrow>{tr("Groups")}</Eyebrow>
              <div className="px-6 mb-6 flex flex-col gap-2">
                {groups.map((g) => {
                  const on = pickedGroup === g.name;
                  return (
                    <button key={g.id} onClick={() => { hapticCommit(); soft(); if (on) { setPickedGroup(null); setWho([]); } else { setPickedGroup(g.name); setWho(g.members); } }}
                            className="w-full px-4 flex items-center gap-3 text-left active:opacity-60"
                            style={{ minHeight: 60, borderRadius: R.surface, background: t.surface, border: `1px solid ${on ? t.accent : t.hair}` }}>
                      <Users size={17} color={on ? t.accent : t.faint} strokeWidth={1.6} />
                      <span className="flex-1">
                        <span className="block" style={{ ...TYPE.body, color: t.ink }}>{g.name}</span>
                        <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{g.members.length} {nouns}</span>
                      </span>
                      {on && <Check size={17} color={STEADY} strokeWidth={2.1} style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />}
                    </button>
                  );
                })}
              </div>
            </>)}

            <Eyebrow>{q ? `${matches.length} found` : nouns}</Eyebrow>
            <div className="px-6 pb-4">
              {matches.length === 0 ? (
                <p className="py-6 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>Nobody matching “{q}”.</p>
              ) : (
                <div style={{ borderTop: `1px solid ${t.hair}` }}>
                  {matches.map((pl) => {
                    const on = who.includes(pl);
                    return (
                      <button key={pl} onClick={() => { haptic(6); setPickedGroup(null); tog(who, setWho, pl); }}
                              className="w-full flex items-center gap-3.5 text-left active:opacity-50"
                              style={{ minHeight: 62, borderBottom: `1px solid ${t.hair}` }}>
                        <Avatar name={pl} size={36} />
                        <span className="flex-1" style={{ fontFamily: ui, fontSize: 15.5, color: t.ink }}>{pl}</span>
                        <span className="flex items-center justify-center shrink-0"
                              style={{ width: 22, height: 22, borderRadius: R.control, border: `1.5px solid ${on ? t.accent : t.hair}`, background: on ? t.accent : "transparent" }}>
                          {on && <Check size={12} color="#fff" strokeWidth={2.1} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>)}

          {step === 1 && (
            <div className="px-6" style={{ animation: "contentRise 380ms cubic-bezier(.22,1,.36,1) both" }}>
              <p className="mb-6" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>
                {tr("When did this happen?")}
              </p>

              <div className="mb-4" style={{ borderRadius: R.surface, background: t.surface,
                                              border: `1px solid ${t.hair}`, padding: "16px 18px" }}>
                <span className="block mb-1.5" style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{tr("Date")}</span>
                <input type="date"
                       value={`${new Date().getFullYear()}-${String(logM).padStart(2, "0")}-${String(logD).padStart(2, "0")}`}
                       max={`${new Date().getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, "0")}-${String(realToday.getDate()).padStart(2, "0")}`}
                       onChange={(e) => {
                         const parts = e.target.value.split("-");
                         if (parts.length === 3) { setLogM(Number(parts[1])); setLogD(Number(parts[2])); }
                       }}
                       className="w-full outline-none" style={{ fontFamily: ui, fontSize: 17, color: t.ink, background: "transparent" }} />
              </div>

              <div style={{ borderRadius: R.surface, background: t.surface,
                             border: `1px solid ${t.hair}`, padding: "16px 18px" }}>
                <span className="block mb-1.5" style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{tr("Time")}</span>
                <input type="time" value={logTime} onChange={(e) => { setLogTime(e.target.value); haptic(4); }}
                       className="w-full outline-none" style={{ fontFamily: ui, fontSize: 17, color: t.ink, background: "transparent" }} />
              </div>

              <p className="mt-5" style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.5, color: t.faint }}>
                {tr("Logging something that wasn't on the diary — pick when it actually happened.")}
              </p>
            </div>
          )}

          {/* ---------- 3 · what ---------- */}
          {step === 2 && (<>
            <p className="px-6 mb-6" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>
              {pickedGroup ? `${pickedGroup} · ${who.length} ${nouns}` : who.join(", ")}
            </p>

            {suggestion && focus.length === 0 && (
              <div className="px-6 mb-5">
                <button onClick={() => { hapticCommit(); soft(); setFocus(suggestion.ids); }}
                        className="w-full px-4 flex items-center gap-3 text-left active:opacity-60"
                        style={{ minHeight: 56, borderRadius: R.surface, background: t.wash }}>
                  <Sparkles size={15} color={t.accent} strokeWidth={2} />
                  <span className="flex-1" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{suggestion.label}</span>
                  <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.accent }}>{tr("Use")}</span>
                </button>
              </div>
            )}

            <div className="px-6 flex flex-wrap gap-2 mb-3">
              {cfg.focus.map((f) => {
                const on = focus.includes(f.id);
                return (
                  <button key={f.id} onClick={() => { haptic(6); tog(focus, setFocus, f.id); }} className="px-4 active:opacity-60"
                          style={{ transition: "background 200ms, transform 160ms cubic-bezier(.22,1,.36,1)", minHeight: 44, borderRadius: R.pill, background: on ? t.accent : t.surface, border: `1px solid ${on ? t.accent : t.hair}`,
                                   fontFamily: ui, fontSize: 14, fontWeight: 600, color: on ? t.onAccent : t.sub }}>{f.label}</button>
                );
              })}
              {custom.map((c) => (
                <span key={c} className="px-3.5 flex items-center gap-2" style={{ minHeight: 44, borderRadius: R.pill, background: t.wash }}>
                  <span style={{ fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.ink }}>{c}</span>
                  <button onClick={() => { haptic(6); setCustom(custom.filter((x) => x !== c)); }} aria-label={`Remove ${c}`}><X size={12} color={t.faint} /></button>
                </span>
              ))}
            </div>

            <div className="px-6 flex items-center gap-2 mb-6">
              <div className="flex-1"><VoiceInput value={customDraft} onChange={setCustomDraft} ph={tr("Something else")} /></div>
              <button onClick={() => { if (customDraft.trim()) { haptic(10); setCustom([...custom, customDraft.trim()]); setCustomDraft(""); } }}
                      disabled={!customDraft.trim()} className="shrink-0 active:opacity-60 disabled:opacity-25"
                      style={{ width: 48, height: 48, borderRadius: R.surface, background: t.accent }} aria-label={tr("Add")}><Plus size={17} color={t.onAccent} strokeWidth={2.1} /></button>
            </div>

          </>)}

          {/* ---------- 3 · anything to add ---------- */}
          {/* ---------- 3 · voice ---------- */}
          {step === 3 && (<div className="px-6">

            {rec === "idle" && !note && (
              <button onClick={() => { haptic(14); setRec("recording"); setSecs(0); }} className="w-full flex flex-col items-center justify-center gap-3 active:opacity-70"
                      style={{ minHeight: 190, borderRadius: R.surface, border: `1px solid ${t.hair}` }}>
                <span className="rounded-full flex items-center justify-center" style={{ width: 68, height: 68, background: t.accent }}>
                  <Mic size={26} color={t.onAccent} strokeWidth={1.6} />
                </span>
                <span style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{tr("Tap to record")}</span>
              </button>
            )}
            {rec === "recording" && (
              <div className="flex flex-col items-center justify-center" style={{ minHeight: 190, borderRadius: R.surface, border: `1px solid ${t.hair}` }}>
                <div className="flex items-end gap-1 h-8 mb-4">{[8,20,13,28,17,30,11,24,15,28,19,22].map((v, i) => (<div key={i} className="rounded-full" style={{ width: 3, height: v, background: t.accent, opacity: 0.3 + (i % 4) * 0.17 }} />))}</div>
                <div style={{ fontFamily: display, fontSize: 34, letterSpacing: "-0.02em", color: t.ink }}>0:{String(secs % 60).padStart(2, "0")}</div>
                <button onClick={() => { haptic(10); setRec("working"); }} className="rounded-full flex items-center justify-center mt-5" style={{ width: 58, height: 58, background: DANGER }} aria-label={tr("Stop")}><Square size={17} color="#fff" fill="#fff" /></button>
              </div>
            )}
            {rec === "working" && (<Card className="p-5"><Bone w="30%" h={10} mb={12} /><Bone mb={8} /><Bone w="70%" /></Card>)}
            {note && (
              <Card className="p-5">
                <p style={{ fontFamily: display, fontSize: 15, lineHeight: 1.65, color: t.ink }}>{note}</p>
                <button onClick={() => { setRec("idle"); setNote(null); setSecs(0); }} className="mt-3 active:opacity-50" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{tr("Record again")}</button>
              </Card>
            )}
            <div style={{ height: 26 }} />
          </div>)}

          {/* ---------- 4 · photos and video ---------- */}
          {step === 4 && (<div className="px-6">
            {/* Five ways in. Everything captured lands below in the same
                shape, so the screen never turns into competing sections. */}
            <div className="grid grid-cols-5 gap-1.5 mb-5">
              {[
                { id: "rec",   label: tr("Record"),  Icon: Camera,    act: () => { haptic(10); setCam(true); } },
                { id: "lib",   label: tr("Library"), Icon: ImageIcon, act: () => { haptic(8); setVideos([...videos, { angle: cfg.angles[videos.length % cfg.angles.length], secs: 12 }]); } },
                { id: "data",  label: CAPTURE[sport].device.split(" ")[0], Icon: Receipt, act: () => addPhoto("data") },
                { id: "shot",  label: tr("Photo"),   Icon: Tag,       act: () => addPhoto("action") },
                { id: "live",  label: tr("Captured"), Icon: Download, act: () => { haptic(9); soft(); setShowWaiting(!showWaiting); }, badge: waiting.length },
              ].map((o, i) => (
                <button key={o.id} onClick={o.act}
                        onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                        onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                        onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                        className="relative flex flex-col items-center justify-center gap-1.5 active:opacity-70"
                        style={{ minHeight: 84, borderRadius: R.control,
                                 background: o.id === "live" && showWaiting ? `${t.accent}0F` : t.surface,
                                 border: `0.5px solid ${o.id === "live" && showWaiting ? t.accent : HAIR(t.ink, 0.14)}`,
                                 willChange: "transform", transition: "transform 150ms cubic-bezier(.34,1.56,.64,1), background 200ms",
                                 animation: `liftIn 400ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }}>
                  <o.Icon size={18} color={i === 0 ? t.accent : t.sub} strokeWidth={1.6} />
                  <span className="truncate px-1" style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 600, color: t.ink }}>{o.label}</span>
                  {o.badge > 0 && (
                    <span className="absolute rounded-full flex items-center justify-center"
                          style={{ top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px", background: DANGER,
                                   fontFamily: ui, fontSize: 10, fontWeight: 600, color: "#fff",
                                   animation: "countIn 380ms cubic-bezier(.28,1.4,.5,1) both" }}>{o.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* what's waiting from outside the wizard — a mid-lesson
                capture, or something filmed via the player's own sheet */}
            {showWaiting && (
              <div className="mb-5" style={{ borderRadius: R.surface, background: t.wash, overflow: "hidden",
                                              animation: "contentRise 320ms cubic-bezier(.22,1,.36,1) both" }}>
                {waiting.length === 0 ? (
                  <p className="py-8 text-center" style={{ ...TYPE.small, color: t.faint }}>
                    {tr("Nothing captured outside the log yet.")}
                  </p>
                ) : waiting.map((it, i) => {
                  const label = it.kind === "video" ? tr("Clip") : it.kind === "voice" ? tr("Voice note")
                    : it.kind === "note" ? (it.text || tr("Note")) : tr("Photo");
                  const Ico = it.kind === "video" ? Play : it.kind === "voice" ? Mic : it.kind === "note" ? Edit3 : Tag;
                  return (
                    <button key={it.id} onClick={() => pull(it)}
                            className="w-full flex items-center gap-3 px-4 text-left active:opacity-60"
                            style={{ minHeight: 58, borderBottom: i === waiting.length - 1 ? "none" : `0.5px solid ${HAIR(t.ink, 0.14)}`,
                                     animation: `settle 300ms cubic-bezier(.22,1,.36,1) ${i * 40}ms both` }}>
                      <Ico size={16} color={t.accent} strokeWidth={1.8} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{label}</span>
                        {who.length > 1 && <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>{it.from}</span>}
                      </span>
                      <span className="rounded-full flex items-center justify-center shrink-0"
                            style={{ width: 26, height: 26, border: `1.5px solid ${t.accent}` }}>
                        <Plus size={12} color={t.accent} strokeWidth={2.6} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {items.length === 0 ? (
              <div className="py-12 text-center">
                <p style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{tr("Nothing attached yet")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {items.map((it, i) => (
                  <MediaRow key={it.id} item={it} cfg={cfg} sport={sport} delay={i * 60}
                            onAnnotate={() => onAnnotate && onAnnotate(it.angle)}
                            onTranscribe={() => transcribeClip(it.id)}
                            onRemove={() => removeItem(it.id)} />
                ))}
              </div>
            )}
            <div style={{ height: 26 }} />
          </div>)}

          {/* ---------- 6 · what happens next ----------
              Drills, a focus and a goal, chosen inline. A coach should
              not have to publish and then hunt three separate buttons —
              that is how drills stop getting set at all. */}
          {/* ---------- 5 · drills ---------- */}
          {step === 5 && (<div className="px-6">
            <div className="flex flex-wrap gap-2">
              {[...recommended, ...extraDrills.map((x) => ({ t: x }))].map((d, i) => {
                const on = nextDrills.includes(d.t);
                return (
                  <button key={d.t} onClick={() => { haptic(7); soft(); setNextDrills(on ? nextDrills.filter((x) => x !== d.t) : [...nextDrills, d.t]); }}
                          className="px-4 active:opacity-60"
                          style={{ minHeight: 48, borderRadius: R.pill, background: on ? t.accent : t.surface,
                                   border: `1px solid ${on ? t.accent : t.hair}`, fontFamily: ui, fontSize: 14,
                                   fontWeight: 600, color: on ? t.onAccent : t.sub,
                                   transition: "background 200ms, transform 200ms cubic-bezier(.34,1.56,.64,1)",
                                   transform: on ? "scale(1.04)" : "scale(1)",
                                   animation: `fadeUp 360ms cubic-bezier(.22,1,.36,1) ${i * 50}ms both` }}>{d.t}</button>
                );
              })}
            </div>
            {/* Anything the coach types becomes a drill and stays
                selected — a library that only offers its own contents
                is a library nobody adds to. */}
            <div className="flex gap-2 mt-5">
              <div className="flex-1"><VoiceInput value={ownDrill} onChange={setOwnDrill} ph={tr("Add your own")} /></div>
              <button onClick={() => { const v = ownDrill.trim(); if (!v) return;
                        hapticSuccess(); soft(); setExtraDrills([...extraDrills, v]); setNextDrills([...nextDrills, v]); setOwnDrill("");
                        /* Typed once, remembered from here on — this is
                           what makes the suggestion list a coach's own
                           over time rather than a fixed starter set. */
                        onSaveDrill && onSaveDrill({ t: v, d: "", focus: focus[0] || cfg.focus[0].id }); }}
                      disabled={!ownDrill.trim()} className="shrink-0 active:opacity-60 disabled:opacity-25"
                      style={{ width: 52, minHeight: 52, borderRadius: R.surface, background: t.accent }} aria-label={tr("Add")}>
                <Plus size={18} color={t.onAccent} strokeWidth={2.1} />
              </button>
            </div>
            {nextDrills.length > 0 && (
              <p className="mt-4" style={{ fontFamily: ui, fontSize: 13, color: t.faint,
                     animation: "fadeUp 320ms cubic-bezier(.22,1,.36,1) both" }}>
                {nextDrills.length} {tr("set for")} {first}
              </p>
            )}
            <div style={{ height: 26 }} />
          </div>)}

          {/* ---------- 6 · the one thing ---------- */}
          {step === 6 && (<div className="px-6">
            <VoiceInput value={nextTip} onChange={setNextTip}
                        ph={chosen[0] ? `${tr("e.g.")} ${chosen[0].toLowerCase()}` : tr("Keep it to one sentence")} autoFocus />
            <div className="flex flex-wrap gap-2 mt-4">
              {(cfg.tipLibrary ? cfg.tipLibrary.map((x) => x.t) : TIP_PROMPTS[sport] || []).slice(0, 4).map((tp, i) => (
                <button key={tp} onClick={() => { haptic(6); soft(); setNextTip(tp); }} className="px-3.5 active:opacity-60"
                        style={{ minHeight: 40, borderRadius: R.pill, background: t.wash, fontFamily: ui, fontSize: 12.5, color: t.sub,
                                 animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>{tp}</button>
              ))}
            </div>
            <div style={{ height: 26 }} />
          </div>)}

          {/* ---------- 7 · ask for a rating ---------- */}
          {step === 7 && (
            <div className="px-6" style={{ animation: "contentRise 380ms cubic-bezier(.22,1,.36,1) both" }}>
              <button onClick={() => { haptic(9); soft(); setWantRating(!wantRating); }}
                      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                      className="w-full flex items-center gap-4 px-5 text-left active:opacity-80"
                      style={{ minHeight: 84, borderRadius: R.surface, willChange: "transform",
                               background: wantRating ? t.accent : t.surface,
                               boxShadow: wantRating ? `0 8px 22px ${t.accent}2E` : ELEV.rest,
                               transition: "transform 160ms cubic-bezier(.34,1.56,.64,1), background 240ms" }}>
                <span className="rounded-full flex items-center justify-center shrink-0"
                      style={{ width: 40, height: 40, background: wantRating ? "rgba(255,255,255,0.18)" : t.wash }}>
                  {wantRating
                    ? <Check size={19} color="#fff" strokeWidth={2.4} style={{ animation: "checkPop 400ms cubic-bezier(.28,1.4,.5,1) both" }} />
                    : <Sparkles size={18} color={t.sub} strokeWidth={1.7} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...TYPE.subhead, color: wantRating ? "#fff" : t.ink }}>{tr("Ask for a rating")}</span>
                  <span className="block mt-0.5" style={{ ...TYPE.caption, color: wantRating ? "rgba(255,255,255,0.7)" : t.faint }}>
                    {wantRating ? tr("They'll be asked once") : tr("Off")}
                  </span>
                </span>
              </button>
            </div>
          )}

        </div>

        <div className="px-6 py-3.5 shrink-0" style={{ background: t.page, borderTop: `1px solid ${t.hair}` }}>
          {step < 7 ? (
            <div className="flex gap-2.5">
              {step >= 1 && (
                <button onClick={() => { hapticCommit(); finish(); }}
                        onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                        onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                        onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }} className="px-5 active:opacity-60"
                        style={{ minHeight: 54, borderRadius: R.surface, border: `1px solid ${t.hair}`, willChange: "transform",
                                 transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                                 fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.sub }}>{L.publish}</button>
              )}
              <div className="flex-1"><Button tone="ink" disabled={!canAdvance}
                    onClick={() => { haptic(8); if (step === 6 && !showReviewAsk) finish(); else setStep(step + 1); }}>
                    {step === 6 && !showReviewAsk ? L.publish : L.continue}
                  </Button></div>
            </div>
          ) : (
            <button onClick={() => { hapticCommit(); finish(); }}
                    onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                    onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    className="w-full flex items-center justify-center gap-3 active:opacity-90"
                    style={{ minHeight: 66, borderRadius: R.surface, background: t.accent,
                             boxShadow: `0 10px 32px ${t.accent}59`, willChange: "transform",
                             fontFamily: display, fontSize: 21, letterSpacing: "-0.022em", color: t.onAccent,
                             transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                             animation: "liftIn 460ms cubic-bezier(.34,1.56,.64,1) both, glowPulse 3s ease-in-out 1.2s infinite" }}>
              {L.publish}
              <ArrowRight size={20} color={t.onAccent} strokeWidth={2.1} />
            </button>
          )}
        </div>
        {cam && <CameraView angles={cfg.angles} onClose={() => setCam(false)} onCapture={(angle, sc) => { setVideos([...videos, { angle, secs: sc || 8 }]); setCam(false); }} />}
      </div>
    </SwipeBack>
  );
}

function CoachRoster({ groups, invited, roster, requests, push, pop, sheet, say, right, coachName, noun, nouns }) {
  const t = useT(); const L = useL();
  const nounTitle = nouns ? nouns.charAt(0).toUpperCase() + nouns.slice(1) : "Players";
  const [tab, setTab] = useState(nounTitle); const [q, setQ] = useState("");
  const list = (roster || ROSTER).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Screen title={L.roster} meta={`${(roster || ROSTER).length} ${nouns} · ${groups.length} groups`} right={right}>
        {/* One way in, not three. The code is the invite — sharing it
            is the same act as inviting someone, so it is one control. */}
        <div className="px-6 mb-5">
          <button onClick={() => { hapticCommit(); soft(); sheet("import"); }}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="w-full flex items-center gap-4 px-5 text-left active:opacity-90"
                  style={{ minHeight: 84, borderRadius: R.surface, background: t.accent, willChange: "transform",
                           boxShadow: ELEV.raise, transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                           animation: "liftIn 460ms cubic-bezier(.22,1,.36,1) both" }}>
            <span className="p-1.5 shrink-0" style={{ borderRadius: R.field, background: "rgba(255,255,255,0.1)" }}>
              <QrSvg size={36} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ ...TYPE.eyebrow, fontSize: 8, color: "rgba(255,255,255,0.5)" }}>{tr("Invite")} {nouns}</span>
              <span className="block mt-1.5" style={{ fontFamily: display, fontSize: 22, letterSpacing: "0.12em", color: "#fff" }}>RD4K9P</span>
            </span>
            <Share2 size={18} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        {requests && requests.length > 0 && (
          <div className="px-6 mb-4">
            <button onClick={() => { haptic(8); push("requests"); }} className="w-full px-5 flex items-center gap-3.5 active:opacity-60"
                    style={{ minHeight: 56, borderRadius: R.surface, background: `${t.accent}0F`, border: `1px solid ${t.accent}1C` }}>
              <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: t.accent }}>
                <UserPlus size={14} color={t.onAccent} />
              </span>
              <span className="flex-1 text-left" style={{ fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.ink }}>
                {requests.length} {requests.length === 1 ? tr("asking to join") : tr("asking to join")}
              </span>
              <ChevronRight size={16} color={t.accent} />
            </button>
          </div>
        )}

        <div className="px-6 mb-4"><Segmented options={[nounTitle, "Groups"]} value={tab} onChange={setTab} /></div>
        {tab === nounTitle ? (<>
          <div className="px-6 mb-4"><div className="flex items-center gap-2.5 rounded-2xl px-4" style={{ minHeight: 44, background: t.wash }}>
            <Search size={16} color={t.faint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${nouns || "players"}`} className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 15, color: t.ink, background: "transparent" }} />
            {q && <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={15} color={t.faint} /></button>}
            <MicBtn onText={(txt) => setQ(txt)} size={28} />
          </div></div>
          <div className="px-6 pb-2">
            <div className="mb-4" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>{list.length === 0 ? (<div className="p-7 text-center"><p style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>No one matching “{q}”.</p></div>) : list.map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 px-4"
                   style={{ minHeight: 66, borderBottom: i === list.length - 1 ? "none" : `1px solid ${t.hair}`,
                            animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 40}ms both` }}>
                <button onClick={() => { haptic(6); push("player:" + r.name); }} className="flex-1 flex items-center gap-3.5 text-left min-w-0 active:opacity-50">
                  <Avatar name={r.name} size={38} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{r.name}</span>
                    <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                      {`${r.lessons} ${tr("lessons")}`}
                    </span>
                  </span>
                </button>
                <button onClick={() => { haptic(6); push("thread:" + r.name); }} className="shrink-0 active:opacity-50 p-2" aria-label={`Message ${r.name}`}>
                  <MessageCircle size={17} color={t.faint} strokeWidth={1.6} />
                </button>
                <button onClick={() => { haptic(6); push("history:" + r.name); }} className="shrink-0 active:opacity-50 p-2" aria-label={`${r.name} history`}>
                  <TrendingUp size={17} color={t.faint} strokeWidth={1.6} />
                </button>
              </div>
            ))}</div>
          </div>
          {invited.length > 0 && (<>
            <Eyebrow>{tr("Invited, not joined yet")}</Eyebrow>
            <div className="px-6 pb-2"><Card>
              {invited.map((p, i) => (
                <Row key={p.name} label={p.name} sub={tr("Sent a text with your invite link")} icon={<Avatar name={p.name} size={38} />}
                     right={<TextBtn onClick={() => say(`Resent to ${p.name.split(" ")[0]}`)}>{tr("Resend")}</TextBtn>}
                     last={i === invited.length - 1} />
              ))}
            </Card></div>
          </>)}
        </>) : (
          <div className="px-6 pb-2">
            <Card className="mb-4">{groups.length === 0 ? (<div className="p-7 text-center"><p style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{tr("No groups yet.")}</p></div>) : groups.map((g, i) => (
              <Row key={g.id} label={g.name} sub={`${g.members.length} players · ${DAY_NAMES[g.day].slice(0,3)} ${g.time} · ${g.weeks} weeks`} chevron last={i === groups.length - 1}
                   icon={<span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: t.wash }}><Users size={16} color={GROUP} /></span>}
                   onToggle={() => push("group:" + g.name)} />
            ))}</Card>
            <Card><Row label={tr("Create a group")} last icon={<Plus size={18} color={t.sub} strokeWidth={2} />} onToggle={() => sheet("group")} /></Card>
          </div>
        )}
      </Screen>
    </>
  );
}
/* What a coach needs before a lesson, in the order they need it. Past
   lessons come first and are large, because looking back at the last
   session is the most common reason to open a player at all. */
function RosterPlayer({ name, note, setNote, sportTool, seriesFor, onRecurring, pop, push, say, assignDrills, assignTip, live }) {
  const t = useT();
  /* `live` is the real roster. With it, an unknown player is genuinely
     unknown — no invented file, no borrowed history from a seeded
     person. */
  const r = live ? (live.find((x) => x.name === name) || { name, lessons: 0 })
                 : (ROSTER.find((x) => x.name === name) || ROSTER[0]);
  const f = live ? { lessons: [], name } : fileFor(name);
  const [more, setMore] = useState(false);
  const past = (f.lessons || [
    { d: "14 Jun", focus: f.lastFocus || "Short game", note: "Contact much cleaner off a tighter lie." },
    { d: "31 May", focus: "Driving", note: "Tempo over speed. Held the finish." },
    { d: "17 May", focus: "Putting", note: "Same routine every putt." },
  ]);

  return (
    <SwipeBack onBack={pop}>
      <Screen title={name} onBack={pop} meta={`${f.done} ${tr("lessons")} · ${tr("last")} ${r.last}d`}>
        <div className="px-6 pb-2">

          {/* your own note, first, because it is the thing you wrote to
              remember and it is useless anywhere else */}
          {f.note && (
            <div className="mb-7 pl-4" style={{ borderLeft: `2px solid ${t.accent}` }}>
              <p style={{ ...TYPE.subhead, color: t.ink }}>{f.note}</p>
            </div>
          )}

          {/* past lessons: the reason you opened this */}
          <div className="mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Lessons")}</div>
          <div className="mb-7" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
            {past.map((l, i) => (
              <button key={i} onClick={() => { haptic(7); soft(); push("history:" + name); }}
                      className="w-full flex items-start gap-4 text-left active:opacity-50"
                      style={{ minHeight: 76, paddingTop: 14, paddingBottom: 14,
                               borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                               animation: `fadeUp 320ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }}>
                <span className="shrink-0" style={{ width: 52, ...TYPE.eyebrow, color: t.faint, paddingTop: 3 }}>{l.d}</span>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...TYPE.subhead, color: t.ink }}>{l.focus}</span>
                  {l.note && <span className="block mt-1 truncate" style={{ ...TYPE.small, color: t.faint }}>{l.note}</span>}
                </span>
                <ChevronRight size={15} color={t.faint} style={{ marginTop: 4 }} />
              </button>
            ))}
          </div>

          {/* what is live right now — three lines, no cards */}
          {(f.tip || f.goal || seriesFor) && (
            <div className="mb-7">
              {seriesFor && (
                <div className="flex items-baseline gap-3 py-2">
                  <span className="shrink-0" style={{ width: 52, ...TYPE.eyebrow, color: t.faint }}>{tr("Next")}</span>
                  <span style={{ ...TYPE.body, color: t.ink }}>{DAY_NAMES[seriesFor.day]} {seriesFor.time}</span>
                </div>
              )}
              {f.tip && (
                <div className="flex items-baseline gap-3 py-2">
                  <span className="shrink-0" style={{ width: 52, ...TYPE.eyebrow, color: t.faint }}>{tr("Focus")}</span>
                  <span style={{ ...TYPE.body, color: t.ink }}>{f.tip}</span>
                </div>
              )}
              {f.goal && (
                <div className="flex items-baseline gap-3 py-2">
                  <span className="shrink-0" style={{ width: 52, ...TYPE.eyebrow, color: t.faint }}>{tr("Goal")}</span>
                  <span style={{ ...TYPE.body, color: t.ink }}>{f.goal}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2.5 mb-6">
            <button onClick={() => { haptic(8); push("thread:" + name); }} className="flex-1 active:opacity-60"
                    style={{ minHeight: 48, borderRadius: R.control, border: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                             ...TYPE.small, fontWeight: 600, color: t.ink }}>{tr("Message")}</button>
            <button onClick={() => { hapticCommit(); assignDrills(name, null); }} className="flex-1 active:opacity-75"
                    style={{ minHeight: 48, borderRadius: R.control, background: t.accent,
                             ...TYPE.small, fontWeight: 600, color: t.onAccent }}>{tr("Set drills")}</button>
          </div>

          {/* everything else, folded away */}
          <button onClick={() => { haptic(6); setMore(!more); }}
                  className="w-full flex items-center gap-2 py-3 active:opacity-50">
            <span style={{ ...TYPE.small, fontWeight: 500, color: t.sub }}>{tr("More")}</span>
            <ChevronDown size={13} color={t.faint}
                         style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform 240ms cubic-bezier(.22,1,.36,1)" }} />
          </button>

          {more && (
            <div style={{ animation: "contentRise 340ms cubic-bezier(.22,1,.36,1) both" }}>
              {[[tr("Recurring lessons"), () => onRecurring(name)],
                [tr("Progress"), () => push("history:" + name)],
                [sportTool ? sportTool.label : tr("Sport record"), () => push("tool")],
                [tr("What they're working on"), () => assignTip(name, null)]].map(([lbl, act], i) => (
                <button key={lbl} onClick={act} className="w-full flex items-center text-left active:opacity-50"
                        style={{ minHeight: 52, borderBottom: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                  <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{lbl}</span>
                  <ChevronRight size={14} color={t.faint} />
                </button>
              ))}
              <div className="mt-5">
                <div className="mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Your note")}</div>
                <VoiceArea value={note} onChange={setNote} rows={3} ph={tr("Only you see this")} />
              </div>
            </div>
          )}
          <div style={{ height: 26 }} />
        </div>
      </Screen>
    </SwipeBack>
  );
}


/* A child signing in on their own device. The account still belongs to
   the parent — this is a view onto it, not a separate account, which is
   what keeps the safeguarding position clean. */
function JuvenileJoin({ sport, onDone, onBack }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  useEffect(() => {
    if (code.length !== 6) { setFound(null); return; }
    const x = setTimeout(() => { setFound("Ellie Tran"); haptic(14); tone(720, 0.12, 0.04); }, 500);
    return () => clearTimeout(x);
  }, [code]);
  return (
    <Frame step={stepOf("player", "connect")} steps={stepsIn("player")} onBack={onBack} footer={<Button tone="ink" disabled={!found} onClick={() => onDone(found)}>{found ? `Continue as ${found.split(" ")[0]}` : "Enter your code"}</Button>}>
      <div className="pt-8">
        <Headline>{tr("Your family code")}</Headline>
        <Sub>Ask a parent for the six-character code in their app, under Family.</Sub>
        <div className="mt-8 mb-3"><CodePad value={code} onChange={setCode} /></div>
        <div className="text-center" style={{ minHeight: 46 }}>
          {found ? (
            <div className="flex items-center gap-3 text-left"><Avatar name={found} size={40} />
              <span className="flex-1"><span className="block" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.ink }}>{found}</span>
                <span className="block" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{tr("Managed by a parent")}</span></span>
              <Check size={19} color={STEADY} strokeWidth={2.1} /></div>
          ) : <span style={{ ...TYPE.small, color: t.faint }}>{tr("Six characters")}</span>}
        </div>
        <div className="mt-8 p-4" style={{ borderRadius: R.surface, background: t.wash }}>
          <p style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: t.sub }}>
            Lessons, drills and the family calendar. Messaging stays with your parent.
          </p>
        </div>
      </div>
    </Frame>
  );
}

/* Everything a coach has ever logged, searchable. Fifty players over a
   season is a lot of lessons to scroll, so search and filters carry it. */
function CoachArchive({ cfg, lessons, nouns, pop, push, say }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState("All");
  const [kind, setKind] = useState("All");
  const [month, setMonth] = useState("All");

  const months = ["All", ...[...new Set(lessons.map((l) => l.m))]];
  const term = q.trim().toLowerCase();
  const shown = lessons.filter((l) =>
    (!term || l.who.toLowerCase().includes(term) || l.focus.toLowerCase().includes(term) || l.subs.some((x) => x.toLowerCase().includes(term)))
    && (focus === "All" || l.focus === focus)
    && (kind === "All" || l.type === kind)
    && (month === "All" || l.m === month));

  /* Grouped by month so the list has some shape to it. */
  const groups = [];
  shown.forEach((l) => {
    const g = groups.find((x) => x.m === l.m);
    if (g) g.items.push(l); else groups.push({ m: l.m, items: [l] });
  });

  const Chips = ({ options, value, onChange }) => (
    <div className="flex gap-2 overflow-x-auto px-6 pb-3" style={{ scrollbarWidth: "none" }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} onClick={() => { haptic(5); onChange(o); }} className="px-3.5 shrink-0 active:opacity-60"
                  style={{ minHeight: 32, borderRadius: R.surface, background: on ? t.ink : "transparent",
                           border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 12, fontWeight: 600,
                           color: on ? "#fff" : t.sub }}>{o}</button>
        );
      })}
    </div>
  );

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("All lessons")} onBack={pop} meta={`${shown.length} of ${lessons.length}`}>
        <div className="px-6 mb-4">
          <div className="flex items-center gap-2.5 px-4" style={{ minHeight: 48, borderRadius: R.surface, background: t.wash }}>
            <Search size={16} color={t.faint} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${nouns} or what you covered`}
                   className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 15, color: t.ink, background: "transparent" }} />
            {q ? <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={15} color={t.faint} /></button>
               : <MicBtn onText={(txt) => setQ(txt)} size={28} />}
          </div>
        </div>

        <Chips options={["All", ...cfg.focus.map((f) => f.label)]} value={focus} onChange={setFocus} />
        <Chips options={["All", "Private", "Group"]} value={kind} onChange={setKind} />
        <Chips options={months} value={month} onChange={setMonth} />

        <div className="px-6 pb-2 mt-2">
          {shown.length === 0 ? (
            <p className="py-12 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("Nothing matches those filters.")}</p>
          ) : groups.map((g) => (
            <div key={g.m} className="mb-6">
              <div className="uppercase mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{g.m}</div>
              <div style={{ borderTop: `1px solid ${t.hair}` }}>
                {g.items.map((l) => (
                  <button key={l.id} onClick={() => { haptic(6); push(`clesson:${l.who}:${l.id}`); }}
                          className="w-full flex items-center gap-3.5 text-left active:opacity-50"
                          style={{ minHeight: 66, borderBottom: `1px solid ${t.hair}` }}>
                    <span className="shrink-0" style={{ width: 26, fontFamily: display, fontSize: 16, color: t.faint }}>{l.d}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{l.who}</span>
                      <span className="block mt-0.5 truncate" style={{ ...TYPE.caption, color: t.faint }}>
                        {l.focus}{l.subs.length ? ` · ${l.subs[0]}` : ""}
                      </span>
                    </span>
                    {l.type === "Group" && <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: GROUP }} />}
                    {l.videos > 0 && <span className="shrink-0" style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{l.videos} clip{l.videos > 1 ? "s" : ""}</span>}
                    <ChevronRight size={15} color={t.faint} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* A standing arrangement with one person: how often, at what time, and
   how many are paid for. Saving it books the slots out. */
function RecurringSetup({ name, existing, slots, duration, onSave, onEnd, close, say }) {
  const t = useT();
  const [day, setDay] = useState(existing?.day ?? 1);
  const [time, setTime] = useState(existing?.time ?? slots[0]);
  const [freq, setFreq] = useState(existing?.freq ?? "weekly");
  const [total, setTotal] = useState(existing?.total ?? 10);

  const preview = seriesOccurrences(day, Math.min(total, 3), freq);
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.02em", color: t.ink }}>
        {existing ? "Recurring lessons" : `Set up ${(name || "").split(" ")[0]}`}
      </h2>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Day")}</div>
      <div className="flex gap-1.5 mb-5">
        {DAY_NAMES.map((n, i) => {
          const on = day === i;
          return (<button key={n} onClick={() => { haptic(5); setDay(i); }} className="flex-1 active:opacity-60"
                          style={{ minHeight: 44, borderRadius: R.control, background: on ? t.accent : t.wash,
                                   fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{n.slice(0, 2)}</button>);
        })}
      </div>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Time")}</div>
      <div className="flex flex-wrap gap-2 mb-5">
        {slots.map((sl) => {
          const on = time === sl;
          return (<button key={sl} onClick={() => { haptic(5); setTime(sl); }} className="px-3.5 active:opacity-60"
                          style={{ minHeight: 38, borderRadius: R.pill, background: on ? t.accent : t.wash,
                                   fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{span(sl, duration)}</button>);
        })}
      </div>

      <div className="uppercase mb-2.5" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("How often")}</div>
      <div className="flex gap-2 mb-5">
        {[["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]].map(([id, lbl]) => {
          const on = freq === id;
          return (<button key={id} onClick={() => { haptic(5); setFreq(id); }} className="flex-1 active:opacity-60"
                          style={{ minHeight: 44, borderRadius: R.control, background: on ? t.accent : t.wash,
                                   fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{lbl}</button>);
        })}
      </div>

      <div className="flex items-center justify-between mb-5">
        <span style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{tr("End date")}</span>
        <span className="flex items-center gap-3">
          <button onClick={() => { haptic(5); setTotal(Math.max(1, total - 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("Fewer")}><Minus size={15} color={t.ink} /></button>
          <span style={{ fontFamily: display, fontSize: 22, color: t.ink, minWidth: 26, textAlign: "center" }}>{total}</span>
          <button onClick={() => { haptic(5); setTotal(Math.min(24, total + 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("More")}><Plus size={15} color={t.ink} /></button>
        </span>
      </div>

      <div className="p-4 mb-5" style={{ borderRadius: R.surface, background: t.wash }}>
        <p style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.6, color: t.sub }}>
          {DAY_NAMES[day]}s at {time}, {freq}. First three:{" "}
          {preview.map((o) => `${o.d} ${MONTHS.find((x) => x.idx === o.m)?.name.slice(0, 3)}`).join(", ")}.
        </p>
      </div>

      <Button onClick={() => { onSave({ who: name, day, time, freq, total }); close(); }}>
        {existing ? "Update" : `Book ${total} lessons`}
      </Button>
      {existing && (
        <button onClick={() => { hapticWarn(); onEnd(existing); close(); }} className="w-full mt-3 py-3 active:opacity-50"
                style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: DANGER }}>{tr("End this arrangement")}</button>
      )}
    </>
  );
}

/* What the coach sees when they open a lesson they gave: the same
   record the player has, plus what they set afterwards. */
function CoachLessonView({ name, lesson, cfg, pop, push, say, assignDrills }) {
  const t = useT();
  const [a, setA] = useState(0);
  const angles = cfg.angles.slice(0, lesson.videos || 1);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={lesson.focus} onBack={pop} meta={`${name} · ${lesson.d} ${lesson.m}`}>
        <div className="px-6">
          {angles.length > 0 && (<>
            <Clip angle={angles[a]} />
            {angles.length > 1 && (
              <div className="flex gap-2 overflow-x-auto mt-3" style={{ scrollbarWidth: "none" }}>
                {angles.map((v, i) => (
                  <button key={v + i} onClick={() => { haptic(6); setA(i); }} className="shrink-0 overflow-hidden"
                          style={{ borderRadius: R.field, opacity: i === a ? 1 : 0.45, border: i === a ? `2px solid ${t.accent}` : "2px solid transparent" }}>
                    <Clip angle={v} size="sm" dur="" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { haptic(8); push("annotate:" + angles[a]); }} className="w-full mt-3 flex items-center justify-center gap-2 active:opacity-60"
                    style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}` }}>
              <Palette size={14} color={t.sub} /><span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink }}>{tr("Mark it up")}</span>
            </button>
          </>)}

          <div className="flex flex-wrap gap-1.5 mt-5 mb-6">
            <span className="px-3 py-1.5" style={{ borderRadius: R.surface, background: t.wash, fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{lesson.type}</span>
            {(lesson.subs || []).map((sb) => (
              <span key={sb} className="px-3 py-1.5" style={{ borderRadius: R.surface, background: t.wash, fontFamily: ui, fontSize: 11.5, color: t.sub }}>{sb}</span>
            ))}
          </div>

          <Eyebrow>{tr("What you said")}</Eyebrow>
          <Card className="p-5 mb-6">
            <p style={{ fontFamily: display, fontSize: 15, lineHeight: 1.7, color: t.ink }}>{cfg.transcript}</p>
          </Card>

          <div style={{ borderTop: `1px solid ${t.hair}` }}>
            <button onClick={() => { haptic(8); assignDrills(name, lesson.focusId); }} className="w-full flex items-center text-left active:opacity-50"
                    style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
              <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{tr("Set drills from this lesson")}</span><ChevronRight size={16} color={t.faint} />
            </button>
            <button onClick={() => { haptic(8); push("thread:" + name); }} className="w-full flex items-center text-left active:opacity-50"
                    style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
              <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>Message {(name || "").split(" ")[0]}</span><ChevronRight size={16} color={t.faint} />
            </button>
            <button onClick={() => { haptic(8); say("Duplicated — edit and publish"); }} className="w-full flex items-center text-left active:opacity-50"
                    style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
              <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{tr("Log another like this")}</span><ChevronRight size={16} color={t.faint} />
            </button>
          </div>
          <div style={{ height: 26 }} />
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* A player's own view of the groups they train with. The same session
   record their coach sees, and the other members see — a group is a
   shared thing, so its history should be shared too. */
function MyGroups({ groups, cfg, nouns, pop, push, say }) {
  const t = useT();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Your groups")} onBack={pop} meta={groups.length ? `${groups.length} you train with` : "Not in a group yet"}>
        <div className="px-6 pb-2">
          {groups.length === 0 ? (
            <div className="py-12 text-center">
              <p style={{ fontFamily: display, fontSize: 20, letterSpacing: "-0.02em", color: t.ink }}>{tr("No groups yet")}</p>
              <p className="mt-2.5" style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{tr("Clinics and squads show here.")}</p>
            </div>
          ) : (
            <div style={{ borderTop: `1px solid ${t.hair}` }}>
              {groups.map((g) => (
                <button key={g.id} onClick={() => { haptic(8); push("mygroup:" + g.name); }}
                        className="w-full flex items-center gap-3.5 text-left active:opacity-50"
                        style={{ minHeight: 78, borderBottom: `1px solid ${t.hair}` }}>
                  <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: t.wash }}>
                    <Users size={17} color={GROUP} strokeWidth={1.6} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontFamily: display, fontSize: 19, letterSpacing: "-0.02em", color: t.ink }}>{g.name}</span>
                    <span className="block mt-1" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>
                      {DAY_NAMES[g.day]}s {g.time} · {g.members.length} {nouns}
                    </span>
                  </span>
                  <ChevronRight size={16} color={t.faint} />
                </button>
              ))}
            </div>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* The one screen that is genuinely different in each sport. */
function SportTool({ cfg, sport, rows, onAdd, onRemove, pop, say }) {
  const t = useT();
  const tool = TOOLS[sport];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(tool.columns.map(() => ""));

  if (!tool) return null;
  const submit = () => {
    if (!draft[0].trim()) return;
    onAdd(draft.map((x) => x.trim() || "—"));
    setDraft(tool.columns.map(() => ""));
    setAdding(false); hapticSuccess(); chime(); say("Added");
  };

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tool.label} onBack={pop} meta={tool.blurb}
              right={<TextBtn onClick={() => { haptic(8); setAdding(!adding); }}>{adding ? "Cancel" : "Add"}</TextBtn>}>
        {adding && (
          <div className="px-6 mb-5"><Card className="p-5">
            {tool.columns.map((c, i) => (
              <div key={c} className={i ? "mt-2" : ""}>
                <VoiceInput value={draft[i]} onChange={(v) => setDraft(draft.map((x, j) => (j === i ? v : x)))} ph={c} autoFocus={i === 0} />
              </div>
            ))}
            <div className="mt-5"><Button disabled={!draft[0].trim()} onClick={submit}>{tool.addLabel}</Button></div>
          </Card></div>
        )}

        <div className="px-6 pb-2">
          <div className="flex px-1 pb-2.5" style={{ borderBottom: `1px solid ${t.hair}` }}>
            {tool.columns.map((c, i) => (
              <span key={c} className="uppercase" style={{ flex: i === 0 ? 1.6 : 1, fontFamily: ui, fontSize: 9,
                             letterSpacing: "0.2em", fontWeight: 600, color: t.faint, textAlign: i === 0 ? "left" : "right" }}>{c}</span>
            ))}
            <span style={{ width: 22 }} />
          </div>
          {rows.length === 0 ? (
            <p className="py-10 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("Nothing here yet.")}</p>
          ) : rows.map((r, ri) => (
            <div key={ri} className="flex items-center px-1" style={{ minHeight: 54, borderBottom: `1px solid ${t.hair}` }}>
              {r.map((cell, ci) => (
                <span key={ci} style={{ flex: ci === 0 ? 1.6 : 1, textAlign: ci === 0 ? "left" : "right",
                        fontFamily: ci === 0 ? ui : display, fontSize: ci === 0 ? 15 : 16,
                        letterSpacing: ci === 0 ? "-0.005em" : "-0.01em",
                        color: ci === 0 ? t.ink : (ci === r.length - 1 && /lost/i.test(cell) ? DANGER : t.ink) }}>{cell}</span>
              ))}
              <button onClick={() => { haptic(6); onRemove(ri); }} className="active:opacity-50" style={{ width: 22 }} aria-label={tr("Remove")}>
                <X size={13} color={t.faint} />
              </button>
            </div>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Group lessons need different information from private ones: nobody
   cares about one person's handicap here, they care about who came and
   what the session covered. */
function GroupHistory({ group, cfg, pop, say, onOpen }) {
  const t = useT();
  const weeks = [
    { when: "Sat 19 Jul", covered: cfg.focus[2].label, subs: cfg.focus[2].subs.slice(0, 2), present: group.members.length, absent: 0 },
    { when: "Sat 12 Jul", covered: cfg.focus[0].label, subs: cfg.focus[0].subs.slice(0, 2), present: group.members.length - 1, absent: 1 },
    { when: "Sat 5 Jul",  covered: cfg.focus[3].label, subs: cfg.focus[3].subs.slice(0, 1), present: group.members.length - 2, absent: 2 },
  ];
  const avg = Math.round(weeks.reduce((n, w) => n + w.present, 0) / weeks.length);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={group.name} onBack={pop} meta={`${group.members.length} ${cfg.nouns} · ${DAY_NAMES[group.day]}s ${group.time}`}>
        <div className="px-6 mb-6">
          <div className="flex" style={{ borderTop: `1px solid ${t.hair}`, borderBottom: `1px solid ${t.hair}` }}>
            {[["Sessions", String(weeks.length)], ["Average in", String(avg)], ["Weeks left", String(group.weeks - weeks.length)]].map(([k, v], i) => (
              <div key={k} className="flex-1 py-4" style={{ borderLeft: i ? `1px solid ${t.hair}` : "none", paddingLeft: i ? 14 : 0 }}>
                <div style={{ fontFamily: display, fontSize: 26, lineHeight: 1, letterSpacing: "-0.02em", color: t.ink }}>{v}</div>
                <div className="mt-1.5 uppercase" style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.18em", color: t.faint }}>{k}</div>
              </div>
            ))}
          </div>
        </div>

        <Eyebrow>{tr("Week by week")}</Eyebrow>
        <div className="px-6 mb-6">
          {weeks.map((w, i) => (
            <div key={i} className="py-4" style={{ borderBottom: `1px solid ${t.hair}` }}>
              <div className="flex items-baseline justify-between">
                <span style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: t.ink }}>{w.covered}</span>
                <span style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{w.when}</span>
              </div>
              <div className="mt-1.5" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{w.subs.join(" · ")}</div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="flex gap-1">
                  {Array.from({ length: group.members.length }).map((_, k) => (
                    <span key={k} className="rounded-full" style={{ width: 6, height: 6, background: k < w.present ? t.accent : t.hair }} />
                  ))}
                </span>
                <span style={{ ...TYPE.caption, color: t.faint }}>{w.present} in{w.absent ? `, ${w.absent} out` : ""}</span>
              </div>
            </div>
          ))}
        </div>

        <Eyebrow>{tr("Who's in the group")}</Eyebrow>
        <div className="px-6 pb-2">
          <Card>{group.members.map((mname, i) => (
            <Row key={mname} label={mname} icon={<Avatar name={mname} size={36} />} chevron last={i === group.members.length - 1} onToggle={() => onOpen && onOpen(mname)} />
          ))}</Card>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* A code puts someone in this queue. Nothing about them reaches the
   coach's roster until the coach says yes — which is the safeguarding
   default when the person on the other end may be a minor. */
function JoinRequests({ requests, onAccept, onDecline, pop, nouns }) {
  const t = useT();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Requests")} onBack={pop} meta={requests.length ? `${requests.length} waiting` : "Nothing waiting"}>
        <div className="px-6 pb-2">
          {requests.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="rounded-full flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, background: t.wash }}><Check size={22} color={t.sub} strokeWidth={2} /></span>
              <p style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{tr("All clear")}</p>
              <p className="mt-2" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>New {nouns} using your code will appear here first.</p>
            </Card>
          ) : requests.map((r) => (
            <Card key={r.name} className="p-5 mb-3">
              <div className="flex items-center gap-3.5 mb-4">
                <Avatar name={r.name} size={46} />
                <span className="flex-1"><span className="block" style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{r.name}</span>
                  <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{r.note} · {r.when}</span></span>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => onDecline(r)} className="flex-1 rounded-2xl active:opacity-60" style={{ minHeight: 48, border: `1px solid ${t.hair}`, fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.sub }}>{tr("Decline")}</button>
                <button onClick={() => onAccept(r)} className="flex-1 rounded-2xl active:opacity-75" style={{ minHeight: 48, background: STEADY, fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.onAccent }}>{tr("Accept")}</button>
              </div>
            </Card>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Sessions that happened and were never logged. They collect here
   instead of disappearing, and each one opens the log pre-filled. */
function UnloggedLessons({ items, onLog, onDismiss, pop }) {
  const t = useT();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("To log")} onBack={pop} meta={items.length ? `${items.length} waiting` : "Nothing outstanding"}>
        <div className="px-6 pb-2">
          {items.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="rounded-full flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, background: t.wash }}><Check size={22} color={t.sub} strokeWidth={2} /></span>
              <p style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{tr("Nothing outstanding")}</p>
            </Card>
          ) : items.map((u, i) => (
            <Card key={i} className="p-5 mb-3">
              <div className="flex items-center gap-3.5 mb-4">
                <span className="rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ width: 46, height: 46, background: t.wash }}>
                  <span style={{ fontFamily: display, fontSize: 17, lineHeight: 1, color: t.ink }}>{u.d}</span>
                  <span className="uppercase" style={{ fontFamily: ui, fontSize: 8, letterSpacing: "0.1em", fontWeight: 600, color: t.faint }}>
                    {MONTHS.find((x) => x.idx === u.m)?.name.slice(0, 3)}
                  </span>
                </span>
                <span className="flex-1"><span className="block" style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{u.who}</span>
                  <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{u.time} · {u.kind}</span></span>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { haptic(8); onDismiss(u); }} className="rounded-2xl px-5 active:opacity-60" style={{ minHeight: 48, border: `1px solid ${t.hair}`, fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.sub }}>{tr("Skip")}</button>
                <button onClick={() => { hapticCommit(); onLog(u); }} className="flex-1 rounded-2xl active:opacity-75" style={{ minHeight: 48, background: t.accent, fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.onAccent }}>{tr("Log lesson")}</button>
              </div>
            </Card>
          ))}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Drawing over a frame. Lines are stored as normalised coordinates so
   they sit correctly whatever size the video is played back at. */
/* Marking up a clip. Line, angle, circle and freehand, drawn straight
   onto the frame. If a voice-over is recording, each stroke is stamped
   with the moment it was made — so on playback the drawing appears as
   the coach says it, rather than all at once at the end. */
function VideoAnnotate({ angle, transcript, onSave, pop, say }) {
  const t = useT();
  const [tool, setTool] = useState("line");
  const [shapes, setShapes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [newCap, setNewCap] = useState("");
  const [vo, setVo] = useState("idle");     // idle | recording | done
  const [voSecs, setVoSecs] = useState(0);
  const [playhead, setPlayhead] = useState(null);
  const box = useRef(null);
  const t0 = useRef(0);

  useEffect(() => {
    if (vo !== "recording") return;
    const i = setInterval(() => setVoSecs((v) => v + 0.1), 100);
    return () => clearInterval(i);
  }, [vo]);

  /* Replaying the voice-over redraws the strokes in the order they
     were made, at the moment they were made. */
  useEffect(() => {
    if (playhead === null) return;
    if (playhead > voSecs) { setPlayhead(null); return; }
    const x = setTimeout(() => setPlayhead((p) => p + 0.1), 100);
    return () => clearTimeout(x);
  }, [playhead, voSecs]);

  const rel = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
             y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e) => { const pt = rel(e); t0.current = voSecs; setDraft({ tool, pts: [pt, pt], at: voSecs }); haptic(6); };
  const move = (e) => { if (!draft) return; const pt = rel(e);
    setDraft(tool === "free" ? { ...draft, pts: [...draft.pts, pt] } : { ...draft, pts: [draft.pts[0], pt] }); };
  const up = () => { if (!draft) return; setShapes([...shapes, draft]); setDraft(null); haptic(10); soft(); };

  const visible = playhead === null ? shapes : shapes.filter((sh) => sh.at <= playhead);

  const render = (sh, i) => {
    const p1 = sh.pts[0], p2 = sh.pts[sh.pts.length - 1];
    const col = t.accent;
    if (sh.tool === "free") {
      const d = sh.pts.map((pt, j) => `${j ? "L" : "M"}${pt.x * 100} ${pt.y * 100}`).join(" ");
      return <path key={i} d={d} fill="none" stroke={col} strokeWidth="0.9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
    }
    if (sh.tool === "circle") {
      /* drawn from the centre out, which is how people actually ring
         something they are pointing at */
      const rx = Math.abs(p2.x - p1.x) * 100, ry = Math.abs(p2.y - p1.y) * 100;
      return <ellipse key={i} cx={p1.x * 100} cy={p1.y * 100} rx={Math.max(rx, 1)} ry={Math.max(ry, 1)}
                      fill="none" stroke={col} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />;
    }
    if (sh.tool === "angle") {
      return (<g key={i}>
        <line x1={p1.x * 100} y1={p1.y * 100} x2={p2.x * 100} y2={p1.y * 100} stroke={col} strokeWidth="0.9" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <line x1={p1.x * 100} y1={p1.y * 100} x2={p2.x * 100} y2={p2.y * 100} stroke={col} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      </g>);
    }
    return <line key={i} x1={p1.x * 100} y1={p1.y * 100} x2={p2.x * 100} y2={p2.y * 100} stroke={col} strokeWidth="0.9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
  };

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Mark it up")} onBack={pop} meta={angle}
              right={<TextBtn onClick={() => { onSave(shapes, captions); hapticSuccess(); chime(); say(tr("Saved to the clip")); pop(); }}>{tr("Save")}</TextBtn>}>
        <div className="px-6">
          <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
               className="relative overflow-hidden" style={{ borderRadius: R.surface, height: 232, background: "#191D1B", touchAction: "none", cursor: "crosshair" }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              {visible.map(render)}{draft && render(draft, "d")}
            </svg>
            {shapes.length === 0 && !draft && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span style={{ fontFamily: ui, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{tr("Drag to draw")}</span>
              </div>
            )}
            {vo === "recording" && (
              <div className="absolute flex items-center gap-2 px-3 py-1.5" style={{ top: 10, left: 10, borderRadius: R.pill, background: "rgba(0,0,0,0.5)" }}>
                <span className="rounded-full" style={{ width: 7, height: 7, background: DANGER, animation: "pulseDot 1.2s ease-in-out infinite" }} />
                <span style={{ fontFamily: ui, fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{voSecs.toFixed(1)}s</span>
              </div>
            )}
            {playhead !== null && (
              <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
                <div style={{ height: "100%", width: `${(playhead / Math.max(voSecs, 0.1)) * 100}%`, background: t.accent }} />
              </div>
            )}
          </div>

          {/* tools */}
          <div className="flex gap-2 mt-3 mb-5">
            {[["line", tr("Line")], ["angle", tr("Angle")], ["circle", tr("Circle")], ["free", tr("Free")]].map(([id, lbl]) => {
              const on = tool === id;
              return (<button key={id} onClick={() => { haptic(6); soft(); setTool(id); }} className="flex-1 active:opacity-60"
                              style={{ minHeight: 42, borderRadius: R.control, background: on ? t.ink : t.surface,
                                       border: `1px solid ${on ? t.ink : t.hair}`, transition: "background 220ms cubic-bezier(.22,1,.36,1)",
                                       fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{lbl}</button>);
            })}
            <button onClick={() => { haptic(8); setShapes(shapes.slice(0, -1)); }} disabled={!shapes.length}
                    className="active:opacity-60 disabled:opacity-25" style={{ width: 44, minHeight: 42, borderRadius: R.control, border: `1px solid ${t.hair}` }}
                    aria-label={tr("Undo")}><ChevronLeft size={15} color={t.sub} /></button>
          </div>

          {/* voice-over */}
          <Tile className="px-5 py-[18px] mb-4" accent={vo === "done" ? t.accent : null}>
            <div className="flex items-center gap-3.5">
              <button onClick={() => { haptic(12);
                        if (vo === "recording") { setVo("done"); hapticSuccess(); soft(); }
                        else { setVo("recording"); setVoSecs(0); setShapes([]); } }}
                      className="rounded-full flex items-center justify-center shrink-0 active:opacity-70"
                      style={{ width: 44, height: 44, background: vo === "recording" ? "#A63A2B" : t.accent, transition: "background 220ms" }}
                      aria-label={vo === "recording" ? tr("Stop") : tr("Record a voice-over")}>
                {vo === "recording" ? <Square size={15} color="#fff" fill="#fff" /> : <Mic size={18} color={t.onAccent} />}
              </button>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>
                  {vo === "recording" ? tr("Recording — draw as you talk") : vo === "done" ? tr("Voice-over saved") : tr("Record a voice-over")}
                </span>
                <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                  {vo === "done" ? `${voSecs.toFixed(1)}s · ${shapes.length} ${tr("marks")}` : tr("Your drawing plays back in time with it")}
                </span>
              </span>
              {vo === "done" && (
                <button onClick={() => { haptic(9); setPlayhead(0); }} className="rounded-full flex items-center justify-center active:opacity-70"
                        style={{ width: 38, height: 38, background: t.wash }} aria-label={tr("Play")}>
                  <Play size={15} color={t.ink} />
                </button>
              )}
            </div>
          </Tile>

          {/* captions */}
          {captions.length > 0 && (
            <Card className="mb-3">
              {captions.map((c, i) => (
                <Row key={i} label={c.text} sub={c.at} last={i === captions.length - 1}
                     right={<button onClick={() => { haptic(6); setCaptions(captions.filter((_, j) => j !== i)); }} aria-label={tr("Remove")}><X size={14} color={t.faint} /></button>} />
              ))}
            </Card>
          )}
          <div className="flex gap-2 mb-6">
            <div className="flex-1"><VoiceInput value={newCap} onChange={setNewCap} ph={tr("Add a caption")} /></div>
            <button onClick={() => { if (newCap.trim()) { haptic(10); setCaptions([...captions, { at: `0:${String(4 + captions.length * 3).padStart(2, "0")}`, text: newCap.trim() }]); setNewCap(""); } }}
                    disabled={!newCap.trim()} className="shrink-0 active:opacity-60 disabled:opacity-25"
                    style={{ width: 52, minHeight: 52, borderRadius: R.surface, background: t.accent }} aria-label={tr("Add")}>
              <Plus size={18} color={t.onAccent} strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Shown once, on a family account's first open. Different for the
   parent and the child, because they need to know different things. */
function FamilyGuide({ juvenile, name, onDone }) {
  const t = useT();
  const [i, setI] = useState(0);
  const steps = juvenile
    ? [{ h: `Hi ${(name || "").split(" ")[0]}`, b: "This is your own view of your coaching. Your lessons, your drills, and what you're working on." },
       { h: "Your drills", b: "Your coach sets these after a lesson. Tick them off as you do them — your coach sees your progress." },
       { h: "The family calendar", b: "Every lesson in your family, in one place. You can see what's coming, but a parent does the booking." },
       { h: "Messages stay with your parent", b: "Anything that needs saying to your coach goes through them. That's on purpose, to keep you safe." }]
    : [{ h: "Your family account", b: "One login for everyone. Switch between yourself and each child from your name at the top." },
       { h: "Each child, their own coach", b: "Add a child, pick their sport, then enter their coach's code. Their lessons stay separate from yours." },
       { h: "You see everything they do", b: "Their lessons, drills and coach messages are visible to you. Coaches are told the profile is parent-managed." },
       { h: "They can log in too", b: "Give them the family code and they can see their own lessons and drills on their own device — without messaging." }];

  const last = i === steps.length - 1;
  return (
    <div className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="flex gap-1.5 px-7 pt-6">
        {steps.map((_, k) => (<span key={k} className="flex-1 rounded-full" style={{ height: 2, background: k <= i ? t.accent : t.hair, transition: "background 260ms" }} />))}
      </div>
      <div className="flex-1 flex flex-col justify-center px-8">
        <h1 style={{ fontFamily: display, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.033em", color: t.ink }}>{steps[i].h}</h1>
        <p className="mt-5" style={{ fontFamily: ui, fontSize: 16, lineHeight: 1.6, color: t.sub }}>{steps[i].b}</p>
      </div>
      <div className="px-7 pb-8">
        <Button tone="ink" onClick={() => { haptic(10); if (last) { hapticSuccess(); chime(); onDone(); } else { soft(); setI(i + 1); } }}>
          {last ? "Begin" : "Next"}
        </Button>
        {!last && <button onClick={onDone} className="w-full mt-3 py-2.5 active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{tr("Skip")}</button>}
      </div>
    </div>
  );
}


/* A PLAYER'S RECORD, AS A COACH ACTUALLY KEEPS IT

   Two things a coach genuinely has: the lessons they logged, and
   whether the person turned up. Plus a goal, if they set one.

   The serve-percentage charts that used to sit here were invented
   numbers — no coach is courtside recording first-serve percentage into
   an app, so a graph of it is a graph of nothing. Removed rather than
   left as decoration. */
function PlayerHistory({ name, cfg, attendance, goals, onAddGoal, onToggleGoal, pop, push, say, lessons }) {
  const t = useT();
  const [tab, setTab] = useState("Lessons");
  const [newGoal, setNewGoal] = useState(""); const [byWhen, setByWhen] = useState("");

  /* Only what was actually recorded. No fallback figures — an empty
     register reads as empty, not as a perfect record. */
  const att = attendance[name] || null;
  const total = att ? att.showed + att.noShow + att.cancelled : 0;
  const rate = total ? Math.round((att.showed / total) * 100) : null;
  const myGoals = goals[name] || [];
  const list = lessons || hadLessons(cfg);

  const Stat = ({ n, label, tone }) => (
    <span className="flex-1 text-center">
      <span className="block" style={{ ...TYPE.figure, fontSize: 26, color: tone || t.ink }}>{n}</span>
      <span className="block mt-1" style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{label}</span>
    </span>
  );

  return (
    <SwipeBack onBack={pop}>
      <Screen title={name} onBack={pop}
              meta={list.length ? `${list.length} ${list.length === 1 ? tr("lesson") : tr("lessons")}` : tr("Nothing logged yet")}>
        <div className="px-6 mb-5">
          <Segmented options={[tr("Lessons"), tr("Attendance"), tr("Goals")]} value={tab} onChange={setTab} />
        </div>

        {tab === tr("Lessons") && (
          <div className="px-6 pb-2">
            {list.length === 0 ? (
              <p className="py-12 text-center" style={{ ...TYPE.body, color: t.faint }}>
                {tr("Lessons you log will appear here.")}
              </p>
            ) : (
              <Card>
                {list.map((l, i) => (
                  <Row key={l.id ?? i} label={l.focus}
                       sub={`${l.d} ${l.m} · ${l.type}${l.videos ? ` · ${l.videos} ${l.videos === 1 ? tr("clip") : tr("clips")}` : ""}`}
                       chevron last={i === list.length - 1}
                       icon={<span className="rounded-xl flex items-center justify-center shrink-0"
                                   style={{ width: 38, height: 38, background: t.wash }}>
                               <span style={{ fontFamily: display, fontSize: 15, color: t.ink }}>{l.d}</span></span>}
                       onToggle={() => push(`clesson:${name}:${l.id}`)} />
                ))}
              </Card>
            )}
          </div>
        )}

        {tab === tr("Attendance") && (
          <div className="px-6 pb-2">
            {!att ? (
              <p className="py-12 text-center" style={{ ...TYPE.body, color: t.faint }}>
                {tr("No register taken yet.")}
              </p>
            ) : (
              <>
                <Card className="p-6 mb-4">
                  <div className="flex items-center">
                    <Stat n={att.showed} label={tr("Attended")} tone={STEADY} />
                    <Stat n={att.late || 0} label={tr("Late")} tone={att.late ? CAUTION : null} />
                    <Stat n={att.noShow} label={tr("Missed")} tone={att.noShow ? DANGER : null} />
                  </div>
                  {rate != null && (
                    <p className="mt-5 pt-4 text-center"
                       style={{ ...TYPE.small, color: t.sub, borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                      {rate}% {tr("of sessions attended")}
                    </p>
                  )}
                </Card>
                {att.cancelled > 0 && (
                  <p style={{ ...TYPE.caption, color: t.faint }}>
                    {att.cancelled} {tr("cancelled in advance — not counted against them.")}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === tr("Goals") && (
          <div className="px-6 pb-2">
            {myGoals.length === 0 && (
              <p className="py-8 text-center" style={{ ...TYPE.body, color: t.faint }}>
                {tr("No goal set yet.")}
              </p>
            )}
            {myGoals.length > 0 && (
              <Card className="mb-4">
                {myGoals.map((g, i) => (
                  <button key={i} onClick={() => { g.done ? haptic(7) : hapticSuccess(); onToggleGoal(name, i); }}
                          className="w-full flex items-center gap-3.5 px-5 py-4 text-left active:opacity-60"
                          style={{ borderBottom: i === myGoals.length - 1 ? "none" : `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                    <span className="rounded-full flex items-center justify-center shrink-0"
                          style={{ width: 22, height: 22, background: g.done ? STEADY : "transparent",
                                   border: g.done ? "none" : `1.5px solid ${HAIR(t.ink, 0.28)}` }}>
                      {g.done && <Check size={12} color="#fff" strokeWidth={2.6} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ ...TYPE.body, color: g.done ? t.faint : t.ink,
                                     textDecoration: g.done ? "line-through" : "none" }}>{g.text}</span>
                      {g.by && <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{tr("By")} {g.by}</span>}
                    </span>
                  </button>
                ))}
              </Card>
            )}
            <Card className="p-5">
              {!!(cfg.goals || []).length && !newGoal && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {cfg.goals.slice(0, 4).map((g, i) => (
                    <button key={g} onClick={() => { haptic(6); soft(); setNewGoal(g); }} className="px-3.5 active:opacity-60"
                            style={{ minHeight: 40, borderRadius: R.pill, background: t.wash, fontFamily: ui, fontSize: 12.5, color: t.sub,
                                     animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>{g}</button>
                  ))}
                </div>
              )}
              <VoiceInput value={newGoal} onChange={setNewGoal} ph={tr("Something to work towards")} />
              <div className="mt-3">
                <VoiceInput value={byWhen} onChange={setByWhen} ph={tr("By when (optional)")} />
              </div>
              <button onClick={() => { if (!newGoal.trim()) return; hapticCommit(); onAddGoal(name, newGoal.trim(), byWhen.trim()); setNewGoal(""); setByWhen(""); say && say(tr("Goal set")); }}
                      className="w-full mt-4 active:opacity-80"
                      style={{ minHeight: 48, borderRadius: R.control, background: t.ink, color: "#fff", ...TYPE.subhead, fontSize: 15 }}>
                {tr("Set goal")}
              </button>
            </Card>
          </div>
        )}
        <div style={{ height: 26 }} />
      </Screen>
    </SwipeBack>
  );
}


/* You can't invite a bare name — an invite has to reach a phone. So
   this collects a number alongside each person rather than pretending
   a list of names is enough. */
/* Sending a link beats collecting numbers. It goes wherever the coach
   already talks to people, and the person taps it on their own phone. */
function ImportRoster({ existingNames, onSend, close, say, noun, nouns, code }) {
  const t = useT();
  const joinCode = code || FAMILY_CODE;
  const link = `nosca.app/j/${joinCode}`;
  const routes = [
    { id: "wa", label: "WhatsApp", Icon: MessageCircle },
    { id: "sms", label: tr("Messages"), Icon: Send },
    { id: "mail", label: tr("Email"), Icon: Mail },
    { id: "copy", label: tr("Copy link"), Icon: Paperclip },
  ];
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{tr("Invite")} {nouns}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}></p>

      <div className="px-5 py-4 mb-5 flex items-center gap-3" style={{ borderRadius: R.surface, background: t.wash }}>
        <span className="flex-1 truncate" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{link}</span>
        <span className="rounded-full px-2.5 py-1" style={{ background: t.surface, fontFamily: ui, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", color: t.sub }}>
          {joinCode}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {routes.map((r, i) => (
          <button key={r.id} onClick={() => { hapticSuccess(); soft(); say(`${tr("Shared via")} ${r.label}`); if (r.id === "copy") close(); }}
                  className="flex flex-col items-center justify-center gap-2.5 active:opacity-60"
                  style={{ minHeight: 92, borderRadius: R.control, background: t.surface, border: `0.5px solid ${HAIR(t.ink, 0.14)}`,
                           animation: `liftIn 400ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }}>
            <r.Icon size={20} color={t.accent} strokeWidth={1.6} />
            <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink }}>{r.label}</span>
          </button>
        ))}
      </div>

      <button onClick={() => { haptic(8); say(tr("Opens your phone's Contacts")); }}
              className="w-full flex items-center gap-3.5 px-5 active:opacity-60"
              style={{ minHeight: 56, borderRadius: R.surface, border: `1px solid ${t.hair}` }}>
        <Users size={17} color={t.sub} strokeWidth={1.6} />
        <span className="flex-1 text-left" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Pick from Contacts")}</span>
        <ChevronRight size={15} color={t.faint} />
      </button>
    </>
  );
}

/* Multi-stage group creator: name → members → weekly schedule.
   Submitting spins up recurring bookings and a group chat thread. */
function GroupCreate({ cfg, coachSport, onCreate, close, livePlayers }) {
  const t = useT();
  const [name, setName] = useState("");
  const [members, setMembers] = useState([]);
  const [day, setDay] = useState(5);
  const [time, setTime] = useState("8:00 am");
  const [weeks, setWeeks] = useState(8);
  const [showAll, setShowAll] = useState(false);
  const tog = (p) => { haptic(5); setMembers(members.includes(p) ? members.filter((x) => x !== p) : [...members, p]); };
  const ready = name.trim() && members.length > 0;
  const POOL = livePlayers ?? PLAYERS;
  const shown = showAll ? POOL : POOL.slice(0, 4);

  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>{tr("New group")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("A recurring slot and a shared chat, in one go.")}</p>

      <div className="mb-5"><VoiceInput value={name} onChange={setName} ph={tr("e.g. Saturday clinic")} autoFocus /></div>

      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 500, color: t.sub }}>{tr("Members")}</span>
        <span style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{members.length} picked</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {shown.map((p) => {
          const on = members.includes(p);
          return (
            <button key={p} onClick={() => tog(p)} className="rounded-full pl-1.5 pr-3.5 flex items-center gap-2 active:opacity-60"
                    style={{ minHeight: 42, background: on ? t.ink : t.surface, border: `1px solid ${on ? t.ink : t.hair}` }}>
              <Avatar name={p} size={30} />
              <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{p.split(" ")[0]}</span>
              {on && <Check size={13} color={STEADY} strokeWidth={2.1} />}
            </button>
          );
        })}
      </div>
      {!showAll && POOL.length > 4 && (
        <button onClick={() => { haptic(8); soft(); setShowAll(true); }} className="mb-4 px-1 active:opacity-50" style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.accent }}>
          Show {POOL.length - 4} more
        </button>
      )}
      {(showAll || POOL.length <= 4) && <div className="mb-4" />}

      <div className="mb-2.5 px-1" style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 500, color: t.sub }}>{tr("Repeats")}</div>
      <div className="flex gap-1.5 mb-3">{DAY_NAMES.map((n, i) => {
        const on = day === i;
        return (<button key={n} onClick={() => { haptic(6); setDay(i); }} className="flex-1 rounded-xl active:opacity-60"
                        style={{ minHeight: 44, background: on ? t.accent : t.wash, fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{n.slice(0,2)}</button>);
      })}</div>
      <div className="flex flex-wrap gap-2 mb-4">{ALL_TIMES.map((tt) => {
        const on = time === tt;
        return (<button key={tt} onClick={() => { haptic(6); setTime(tt); }} className="rounded-full px-3.5 active:opacity-60"
                        style={{ minHeight: 36, background: on ? t.accent : t.wash, fontFamily: ui, fontSize: 13, fontWeight: 600, color: on ? "#fff" : t.sub }}>{tt}</button>);
      })}</div>

      <div className="flex items-center justify-between mb-5 px-1">
        <span style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>For {weeks} weeks</span>
        <div className="flex items-center gap-3">
          <button onClick={() => { haptic(6); setWeeks(Math.max(1, weeks - 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("Fewer weeks")}><Minus size={15} color={t.ink} /></button>
          <span style={{ fontFamily: display, fontSize: 21, color: t.ink, minWidth: 26, textAlign: "center" }}>{weeks}</span>
          <button onClick={() => { haptic(6); setWeeks(Math.min(12, weeks + 1)); }} className="rounded-full flex items-center justify-center active:opacity-50" style={{ width: 34, height: 34, background: t.wash }} aria-label={tr("More weeks")}><Plus size={15} color={t.ink} /></button>
        </div>
      </div>

      <Button disabled={!ready} onClick={() => { onCreate({ name: name.trim(), members, day, time, weeks, sport: coachSport }); close(); }}>
        {ready ? `Create · ${weeks} ${DAY_NAMES[day]}s from now` : "Name it and pick members"}
      </Button>
    </>
  );
}

/* ==================================================================
   PAYMENTS / PRICING (unchanged in substance)
================================================================== */
/* Nosca never touches lesson fees — what a coach charges and how they
   collect it stays their own business. The only money here is the app. */
function Subscription({ pop, say, plan }) {
  const t = useT();
  const current = plan || PLANS[0];
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Subscription")} onBack={pop} meta="">
        <div className="px-6">
          <div className="pb-6 mb-6" style={{ borderBottom: `1px solid ${t.hair}` }}>
            <span className="uppercase block mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Current plan")}</span>
            <div className="flex items-baseline justify-between">
              <span style={{ fontFamily: display, fontSize: 29, letterSpacing: "-0.03em", color: t.ink }}>{BRAND} {current.name}</span>
              <span style={{ fontFamily: display, fontSize: 22, color: t.ink }}>€{current.price}<span style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>/mo</span></span>
            </div>
            <div className="mt-2" style={{ ...TYPE.small, color: t.faint }}>{current.blurb} · renews 21 August</div>
          </div>

          <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Change plan")}</div>
          <div style={{ borderTop: `1px solid ${t.hair}` }}>
            {PLANS.map((pl) => {
              const on = pl.id === current.id;
              return (
                <button key={pl.id} onClick={() => { haptic(8); say(on ? "That is your current plan" : `Switching to ${pl.name}`); }}
                        className="w-full flex items-center gap-3 text-left active:opacity-50"
                        style={{ minHeight: 66, borderBottom: `1px solid ${t.hair}` }}>
                  <span className="flex-1">
                    <span className="block" style={{ ...TYPE.body, color: t.ink }}>{pl.name}</span>
                    <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{pl.blurb}</span>
                  </span>
                  <span style={{ fontFamily: ui, fontSize: 13.5, color: on ? t.accent : t.sub }}>{on ? "Current" : `€${pl.price}`}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8" style={{ borderTop: `1px solid ${t.hair}` }}>
            <button onClick={() => say("Opens the App Store")} className="w-full flex items-center text-left active:opacity-50"
                    style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
              <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{tr("Manage in the App Store")}</span><ExternalLink size={15} color={t.faint} />
            </button>
            <button onClick={() => say("Nothing to restore")} className="w-full flex items-center text-left active:opacity-50"
                    style={{ minHeight: 60, borderBottom: `1px solid ${t.hair}` }}>
              <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{tr("Restore purchases")}</span><ChevronRight size={15} color={t.faint} />
            </button>
          </div>

          <p className="mt-6 pb-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.6, color: t.faint }}>
            Lesson fees are between you and the people you coach.
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* ==================================================================
   PLAYER · practice
================================================================== */
function PlayerPractice({ conn, items, toggle, right, say }) {
  const t = useT();
  const done = items.filter((x) => x.done).length;
  const pct = items.length ? (done / items.length) * 100 : 0;
  const allDone = items.length > 0 && done === items.length;
  useEffect(() => { if (allDone) { hapticCommit(); swell(); } }, [allDone]);
  const who = conn?.coach?.split(" ")[0] || "your coach";
  return (
    <Screen title={tr("Practice")} meta={items.length ? `Week of 20 July · set by ${who}` : ""} right={right}>
      {items.length === 0 ? (
        <div className="px-6"><Card className="p-8 text-center">
          <p style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{tr("Nothing set yet")}</p>
          <p className="mt-2" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.55, color: t.sub }}>{who} will send drills after your next lesson.</p>
        </Card></div>
      ) : (
        <>
          <div className="px-6">
            <Card className="p-5 mb-6">
              <div className="flex items-baseline justify-between mb-4">
                <span style={{ ...TYPE.figure, fontSize: 24, color: t.ink }}>
                  {done}<span style={{ ...TYPE.small, color: t.faint }}> {tr("of")} {items.length}</span>
                </span>
                <span style={{ ...TYPE.small, color: t.faint }}>
                  {items.reduce((a, x) => a + (x.mins || 10), 0)} {tr("min")}
                  {done === items.length && <span style={{ color: STEADY }}> · {tr("All clear")}</span>}
                </span>
              </div>

              {/* THE SESSION AS BLOCKS
                  Width is duration, height is effort. Done blocks fill
                  green; the one you're on breathes; the rest wait in
                  outline. The shape of the session is the information. */}
              <div className="flex items-end gap-1" style={{ height: 52 }}>
                {items.map((x, i) => {
                  const mins = x.mins || 10;
                  const effort = x.effort || (i % 3 === 1 ? 3 : i % 3 === 2 ? 2 : 1);   // 1 easy · 2 · 3 hard
                  const current = !x.done && items.slice(0, i).every((y) => y.done);
                  return (
                    <button key={x.id || i} onClick={() => { haptic(7); soft(); toggle(x.id); }}
                            className="active:opacity-70"
                            style={{ flex: mins, height: `${34 + effort * 6}px`, borderRadius: 5,
                                     background: x.done ? STEADY : current ? `${t.accent}22` : "transparent",
                                     border: x.done ? "none" : `1.5px solid ${current ? t.accent : HAIR(t.ink, 0.28)}`,
                                     transformOrigin: "bottom",
                                     animation: current ? "breathe 2.8s ease-in-out infinite"
                                       : `barGrow 520ms cubic-bezier(.22,1,.36,1) ${i * 60}ms both`,
                                     transition: "background 220ms, border-color 220ms" }}
                            aria-label={x.t} />
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{tr("Start")}</span>
                <span style={{ ...TYPE.eyebrow, fontSize: 8.5, color: t.faint }}>{tr("Finish")}</span>
              </div>
            </Card>
          </div>
          <Eyebrow>{tr("Your drills")}</Eyebrow>
          <div className="px-6 pb-2"><Card>
            {items.map((x, i) => (
              <div key={x.id}>
              <button onClick={() => { if (!x.done) { hapticSuccess(); tone(760, 0.1, 0.045); tone(1010, 0.14, 0.04, 0.07); } else haptic(6); toggle(x.id); }}
                      className="w-full flex items-start gap-3.5 px-5 py-4 text-left active:opacity-50"
                      style={{ borderBottom: i === items.length - 1 ? "none" : `1px solid ${t.hair}`,
                               animation: `rowIn 420ms cubic-bezier(.22,1,.36,1) ${i * 55}ms both` }}>
                <span className="flex items-center justify-center shrink-0"
                      style={{ width: 24, height: 24, borderRadius: R.control, marginTop: 1, border: `1.5px solid ${x.done ? t.accent : t.hair}`,
                               background: x.done ? STEADY : "transparent", transition: "background 160ms" }}>
                  {x.done && <Check size={14} color="#fff" strokeWidth={2.1} style={{ animation: "tickIn 380ms cubic-bezier(.22,1,.36,1)" }} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ fontFamily: ui, fontSize: 15.5, fontWeight: 600, color: x.done ? STEADY : t.ink, textDecoration: x.done ? "line-through" : "none" }}>{x.t}</span>
                  <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.45, color: t.faint }}>{x.d}</span>
                </span>
              </button>
              {DRILL_SECONDS(x.d) && !x.done && (
                <div className="px-5 pb-4" style={{ marginTop: -4 }}>
                  <DrillTimer seconds={DRILL_SECONDS(x.d)} onDone={() => toggle(x.id)} />
                </div>
              )}
              </div>
            ))}
          </Card>
          <button onClick={() => { haptic(8); tone(660, 0.12, 0.04); say && say(`${who} will see that`); }}
                  className="w-full mt-4 py-3.5 active:opacity-50"
                  style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.accent }}>
            {tr("Leave optional feedback")}
          </button>
          </div>
        </>
      )}
    </Screen>
  );
}

/* ==================================================================
   COACH · practice + drill library + suggestion-aware assign
================================================================== */
function CoachPractice({ items, sheet, push, right }) {
  const t = useT(); const marcusDone = items.filter((x) => x.done).length;
  const rows = ROSTER.map((r) => r.name === "Marcus Tran" ? { name: r.name, done: marcusDone, total: items.length } : { name: r.name, done: r.pr ? r.pr[0] : 0, total: r.pr ? r.pr[1] : 0 });
  return (
    <Screen title={tr("Practice")} meta={tr("What you've set, and who's doing it")} right={right}>
      <div className="px-6 mb-6">
        <button onClick={() => { haptic(10); sheet(); }} className="w-full p-5 flex items-center gap-4 text-left active:opacity-70" style={{ background: t.surface, borderRadius: R.surface, border: `0.5px solid ${HAIR(t.ink, 0.14)}`, position: "relative", zIndex: 1, borderLeft: `2px solid ${t.accent}` }}>
          <ListChecks size={19} color={t.accent} strokeWidth={1.6} />
          <span className="flex-1"><span className="block" style={{ fontFamily: display, fontSize: 20, color: t.ink }}>{tr("Set drills")}</span><span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{tr("Choose who, and what they practise")}</span></span>
          <ChevronRight size={17} color={t.faint} />
        </button>
      </div>
      <div className="px-6 mb-6"><Card><Row label={tr("Drill library")} sub={tr("Your reusable drills")} chevron last icon={<Library size={17} color={t.sub} strokeWidth={1.6} />} onToggle={() => push("library")} /></Card></div>
      <Eyebrow>{tr("This week")}</Eyebrow>
      <div className="px-6 pb-2"><Card>{rows.map((r, i) => { const none = r.total === 0; return (
        <Row key={r.name} label={r.name} sub={none ? "Nothing set" : `${r.done} of ${r.total} done`} icon={<Avatar name={r.name} size={38} />}
             right={none ? <span style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>—</span> : (<span className="flex gap-1 shrink-0">{Array.from({ length: r.total }).map((_, k) => (<span key={k} className="rounded-full" style={{ width: 7, height: 7, background: k < r.done ? t.accent : t.hair }} />))}</span>)}
             last={i === rows.length - 1} onToggle={() => sheet(r.name)} />
      ); })}</Card></div>
    </Screen>
  );
}
function DrillLibrary({ cfg, library, addDrill, removeDrill, pop, assign, say }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ t: "", d: "", focus: cfg.focus[0].id });
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(null);
  const [sort, setSort] = useState("Most used");

  const chips = ["All", ...cfg.focus.map((x) => x.label)];
  let shown = filter === "All" ? library : library.filter((d) => cfg.focus.find((f2) => f2.id === d.focus)?.label === filter);
  shown = [...shown].sort((a, b) => sort === "Most used" ? (b.uses || 0) - (a.uses || 0) : a.t.localeCompare(b.t));

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Drills")} onBack={pop} meta={`${library.length} in your library`}
              right={<TextBtn onClick={() => { haptic(8); setAdding(!adding); }}>{adding ? "Cancel" : "New"}</TextBtn>}>
        {adding && (
          <div className="px-6 mb-5"><Card className="p-5">
            <VoiceInput value={f.t} onChange={(v) => setF({ ...f, t: v })} ph={tr("Drill name")} autoFocus />
            <div className="mt-2"><VoiceArea value={f.d} onChange={(v) => setF({ ...f, d: v })} rows={2} ph={tr("How to do it")} /></div>
            <div className="flex flex-wrap gap-2 mt-4">{cfg.focus.map((f2) => {
              const on = f.focus === f2.id;
              return (<button key={f2.id} onClick={() => { haptic(5); setF({ ...f, focus: f2.id }); }} className="px-3 active:opacity-60"
                              style={{ minHeight: 34, borderRadius: R.pill, background: on ? STEADY : t.wash, fontFamily: ui, fontSize: 12, fontWeight: 600, color: on ? t.onAccent : t.sub }}>{f2.label}</button>);
            })}</div>
            <div className="mt-5"><Button disabled={!f.t.trim()} onClick={() => { addDrill({ t: f.t.trim(), d: f.d.trim() || "No notes", focus: f.focus, uses: 0 }); setF({ t: "", d: "", focus: cfg.focus[0].id }); setAdding(false); hapticSuccess(); chime(); say("Saved"); }}>{tr("Save to library")}</Button></div>
          </Card></div>
        )}

        <div className="flex gap-2 overflow-x-auto px-6 pb-4" style={{ scrollbarWidth: "none" }}>{chips.map((c) => {
          const on = filter === c;
          return (<button key={c} onClick={() => { haptic(5); setFilter(c); }} className="px-4 shrink-0 active:opacity-60"
                          style={{ minHeight: 34, borderRadius: R.pill, background: on ? t.ink : "transparent", border: `1px solid ${on ? t.ink : t.hair}`,
                                   fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{c}</button>);
        })}</div>

        <div className="px-6 mb-4"><Segmented options={["Most used", "A–Z"]} value={sort} onChange={setSort} /></div>

        <div className="px-6 pb-2">
          {shown.length === 0 ? (
            <Card className="p-8 text-center">
              <p style={{ fontFamily: display, fontSize: 18, color: t.ink }}>{tr("Nothing here")}</p>
            </Card>
          ) : (
            <Card>
              {shown.map((d, i) => {
                const isOpen = open === d.t;
                const focusLabel = cfg.focus.find((f2) => f2.id === d.focus)?.label;
                return (
                  <div key={d.t + i} style={{ borderBottom: i === shown.length - 1 ? "none" : `1px solid ${t.hair}` }}>
                    <button onClick={() => { haptic(6); setOpen(isOpen ? null : d.t); }} className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-50" style={{ minHeight: 64 }}>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{d.t}</span>
                        <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                          {focusLabel}{d.uses ? ` · used ${d.uses}×` : " · not used yet"}
                        </span>
                      </span>
                      <ChevronDown size={16} color={t.faint} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4" style={{ background: t.wash }}>
                        <p className="pt-3 pb-4" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.6, color: t.sub }}>{d.d}</p>
                        <div className="flex gap-2">
                          <button onClick={() => { hapticCommit(); assign(null, d.focus); }} className="flex-1 active:opacity-70"
                                  style={{ minHeight: 44, borderRadius: R.control, background: t.accent, fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.onAccent }}>{tr("Assign this")}</button>
                          <button onClick={() => { haptic(8); removeDrill(d.t); say("Removed"); setOpen(null); }} className="px-4 active:opacity-60"
                                  style={{ minHeight: 44, borderRadius: R.control, border: `1px solid ${t.hair}` }} aria-label={tr("Delete")}>
                            <Trash2 size={15} color={DANGER} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}

/* Suggests drills from the library matching the lesson's focus first,
   with a "write your own" option always available underneath. */
function AssignBody({ cfg, library, preset, focusHint, onAssign, onSaveDrill, close, livePlayers }) {
  const t = useT();
  const [who, setWho] = useState(preset || null);
  const [stage, setStage] = useState(preset ? "drills" : "who");
  const [picked, setPicked] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [custom, setCustom] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  /* focusHint is now a list of focus ids from the lesson just logged. */
  const hints = Array.isArray(focusHint) ? focusHint : focusHint ? [focusHint] : [];
  const labels = cfg.focus.filter((f) => hints.includes(f.id)).map((f) => f.label);

  /* Recommended = drills already used for these focus areas, most-used
     first. That's what makes the list get smarter with each lesson. */
  const recommended = hints.length
    ? library.filter((d) => hints.includes(d.focus)).sort((a, b) => (b.uses || 0) - (a.uses || 0))
    : [];
  const rest = library.filter((d) => !recommended.includes(d));
  const tog = (v) => setPicked(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);

  if (stage === "who") return (
    <>
      <h2 className="mb-5" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>{tr("Who's playing")}</h2>
      <Card>{(livePlayers ?? PLAYERS).map((p, i) => (<Row key={p} label={p} chevron last={i === (livePlayers ?? PLAYERS).length - 1} icon={<Avatar name={p} size={38} />} onToggle={() => { setWho(p); setStage("drills"); }} />))}</Card>
    </>
  );

  const total = picked.length + (custom.trim() ? 1 : 0);
  const DrillRow = ({ dr, i, arr }) => (
    <Row key={dr.t} label={dr.t} sub={dr.uses ? `${dr.d} · used ${dr.uses}×` : dr.d}
         checked={picked.includes(dr.t)} last={i === arr.length - 1} onToggle={() => tog(dr.t)} />
  );

  return (
    <>
      <div className="flex items-center gap-1 mb-1 -ml-2">{!preset && (<button onClick={() => setStage("who")} className="p-2 active:opacity-40" aria-label={tr("Back")}><ChevronLeft size={22} color={t.accent} /></button>)}
        <h2 style={{ fontFamily: display, fontSize: 23, color: t.ink }}>Drills for {who?.split(" ")[0]}</h2></div>
      {labels.length > 0 && <p className="mb-4 px-1" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>From what you just covered — {labels.join(" and ")}.</p>}

      {recommended.length > 0 && (<>
        <Eyebrow>{tr("Recommended")}</Eyebrow>
        <Card className="mb-4">{recommended.map((dr, i) => <DrillRow key={dr.t} dr={dr} i={i} arr={recommended} />)}</Card>
      </>)}

      {rest.length > 0 && (!showAll && recommended.length > 0 ? (
        <button onClick={() => { haptic(8); soft(); setShowAll(true); }} className="w-full text-left mb-4 active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.accent }}>Show {rest.length} more</button>
      ) : (<>
        <Eyebrow>{recommended.length > 0 ? "Everything else" : "Your drills"}</Eyebrow>
        <Card className="mb-4">{rest.map((dr, i) => <DrillRow key={dr.t} dr={dr} i={i} arr={rest} />)}</Card>
      </>))}

      <Eyebrow>{tr("Or write a new one")}</Eyebrow>
      <div className="mb-2"><VoiceInput value={custom} onChange={setCustom} ph={tr("Drill name")} /></div>
      {custom.trim() && (
        <div className="mb-2"><VoiceInput value={customDesc} onChange={setCustomDesc} ph={tr("How to do it")} /></div>
      )}

      <Button disabled={total === 0} onClick={() => {
        const chosen = library.filter((dr) => picked.includes(dr.t));
        if (custom.trim()) {
          const fresh = { t: custom.trim(), d: customDesc.trim() || "No notes", focus: hints[0] || cfg.focus[0].id, uses: 0 };
          onSaveDrill && onSaveDrill(fresh);   // auto-save, no extra step
          chosen.push(fresh);
        }
        onAssign(who, chosen); close();
      }}>{total ? `Set ${total} drill${total > 1 ? "s" : ""}` : "Pick or write a drill"}</Button>
    </>
  );
}

/* ==================================================================
   AVAILABILITY (per sport)
================================================================== */
function Availability({ avail, setAvail, slots, setSlots, duration, setDuration, pop, say }) {
  const t = useT(); const [openDay, setOpenDay] = useState(4); const [draft, setDraft] = useState(avail);
  const [editSlots, setEditSlots] = useState(false); const [newSlot, setNewSlot] = useState("");
  const togTime = (day, time) => { haptic(5); const cur = draft[day] || []; const next = cur.includes(time) ? cur.filter((x) => x !== time) : [...cur, time]; setDraft({ ...draft, [day]: slots.filter((x) => next.includes(x)) }); };
  const togDay = (day, on) => { haptic(8); setDraft({ ...draft, [day]: on ? ["9:00 am", "10:00 am", "11:00 am"] : [] }); };
  const copyDown = (day) => { haptic(12); const src = draft[day] || []; const next = { ...draft }; [1, 2, 3, 4].forEach((d) => { next[d] = [...src]; }); setDraft(next); say("Copied to weekdays"); };
  const total = Object.values(draft).reduce((n, x) => n + x.length, 0);
  const TIMES = slots;
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Availability")} onBack={pop} meta={`${total} slots a week`} right={<TextBtn onClick={() => { setAvail(draft); say("Availability saved"); pop(); }}>{tr("Save")}</TextBtn>}>
        <div className="px-6 mb-5">
          <button onClick={() => { haptic(6); setEditSlots(!editSlots); }} className="w-full rounded-2xl flex items-center gap-3.5 px-5 active:opacity-60" style={{ minHeight: 58, border: `1px solid ${t.hair}` }}>
            <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: t.wash }}><Clock size={15} color={t.sub} /></span>
            <span className="flex-1 text-left"><span className="block" style={{ fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.ink }}>{tr("Slots and lesson length")}</span>
              <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{slots.length} times · {duration} min default</span></span>
            <ChevronDown size={16} color={t.faint} style={{ transform: editSlots ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
          </button>
          {editSlots && (
            <Card className="p-5 mt-3">
              <div className="uppercase mb-2.5" style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.2em", fontWeight: 600, color: t.faint }}>{tr("Lesson length")}</div>
              <div className="flex gap-2 mb-5">
                {DURATIONS.map((d) => {
                  const on = duration === d;
                  return (<button key={d} onClick={() => { haptic(6); setDuration(d); }} className="flex-1 active:opacity-60"
                                  style={{ minHeight: 44, borderRadius: R.control, background: on ? t.accent : t.wash,
                                           fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{d}m</button>);
                })}
              </div>
              <div className="uppercase mb-2.5" style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.2em", fontWeight: 600, color: t.faint }}>{tr("Start times")}</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {slots.map((sl) => (
                  <span key={sl} className="rounded-full px-3 flex items-center gap-2" style={{ minHeight: 36, background: t.wash }}>
                    <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.ink }}>{span(sl, duration)}</span>
                    <button onClick={() => { haptic(6); setSlots(slots.filter((x) => x !== sl)); }} aria-label={`Remove ${sl}`}><X size={12} color={t.faint} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="e.g. 6:30 pm" className="flex-1 outline-none rounded-2xl px-4"
                       style={{ minHeight: 48, background: t.wash, fontFamily: ui, fontSize: 15, color: t.ink }} />
                <button onClick={() => { if (newSlot.trim()) { haptic(10); setSlots([...slots, newSlot.trim()]); setNewSlot(""); } }}
                        disabled={!newSlot.trim()} className="rounded-2xl px-5 active:opacity-60 disabled:opacity-25"
                        style={{ minHeight: 48, background: t.accent, fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.onAccent }}>{tr("Add")}</button>
              </div>
            </Card>
          )}
        </div>
        <div className="px-6 pb-2"><Card>{DAY_NAMES.map((name, day) => { const times = draft[day] || []; const on = times.length > 0; const expanded = openDay === day; return (
          <div key={name} style={{ borderBottom: day === 6 ? "none" : `1px solid ${t.hair}` }}>
            <div className="flex items-center gap-3 px-5" style={{ minHeight: 62 }}>
              <button onClick={() => { haptic(6); setOpenDay(expanded ? -1 : day); }} className="flex-1 text-left active:opacity-50">
                <span className="block" style={{ fontFamily: ui, fontSize: 15.5, fontWeight: 600, color: t.ink }}>{name}</span>
                <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{on ? `${times[0]}${times.length > 1 ? ` + ${times.length - 1} more` : ""}` : "Not coaching"}</span>
              </button>
              <Toggle on={on} onChange={(v) => { togDay(day, v); setOpenDay(v ? day : -1); }} />
            </div>
            {expanded && on && (<div className="px-5 pb-4" style={{ background: t.wash }}>
              <div className="flex flex-wrap gap-2 pt-3">{TIMES.map((time) => { const sel = times.includes(time); return (
                <button key={time} onClick={() => togTime(day, time)} className="rounded-full px-3.5 active:opacity-60" style={{ minHeight: 36, background: sel ? t.accent : t.surface, border: `1px solid ${sel ? t.accent : t.hair}`, fontFamily: ui, fontSize: 13, fontWeight: 600, color: sel ? t.onAccent : t.sub }}>{time}</button>
              ); })}</div>
              {day <= 4 && (<button onClick={() => copyDown(day)} className="mt-3 active:opacity-50" style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.accent }}>{tr("Copy to all weekdays")}</button>)}
            </div>)}
          </div>
        ); })}</Card></div>
      </Screen>
    </SwipeBack>
  );
}

/* ==================================================================
   CALENDAR — group colour tags, Booked/Open separated, group creation
================================================================== */
/* Calendly's lesson: pick a date, then read a clean column of times.
   The grid stays quiet — only availability is signalled — and the times
   carry the weight, one per line, with the finish time always shown. */
function CalendarScreen({ role, conn, avail, blocked, setBlocked, bookings, seedBooked, onBook, onCancel,
                          say, push, right, family, duration, recurrence, setRecurrence, aiPick, readOnly, seriesList, onEditSeries, onWeather, prefs, setPrefs, onLogFor, onWeatherDay, onCancelWithReason, slotKinds, onPeek, onEditDay, onBookInto, onRecurring, juvenile }) {
  const t = useT();
  const [mi, setMi] = useState(1);
  const [sel, setSel] = useState(TODAY.d);
  const [pick, setPick] = useState(null);
  const [famFilter, setFamFilter] = useState("Everyone");
  const [view, setView] = useState(tr("List"));
  const mo = MONTHS[mi];
  const mineOn = (m, d) => bookings.find((b) => b.m === m && b.d === d);
  const open = openTimes(mo.idx, sel, avail, blocked, bookings, seedBooked);
  const booked = seedBooked[key(mo.idx, sel)] || [];
  const myDay = mineOn(mo.idx, sel);
  const past = isPast(mo.idx, sel);
  const dayHours = avail[dowOf(mo.idx, sel)] || [];
  const move = (dir) => { const n = Math.max(0, Math.min(MONTHS.length - 1, mi + dir)); if (n === mi) return; haptic(8); setMi(n); setSel(1); setPick(null); };
  const cells = []; for (let i = 0; i < mo.start; i++) cells.push(null); for (let d = 1; d <= mo.days; d++) cells.push(d);
  const dayLabel = `${DAY_NAMES[dowOf(mo.idx, sel)]} ${sel} ${mo.name.split(" ")[0]}`;

  return (
    <Screen title={L_CAL(role, readOnly)} right={right} meta={role === "coach" ? "Your week" : conn ? `with ${conn.coach}` : ""}>
      {/* family strip stays, it answers a different question */}
      {/* A parent needs the next fortnight across everyone, not one line
          each. Grouped by day, and filterable to one person. */}
      {role === "player" && family && family.length > 0 && (() => {
        const upcoming = [];
        family.forEach((f) => {
          if (!f.next) return;
          upcoming.push({ ...f.next, name: f.name, sport: f.sport, coach: f.coach, id: f.id });
          seriesOccurrences(dowOf(f.next.m, f.next.d), 2, "weekly", f.next.m, f.next.d)
            .forEach((o) => upcoming.push({ ...o, time: f.next.time, name: f.name, sport: f.sport, coach: f.coach, id: f.id }));
        });
        const filtered = famFilter === "Everyone" ? upcoming : upcoming.filter((u) => u.name.split(" ")[0] === famFilter);
        const sorted = filtered.sort((a, b) => a.m - b.m || a.d - b.d).slice(0, 8);
        const days = [];
        sorted.forEach((u) => {
          const k = `${u.m}-${u.d}`;
          const g = days.find((x) => x.k === k);
          if (g) g.items.push(u); else days.push({ k, m: u.m, d: u.d, items: [u] });
        });
        return (
          <div className="px-6 mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <span style={{ ...TYPE.heading, color: t.ink }}>{tr("Everyone")}</span>
              <span style={{ ...TYPE.caption, color: t.faint }}>next {sorted.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
              {["Everyone", ...family.map((f) => f.name.split(" ")[0])].map((n) => {
                const on = famFilter === n;
                return (
                  <button key={n} onClick={() => { haptic(5); setFamFilter(n); }} className="px-3.5 shrink-0 active:opacity-60"
                          style={{ minHeight: 32, borderRadius: R.surface, background: on ? t.ink : "transparent",
                                   border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 12, fontWeight: 600,
                                   color: on ? "#fff" : t.sub }}>{n}</button>
                );
              })}
            </div>
            {days.length === 0 ? (
              <p className="py-8 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("Nothing booked.")}</p>
            ) : (
              <div style={{ borderTop: `1px solid ${t.hair}` }}>
                {days.map((g) => (
                  <div key={g.k} className="flex gap-4 py-3.5" style={{ borderBottom: `1px solid ${t.hair}` }}>
                    <span className="shrink-0 text-center" style={{ width: 38 }}>
                      <span className="block" style={{ fontFamily: display, fontSize: 19, lineHeight: 1, color: t.ink }}>{g.d}</span>
                      <span className="block mt-1 uppercase" style={{ fontFamily: ui, fontSize: 8.5, letterSpacing: "0.14em", color: t.faint }}>
                        {DAY_NAMES[dowOf(g.m, g.d)].slice(0, 3)}
                      </span>
                    </span>
                    <span className="flex-1 min-w-0">
                      {g.items.map((u, k) => (
                        <span key={k} className="flex items-center gap-2.5" style={{ minHeight: 28 }}>
                          <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: SPORTS[u.sport].theme.accent }} />
                          <span className="flex-1 min-w-0 truncate" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{u.name.split(" ")[0]}</span>
                          <span className="shrink-0" style={{ ...TYPE.caption, color: t.faint }}>{u.time}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {role === "coach" && (
        <div className="px-6 mb-4">
          <button onClick={() => { haptic(9); soft(); onRecurring && onRecurring(); }}
                  onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-80"
                  style={{ minHeight: 66, borderRadius: R.surface, background: `${t.accent}0F`,
                           border: `1px solid ${t.accent}1C`, willChange: "transform",
                           transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
                           animation: "liftIn 420ms cubic-bezier(.22,1,.36,1) both" }}>
            <span className="rounded-full flex items-center justify-center shrink-0"
                  style={{ width: 38, height: 38, background: t.accent }}>
              <CalendarDays size={17} color={t.onAccent} strokeWidth={2.1} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.ink }}>{tr("Recurring lessons")}</span>
              <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{tr("Standing slots you keep each week")}</span>
            </span>
            <ChevronRight size={16} color={t.accent} />
          </button>
        </div>
      )}

      <div className="px-6 mb-5">
        <Segmented options={[tr("List"), tr("Calendar")]} value={view} onChange={(v) => { haptic(7); soft(); setView(v); }} />
      </div>

      {view === tr("List") ? (
        <AgendaList role={role} avail={avail} blocked={blocked} seedBooked={seedBooked} duration={duration}
                    monthIdx={mo.idx} slotKinds={slotKinds || {}} juvenile={juvenile}
                    onOpen={(day, bk) => onPeek && onPeek(bk)}
                    onEditDay={(day) => onEditDay && onEditDay(day)}
                    onBookInto={(day, h, k) => onBookInto && onBookInto(day, h, k)}
                    onRecurring={() => onRecurring && onRecurring()} push={push} />
      ) : (<>

      {/* ---- month grid: quiet, availability-led ---- */}
      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <span style={{ ...TYPE.heading, color: t.ink }}>{mo.name}</span>
          <span className="flex items-center gap-1">
            <button onClick={() => move(-1)} disabled={mi === 0} className="p-2 active:opacity-40 disabled:opacity-20" aria-label={tr("Previous month")}><ChevronLeft size={18} color={t.ink} /></button>
            <button onClick={() => move(1)} disabled={mi === MONTHS.length - 1} className="p-2 active:opacity-40 disabled:opacity-20" aria-label={tr("Next month")}><ChevronRight size={18} color={t.ink} /></button>
          </span>
        </div>
        <div className={`grid mb-2`} style={{ gridTemplateColumns: `repeat(${prefs.weekends ? 7 : 5}, minmax(0, 1fr))` }}>
          {DOW.map((d, i) => (prefs.weekends || i < 5) && (<div key={i} className="text-center uppercase" style={{ fontFamily: ui, fontSize: 9, letterSpacing: "0.14em", fontWeight: 600, color: t.faint }}>{d}</div>))}
        </div>
        <div className="gap-y-1.5" style={{ display: "grid", gridTemplateColumns: `repeat(${prefs.weekends ? 7 : 5}, minmax(0, 1fr))` }}>
          {cells.map((d, i) => {
            if (d === null) return <span key={`b${i}`} />;
            if (!prefs.weekends && dowOf(mo.idx, d) > 4) return null;
            const gone = isPast(mo.idx, d);
            const on = sel === d;
            const today = mo.idx === TODAY.m && d === TODAY.d;
            const nOpen = openTimes(mo.idx, d, avail, blocked, bookings, seedBooked).length;
            const dayBooked = (seedBooked[key(mo.idx, d)] || []).length;
            const mine = !!mineOn(mo.idx, d);
            const available = !gone && (role === "coach" ? (dayBooked > 0 || nOpen > 0) : nOpen > 0);
            return (
              <button key={d} onClick={() => { haptic(6); setSel(d); setPick(null); }} disabled={gone}
                      className="flex flex-col items-center justify-center disabled:opacity-100" style={{ height: 46 }}>
                <span className="flex items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: R.surface,
                               background: on ? t.ink : mine ? t.wash : "transparent",
                               border: !on && today ? `1px solid ${t.accent}` : "1px solid transparent",
                               fontFamily: ui, fontSize: 14.5, fontWeight: on ? 600 : available ? 500 : 400,
                               color: on ? "#fff" : gone ? t.hair : available ? t.ink : t.faint }}>{d}</span>
                <span style={{ height: 5, marginTop: 1 }}>
                  {mine ? <span className="block rounded-full" style={{ width: 4, height: 4, background: t.accent }} />
                        : available && !on ? <span className="block rounded-full" style={{ width: 3, height: 3, background: t.hair }} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- the selected day, as a readable column ---- */}
      <div className="px-6">
        <div className="flex items-baseline justify-between mb-4">
          <span style={{ fontFamily: display, fontSize: 21, letterSpacing: "-0.025em", color: t.ink }}>{dayLabel}</span>
          <span style={{ ...TYPE.caption, color: t.faint }}>
            {role === "coach" ? `${booked.length} booked · ${open.length} free` : readOnly ? "View only" : `${open.length} available`}
          </span>
        </div>

        {/* AI suggestion — one line, not a panel */}
        {role === "player" && aiPick && !myDay && !readOnly && (
          <button onClick={() => { hapticCommit(); soft(); onBook(aiPick); }}
                  className="w-full flex items-center gap-2.5 mb-4 text-left active:opacity-60"
                  style={{ minHeight: 50, borderRadius: R.control, background: t.wash, paddingLeft: 14, paddingRight: 14 }}>
            <Sparkles size={14} color={t.accent} strokeWidth={2} />
            <span className="flex-1" style={{ fontFamily: ui, fontSize: 13.5, color: t.ink }}>
              {aiPick.reason}
            </span>
            <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.accent }}>{tr("Book")}</span>
          </button>
        )}

        {myDay && (
          <div className="mb-5 pb-5" style={{ borderBottom: `1px solid ${t.hair}` }}>
            <span className="uppercase block mb-2" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Your lesson")}</span>
            <div className="flex items-baseline justify-between">
              <span style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: t.ink }}>{span(myDay.time, duration)}</span>
              {readOnly
                ? <span style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{tr("Booked by your parent")}</span>
                : <span className="flex items-center gap-4">
                    <button onClick={() => { haptic(8); onCancel(myDay); say("Cancelled"); }} className="active:opacity-60" style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{tr("Cancel")}</button>
                    <button onClick={() => { hapticCommit(); onCancel(myDay); say("Pick a new time"); }} className="active:opacity-60" style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: t.accent }}>{tr("Reschedule")}</button>
                  </span>}
            </div>
            <div className="mt-1" style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{duration} min with {conn?.coach || "your coach"}</div>
          </div>
        )}

        {past ? (
          <p className="py-10 text-center" style={{ fontFamily: ui, fontSize: 14, color: t.faint }}>{tr("That day has passed.")}</p>
        ) : role === "coach" ? (
          booked.length === 0 && dayHours.length === 0 ? (
            <FreeDay onSetHours={() => push("availability")} />
          ) : (<>
            {booked.length > 0 ? (
              <>
                <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>
                  {tr("Today's schedule")}
                </div>
                {booked.map((b, i) => (
                  <ScheduleBlock key={b.time + i} item={b} duration={duration} delay={i * 70}
                                 hoursUntil={Math.max(0, (parseTime(b.time) - 11 * 60) / 60)}
                                 onOpenLast={(n) => push("history:" + n)} onLog={() => onLogFor && onLogFor(b)}
                                 onCancel={(l) => onCancelWithReason && onCancelWithReason(l)} push={push} />
                ))}
              </>
            ) : <FreeDay onSetHours={() => push("availability")} />}

            {booked.length > 0 && (
              <button onClick={() => { haptic(9); onWeatherDay && onWeatherDay(); }}
                      className="w-full flex items-center gap-3 px-5 mb-4 active:opacity-60"
                      style={{ minHeight: 54, borderRadius: R.control, background: t.surface, border: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
                <Radio size={16} color={t.sub} strokeWidth={1.6} />
                <span className="flex-1 text-left" style={{ fontFamily: ui, fontSize: 14, color: t.ink }}>{tr("Weather call-off")}</span>
                <ChevronRight size={15} color={t.faint} />
              </button>
            )}

            {open.length > 0 && prefs.showFree && (<>
              <div className="uppercase mt-6 mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>
                {open.length} {tr("free")}
              </div>
              <div className="flex flex-wrap gap-2">
                {open.map((time, i) => (
                  <button key={time} onClick={() => { haptic(6); setPick(pick === time ? null : time); }}
                          className="px-3.5 active:opacity-60"
                          style={{ minHeight: 40, borderRadius: R.pill, background: pick === time ? t.ink : t.surface,
                                   border: `1px solid ${pick === time ? t.ink : t.hair}`, fontFamily: ui, fontSize: 12.5,
                                   fontWeight: 600, color: pick === time ? "#fff" : t.sub,
                                   animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 30}ms both` }}>
                    {span(time, duration)}
                  </button>
                ))}
              </div>
            </>)}
          </>)
        ) : dayHours.length === 0 ? (
          <div className="py-10 text-center">
            <p style={{ fontFamily: ui, fontSize: 14, color: t.sub }}>{tr("No lessons this day.")}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dayHours.filter((tm) => !booked.find((b) => b.time === tm) && !blocked.some((b) => b.m === mo.idx && b.d === sel && b.time === tm)).map((time, i) => {
              const on = pick === time;
              return (
                <button key={time} onClick={() => { if (readOnly) { haptic(6); say(tr("A parent books your lessons")); return; } haptic(6); soft(); setPick(on ? null : time); }}
                        className="px-4 active:opacity-60"
                        style={{ minHeight: 52, borderRadius: R.surface, background: on ? t.ink : t.surface,
                                 border: `1px solid ${on ? t.ink : t.hair}`, fontFamily: ui, fontSize: 13.5,
                                 fontWeight: 600, color: on ? "#fff" : t.ink,
                                 boxShadow: ELEV.rest,
                                 animation: `fadeUp 340ms cubic-bezier(.22,1,.36,1) ${i * 30}ms both` }}>
                  {span(time, duration)}
                </button>
              );
            })}
          </div>
        )}

        {/* booking confirmation, with recurrence for private lessons */}
        {pick && role === "player" && !readOnly && (
          <div className="mt-6">
            <span className="uppercase block mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Repeat")}</span>
            <div className="flex gap-2 mb-5">
              {[["once", "Just once"], ["weekly", "Weekly"], ["fortnightly", "Fortnightly"], ["monthly", "Monthly"]].map(([id, lbl]) => {
                const onR = recurrence === id;
                return (<button key={id} onClick={() => { haptic(6); setRecurrence(id); }} className="flex-1 active:opacity-60"
                                style={{ minHeight: 42, borderRadius: R.control, background: onR ? t.ink : t.wash,
                                         fontFamily: ui, fontSize: 12, fontWeight: 600, color: onR ? "#fff" : t.sub }}>{lbl}</button>);
              })}
            </div>
            <Button onClick={() => { onBook({ m: mo.idx, d: sel, time: pick }); setPick(null); }}>
              Book {span(pick, duration)}{recurrence !== "once" ? `, ${recurrence}` : ""}
            </Button>
          </div>
        )}
        {pick && role === "coach" && (
          <div className="mt-6">
            <Button tone="quiet" onClick={() => { setBlocked((b) => [...b, { m: mo.idx, d: sel, time: pick }]); say(`${pick} blocked`); setPick(null); haptic(12); }}>Block {span(pick, duration)}</Button>
          </div>
        )}
        {role === "coach" && seriesList && seriesList.length > 0 && (
          <div className="mt-8">
            <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Recurring")}</div>
            <div style={{ borderTop: `1px solid ${t.hair}` }}>
              {seriesList.map((r) => (
                <button key={r.id} onClick={() => { haptic(6); onEditSeries && onEditSeries(r.who); }}
                        className="w-full flex items-center gap-3 text-left active:opacity-50"
                        style={{ minHeight: 62, borderBottom: `1px solid ${t.hair}` }}>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...TYPE.body, color: t.ink }}>{r.who}</span>
                    <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
                      {DAY_NAMES[r.day]}s {r.time} · {r.freq} · {r.total - r.used} of {r.total} left
                    </span>
                  </span>
                  <ChevronRight size={15} color={t.faint} />
                </button>
              ))}
            </div>
          </div>
        )}
        {role === "coach" && (
          <div className="mt-8">
            <div className="uppercase mb-3" style={{ ...TYPE.eyebrow, color: t.faint }}>{tr("Options")}</div>
            <div style={{ borderTop: `1px solid ${t.hair}` }}>
              <div className="flex items-center gap-3" style={{ minHeight: 58, borderBottom: `1px solid ${t.hair}` }}>
                <span className="flex-1" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Show free slots")}</span>
                <Toggle on={prefs.showFree} onChange={(v) => setPrefs({ ...prefs, showFree: v })} />
              </div>
              <div className="flex items-center gap-3" style={{ minHeight: 58, borderBottom: `1px solid ${t.hair}` }}>
                <span className="flex-1" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Show weekends")}</span>
                <Toggle on={prefs.weekends} onChange={(v) => setPrefs({ ...prefs, weekends: v })} />
              </div>
              <div className="flex items-center gap-3" style={{ minHeight: 58, borderBottom: `1px solid ${t.hair}` }}>
                <span className="flex-1" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Colour by lesson type")}</span>
                <Toggle on={prefs.colourType} onChange={(v) => setPrefs({ ...prefs, colourType: v })} />
              </div>
              <div className="py-4" style={{ borderBottom: `1px solid ${t.hair}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Gap between lessons")}</span>
                  <span style={{ fontFamily: ui, fontSize: 12.5, color: t.faint }}>{prefs.buffer} min</span>
                </div>
                <div className="flex gap-2">
                  {[0, 5, 10, 15].map((b) => {
                    const on = prefs.buffer === b;
                    return (<button key={b} onClick={() => { haptic(5); setPrefs({ ...prefs, buffer: b }); }} className="flex-1 active:opacity-60"
                                    style={{ minHeight: 40, borderRadius: R.control, background: on ? t.accent : t.wash,
                                             fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: on ? "#fff" : t.sub }}>{b === 0 ? "None" : `${b}m`}</button>);
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {role === "coach" && (
          <button onClick={() => push("availability")} className="w-full flex items-center text-left active:opacity-50 mt-6"
                  style={{ minHeight: 58, borderTop: `1px solid ${t.hair}`, borderBottom: `1px solid ${t.hair}` }}>
            <span className="flex-1" style={{ ...TYPE.body, color: t.ink }}>{tr("Hours and lesson length")}</span><ChevronRight size={16} color={t.faint} />
          </button>
        )}
        <div style={{ height: 26 }} />
      </div>
      </>)}
    </Screen>
  );
}
const L_CAL = (role, readOnly) => (role === "coach" ? "Schedule" : readOnly ? "Calendar" : "Book a lesson");

/* ==================================================================
   MESSAGES — urgent tagline + bulk broadcast
================================================================== */
function MessageList({ role, push, sheet, right, empty, lang, onNew, onWeather }) {
  const t = useT(); const L = useL();
  const preview = (id) => { const r = id ? readMsg(id, lang) : null; return r ? r.text : ""; };
  const list = empty ? [] : THREADS[role];
  return (
    <Screen title={tr("Messages")} right={right}
            action={<button onClick={() => { hapticCommit(); soft(); role === "coach" ? sheet("newChoice") : onNew && onNew(); }}
                            className="rounded-full flex items-center justify-center active:opacity-70"
                            style={{ width: 40, height: 40, background: t.accent,
                                     boxShadow: `0 4px 14px ${t.accent}22`,
                                     animation: "ringPop 520ms cubic-bezier(.22,1,.36,1) both" }}
                            aria-label={tr("New message")}>
                      <Plus size={19} color={t.onAccent} strokeWidth={2.1} />
                    </button>}>

      {role === "coach" && (<div className="px-6 mb-5">
        <button onClick={() => { haptic(8); sheet("broadcast"); }} className="w-full rounded-2xl flex items-center gap-3 px-4 active:opacity-60" style={{ minHeight: 54, border: `1px solid ${t.hair}` }}>
          <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: t.wash }}><Radio size={15} color={t.sub} /></span>
          <span className="flex-1" style={{ fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: t.ink }}>{tr("Message everyone")}</span>
          <ChevronRight size={16} color={t.faint} />
        </button>
      </div>)}

      {role === "coach" && (
        <div className="px-6 mb-4">
          <Tile className="px-5 py-[18px]" onPress={() => onWeather && onWeather()}>
            <div className="flex items-center gap-3.5">
              <Radio size={17} color={t.sub} strokeWidth={1.6} />
              <span className="flex-1">
                <span className="block" style={{ ...TYPE.body, fontSize: 14.5, color: t.ink }}>{tr("Weather call-off")}</span>
                <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>{tr("Only those affected are told")}</span>
              </span>
              <ChevronRight size={15} color={t.faint} />
            </div>
          </Tile>
        </div>
      )}
      <div className="px-6 pb-2"><Card>{list.length === 0 ? (
        <div className="p-8 text-center">
          <span className="rounded-full flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, background: t.wash }}><MessageCircle size={21} color={t.sub} strokeWidth={1.6} /></span>
          <p style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{tr("No messages")}</p>
          <p className="mt-2" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>Conversations appear here once you have someone to talk to.</p>
        </div>
      ) : list.map((c, i) => (
        <button key={c.name} onClick={() => { haptic(6); push("thread:" + c.name); }} className="w-full flex items-center gap-3.5 px-5 text-left active:opacity-50" style={{ minHeight: 74, borderBottom: i === list.length - 1 ? "none" : `1px solid ${t.hair}` }}>
          <Avatar name={c.name} size={44} group={c.group} />
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline justify-between gap-2"><span className="truncate" style={{ fontFamily: ui, fontSize: 15.5, fontWeight: c.unread ? 700 : 600, color: t.ink }}>{c.name}{c.group ? ` · ${c.n}` : ""}</span><span className="shrink-0" style={{ ...TYPE.caption, color: t.faint }}>{c.when}</span></span>
            <span className="flex items-center gap-2 mt-0.5"><span className="flex-1 truncate" style={{ fontFamily: ui, fontSize: 13, color: c.unread ? t.ink : t.faint }}>{preview(c.lastId)}</span>
              {c.unread > 0 && (<span className="rounded-full flex items-center justify-center shrink-0" style={{ minWidth: 19, height: 19, padding: "0 5px", background: t.accent, fontFamily: ui, fontSize: 11, fontWeight: 600, color: t.onAccent }}>{c.unread}</span>)}</span>
          </span>
        </button>
      ))}</Card></div>
    </Screen>
  );
}
function BroadcastBody({ nouns, say, close }) {
  const t = useT();
  const allLabel = `All ${nouns || "players"}`;
  const [aud, setAud] = useState(allLabel); const [text, setText] = useState("");
  return (
    <>
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, letterSpacing: "-0.01em", color: t.ink }}>{tr("Message everyone")}</h2>
      <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("One message, sent to every thread at once.")}</p>
      <div className="mb-5"><Segmented options={[allLabel, "Groups only"]} value={aud} onChange={setAud} /></div>
      <div className="mb-6"><VoiceArea value={text} onChange={setText} rows={4} ph={tr("Write or say your message")} /></div>
      <Button disabled={!text.trim()} onClick={() => { say(`Sent to ${aud === allLabel ? ROSTER.length + " " + (nouns || "players") : "your groups"}`); close(); }}>{tr("Send")}</Button>
    </>
  );
}
function Thread({ role, name, isGroup, lang, pop, say }) {
  const t = useT(); const L = useL(); const other = role === "coach" ? "player" : "coach";
  const [originals, setOriginals] = useState({});
  const [msgs, setMsgs] = useState(SEEDS[name] || []); const [draft, setDraft] = useState(""); const [typing, setTyping] = useState(false);
  const feed = useRef(null); const group = isGroup || THREADS.coach.find((c) => c.name === name)?.group;
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [msgs, typing]);
  const send = () => {
    const text = draft.trim(); if (!text) return; haptic(10);
    setMsgs((m) => [...m, { from: role, text, at: "now" }]); setDraft("");
    if (group) return;
    setTyping(true);
    setTimeout(() => { setTyping(false); const pool = REPLIES[other]; setMsgs((m) => [...m, { from: other, text: pool[m.length % pool.length], at: "now" }]); haptic(8); }, 1700);
  };
  /* A message is shown in your language when we have it, with the
     original one tap away. Nothing is hidden — you can always read
     exactly what the other person wrote. */
  const Bubble = ({ m, idx }) => {
    const mine = m.from === role;
    const r = m.id ? readMsg(m.id, lang) : { text: m.text, translated: false, original: m.text };
    const showingSource = originals[idx];
    const body = r.translated && !showingSource ? r.text : r.original;
    const translated = r.translated;
    return (
      <div className={`flex mb-2.5 ${mine ? "justify-end" : "justify-start"}`}>
        <div className="rounded-3xl px-4 py-2.5" style={{ maxWidth: "78%", background: mine ? t.ink : t.surface, border: mine ? "none" : `1px solid ${t.hair}`, borderBottomRightRadius: mine ? 8 : 24, borderBottomLeftRadius: mine ? 24 : 8 }}>
          <p style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.45, color: mine ? "#fff" : t.ink }}>{body}</p>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontFamily: ui, fontSize: 10.5, color: mine ? "rgba(255,255,255,0.45)" : t.faint }}>{m.at}</span>
            {translated && (
              <button onClick={() => { haptic(6); setOriginals((o) => ({ ...o, [idx]: !o[idx] })); }}
                      className="active:opacity-50 flex items-center gap-1"
                      style={{ fontFamily: ui, fontSize: 10.5, fontWeight: 600, color: mine ? "rgba(255,255,255,0.62)" : t.accent }}>
                <Radio size={9} strokeWidth={2.1} />
                {showingSource ? L.showTranslation : L.showOriginal}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
  return (
    <SwipeBack onBack={pop}>
      <div className="flex flex-col h-full" style={{ background: t.page }}>
        <div className="shrink-0 flex items-center px-1.5 relative z-20" style={{ height: 52, background: `${t.page}E6`, backdropFilter: "saturate(180%) blur(18px)", borderBottom: `1px solid ${t.hair}` }}>
          <button onClick={() => { haptic(); pop(); }} aria-label={tr("Back")} className="p-2 active:opacity-40"><ChevronLeft size={25} color={t.accent} strokeWidth={2.1} /></button>
          <Avatar name={name} size={32} group={group} />
          <span className="flex-1 ml-2.5 min-w-0"><span className="block truncate" style={{ fontFamily: ui, fontSize: 15.5, fontWeight: 600, color: t.ink }}>{name}</span><span className="block" style={{ ...TYPE.caption, color: t.faint }}>{group ? "Group chat" : role === "coach" ? "Player" : "Your coach"}</span></span>
          <button onClick={() => { haptic(6); say("Opens their profile"); }} className="p-2 active:opacity-40" aria-label={tr("Details")}><ChevronRight size={20} color={t.faint} /></button>
        </div>
        <div ref={feed} className="flex-1 overflow-y-auto px-4 pt-5 pb-3">
          {lang !== "en" && (
            <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2" style={{ borderRadius: R.surface, background: t.wash }}>
              <Radio size={11} color={t.faint} strokeWidth={2.1} />
              <span style={{ fontFamily: ui, fontSize: 11, color: t.faint }}>{L.translatedFor}</span>
            </div>
          )}
          <p className="text-center mb-5" style={{ ...TYPE.caption, color: t.faint }}>{L.today}</p>
          {msgs.length === 0 ? (<p className="text-center mt-8" style={{ fontFamily: ui, fontSize: 13.5, color: t.faint }}>{tr("Say hello to get the group started.")}</p>) : msgs.map((m, i) => <Bubble key={i} m={m} idx={i} />)}
          {typing && (<div className="flex justify-start mb-2.5"><div className="rounded-3xl px-4 py-3.5 flex gap-1.5" style={{ background: t.surface, border: `1px solid ${t.hair}`, borderBottomLeftRadius: 8 }}>
            {[0, 1, 2].map((i) => (<span key={i} className="rounded-full" style={{ width: 6, height: 6, background: t.faint, animation: `bl 1.2s ${i * 0.16}s infinite` }} />))}</div></div>)}
        </div>
        <div className="shrink-0 px-3 pt-2 pb-3" style={{ background: `${t.surface}F2`, backdropFilter: "blur(18px)", borderTop: `1px solid ${t.hair}` }}>
          <div className="flex items-end gap-2">
            <button onClick={() => { haptic(6); say("Attach a photo"); }} className="rounded-full flex items-center justify-center shrink-0 active:opacity-50" style={{ width: 40, height: 40, background: t.wash }} aria-label={tr("Attach")}><Paperclip size={18} color={t.sub} /></button>
            <div className="flex-1 rounded-3xl px-4 py-2.5 flex items-center gap-2" style={{ background: t.wash }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Message" className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 15.5, color: t.ink, background: "transparent" }} />
              <MicBtn onText={(txt) => setDraft(draft ? draft + " " + txt : txt)} size={28} />
            </div>
            <button onClick={send} disabled={!draft.trim()} className="rounded-full flex items-center justify-center shrink-0 active:opacity-60 disabled:opacity-25" style={{ width: 40, height: 40, background: t.accent }} aria-label={tr("Send")}><Send size={17} color={t.onAccent} /></button>
          </div>
        </div>
      </div>
    </SwipeBack>
  );
}

/* ==================================================================
   BRANDING — expanded swatches + clearer preview
================================================================== */
function Branding({ swatch, setSwatch, clubName, setClubName, nouns, pop, say }) {
  const t = useT();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Branding")} onBack={pop} meta={tr("How they see the app")} right={<TextBtn onClick={() => { say("Branding saved"); pop(); }}>{tr("Save")}</TextBtn>}>
        <div className="px-6 mb-6"><Card className="p-6 flex flex-col items-center">
          <div className="rounded-2xl flex items-center justify-center mb-4" style={{ width: 74, height: 74, background: t.wash, border: `1px dashed ${t.hair}` }}><Plus size={22} color={t.faint} /></div>
          <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.accent }}>{tr("Upload your logo")}</span>
          <span className="mt-1" style={{ ...TYPE.caption, color: t.faint }}>Square PNG, 512px or larger</span>
        </Card></div>
        <Eyebrow>{tr("Club or academy name")}</Eyebrow>
        <div className="px-6 mb-6"><Card><div className="px-5 py-4"><input value={clubName} onChange={(e) => setClubName(e.target.value)} className="w-full outline-none" style={{ fontFamily: ui, fontSize: 16, color: t.ink, background: "transparent" }} /></div></Card></div>
        <Eyebrow>{tr("Accent colour")}</Eyebrow>
        <div className="px-6 mb-6"><Card>{SWATCHES.map((s, i) => (
          <Row key={s.id} label={s.name} checked={swatch.id === s.id} last={i === SWATCHES.length - 1}
               icon={<span className="rounded-full shrink-0" style={{ width: 22, height: 22, background: s.accent || t.accent, border: s.accent ? "none" : `2px dashed ${t.hair}` }} />}
               onToggle={() => { haptic(8); setSwatch(s); }} />
        ))}</Card></div>
        <div className="px-6 pb-2"><Card className="p-5">
          <div className="uppercase mb-3" style={{ fontFamily: ui, fontSize: 10.5, letterSpacing: "0.13em", fontWeight: 600, color: t.faint }}>{tr("Preview — this is exactly what players see")}</div>
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${t.accent}0F`, border: `0.5px solid ${t.accent}2E` }}>
            <Mark size={26} color={t.accent} /><span className="flex-1" style={{ fontFamily: display, fontSize: 17, color: "#fff" }}>{clubName || "Your club"}</span>
            <span className="rounded-full px-3 py-1.5" style={{ background: t.accent, fontFamily: ui, fontSize: 12, fontWeight: 600, color: t.onAccent }}>{tr("Request")}</span>
          </div>
        </Card></div>
      </Screen>
    </SwipeBack>
  );
}

/* ==================================================================
   SETTINGS
================================================================== */
function Settings({ role, cfg, conn, brandName, coachName, plan, region, onTour, onPhoto, onMainSport, multiSport, mainLabel, weekDone = 0, weekHours = 0, seasonDone = 0, reduceMotion, setReduceMotion, soundState, setSoundState, lang, dark, setDark, textScale, setTextScale, hapticsOn, setHapticsOn, pop, push, go, sheet, say, restart }) {
  const t = useT(); const L = useL();
  const sub = role === "coach" ? `${cfg.label} coach · ${brandName}` : `${cfg.label} · ${conn?.coach || ""}`;
  const I = ({ C }) => <C size={17} color={t.sub} strokeWidth={1.6} />;
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("You")} onBack={pop}>
        <div className="px-6"><Card className="p-5 mb-6">
          <button onClick={() => { haptic(6); push("details"); }} className="w-full flex items-center gap-4 text-left active:opacity-50">
            <Avatar name={coachName} size={58} /><span className="flex-1"><span className="block" style={{ fontFamily: display, fontSize: 22, color: t.ink }}>{coachName}</span><span className="block mt-0.5" style={{ ...TYPE.small, color: t.faint }}>{sub}</span></span>
            <ChevronRight size={18} color={t.faint} />
          </button>

          {role === "coach" && (
            <div className="flex mt-5 pt-5" style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
              {[[weekDone, tr("this week")], [`${weekHours}h`, tr("taught")], [seasonDone, tr("this season")]].map(([v, k], i) => (
                <span key={k} className="flex-1" style={{ borderLeft: i ? `0.5px solid ${HAIR(t.ink, 0.14)}` : "none",
                             paddingLeft: i ? 14 : 0 }}>
                  <span className="block" style={{ ...TYPE.figure, fontSize: 22, color: t.ink }}>{v}</span>
                  <span className="block mt-1" style={{ ...TYPE.eyebrow, fontSize: 9, color: t.faint }}>{k}</span>
                </span>
              ))}
            </div>
          )}
        </Card></div>

        {role === "coach" ? (<><Eyebrow>{tr("Coaching")}</Eyebrow><div className="px-6 mb-6"><Card>
          <Row label={tr("Reviews")}  chevron icon={<I C={Sparkles} />} onToggle={() => push("reviews")} />
          <Row label={tr("Paperwork")}  chevron icon={<I C={ShieldCheck} />} onToggle={() => push("credentials")} />
          <Row label={tr("Requests")}  chevron icon={<I C={UserPlus} />} onToggle={() => push("requests")} />
          <Row label={tr("Subscription")} sub={`${BRAND} ${plan?.name || "Coach"} · €${plan?.price || 24} a month`} chevron icon={<I C={ShieldCheck} />} onToggle={() => push("subscription")} />
          <Row label={tr("Weekly availability")} sub={tr("Days and times you coach")} chevron icon={<I C={CalendarDays} />} onToggle={() => push("availability")} />
          <Row label={tr("Roster & groups")} sub={`${cfg.nouns} · ${tr("and recurring groups")}`} chevron icon={<I C={Users} />} onToggle={() => push("roster")} />
          <Row label={tr("Drills")} sub={tr("Your reusable library")} chevron icon={<I C={Library} />} onToggle={() => push("library")} />
          <Row label={tr("Branding")} sub={tr("Logo, colour, club name")} chevron icon={<I C={Palette} />} onToggle={() => push("branding")} />
          <Row label={tr("Invite code & QR")} value="RD4K9P" chevron last icon={<I C={QrCode} />} onToggle={() => sheet("invite")} />
        </Card></div></>) : (<><Eyebrow>{tr("Playing")}</Eyebrow><div className="px-6 mb-6"><Card>
          <Row label={tr("This month")}  chevron icon={<I C={TrendingUp} />} onToggle={() => push("digest")} />
          <Row label={tr("Family dashboard")} sub={tr("Everyone you manage, in one place")} chevron icon={<I C={Users} />} onToggle={() => { pop(); go("family"); }} />
          <Row label={tr("Coaches & profiles")} sub={tr("Add a young person or another coach")} chevron icon={<I C={UserPlus} />} onToggle={() => sheet("family")} />
          <Row label={tr("Downloads")} sub={tr("Videos saved for offline")} chevron icon={<I C={Download} />} onToggle={() => say("Manage saved videos")} />
          <Row label={tr("Subscription")} sub={tr("Free — your coach's plan covers you")} last icon={<I C={ShieldCheck} />} />
        </Card></div></>)}

        <Eyebrow>{L.appearance}</Eyebrow>
        <div className="px-6 mb-6"><Card>
          <Row label={L.region || "Region"} value={REGIONS.find((x) => x.id === region)?.name} chevron icon={<I C={Building2} />} onToggle={() => push("region")} />
          <Row label={L.language} value={LANGS.find((x) => x.id === lang)?.native} chevron icon={<I C={ExternalLink} />} onToggle={() => push("language")} />
          <Row label={L.darkMode} right={<Toggle on={dark} onChange={setDark} />} />
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.hair}` }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: ui, fontSize: 15.5, color: t.ink }}>{L.textSize}</span>
              <span style={{ ...TYPE.small, color: t.faint }}>{Math.round(textScale * 100)}%</span>
            </div>
            <div className="flex gap-2">
              {[["A", 0.9], ["A", 1], ["A", 1.12], ["A", 1.25]].map(([lbl, v], i) => {
                const on = Math.abs(textScale - v) < 0.01;
                return (
                  <button key={i} onClick={() => { haptic(6); setTextScale(v); }} className="flex-1 rounded-xl active:opacity-60"
                          style={{ minHeight: 44, background: on ? t.accent : t.wash, fontFamily: ui, fontSize: 11 + i * 3, fontWeight: 600, color: on ? "#fff" : t.sub }}>{lbl}</button>
                );
              })}
            </div>
          </div>
          <Row label={L.sound} right={<Toggle on={soundState} onChange={(v) => { setSoundState(v); setSoundOn(v); if (v) chime(); }} />} />
          <Row label={L.haptics} right={<Toggle on={hapticsOn} onChange={(v) => { setHapticsOn(v); setHapticsEnabled(v); }} />} />
          <Row label={tr("Reduce motion")} sub={tr("Fewer animations")} last right={<Toggle on={reduceMotion} onChange={setReduceMotion} />} />
        </Card></div>

        <Eyebrow>{tr("Account")}</Eyebrow>
        <div className="px-6 mb-6"><Card>
          <Row label={tr("Photo")}  chevron icon={<I C={Camera} />} onToggle={() => onPhoto && onPhoto()} />
          {multiSport && <Row label={tr("Main sport")} sub={mainLabel} chevron icon={<I C={Tag} />} onToggle={() => onMainSport && onMainSport()} />}
          <Row label={tr("Personal details")} chevron icon={<I C={User} />} onToggle={() => push("details")} />
          <Row label={tr("Notifications")} chevron icon={<I C={Bell} />} onToggle={() => push("notifications")} />
          {role === "player" && <Row label={tr("Your sporting record")} sub={tr("What each coach can see")} chevron icon={<I C={Library} />} onToggle={() => sheet("transfer")} />}
          <Row label={tr("Connections")}  chevron icon={<I C={Radio} />} onToggle={() => push("sources")} />
          <Row label={tr("Data & permissions")} chevron last icon={<I C={ShieldCheck} />} onToggle={() => push("legal:data")} />
        </Card></div>

        <Eyebrow>{tr("Support")}</Eyebrow>
        <div className="px-6 mb-6"><Card>
          <Row label={tr("Attendance")} sub={tr("Your record")} chevron icon={<I C={Check} />} onToggle={() => push("attendance")} />
          <Row label={tr("How it works")} sub={tr("Views, alerts, what others see")} chevron icon={<I C={Palette} />} onToggle={() => push("prefs")} />
          <Row label={tr("How Nosca works")}  chevron icon={<I C={Sparkles} />} onToggle={() => onTour && onTour()} />
          <Row label={tr("Help centre")} chevron icon={<I C={HelpCircle} />} onToggle={() => push("support")} />
          <Row label={tr("Contact us")} chevron last icon={<I C={Mail} />} onToggle={() => push("support")} />
        </Card></div>

        <Eyebrow>{tr("Legal")}</Eyebrow>
        <div className="px-6 mb-6"><Card>
          <Row label={tr("Terms of Service")} chevron icon={<I C={FileText} />} onToggle={() => push("legal:terms")} />
          <Row label={tr("Privacy Policy")} chevron icon={<I C={FileText} />} onToggle={() => push("legal:privacy")} />
          <Row label={tr("Licences")} chevron last icon={<I C={FileText} />} onToggle={() => push("legal:licences")} />
        </Card></div>

        <div className="px-6 mb-6"><Card>
          <Row label={tr("Sign out")} icon={<I C={LogOut} />} onToggle={restart} />
          <Row label={tr("Delete account")} danger last icon={<Trash2 size={17} color={DANGER} strokeWidth={1.6} />} onToggle={() => sheet("delete")} />
        </Card></div>

        <div className="flex flex-col items-center pb-6"><Mark size={30} color={t.faint} /><p className="mt-2.5" style={{ ...TYPE.caption, color: t.faint }}>{BRAND} {VERSION}</p><p className="mt-1" style={{ ...TYPE.caption, color: t.faint }}>{tr("Made in Ireland")}</p></div>
      </Screen>
    </SwipeBack>
  );
}
function RegionScreen({ region, setRegion, lang, setLang, pop }) {
  const t = useT(); const L = useL();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={L.region || "Region"} onBack={pop}>
        <div className="px-6 pb-2">
          <Card>{REGIONS.map((r, i) => (
            <Row key={r.id} label={r.name} checked={region === r.id} last={i === REGIONS.length - 1}
                 icon={<span className="shrink-0" style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">{flagOf(r.id)}</span>}
                 onToggle={() => { haptic(10); soft(); setRegion(r.id); if (!r.langs.includes(lang)) setLang(r.langs[0]); }} />
          ))}</Card>
          <p className="px-1 mt-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.6, color: t.faint }}>
            Sets your date format and which languages are offered.
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}
function LanguageScreen({ lang, setLang, pop, say }) {
  const t = useT(); const L = useL();
  return (
    <SwipeBack onBack={pop}>
      <Screen title={L.language} onBack={pop}>
        <div className="px-6 pb-2">
          <Card>{LANGS.map((x, i) => (
            <Row key={x.id} label={x.native} sub={x.label} checked={lang === x.id} last={i === LANGS.length - 1}
                 onToggle={() => { haptic(10); setLang(x.id); tone(700, 0.12, 0.04); }} />
          ))}</Card>
          <p className="px-1 mt-4" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.6, color: t.faint }}>
            The app, and messages from your coach, appear in this language. Lesson notes and drills stay as your coach
            wrote them — you'll see the original alongside a translation where we have one.
          </p>
        </div>
      </Screen>
    </SwipeBack>
  );
}
function Details({ role, pop, say }) {
  const t = useT();
  const [f, setF] = useState(role === "coach"
    ? { Name: "Ray Doyle", Email: "ray@hollowbrook.ie", Phone: "+353 87 123 4567", Qualifications: "PGA Professional, Level 3", Bio: "Twelve years coaching, mostly short game." }
    : { Name: "Marcus Tran", Email: "marcus.tran@gmail.com", Phone: "+353 86 998 2211" });
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Personal details")} onBack={pop} right={<TextBtn onClick={() => { say("Saved"); pop(); }}>{tr("Save")}</TextBtn>}>
        <div className="px-6 pb-2">
          <Card className="mb-5">{Object.keys(f).map((k, i, arr) => (
            <div key={k} className="px-5 py-3.5" style={{ borderBottom: i === arr.length - 1 ? "none" : `1px solid ${t.hair}` }}>
              <div style={{ ...TYPE.caption, color: t.faint }}>{k}</div>
              {k === "Bio" ? (<textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={3} className="w-full outline-none resize-none mt-1" style={{ fontFamily: ui, fontSize: 15.5, lineHeight: 1.5, color: t.ink, background: "transparent" }} />)
                          : (<input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-full outline-none mt-1" style={{ fontFamily: ui, fontSize: 16, color: t.ink, background: "transparent" }} />)}
            </div>
          ))}</Card>
          {role === "player" && (<p className="px-2 mb-5" style={{ fontFamily: ui, fontSize: 12, lineHeight: 1.6, color: t.faint }}>Handicap and WTN now live under your stats — tap "Edit stats" on your home screen.</p>)}
          <Card><Row label={tr("Change password")} chevron last icon={<Lock size={17} color={t.sub} strokeWidth={1.6} />} onToggle={() => {}} /></Card>
        </div>
      </Screen>
    </SwipeBack>
  );
}
function Notifications({ role, pop, pushOn, setPushOn }) {
  const t = useT(); const cats = NOTIF_CATS[role]; const [state, setState] = useState(cats.map((c, i) => i < cats.length - 1)); const [mode, setMode] = useState("Instant"); const [quiet, setQuiet] = useState(true);
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Notifications")} onBack={pop} meta={tr("Choose what reaches you, and when")}>
        {!pushOn && (
          <div className="px-6 mb-6">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 38, height: 38, background: t.accent }}><Bell size={17} color={t.onAccent} strokeWidth={2} /></span>
                <span className="flex-1" style={{ fontFamily: display, fontSize: 18, color: t.ink }}>{tr("Turn on push")}</span>
              </div>
              <p className="mb-4" style={{ fontFamily: ui, fontSize: 13, lineHeight: 1.55, color: t.sub }}>
                Bookings, cancellations and messages reach you without opening the app.
              </p>
              <Button onClick={() => { setPushOn(true); hapticSuccess(); chime(); }}>{tr("Allow notifications")}</Button>
            </Card>
          </div>
        )}
        {pushOn && (
          <div className="px-6 mb-5">
            <div className="flex items-center gap-2 px-1"><Check size={14} color={STEADY} strokeWidth={2.1} style={{ animation: "checkPop 420ms cubic-bezier(.28,1.4,.5,1) both" }} />
              <span style={{ fontFamily: ui, fontSize: 12.5, color: t.sub }}>{tr("Push is on for this device")}</span></div>
          </div>
        )}
        <div className="px-6 mb-6"><Segmented options={["Instant", "Daily digest"]} value={mode} onChange={setMode} /></div>
        {mode === "Daily digest" && (<div className="px-6 mb-6"><Card className="p-5">
          <p style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.6, color: t.sub }}>One summary at 7:00 am: {role === "coach" ? "today's lessons, new messages, videos to review, completed drills and revenue." : "your lessons, drills still to do and anything coming up."}</p>
          <button className="mt-4 active:opacity-50" style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: t.accent }}>{tr("Change delivery time")}</button>
        </Card></div>)}
        <Eyebrow>{tr("Categories")}</Eyebrow>
        <div className="px-6 mb-6"><Card>{cats.map(([l, s], i) => (<Row key={l} label={l} sub={s} last={i === cats.length - 1} right={<Toggle on={state[i]} onChange={(v) => setState(state.map((x, j) => (j === i ? v : x)))} />} />))}</Card></div>
        <Eyebrow>{tr("Quiet hours")}</Eyebrow>
        <div className="px-6 pb-2"><Card><Row label={tr("Hold alerts overnight")} sub="10:00 pm to 7:00 am" last right={<Toggle on={quiet} onChange={setQuiet} />} /></Card>
</div>
      </Screen>
    </SwipeBack>
  );
}
function Legal({ docKey, pop }) {
  const t = useT(); const d = LEGAL[docKey] || LEGAL.terms;
  return (
    <SwipeBack onBack={pop}>
      <Screen title={d.title} onBack={pop} meta={d.updated}>
        <div className="px-6 pb-4">
          <div className="rounded-2xl p-4 mb-6" style={{ background: t.wash }}><p style={{ fontFamily: ui, fontSize: 12, color: t.sub }}>Placeholder copy — have a solicitor draft the real text.</p></div>
          {d.body.map(([h, p]) => (<div key={h} className="mb-6"><h3 className="mb-2" style={{ fontFamily: display, fontSize: 19, color: t.ink }}>{h}</h3><p style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.65, color: t.sub }}>{p}</p></div>))}
          <p className="pt-2" style={{ fontFamily: ui, fontSize: 12, color: t.faint }}>{BRAND} · Registered in Ireland · {VERSION}</p>
        </div>
      </Screen>
    </SwipeBack>
  );
}
function Support({ pop, say }) {
  const t = useT(); const faqs = ["How do I connect to my coach?", "How do family profiles work?", "Where do my videos go?", "How do drills and tips work?", "How do I cancel my subscription?"];
  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Help")} onBack={pop} meta={tr("We usually reply within a day")}>
        <div className="px-6 pb-2">
          <Eyebrow>{tr("Common questions")}</Eyebrow><Card className="mb-6">{faqs.map((f, i) => <Row key={f} label={f} chevron last={i === faqs.length - 1} onToggle={() => {}} />)}</Card>
          <Eyebrow>{tr("Get in touch")}</Eyebrow><Card>
            <Row label={tr("Email support")} sub="help@nosca.app" chevron icon={<Mail size={17} color={t.sub} strokeWidth={1.6} />} onToggle={() => say("Opens your mail app")} />
            <Row label={tr("Report a problem")} chevron last icon={<HelpCircle size={17} color={t.sub} strokeWidth={1.6} />} onToggle={() => say("Thanks — we'll look into it")} />
          </Card>
        </div>
      </Screen>
    </SwipeBack>
  );
}
function InviteBody({ say }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-1" style={{ fontFamily: display, fontSize: 25, color: t.ink }}>{tr("Invite a player")}</h2>
      <p className="mb-6 text-center" style={{ fontFamily: ui, fontSize: 13.5, color: t.sub }}>{tr("They enter the code or scan this.")}</p>
      <div className="rounded-3xl p-4 mb-5" style={{ border: `1px solid ${t.hair}` }}><QrSvg size={148} /></div>
      <div className="mb-6" style={{ fontFamily: display, fontSize: 36, letterSpacing: "0.16em", color: t.ink }}>RD4K9P</div>
      <Button onClick={() => say("Invite shared")}><span className="flex items-center justify-center gap-2"><Share2 size={17} /> Share invite</span></Button>
    </div>
  );
}
function DeleteBody({ onCancel, say }) {
  const t = useT();
  return (
    <>
      <h2 className="mb-3" style={{ fontFamily: display, fontSize: 25, color: t.ink }}>{tr("Delete your account")}</h2>
      <p className="mb-6" style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.6, color: t.sub }}>This removes your profile, any linked family profiles, your lessons, drills, tips, messages and every clip stored with them. It cannot be undone, and your subscription must be cancelled separately in the App Store.</p>
      <div className="mb-3"><Button tone="dangerQuiet" onClick={() => say("Account deletion requested")}>{tr("Delete permanently")}</Button></div>
      <Button tone="quiet" onClick={onCancel}>{tr("Keep my account")}</Button>
    </>
  );
}

/* ==================================================================
   SEARCH + NOTIFICATION CENTRE
================================================================== */
function SearchScreen({ role, cfg, library, tips, pop, go, push }) {
  const t = useT(); const [q, setQ] = useState(""); const term = q.trim().toLowerCase(); const hit = (s) => s.toLowerCase().includes(term);
  const lessons = term ? hadLessons(cfg).filter((l) => hit(l.focus) || l.subs.some(hit)) : [];
  const drills = term ? library.filter((d) => hit(d.t) || hit(d.d)) : [];
  const tipHits = term ? tips.filter((x) => hit(x.title) || hit(x.body)) : [];
  const people = term && role === "coach" ? ROSTER.filter((r) => hit(r.name)) : [];
  const msgs = term ? THREADS[role].filter((c) => hit(c.name) || hit((readMsg(c.lastId, LANG) || {}).text || "")) : [];
  const total = lessons.length + drills.length + tipHits.length + people.length + msgs.length;
  const suggestions = role === "coach" ? ["Bunker", "Marcus", "Putting", "Payment"] : ["Bunker", "Putting", "Drills", "Ray"];
  return (
    <SwipeBack onBack={pop}>
      <div className="flex flex-col h-full" style={{ background: t.page }}>
        <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-3" style={{ borderBottom: `1px solid ${t.hair}` }}>
          <div className="flex-1 flex items-center gap-2.5 rounded-2xl px-4" style={{ minHeight: 44, background: t.wash }}>
            <Search size={17} color={t.faint} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lessons, drills, tips, people" className="flex-1 outline-none" style={{ fontFamily: ui, fontSize: 16, color: t.ink, background: "transparent" }} />
            {q && <button onClick={() => { haptic(6); setQ(""); }} aria-label={tr("Clear")}><X size={16} color={t.faint} /></button>}
            <MicBtn onText={(txt) => setQ(txt)} size={30} />
          </div>
          <TextBtn onClick={pop}>{tr("Cancel")}</TextBtn>
        </div>
        <div className="flex-1 overflow-y-auto pt-5">
          {!term ? (<div className="px-6">
            <Eyebrow>{tr("Try")}</Eyebrow>
            <div className="flex flex-wrap gap-2 px-6" style={{ marginLeft: -24, marginRight: -24 }}>{suggestions.map((s) => (
              <button key={s} onClick={() => { haptic(6); setQ(s); }} className="rounded-full px-4 active:opacity-60" style={{ minHeight: 36, background: t.surface, border: `1px solid ${t.hair}`, fontFamily: ui, fontSize: 13.5, fontWeight: 500, color: t.sub }}>{s}</button>
            ))}</div>
          </div>) : total === 0 ? (<div className="px-6"><Card className="p-8 text-center"><p style={{ fontFamily: ui, fontSize: 14.5, color: t.sub }}>Nothing matching “{q}”.</p></Card></div>
          ) : (<>
            {lessons.length > 0 && (<><Eyebrow>{tr("Lessons")}</Eyebrow><div className="px-6 mb-6"><Card>{lessons.map((l, i) => (<Row key={l.id} label={l.focus} sub={`${l.d} ${l.m} · ${l.subs.join(", ")}`} chevron icon={<Library size={17} color={t.sub} strokeWidth={1.6} />} last={i === lessons.length - 1} onToggle={() => push("lesson")} />))}</Card></div></>)}
            {tipHits.length > 0 && (<><Eyebrow>{tr("Tips")}</Eyebrow><div className="px-6 mb-6"><Card>{tipHits.map((x, i) => (<Row key={x.id} label={x.title} sub={x.body} chevron icon={<Lightbulb size={17} color={t.sub} strokeWidth={1.6} />} last={i === tipHits.length - 1} onToggle={() => push("tips")} />))}</Card></div></>)}
            {drills.length > 0 && (<><Eyebrow>{tr("Drills")}</Eyebrow><div className="px-6 mb-6"><Card>{drills.map((d, i) => (<Row key={d.t} label={d.t} sub={d.d} chevron icon={<ListChecks size={17} color={t.sub} strokeWidth={1.6} />} last={i === drills.length - 1} onToggle={() => go("practice")} />))}</Card></div></>)}
            {people.length > 0 && (<><Eyebrow>{tr("Players")}</Eyebrow><div className="px-6 mb-6"><Card>{people.map((r, i) => (<Row key={r.name} label={r.name} sub={`${r.lessons} lessons · since ${r.since}`} chevron icon={<Avatar name={r.name} size={38} />} last={i === people.length - 1} onToggle={() => push("player:" + r.name)} />))}</Card></div></>)}
            {msgs.length > 0 && (<><Eyebrow>{tr("Messages")}</Eyebrow><div className="px-6 pb-4"><Card>{msgs.map((c, i) => (<Row key={c.name} label={c.name} sub={preview(c.lastId)} chevron icon={<MessageCircle size={17} color={t.sub} strokeWidth={1.6} />} last={i === msgs.length - 1} onToggle={() => push("thread:" + c.name)} />))}</Card></div></>)}
          </>)}
        </div>
      </div>
    </SwipeBack>
  );
}
/* THE BELL

   Everything waiting on you, in one place. A coach sees requests,
   clips, drifting players and focus approvals; a parent sees their own
   coaching above a rule, then their children's beneath it — because
   "my lesson moved" and "Róisín's lesson moved" need different
   reactions and shouldn't be shuffled together.

   Anything settled leaves the list. A bell that keeps showing done
   things stops being read. */
function NotifCentre({ role, isParent, kids = [], jobs = [], mine = [], family = [], onDo, pop, push, go, empty }) {
  const t = useT();
  const [cleared, setCleared] = useState([]);
  const live = (list) => list.filter((n) => !cleared.includes(n.id));

  const Item = ({ n, i }) => (
    <SwipeRow deleteLabel={tr("Clear")} onDelete={() => setCleared((v) => [...v, n.id])}>
      <button onClick={() => { haptic(8); soft(); if (n.go) n.go(); setCleared((v) => [...v, n.id]); }}
              className="w-full flex items-start gap-3.5 px-5 py-4 text-left active:opacity-60"
              style={{ animation: `settle 360ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both` }}>
        <span className="rounded-full shrink-0" style={{ width: 7, height: 7, marginTop: 6,
                       background: n.tone || t.hair }} />
        <span className="flex-1 min-w-0">
          <span className="block" style={{ ...TYPE.body, color: t.ink }}>{n.what}</span>
          <span className="block mt-0.5" style={{ ...TYPE.caption, color: t.faint }}>
            {n.who}{n.when ? ` · ${n.when}` : ""}
          </span>
        </span>
        {n.count > 0 && (
          <span className="rounded-full flex items-center justify-center shrink-0"
                style={{ minWidth: 22, height: 22, padding: "0 7px", background: n.tone || t.wash,
                         ...TYPE.caption, fontWeight: 500, color: n.tone ? "#fff" : t.sub }}>{n.count}</span>
        )}
      </button>
    </SwipeRow>
  );

  const Block = ({ title, list }) => live(list).length === 0 ? null : (
    <div className="mb-7">
      {title && <div className="mb-1 px-1" style={{ ...TYPE.eyebrow, color: t.faint }}>{title}</div>}
      <div style={{ borderTop: `0.5px solid ${HAIR(t.ink, 0.14)}` }}>
        {live(list).map((n, i) => <Item key={n.id} n={n} i={i} />)}
      </div>
    </div>
  );

  const total = live(jobs).length + live(mine).length + live(family).length;

  return (
    <SwipeBack onBack={pop}>
      <Screen title={tr("Alerts")} onBack={pop}
              meta={total ? `${total} ${tr("waiting")}` : tr("All clear")}>
        <div className="px-6 pb-2">
          {total === 0 ? (
            <div className="py-16 text-center">
              <span className="rounded-full inline-flex items-center justify-center mb-5"
                    style={{ width: 58, height: 58, background: t.wash, animation: "breathe 4s ease-in-out infinite" }}>
                <Check size={23} color={STEADY} strokeWidth={2.1} />
              </span>
              <p style={{ ...TYPE.title, color: t.ink }}>{tr("All clear")}</p>
            </div>
          ) : (
            <>
              <Block list={jobs} />
              {isParent ? (<>
                <Block title={tr("You")} list={mine} />
                <Block title={tr("Your family")} list={family} />
              </>) : <Block list={mine} />}
            </>
          )}
        </div>
      </Screen>
    </SwipeBack>
  );
}


/* ==================================================================
   SHELL
================================================================== */
function useTypefaces() {
  useEffect(() => {
    if (document.getElementById("nosca-type")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect"; pre.href = "https://api.fontshare.com"; pre.crossOrigin = "anonymous";
    document.head.appendChild(pre);
    const link = document.createElement("link");
    link.id = "nosca-type";
    link.rel = "stylesheet";
    /* Fraunces carries optical sizing and a soft axis; Instrument Sans
       is the quieter companion. Both variable, one request each. */
    link.href = "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@200,300,400,500,700,800,900&f[]=switzer@300,400,500,600,700&f[]=zodiak@300i,400i,500i&display=swap";
    document.head.appendChild(link);
  }, []);
}

export default function Nosca({ demo: demoProp, account, onSignOut, data } = {}) {
  /* Flip the seed switch before any child renders, so nothing can draw
     invented history even on the very first paint. */
  setLiveAccount(!!account);
  /* `account` is the real, signed-in person — passed down once real
     auth succeeds. When present, the app must land directly on their
     home screen, not run its own onboarding on top of a login that
     already happened. Without it (design-harness mode), the original
     demo flow is untouched. */
  /* Design-harness mode. A real user gets the product full-screen; the
     preview toolbar, persona switcher and phone frame appear only when
     explicitly asked for via ?demo in the URL. */
  const demo = demoProp !== undefined ? demoProp
    : (typeof window !== "undefined" && window.location.search.includes("demo"));

  useTypefaces();
  const [flow, setFlow] = useState("role");
  const [region, setRegion] = useState(null);
  const [signupSport, setSignupSport] = useState("golf");
  const [coachSport, setCoachSport] = useState(account?.sport || "golf");
  const [role, setRole] = useState("coach");
  const [stack, setStack] = useState(["today"]);
  const [published, setPublished] = useState(null);
  const lessonKey = (l) => l.time + l.who;
  const [loggedKeys, setLoggedKeys] = useState(() => new Set());
  const [sheet, setSheet] = useState(null);
  const [assignTo, setAssignTo] = useState(null);
  const [assignFocus, setAssignFocus] = useState(null);
  const [tipFor, setTipFor] = useState(null);
  const [toast, setToast] = useState("");
  const [soundState, setSoundState] = useState(true);
  const [signupName, setSignupName] = useState("");
  const [signupCoach, setSignupCoach] = useState(null);
  const [signupRole, setSignupRole] = useState("coach");
  const [playFor, setPlayFor] = useState("me");
  const signupPath = signupRole === "coach" ? "coach" : "player";
  const [juvenile, setJuvenile] = useState(false);
  const [familyGuide, setFamilyGuide] = useState(false);
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    if (!account) return;               // demo/harness path — untouched
    if (account.sport) setCoachSport(account.sport);
    setJuvenile(!!account.juvenile);
    /* The splash belongs in the product too — it is how the app opens.
       It plays through and dismisses itself via onDone, rather than
       being cancelled the instant an account appears. */
    setRole(account.role);
    setFlow("app");
    setStack([account.role === "coach" ? "today" : "home"]);
  }, [account]);
  const [celeb, setCeleb] = useState(null);
  const [goalFor, setGoalFor] = useState(null);
  const [scenarios, setScenarios] = useState(false);
  const [famLoaded, setFamLoaded] = useState(false);
  const [announce, setAnnounce] = useState(null);   // takes the whole screen
  const [quickLayout, setQuickLayout] = useState(QUICK_DEFAULT);
  /* A term's worth of registers, so the attendance screen has
     something to show before anyone takes one. */
  const [registers, setRegisters] = useState(() => {
    const out = {};
    const who = ["Marcus Tran","Priya Ellis","Aoife Nolan","Tom Beckett","Hannah Doyle"];
    const days = [["14 JUN","Summer clinic"],["07 JUN","Marcus Tran"],["31 MAY","Junior squad"],
                  ["24 MAY","Marcus Tran"],["17 MAY","Ladies group"],["10 MAY","Marcus Tran"],
                  ["03 MAY","Summer clinic"],["26 APR","Marcus Tran"],["19 APR","Junior squad"],
                  ["12 APR","Marcus Tran"],["05 APR","Summer clinic"],["29 MAR","Marcus Tran"]];
    days.forEach(([d, w], i) => {
      const reg = {};
      who.forEach((n, k) => { reg[n] = (i * 3 + k) % 11 === 0 ? "out" : "in"; });
      out[`${d} ${w}`] = reg;
    });
    return out;
  });
  const [captureFor, setCaptureFor] = useState(null);
  const [captureItems, setCaptureItems] = useState([]);
  const [prefs, setPrefsLocal] = useState(PREF_DEFAULTS);
  /* With a real account, preferences live in the database. The setter
     keeps the same signature the screens already call, so nothing
     downstream needs to know the difference. */
  const setPrefs = (next) => {
    const value = typeof next === "function" ? next(prefs) : next;
    setPrefsLocal(value);
    if (data && data.savePrefs) {
      data.savePrefs({
        log_view: value.logView, cal_view: value.calView, notify: value.notify,
        attendance: value.attendance, show_record: value.showRecord,
        show_comps: value.showComps, reduce_data: value.reduceData,
        ask_for_review: value.askForReview,
      });
    }
  };
  useEffect(() => {
    if (!data || !data.prefs) return;
    const p = data.prefs;
    setPrefsLocal({
      logView: p.log_view, calView: p.cal_view, notify: p.notify,
      quietFrom: PREF_DEFAULTS.quietFrom, attendance: p.attendance,
      showRecord: p.show_record, showComps: p.show_comps, reduceData: p.reduce_data,
      askForReview: p.ask_for_review,
    });
    /* A coach's own saved drills, layered onto the sport's starter set
       so they show up as suggestions again after signing back in —
       not just for the rest of the session they were typed in. */
    if (p.custom_drills && Object.keys(p.custom_drills).length) {
      setLibrary((l) => {
        const next = { ...l };
        for (const sp of Object.keys(p.custom_drills)) {
          const saved = p.custom_drills[sp] || [];
          const cur = next[sp] || [];
          const names = new Set(cur.map((x) => x.t.toLowerCase()));
          next[sp] = [...saved.filter((d) => !names.has(d.t.toLowerCase())), ...cur];
        }
        return next;
      });
    }
  }, [data && data.prefs]);
  /* Real files the person drops in, so the feed can be tried with
     actual footage rather than a stand-in. Object URLs are revoked
     when replaced. */
  const [ownMedia, setOwnMedia] = useState({});
  const addOwnMedia = (idx, files) => {
    if (!files.length) return;

    const place = (item) => setOwnMedia((m) => {
      const next = { ...m };
      let slot = 0;
      while (next[slot] && next[slot].length) slot++;   // first free lesson
      next[slot] = [item];
      return next;
    });

    files.forEach((f) => {
      const isVid = f.type.startsWith("video");
      if (isVid) {
        /* Safari will not play a <video> from a data: URL — it wants a
           seekable, ranged source, which is what an object URL gives.
           Photos working while clips failed was this exact difference. */
        place({ type: "video", url: URL.createObjectURL(f), name: f.name });
        hapticSuccess(); chime();
      } else {
        const reader = new FileReader();
        reader.onload = () => { place({ type: "photo", url: reader.result, name: f.name }); hapticSuccess(); chime(); };
        reader.onerror = () => say(tr("That file could not be read."));
        reader.readAsDataURL(f);
      }
    });
    say(`${tr("Loading")} ${files.length}…`);
  };

  const [overture, setOverture] = useState(null);   // the beat before a lesson opens
  const [pickFor, setPickFor] = useState(null);   // what we are choosing a player for
  const [playerComps, setPlayerComps] = useState({});   // added by the player, seen by their coach
  /* Real competitions, grouped by whose they are, so the lesson sheet
     and the player's own screen both read the same source. */
  const liveComps = data ? data.competitions : null;
  const [askRating, setAskRating] = useState(null);   // off unless the coach asks
  const [lessonReqs, setLessonReqs] = useState(account ? [] : LESSON_REQUESTS);
  const [avatars, setAvatars] = useState({});     // profileId -> tint
  const [mainSport, setMainSport] = useState({}); // profileId -> sport id
  const [askedFor, setAskedFor] = useState(account ? [] : SEED_ASKS);
  const [declining, setDeclining] = useState(null);
  /* Someone who plays two sports shouldn't be asked which one every
     time they open the app. Set once, per person. */

  const acceptAsk = (r) => {
    hapticSuccess(); chime();
    setSeedBooked((prev) => {
      const nx = { ...prev, [coachSport]: { ...prev[coachSport] } };
      const k = key(r.m, r.d);
      nx[coachSport][k] = [...(nx[coachSport][k] || []), { time: r.time, who: r.who, kind: "Private" }];
      return nx;
    });
    setAskedFor((v) => v.filter((x) => x !== r));
    setCeleb({ label: tr("Booked"), sub: `${r.who} · ${r.d} ${MONTHS.find((x) => x.idx === r.m)?.name.split(" ")[0]}` });
  };

  /* Loads the Breathnach household. Everything it touches is state the
     app already owns, so the default seeds are untouched underneath. */
  const loadFamily = () => {
    const { profiles: pf, conns: cn } = loadBreathnach();
    setFamLoaded(true);
    setJuvenile(false); setRole("player");
    setProfiles(pf); setConns(cn);
    setActiveProfileId(1); setActiveId(1); setCoachSport("tennis");
    setCalledOff(null); setSplash(false); setFlow("app"); setStack(["family"]);
    hapticSuccess(); chime();
  };
  const [weatherDay, setWeatherDay] = useState(null);
  const [loader, setLoader] = useState(false);
  /* Golf courses and boathouses rarely have signal. Capture works
     regardless; only publishing waits for a connection. */
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [calledOff, setCalledOff] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelNotice, setCancelNotice] = useState(null);
  const [transferTo, setTransferTo] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [burst, setBurst] = useState(null);
  const [logged, setLogged] = useState(0);
  const [slotKinds, setSlotKinds] = useState({});
  const [peek, setPeek] = useState(null);
  const [editDay, setEditDay] = useState(null);
  const [bookSlot, setBookSlot] = useState(null);
  const [captured, setCaptured] = useState({});
  const [checkIns, setCheckIns] = useState(CHECKIN_SEED);
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (!account) return;
    const key = `nosca.seen.${account.id}`;
    try {
      if (!window.localStorage.getItem(key)) {
        setTour(true);
        window.localStorage.setItem(key, "1");
      }
    } catch (e) { /* private browsing — skip rather than fail */ }
  }, [account]);

  /* A no-show is recorded and the lesson still counts against the
     package — that is the whole point of recording it. A cancellation
     is the opposite: it comes back to them. */
  const markNoShow = (bk) => {
    if (!bk) return;
    hapticWarn();
    /* With a real account this is recorded against the booking, so the
       player's own diary reflects it too. */
    if (data && bk.id) data.cancelBooking(bk.id, "cancelled");
    setSeedBooked((prev) => {
      const nx = { ...prev, [coachSport]: { ...prev[coachSport] } };
      const k = key(TODAY.m, TODAY.d);
      nx[coachSport][k] = (nx[coachSport][k] || []).filter((b) => b.time !== bk.time);
      if (!nx[coachSport][k].length) delete nx[coachSport][k];
      return nx;
    });
    setCeleb({ label: tr("Recorded"), sub: `${bk.who} · ${tr("no show")}`, tone: DANGER });
  };
  /* Set when a lesson lands while the player was away. */
  const [arrival, setArrival] = useState(null);

  /* Called off: drop the lessons, extend each package by one, and tell
     both sides. The player is then offered a new time. */
  const callOff = (affected, scope) => {
    /* Weather call-offs are recorded against each booking, so the
       players affected see it on their own devices rather than only in
       the coach's session. */
    if (data) (affected || []).forEach((b) => { if (b.id) data.cancelBooking(b.id, "weather"); });
    setSeedBooked((prev) => {
      const next = { ...prev, [coachSport]: { ...prev[coachSport] } };
      const k = key(TODAY.m, TODAY.d);
      next[coachSport][k] = (next[coachSport][k] || []).filter((b) => !affected.includes(b));
      if (!next[coachSport][k].length) delete next[coachSport][k];
      return next;
    });
    setSeries((list) => list.map((x) => (affected.some((a) => a.who === x.who) ? { ...x, total: x.total + 1 } : x)));
    setCalledOff(`${DAY_NAMES[dowOf(TODAY.m, TODAY.d)]} ${affected[0] ? affected[0].time : ""}`);
    setCeleb({ label: tr("Called off"), sub: `${affected.length} ${tr("told, packages extended")}`, tone: DANGER });
  };
  /* Focus suggestions in flight, and what has been agreed per person. */
  const [focusReqs, setFocusReqs] = useState([
    { who: "Priya Ellis", focus: "Short game", note: "Losing shots around the green." },
  ]);
  const [agreedFocus, setAgreedFocus] = useState({ "Marcus Tran": "Driving" });
  const settleFocus = (req, focus) => {
    setFocusReqs((v) => v.filter((x) => x !== req));
    setAgreedFocus((m) => ({ ...m, [req.who]: focus }));
    setCeleb({ label: tr("Agreed"), sub: `${req.who.split(" ")[0]} · ${focus}` });
  };
  /* A real account has no standing slots until its coach creates one. */
  const [series, setSeries] = useState(account ? [] : [
    { id: 1, who: "Marcus Tran", sport: "golf", day: 4, time: "11:00 am", freq: "weekly", total: 10, used: 2 },
  ]);
  const [recurFor, setRecurFor] = useState(null);
  const holdTimer = useRef(null);
  const suppressTap = useRef(false);
  const [calPrefs, setCalPrefs] = useState({ showFree: true, weekends: true, colourType: true, buffer: 0 });
  const [splashKey, setSplashKey] = useState(0);
  const [plan, setPlan] = useState(PLANS[0]);
  const [invited, setInvited] = useState([]);
  const [freshAccount, setFreshAccount] = useState(!!account);
  const [requests, setRequests] = useState(account ? [] : SEED_REQUESTS);
  const [accepted, setAccepted] = useState([]);
  const [unlogged, setUnlogged] = useState(UNLOGGED);
  const [goals, setGoals] = useState({ "Marcus Tran": [{ id: 1, t: "Break 90 at the club champs", by: "End of season", done: false }] });
  const [attendance, setAttendance] = useState({});
  const [prefill, setPrefill] = useState(null);
  const [slots, setSlots] = useState(ALL_TIMES);
  const [duration, setDuration] = useState(45);
  const [recurrence, setRecurrence] = useState("once");
  /* A real day: several behind you and unlogged, several still ahead. */
  /* A full day, so the folds carry a realistic load. */
  /* Fifty ahead across the fortnight, split evenly between group and
     private, so the diary and the folds carry a real load. */
  const AHEAD = Array.from({ length: 50 }, (_, i) => {
    const grp = i % 2 === 0;
    const hour = 7 + (i % 11);
    return {
      time: `${hour > 12 ? hour - 12 : hour}:${i % 2 ? "30" : "00"} ${hour < 12 ? "am" : "pm"}`,
      who: grp ? ["Summer clinic", "Junior squad", "Ladies group", "Sunday scramble", "Winter league"][i % 5]
               : ROSTER[i % ROSTER.length].name,
      kind: grp ? `Group · ${4 + (i % 6)}` : "Private",
      dayOffset: Math.floor(i / 4),
      hoursUntil: 2 + i * 0.7,
    };
  });

  /* Ten standing weekly slots. */
  const RECURRING = Array.from({ length: 10 }, (_, i) => ({
    who: ROSTER[i % ROSTER.length].name,
    day: DAY_NAMES[(i * 2) % 7],
    time: `${9 + (i % 8)}:00 ${9 + (i % 8) < 12 ? "am" : "pm"}`,
    every: i % 3 === 0 ? "Fortnightly" : "Weekly",
  }));

  const rawSchedule = [
    { time: "7:30 am",  who: "Dan Okafor",     kind: "Private",   done: true, hoursUntil: -3.7 },
    { time: "8:30 am",  who: "Sofia Reyes",    kind: "Private",   done: true, hoursUntil: -2.7 },
    { time: "9:30 am",  who: "Tom Beckett",    kind: "Private",   done: true, hoursUntil: -1.7 },
    { time: "11:00 am", who: "Marcus Tran",    kind: "Private",   done: true, hoursUntil: -0.2 },
    { time: "2:00 pm",  who: "Summer clinic",  kind: "Group · 9", hoursUntil: 2.5 },
    { time: "3:00 pm",  who: "Priya Ellis",    kind: "Private",   hoursUntil: 3.5 },
    { time: "4:00 pm",  who: "Junior squad",   kind: "Group · 6", hoursUntil: 4.5 },
    { time: "5:30 pm",  who: "Hannah Doyle",   kind: "Private",   hoursUntil: 6 },
    { time: "6:30 pm",  who: "Eoin Breathnach", kind: "Private",  hoursUntil: 7 },
  ];
  /* What is genuinely still outstanding — the seed says what a fresh
     day looks like, this session's own log actions say what's actually
     left, and the two are combined every time either is read. */
  const TODAY_SCHEDULE = rawSchedule.map((l) => loggedKeys.has(lessonKey(l)) ? { ...l, done: false } : l);
  const liveNow = (TODAY_SCHEDULE || []).find((l) => !l.done && (l.hoursUntil ?? 9) <= 0.5) || null;

  const [toolRows, setToolRows] = useState(Object.fromEntries(Object.entries(TOOLS).map(([k, v]) => [k, v.rows])));
  const [waitlist, setWaitlist] = useState([
    { name: "Niamh Cronin", wants: "Weekday evenings", when: "3d ago", match: "Wed 29 Jul, 5:30 pm" },
    { name: "Eoin Hayes",   wants: "Saturday mornings", when: "1w ago" },
  ]);
  const [pushOn, setPushOn] = useState(false);
  const [firstRun, setFirstRun] = useState(true);
  const [annotations, setAnnotations] = useState({});
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [playerNotes, setPlayerNotes] = useState({ "Marcus Tran": "Prefers video over verbal. Club champs in September." });
  const [mini, setMini] = useState(null);

  const [profiles, setProfiles] = useState([{ id: 1, name: "Marcus Tran", age: null }]);
  const [activeProfileId, setActiveProfileId] = useState(1);
  const clubName = "";   /* only ever what the account carries */
  const inviteCode = data ? data.inviteCode : FAMILY_CODE;
  const [conns, setConns] = useState([
    { id: 1, profileId: 1, sport: "golf", coach: "Ray Doyle", club: "", seeded: true },
  ]);
  const [activeId, setActiveId] = useState(1);

  const [avail, setAvail] = useState(DEFAULT_AVAIL);
  const [blocked, setBlocked] = useState(Object.fromEntries(Object.keys(SPORTS).map((id) => [id, []])));
  const [seedBooked, setSeedBooked] = useState(account ? Object.fromEntries(Object.keys(SPORTS).map((id) => [id, {}])) : SEED_BOOKINGS);
  const [bookings, setBookings] = useState([{ m: 7, d: 31, time: "4:30 pm", connId: 1 }]);
  const [groups, setGroups] = useState({
    ...Object.fromEntries(Object.keys(SPORTS).map((id) => [id, []])),
    golf: [{ id: 1, name: "Summer clinic", members: ["Marcus Tran","Priya Ellis","Dan Okafor","Sofia Reyes","Tom Beckett"], day: 5, time: "2:00 pm", weeks: 6 }],
    tennis: [{ id: 2, name: "Junior squad", members: ["Ellie Tran"], day: 4, time: "4:30 pm", weeks: 8 }],
  });

  const [practice, setPractice] = useState({
    "1:golf":   SPORTS.golf.drills.slice(0, 3).map((d, i) => ({ id: `g${i}`, t: d.t, d: d.d, done: i === 0 })),
    "2:tennis": SPORTS.tennis.drills.slice(0, 3).map((d, i) => ({ id: `e${i}`, t: d.t, d: d.d, done: i === 0 })),
  });
  const [tips, setTips] = useState({
    "1:golf": [
      { id: 2, title: "Trust the shallow", body: "The shaft is getting shallower at the top — keep trusting it rather than steepening back up to save a shot.", focus: "Short game", date: "14 Jun", weeksAgo: 5 },
      { id: 1, title: "Tempo over speed", body: "You're at your best with a slower backswing. Chasing extra yards is costing more than it gives.", focus: "Driving", date: "31 May", weeksAgo: 9 },
    ],
    "2:tennis": [{ id: 1, title: "First serve percentage", body: "Sixty per cent of first serves in beats four aces and eight faults. Take a little off it.", focus: "Serve", date: "14 Jun", weeksAgo: 2 }],
    "1:tennis": [{ id: 1, title: "First serve percentage", body: "Sixty per cent of first serves in beats four aces and eight faults. Take a little off it.", focus: "Serve", date: "14 Jun", weeksAgo: 2 }],
    "1:rowing": [{ id: 1, title: "Ratio, not rate", body: "You're rushing the slide at anything above 22. Let the boat run — one count down, two counts back.", focus: "Rhythm", date: "14 Jun", weeksAgo: 1 }],
    "1:squash": [{ id: 1, title: "Take the T back every time", body: "You're winning the rally then standing still. Straight back to the T after every shot, no exceptions.", focus: "Movement", date: "14 Jun", weeksAgo: 3 }],
    "1:padel": [{ id: 1, title: "Bandeja, don't smash", body: "When the lob goes over your head, bandeja and hold the net. The smash is losing you the position.", focus: "Net play", date: "14 Jun", weeksAgo: 1 }],
    "1:equestrian": [{ id: 1, title: "Ride the corners", body: "You're cutting the corner before the short side, so she falls in. Use the whole arena and she'll straighten herself.", focus: "Flatwork", date: "14 Jun", weeksAgo: 2 }],
  });
  const [selectedStats, setSelectedStats] = useState({});
  const [manualStats, setManualStats] = useState({});
  const [saved, setSaved] = useState({});
  const [swatch, setSwatch] = useState(SWATCHES[0]);
  const [brandName, setBrandName] = useState(clubName);
  const [library, setLibrary] = useState(Object.fromEntries(Object.entries(SPORTS).map(([id, cf]) => [id, cf.drills])));

  const roster = data ? data.roster : freshAccount ? [] : ROSTER;
  const mySeries = data ? data.recurring : freshAccount ? [] : series.filter((x) => x.sport === coachSport);

  /* Saving an arrangement books every slot out on the calendar. */
  const saveSeries = (v) => {
    const existing = series.find((x) => x.who === v.who && x.sport === coachSport);
    const id = existing ? existing.id : Date.now();
    const rec = { id, sport: coachSport, used: existing?.used || 0, ...v };
    setSeries((list) => (existing ? list.map((x) => (x.id === id ? rec : x)) : [...list, rec]));
    const occ = seriesOccurrences(v.day, v.total, v.freq);
    setSeedBooked((prev) => {
      const next = { ...prev, [coachSport]: { ...prev[coachSport] } };
      occ.forEach(({ m, d }) => {
        const k = key(m, d);
        const day = (next[coachSport][k] || []).filter((b) => !(b.who === v.who && b.seriesId === id));
        next[coachSport][k] = [...day, { time: v.time, who: v.who, kind: "Private", seriesId: id }];
      });
      return next;
    });
    hapticSuccess(); chime();
    say(`${v.total} lessons booked for ${v.who.split(" ")[0]}`);
  };

  const endSeries = (rec) => {
    setSeries((list) => list.filter((x) => x.id !== rec.id));
    setSeedBooked((prev) => {
      const next = { ...prev, [coachSport]: {} };
      Object.entries(prev[coachSport]).forEach(([k, day]) => {
        const kept = day.filter((b) => b.seriesId !== rec.id);
        if (kept.length) next[coachSport][k] = kept;
      });
      return next;
    });
    say(`${rec.who.split(" ")[0]}'s arrangement ended`);
  };

  /* Weather off: the lesson isn't lost, it's pushed to the end of the
     series at the same time, and both sides are told. */
  const weatherCancel = (m, d, booking) => {
    const rec = series.find((x) => x.id === booking.seriesId);
    setSeedBooked((prev) => {
      const next = { ...prev, [coachSport]: { ...prev[coachSport] } };
      const k = key(m, d);
      next[coachSport][k] = (next[coachSport][k] || []).filter((b) => b !== booking);
      if (!next[coachSport][k].length) delete next[coachSport][k];
      if (rec) {
        /* find the slot after the current last one in the series */
        const all = Object.entries(next[coachSport]).flatMap(([kk, day]) =>
          day.filter((b) => b.seriesId === rec.id).map(() => ({ m: Number(kk.split("-")[0]), d: Number(kk.split("-")[1]) })));
        const lastOne = all.sort((a, b) => a.m - b.m || a.d - b.d).pop() || { m, d };
        const extra = seriesOccurrences(rec.day, 1, rec.freq, lastOne.m, lastOne.d)[0];
        if (extra) {
          const ek = key(extra.m, extra.d);
          next[coachSport][ek] = [...(next[coachSport][ek] || []), { time: rec.time, who: rec.who, kind: "Private", seriesId: rec.id, addedBack: true }];
        }
      }
      return next;
    });
    hapticWarn(); decline();
    say(rec ? `Called off — added back at the end, ${booking.who.split(" ")[0]} notified` : `Called off — ${booking.who.split(" ")[0]} notified`);
  };
  const openRequests = freshAccount ? [] : requests;
  const openUnlogged = freshAccount ? [] : unlogged;
  const openWaitlist = freshAccount ? [] : waitlist;
  const addGoal = (who, text, by) => setGoals((g) => ({ ...g, [who]: [...(g[who] || []), { id: Date.now(), t: text, by, done: false }] }));
  const toggleGoal = (who, id) => setGoals((g) => ({ ...g, [who]: (g[who] || []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  const acceptRequest = (r) => { setRequests((v) => v.filter((x) => x.name !== r.name)); setAccepted((v) => [...v, r.name]); hapticSuccess(); chime(); say(`${r.name.split(" ")[0]} added to your roster`); };
  const declineRequest = (r) => { setRequests((v) => v.filter((x) => x.name !== r.name)); hapticWarn(); decline(); say("Request declined"); };
  const markAttendance = (who, status) => { setAttendance((a) => ({ ...a, [who]: { ...(a[who] || { showed: 0, late: 0, noShow: 0, cancelled: 0 }), [status]: ((a[who] || {})[status] || 0) + 1 } })); hapticSuccess(); };
  const L = STRINGS[lang] || STRINGS.en;
  /* Synchronous on purpose: an effect runs after the first paint, so
     the calendar would flash English before correcting itself. */
  setLangGlobal(lang);
  const activeProfile = account
    ? { id: account.id, name: account.name, age: null }
    : (profiles.find((p) => p.id === activeProfileId) || profiles[0]);
  /* what the coach marked for this player, if a register was taken */
  /* the player's own percentage, for the line on their day */
  const attendPct = (() => {
    const me = activeProfile?.name;
    let seen = 0, here = 0;
    Object.keys(registers || {}).forEach((k) => {
      const v = registers[k][me];
      if (!v) return;
      seen++; if (v === "in") here++;
    });
    return seen ? Math.round((here / seen) * 100) : null;
  })();
  const myAttendance = (() => {
    const me = activeProfile?.name;
    for (const k of Object.keys(registers || {})) { const v = registers[k][me]; if (v) return v; }
    return null;
  })();
  const conn = account
    ? (role === "player"
        ? { id: 1, profileId: account.id, sport: account.sport,
            coach: (data && data.coachName) || "Your coach", club: "", seeded: false }
        : null)
    : (conns.find((c) => c.id === activeId && c.profileId === activeProfileId) || conns.find((c) => c.profileId === activeProfileId));
  const inApp = flow === "app";
  const sport = account ? account.sport : role === "coach" ? coachSport : (conn?.sport || "golf");
  const cfg = SPORTS[sport];
  const archive = freshAccount ? [] : buildArchive(cfg);
  const base = inApp ? cfg.theme : NEUTRAL;
  const tinted = inApp && swatch.accent ? { ...base, accent: swatch.accent, onAccent: swatch.onAccent } : base;
  const theme = dark && inApp ? darkify(tinted) : tinted;
  const screen = stack[stack.length - 1];
  const coachName = account
    ? (role === "coach" ? account.name : (data && data.coachName) || "Your coach")
    : role === "coach" ? (coachSport === "tennis" ? "Luca Ferri" : "Ray Doyle") : (activeProfile?.name || "Marcus Tran");

  const pKey = `${activeProfileId}:${sport}`;
  const myPractice = data ? data.drills.filter((d) => !account || d.playerId === account.id || role === "coach") : freshAccount ? [] : (practice[pKey] || []);
  const myTips = data ? data.tips : freshAccount ? [] : (tips[pKey] || []);
  const myTip = myTips[0] || null;
  const mySelected = selectedStats[pKey] || cfg.defaultStats;
  const myManual = manualStats[pKey] || {};
  const mySaved = saved[pKey] || [];
  const myBookings = bookings.filter((b) => b.connId === conn?.id);
  const myAvail = avail[coachSport]; const myBlocked = blocked[coachSport];
  const mySeedBooked = data ? data.bookings : seedBooked[coachSport];
  const myGroups = data ? [] : freshAccount ? [] : (groups[coachSport] || []);
  const myLibrary = library[coachSport] || [];

  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 1900); };
  const push = (s) => { haptic(6); setStack((k) => [...k, s]); };
  const pop = () => setStack((k) => (k.length > 1 ? k.slice(0, -1) : k));
  const go = (s) => { haptic(6); setStack([s]); };
  const enter = (r) => { setRole(r); setFlow("app"); setStack([r === "coach" ? "today" : "home"]); haptic(16); };
  const jump = (r) => { setRole(r); setFlow("app"); setStack([r === "coach" ? "today" : "home"]); };

  /* Preview switcher: each persona needs its own data shape, not just a
     different role flag, or the views don't represent anything real. */
  const viewAs = (kind) => {
    haptic(10); setFlow("app"); setFamilyGuide(false); setPublished(null);
    if (kind === "coach") { setJuvenile(false); setRole("coach"); setStack(["today"]); return; }
    if (kind === "player") {
      setJuvenile(false); setRole("player");
      setProfiles([{ id: 1, name: "Marcus Tran", age: null }]);
      setConns([{ id: 1, profileId: 1, sport: coachSport, coach: COACHES[coachSport][0].name, club: COACHES[coachSport][0].club, seeded: true }]);
      setActiveProfileId(1); setActiveId(1); setStack(["home"]); return;
    }
    if (kind === "parent") {
      setJuvenile(false); setRole("player");
      setProfiles([{ id: 1, name: "Marcus Tran", age: null },
                   { id: 2, name: "Ellie Tran", age: 14, turns18: "March 2030" }]);
      setConns([{ id: 1, profileId: 1, sport: "golf", coach: COACHES.golf[0].name, club: COACHES.golf[0].club, seeded: true },
                { id: 2, profileId: 2, sport: "tennis", coach: COACHES.tennis[0].name, club: COACHES.tennis[0].club, seeded: true }]);
      setCoachSport("golf"); setActiveProfileId(1); setActiveId(1); setStack(["home"]); return;
    }
    // juvenile
    setJuvenile(true); setRole("player"); setCoachSport("tennis");
    setProfiles([{ id: 2, name: "Ellie Tran", age: 14, turns18: "March 2030" }]);
    setConns([{ id: 2, profileId: 2, sport: "tennis", coach: COACHES.tennis[0].name, club: COACHES.tennis[0].club, seeded: true }]);
    setActiveProfileId(2); setActiveId(2); setStack(["home"]);
  };
  const restart = () => {
    /* With a real account this must end the actual session, not just
       reset the demo's own state — otherwise there is no way back to
       the sign-in screen, because Supabase remembers you. */
    if (account && onSignOut) { onSignOut(); return; }
    setFlow("role"); setPublished(null); setStack(["today"]); setMini(null); setJuvenile(false);
  };
  /* Publishing is the end of the flow. The burst plays over whatever
     is on screen, then drops the coach back on Today with the lesson
     counted. There is no separate screen to land on. */
  const publish = async (l) => {
    const lesson = { ...l, when: "just now" };
    setLogged((n) => n + 1);
    if (prefill) setLoggedKeys((k) => new Set(k).add(lessonKey(prefill)));
    if (offline) {
      setQueued((q) => q + 1);
      setBurst(lesson);
      return;
    }
    setBurst(lesson);

    /* With a real account this is written to the database, so the
       player it belongs to sees it on their own device. Without one
       (the design harness) nothing is persisted, exactly as before. */
    if (data && account) {
      const isGroup = l.type === "group";
      const named = Array.isArray(l.who) ? l.who[0] : l.who;
      const match = (data.roster || []).find((r) => r.name === named);
      /* The lesson was actually logged for whichever day the coach
         picked in the wizard's own date step — not necessarily today. */
      const year = new Date().getFullYear();
      const lessonDate = l.m && l.d
        ? `${year}-${String(l.m).padStart(2, "0")}-${String(l.d).padStart(2, "0")}`
        : undefined;
      await data.logLesson({
        playerId: isGroup ? null : match?.id,
        groupName: isGroup ? (l.groupName || named) : null,
        focus: l.focus || (l.focusList || []).join(" · ") || "Lesson",
        subs: l.subs || [],
        note: l.note,
        files: (l.videos || []).map((v) => v.file).filter(Boolean),
        date: lessonDate,
      });
      /* anything the coach set alongside the lesson */
      for (const d of l.nextDrills || []) {
        if (match?.id) await data.setDrill(match.id, typeof d === "string" ? d : d.t);
      }
      if (l.nextTip && match?.id) await data.setTip(match.id, l.nextTip, null);
    }
  };

  /* Turns the "who's playing" answers into real profiles and links the
     coach to whichever profile is actually taking the lessons. */
  const finishPlayerSetup = (mode, kids) => {
    const coachInfo = signupCoach || COACHES[signupSport][0];
    const me = { id: 1, name: signupName || "Marcus Tran", age: null };
    const childProfiles = (kids || []).map((k, i) => ({ id: 100 + i, name: k.name.trim(), age: Number(k.age) }));
    const all = mode === "me" ? [me] : [me, ...childProfiles];
    const learner = mode === "child" && childProfiles.length ? childProfiles[0].id : 1;
    const landOnFamily = childProfiles.length > 0;
    setProfiles(all);
    setConns([{ id: 1, profileId: learner, sport: signupSport, coach: coachInfo.name, club: coachInfo.club, seeded: true }]);
    setActiveProfileId(learner);
    setActiveId(1);
    setRole("player"); setFlow("app"); setStack([landOnFamily ? "family" : "home"]); haptic(16);
  };

  const book = (b) => { setBookings((x) => [...x.filter((y) => !(y.m === b.m && y.d === b.d && y.connId === conn?.id)), { ...b, connId: conn?.id }]); haptic(18); say("Booked"); };
  const cancel = (b) => { setBookings((x) => x.filter((y) => !(y.m === b.m && y.d === b.d && y.connId === conn?.id))); haptic(10); say("Cancelled"); };
  const nextBooking = [...myBookings].sort((a, b) => a.m - b.m || a.d - b.d)[0];

  const switchProfile = (id) => {
    setActiveProfileId(id);
    const theirs = conns.filter((c) => c.profileId === id);
    if (theirs.length) setActiveId(theirs[0].id);
    go("home"); haptic(10);
  };
  const addChild = (name, age, sportId, coachInfo, turns18) => {
    const id = Date.now();
    setProfiles((p) => [...p, { id, name, age: Number(age) || null, turns18 }]);
    if (sportId && coachInfo) {
      const cid = id + 1;
      setConns((c) => [...c, { id: cid, profileId: id, sport: sportId, coach: coachInfo.name, club: coachInfo.club, seeded: true }]);
      setActiveId(cid);
    }
    setActiveProfileId(id);
    setStack(["family"]);
    say(`${(name || "").split(" ")[0]} added`);
    haptic(20); chime();
  };
  const addConn = (sportId, coachInfo) => {
    const id = Date.now();
    setConns((c) => [...c, { id, profileId: activeProfileId, sport: sportId, coach: coachInfo.name, club: coachInfo.club, seeded: true }]);
    setActiveId(id); go("home"); say(`${coachInfo.name.split(" ")[0]} added`); haptic(18);
  };

  const openAssignDrills = (name, focusId) => { setAssignTo(name); setAssignFocus(focusId); setSheet("assign"); haptic(8); };
  const saveDrill = (d) => {
    setLibrary((l) => {
      const cur = l[coachSport] || [];
      if (cur.some((x) => x.t.toLowerCase() === d.t.toLowerCase())) return l;
      return { ...l, [coachSport]: [d, ...cur] };
    });
    /* With a real account this belongs to the coach, not just the
       current session — stored per sport, alongside their other
       preferences, so it's there again next time they sign in. */
    if (data && account) {
      const existing = (data.prefs?.custom_drills?.[coachSport]) || [];
      if (!existing.some((x) => x.t.toLowerCase() === d.t.toLowerCase())) {
        data.savePrefs({
          custom_drills: { ...(data.prefs?.custom_drills || {}), [coachSport]: [d, ...existing] },
        });
      }
    }
  };
  const bumpUses = (names) => setLibrary((l) => ({
    ...l, [coachSport]: (l[coachSport] || []).map((d) => (names.includes(d.t) ? { ...d, uses: (d.uses || 0) + 1 } : d)),
  }));
  const doAssignDrills = (name, drills) => {
    bumpUses(drills.map((d) => d.t));
    if (name === "Marcus Tran" && coachSport === "golf") setPractice((p) => ({ ...p, "1:golf": drills.map((d, i) => ({ id: `golf-${Date.now()}-${i}`, t: d.t, d: d.d, done: false })) }));
    say(`${drills.length} drill${drills.length > 1 ? "s" : ""} set for ${(name || "").split(" ")[0]}`); haptic(18);
  };
  const openAssignTip = (name, focusLabel) => { setAssignTo(name); setAssignFocus(focusLabel); setSheet("tip"); haptic(8); };
  const doSetTip = (tip) => {
    if (assignTo === "Marcus Tran" && coachSport === "golf") {
      setTips((p) => ({ ...p, "1:golf": [{ id: Date.now(), title: tip.title, body: tip.body, focus: assignFocus || "General", date: "Today", weeksAgo: 0 }, ...(p["1:golf"] || [])] }));
    }
    chime(); say(`Tip sent to ${assignTo?.split(" ")[0]}`); haptic(18);
  };
  const addDrill = (d) => setLibrary((l) => ({ ...l, [coachSport]: [d, ...l[coachSport]] }));

  const toggleSave = (id) => setSaved((s) => {
    const cur = s[pKey] || []; const has = cur.includes(id); haptic(has ? 8 : 16); say(has ? "Removed from downloads" : "Saved for offline");
    return { ...s, [pKey]: has ? cur.filter((x) => x !== id) : [...cur, id] };
  });
  const togglePractice = (id) => {
    if (data) {                                   // real account: persist it
      const cur = (data.drills || []).find((d) => d.id === id);
      if (cur) data.tickDrill(id, !cur.done);
      return;
    }
    setPractice((p) => ({ ...p, [pKey]: (p[pKey] || []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
  };

  const swapSport = (s) => {
    haptic(10);
    if (role === "coach") { setCoachSport(s); setPublished(null); go("today"); return; }
    const match = conns.find((c) => c.profileId === activeProfileId && c.sport === s);
    if (match) { setActiveId(match.id); go("home"); return; }
    const coachInfo = COACHES[s][0]; const id = Date.now();
    setConns((c) => [...c, { id, profileId: activeProfileId, sport: s, coach: coachInfo.name, club: coachInfo.club, seeded: true }]);
    setActiveId(id); go("home"); say(`Connected with ${coachInfo.name}`);
  };

  const createGroup = (g) => {
    const id = Date.now();
    setGroups((prev) => ({ ...prev, [coachSport]: [...(prev[coachSport] || []), { id, ...g }] }));
    const occ = nextOccurrences(g.day, g.weeks);
    setSeedBooked((prev) => {
      const next = { ...prev, [coachSport]: { ...prev[coachSport] } };
      occ.forEach(({ m, d }) => { const k = key(m, d); next[coachSport][k] = [...(next[coachSport][k] || []), { time: g.time, who: g.name, kind: `Group · ${g.members.length}`, group: true }]; });
      return next;
    });
    if (g.members.includes("Marcus Tran") && coachSport === conns.find((c) => c.id === 1)?.sport) {
      setBookings((b) => [...b, ...occ.map(({ m, d }) => ({ m, d, time: g.time, connId: 1 }))]);
    }
    say(`${g.name} created · ${occ.length} lessons scheduled`); haptic(20);
  };

  const playerLessons = (() => {
    if (data) return data.lessons;      // real, from the database
    if (!conn || freshAccount) return [];
    const seed = conn.seeded ? SPORTS[conn.sport].lessons : [];
    if (published && role === "player") return [{ id: 999, focus: published.focus, subs: published.subs, d: "24", m: "JUL", type: published.type === "group" ? "Group" : "Private", videos: published.videos.length, unread: true }, ...seed];
    return seed;
  })();

  const unread = data ? 0 : freshAccount ? 0 : THREADS[role].reduce((n, c) => n + c.unread, 0);
  const waiting = freshAccount || role !== "coach" ? 0
    : openRequests.length + checkIns.filter((x) => x.state === "waiting").length
      + atRisk(roster, series).length + focusReqs.length;
  const alerts = (freshAccount ? 0 : NOTIFS[role].filter((n) => n.fresh).length) + waiting;
  const navRight = (<>{role === "player" && !juvenile && <FamilyPill name={activeProfile.name} tint={avatars[activeProfileId]} onOpen={() => setSheet("family")} />}<IconBtn C={Search} label={tr("Search")} onOpen={() => { hapticCommit(); setSheet("cmd"); }} /><IconBtn C={Bell} label={tr("Alerts")} count={alerts} onOpen={() => push("alerts")} /><YouAvatarBtn name={coachName} onOpen={() => push("you")} /></>);
  const slimRight = (<>{role === "player" && !juvenile && <FamilyPill name={activeProfile.name} tint={avatars[activeProfileId]} onOpen={() => setSheet("family")} />}
    <IconBtn C={Search} label={L.search} onOpen={() => push("search")} />
    {role === "coach" && <IconBtn C={Bell} label={L.alerts} count={alerts} onOpen={() => push("alerts")} />}
    <YouAvatarBtn name={coachName} onOpen={() => push("you")} />
  </>);
  const juvRight = (<><IconBtn C={Search} label={L.search} onOpen={() => push("search")} /><YouAvatarBtn name={coachName} onOpen={() => push("you")} /></>);

  /* One row per person the account manages, with their next session. */
  const familyCalendar = (role === "player" && profiles.filter((pf) => pf.age).length > 0)
    ? profiles.map((pf) => {
        const c = conns.find((x) => x.profileId === pf.id);
        const next = bookings.filter((b) => b.connId === c?.id).sort((a, b) => a.m - b.m || a.d - b.d)[0];
        return { id: pf.id, name: pf.name, coach: c?.coach || "No coach", sport: c?.sport || "golf", next };
      })
    : null;
  /* Groups the active profile is actually a member of. */
  const myGroupsForMe = data ? [] : freshAccount ? [] : (groups[sport] || []).filter((g) =>
    g.members.includes(activeProfile?.name) || g.members.includes("Marcus Tran"));
  /* Suggests the next slot matching the time of day they usually book —
     a small thing, but it removes most of the scanning. */
  const aiPick = (() => {
    if (role !== "player" || freshAccount) return null;
    const soonest = earliestSlot(myAvail, myBlocked, myBookings, mySeedBooked);
    if (!soonest) return null;
    return { ...soonest, reason: `${DAY_NAMES[dowOf(soonest.m, soonest.d)].slice(0, 3)} ${soonest.d} at ${soonest.time} — like your usual` };
  })();
  const practiceTodo = myPractice.filter((x) => !x.done).length;
  const hasFamily = profiles.some((pf) => pf.age);
  /* Safeguarding: messaging is withheld for anyone under 18, whether
     they signed in themselves or a parent switched to them. */
  const viewingChild = !!(activeProfile && activeProfile.age);
  const noChat = juvenile || viewingChild;
  const tabs = role === "coach"
    ? [{ id: "today", icon: Home, label: tr("Today") }, { id: "calendar", icon: CalendarDays, label: tr("Diary") }, { id: "quick", icon: Plus, raised: true }, { id: "roster", icon: Users, label: tr("Roster") }, ...(noChat ? [] : [{ id: "messages", icon: MessageCircle, label: tr("Chat"), count: unread }])]
    : juvenile
      /* No messaging for an under-18 account. Deliberate: a child's
         contact with an adult coach runs through their parent. */
      ? [{ id: "home", icon: Home, label: tr("Home") }, { id: "log", icon: Library, label: tr("Lessons") }, { id: "practice", icon: ListChecks, label: tr("Drills"), count: practiceTodo }, { id: "calendar", icon: CalendarDays, label: tr("Diary") }]
    : hasFamily
      /* Family stands in for Home — a parent's home IS the family view —
         so Lessons keeps its place rather than being pushed out. */
      /* A parent has their own coaching as well as their children's, so
         Home stays and Family sits beside it. Lessons folds into Home,
         which already carries the link to every past lesson. */
      /* Identical to a player's tabs — a parent has their own coaching
         and needs their own log. Family lives on the profile pill, which
         is already where you switch between people. */
      ? [{ id: "home", icon: Home, label: tr("Home") }, { id: "log", icon: Library, label: tr("Lessons") }, { id: "practice", icon: ListChecks, label: tr("Drills"), count: practiceTodo }, { id: "calendar", icon: CalendarDays, label: tr("Diary") }, ...(noChat ? [] : [{ id: "messages", icon: MessageCircle, label: tr("Chat"), count: unread }])]
      : [{ id: "home", icon: Home, label: tr("Home") }, { id: "log", icon: Library, label: tr("Lessons") }, { id: "practice", icon: ListChecks, label: tr("Drills"), count: practiceTodo }, { id: "calendar", icon: CalendarDays, label: tr("Diary") }, ...(noChat ? [] : [{ id: "messages", icon: MessageCircle, label: tr("Chat"), count: unread }])];

  const pushedScreens = ["you", "details", "notifications", "support", "subscription", "availability", "branding", "library", "search", "alerts", "tips", "stats", "language", "requests", "unlogged", "tool", "groups", "archive", "region", "season", "events", "credentials", "reviews", "recurring", "sources", "atrisk", "digest", "checkins", "lesson", "prefs", "attendance", "coachProfile"].concat(Object.keys(LEGAL).map((k) => "legal:" + k));

  /* the feed runs edge to edge, under the status bar */
  const bleed = inApp && screen === "log" && prefs.logView === "feed" && role !== "coach";
  let body, bare = !inApp;
  if (!inApp) {
    body = {
      region:  <PickRegion region={region} setRegion={setRegion} lang={lang} setLang={setLang} path={signupPath} onDone={() => setFlow("sport")} />,
      sport:   <PickSport lang={lang} path={signupPath} onBack={() => setFlow("role")} onPick={(s) => { setSignupSport(s); setCoachSport(s); setFlow("role"); }} />,
      role:    <PickRole sport={signupSport} lang={lang} path={signupPath} onBack={() => setFlow("role")}
                         onPick={(r) => { if (r === "coach") { setSignupRole("coach"); setRole("coach"); setFlow("account"); }
                                          else { setSignupRole("player"); setRole("player"); setFlow("account"); } }} />,
      juvenile: <JuvenileJoin sport={signupSport} onBack={() => setFlow("role")}
                              onDone={(childName) => { setSignupName(childName); setJuvenile(true); setRole("player");
                                setProfiles([{ id: 1, name: childName, age: 14 }]);
                                setConns([{ id: 1, profileId: 1, sport: signupSport, coach: COACHES[signupSport][0].name, club: COACHES[signupSport][0].club, seeded: true }]);
                                setActiveProfileId(1); setActiveId(1); setFamilyGuide(true); setFlow("app"); setStack(["home"]); hapticSuccess(); chime(); }} />,
      account: <CreateAccount role={signupRole} lang={lang} step={3} onBack={() => setFlow("role")}
                              onDone={(d) => { setSignupName(d.name); setFlow(signupRole === "coach" ? "club" : "connect"); }} />,
      club:    <CoachClub sport={signupSport} onBack={() => setFlow("account")}
                          onDone={(c) => { setBrandName(c); setFlow("plan"); }} />,
      plan:    <CoachPlan onBack={() => setFlow("club")} onDone={(p) => { setPlan(p); setFlow("code"); }} />,
      setup:   <CoachSetup cfg={SPORTS[signupSport]} sport={signupSport} lang={lang} slots={slots}
                            onDone={(cfgOut) => { setSelectedStats((v) => ({ ...v, [`1:${signupSport}`]: cfgOut.stats }));
                              setLibrary((l) => ({ ...l, [signupSport]: cfgOut.drills.map((n) => ({ t: n, d: "", focus: SPORTS[signupSport].focus[0].id, uses: 0 })) }));
                              setAvail((a) => ({ ...a, [signupSport]: Object.fromEntries(DAY_NAMES.map((_, i) => [i, cfgOut.days.includes(i) ? cfgOut.times : []])) }));
                              setDuration(cfgOut.dur); setFlow("app"); setStack(["today"]); hapticSuccess(); chime(); }} />,
      code:    <CoachCode sport={signupSport} club={brandName} plan={plan} onBack={() => setFlow("plan")} onDone={() => { setRole("coach"); setFlow("setup"); }} />,
      connect: <ConnectPlayer sport={signupSport} onBack={() => setFlow("account")}
                              onDone={(c) => { setSignupCoach(c);
                                /* One profile, straight in. Children are added
                                   later from Family, where it belongs. */
                                /* One profile, or a parent with a child, exactly as they said. */
                                const me = { id: 1, name: signupName || "Marcus Tran", age: null };
                                const kid = { id: 2, name: tr("Your child"), age: 12, turns18: "2032" };
                                setProfiles(playFor === "child" ? [kid] : playFor === "both" ? [me, kid] : [me]);
                                setConns([{ id: 1, profileId: 1, sport: signupSport, coach: c.name, club: c.club, seeded: true }]);
                                setActiveProfileId(1); setActiveId(1); setCoachSport(signupSport);
                                setRole("player"); setFlow("app"); setStack(["home"]); hapticSuccess(); chime(); }} />,
    }[flow];
  } else if (juvenile && (screen === "messages" || screen.startsWith("thread:"))) {
    body = (
      <Screen title={tr("Messages")} right={slimRight}>
        <div className="px-6">
          <div className="py-12 text-center">
            <span className="rounded-full flex items-center justify-center mx-auto mb-5" style={{ width: 54, height: 54, background: theme.wash }}>
              <ShieldCheck size={22} color={theme.sub} strokeWidth={1.6} />
            </span>
            <p style={{ fontFamily: display, fontSize: 20, letterSpacing: "-0.02em", color: theme.ink }}>{tr("Handled by your parent")}</p>
            <p className="mt-2.5" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.55, color: theme.sub }}>
              Messages between you and your coach go through whoever manages your account.
            </p>
          </div>
        </div>
      </Screen>
    );
  } else if (screen.startsWith("thread:")) {
    const threadName = screen.split(":")[1];
    const isGroupThread = Object.values(groups).flat().some((g) => g.name === threadName);
    body = <Thread role={role} name={threadName} isGroup={isGroupThread} lang={lang} pop={pop} say={say} />;
  } else if (screen.startsWith("legal:")) { body = <Legal docKey={screen.split(":")[1]} pop={pop} />;
  } else if (screen.startsWith("player:")) {
    const pname = screen.split(":")[1];
    body = <RosterPlayer name={pname} live={data ? data.roster : null} sportTool={TOOLS[sport]} seriesFor={series.find((x) => x.who === pname && x.sport === coachSport)} onRecurring={(n) => { setRecurFor(n); setSheet("recurring"); }} note={playerNotes[pname] || ""} setNote={(v) => setPlayerNotes((p) => ({ ...p, [pname]: v }))}
                        pop={pop} push={push} say={say} assignDrills={openAssignDrills} assignTip={openAssignTip} />;
  } else if (screen === "search") { body = <SearchScreen role={role} cfg={cfg} library={myLibrary} tips={myTips} pop={pop} go={go} push={push} />;
  } else if (screen === "alerts") {
    const isParent = role !== "coach" && profiles.some((pf) => pf.age);
    /* Coach: everything blocking someone else's week. */
    const jobs = role !== "coach" || freshAccount ? [] : [
      openRequests.length && { id: "j1", what: tr("asking to join"), count: openRequests.length, tone: CAUTION, go: () => push("requests") },
      checkIns.filter((x) => x.state === "waiting").length && { id: "j2", what: tr("clips to look at"), count: checkIns.filter((x) => x.state === "waiting").length, tone: CAUTION, go: () => push("checkins") },
      lessonReqs.length && { id: "j3", what: tr("lesson requests"), count: lessonReqs.length, tone: CAUTION, go: () => go("today") },
      atRisk(roster, series).length && { id: "j4", what: tr("drifting"), count: atRisk(roster, series).length, tone: DANGER, go: () => push("atrisk") },
      focusReqs.length && { id: "j5", what: tr("focus to agree"), count: focusReqs.length, tone: CAUTION, go: () => go("today") },
      (TODAY_SCHEDULE || []).filter((l) => l.done).length && { id: "j6", what: tr("lessons to log"), count: (TODAY_SCHEDULE || []).filter((l) => l.done).length, tone: DANGER, go: () => go("today") },
    ].filter(Boolean);

    /* Player or parent: what happened to them. */
    const mine = freshAccount || role === "coach" ? [] :
      (NOTIFS[role] || []).map((n, i) => ({ id: "m" + i, what: n.what || n.title, who: n.who, when: n.when,
        tone: n.kind === "weather" ? DANGER : n.kind === "tip" ? STEADY : null }));

    /* And, for a parent, the same again for the children — beneath a rule. */
    const family = !isParent || freshAccount ? [] : (BREATHNACH.alerts || []).map((n, i) =>
      ({ id: "f" + i, what: n.what, who: n.who, when: n.when,
         tone: n.kind === "weather" ? DANGER : n.kind === "tip" ? STEADY : n.kind === "comp" ? CAUTION : null }));

    body = <NotifCentre role={role} isParent={isParent} jobs={jobs} mine={mine} family={family}
                        pop={pop} push={push} go={go} empty={freshAccount} />;
  } else if (screen === "branding") { body = <Branding swatch={swatch} setSwatch={setSwatch} clubName={brandName} setClubName={setBrandName} nouns={cfg.nouns} pop={pop} say={say} />;
  } else if (screen === "library") { body = <DrillLibrary cfg={cfg} library={myLibrary} addDrill={saveDrill} removeDrill={(name) => setLibrary((l) => ({ ...l, [coachSport]: (l[coachSport] || []).filter((x) => x.t !== name) }))} pop={pop} assign={openAssignDrills} say={say} />;
  } else if (screen === "availability") { body = <Availability avail={myAvail} setAvail={(v) => setAvail((p) => ({ ...p, [coachSport]: v }))} slots={slots} setSlots={setSlots} duration={duration} setDuration={setDuration} pop={pop} say={say} />;
  } else if (screen === "roster") { body = <CoachRoster groups={myGroups} invited={invited} roster={roster} requests={openRequests} push={push} pop={pop} sheet={setSheet} say={say} right={slimRight} coachName={coachName} noun={cfg.noun} nouns={cfg.nouns} />;
  } else if (screen.startsWith("history:")) {
    const hname = screen.split(":")[1];
    body = <PlayerHistory name={hname} cfg={cfg} lessons={data ? data.lessons.filter((l) => l.who === hname) : null} attendance={attendance} goals={goals} onAddGoal={addGoal} onToggleGoal={toggleGoal} pop={pop} push={push} say={say} />;
  } else if (screen.startsWith("clesson:")) {
    const [, cname, lid] = screen.split(":");
    const les = cfg.lessons.find((x) => String(x.id) === lid) || cfg.lessons[0];
    body = <CoachLessonView name={cname} lesson={les} cfg={cfg} pop={pop} push={push} say={say} assignDrills={openAssignDrills} />;
  } else if (screen.startsWith("capture:")) {
    const who = screen.slice(8);
    body = <CaptureNow booking={{ who }} sport={sport} cfg={cfg} captured={captured} setCaptured={setCaptured} pop={pop} say={say} />;
  } else if (screen === "recurring") {
    body = <RecurringManager series={series} roster={roster} duration={duration}
             onEnd={(x) => { setSeries((v) => v.map((y) => (y === x ? { ...y, ended: true } : y)));
               setCeleb({ label: tr("Ended"), sub: x.who, tone: DANGER }); }}
             onExtend={(x, how) => { setSeries((v) => v.map((y) => (y === x ? { ...y, until: how === "open" ? null : "30 Sep" } : y)));
               say(how === "open" ? tr("Runs until you end it") : tr("Extended by a month")); }}
             onEdit={(x, patch) => setSeries((v) => v.map((y) => (y === x ? { ...y, ...patch } : y)))}
             onNew={() => setSheet("pickRecurWho")} pop={pop} say={say} />;
  } else if (screen === "atrisk") {
    body = <AtRisk list={atRisk(roster, series)} pop={pop}
             onMessage={(n) => push("thread:" + n)}
             onBook={(n) => { setRecurFor(n); push("calendar"); }} />;
  } else if (screen === "digest") {
    body = <ParentDigest profiles={profiles} cfg={cfg} pop={pop} />;
  } else if (screen === "checkins") {
    body = <CheckIns role={role} list={freshAccount ? [] : checkIns} pop={pop} say={say}
             onAnswer={(c) => { setCheckIns((v) => v.map((x) => (x === c ? { ...x, state: "answered", reply: tr("Looks better — keep the turn going through it.") } : x)));
               setCeleb({ label: tr("Sent"), sub: c.who }); }}
             onSend={() => { setCheckIns((v) => [{ id: Date.now(), who: (activeProfile || {}).name || "", when: tr("Just now"), note: "", state: "waiting", secs: 9 }, ...v]);
               setCeleb({ label: tr("Sent"), sub: tr("Your coach will look at it.") }); }} />;
  } else if (screen === "coachProfile") {
    body = <CoachProfile coachName={coachName} sport={sport}
                          reviewSummary={data ? data.reviewSummary : null}
                          myReview={data ? data.myReview : null}
                          onSubmitReview={(rating, comment) => data && data.submitReview(rating, comment)}
                          onMessage={() => go("messages")}
                          juvenile={juvenile} pop={pop} />;
  } else if (screen === "attendance") {
    const me = activeProfile?.name;
    const rows = [];
    Object.keys(registers || {}).forEach((k) => {
      Object.keys(registers[k]).forEach((name) => {
        if (role !== "coach" && name !== me) return;
        const parts = k.split(" ");
        const date = `${parts[0]} ${parts[1]}`;          // "14 JUN"
        const what = parts.slice(2).join(" ");            // "Summer clinic"
        rows.push({ date, who: role === "coach" ? name : what,
                    kind: role === "coach" ? what : (what.includes("clinic") || what.includes("squad") || what.includes("group") ? tr("Group") : tr("Private")),
                    state: registers[k][name] });
      });
    });
    body = <AttendanceScreen role={role} cfg={cfg} records={rows} rule={prefs.attendance} pop={pop} />;
  } else if (screen === "prefs") {
    body = <Preferences prefs={prefs} setPrefs={setPrefs} role={role} cfg={cfg} pop={pop} say={say} />;
  } else if (screen === "sources") {
    body = <Sources sport={sport} pop={pop} say={say} />;
  } else if (screen === "credentials") {
    body = <Credentials pop={pop} say={say} />;
  } else if (screen === "reviews") {
    body = <Testimonials role={role} pop={pop} say={say} />;
  } else if (screen === "events") {
    body = <EventsScreen sport={sport} cfg={cfg} role={role} pop={pop} say={say} />;
  } else if (screen === "season") {
    /* Read the arc off the actual log: the focus that recurred most is
       the theme; the one least revisited is where to go next. Nothing
       is invented — a coach can see how the sentence was reached. */
    const tally = {};
    (cfg.lessons || []).forEach((l) => { tally[l.focus] = (tally[l.focus] || 0) + 1; });
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const totalL = (cfg.lessons || []).length || 1;
    const seasonArc = ranked.length ? {
      theme: ranked[0][0],
      share: Math.round((ranked[0][1] / totalL) * 100),
      moved: ranked[1] ? ranked[1][0] : null,
      next:  (cfg.focus.find((f) => !tally[f.label]) || cfg.focus[cfg.focus.length - 1]).label,
      why:   tr("You've barely touched it this season"),
    } : null;
    body = (
      <SwipeBack onBack={pop}>
        <Screen title={tr("Your season")} onBack={pop} meta="2026">
          <div className="px-6 pb-2">
            <div className="mb-3"><RatingTile sport={sport} /></div>
            <SeasonPanel role={role} monthly={MONTHLY} arc={seasonArc}
                         priv={role === "coach" ? 148 : 17} grp={role === "coach" ? 62 : 5}
                         hours={role === "coach" ? 158 : 17} streak={role === "coach" ? 9 : 4} />
          </div>
        </Screen>
      </SwipeBack>
    );
  } else if (screen === "archive") {
    body = <CoachArchive cfg={cfg} lessons={archive} nouns={cfg.nouns} pop={pop} push={push} say={say} />;
  } else if (screen === "groups") {
    body = <MyGroups groups={myGroupsForMe} cfg={cfg} nouns={cfg.nouns} pop={pop} push={push} say={say} />;
  } else if (screen.startsWith("mygroup:")) {
    const gname = screen.split(":")[1];
    const g = myGroupsForMe.find((x) => x.name === gname);
    body = g ? <GroupHistory group={g} cfg={cfg} pop={pop} say={say} shared /> : <div />;
  } else if (screen === "tool") {
    body = <SportTool cfg={cfg} sport={sport} rows={freshAccount ? [] : (toolRows[sport] || [])}
                      onAdd={(r) => setToolRows((v) => ({ ...v, [sport]: [r, ...(v[sport] || [])] }))}
                      onRemove={(i) => setToolRows((v) => ({ ...v, [sport]: (v[sport] || []).filter((_, j) => j !== i) }))}
                      pop={pop} say={say} />;
  } else if (screen.startsWith("group:")) {
    const gname = screen.split(":")[1];
    const g = myGroups.find((x) => x.name === gname) || myGroups[0];
    body = g ? <GroupHistory group={g} cfg={cfg} pop={pop} say={say} onOpen={(n) => push("player:" + n)} /> : <div />;
  } else if (screen.startsWith("annotate:")) {
    const ang = screen.split(":")[1];
    body = <VideoAnnotate angle={ang} transcript={cfg.transcript}
                          onSave={(shapes, caps) => setAnnotations((a) => ({ ...a, [ang]: { shapes, caps } }))} pop={pop} say={say} />;
  } else if (screen === "requests") {
    body = <JoinRequests requests={openRequests} onAccept={acceptRequest} onDecline={declineRequest} pop={pop} nouns={cfg.nouns} />;
  } else if (screen === "unlogged") {
    body = <UnloggedLessons items={openUnlogged} onLog={(u) => { setPrefill(u); go("log"); }}
                            onDismiss={(u) => { setUnlogged((v) => v.filter((x) => x !== u)); say("Removed"); }} pop={pop} />;
  } else if (screen === "region") {
    body = <RegionScreen region={region} setRegion={setRegion} lang={lang} setLang={setLang} pop={pop} />;
  } else if (screen === "language") { body = <LanguageScreen lang={lang} setLang={setLang} pop={pop} say={say} />;
  } else if (screen === "details") { body = <Details role={role} pop={pop} say={say} />;
  } else if (screen === "notifications") { body = <Notifications role={role} pop={pop} pushOn={pushOn} setPushOn={setPushOn} />;
  } else if (screen === "support") { body = <Support pop={pop} say={say} />;
  } else if (screen === "subscription") { body = <Subscription pop={pop} say={say} plan={plan} />;
  } else if (screen === "family") {
    body = <FamilyDashboard profiles={profiles} conns={conns} practice={practice} tips={tips} bookings={bookings}
                            activeProfileId={activeProfileId} onSwitch={switchProfile} go={go} push={push} right={navRight} photos={avatars} say={say} />;
  } else if (screen === "tips") { body = <TipsHistory cfg={cfg} tips={myTips} pop={pop} />;
  } else if (screen === "stats") { body = (
      <SwipeBack onBack={pop}><Screen title={tr("Stats")} onBack={pop}><div className="px-6"><StatsEditSheet cfg={cfg} selected={mySelected} setSelected={(v) => setSelectedStats((p) => ({ ...p, [pKey]: v }))} manual={myManual} setManual={(v) => setManualStats((p) => ({ ...p, [pKey]: v }))} say={say} close={pop} /></div></Screen></SwipeBack>
    );
  } else if (screen === "you") { body = <Settings role={role} cfg={cfg} conn={conn} brandName={brandName} coachName={coachName} plan={plan} region={region} onTour={() => setTour(true)} onPhoto={() => setSheet("photo")} onMainSport={() => setSheet("mainSport")}
                          multiSport={conns.filter((c) => c.profileId === activeProfileId).length > 1}
                          mainLabel={(SPORTS[mainSport[activeProfileId] || (conns.find((c) => c.profileId === activeProfileId) || {}).sport] || {}).label || ""}
                          weekDone={freshAccount ? 0 : 11} weekHours={freshAccount ? 0 : 9} seasonDone={freshAccount ? 0 : 210} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} soundState={soundState} setSoundState={setSoundState} lang={lang} dark={dark} setDark={setDark} textScale={textScale} setTextScale={setTextScale} hapticsOn={hapticsOn} setHapticsOn={setHapticsOn} pop={pop} push={push} go={go} sheet={setSheet} say={say} restart={restart} />;
  } else if (screen === "calendar") { body = <CalendarScreen role={role} conn={conn} juvenile={juvenile} avail={myAvail} blocked={myBlocked} setBlocked={(fn) => setBlocked((p) => ({ ...p, [coachSport]: typeof fn === "function" ? fn(p[coachSport]) : fn }))}
                                                            bookings={role === "player" ? myBookings : []} seedBooked={mySeedBooked} onBook={book} onCancel={cancel} say={say} push={push} right={juvenile ? juvRight : role === "player" ? navRight : slimRight} family={familyCalendar} duration={duration} recurrence={recurrence} setRecurrence={setRecurrence} aiPick={aiPick} readOnly={juvenile}
                                                            seriesList={mySeries} onEditSeries={(n) => { setRecurFor(n); setSheet("recurring"); }} onWeather={weatherCancel}
                                                            prefs={calPrefs} setPrefs={setCalPrefs} onLogFor={(b) => { setPrefill({ ...b, m: 7, d: 24 }); go("log"); }} onWeatherDay={() => setSheet("weather")} onCancelWithReason={(l) => { setCancelling(l); setSheet("cancel"); }}
                                                            slotKinds={slotKinds}
                                                            onPeek={(bk) => { setPeek(bk); setSheet("peek"); }}
                                                            onEditDay={(day) => { setEditDay(day); setSheet("editDay"); }}
                                                            onBookInto={(day, h, k) => { setBookSlot({ day, time: h, kind: k }); setSheet(role === "coach" ? "bookWho" : "bookSelf"); }}
                                                            onRecurring={() => push("recurring")} />;
  } else if (screen === "messages") { body = <MessageList role={role} push={push} sheet={setSheet} right={slimRight} empty={freshAccount} lang={lang} onNew={() => setSheet("newThread")} onWeather={() => setSheet("weather")} />;
  } else if (screen === "practice") { body = role === "coach" ? <CoachPractice items={myPractice} sheet={openAssignDrills} push={push} right={slimRight} /> : <PlayerPractice conn={conn} items={myPractice} toggle={togglePractice} right={juvenile ? juvRight : navRight} say={say} />;
  } else if (role === "coach") {
    bare = screen === "log";
    body = {
      today:     <CoachToday cfg={cfg} coachName={coachName} go={go} push={push} published={published} right={slimRight} fresh={freshAccount} roster={roster} requests={openRequests} unlogged={openUnlogged} today={freshAccount ? [] : TODAY_SCHEDULE} duration={duration} onLogFor={(b) => { setPrefill({ ...b, m: 7, d: 24 }); go("log"); }} focusReqs={freshAccount ? [] : focusReqs} onSettleFocus={settleFocus} onCancelLesson={(l) => { setCancelling(l); setSheet("cancel"); }} onNoShow={markNoShow} weekDone={freshAccount ? 0 : 11} weekHours={freshAccount ? 0 : 9} drifting={freshAccount ? 0 : atRisk(roster, series).length} checkWaiting={freshAccount ? 0 : checkIns.filter((x) => x.state === "waiting").length} nextEvent={freshAccount ? null : (EVENTS[coachSport] || [])[0]} sport={coachSport} say={say}  onPeek={(b) => { setPeek(b); setSheet("peek"); }} events={freshAccount ? [] : (EVENTS[coachSport] || [])} lifetime={freshAccount ? 0 : 1284} monthly={MONTHLY} asks={freshAccount ? [] : askedFor} onAccept={acceptAsk} onDecline={(r) => { setDeclining(r); setSheet("decline"); }} />,
      log:       <Wizard livePlayers={data ? data.roster.map((r) => r.name) : null} askReview={prefs.askForReview !== false} lessonCounts={data ? Object.fromEntries((data.roster || []).map((r) => [r.name, r.lessons])) : null} cfg={cfg} onSaveDrill={saveDrill} sport={coachSport} prefill={prefill} groups={myGroups} captured={captured} setCaptured={setCaptured} onAnnotate={(a) => push("annotate:" + a)} showGuide={firstRun} onDismissGuide={() => setFirstRun(false)} onPublish={(l) => { setPrefill(null); if (prefill) setUnlogged((v) => v.filter((x) => x !== prefill)); publish(l); }} onCancel={() => { setPrefill(null); go("today"); }} />,
    }[screen] || <CoachToday cfg={cfg} coachName={coachName} go={go} push={push} published={published} right={slimRight} fresh={freshAccount} roster={roster} requests={openRequests} unlogged={openUnlogged} today={freshAccount ? [] : TODAY_SCHEDULE} duration={duration} onLogFor={(b) => { setPrefill({ ...b, m: 7, d: 24 }); go("log"); }} focusReqs={freshAccount ? [] : focusReqs} onSettleFocus={settleFocus} onCancelLesson={(l) => { setCancelling(l); setSheet("cancel"); }} onNoShow={markNoShow} weekDone={freshAccount ? 0 : 11} weekHours={freshAccount ? 0 : 9} drifting={freshAccount ? 0 : atRisk(roster, series).length} checkWaiting={freshAccount ? 0 : checkIns.filter((x) => x.state === "waiting").length} nextEvent={freshAccount ? null : (EVENTS[coachSport] || [])[0]} sport={coachSport} say={say}  onPeek={(b) => { setPeek(b); setSheet("peek"); }} events={freshAccount ? [] : (EVENTS[coachSport] || [])} lifetime={freshAccount ? 0 : 1284} monthly={MONTHLY} asks={freshAccount ? [] : askedFor} onAccept={acceptAsk} onDecline={(r) => { setDeclining(r); setSheet("decline"); }} />;
  } else if (!conn) {
    body = (
      <Screen title={`Morning, ${activeProfile.name.split(" ")[0]}`} right={navRight}>
        <div className="px-6">
          <Card className="p-8 text-center">
            <p style={{ fontFamily: display, fontSize: 19, color: theme.ink }}>{tr("No coach connected yet")}</p>
            <p className="mt-2 mb-5" style={{ fontFamily: ui, fontSize: 14, lineHeight: 1.55, color: theme.sub }}>Connect {activeProfile.name.split(" ")[0]} to a coach to get started.</p>
            <Button onClick={() => setSheet("family")}>{tr("Add a coach")}</Button>
          </Card>
        </div>
      </Screen>
    );
  } else {
    const shared = { cfg, conn, lessons: playerLessons, go, fresh: published, saved: mySaved, juvenile };
    body = {
      home:   <PlayerHome {...shared} push={push} onTick={togglePractice} attendPct={attendPct} activeProfile={activeProfile} right={navRight} nextBooking={nextBooking} practice={myPractice} tip={myTip} selectedStats={mySelected} manualStats={myManual} tool={TOOLS[sport]} pack={null} sheetRate={() => setSheet("rate")} sheetSuggest={() => setSheet("suggest")} agreed={agreedFocus[activeProfile.name]} onRequest={() => go("calendar")} calledOff={calledOff} onReschedule={() => setSheet("reschedule")} notice={cancelNotice} onAcceptOffer={(sl) => { setCancelNotice(null); setCeleb({ label: tr("Rebooked"), sub: sl }); }} onDismissNotice={() => setCancelNotice(null)} nextEvent={freshAccount ? null : (EVENTS[sport] || [])[0]} sport={sport} />,
      log:    <PlayerLog cfg={cfg} lessons={playerLessons} go={go} push={push} right={navRight} saved={mySaved} prefs={prefs} setPrefs={setPrefs} sport={sport} ownMedia={ownMedia} onUpload={addOwnMedia} onOverture={(l) => setOverture(l)} onCompare={() => setSheet("compare")} />,
      lesson: <PlayerLesson {...shared} toggleSave={toggleSave} minimise={(clip) => { setMini(clip); go("log"); say("Playing in the corner"); }} />,
    }[screen] || <PlayerHome {...shared} push={push} onTick={togglePractice} attendPct={attendPct} activeProfile={activeProfile} right={navRight} nextBooking={nextBooking} practice={myPractice} tip={myTip} selectedStats={mySelected} manualStats={myManual} tool={TOOLS[sport]} pack={null} sheetRate={() => setSheet("rate")} sheetSuggest={() => setSheet("suggest")} agreed={agreedFocus[activeProfile.name]} onRequest={() => go("calendar")} calledOff={calledOff} onReschedule={() => setSheet("reschedule")} notice={cancelNotice} onAcceptOffer={(sl) => { setCancelNotice(null); setCeleb({ label: tr("Rebooked"), sub: sl }); }} onDismissNotice={() => setCancelNotice(null)} nextEvent={freshAccount ? null : (EVENTS[sport] || [])[0]} sport={sport} />;
  }

  return (
    <ThemeCtx.Provider value={theme}><LangCtx.Provider value={L}>
      <ShimmerCSS />
      {/* In demo mode the app sits on a dark stage under a wordmark, as
          it has throughout design. In the product it simply fills the
          screen. */}
      <div className={demo ? "min-h-screen w-full flex flex-col items-center py-6 px-3" : "w-full"}
           style={demo ? { background: "#0B0F0C" } : { background: theme.page }}>
        {demo && (
        <div className="flex flex-col items-center mb-4">
          <Mark size={30} color="#E7EBE4" />
          <div className="mt-1.5" style={{ fontFamily: display, fontSize: 13, letterSpacing: "0.32em", color: "#E7EBE4" }}>{BRAND}</div>
          <div className="mt-1" style={{ fontFamily: ui, fontSize: 9.5, letterSpacing: "0.12em", color: "#77857A" }}>{tr("PROVISIONAL NAME")}</div>
        </div>
        )}

        {demo && (<>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <button onClick={restart} className="rounded-full px-4 py-1.5" style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: !inApp ? "#FFFFFF" : "#19211A", color: !inApp ? "#0B0F0C" : "#889684" }}>{tr("Sign-up")}</button>
          <button onClick={() => { haptic(10); soft(); loadFamily(); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600,
                           background: famLoaded ? "#FFFFFF" : "#19211A", color: famLoaded ? "#0B0F0C" : "#889684" }}>
            Breathnach
          </button>
          <button onClick={() => { haptic(8); setOffline(!offline); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: offline ? CAUTION : "#19211A", color: offline ? "#fff" : "#889684" }}>
            Offline
          </button>
          <button onClick={() => { haptic(8); setLoader(!loader); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: loader ? "#FFFFFF" : "#19211A", color: loader ? "#0B0F0C" : "#889684" }}>
            Loader
          </button>
          <button onClick={() => { haptic(8); setScenarios(!scenarios); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: scenarios ? "#FFFFFF" : "#19211A", color: scenarios ? "#0B0F0C" : "#889684" }}>
            Scenarios
          </button>
          {/* Test-only: load real clips into the feed. Never shipped —
              a player has no reason to upload into their own history. */}
          <label className="rounded-full px-3.5 py-1.5 shrink-0 inline-flex items-center gap-1.5"
                 style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: "#19211A",
                          color: "#8FA394", cursor: "pointer", whiteSpace: "nowrap" }}
                 title="Load your own clips into the lesson feed">
            Test media{Object.keys(ownMedia).length ? ` · ${Object.keys(ownMedia).length}` : ""}
            <input type="file" accept="video/*,image/*,audio/*" multiple className="hidden"
                   onChange={(e) => { addOwnMedia(0, Array.from(e.target.files || [])); e.target.value = ""; }} />
          </label>
          <button onClick={() => { setSplashKey((k) => k + 1); setSplash(true); haptic(10); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: splash ? "#FFFFFF" : "#19211A", color: splash ? "#0B0F0C" : "#889684" }}>
            Splash
          </button>
          <button onClick={() => { setFreshAccount(!freshAccount); haptic(8); }} className="rounded-full px-3.5 py-1.5"
                  style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, background: freshAccount ? "#FFFFFF" : "#19211A", color: freshAccount ? "#0B0F0C" : "#889684" }}>
            {freshAccount ? "Empty ✓" : "Empty"}
          </button>
          <div className="flex gap-1 rounded-full p-0.5" style={{ background: "#19211A" }}>
            {[
              { id: "coach",    label: "Coach" },
              { id: "player",   label: "Player" },
              { id: "parent",   label: "Parent" },
              { id: "juvenile", label: "Under 18" },
            ].map((v) => {
              const active = inApp && (
                v.id === "coach" ? role === "coach"
                : v.id === "juvenile" ? juvenile
                : v.id === "parent" ? role === "player" && !juvenile && hasFamily
                : role === "player" && !juvenile && !hasFamily);
              return (
                <button key={v.id} onClick={() => viewAs(v.id)} className="rounded-full px-3 py-1.5 shrink-0"
                        style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600,
                                 background: active ? "#FFFFFF" : "transparent", color: active ? "#0B0F0C" : "#889684" }}>
                  {v.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 rounded-full p-0.5 overflow-x-auto" style={{ background: "#19211A", maxWidth: 384, scrollbarWidth: "none" }}>{Object.keys(SPORTS).map((sp) => (
            <button key={sp} onClick={() => swapSport(sp)} className="rounded-full px-3 py-1.5 shrink-0" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, background: sport === sp ? SPORTS[sp].theme.accent : "transparent", color: sport === sp ? SPORTS[sp].theme.onAccent : "#889684" }}>{SPORTS[sp].label}</button>
          ))}</div>
        </div>

        {scenarios && (
          <div className="absolute" style={{ top: 96, left: "50%", marginLeft: 210, width: 250, zIndex: 90,
                 background: "#0F1513", borderRadius: R.surface, border: "1px solid #1E2724", padding: 14,
                 boxShadow: "0 20px 60px rgba(0,0,0,0.55)", animation: "liftIn 320ms cubic-bezier(.22,1,.36,1) both" }}>
            <div className="uppercase mb-3" style={{ fontFamily: ui, fontSize: 8.5, letterSpacing: "0.2em", color: "#6E7C77" }}>
              Jump to a state
            </div>
            {[
              ["Weather call-off", () => { setRole("coach"); setStack(["calendar"]); setSheet("weather"); }],
              ["Player offered a new time", () => { setRole("player"); setRescheduleFor("Thursday 5:30 pm"); setStack(["home"]); setSheet("reschedule"); }],
              ["Lesson waiting to be logged", () => { setRole("coach"); setStack(["today"]); }],
              ["Logging — attendance first", () => { setRole("coach"); setPrefill({ who: "Marcus Tran", m: 7, d: 24, time: "11:00 am", kind: "Private" }); setStack(["log"]); }],
              ["Just published — drills, tip, goal", () => { setRole("coach"); setPublished({ type: "private", who: ["Marcus Tran"], focus: "Short game", focusIds: ["short"], subs: [], videos: [], note: null, attend: "showed" }); setStack(["published"]); }],
              ["Focus suggestion to approve", () => { setRole("coach"); setFocusReqs([{ who: "Priya Ellis", focus: "Short game", note: "Losing shots around the green." }]); setStack(["today"]); }],
              ["Player suggesting a focus", () => { setRole("player"); setStack(["home"]); setSheet("suggest"); }],
              ["Player rating a lesson", () => { setRole("player"); setStack(["home"]); setSheet("rate"); }],
              ["Brand-new player", () => { setRole("player"); setFreshAccount(true); setStack(["home"]); }],
              ["Marking up a video", () => { setRole("coach"); setStack(["annotate:Face-on"]); }],
              ["Coach first-run set-up", () => { setFlow("setup"); }],
              ["Under-18 account", () => { viewAs("juvenile"); }],
              ["Player told it's rained off", () => { setRole("player"); setCalledOff("Thursday 5:30 pm"); setStack(["home"]); }],
              ["Capturing TrackMan numbers", () => { setRole("coach"); setPrefill({ who: "Marcus Tran", m: 7, d: 24, time: "11:00 am", kind: "Private" }); setStack(["log"]); }],
              ["Comparing two lessons", () => { setRole("player"); setStack(["log"]); setSheet("compare"); }],
              ["Working offline", () => { setOffline(true); setRole("coach"); setStack(["today"]); }],
              ["Group lesson to log", () => { setRole("coach"); setPrefill({ who: "Summer clinic", m: 7, d: 24, time: "2:00 pm", kind: "Group · 9" }); setStack(["log"]); }],
              ["Package running low", () => { setRole("player"); setStack(["home"]); }],
              ["Loading screen", () => { setLoader(true); }],
              ["Called off — rain", () => setAnnounce({ kind: "weather", title: tr("Tonight is off"),
                 body: tr("The range is flooded. Shane has offered Thursday at the same time."),
                 actionLabel: tr("Take Thursday"), action: () => { setAnnounce(null); hapticSuccess(); chime(); } })],
              ["A lesson landed", () => setAnnounce({ kind: "logged", title: tr("Short game"),
                 body: tr("Shane has written up this morning. Three clips."),
                 actionLabel: tr("Watch it"), action: () => { setAnnounce(null); setStack(["lesson"]); } })],
              ["Walkthrough — coach", () => { setRole("coach"); setTour(true); }],
              ["Walkthrough — player", () => { setRole("player"); setTour(true); }],
              ["Walkthrough — parent", () => { setRole("player"); setProfiles([{ id: 1, name: "Marcus Tran", age: null }, { id: 2, name: "Ellie Tran", age: 14 }]); setTour(true); }],
              ["Walkthrough — under 18", () => { setRole("player"); setJuvenile(true); setTour(true); }],
              ["Player: new lesson lands", () => { setRole("player"); setArrival({ focus: "Short game", videos: 2 }); }],
              ["Coach: lesson published", () => { setRole("coach"); setLogged(3); setBurst({ who: ["Marcus Tran"], focus: "Short game", videos: [1, 2], nextDrills: ["Ladder drill"], nextTip: "Trust the shallow" }); }],
            ].map(([label, act]) => (
              <button key={label} onClick={() => { haptic(8); soft(); setCeleb(null); setSplash(false); act(); setScenarios(false); }}
                      className="w-full text-left px-3 py-2.5 active:opacity-60"
                      style={{ borderRadius: R.field, fontFamily: ui, fontSize: 12.5, color: "#D4DBD8" }}>
                {label}
              </button>
            ))}
          </div>
        )}
        </>)}

        <div className="overflow-hidden w-full flex flex-col relative"
             style={{ maxWidth: demo ? 384 : "none",
                      height: demo ? 768 : "100dvh",
                      borderRadius: demo ? 34 : 0, background: theme.page,
                   ...(reduceMotion ? { ["--motion"]: "none" } : {}), border: demo ? "6px solid #05070A" : "none", boxShadow: demo ? "0 2px 8px rgba(0,0,0,0.4), 0 40px 100px rgba(0,0,0,0.62)" : "none", fontSize: `${textScale * 100}%` }}>
          {/* A drawn clock and battery belong to a mockup, not to a real
              app — the device already shows both, and a second one
              showing the wrong time is worse than none. Kept for the
              design harness, where the phone frame needs them; omitted
              entirely in the product, replaced by safe-area padding so
              content clears the real status bar. */}
          {demo ? (
            <div className={`flex items-center justify-between px-7 pt-3 shrink-0 z-30 ${bleed ? "absolute inset-x-0" : "relative"}`}>
              <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600,
                             color: bleed ? "#fff" : theme.ink,
                             textShadow: bleed ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}>9:41</span>
              <span style={{ fontFamily: ui, fontSize: 12.5,
                             color: bleed ? "rgba(255,255,255,0.9)" : theme.ink,
                             textShadow: bleed ? "0 1px 4px rgba(0,0,0,0.6)" : "none" }}>82%</span>
            </div>
          ) : (
            <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
          )}
          <div className={`flex-1 overflow-hidden relative${reduceMotion ? " calm" : ""}`}>
            {familyGuide && inApp
              ? <FamilyGuide juvenile={juvenile} name={activeProfile?.name || signupName || "there"} onDone={() => setFamilyGuide(false)} />
              : body}
          </div>

          {offline && inApp && (
            <div className="shrink-0 relative z-30 flex items-center gap-2.5 px-6 py-2"
                 style={{ background: CAUTION, animation: "liftIn 320ms cubic-bezier(.22,1,.36,1) both" }}>
              <Radio size={13} color="#fff" strokeWidth={2.1} />
              <span className="flex-1" style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: "#fff" }}>
                {tr("Offline — recording and mark-up still work")}
              </span>
              {queued > 0 && (
                <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.25)", fontFamily: ui, fontSize: 10.5, fontWeight: 600, color: "#fff" }}>
                  {queued} {tr("queued")}
                </span>
              )}
            </div>
          )}
          {loader && <Loader onTap={() => { haptic(8); setLoader(false); }} />}
          {overture && <LessonOverture lesson={overture} mark={theme.mark}
                          onDone={() => { setOverture(null); push("lesson"); }} />}
          {announce && <Announcement {...announce} onDismiss={() => setAnnounce(null)} />}
          {tour && <Walkthrough role={role} juvenile={juvenile}
                       isParent={account ? account.accountType === "parent" : (!juvenile && profiles.some((p) => p.age))}
                       onClose={() => { setTour(false); hapticSuccess(); }} />}
          {arrival && <NewLessonArrival lesson={arrival} coach={(conn || {}).coach || ""}
                        onOpen={() => { setArrival(null); setStack(["lesson"]); setTimeout(() => setSheet("rate"), 900); }} />}
          {burst && <PublishedBurst lesson={burst} tally={logged}
                        onAskRating={() => { setAskRating(burst); say(tr("They'll be asked after this lesson")); }}
                        remaining={(TODAY_SCHEDULE || []).filter((l) => l.done).length}
                        onLogNext={(TODAY_SCHEDULE || []).filter((l) => l.done).length > 0
                          ? () => { const nx = (TODAY_SCHEDULE || []).filter((l) => l.done)[0]; setBurst(null); setPublished(null);
                                    setPrefill(nx); setStack(["today"]); setTimeout(() => go("log"), 40); }
                          : null}
                        onDone={() => { setBurst(null); setPublished(null); setStack(["today"]); }} />}
          {celeb && <Celebration label={celeb.label} sub={celeb.sub} tone={celeb.tone} onDone={() => setCeleb(null)} />}
          {splash && <Splash key={splashKey} replayKey={splashKey}
                             sport={inApp ? sport : null}
                             roleLabel={juvenile ? "Under 18" : role === "coach" ? "Coach" : hasFamily ? "Parent" : (cfg.noun === "player" ? "Player" : cfg.noun)}
                             onDone={() => setSplash(false)} />}

          {mini && !bare && !familyGuide && (<MiniPlayer clip={mini} onClose={() => { haptic(8); setMini(null); }} onExpand={() => { setMini(null); go("lesson"); }} />)}

          {!bare && !familyGuide && (
            <TabBar tabs={tabs} theme={theme} dark={dark}
                    onSelect={(id) => { if (id === "quick") { hapticCommit(); soft(); setSheet("quick"); return; } go(id); }}
                    /* go() resets the stack to a single tab id; push() only ever
                       adds on top of it. So stack[0] is always the tab a
                       navigation branch began from — correct at any depth,
                       with no enumeration to fall out of date. The previous
                       version matched the CURRENT screen against a hand-kept
                       list, which is why the pill snapped back to Today for
                       anything not on that list — most pushed screens,
                       including a player's profile opened from Roster. */
                    activeIdx={Math.max(0, tabs.findIndex((tb) => tb.id === stack[0]))} />
          )}

          <Sheet open={!!sheet} onClose={() => setSheet(null)}>
            {sheet === "cmd" ? <CommandBar role={role} cfg={cfg} roster={roster}
                                            lessons={cfg.lessons} library={myLibrary}
                                            go={go} push={push}
                                            close={() => setSheet(null)}
                                            onAct={(id, who) => {
                                              const later = (fn) => { setSheet(null); setTimeout(fn, 180); };
                                              if (id === "log")     { setSheet(null); setPrefill(null); return go("log"); }
                                              if (id === "attend")  return later(() => setSheet("attend"));
                                              if (id === "capture") return later(() => { setCaptureFor(liveNow || TODAY_SCHEDULE[0]); setSheet("capture"); });
                                              if (id === "comp")    { setSheet(null); return push("events"); }
                                              if (id === "tip")     { setGoalFor(who); setAssignTo(who); return later(() => setSheet("tip")); }
                                              if (id === "drills")  return later(() => openAssignDrills(who));
                                              if (id === "message") { setSheet(null); return push("thread:" + who); }
                                              if (id === "request") { setSheet(null); return go("calendar"); }
                                              if (id === "clip")    { setSheet(null); return go("checkins"); }
                                            }} />
            : sheet === "pickWho" ? <PickPerson roster={roster}
                                            title={pickFor === "tip" ? tr("Set a tip") : tr("Set drills")}
                                            sub={tr("Who is it for?")}
                                            onPick={(name) => {
                                              setSheet(null);
                                              setTimeout(() => {
                                                if (pickFor === "tip") { setGoalFor(name); setAssignTo(name); setSheet("tip"); }
                                                else openAssignDrills(name);
                                              }, 180);
                                            }}
                                            close={() => setSheet(null)} />
            : sheet === "quick" ? <QuickMenu cfg={cfg} layout={quickLayout} setLayout={setQuickLayout}
                                            liveLesson={liveNow}
                                            onLog={() => { setSheet(null); setPrefill(null); go("log"); }}
                                            onRun={(id) => {
                                              const later = (fn) => { setSheet(null); setTimeout(fn, 180); };
                                              if (id === "attend")  return later(() => setSheet("attend"));
                                              if (id === "capture") return later(() => { setCaptureFor(liveNow || TODAY_SCHEDULE[0]); setSheet("capture"); });
                                              if (id === "tip")     { setPickFor("tip");    return later(() => setSheet("pickWho")); }
                                              if (id === "drills")  { setPickFor("drills"); return later(() => setSheet("pickWho")); }
                                              if (id === "player")  return later(() => setSheet("invite"));
                                              if (id === "group")   return later(() => setSheet("newGroup"));
                                              if (id === "message") return later(() => setSheet("newThread"));
                                              if (id === "comp")    { setSheet(null); push("events"); }
                                            }}
                                            close={() => setSheet(null)} />
            : sheet === "attend" ? <Attendance lessons={TODAY_SCHEDULE || []} roster={roster} taken={registers}
                                            onSubmit={(l, marks) => {
                                              if (data) {
                                                /* map display names back to real ids before saving */
                                                const byName = Object.fromEntries((data.roster || []).map((r) => [r.name, r.id]));
                                                const real = {};
                                                Object.entries(marks).forEach(([n, st]) => { if (byName[n]) real[byName[n]] = st; });
                                                data.takeRegister(l.who, real);
                                              }
                                              setRegisters((r) => ({ ...r, [l.time + l.who]: marks }));
                                              const n = Object.values(marks).filter((x) => x === "in").length;
                                              setCeleb({ label: tr("Register taken"), sub: `${n} ${tr("present")}` });
                                            }}
                                            close={() => setSheet(null)} say={say} />
            : sheet === "capture" ? <LiveCapture lessons={TODAY_SCHEDULE || []} chosen={captureFor}
                                            onChoose={setCaptureFor}
                                            items={(captured[(captureFor || {}).who] || [])}
                                            onAdd={(item) => {
                                              if (!captureFor) return;
                                              const id = Date.now();
                                              const mapped = item.kind === "video" ? { id, kind: "video", angle: tr("Live capture"), secs: item.secs }
                                                : item.kind === "photo" ? { id, kind: "action" }
                                                : item.kind === "voice" ? { id, kind: "voice", secs: item.secs }
                                                : { id, kind: "note", text: item.label };
                                              setCaptured((c) => ({ ...c, [captureFor.who]: [...(c[captureFor.who] || []), mapped] }));
                                            }}
                                            onDrop={(i) => {
                                              if (!captureFor) return;
                                              const mine = captured[captureFor.who] || [];
                                              setCaptured((c) => ({ ...c, [captureFor.who]: mine.filter((_, k) => k !== i) }));
                                            }}
                                            close={() => setSheet(null)} say={say} />
            : sheet === "photo" ? <PhotoSheet name={(activeProfile || {}).name || coachName}
                                            current={avatars[activeProfileId]}
                                            onSet={(c) => { setAvatars((v) => ({ ...v, [activeProfileId]: c })); setSheet(null); }}
                                            onClear={() => { setAvatars((v) => ({ ...v, [activeProfileId]: null })); setSheet(null); }}
                                            close={() => setSheet(null)} say={say} />
            : sheet === "mainSport" ? <DefaultSport name={(activeProfile || {}).name || ""}
                                            mine={conns.filter((c) => c.profileId === activeProfileId)}
                                            current={mainSport[activeProfileId] || (conns.find((c) => c.profileId === activeProfileId) || {}).sport}
                                            onPick={(sp) => { setMainSport((v) => ({ ...v, [activeProfileId]: sp }));
                                              const c = conns.find((x) => x.profileId === activeProfileId && x.sport === sp);
                                              if (c) { setActiveId(c.id); setCoachSport(sp); } }}
                                            close={() => setSheet(null)} />
            : sheet === "family" ? <FamilySheet profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onAddChild={addChild} conns={conns} activeConnId={activeId} onPickConn={(id) => { setActiveId(id); go("home"); }} onAddConn={addConn} onViewGroups={() => push("groups")} onPhoto={() => setSheet("photo")}
                                            mySports={[...new Set(conns.filter((c) => c.profileId === activeProfileId).map((c) => c.sport))]}
                                            main={mainSport[activeProfileId]}
                                            onSetMain={(sp) => { setMainSport((v) => ({ ...v, [activeProfileId]: sp })); setCoachSport(sp); }}
                                            onPhoto={() => say(tr("Opens your photos"))} close={() => setSheet(null)} say={say} />
              : sheet === "invite" ? <InviteBody say={(m) => { setSheet(null); say(m); }} />
              : sheet === "delete" ? <DeleteBody onCancel={() => setSheet(null)} say={(m) => { setSheet(null); say(m); }} />
              : sheet === "assign" ? <AssignBody livePlayers={data ? data.roster.map((r) => r.name) : null} cfg={cfg} library={myLibrary} preset={assignTo} focusHint={assignFocus} onAssign={doAssignDrills} onSaveDrill={saveDrill} close={() => setSheet(null)} />
              : sheet === "tip" ? <TipBody focusLabel={assignFocus || (cfg.focus[0] || {}).label} prompts={TIP_PROMPTS[coachSport]} onSet={doSetTip} close={() => setSheet(null)} />
              : sheet === "group" ? <GroupCreate livePlayers={data ? data.roster.map((r) => r.name) : null} cfg={cfg} coachSport={coachSport} onCreate={createGroup} close={() => setSheet(null)} />
              : sheet === "import" ? <ImportRoster noun={cfg.noun} nouns={cfg.nouns} code={data && data.inviteCode} existingNames={[...PLAYERS, ...invited.map((p) => p.name)]}
                                                    onSend={(names) => setInvited((v) => [...v, ...names.map((n) => ({ name: n, sentAt: "just now" }))])}
                                                    close={() => setSheet(null)} say={say} />
              : sheet === "peek" && peek ? <LessonPeek booking={peek} duration={duration} sport={coachSport} agreed={agreedFocus[peek.who]}
                                            onHistory={() => { setSheet(null); push("history:" + peek.who); }}
                                            cfg={cfg} onWeather={() => setSheet("weather")}
                                            comps={liveComps
                                              ? liveComps.filter((c) => c.mine || ((data.roster || []).find((r) => r.name === peek.who) || {}).id === c.playerId)
                                              : [...(playerComps[peek.who] || []), ...(freshAccount ? [] : (EVENTS[coachSport] || []).slice(0, 1).map((e) => ({ ...e, mine: true })))]}
                                            onEditComp={() => { setSheet(null); push("events"); }}
                                            onProfile={() => { setSheet(null); push("player:" + peek.who); }}
                                            onLog={() => { setSheet(null); setPrefill({ ...peek, m: TODAY.m, d: TODAY.d }); go("log"); }}
                                            onNoShow={() => { markNoShow(peek); setSheet(null); }}
                                            onCapture={() => { setSheet(null); push("capture:" + peek.who); }}
                                            onCancel={() => { setCancelling(`${peek.who} · ${peek.time}`); setSheet("cancel"); }}
                                            close={() => setSheet(null)} />
              : sheet === "editDay" && editDay ? <EditDay day={editDay} slots={ALL_TIMES} duration={duration}
                                            avail={avail[coachSport] || {}} setAvail={(nx) => setAvail({ ...avail, [coachSport]: nx })}
                                            slotKinds={slotKinds} setSlotKinds={setSlotKinds}
                                            onWeather={() => setSheet("weather")} close={() => setSheet(null)} say={say} />
              : sheet === "bookWho" && bookSlot ? (
                  <>
                    <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: theme.ink }}>{tr("Book someone in")}</h2>
                    <p className="mb-5" style={{ fontFamily: ui, fontSize: 13.5, color: theme.faint }}>
                      {DAY_NAMES[dowOf(bookSlot.day.m, bookSlot.day.d)]} {bookSlot.day.d} · {span(bookSlot.time, duration)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {roster.map((r, i) => (
                        <Tile key={r.name} className="px-4 py-3.5" delay={i * 45}
                              onPress={() => { setSeedBooked((prev) => {
                                  const nx = { ...prev, [coachSport]: { ...prev[coachSport] } };
                                  const k = key(bookSlot.day.m, bookSlot.day.d);
                                  nx[coachSport][k] = [...(nx[coachSport][k] || []), { time: bookSlot.time, who: r.name, kind: "Private" }];
                                  return nx; });
                                setSheet(null); setCeleb({ label: tr("Booked"), sub: `${r.name} · ${bookSlot.time}` }); }}>
                          <div className="flex items-center gap-3.5">
                            <Avatar name={r.name} size={36} />
                            <span className="flex-1" style={{ fontFamily: ui, fontSize: 15, color: theme.ink }}>{r.name}</span>
                            <ChevronRight size={15} color={theme.faint} />
                          </div>
                        </Tile>
                      ))}
                    </div>
                  </>
                )
              : sheet === "bookSelf" && bookSlot ? (
                  <>
                    <h2 className="mb-1" style={{ fontFamily: display, fontSize: 23, letterSpacing: "-0.025em", color: theme.ink }}>{tr("Confirm")}</h2>
                    <p className="mb-6" style={{ fontFamily: ui, fontSize: 13.5, color: theme.faint }}>
                      {DAY_NAMES[dowOf(bookSlot.day.m, bookSlot.day.d)]} {bookSlot.day.d} · {span(bookSlot.time, duration)}
                    </p>
                    <Button onClick={() => { setSheet(null); setCeleb({ label: tr("Asked"), sub: tr("Your coach will confirm.") }); }}>{tr("Request it")}</Button>
                  </>
                )
              : sheet === "rebookAfter" ? (
                  <>
                    <h2 className="mb-1" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: theme.ink }}>{tr("Book the next one")}</h2>
                    <p className="mb-6" style={{ fontFamily: ui, fontSize: 13.5, color: theme.faint }}>{(conn || {}).coach}</p>
                    <Button onClick={() => { setSheet(null); setCeleb({ label: tr("Booked"), sub: tr("Same time next week") }); }}>{tr("Book it")}</Button>
                    <button onClick={() => { setSheet(null); go("calendar"); }} className="w-full mt-3 py-3 active:opacity-50"
                            style={{ fontFamily: ui, fontSize: 13.5, color: theme.sub }}>{tr("Pick another time")}</button>
                  </>
                )
              : sheet === "transfer" ? <RecordTransfer name={(activeProfile || {}).name || ""} fromCoach={(conn || {}).coach || tr("your last coach")}
                                            toCoach={transferTo || tr("your new coach")}
                                            onDone={(parts) => setCeleb({ label: tr("Record shared"), sub: `${parts.length} ${tr("parts")}` })}
                                            close={() => setSheet(null)} />
              : sheet === "cancel" ? <CancelLesson role={role} lesson={cancelling || tr("Your lesson")} slots={slots.slice(0, 6)} duration={duration}
                                            onDone={({ reason, offer }) => {
                                              setCancelNotice({ from: role === "coach" ? coachName : (activeProfile || {}).name, lesson: cancelling, reason, offer });
                                              /* comes back to the package, unlike a no show */
                                              setSeries((list) => list.map((x) => (cancelling && cancelling.includes(x.who) ? { ...x, total: x.total + 1 } : x)));
                                              setCeleb({ label: tr("Cancelled"), sub: tr("Returned to their package."), tone: DANGER }); }}
                                            close={() => setSheet(null)} />
              : sheet === "compare" ? <VideoCompare cfg={cfg} lessons={role === "coach" ? cfg.lessons : playerLessons}
                                            onClose={() => setSheet(null)} />
              : sheet === "weather" ? <WeatherCallOff day={weatherDay || `${DAY_NAMES[dowOf(TODAY.m, TODAY.d)]} ${TODAY.d}`}
                                            bookings={(mySeedBooked[key(TODAY.m, TODAY.d)] || [])} duration={duration}
                                            onConfirm={callOff} close={() => setSheet(null)} />
              : sheet === "reschedule" ? <RescheduleOffer lesson={rescheduleFor || tr("Your lesson")} slots={slots.slice(0, 6)} duration={duration}
                                            onPick={(sl) => { setCalledOff(null); setCeleb({ label: tr("Rebooked"), sub: sl }); }} close={() => setSheet(null)} />
              : sheet === "suggest" ? <SuggestFocus cfg={cfg}
                                            onSend={(f, n) => { setFocusReqs((v) => [...v, { who: activeProfile.name, focus: f, note: n }]);
                                              setCeleb({ label: tr("Sent"), sub: tr("Your coach will confirm.") }); }}
                                            close={() => setSheet(null)} />
              : sheet === "goal" ? <GoalSheet name={goalFor || "them"} cfg={cfg}
                                            onSave={(n, txt, by) => { addGoal(n, txt, by); setCeleb({ label: tr("Goal set"), sub: txt }); }}
                                            close={() => setSheet(null)} />
              : sheet === "newChoice" ? (
                  <>
                    <h2 className="mb-5" style={{ fontFamily: display, fontSize: 24, letterSpacing: "-0.025em", color: theme.ink }}>{tr("New")}</h2>
                    <Tile className="px-5 py-[18px] mb-2.5" onPress={() => setSheet("newThread")}>
                      <div className="flex items-center gap-3.5">
                        <MessageCircle size={19} color={theme.sub} strokeWidth={1.6} />
                        <span className="flex-1" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: theme.ink }}>{tr("Message someone")}</span>
                        <ChevronRight size={15} color={theme.faint} />
                      </div>
                    </Tile>
                    <Tile className="px-5 py-[18px]" onPress={() => setSheet("newGroup")}>
                      <div className="flex items-center gap-3.5">
                        <Users size={19} color={theme.accent} strokeWidth={1.6} />
                        <span className="flex-1">
                          <span className="block" style={{ fontFamily: display, fontSize: 18, letterSpacing: "-0.02em", color: theme.ink }}>{tr("New group")}</span>
                          <span className="block mt-0.5" style={{ fontFamily: ui, fontSize: 11.5, color: theme.faint }}>{tr("You'll manage it")}</span>
                        </span>
                        <ChevronRight size={15} color={theme.faint} />
                      </div>
                    </Tile>
                  </>
                )
              : sheet === "newGroup" ? <CreateGroup roster={roster} nouns={cfg.nouns}
                                            onCreate={(g) => { setGroups((gs) => ({ ...gs, [coachSport]: [...(gs[coachSport] || []), { id: Date.now(), ...g }] }));
                                              setCeleb({ label: tr("Group created"), sub: `${g.name} · ${g.members.length}` }); }}
                                            close={() => setSheet(null)} say={say} />
              : sheet === "newThread" ? <NewThread role={role} roster={roster} conns={conns.filter((c) => c.profileId === activeProfileId)}
                                            onPick={(n) => push("thread:" + n)} close={() => setSheet(null)} />
              : sheet === "rate" ? <RateLesson focus={(playerLessons[0] || {}).focus || ""} coach={conn?.coach || ""}
                                            onDone={() => { setCeleb({ label: tr("Thanks"), sub: tr("Your coach will see it.") }); setTimeout(() => setSheet("rebookAfter"), 1900); }}
                                            close={() => setSheet(null)} />
              : sheet === "decline" && declining ? (
                  <>
                    <h2 className="mb-1" style={{ ...TYPE.title, color: theme.ink }}>{tr("Offer another time")}</h2>
                    <p className="mb-5" style={{ ...TYPE.small, color: theme.faint }}>{declining.who}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {slots.slice(0, 6).map((sl) => (
                        <button key={sl} onClick={() => { hapticSuccess(); soft();
                                  setAskedFor((v) => v.filter((x) => x !== declining));
                                  setSheet(null); setCeleb({ label: tr("Offered"), sub: `${declining.who} · ${sl}` }); }}
                                className="px-3.5 active:opacity-60"
                                style={{ minHeight: 44, borderRadius: R.pill, background: theme.wash,
                                         ...TYPE.small, fontWeight: 500, color: theme.ink }}>{sl}</button>
                      ))}
                    </div>
                    <Button tone="dangerQuiet" onClick={() => { setAskedFor((v) => v.filter((x) => x !== declining));
                              setSheet(null); say(tr("Declined")); }}>{tr("Just decline")}</Button>
                  </>
                )
              : sheet === "pickRecurWho" ? (
                  <>
                    <h2 className="mb-1" style={{ ...TYPE.title, color: theme.ink }}>{tr("Who's it for")}</h2>
                    <div className="flex flex-col gap-2">
                      {roster.map((r, i) => {
                        const has = series.some((x) => x.who === r.name && !x.ended);
                        return (
                          <Tile key={r.name} className="px-4 py-3.5" delay={i * 45}
                                onPress={has ? null : () => { setRecurFor(r.name); setSheet("recurring"); }}>
                            <div className="flex items-center gap-3.5" style={{ opacity: has ? 0.45 : 1 }}>
                              <Avatar name={r.name} size={38} />
                              <span className="flex-1 min-w-0">
                                <span className="block truncate" style={{ fontFamily: ui, fontSize: 15, color: theme.ink }}>{r.name}</span>
                                {has && <span className="block mt-0.5" style={{ ...TYPE.caption, color: theme.faint }}>{tr("Already has one")}</span>}
                              </span>
                              {!has && <ChevronRight size={15} color={theme.faint} />}
                            </div>
                          </Tile>
                        );
                      })}
                    </div>
                  </>
                )
              : sheet === "recurring" ? <RecurringSetup name={recurFor || (roster[0] || ROSTER[0]).name} existing={series.find((x) => x.who === recurFor && x.sport === coachSport)}
                                          slots={slots} duration={duration} onSave={saveSeries} onEnd={endSeries}
                                          close={() => setSheet(null)} say={say} />
              : sheet === "broadcast" ? <BroadcastBody nouns={cfg.nouns} say={say} close={() => setSheet(null)} />
              : null}
          </Sheet>
          <Toast msg={toast} />
        </div>
      </div>
    </LangCtx.Provider></ThemeCtx.Provider>
  );
}

/* Small helpers kept at the bottom to avoid hoisting issues */
function YouAvatarBtn({ name, onOpen }) {
  return (
    <button onClick={() => { haptic(6); onOpen(); }} aria-label={tr("Your profile")} className="active:opacity-50">
      <Avatar name={name} size={30} />
    </button>
  );
}

