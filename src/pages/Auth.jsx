import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import {
  ThemeCtx, NEUTRAL, BRAND, tr,
  hapticSuccess, Mark, Frame, Headline, Sub, Field, Button,
  PickSport, PickRole, PickPlayerType, CreateAccount, CodeBoxes,
} from "../Nosca";

/* SIGN UP
 *
 * One question per screen, each with a short list:
 *   coach   — coach or player · coach type · sport · details
 *   player  — coach or player · player type · sport · code · details
 *
 * No region, no language: the pilot is Ireland, in English. No pricing
 * anywhere — coaching accounts are free for the pilot and the
 * interface should not imply otherwise.
 */

const makeCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const readable = (err) => {
  const m = /PILOT LIMIT: (.+)/.exec(err?.message || "");
  return m ? m[1] : err?.message || "Something went wrong.";
};

export default function Auth() {
  const { beginSignUp, endSignUp } = useAuth();
  const [stage, setStage] = useState("landing");
  const [side, setSide] = useState(null);        // coach | player
  const [kind, setKind] = useState(null);        // head/assistant · adult/junior/parent
  const [sport, setSport] = useState(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(null);   // details held while the code step runs
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const isCoach = side === "coach";

  const signIn = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setErr(error.message);
    setBusy(false);
  };

  const createAccount = async ({ name, email: em, password, phone, dob }, useCode = true) => {
    setBusy(true); setErr("");
    beginSignUp();

    try {
      const exact = dob && dob.y && dob.m && dob.d
        ? `${dob.y}-${String(dob.m).padStart(2, "0")}-${String(dob.d).padStart(2, "0")}`
        : null;

      /* A code is optional. Without one the account is created empty and
         the person adds a coach from their home screen whenever they
         have it — which is the common case, since most people sign up
         before their coach has sent anything. */
      let coach = null;
      if (!isCoach && useCode && code.trim().length >= 4) {
        const { data: rows } = await supabase.rpc("find_coach_by_code", { p_code: code.trim().toUpperCase() });
        coach = rows?.[0];
        if (!coach) { endSignUp(); setErr("That code doesn't match a coach."); setBusy(false); return; }
      }

      const { data, error } = await supabase.auth.signUp({ email: em, password });
      if (error) { endSignUp(); setErr(error.message); setBusy(false); return; }
      if (!data.user) { endSignUp(); setErr("Check your email to confirm the account, then sign in."); setBusy(false); return; }

      const { error: pErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        role: isCoach ? "coach" : "player",
        name,
        phone: phone || null,
        date_of_birth: exact,
        account_type: kind,
        sport: isCoach ? sport : (coach ? coach.sport : sport),
        ...(isCoach ? { invite_code: makeCode() } : (coach ? { coach_id: coach.id } : {})),
      });
      if (pErr) { endSignUp(); setErr(readable(pErr)); setBusy(false); return; }
      /* The row exists now, so the auth listener's next look will find it
         and the app swaps itself over. */
      endSignUp();
      setBusy(false);
    } catch (e) {
      /* Whatever went wrong — a network hiccup, anything unforeseen —
         the button must end up in a state the person can act on, not
         a spinner that never resolves. This is what "Continue does
         nothing" almost always turns out to be. */
      endSignUp();
      setBusy(false);
      setErr((e && e.message) || "Something went wrong. Please try again.");
    }
  };

  const wrap = (node) => (
    <ThemeCtx.Provider value={NEUTRAL}>
      <div style={{ height: "100dvh", background: NEUTRAL.page }}>{node}</div>
    </ThemeCtx.Provider>
  );

  /* ---------- landing ---------- */
  if (stage === "landing") {
    return (
      <ThemeCtx.Provider value={NEUTRAL}>
        <div className="flex flex-col" style={{ height: "100dvh", background: NEUTRAL.page }}>
          {/* The mark sits in the optical centre of the upper half, with
              the buttons anchored low — the composition a title page
              takes, rather than everything bunched in the middle. */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <span style={{ animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) both" }}>
              <Mark size={40} />
            </span>
            <span className="mt-5" style={{ fontFamily: "'Cabinet Grotesk', ui-sans-serif", fontSize: 13,
                           letterSpacing: "0.42em", paddingLeft: "0.42em", color: NEUTRAL.ink,
                           animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) 90ms both" }}>{BRAND}</span>
          </div>

          <div className="px-7" style={{ paddingBottom: "max(34px, env(safe-area-inset-bottom, 34px))",
                                          animation: "fadeUp 640ms cubic-bezier(.22,1,.36,1) 200ms both" }}>
            <div className="mb-2.5">
              <Button tone="ink" onClick={() => { setErr(""); setStage("side"); }}>{tr("Create account")}</Button>
            </div>
            <Button tone="quiet" onClick={() => { setErr(""); setStage("signin"); }}>{tr("Sign in")}</Button>
          </div>
        </div>
      </ThemeCtx.Provider>
    );
  }

  /* ---------- sign in ---------- */
  if (stage === "signin") {
    return wrap(
      <Frame onBack={() => { setStage("landing"); setErr(""); }}
             footer={<Button tone="ink" disabled={busy || !email || !pass} onClick={signIn}>
                       {busy ? "…" : tr("Sign in")}
                     </Button>}>
        <div className="pt-6">
          <Headline>{tr("Sign in")}</Headline>
          <div className="mt-8">
            <Field label={tr("Email")} value={email} onChange={setEmail} ph="you@example.ie" type="email" autoFocus />
            <Field label={tr("Password")} value={pass} onChange={setPass} type="password" ph="" reveal />
            {err && <p className="mt-3" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- 1 · coach or player ---------- */
  if (stage === "side") {
    return wrap(
      <PickRole lang="en"
                onPick={(r) => { setSide(r); setStage(r === "coach" ? "sport" : "playerType"); }}
                onBack={() => setStage("landing")} />
    );
  }

  /* ---------- 2 · which kind of player ---------- */
  if (stage === "playerType") {
    return wrap(
      <PickPlayerType lang="en"
                      onPick={(k) => { setKind(k); setStage("sport"); }}
                      onBack={() => setStage("side")} />
    );
  }

  /* ---------- 3 · sport ---------- */
  if (stage === "sport") {
    return wrap(
      <PickSport lang="en"
                 onPick={(id) => { setSport(id); setStage("account"); }}
                 onBack={() => setStage(isCoach ? "side" : "playerType")} />
    );
  }

  /* ---------- 4 · your coach, optional and last ---------- */
  if (stage === "connect") {
    return wrap(
      <Frame onBack={() => setStage("account")}
             footer={<>
               <Button tone="ink" disabled={busy || code.trim().length < 4}
                       onClick={() => { hapticSuccess(); createAccount(pending); }}>
                 {busy ? "…" : tr("Add coach")}
               </Button>
               <button onClick={() => { haptic(6); setCode(""); setErr(""); createAccount(pending, false); }} disabled={busy}
                       className="w-full mt-3 active:opacity-60"
                       style={{ minHeight: 50, fontFamily: "'Switzer'", fontSize: 14.5, color: NEUTRAL.faint }}>
                 {tr("I'll do this later")}
               </button>
             </>}>
        <div className="pt-6">
          <Headline>{tr("Your coach")}</Headline>
          <Sub>{tr("Enter their code, or add it any time from your home screen.")}</Sub>
          <div className="mt-9">
            <CodeBoxes value={code} onChange={(v) => { setCode(v); setErr(""); }} bad={!!err} />
            {err && <p className="mt-3 text-center" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- details ---------- */
  return wrap(
    <>
      <CreateAccount role={isCoach ? "coach" : "player"} lang="en" busy={busy}
                     onBack={() => setStage("sport")}
                     onDone={(d) => {
                       /* A coach is finished here. A player gets one
                          more, optional, screen. */
                       if (isCoach) { createAccount(d); return; }
                       setPending(d); setStage("connect");
                     }} />
      {(err || busy) && (
        <p className="px-7 pb-4" style={{ fontFamily: "'Switzer'", fontSize: 13, color: err ? "#C4342A" : NEUTRAL.faint }}>
          {err || tr("Creating your account…")}
        </p>
      )}
    </>
  );
}
