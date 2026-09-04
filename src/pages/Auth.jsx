import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Lock, Mail, Phone, User } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import {
  ThemeCtx, NEUTRAL, BRAND, SPORTS, tr, ui, display, TYPE, R, DANGER, STEADY, useT,
  hapticSuccess, hapticWarn, haptic, Mark, Frame, SignupShell, Choice, Headline, Sub, Field, Button,
  CodeBoxes, DobBox, PickSport,
} from "../Nosca";

/* SIGN UP AND SIGN IN
 *
 * One call creates the account. Everything the profile needs travels
 * with it as metadata, and a database trigger writes the profile row
 * inside the same transaction. There is no second step that can fail.
 *
 * One decision per screen, cheapest first, commitment last:
 *
 *   coach    who are you → main sport → your details
 *   parent   who are you → main sport → your details
 *   player   who are you → main sport → your details (with date of
 *            birth) → your codes
 *
 * Whether a player is under 18 comes from the date of birth — it is
 * not asked as a question. Under 18s must join with a parent's family
 * code; the parent is the consenting adult. Adults may skip the codes.
 *
 * Codes are checked live, before the account exists, because the
 * database deliberately never fails a sign-up over a code it doesn't
 * recognise — without the check a mistyped code would create the
 * account silently unlinked.
 */

const MIN_PASS = 8;
const ADULT = 18;
const FAMILY_REQUIRED = "Under 18s join with a parent's family code. Ask them to open Nosca → Family → Share.";
const ALREADY = "There's already an account with that email. Try signing in.";

export const friendly = (msg) => {
  const m = (msg || "").toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("already been registered"))
    return ALREADY;
  if (m.includes("invalid login")) return "That email and password don't match.";
  if (m.includes("email not confirmed"))
    return "This email hasn't been confirmed yet. Check your inbox for the link.";
  if (m.includes("different from the old")) return "That's already your password. Choose a new one.";
  if (m.includes("password") && (m.includes("at least") || m.includes("too short") || m.includes("characters") || m.includes("weak")))
    return `Passwords need at least ${MIN_PASS} characters.`;
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("database error"))
    return "The database rejected the sign-up. Run supabase/nosca.sql in Supabase, then try again.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed") || m.includes("load failed"))
    return "Couldn't reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
};

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
const cleanCode = (v) => (v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/* Whole years old today. null = not finished typing; "invalid" = not a
   real date. */
function ageFrom(d, m, y) {
  const dd = Number(d), mm = Number(m), yy = Number(y);
  if (!dd || !mm || y.length !== 4) return null;
  if (dd > 31 || mm > 12 || yy < 1900) return "invalid";
  const today = new Date();
  const born = new Date(yy, mm - 1, dd);
  if (isNaN(born.getTime()) || born.getDate() !== dd || born > today) return "invalid";
  let a = today.getFullYear() - yy;
  if (today.getMonth() < mm - 1 || (today.getMonth() === mm - 1 && today.getDate() < dd)) a -= 1;
  return a;
}

const Neutral = ({ children }) => (
  <ThemeCtx.Provider value={NEUTRAL}>
    <div style={{ height: "100dvh", background: NEUTRAL.page }}>{children}</div>
  </ThemeCtx.Provider>
);

const ErrLine = ({ children, center }) => children ? (
  <p className={`mb-3 ${center ? "text-center" : ""}`} style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.5, color: DANGER }}>{children}</p>
) : null;

const QuietLink = ({ children, onClick, disabled }) => {
  const t = useT();
  return (
    <button onClick={() => { haptic(6); onClick(); }} disabled={disabled}
            className="w-full mt-3 active:opacity-60 disabled:opacity-40"
            style={{ minHeight: 44, fontFamily: ui, fontSize: 14.5, color: t.sub }}>
      {children}
    </button>
  );
};

/* Scrolls the first problem into view and puts the cursor in it —
   the button is never disabled, so nobody is left guessing why. */
const showProblem = (ref) => {
  const el = ref && ref.current;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = el.querySelector("input");
  if (input) setTimeout(() => input.focus(), 250);
};

/* ---------- landing ---------- */
function Landing({ invite, onCreate, onSignIn }) {
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
          {invite && (
            <p className="text-center mb-5" style={{ fontFamily: ui, fontSize: 14.5, lineHeight: 1.5, color: NEUTRAL.sub }}>
              {tr("You've been invited.")}
              <span className="block" style={{ color: NEUTRAL.faint, fontSize: 13 }}>
                {invite.kind === "family" ? tr("Family code") : tr("Coach code")} {invite.code}
              </span>
            </p>
          )}
          <div className="mb-2.5">
            <Button tone="ink" onClick={onCreate}>{tr("Create account")}</Button>
          </div>
          <Button tone="quiet" onClick={onSignIn}>{tr("Sign in")}</Button>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

/* ---------- 1 · who are you ---------- */
function WhoStep({ initial, onPick, onBack }) {
  const [sel, setSel] = useState(initial || null);
  return (
    <SignupShell onBack={onBack} title={tr("Who are you?")}
                 footer={<Button tone="ink" disabled={!sel} onClick={() => { hapticSuccess(); onPick(sel); }}>{tr("Continue")}</Button>}>
      <Choice label={tr("Coach")}  on={sel === "coach"}  onSelect={() => setSel("coach")} />
      <Choice label={tr("Player")} on={sel === "player"} onSelect={() => setSel("player")} delay={55} />
      <Choice label={tr("Parent")} on={sel === "parent"} onSelect={() => setSel("parent")} delay={110} />
    </SignupShell>
  );
}

/* ---------- 3 · your details ---------- */
function DetailsStep({ role, initial, busy, err, onBack, onDone, onSignInInstead }) {
  const t = useT();
  const wantsDob = role === "player";
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [pass, setPass] = useState(initial?.password || "");
  const [d, setD] = useState(initial?.dob?.d || "");
  const [m, setM] = useState(initial?.dob?.m || "");
  const [y, setY] = useState(initial?.dob?.y || "");
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const mark = (k) => setTouched((x) => ({ ...x, [k]: true }));
  const dRef = useRef(null), mRef = useRef(null), yRef = useRef(null);
  const dobWrap = useRef(null), nameWrap = useRef(null), emailWrap = useRef(null), passWrap = useRef(null);

  const age = wantsDob ? ageFrom(d, m, y) : undefined;
  const dobIssue = wantsDob && (age === null || age === "invalid");
  const show = (k) => touched[k] || tried;

  const errName  = show("name")  && name.trim().length < 2 ? "Enter your full name" : null;
  const errEmail = show("email") && !emailOk(email)        ? "That doesn't look like an email address" : null;
  const errPass  = show("pass")  && pass.length < MIN_PASS ? `Use at least ${MIN_PASS} characters` : null;
  const dobBad   = show("dob") && dobIssue;
  const dobMsg   = age === "invalid" ? "That date doesn't exist" : "Enter your date of birth";

  const problems = [
    dobIssue && dobWrap,
    name.trim().length < 2 && nameWrap,
    !emailOk(email) && emailWrap,
    pass.length < MIN_PASS && passWrap,
  ].filter(Boolean);

  const submit = () => {
    if (busy) return;
    if (problems.length) { setTried(true); hapticWarn(); showProblem(problems[0]); return; }
    hapticSuccess();
    onDone({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password: pass,
             dob: wantsDob ? { d, m, y } : null, age });
  };

  const sub = role === "coach" ? tr("The name players will see.")
            : role === "parent" ? tr("Your own details. Your children join with your family code.")
            : null;

  return (
    <Frame onBack={onBack}
           footer={<>
             <ErrLine>{err}</ErrLine>
             {err === ALREADY && <div className="mb-3"><Button tone="quiet" onClick={() => onSignInInstead(email.trim().toLowerCase())}>{tr("Sign in")}</Button></div>}
             <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr(role === "player" ? "Continue" : "Create account")}</Button>
           </>}>
      <div className="pt-6">
        <Headline>{tr("Your details")}</Headline>
        {sub && <Sub>{sub}</Sub>}

        {wantsDob && (
          <div ref={dobWrap} className="mt-7 mb-1">
            <div className="flex items-center gap-2 mb-2.5">
              <CalendarDays size={15} color={dobBad ? DANGER : t.faint} strokeWidth={1.6} />
              <span style={{ fontFamily: ui, fontSize: 12.5, color: dobBad ? DANGER : t.sub }}>{tr("Date of birth")}</span>
            </div>
            <div className="flex items-center gap-2">
              <DobBox ref={dRef} value={d} onChange={setD} ph={tr("DD")} len={2} bad={dobBad} onDone={() => mRef.current && mRef.current.focus()} />
              <DobBox ref={mRef} value={m} onChange={setM} ph={tr("MM")} len={2} bad={dobBad} onDone={() => yRef.current && yRef.current.focus()} />
              <DobBox ref={yRef} value={y} onChange={setY} ph={tr("YYYY")} len={4} bad={dobBad} onDone={() => { mark("dob"); yRef.current && yRef.current.blur(); }} />
              {typeof age === "number" && (
                <span className="flex items-center gap-1.5 ml-1"><Check size={15} color={STEADY} strokeWidth={2.1} />
                  <span style={{ fontFamily: ui, fontSize: 13, color: t.sub }}>{age}</span></span>
              )}
            </div>
            {dobBad
              ? <p className="mt-2" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.5, color: DANGER }}>{dobMsg}</p>
              : typeof age === "number" && age < ADULT
                ? <p className="mt-2" style={{ ...TYPE.caption, color: t.faint }}>{tr("Under 18 — you'll need a parent's family code on the next step.")}</p>
                : null}
          </div>
        )}

        <div className={wantsDob ? "mt-5" : "mt-6"}>
          <div ref={nameWrap}><Field label={tr("Full name")} value={name} onChange={setName} onBlur={() => mark("name")} ph={tr("Ray Doyle")} Icon={User} error={errName} autoComplete="name" /></div>
          <div ref={emailWrap}><Field label={tr("Email")} value={email} onChange={setEmail} onBlur={() => mark("email")} ph="you@example.ie" Icon={Mail} type="email" error={errEmail} autoComplete="email" inputMode="email" /></div>
          <Field label={`${tr("Mobile")} · ${tr("optional")}`} value={phone} onChange={setPhone} ph="+353 87 123 4567" Icon={Phone} type="tel" autoComplete="tel" inputMode="tel" />
          <div ref={passWrap}><Field label={tr("Password")} value={pass} onChange={setPass} onBlur={() => mark("pass")} ph={`At least ${MIN_PASS} characters`} Icon={Lock} type="password" error={errPass} reveal autoComplete="new-password" /></div>
        </div>
        <p className="mt-5 text-center pb-6" style={{ fontFamily: ui, fontSize: 11.5, lineHeight: 1.5, color: t.faint }}>
          By continuing you accept the {BRAND} Terms and Privacy Policy.
        </p>
      </div>
    </Frame>
  );
}

/* A code, looked up as it is typed. Six characters in, wait 300 ms for
   the typing to settle, then ask the database who it belongs to. */
function useCodeLookup(fn, value) {
  const code = cleanCode(value);
  const [state, setState] = useState({ status: "idle" });
  useEffect(() => {
    if (code.length < 6) { setState({ status: "idle" }); return; }
    let alive = true;
    setState({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc(fn, { p_code: code });
        if (!alive) return;
        if (error) setState({ status: "error" });
        else if (data && data.length) setState({ status: "ok", ...data[0] });
        else setState({ status: "miss" });
      } catch (e) {
        if (alive) setState({ status: "error" });
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [fn, code]);
  return state;
}

function CodeStatus({ look, value, issue, hint, tried }) {
  const t = useT();
  const complete = cleanCode(value).length === 6;
  if (look.status === "ok") {
    return (
      <p className="mt-3 flex items-center justify-center gap-1.5" style={{ fontFamily: ui, fontSize: 13.5, color: t.ink }}>
        <Check size={15} color={STEADY} strokeWidth={2.1} />
        <span>{look.name}{look.sport && SPORTS[look.sport] ? ` · ${SPORTS[look.sport].label}` : ""}</span>
      </p>
    );
  }
  if (complete && (look.status === "checking" || look.status === "idle")) {
    return <p className="mt-3 text-center" style={{ ...TYPE.caption, color: t.faint }}>{tr("Checking…")}</p>;
  }
  if (issue && (complete || tried)) {
    return <p className="mt-3 text-center" style={{ fontFamily: ui, fontSize: 12.5, lineHeight: 1.5, color: DANGER }}>{issue}</p>;
  }
  if (hint) return <p className="mt-3 text-center" style={{ ...TYPE.caption, lineHeight: 1.5, color: t.faint }}>{hint}</p>;
  return null;
}

/* ---------- 4 · your codes (players only) ---------- */
function CodesStep({ junior, initial, busy, err, onBack, onDone, onSkip, onSignInInstead }) {
  const t = useT();
  const [coach, setCoach] = useState(initial?.coach || "");
  const [fam, setFam] = useState(initial?.family || "");
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const coachLook = useCodeLookup("find_coach_by_code", coach);
  const famLook = useCodeLookup("find_guardian_by_code", fam);
  const coachWrap = useRef(null), famWrap = useRef(null);

  const issueFor = (value, look, noun) => {
    const c = cleanCode(value);
    if (!c) return null;
    if (c.length < 6) return tr("Enter all six characters.");
    if (look.status === "error") return tr("Couldn't check that code. Try again.");
    if (look.status === "miss") return noun === "coach" ? tr("That code doesn't match a coach.") : tr("That code doesn't match a family.");
    return null;
  };
  const coachIssue = issueFor(coach, coachLook, "coach");
  const famIssue = issueFor(fam, famLook, "family") || (junior && !cleanCode(fam) ? FAMILY_REQUIRED : null);
  const settled = (value, look) => cleanCode(value).length < 6 || (look.status !== "checking" && look.status !== "idle");

  const attempt = () => {
    if (coachIssue) { hapticWarn(); showProblem(coachWrap); return; }
    if (famIssue) { hapticWarn(); showProblem(famWrap); return; }
    hapticSuccess();
    onDone({ coach_code: cleanCode(coach), family_code: cleanCode(fam) });
  };
  const submit = () => {
    if (busy) return;
    setTried(true);
    if (!settled(coach, coachLook) || !settled(fam, famLook)) { setPending(true); return; }
    attempt();
  };
  /* tapped Create while a lookup was still in flight: finish it, then go */
  useEffect(() => {
    if (!pending) return;
    if (!settled(coach, coachLook) || !settled(fam, famLook)) return;
    setPending(false);
    attempt();
  }, [pending, coachLook.status, famLook.status]);

  const label = (text) => (
    <p className="mb-3 text-center" style={{ ...TYPE.eyebrow, color: t.faint }}>{text}</p>
  );

  return (
    <SignupShell onBack={onBack} title={tr("Your codes")}
                 sub={junior ? tr("Your coach's code, and a parent's family code.") : tr("Optional. You can add these later from Home.")}
                 footer={<>
                   <ErrLine>{err}</ErrLine>
                   {err === ALREADY && <div className="mb-3"><Button tone="quiet" onClick={onSignInInstead}>{tr("Sign in")}</Button></div>}
                   <Button tone="ink" disabled={busy} onClick={submit}>{busy || pending ? "…" : tr("Create account")}</Button>
                   {!junior && <QuietLink onClick={onSkip} disabled={busy}>{tr("Skip for now")}</QuietLink>}
                 </>}>
      <div style={{ overflowY: "auto", minHeight: 0, maxHeight: "100%" }}>
        <div ref={coachWrap} className="pt-1 pb-7">
          {label(tr("Coach code"))}
          <CodeBoxes value={coach} onChange={setCoach} bad={!!coachIssue && (cleanCode(coach).length === 6 || tried)} />
          <CodeStatus look={coachLook} value={coach} issue={coachIssue} tried={tried} />
        </div>
        <div ref={famWrap} className="pb-2">
          {label(tr("Family code"))}
          <CodeBoxes value={fam} onChange={setFam} bad={!!famIssue && (cleanCode(fam).length === 6 || (tried && (junior || !!cleanCode(fam))))} />
          <CodeStatus look={famLook} value={fam} issue={famIssue} tried={tried && junior}
                      hint={junior ? FAMILY_REQUIRED : null} />
        </div>
      </div>
    </SignupShell>
  );
}

/* ---------- check your inbox ---------- */
function InboxStep({ email, kind, note, onResend, onChangeEmail, onSignIn, onBack }) {
  const t = useT();
  const [wait, setWait] = useState(0);
  const [sent, setSent] = useState("");
  useEffect(() => {
    if (!wait) return;
    const i = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, [wait]);
  const resend = async () => {
    if (wait) return;
    setSent("");
    const r = await onResend();
    if (r && r.error) { hapticWarn(); setSent(friendly(r.error.message)); return; }
    hapticSuccess(); setWait(30); setSent(tr("Sent again."));
  };
  return (
    <Frame onBack={onBack}
           footer={<>
             {kind === "signup"
               ? <Button tone="ink" onClick={onSignIn}>{tr("I've confirmed — sign in")}</Button>
               : <Button tone="ink" onClick={onSignIn}>{tr("Back to sign in")}</Button>}
             <QuietLink onClick={resend} disabled={!!wait}>{wait ? `${tr("Resend email")} · ${wait}s` : tr("Resend email")}</QuietLink>
             <QuietLink onClick={onChangeEmail}>{tr("Use a different email")}</QuietLink>
           </>}>
      <div className="pt-6">
        <Headline>{tr("Check your inbox")}</Headline>
        <Sub>{kind === "signup" ? tr("We sent a link to confirm your email.") : tr("We sent a link to set a new password.")}</Sub>
        <p className="mt-7" style={{ fontFamily: display, fontSize: 19, letterSpacing: "-0.01em", color: t.ink, wordBreak: "break-all" }}>{email}</p>
        {note && <p className="mt-4" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.5, color: t.sub }}>{note}</p>}
        <p className="mt-4" style={{ fontFamily: ui, fontSize: 13.5, lineHeight: 1.5, color: t.faint }}>
          {tr("Not there? Check spam, or resend it below.")}
        </p>
        {sent && <p className="mt-3" style={{ fontFamily: ui, fontSize: 13.5, color: sent === tr("Sent again.") ? STEADY : DANGER }}>{sent}</p>}
      </div>
    </Frame>
  );
}

/* ---------- sign in ---------- */
function SignInStep({ initialEmail, busy, err, onBack, onSubmit, onForgot, clearErr }) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail || "");
  const [pass, setPass] = useState("");
  const [tried, setTried] = useState(false);
  const emailWrap = useRef(null), passWrap = useRef(null);
  const eEmail = tried && !emailOk(email) ? "Enter your email address" : null;
  const ePass = tried && !pass ? "Enter your password" : null;
  const submit = () => {
    if (busy) return;
    if (!emailOk(email) || !pass) { setTried(true); hapticWarn(); showProblem(!emailOk(email) ? emailWrap : passWrap); return; }
    onSubmit(email.trim().toLowerCase(), pass);
  };
  return (
    <Frame onBack={onBack}
           footer={<>
             <ErrLine>{err}</ErrLine>
             <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr("Sign in")}</Button>
           </>}>
      <div className="pt-6">
        <Headline>{tr("Sign in")}</Headline>
        <div className="mt-8">
          <div ref={emailWrap}><Field label={tr("Email")} value={email} onChange={(v) => { setEmail(v); clearErr(); }}
                 ph="you@example.ie" type="email" autoFocus={!initialEmail} error={eEmail} autoComplete="email" inputMode="email" /></div>
          <div ref={passWrap}><Field label={tr("Password")} value={pass} onChange={(v) => { setPass(v); clearErr(); }}
                 type="password" ph="" reveal autoFocus={!!initialEmail} error={ePass} autoComplete="current-password" /></div>
          <button onClick={() => { haptic(6); onForgot(email.trim().toLowerCase()); }} className="mt-5 active:opacity-50"
                  style={{ minHeight: 40, fontFamily: ui, fontSize: 14, fontWeight: 600, color: t.ink }}>
            {tr("Forgot password?")}
          </button>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- forgot password ---------- */
function ForgotStep({ initialEmail, busy, err, onBack, onSend }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [tried, setTried] = useState(false);
  const wrap = useRef(null);
  const eEmail = tried && !emailOk(email) ? "Enter your email address" : null;
  const submit = () => {
    if (busy) return;
    if (!emailOk(email)) { setTried(true); hapticWarn(); showProblem(wrap); return; }
    onSend(email.trim().toLowerCase());
  };
  return (
    <Frame onBack={onBack}
           footer={<>
             <ErrLine>{err}</ErrLine>
             <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr("Send reset link")}</Button>
           </>}>
      <div className="pt-6">
        <Headline>{tr("Reset password")}</Headline>
        <Sub>{tr("We'll email you a link to set a new one.")}</Sub>
        <div className="mt-8" ref={wrap}>
          <Field label={tr("Email")} value={email} onChange={setEmail} ph="you@example.ie" type="email"
                 autoFocus={!initialEmail} error={eEmail} autoComplete="email" inputMode="email" />
        </div>
      </div>
    </Frame>
  );
}

/* ---------- set a new password (after the reset link) ---------- */
function SetPassword() {
  const { session, clearRecovery } = useAuth();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const w1 = useRef(null), w2 = useRef(null);
  const mark = (k) => setTouched((x) => ({ ...x, [k]: true }));
  const e1 = (touched.p1 || tried) && p1.length < MIN_PASS ? `Use at least ${MIN_PASS} characters` : null;
  const e2 = (touched.p2 || tried) && p2 !== p1 ? "These don't match" : null;
  const save = async () => {
    if (busy) return;
    if (p1.length < MIN_PASS) { setTried(true); hapticWarn(); showProblem(w1); return; }
    if (p2 !== p1) { setTried(true); hapticWarn(); showProblem(w2); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) { hapticWarn(); setErr(friendly(error.message)); setBusy(false); return; }
      hapticSuccess();
      clearRecovery();
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message)); setBusy(false);
    }
  };
  const email = session?.user?.email;
  return (
    <Neutral>
      <Frame footer={<>
               <ErrLine>{err}</ErrLine>
               <Button tone="ink" disabled={busy} onClick={save}>{busy ? "…" : tr("Save password")}</Button>
               <QuietLink onClick={clearRecovery} disabled={busy}>{tr("Not now")}</QuietLink>
             </>}>
        <div className="pt-6">
          <Headline>{tr("Set a new password")}</Headline>
          {email && <Sub>{email}</Sub>}
          <div className="mt-8">
            <div ref={w1}><Field label={tr("New password")} value={p1} onChange={setP1} onBlur={() => mark("p1")}
                   ph={`At least ${MIN_PASS} characters`} Icon={Lock} type="password" reveal error={e1} autoFocus autoComplete="new-password" /></div>
            <div ref={w2}><Field label={tr("Confirm password")} value={p2} onChange={setP2} onBlur={() => mark("p2")}
                   ph="" Icon={Lock} type="password" reveal error={e2} autoComplete="new-password" /></div>
          </div>
        </div>
      </Frame>
    </Neutral>
  );
}

/* ================================================================== */

export default function Auth({ invite, mode }) {
  const [stage, setStage] = useState("landing");
  const [role, setRole] = useState(null);         // coach | player | parent
  const [sport, setSport] = useState(null);
  const [details, setDetails] = useState(null);   // held while the codes step runs
  const [codes, setCodes] = useState(() => ({
    coach: invite && invite.kind === "coach" ? invite.code : "",
    family: invite && invite.kind === "family" ? invite.code : "",
  }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [signinEmail, setSigninEmail] = useState("");
  const [inbox, setInbox] = useState(null);       // { email, kind: signup | reset, note }

  const go = (s) => { setErr(""); setStage(s); };

  if (mode === "recovery") return <SetPassword />;

  /* ---------- sign in ---------- */
  const signIn = async (email, password) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        hapticWarn();
        if ((error.message || "").toLowerCase().includes("not confirmed")) {
          setInbox({ email, kind: "signup", note: tr("This email hasn't been confirmed yet.") });
          setStage("inbox");
        } else {
          setErr(friendly(error.message));
        }
      }
      /* On success the auth listener notices and the app swaps over. */
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message));
    }
    setBusy(false);
  };

  /* ---------- forgot password ---------- */
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const sendReset = async (email) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) { hapticWarn(); setErr(friendly(error.message)); setBusy(false); return; }
      hapticSuccess();
      setSigninEmail(email);
      setInbox({ email, kind: "reset" });
      setStage("inbox");
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message));
    }
    setBusy(false);
  };

  const resend = async () => {
    if (!inbox) return {};
    try {
      if (inbox.kind === "reset") return await supabase.auth.resetPasswordForEmail(inbox.email, { redirectTo });
      return await supabase.auth.resend({ type: "signup", email: inbox.email });
    } catch (e) {
      return { error: { message: e && e.message } };
    }
  };

  /* ---------- create the account ----------
     One call. The trigger does the rest. */
  const createAccount = async (d, c) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const dob = d.dob && d.dob.y && d.dob.m && d.dob.d
        ? `${d.dob.y}-${String(d.dob.m).padStart(2, "0")}-${String(d.dob.d).padStart(2, "0")}`
        : null;
      const accountType = role === "coach" ? "coach"
                        : role === "parent" ? "parent"
                        : (typeof d.age === "number" && d.age < ADULT ? "junior" : "adult");

      const { data, error } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          data: {
            role: role === "coach" ? "coach" : "player",
            name: d.name,
            sport,
            account_type: accountType,
            date_of_birth: dob,
            phone: d.phone || "",
            coach_code: (c && c.coach_code) || "",
            family_code: (c && c.family_code) || "",
          },
        },
      });

      if (error) { hapticWarn(); setErr(friendly(error.message)); setBusy(false); return; }

      /* With email confirmation on, Supabase answers a sign-up for an
         address that already has an account with a fake, identity-less
         user instead of an error — so nobody can probe which emails are
         registered. Read that way, the honest message is "sign in". */
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        hapticWarn(); setErr(ALREADY); setBusy(false); return;
      }

      /* The account and its profile both exist. With email confirmation
         on there is no session yet — say so, with a way to resend. */
      /* The gate shows the arrival screen once, on the first sign-in in
         this browser — set before the confirmation branch, so an account
         confirmed by email still gets its code shown when it comes back. */
      try { window.sessionStorage.setItem("nosca.arrival", role); } catch (e) { /* private mode */ }

      if (!data.session) {
        setSigninEmail(d.email);
        setInbox({ email: d.email, kind: "signup" });
        setStage("inbox");
        setBusy(false);
        return;
      }

      /* Session exists; the auth listener takes it from here. */
      hapticSuccess();
    } catch (e) {
      hapticWarn(); setErr(friendly(e && e.message));
    }
    setBusy(false);
  };

  const signInInstead = (email) => { if (email) setSigninEmail(email); go("signin"); };

  /* ---------- screens ---------- */
  if (stage === "landing") {
    return <Landing invite={invite} onCreate={() => go("who")} onSignIn={() => go("signin")} />;
  }

  if (stage === "signin") {
    return (
      <Neutral>
        <SignInStep initialEmail={signinEmail} busy={busy} err={err} clearErr={() => setErr("")}
                    onBack={() => go("landing")} onSubmit={signIn}
                    onForgot={(email) => { setSigninEmail(email); go("forgot"); }} />
      </Neutral>
    );
  }

  if (stage === "forgot") {
    return (
      <Neutral>
        <ForgotStep initialEmail={signinEmail} busy={busy} err={err} onBack={() => go("signin")} onSend={sendReset} />
      </Neutral>
    );
  }

  if (stage === "inbox" && inbox) {
    return (
      <Neutral>
        <InboxStep email={inbox.email} kind={inbox.kind} note={inbox.note} onResend={resend}
                   onBack={() => go(inbox.kind === "reset" ? "forgot" : role ? "details" : "signin")}
                   onChangeEmail={() => go(inbox.kind === "reset" ? "forgot" : role ? "details" : "signin")}
                   onSignIn={() => { setSigninEmail(inbox.email); go("signin"); }} />
      </Neutral>
    );
  }

  if (stage === "who") {
    return (
      <Neutral>
        <WhoStep initial={role} onBack={() => go("landing")}
                 onPick={(r) => { setRole(r); go("sport"); }} />
      </Neutral>
    );
  }

  if (stage === "sport") {
    return (
      <Neutral>
        <PickSport lang="en" onBack={() => go("who")} onPick={(id) => { setSport(id); go("details"); }} />
      </Neutral>
    );
  }

  if (stage === "codes") {
    return (
      <Neutral>
        <CodesStep junior={typeof details?.age === "number" && details.age < ADULT}
                   initial={codes} busy={busy} err={err}
                   onBack={() => go("details")}
                   onSignInInstead={() => signInInstead(details?.email)}
                   onDone={(c) => { setCodes({ coach: c.coach_code, family: c.family_code }); createAccount(details, c); }}
                   onSkip={() => createAccount(details, null)} />
      </Neutral>
    );
  }

  /* details */
  return (
    <Neutral>
      <DetailsStep role={role} initial={details} busy={busy} err={err}
                   onBack={() => go("sport")}
                   onSignInInstead={signInInstead}
                   onDone={(d) => {
                     setDetails(d);
                     setErr("");
                     if (role === "player") { setStage("codes"); return; }
                     createAccount(d, null);
                   }} />
    </Neutral>
  );
}
