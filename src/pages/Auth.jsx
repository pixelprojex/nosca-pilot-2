import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ThemeCtx, NEUTRAL, BRAND, tr,
  hapticSuccess, Mark, Frame, Headline, Sub, Field, Button,
  PickSport, PickRole, CreateAccount,
} from "../Nosca";

/* SIGN UP
 *
 * Three steps for a coach, four for a player:
 *   coach   — account type, sport, details
 *   player  — account type, sport, coach's code, details
 *
 * Region and language are not asked. The pilot is Ireland, in English,
 * and a question with one possible answer is not a question.
 */

const makeCode = () =>
  Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

const readable = (err) => {
  const m = /PILOT LIMIT: (.+)/.exec(err?.message || "");
  return m ? m[1] : err?.message || "Something went wrong.";
};

export default function Auth() {
  const [stage, setStage] = useState("landing");
  const [kind, setKind] = useState(null);        // coach | player | parent | junior
  const [sport, setSport] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const isCoach = kind === "coach";

  const signIn = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setErr(error.message);
    setBusy(false);
  };

  /* Everything the sign-up collected, written in one go. The auth row
     and the profile row are created together — a person who exists in
     one but not the other is an account that can sign in and then
     immediately fail to load, which is worse than not signing up. */
  const createAccount = async ({ name, email: em, password, phone, dob }) => {
    setBusy(true); setErr("");

    const exact = dob && dob.y && dob.m && dob.d
      ? `${dob.y}-${String(dob.m).padStart(2, "0")}-${String(dob.d).padStart(2, "0")}`
      : null;

    let coach = null;
    if (!isCoach) {
      const { data: rows, error: findErr } = await supabase.rpc("find_coach_by_code", { p_code: code.trim().toUpperCase() });
      coach = rows?.[0];
      if (findErr || !coach) { setErr("That code doesn't match a coach."); setBusy(false); return; }
    }

    const { data, error } = await supabase.auth.signUp({ email: em, password });
    if (error) { setErr(error.message); setBusy(false); return; }
    if (!data.user) { setErr("Account created — check your email to confirm, then sign in."); setBusy(false); return; }

    const { error: pErr } = await supabase.from("profiles").insert({
      id: data.user.id,
      role: isCoach ? "coach" : "player",
      name,
      phone: phone || null,
      date_of_birth: exact,
      sport: isCoach ? sport : coach.sport,
      ...(isCoach ? { invite_code: makeCode() } : { coach_id: coach.id }),
    });
    if (pErr) { setErr(readable(pErr)); setBusy(false); return; }
    setBusy(false);
    /* No navigation needed — the auth listener sees the new session and
       the app swaps itself over. */
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
              <Button tone="ink" onClick={() => { setErr(""); setStage("role"); }}>{tr("Sign up")}</Button>
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

  /* ---------- 1 · account type ---------- */
  if (stage === "role") {
    return wrap(
      <PickRole lang="en" path={isCoach ? "coach" : "player"}
                onPick={(r) => { setKind(r); setStage("sport"); }}
                onBack={() => setStage("landing")} />
    );
  }

  /* ---------- 2 · sport ---------- */
  if (stage === "sport") {
    return wrap(
      <PickSport lang="en" path={isCoach ? "coach" : "player"}
                 onPick={(id) => { setSport(id); setStage(isCoach ? "account" : "connect"); }}
                 onBack={() => setStage("role")} />
    );
  }

  /* ---------- 3 · the coach's code (everyone but a coach) ---------- */
  if (stage === "connect") {
    return wrap(
      <Frame step={2} steps={4} onBack={() => setStage("sport")}
             footer={<Button tone="ink" disabled={code.trim().length < 4}
                             onClick={() => { hapticSuccess(); setStage("account"); }}>{tr("Continue")}</Button>}>
        <div className="pt-8">
          <Headline>{tr("Coach's code")}</Headline>
          <Sub>{tr("Six characters, from your coach.")}</Sub>
          <div className="mt-8">
            <Field label={tr("Code")} value={code} onChange={setCode} ph="ABC123" autoFocus />
            {err && <p className="mt-3" style={{ fontFamily: "'Switzer'", fontSize: 13, color: "#C4342A" }}>{err}</p>}
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- 4 · details ---------- */
  return wrap(
    <>
      <CreateAccount role={isCoach ? "coach" : "player"} lang="en"
                     onBack={() => setStage(isCoach ? "sport" : "connect")}
                     onDone={createAccount} />
      {(err || busy) && (
        <p className="px-7 pb-4" style={{ fontFamily: "'Switzer'", fontSize: 13, color: err ? "#C4342A" : NEUTRAL.faint }}>
          {err || tr("Creating your account…")}
        </p>
      )}
    </>
  );
}
