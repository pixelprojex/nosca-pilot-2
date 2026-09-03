import React, { useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { ThemeCtx, NEUTRAL, BRAND, tr, ui, display, R, STEADY, DANGER, Mark, Button, haptic, hapticSuccess } from "../Nosca";
import { joinLink, shareOrCopy, copyText } from "../lib/share";

/* ARRIVAL
 *
 * Shown once, straight after an account is created and before the app.
 * A coach sees their invite code; a parent their family code — the one
 * thing each of them needs to hand to someone else, large, with Copy
 * and Share right there. A player sees who they are linked to, or that
 * they can add a coach later. Then into the app, with or without the
 * walkthrough. Nothing here is asked again; the codes live in Settings
 * and Family from now on. */
export default function Arrival({ role, profile, data, onDone }) {
  const [note, setNote] = useState("");
  const timer = useRef(null);
  const isCoach = role === "coach";
  const isParent = role === "parent";
  const code = isCoach ? data.inviteCode : isParent ? data.familyCode : null;
  const url = code ? joinLink(isCoach ? "coach" : "family", code) : null;

  const flash = (m, bad) => {
    setNote({ m, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 2200);
  };
  const copy = async () => {
    if (!code) return;
    haptic(8);
    const ok = await copyText(code);
    if (ok) hapticSuccess();
    flash(ok ? tr("Copied") : tr("Couldn't copy"), !ok);
  };
  const share = async () => {
    if (!code) return;
    haptic(8);
    const text = isCoach
      ? `${tr("Join me on")} ${BRAND}. ${tr("Code")} ${code}`
      : `${tr("Join our family on")} ${BRAND}. ${tr("Code")} ${code}`;
    const r = await shareOrCopy({ title: `${tr("Join me on")} ${BRAND}`, text, url });
    if (r === "shared") { hapticSuccess(); flash(tr("Shared")); }
    else if (r === "copied") { hapticSuccess(); flash(tr("Link copied")); }
    else if (r === "failed") flash(tr("Couldn't share"), true);
  };

  const go = (tour) => {
    haptic(10);
    try {
      if (tour) window.sessionStorage.setItem("nosca.tour.now", "1");
      else window.localStorage.setItem(`nosca.seen.${profile.id}`, "1");   // the first-run tour keys off this
    } catch (e) { /* private mode — the app decides on its own */ }
    onDone();
  };

  /* what to say */
  let title, sub;
  if (isCoach) { title = tr("You're set up"); sub = tr("Players enter this code to join you."); }
  else if (isParent) { title = tr("You're set up"); sub = tr("Your children enter this when they sign up."); }
  else {
    const coach = data.coachName, guardian = data.guardianName;
    if (coach && guardian) { title = `${tr("You're with")} ${coach}`; sub = `${tr("And in")} ${guardian}${tr("'s family.")}`; }
    else if (coach) { title = `${tr("You're with")} ${coach}`; sub = tr("Lessons, drills and video from them land here."); }
    else if (guardian) { title = `${tr("You're in")} ${guardian}${tr("'s family")}`; sub = tr("No coach yet — add one from Home any time."); }
    else { title = tr("You're set up"); sub = tr("No coach yet — add one from Home any time."); }
  }

  const pill = (Icon, label, onClick) => (
    <button onClick={onClick} disabled={!code}
            className="inline-flex items-center justify-center gap-2 px-5 active:opacity-70 disabled:opacity-30"
            style={{ minHeight: 46, borderRadius: R.pill, border: `1px solid ${NEUTRAL.hair}`, background: NEUTRAL.surface,
                     fontFamily: ui, fontSize: 14.5, fontWeight: 600, color: NEUTRAL.ink }}>
      <Icon size={15} strokeWidth={2} />{label}
    </button>
  );

  return (
    <ThemeCtx.Provider value={NEUTRAL}>
      <div className="flex flex-col" style={{ height: "100dvh", background: NEUTRAL.page }}>
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="shrink-0 flex items-center justify-center gap-2 pt-4" style={{ animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) both" }}>
          <Mark size={15} color={NEUTRAL.faint} />
          <span style={{ fontFamily: display, fontSize: 9, letterSpacing: "0.34em", color: NEUTRAL.faint }}>{BRAND}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-7 text-center min-h-0" style={{ overflowY: "auto" }}>
          <h1 style={{ fontFamily: display, fontSize: 32, lineHeight: 1.04, letterSpacing: "-0.036em", color: NEUTRAL.ink,
                       animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) both" }}>{title}</h1>

          {code ? (
            <>
              <div className="mt-9" aria-label={tr("Your code")}
                   style={{ fontFamily: display, fontSize: 48, lineHeight: 1, letterSpacing: "0.24em", paddingLeft: "0.24em", color: NEUTRAL.ink,
                            animation: "fadeUp 560ms cubic-bezier(.22,1,.36,1) 120ms both" }}>
                {code}
              </div>
              <p className="mt-4" style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.5, color: NEUTRAL.sub, maxWidth: 300,
                                            animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 200ms both" }}>{sub}</p>
              <div className="mt-7 flex items-center justify-center gap-2.5" style={{ animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 280ms both" }}>
                {pill(Copy, tr("Copy"), copy)}
                {pill(Share2, tr("Share"), share)}
              </div>
              <p className="mt-4" aria-live="polite" style={{ fontFamily: ui, fontSize: 13, minHeight: 20, color: note && note.bad ? DANGER : STEADY,
                                            opacity: note ? 1 : 0, transition: "opacity 200ms" }}>{note ? note.m : ""}</p>
            </>
          ) : (
            <p className="mt-4" style={{ fontFamily: ui, fontSize: 15, lineHeight: 1.55, color: NEUTRAL.sub, maxWidth: 300,
                                          animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) 120ms both" }}>{sub}</p>
          )}
        </div>

        <div className="px-7 shrink-0" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
                                                 animation: "fadeUp 560ms cubic-bezier(.22,1,.36,1) 360ms both" }}>
          <Button tone="ink" onClick={() => go(true)}>{tr("Show me around")}</Button>
          <button onClick={() => go(false)} className="w-full mt-3 active:opacity-60"
                  style={{ minHeight: 44, fontFamily: ui, fontSize: 14.5, color: NEUTRAL.sub }}>
            {tr("Skip the tour")}
          </button>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
