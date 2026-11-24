import React, { useEffect } from "react";
import { X } from "lucide-react";
import { ThemeCtx, NEUTRAL, CLUB, tr, ui, TYPE, MOTION, Button, InstallGuide, INSTALL_CSS, haptic, openAbout } from "../Nosca";
import { RING_L, RING_R, BRAND } from "../lib/brandmark.jsx";
import { registerSw } from "../lib/push";

/* ADD TO HOME SCREEN — https://<site>/install
 *
 * The page the business card's code opens: the first thing anyone sees
 * of Nosca after being handed the card. The founder, 23 November: "it's
 * a bit anticlimactic … too much text, too much going on." So the page
 * is THE CARD LAID ON PAPER. The paper is the card's own back — white,
 * a rule in gold — and the card itself lies on it as an object, drawn
 * from the print file's numbers (scripts/business-card.py): the olive
 * ground, the two wedges of gold pinstripes, the mark and NOSCA in the
 * foil. It arrives showing the white side that was just scanned and
 * turns over once. Under it one line says what Nosca is, and then the
 * guide (InstallGuide in Nosca, in its card dress: the gold for the
 * numerals, the thread and the ring) shows this phone's steps and no
 * other. The page's one key is the card's olive, so the page and the
 * card in the hand are one object; the app's own bottle green is the
 * icon drawn in the last step, which is what lands on the Home Screen.
 *
 * Open Nosca at the foot and the X go to the app — a sign-up for a new
 * person, the app for one who is signed in; About Nosca opens the
 * website beside it. The worker is registered here too: Chrome's
 * install criteria want one, and the app registers it only once
 * somebody is signed in. */

/* the card, in its own millimetres */
const CARD_W = 84, CARD_H = 55;
/* the top-right wedge's inner edge runs (39.85, 0) → (84, 30.52); the
   bottom-left wedge is the same one turned half a turn. The stripes
   cross at 45°, 3.6 mm apart: every one is the line x + y = c. */
const SLOPE = 30.52 / 44.15, PITCH = 3.6 * Math.SQRT2, PHASE = 0.909;
const STRIPES = (() => {
  const out = [], f = (n) => Number(n.toFixed(2));
  for (let c = PHASE; c < CARD_W + CARD_H; c += PITCH) {
    /* each from the wedge's gold edge out to the card's own edge, so it is drawn outward */
    if (c > 39.85 && c < 114.52) { const k = (c - 39.85) / (1 + SLOPE); out.push(`M${f(39.85 + k)} ${f(SLOPE * k)}L${f(Math.min(c, 84))} ${f(Math.max(0, c - 84))}`); }
    if (c > 24.48 && c < 99.15) { const k = (c - 24.48) / (1 + SLOPE); out.push(`M${f(k)} ${f(24.48 + SLOPE * k)}L${f(Math.max(0, c - 55))} ${f(Math.min(c, 55))}`); }
  }
  return out;
})();
/* the code on the card's back, as a pattern and nothing a camera reads:
   the three corner squares and a scatter between them */
const CODE = (() => {
  const n = 29, cell = 17 / n, x0 = 61, y0 = 22.5, f = (v) => Number(v.toFixed(2));
  const corner = (i, j, ci, cj) => { const a = Math.max(Math.abs(i - ci), Math.abs(j - cj)); return a <= 3 ? a !== 2 : null; };
  let d = "", seed = 7;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const near = [[3, 3], [n - 4, 3], [3, n - 4]].map(([ci, cj]) => corner(i, j, ci, cj)).find((v) => v !== null);
    const quiet = [[3, 3], [n - 4, 3], [3, n - 4]].some(([ci, cj]) => Math.max(Math.abs(i - ci), Math.abs(j - cj)) === 4);
    const on = near !== undefined ? near : !quiet && (seed >> 8) % 100 < 46;
    if (on) d += `M${f(x0 + i * cell)} ${f(y0 + j * cell)}h${f(cell)}v${f(cell)}h${f(-cell)}z`;
  }
  return d;
})();
/* the foil, lit from the top left as the print preview lights it */
const FOIL = [[0, "#B08630"], [0.38, "#E2BE60"], [0.5, "#FAE6A0"], [0.62, "#DEB85A"], [1, "#A07626"]];
const TRACK = 0.42 * 3.53;   // NOSCA at 10 pt, tracked 0.42 em, in the card's millimetres
const face = { position: "absolute", inset: 0, overflow: "hidden", borderRadius: "4.17% / 6.36%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
const draw = (ms, delay) => ({ strokeDasharray: "1 2", animation: `insDraw ${ms}ms cubic-bezier(.4,0,.2,1) ${delay}ms backwards` });
/* THE TURN. The card starts on its white side and comes over once, slow
   off the mark so the side that was scanned is seen. Its shadow stays on
   the paper, so it cannot turn with the card: it narrows as the card
   stands on edge and widens again — the same curve, sampled, because a
   keyframe's easing runs between two keyframes and never across them. */
const TURN = { ms: 1250, delay: 220, curve: [0.55, 0, 0.15, 1] };
const bezier = ([x1, y1, x2, y2], x) => {
  const at = (a, b, k) => 3 * a * k * (1 - k) * (1 - k) + 3 * b * k * k * (1 - k) + k * k * k;
  let lo = 0, hi = 1;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (at(x1, x2, mid) < x) lo = mid; else hi = mid; }
  return at(y1, y2, (lo + hi) / 2);
};
const SHADE = Array.from({ length: 26 }, (_, i) => {
  const x = i / 25, wide = Math.abs(Math.cos(Math.PI * (1 - bezier(TURN.curve, x))));
  return `${(x * 100).toFixed(0)}%{transform:scaleX(${Math.max(0.03, wide).toFixed(3)});opacity:${(0.35 + 0.65 * wide).toFixed(2)}}`;
}).join("");
/* when the green side has come round: the foil is drawn from then */
const FRONT = TURN.delay + Math.round(TURN.ms * 0.36);

function InstallCard() {
  return (
    <div data-tour="install-card" role="img" aria-label={tr("The Nosca card: two woven rings and NOSCA in gold on olive green, with gold pinstripes in two corners")}
         className="relative mx-auto" style={{ width: "min(272px, 100%)", aspectRatio: `${CARD_W} / ${CARD_H}`, perspective: 900, transform: "rotate(-3deg)", animation: "insFade 260ms ease-out backwards" }}>
      {/* what the card rests on: a soft shadow that stays on the paper while the card turns */}
      <span aria-hidden="true" className="absolute" style={{ left: "4%", right: "4%", top: "16%", bottom: "3%", borderRadius: 14, boxShadow: "0 16px 26px -6px rgba(26,32,14,0.34), 0 6px 10px -3px rgba(26,32,14,0.22)",
                                                              animation: `insShade ${TURN.ms}ms linear ${TURN.delay}ms backwards` }} />
      <div aria-hidden="true" className="absolute inset-0" style={{ transformStyle: "preserve-3d", animation: `insTurn ${TURN.ms}ms cubic-bezier(${TURN.curve.join(",")}) ${TURN.delay}ms backwards` }}>
        {/* the front */}
        <div style={{ ...face, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
          <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" style={{ display: "block" }} focusable="false">
            <defs>
              <linearGradient id="ins-foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={CARD_W} y2={CARD_H}>
                {FOIL.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
              </linearGradient>
            </defs>
            <rect width={CARD_W} height={CARD_H} fill={CLUB.olive} />
            <g fill="none" stroke="url(#ins-foil)">
              {/* the wedges' gold edges, then the pinstripes out from them one after another */}
              <path d="M39.85 0L84 30.52" pathLength="1" strokeWidth="0.5" style={draw(520, FRONT + 20)} />
              <path d="M44.15 55L0 24.48" pathLength="1" strokeWidth="0.5" style={draw(520, FRONT + 20)} />
              {STRIPES.map((d, i) => <path key={d} d={d} pathLength="1" strokeWidth="0.4" style={draw(460, FRONT + 150 + i * 14)} />)}
              {/* the mark, 22 mm wide and centred: the two rings draw themselves */}
              <g transform="translate(31 17.5) scale(0.55)" strokeWidth="2.75" strokeLinecap="round">
                <path d={RING_L} pathLength="1" style={draw(820, FRONT + 260)} />
                <path d={RING_R} pathLength="1" style={draw(820, FRONT + 400)} />
              </g>
            </g>
            <text data-tour="wordmark" x={CARD_W / 2 + TRACK / 2} y="36.72" textAnchor="middle" fill="url(#ins-foil)"
                  style={{ fontFamily: ui, fontSize: 3.53, fontWeight: 500, letterSpacing: TRACK, animation: `insFade 520ms ease-out ${FRONT + 700}ms backwards` }}>NOSCA</text>
          </svg>
        </div>
        {/* the back, the side that was scanned: seen only as the card turns over */}
        <div style={{ ...face, transform: "rotateY(180deg)", boxShadow: "inset 0 0 0 1px rgba(20,24,18,0.10)" }}>
          <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" style={{ display: "block" }} focusable="false">
            <rect width={CARD_W} height={CARD_H} fill="#FFFFFF" />
            <g transform="translate(6 6) scale(0.275)" fill="none" stroke="url(#ins-foil)" strokeWidth="2.75" strokeLinecap="round"><path d={RING_L} /><path d={RING_R} /></g>
            <text data-tour="wordmark" x={78 + TRACK} y="10.7" textAnchor="end" fill="#B99A45" style={{ fontFamily: ui, fontSize: 3.53, fontWeight: 500, letterSpacing: TRACK }}>NOSCA</text>
            <rect x="6" y="16.25" width="72" height="0.5" rx="0.25" fill="url(#ins-foil)" />
            <rect x="6" y="22.6" width="31" height="2.7" rx="1.2" fill="#1C1C1E" />
            <rect x="6" y="27.9" width="13" height="1.8" rx="0.9" fill="#AEAEB2" />
            <rect x="6" y="35.4" width="24" height="1.8" rx="0.9" fill="#3A3A3C" />
            <rect x="6" y="39.1" width="45" height="1.8" rx="0.9" fill="#3A3A3C" />
            <rect x="6" y="47.4" width="52" height="1.6" rx="0.8" fill="#AEAEB2" />
            <path d={CODE} fill={BRAND} />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* the page's own motion. Every animation here fills `backwards`: the
   element's own style is the finished state, so what remains after the
   arrival — and all there ever is under Reduce Motion — is the page. */
const PAGE_CSS = `
@keyframes insTurn{from{transform:translateY(16px) rotateY(-180deg)}to{transform:none}}
@keyframes insDraw{from{stroke-dashoffset:1.02}to{stroke-dashoffset:0}}
@keyframes insFade{from{opacity:0}to{opacity:1}}
@keyframes insRule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes insShade{${SHADE}}
.calm *, .calm *::before, .calm *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
`;
/* the app's own Reduce motion switch (Settings), kept on the phone; the
   system's setting is honoured by index.css and INSTALL_CSS */
const appCalm = () => { try { return window.localStorage.getItem("nosca.ui.reduceMotion") === "true"; } catch (e) { return false; } };
/* the card's world: the paper and the greys are the app's, the one key the card's olive */
const PAGE = { ...NEUTRAL, accent: CLUB.olive, mark: CLUB.olive, onAccent: "#FFFFFF" };
const rise = (delay) => ({ animation: `insRise 560ms ${MOTION.curve} ${delay}ms backwards` });

export default function InstallPage() {
  useEffect(() => { registerSw(); }, []);
  const open = () => { haptic(10); window.location.assign("/"); };
  return (
    <ThemeCtx.Provider value={PAGE}>
      <div className={`ins flex flex-col${appCalm() ? " calm" : ""}`} data-tour="install-page" style={{ minHeight: "100dvh", background: PAGE.page, overflowX: "clip" }}>
        <style>{INSTALL_CSS}{PAGE_CSS}</style>
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="w-full mx-auto flex flex-col flex-1" style={{ maxWidth: 460 }}>
          {/* the way out to the app — sign-up, or the app for a member */}
          <div className="shrink-0 relative" style={{ height: 52 }}>
            <button onClick={open} aria-label={tr("Close")} data-tour="install-close" className="absolute flex items-center justify-center active:opacity-60"
                    style={{ right: 12, top: 4, width: 44, height: 44 }}>
              <X size={20} color={PAGE.ink} strokeWidth={2} />
            </button>
          </div>
          <div className="px-6">
            <InstallCard />
            {/* what Nosca is, for somebody who has only the card */}
            <p data-tour="install-what" className="text-center mx-auto" style={{ ...TYPE.body, color: PAGE.sub, textWrap: "balance", marginTop: 26, ...rise(300) }}>
              {tr("A coaching app: lessons, video and drills.")}
            </p>
            {/* the card's own rule, in its gold */}
            <span aria-hidden="true" className="block" style={{ height: 2, borderRadius: 2, margin: "24px 0 26px", transformOrigin: "0 50%",
                                                                background: `linear-gradient(90deg, ${FOIL[0][1]}, ${FOIL[2][1]} 52%, ${CLUB.gold})`,
                                                                animation: `insRule 760ms ${MOTION.curve} 380ms backwards` }} />
            <h1 style={{ ...TYPE.screen, color: PAGE.ink, marginBottom: 4, ...rise(440) }}>{tr("Add to Home Screen")}</h1>
            <div style={rise(500)}>
              <InstallGuide dress="card" wait={560} />
            </div>
          </div>
          <div className="px-6 shrink-0 mt-auto" style={{ paddingTop: 36, paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
            <Button tone="ink" onClick={open} tour="install-open">{tr("Open Nosca")}</Button>
            {/* the company's website, as the sign-in page carries it: a quiet line under the key, 44 to a finger */}
            <button data-tour="install-about" onClick={() => { haptic(6); openAbout(); }} className="w-full active:opacity-50"
                    style={{ minHeight: 44, marginTop: 6, fontFamily: ui, fontSize: 14, fontWeight: 600, color: PAGE.sub }}>
              {tr("About Nosca")}
            </button>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
