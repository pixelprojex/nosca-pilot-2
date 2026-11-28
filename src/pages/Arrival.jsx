import React, { useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { ThemeCtx, NEUTRAL, BRAND, tr, ui, display, TYPE, SPACE, R, STEADY, DANGER, Button, haptic, lipOf, SOFT_LIP } from "../Nosca";
import { joinLink, shareOrCopy, copyText } from "../lib/share";
import { isStandalone } from "../lib/install";
import { AuthShell } from "./Auth";

/* ARRIVAL
 *
 * Shown once, straight after an account is created and before the app.
 * A coach sees their invite code; a parent their family code — the one
 * thing each of them needs to hand to someone else, large, with Copy
 * and Share right there. A player sees who they are linked to, or that
 * they can add a coach later. Then into the app, with or without the
 * walkthrough. Nothing here is asked again; the codes live in Settings
 * and Family from now on.
 *
 * IN THE FRONT DOOR'S SHELL (28 November): the bar with the brand's mark,
 * the title, the code on the wash as the app's own panel, Copy and Share
 * as the app's quiet keys (they were two pills on a 1px hairline), and
 * one key at the foot, Show me around — the line for the Home Screen
 * above it in a browser tab, Skip under it. Every key here is the app's
 * `Button`, which buzzes on the tap, so no handler adds a beat of its own. */
export default function Arrival({ role, profile, data, onDone }) {
  const [note, setNote] = useState("");
  const timer = useRef(null);
  const isCoach = role === "coach";
  const isParent = role === "parent";
  const code = isCoach ? data.inviteCode : isParent ? (data.family && data.family.code) || null : null;
  const url = code ? joinLink(isCoach ? "coach" : "family", code) : null;

  const flash = (m, bad) => {
    setNote({ m, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 2200);
  };
  const copy = async () => {
    if (!code) return;
    const ok = await copyText(code);
    flash(ok ? tr("Copied") : tr("Couldn't copy"), !ok);
  };
  const share = async () => {
    if (!code) return;
    const text = isCoach
      ? `${tr("Join me on")} ${BRAND}. ${tr("Code")} ${code}`
      : `${tr("Join our family on")} ${BRAND}. ${tr("Code")} ${code}`;
    const r = await shareOrCopy({ title: `${tr("Join me on")} ${BRAND}`, text, url });
    if (r === "shared") flash(tr("Shared"));
    else if (r === "copied") flash(tr("Link copied"));
    else if (r === "failed") flash(tr("Couldn't share"), true);
  };

  const go = (tour, install = false) => {
    /* The one thing that opens the walkthrough. Nothing else does — a
       sign-in on a new device used to replay it, because "have you seen
       this" was kept per browser rather than tied to signing up. The
       Home Screen guide is handed on the same way. */
    try {
      if (tour) window.sessionStorage.setItem("nosca.tour.now", "1");
      if (install) window.sessionStorage.setItem("nosca.install.now", "1");
    } catch (e) { /* private mode — they can start it from Settings */ }
    onDone();
  };

  /* what to say */
  let title, sub;
  if (isCoach) { title = tr("You're set up"); sub = tr("Players join with this code"); }
  else if (isParent && code) {
    title = data.family && data.family.members && data.family.members.length > 1 ? `${tr("You're in")} ${data.family.displayName}` : tr("Your family is set up");
    sub = tr("Your children join with this code");
  }
  else {
    const asked = data.myRequest && data.myRequest.coachName, fam = data.family && data.family.displayName;
    if (asked && fam) { title = `${tr("You've asked")} ${asked}`; sub = `${tr("You're in")} ${fam}`; }
    else if (asked) { title = `${tr("You've asked")} ${asked}`; sub = tr("You'll be told when they accept"); }
    else if (fam) { title = `${tr("You're in")} ${fam}`; sub = tr("Add a coach from Home"); }
    else { title = tr("You're set up"); sub = tr("Add a coach from Home"); }
  }

  const quiet = { minHeight: 44, fontFamily: ui, fontSize: 15, fontWeight: 600, color: NEUTRAL.sub };
  return (
    <ThemeCtx.Provider value={NEUTRAL}>
      <div style={{ height: "100dvh", background: NEUTRAL.page }}>
        <AuthShell title={title} sub={code ? null : sub}
                   footer={<>
                     {/* still in a browser tab: the way onto the phone, before the app */}
                     {!isStandalone() && (
                       <button onClick={() => { haptic(6); go(false, true); }} data-tour="arrival-install" className="w-full active:opacity-60" style={{ ...quiet, marginBottom: 4 }}>
                         {tr("Add Nosca to your Home Screen")}
                       </button>
                     )}
                     <Button tone="ink" onClick={() => go(true)}>{tr("Show me around")}</Button>
                     <button onClick={() => { haptic(6); go(false); }} className="w-full active:opacity-60" style={{ ...quiet, marginTop: 2 }}>
                       {tr("Skip")}
                     </button>
                   </>}>
          {code && (<>
            {/* the code, on the wash as the app's own panel: large, spaced, never cut — its size follows a narrow phone */}
            <div data-arrival-code="" className="text-center" style={{ padding: "26px 12px 20px", borderRadius: R.surface, background: NEUTRAL.wash, boxShadow: lipOf(SOFT_LIP(NEUTRAL), 2) }}>
              <div aria-label={`${tr("Your code")} ${code.split("").join(" ")}`} style={{ fontFamily: display, fontSize: "clamp(34px, 11vw, 46px)", fontWeight: 600, lineHeight: 1,
                                                                                     letterSpacing: "0.2em", paddingLeft: "0.2em", color: NEUTRAL.ink, fontVariantNumeric: "tabular-nums lining", whiteSpace: "nowrap" }}>
                {code}
              </div>
              <p style={{ ...TYPE.small, color: NEUTRAL.sub, marginTop: 14 }}>{sub}</p>
            </div>
            <div className="grid grid-cols-2" style={{ gap: SPACE.tight, marginTop: SPACE.row }}>
              <Button tone="quiet" onClick={copy}><span className="inline-flex items-center justify-center gap-2"><Copy size={17} strokeWidth={2} aria-hidden="true" />{tr("Copy")}</span></Button>
              <Button tone="quiet" onClick={share}><span className="inline-flex items-center justify-center gap-2"><Share2 size={17} strokeWidth={2} aria-hidden="true" />{tr("Share")}</span></Button>
            </div>
            {/* the answer, in the room kept for it: nothing moves when it comes and goes */}
            <p aria-live="polite" className="text-center" style={{ ...TYPE.small, minHeight: 20, marginTop: SPACE.tight, color: note && note.bad ? DANGER : STEADY,
                                                                  opacity: note ? 1 : 0, transition: "opacity 200ms" }}>{note ? note.m : ""}</p>
          </>)}
        </AuthShell>
      </div>
    </ThemeCtx.Provider>
  );
}
