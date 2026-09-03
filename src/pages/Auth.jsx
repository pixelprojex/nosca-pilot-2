import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ThemeCtx, NEUTRAL, BRAND, tr, ui, display,
  hapticSuccess, hapticWarn, haptic, Mark, Frame, Headline, Sub, Field, Button,
  PickSport, PickRole, PickPlayerType, CreateAccount, CodeBoxes,
} from "../Nosca";

/* SIGN UP AND SIGN IN
 *
 * One call creates the account. Everything the profile needs travels
 * with it as metadata, and a database trigger writes the profile row
 * inside the same transaction. There is no second step that can fail,
 * which is what kept leaving accounts half-created.
 *
 * The order of screens follows the same principle every large app
 * settled on: one decision per screen, cheapest questions first,
 * commitment last. Nobody is asked for a password before they know
 * what they are signing up to.
 *
 *   coach   coach or player → sport → details
 *   player  coach or player → player type → sport → details → code
 *
 * The code is last and skippable, because most people sign up before
 * their coach has sent them anything.
 */

const friendly = (msg) => {
  const m = (msg || "").toLowerCase();
  if (m.includes("already registered") || m.includes("already exists"))
    return "There's already an account with that email. Try signing in.";
  if (m.includes("invalid login")) return "That email and password don't match.";
  if (m.includes("email not confirmed"))
    return "This account still needs its email confirmed. Check your inbox, or turn off \"Confirm email\" in Supabase → Authentication → Sign In / Providers.";
  if (m.includes("password")) return "Passwords need at least 6 characters.";
  if (m.includes("database error"))
    return "The database rejected the sign-up. Run supabase/nosca.sql in Supabase, then try again.";
  if (m.includes("failed to fetch") || m.includes("networkerror"))
    return "Couldn't reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
};

export default function Auth() {
  const [stage, setStage] = useState("landing");
  const [side, setSide] = useState(null);       // coach | player
  const [kind, setKind] = useState(null);       // adult | junior | parent
  const [sport, setSport] = useState(null);
  const [details, setDetails] = useState(null); // held while the code screen runs
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const isCoach = side === "coach";

  /* ---------- sign in ---------- */
  const signIn = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      if (error) { hapticWarn(); setErr(friendly(error.message)); }
      /* On success the auth listener notices and the app swaps over.
         Nothing to do here. */
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message));
    }
    setBusy(false);
  };

  /* ---------- create the account ----------
     One call. The trigger does the rest. */
  const createAccount = async (d, joinCode) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const dob = d.dob && d.dob.y && d.dob.m && d.dob.d
        ? `${d.dob.y}-${String(d.dob.m).padStart(2, "0")}-${String(d.dob.d).padStart(2, "0")}`
        : null;

      /* A code is checked before the account exists, not after. The
         database deliberately never fails a sign-up over a code it
         doesn't recognise — so without this, a mistyped code would
         create the account silently unlinked and drop the person on
         "Add your coach" with no idea why. The lookup is the same one
         the home screen uses, callable without a session. */
      const code = (joinCode || "").trim().toUpperCase();
      if (code) {
        const { data: found, error: findErr } = await supabase.rpc("find_coach_by_code", { p_code: code });
        if (findErr) { hapticWarn(); setErr("Couldn't check that code. Try again, or skip for now."); setBusy(false); return; }
        if (!found || found.length === 0) { hapticWarn(); setErr("That code doesn't match a coach. Check it, or skip for now."); setBusy(false); return; }
      }

      const { data, error } = await supabase.auth.signUp({
        email: d.email.trim().toLowerCase(),
        password: d.password,
        options: {
          data: {
            role: isCoach ? "coach" : "player",
            name: d.name.trim(),
            sport,
            account_type: isCoach ? "coach" : (kind || "adult"),
            date_of_birth: dob,
            phone: (d.phone || "").trim(),
            coach_code: code,
          },
        },
      });

      if (error) { hapticWarn(); setErr(friendly(error.message)); setBusy(false); return; }

      /* With email confirmation on, Supabase answers a sign-up for an
         address that already has an account with a fake, identity-less
         user instead of an error — so nobody can probe which emails are
         registered. Read that way, the honest message is "sign in". */
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        hapticWarn(); setErr(friendly("already registered")); setBusy(false); return;
      }

      /* The account and its profile both exist now. If email
         confirmation is switched on there's no session yet, so say so
         plainly rather than appearing to hang. */
      if (!data.session) {
        setErr("Account created. Confirm your email, then sign in. "
             + "(To skip this during the pilot: Supabase → Authentication → Sign In / Providers → turn off \"Confirm email\".)");
        setBusy(false);
        return;
      }

      hapticSuccess();
      /* Session exists — the auth listener takes over from here. */
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message));
    }
    setBusy(false);
  };

  const wrap = (node) => (
    <ThemeCtx.Provider value={NEUTRAL}>
      <div style={{ height: "100dvh", background: NEUTRAL.page }}>{node}</div>
    </ThemeCtx.Provider>
  );

  const Err = () => err ? (
    <p className="mt-4" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.5, color: "#C4342A" }}>
      {err}
    </p>
  ) : null;

  /* ---------- landing ---------- */
  if (stage === "landing") {
    return (
      <ThemeCtx.Provider value={NEUTRAL}>
        <div className="flex flex-col" style={{ height: "100dvh", background: NEUTRAL.page }}>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span style={{ animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) both" }}><Mark size={40} /></span>
            <span className="mt-5" style={{ fontFamily: display, fontSize: 13,
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
    const ready = email.includes("@") && pass.length >= 6;
    return wrap(
      <Frame onBack={() => { setStage("landing"); setErr(""); }}
             footer={<Button tone="ink" disabled={busy || !ready} onClick={signIn}>
                       {busy ? "…" : tr("Sign in")}
                     </Button>}>
        <div className="pt-6">
          <Headline>{tr("Sign in")}</Headline>
          <div className="mt-8">
            <Field label={tr("Email")} value={email} onChange={(v) => { setEmail(v); setErr(""); }}
                   ph="you@example.ie" type="email" autoFocus />
            <Field label={tr("Password")} value={pass} onChange={(v) => { setPass(v); setErr(""); }}
                   type="password" ph="" reveal />
            <Err />
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
                 onPick={(id) => { setSport(id); setStage("details"); }}
                 onBack={() => setStage(isCoach ? "side" : "playerType")} />
    );
  }

  /* ---------- 5 · the coach's code, last and optional ---------- */
  if (stage === "code") {
    return wrap(
      <Frame onBack={() => { setStage("details"); setErr(""); }}
             footer={<>
               <Button tone="ink" disabled={busy || code.trim().length < 6}
                       onClick={() => createAccount(details, code)}>
                 {busy ? "…" : tr("Join coach")}
               </Button>
               <button onClick={() => { haptic(6); createAccount(details, ""); }} disabled={busy}
                       className="w-full mt-3 active:opacity-60 disabled:opacity-40"
                       style={{ minHeight: 50, fontFamily: ui, fontSize: 14.5, color: NEUTRAL.sub }}>
                 {tr("Skip for now")}
               </button>
             </>}>
        <div className="pt-6">
          <Headline>{tr("Your coach's code")}</Headline>
          <Sub>{tr("Six characters. You can also add this later from your home screen.")}</Sub>
          <div className="mt-9">
            <CodeBoxes value={code} onChange={(v) => { setCode(v); setErr(""); }} bad={!!err} />
            <Err />
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- 4 · details ---------- */
  return wrap(
    <>
      <CreateAccount role={isCoach ? "coach" : "player"} lang="en" busy={busy}
                     onBack={() => { setStage("sport"); setErr(""); }}
                     onDone={(d) => {
                       setErr("");
                       /* A coach is done. A player gets the code screen. */
                       if (isCoach) { createAccount(d, ""); return; }
                       setDetails(d); setStage("code");
                     }} />
      <div className="px-7" style={{ paddingBottom: err ? 16 : 0 }}><Err /></div>
    </>
  );
}
