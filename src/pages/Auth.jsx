import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ThemeCtx, NEUTRAL, SPORTS, BRAND, tr,
  hapticSuccess, Mark, Frame, Headline, Sub, Field, Button,
  PickRegion, PickSport, PickRole, PickWho, CreateAccount,
} from "../Nosca";

/* THE REAL SIGN-UP.
 *
 * Every screen here is the prototype's own: PickRegion, PickSport,
 * PickRole, PickWho, CreateAccount. They already handle the
 * three-box date of birth with auto-advance, inline validation, the
 * consent-age rule, and the progress dots that count the right number
 * of steps for a coach versus a player. This file's only job is to
 * walk through them in order and write the result to the database.
 *
 * The journey, as defined by JOURNEY in Nosca.jsx:
 *   coach  — region, sport, role, account, code
 *   player — region, sport, role, who, account, connect
 */

const makeCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const readable = (err) => {
  const m = /PILOT LIMIT: (.+)/.exec(err?.message || "");
  return m ? m[1] : err?.message || "Something went wrong.";
};

export default function Auth() {
  const [stage, setStage] = useState("landing");
  const [region, setRegion] = useState(null);
  const [lang, setLang] = useState("en");
  const [sport, setSport] = useState(null);
  const [role, setRole] = useState(null);      // coach | player
  const [who, setWho] = useState(null);        // me | child | both  (players only)
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /* ---------- sign in ---------- */
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const signIn = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setErr(error.message);
    setBusy(false);
  };

  /* ---------- the write ---------- */
  const createCoach = async ({ name, email, password, dob }) => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErr(error.message); setBusy(false); return false; }
    const { error: pErr } = await supabase.from("profiles").insert({
      id: data.user.id, role: "coach", name, sport,
      invite_code: makeCode(), date_of_birth: dob,
    });
    if (pErr) { setErr(readable(pErr)); setBusy(false); return false; }
    setBusy(false);
    return true;
  };

  const createPlayer = async ({ name, email, password, dob }) => {
    setBusy(true); setErr("");
    const { data: rows, error: findErr } = await supabase.rpc("find_coach_by_code", { p_code: code.trim() });
    const coach = rows?.[0];
    if (findErr || !coach) { setErr("That invite code doesn't match a coach."); setBusy(false); return false; }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErr(error.message); setBusy(false); return false; }
    const { error: pErr } = await supabase.from("profiles").insert({
      id: data.user.id, role: "player", name, sport: coach.sport, coach_id: coach.id,
      date_of_birth: dob,
    });
    if (pErr) { setErr(readable(pErr)); setBusy(false); return false; }
    setBusy(false);
    return true;
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
        <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: NEUTRAL.page }}>
          <span style={{ animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) both" }}><Mark size={44} /></span>
          <span className="mt-4" style={{ fontFamily: "'Cabinet Grotesk', ui-sans-serif", fontSize: 15,
                         letterSpacing: "0.32em", color: NEUTRAL.ink,
                         animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) 60ms both" }}>{BRAND}</span>
          <div className="w-full mt-16" style={{ animation: "fadeUp 560ms cubic-bezier(.22,1,.36,1) 140ms both" }}>
            <div className="mb-2.5">
              <Button tone="ink" onClick={() => { setErr(""); setStage("region"); }}>{tr("Sign up")}</Button>
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
      <Frame step={0} steps={1} onBack={() => { setStage("landing"); setErr(""); }}
             footer={<Button tone="ink" disabled={busy || !email || !pass} onClick={signIn}>
                       {busy ? "…" : tr("Sign in")}
                     </Button>}>
        <div className="pt-8">
          <Headline>{tr("Welcome back")}</Headline>
          <Sub>{tr("Sign in to pick up where you left off.")}</Sub>
          <div className="mt-8">
            <Field label={tr("Email")} value={email} onChange={setEmail} ph="you@example.ie" type="email" autoFocus />
            <Field label={tr("Password")} value={pass} onChange={setPass} type="password" ph="" reveal />
            {err && <p className="mt-3" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- 1 · region and language ---------- */
  if (stage === "region") {
    return wrap(
      <PickRegion region={region} setRegion={setRegion} lang={lang} setLang={setLang}
                  path={role === "coach" ? "coach" : "player"}
                  onDone={() => setStage("sport")} />
    );
  }

  /* ---------- 2 · sport ---------- */
  if (stage === "sport") {
    return wrap(
      <PickSport lang={lang} path={role === "coach" ? "coach" : "player"}
                 onPick={(id) => { setSport(id); setStage("role"); }}
                 onBack={() => setStage("region")} />
    );
  }

  /* ---------- 3 · coach or player ---------- */
  if (stage === "role") {
    return wrap(
      <PickRole sport={sport} lang={lang} path={role === "coach" ? "coach" : "player"}
                onPick={(r) => { setRole(r); setStage(r === "coach" ? "account" : "who"); }}
                onBack={() => setStage("sport")} />
    );
  }

  /* ---------- 4 · who's playing (players only) ---------- */
  if (stage === "who") {
    return wrap(
      <PickWho lang={lang} path="player"
               onPick={(w) => { setWho(w); setStage("connect"); }}
               onBack={() => setStage("role")} />
    );
  }

  /* ---------- 5 · the coach's code (players only) ---------- */
  if (stage === "connect") {
    return wrap(
      <Frame step={5} steps={6} onBack={() => setStage("who")}
             footer={<Button tone="ink" disabled={code.trim().length < 4}
                             onClick={() => { hapticSuccess(); setStage("account"); }}>{tr("Continue")}</Button>}>
        <div className="pt-8">
          <Headline>{tr("Your coach's code")}</Headline>
          <Sub>{who === "child"
            ? tr("The code your child's coach gave you. You'll add their details next.")
            : tr("Ask your coach for their six-character code.")}</Sub>
          <div className="mt-8">
            <Field label={tr("Invite code")} value={code} onChange={setCode} ph="ABC123" autoFocus />
            {err && <p className="mt-3" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- 6 · the account itself ---------- */
  return wrap(
    <>
      <CreateAccount role={role} lang={lang}
                     onBack={() => setStage(role === "coach" ? "role" : "connect")}
                     onDone={async ({ name, email: em, password, dob }) => {
                       /* CreateAccount has already validated the date of
                          birth and enforced the consent age before this
                          ever runs, so the exact date it hands back can
                          be stored as-is. */
                       setErr("");
                       const exact = dob && dob.y && dob.m && dob.d
                         ? `${dob.y}-${String(dob.m).padStart(2, "0")}-${String(dob.d).padStart(2, "0")}`
                         : null;
                       if (role === "coach") await createCoach({ name, email: em, password, dob: exact });
                       else await createPlayer({ name, email: em, password, dob: exact });
                     }} />
      {err && <p className="px-7 pb-4" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
    </>
  );
}
