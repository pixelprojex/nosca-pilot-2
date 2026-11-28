import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ThemeCtx, NEUTRAL, CLUB, tr, ui, TYPE, MOTION, Button, InstallGuide, INSTALL_CSS, haptic, openAbout } from "../Nosca";
import { RING_L, RING_R } from "../lib/brandmark.jsx";
import { registerSw } from "../lib/push";
import { isStandalone, canPromptInstall, onInstallPromptChange } from "../lib/install";

/* ADD TO HOME SCREEN — https://<site>/install
 *
 * The page the business card's code opens: the first thing anyone sees
 * of Nosca after being handed the card. The paper is the card's own
 * back — white, a rule in gold — with the two cards the founder hands
 * out lying on it, drawn from the print files' numbers. Under them one
 * line says what Nosca is, and then the guide (InstallGuide in Nosca, in
 * its card dress) shows this phone's steps and no other.
 *
 * TIDIED (28 November). The founder: "people found that very confusing.
 * They thought that they just tapped on the buttons on it, rather than
 * following those instructions … way too much text … really complex."
 * So the steps draw no key any more (InstallGuide says how), there are
 * four of them at most, the cards are smaller and lie still — they
 * turned over and drew their foil in for two seconds — and the page has
 * ONE key that is a key: Install Nosca where the browser offers it (the
 * guide's), otherwise Continue in the browser, filled in the card's
 * olive at the foot. With the browser's offer there, Continue is the
 * quiet key under it.
 *
 * Continue and the X hand over to the app IN THIS PAGE (App.jsx's
 * `leaveInstall`: the address becomes "/" and the gate swaps the page
 * for sign-up, or the app for a member, under a cross-fade where the
 * browser has view transitions) — no reload, no white page between. The
 * worker is registered here too: Chrome's install criteria want one, and
 * the app registers it only once somebody is signed in. */

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
/* THE DEEP GREEN'S FRONT is the first print file's (scripts/business-card.py
   as it was first committed, the files the founder printed the deep green
   from): the same stripes — the lines x + y = c, 3.6 mm apart, the same
   phase — across the top 15 mm and the foot 15 mm, and a clear band through
   the middle where the mark and NOSCA stand; no gold edge. Each stripe is
   drawn outward from the band. */
const BAND_TOP = 15, BAND_FOOT = 40;
const BAND = (() => {
  const top = [], foot = [], f = (n) => Number(n.toFixed(2));
  for (let c = PHASE; c < CARD_W + CARD_H; c += PITCH) {
    /* above the band: from its edge (y = 15) up to the card's top, clipped to the card's sides */
    const ts = Math.min(BAND_TOP, c), te = Math.max(0, c - CARD_W);
    if (ts > te) top.push(`M${f(c - ts)} ${f(ts)}L${f(c - te)} ${f(te)}`);
    /* under it: from its edge (y = 40) down to the card's foot */
    const fs = Math.max(BAND_FOOT, c - CARD_W), fe = Math.min(CARD_H, c);
    if (fe > fs) foot.push(`M${f(c - fs)} ${f(fs)}L${f(c - fe)} ${f(fe)}`);
  }
  return [...top, ...foot];
})();
/* the foil, lit from the top left as the print preview lights it */
const FOIL = [[0, "#B08630"], [0.38, "#E2BE60"], [0.5, "#FAE6A0"], [0.62, "#DEB85A"], [1, "#A07626"]];
const TRACK = 0.42 * 3.53;   // NOSCA at 10 pt, tracked 0.42 em, in the card's millimetres
const face = { position: "absolute", inset: 0, overflow: "hidden", borderRadius: "4.17% / 6.36%" };

/* THE TWO CARDS (24 November). The founder hands out two designs, and
   each is drawn as it was printed: the deep green with the pinstripes
   across its top and its foot and the band clear through the middle (the
   first print file), and the olive with the two wedges in opposite
   corners — the same white back, the same code. Both are laid on the
   paper, the deep green in front and the olive behind it, so whichever
   was scanned is the card on the screen; each comes over from its white
   side in its turn. The founder, 24 November: "our original design for
   the business cards was the darker color with the vertical lines, not
   diagonal lines … I don't know why they both have the same diagonal
   lines" — both had been drawn with the olive's wedges. The deep green is
   the press's own render of its ground (scripts/business-card.py's GREEN,
   CMYK 0.85/0.35/0.55/0.60), the olive the app's own CLUB.olive. */
const CARD_GREEN = "#183D3A";
/* each card lies still, its front up: the stripes, the mark and NOSCA in the foil */
function OneCard({ ground, id, design, style }) {
  const foil = `url(#ins-foil-${id})`;
  return (
    <div data-card={id} data-design={design} className="absolute" style={{ aspectRatio: `${CARD_W} / ${CARD_H}`, ...style }}>
      {/* what the card rests on: a soft shadow on the paper */}
      <span aria-hidden="true" className="absolute" style={{ left: "5%", right: "5%", top: "18%", bottom: "4%", borderRadius: 12, boxShadow: "0 12px 20px -8px rgba(26,32,14,0.32), 0 4px 8px -4px rgba(26,32,14,0.2)" }} />
      <div aria-hidden="true" style={{ ...face, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
        <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" style={{ display: "block" }} focusable="false">
          <defs>
            <linearGradient id={`ins-foil-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={CARD_W} y2={CARD_H}>
              {FOIL.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
            </linearGradient>
          </defs>
          <rect width={CARD_W} height={CARD_H} fill={ground} />
          <g fill="none" stroke={foil}>
            {design === "band"
              ? BAND.map((d) => <path key={d} data-stripe="" d={d} strokeWidth="0.4" />)
              : (<>
                  <path data-edge="" d="M39.85 0L84 30.52" strokeWidth="0.5" />
                  <path data-edge="" d="M44.15 55L0 24.48" strokeWidth="0.5" />
                  {STRIPES.map((d) => <path key={d} data-stripe="" d={d} strokeWidth="0.4" />)}
                </>)}
            {/* the mark, 22 mm wide and centred */}
            <g transform="translate(31 17.5) scale(0.55)" strokeWidth="2.75" strokeLinecap="round"><path d={RING_L} /><path d={RING_R} /></g>
          </g>
          <text data-tour="wordmark" x={CARD_W / 2 + TRACK / 2} y="36.72" textAnchor="middle" fill={foil}
                style={{ fontFamily: ui, fontSize: 3.53, fontWeight: 500, letterSpacing: TRACK }}>NOSCA</text>
        </svg>
      </div>
    </div>
  );
}
/* the two, laid on the paper: the deep green in front, the olive behind with its mark in sight; they arrive in one
   soft rise and then lie still. The box is drawn at its full size from the first frame, so nothing under it moves */
function InstallCard() {
  return (
    <div data-tour="install-card" role="img" aria-label={tr("The two Nosca cards: two woven rings and NOSCA in gold, one on deep green with gold pinstripes across its top and foot, one on olive green with gold pinstripes in two corners")}
         className="ins-card relative mx-auto" style={{ aspectRatio: `${CARD_W} / ${CARD_H}`, animation: `insRise 620ms ${MOTION.curve} 60ms backwards` }}>
      <OneCard id="olive" ground={CLUB.olive} design="wedges" style={{ left: 0, top: 0, width: "70%", transform: "rotate(-6deg)", zIndex: 1 }} />
      <OneCard id="green" ground={CARD_GREEN} design="band" style={{ right: 0, bottom: 0, width: "70%", transform: "rotate(2.5deg)", zIndex: 2 }} />
    </div>
  );
}

/* the page's own motion: one soft rise each, in turn, every one filling
   `backwards`, so the element's own style is the finished page — and all
   there ever is under Reduce Motion.

   THE LAYOUT. On a phone it is one column: the cards, the line, the rule,
   the title and the steps, and the key at the foot — on a 390 × 844
   phone all of it on the first screen. From 720 wide (an iPad, a
   computer) it is two columns, composed: the cards, the line, the rule
   and the key on the left, standing still, the title and the steps on
   the right; the whole hung from a fixed top, never centred on its own
   height — centred, opening Change moved the very row just clicked out
   from under the pointer; the X in the screen's corner. */
const PAGE_CSS = `
@keyframes insRule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.calm *, .calm *::before, .calm *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
.ins-shell{width:100%;max-width:460px;margin:0 auto;display:flex;flex-direction:column;flex:1 1 auto}
.ins-x{position:relative;flex:none;height:44px}
.ins-card{width:min(212px,58vw)}
.ins-what{margin-top:clamp(16px,2.6vh,22px)}
.ins-rule{margin:clamp(14px,2.2vh,20px) auto clamp(16px,2.4vh,22px);width:56px}
.ins-foot{margin-top:auto;padding-top:32px}
@media (min-width:720px) and (min-height:520px){
  .ins-shell{max-width:1000px;flex:none;margin:0 auto;padding:clamp(56px,12vh,140px) 0 48px;display:grid;grid-template-columns:minmax(0,320px) minmax(0,400px);grid-template-rows:auto minmax(0,1fr);column-gap:64px;justify-content:center;align-items:start}
  .ins-x{display:contents}
  .ins-x > button{right:20px !important;top:16px !important}
  .ins-lead{grid-column:1;grid-row:1;position:sticky;top:40px}
  .ins-foot{grid-column:1;grid-row:2;margin-top:0;padding-top:0;position:sticky;top:calc(40px + var(--ins-lead-h, 0px))}
  .ins-main{grid-column:2;grid-row:1 / span 2}
  .ins-card{width:min(260px,100%)}
  .ins-what{margin-top:26px}
  .ins-rule{margin:22px auto 26px}
  .ins-done .ins-main{align-self:center}
}
@media (min-width:1000px) and (min-height:520px){
  .ins-shell{grid-template-columns:minmax(0,380px) minmax(0,440px);column-gap:96px}
  .ins-card{width:min(300px,100%)}
}
`;
/* the app's own Reduce motion switch (Settings), kept on the phone; the
   system's setting is honoured by index.css and INSTALL_CSS */
const appCalm = () => { try { return window.localStorage.getItem("nosca.ui.reduceMotion") === "true"; } catch (e) { return false; } };
/* the card's world: the paper and the greys are the app's, the one key the card's olive */
const PAGE = { ...NEUTRAL, accent: CLUB.olive, mark: CLUB.olive, onAccent: "#FFFFFF" };
const rise = (delay) => ({ animation: `insRise 520ms ${MOTION.curve} ${delay}ms backwards` });

export default function InstallPage({ onLeave }) {
  useEffect(() => { registerSw(); }, []);
  /* into the app in this page (the gate's hand-over); on its own, a plain load of the app */
  const open = () => { haptic(10); if (onLeave) onLeave(); else window.location.assign("/"); };
  /* once the app is on a Home Screen there is nothing left to add: the title goes */
  const [done, setDone] = useState(isStandalone);
  /* the browser's own install, while it is offered, is the page's one key; Continue then steps back to the quiet key */
  const [offer, setOffer] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange((on) => setOffer(on)), []);
  /* the left column's height, for the key that stands under it on a wide screen */
  const shell = useRef(null), lead = useRef(null);
  useEffect(() => {
    const el = lead.current, box = shell.current;
    if (!el || !box || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => box.style.setProperty("--ins-lead-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <ThemeCtx.Provider value={PAGE}>
      <div className={`ins relative flex flex-col${appCalm() ? " calm" : ""}`} data-tour="install-page" style={{ minHeight: "100dvh", background: PAGE.page, overflowX: "clip" }}>
        <style>{INSTALL_CSS}{PAGE_CSS}</style>
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div ref={shell} className={`ins-shell${done ? " ins-done" : ""}`}>
          {/* the way out to the app — sign-up, or the app for a member */}
          <div className="ins-x">
            <button onClick={open} aria-label={tr("Close")} data-tour="install-close" className="absolute flex items-center justify-center active:opacity-60"
                    style={{ right: 10, top: 0, width: 44, height: 44 }}>
              <X size={20} color={PAGE.ink} strokeWidth={2} />
            </button>
          </div>
          <div ref={lead} className="ins-lead px-6">
            <InstallCard />
            {/* what Nosca is, for somebody who has only the card */}
            <p data-tour="install-what" className="ins-what text-center mx-auto" style={{ ...TYPE.body, color: PAGE.sub, textWrap: "balance", ...rise(180) }}>
              {tr("A coaching app: lessons, video and drills.")}
            </p>
            {/* the card's own rule, in its gold */}
            <span aria-hidden="true" className="ins-rule block" style={{ height: 2, borderRadius: 2,
                                                                         background: `linear-gradient(90deg, ${FOIL[0][1]}, ${FOIL[2][1]} 52%, ${CLUB.gold})`,
                                                                         animation: `insRule 640ms ${MOTION.curve} 240ms backwards` }} />
          </div>
          <div className="ins-main px-6">
            {!done && <h1 style={{ ...TYPE.screen, color: PAGE.ink, ...rise(280) }}>{tr("Add to Home Screen")}</h1>}
            <div style={rise(320)}>
              <InstallGuide dress="card" wait={340} onDone={() => setDone(true)} />
            </div>
          </div>
          <div className="ins-foot px-6 shrink-0" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}>
            {/* THE ONE KEY when the browser offers nothing: into the app, in this page; inside the installed app it is the app */}
            <Button tone={offer && !done ? "quiet" : "accent"} onClick={open} tour="install-open">{isStandalone() ? tr("Open Nosca") : tr("Continue in the browser")}</Button>
            {/* the company's website, as the sign-in page carries it: a quiet line under the key, 44 to a finger */}
            <button data-tour="install-about" onClick={() => { haptic(6); openAbout(); }} className="w-full active:opacity-50"
                    style={{ minHeight: 44, marginTop: 2, fontFamily: ui, fontSize: 14, fontWeight: 600, color: PAGE.sub }}>
              {tr("About Nosca")}
            </button>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
