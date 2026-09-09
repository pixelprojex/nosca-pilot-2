import React from "react";

/* ==================================================================
   THE BRAND COLOUR, THE MARK, AND THE SCREEN THAT WAITS

   One anchor colour for everything that is Nosca's rather than a
   sport's: the loading screen, the app icon, the splash before anyone
   has picked a sport, the sign-up screens' controls. Sport palettes
   tint the app once you are inside a sport; this is what the app is
   before that, and between those moments.

   Deep bottle green. Irish without being a flag, dark enough to carry
   an off-white mark at every icon size, and clearly a colour rather
   than another near-black — on a home screen full of black and white
   tiles it is the one you find. Contrast with the paper mark is 11:1;
   with white text 12:1; with the loader's grey 6.5:1.

   This module owns the geometry and the loading screen because both
   are needed before Nosca.jsx is on screen at all: the gate in App.jsx
   renders while the session and profile are still being read. Nothing
   here imports Nosca — that would be a cycle.
================================================================== */

export const BRAND = "#123C30";          // the base
export const BRAND_PAPER = "#F4F6F3";    // what sits on it
export const BRAND_NAME = "NOSCA";

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
   The brand colour, edge to edge, and one small grey ring turning in
   the middle. Nothing else — no mark, no wordmark, no word. It is the
   screen the app shows while it reads a session, a profile or a first
   page of data, and it should be over before it is looked at.

   The ring is a track and an arc on the same circle, so it reads as a
   ring that is filling rather than a spinner. `action` is the only
   thing that ever joins it: a way out, shown once a wait has gone on
   too long, and never before.
------------------------------------------------------------------ */
const KEYFRAMES = `
@keyframes nsSpin{to{transform:rotate(360deg)}}
@keyframes nsFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){
  [data-brand-loader] *{animation-duration:2.4s!important}
}`;

export function BrandLoader({ onTap, action, absolute = false }) {
  const Tag = onTap ? "button" : "div";
  const D = 28, W = 2.5, R = (D - W) / 2, C = 2 * Math.PI * R;
  return (
    <Tag
      data-brand-loader
      onClick={onTap || undefined}
      aria-label="Loading"
      aria-busy="true"
      className={`${absolute ? "absolute inset-0" : "min-h-screen w-full"} flex flex-col items-center justify-center`}
      style={{ background: BRAND, zIndex: absolute ? 65 : undefined, cursor: onTap ? "pointer" : "default", border: "none", padding: 0 }}
    >
      <style>{KEYFRAMES}</style>
      <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} aria-hidden="true"
           style={{ animation: "nsSpin 900ms linear infinite" }}>
        <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke="rgba(244,246,243,0.22)" strokeWidth={W} />
        <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke="rgba(244,246,243,0.85)" strokeWidth={W}
                strokeLinecap="round" strokeDasharray={`${C * 0.28} ${C}`} transform={`rotate(-90 ${D / 2} ${D / 2})`} />
      </svg>
      {action && (
        <div style={{ position: "absolute", bottom: "max(40px, env(safe-area-inset-bottom, 40px))",
                      animation: "nsFadeUp 400ms ease both" }}>{action}</div>
      )}
    </Tag>
  );
}

export default BrandLoader;
