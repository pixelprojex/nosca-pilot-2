import React from "react";

/* ==================================================================
   THE MARK, AND THE SCREEN THAT WAITS

   Nosca is Irish nasc, "to link", so the mark is two rings that are
   genuinely linked. It used to be two rings with a thin arc laid
   between them — a third element, lighter than either ring, which read
   as a seam rather than a join and left the whole mark looking faint.
   Now the rings carry it: each one is broken by a small gap exactly
   where the other passes over it, so they weave. Over at the top,
   under at the bottom. Nothing is knocked out with a background
   colour, so the mark sits on any surface, and every stroke is the
   same weight — which is what makes it read as strong.

   This module owns the geometry, and the loading screen built from it,
   because both are needed before Nosca.jsx is on screen at all: the
   gate in App.jsx renders while the session and profile are still being
   read. Nothing here imports Nosca — that would be a cycle — so the two
   font stacks and the six sport accents are repeated as literals.
================================================================== */

const display = "'Cabinet Grotesk', ui-sans-serif, -apple-system, sans-serif";
const ui = "'Switzer', 'Instrument Sans', ui-sans-serif, -apple-system, sans-serif";

export const BRAND_NAME = "NOSCA";

/* golf, tennis, rowing, squash, padel, equestrian */
export const SPORT_ACCENTS = ["#8C6D28", "#0F7A69", "#2E6E8E", "#B5562E", "#6B4E9E", "#7A3B4A"];

/* Two rings of radius 8.6 with centres 12 apart, so they cross at
   x = 20, y = 12.5 ± 6.16. Everything below is worked out from these
   four numbers; no coordinate in this file is typed by hand. */
export const MARK = { r: 8.6, lx: 14, rx: 26, cy: 12.5, view: "0 0 40 25", weight: 2.75 };

const DEG = Math.PI / 180;
const at = (cx, r, deg) => [cx + r * Math.cos(deg * DEG), MARK.cy + r * Math.sin(deg * DEG)];
const fx = (n) => Number(n.toFixed(3));
/* the long way round a circle, from one angle to another */
const ringGap = (cx, fromDeg, toDeg) => {
  const [x1, y1] = at(cx, MARK.r, fromDeg);
  const [x2, y2] = at(cx, MARK.r, toDeg);
  return `M${fx(x1)} ${fx(y1)} A ${MARK.r} ${MARK.r} 0 1 1 ${fx(x2)} ${fx(y2)}`;
};
/* Where the circles meet, as an angle on each one. */
const HALF = Math.acos(6 / MARK.r) / DEG;      // 45.75° — the crossing, off the horizontal
/* Half the gap: wide enough to read as a break at 16px, narrow enough
   not to look like a broken ring at 512. */
const GAP = 11.5;

/* The left ring, broken at the bottom crossing — the right one passes
   over it there. */
export const RING_L = ringGap(MARK.lx, HALF + GAP, HALF - GAP);
/* The right ring, broken at the top crossing. */
const TOP_ON_R = -(180 - HALF);                // the top crossing, seen from the right centre
export const RING_R = ringGap(MARK.rx, TOP_ON_R + GAP, TOP_ON_R - GAP);
/* How long each broken ring is, for anything that draws itself on. */
export const RING_LEN = 2 * Math.PI * MARK.r * ((360 - 2 * GAP) / 360);
/* The left ring's arc across the top crossing — the segment that is
   doing the linking, and the only place a second colour belongs. */
/* The mark. One weight, one colour — or two, when an accent is given:
   the second ring takes it, which is the only two-tone that still reads
   as one mark. */
export function Mark({ size = 34, color = "#16201A", accent, weight = MARK.weight }) {
  return (
    <svg width={size} height={size * 0.62} viewBox={MARK.view} aria-label={BRAND_NAME}>
      <path d={RING_L} fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" />
      <path d={RING_R} fill="none" stroke={accent || color} strokeWidth={weight} strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   THE LOADING SCREEN
   The mark held still while a light runs each ring, inward past the
   crossing and out again — only rotation is animated, and a full turn
   ends exactly where it began, so there is no seam however long anyone
   waits. This is what the app shows while it reads a session, a profile
   or a first page of data: the same screen every time, rather than the
   word "Loading" on three different backgrounds.
------------------------------------------------------------------ */
const CIRC = 2 * Math.PI * MARK.r;    // 54.03
const ARC = CIRC * 0.26;              // the travelling light

const KEYFRAMES = `
@keyframes nsTurn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes nsTurnBack{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes nsBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes nsHue{0%{stroke:var(--h0)}17%{stroke:var(--h1)}34%{stroke:var(--h2)}51%{stroke:var(--h3)}68%{stroke:var(--h4)}85%{stroke:var(--h5)}100%{stroke:var(--h0)}}
@keyframes nsFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){
  [data-brand-loader] *{animation:none!important}
}`;

export function BrandLoader({
  label,
  onTap,
  action,
  page = "#FAF7F0",
  hair = "#E8E3DA",
  faint = "#A39C93",
  absolute = false,
}) {
  const hues = SPORT_ACCENTS.reduce((a, c, i) => ({ ...a, [`--h${i}`]: c }), {});
  const Tag = onTap ? "button" : "div";
  return (
    <Tag
      data-brand-loader
      onClick={onTap || undefined}
      aria-label={label || "Loading"}
      aria-busy="true"
      className={`${absolute ? "absolute inset-0" : "min-h-screen w-full"} flex flex-col items-center justify-center`}
      style={{ background: page, zIndex: absolute ? 65 : undefined, cursor: onTap ? "pointer" : "default" }}
    >
      <style>{KEYFRAMES}</style>

      {/* The mark at the size it is everywhere else in the app. It was
          168px across, which on a blank screen reads as a graphic
          rather than a logo. */}
      <svg width={72} height={45} viewBox={MARK.view}
           style={{ ...hues, overflow: "visible", animation: "nsBreathe 5.5s ease-in-out infinite" }}>
        {/* the mark itself, steady */}
        <path d={RING_L} fill="none" stroke={hair} strokeWidth={MARK.weight} strokeLinecap="round" />
        <path d={RING_R} fill="none" stroke={hair} strokeWidth={MARK.weight} strokeLinecap="round" />

        {/* a light running each ring, turning inward towards the crossing */}
        <circle cx={MARK.lx} cy={MARK.cy} r={MARK.r} fill="none" strokeWidth={MARK.weight} strokeLinecap="round"
                style={{ strokeDasharray: `${ARC} ${CIRC - ARC}`, transformOrigin: `${MARK.lx}px ${MARK.cy}px`,
                         animation: "nsTurn 2.8s linear infinite, nsHue 12s linear infinite" }} />
        <circle cx={MARK.rx} cy={MARK.cy} r={MARK.r} fill="none" strokeWidth={MARK.weight} strokeLinecap="round"
                style={{ strokeDasharray: `${ARC} ${CIRC - ARC}`, transformOrigin: `${MARK.rx}px ${MARK.cy}px`,
                         animation: "nsTurnBack 2.8s linear infinite, nsHue 12s linear infinite" }} />
      </svg>

      <div style={{ marginTop: 22, fontFamily: display, fontSize: 11, letterSpacing: "0.32em",
                    textTransform: "uppercase", color: faint }}>{label || BRAND_NAME}</div>

      {/* Only ever a way out of a wait that has gone on too long. */}
      {action && <div style={{ marginTop: 22, animation: "nsFadeUp 400ms ease both" }}>{action}</div>}

      {onTap && !action && (
        <div style={{ position: "absolute", bottom: 44, fontFamily: ui, fontSize: 10.5,
                      letterSpacing: "0.18em", textTransform: "uppercase", color: hair }}>Tap to continue</div>
      )}
    </Tag>
  );
}

export default BrandLoader;
