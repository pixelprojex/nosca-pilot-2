import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Eye } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { isIos, isStandalone } from "../lib/install";
import {
  ThemeCtx, NEUTRAL, BRAND, SPORTS, tr, ui, display, TYPE, R, DANGER, STEADY, SPACE, useT, lipOf, SOFT_LIP, EDGE_W,
  hapticSuccess, hapticWarn, haptic, openAbout, Mark, Choice, Button, FOIL, MicBtn, SportGrid,
  CodeBoxes, DobBox,
} from "../Nosca";

/* SIGN UP AND SIGN IN
 *
 * One call creates the account. Everything the profile needs travels
 * with it as metadata, and a database trigger writes the profile row
 * inside the same transaction. There is no second step that can fail.
 *
 * One decision per screen, cheapest first, commitment last:
 *
 *   coach    join as → main sport → your details
 *   parent   join as → main sport → your details → your family
 *   player   join as → main sport → your details (with date of
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
 *
 * GREAT AND SIMPLE (28 November). The founder: the sign-in and create an
 * account page "should also look great while not overcomplicated … cut
 * down on text … very short lines". So every screen is one shell
 * (`AuthShell`: Back, the brand's mark in the middle of the bar — the
 * one green thing before a sport — the title, the body, the one key at
 * the foot); a choice is a tap that answers and goes on (Join as, Main
 * sport — the chosen tile shows for a beat, then the next screen), so
 * those two screens carry no Continue; the fields are the app's own text
 * box (the wash on its soft foot, 16px, a red ring and one plain line
 * under it for a problem); every message the server's words become is
 * one short line (`friendly`). A Home Screen
 * app on an iPhone has its own storage, so somebody who signed up in
 * Safari is signed out there: it opens on Sign in, saying so in one line,
 * with Create account under it for the person who has no account yet. */

const MIN_PASS = 8;
const ADULT = 18;
const FAMILY_REQUIRED = "Ask a parent: Settings › Family";
const ALREADY = "There's already an account with that email";

/* the server's words, as one short line a person can act on */
export const friendly = (msg) => {
  const m = (msg || "").toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("already been registered"))
    return ALREADY;
  if (m.includes("invalid login")) return "That email and password don't match";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox";
  if (m.includes("different from the old")) return "That's already your password";
  if (m.includes("password") && (m.includes("at least") || m.includes("too short") || m.includes("characters") || m.includes("weak")))
    return `Use at least ${MIN_PASS} characters`;
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute";
  if (m.includes("database error")) return "Something went wrong. Try again";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed") || m.includes("load failed"))
    return "No connection. Try again";
  return msg || "Something went wrong. Try again";
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

const rise = (delay = 0) => ({ animation: `fadeUp 480ms cubic-bezier(.22,1,.36,1) ${delay}ms backwards` });

/* a problem, in one plain line */
const ErrLine = ({ children, center }) => children ? (
  <p role="alert" className={center ? "text-center" : ""} style={{ ...TYPE.small, color: DANGER, marginBottom: SPACE.tight }}>{children}</p>
) : null;

const QuietLink = ({ children, onClick, disabled, tour }) => {
  const t = useT();
  return (
    <button data-tour={tour} onClick={() => { haptic(6); onClick(); }} disabled={disabled}
            className="w-full active:opacity-60 disabled:opacity-40"
            style={{ minHeight: 44, marginTop: 4, fontFamily: ui, fontSize: 15, fontWeight: 600, color: t.sub }}>
      {children}
    </button>
  );
};

/* EVERY SCREEN OF THE FRONT DOOR. The bar: Back on the left, 44 to a
   finger; the brand's mark in the middle, in its bottle green — the one
   green thing before a sport, as the app's own mark stands top-left
   inside it; `right` (Sign in, on the first question) on the right. Then
   the title, a line under it only when it says something, the body —
   which scrolls, so nothing is ever under the keyboard or the foot — and
   the one key at the foot. */
function AuthShell({ onBack, right, title, sub, children, footer }) {
  const t = useT();
  return (
    <div data-auth-shell="" className="flex flex-col h-full" style={{ background: t.page }}>
      <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
      <div className="relative flex items-center justify-between shrink-0 px-1.5" style={{ height: 52 }}>
        {onBack
          ? <button onClick={() => { haptic(6); onBack(); }} aria-label={tr("Back")} className="flex items-center justify-center active:opacity-40" style={{ width: 44, height: 44 }}>
              <ChevronLeft size={24} color={t.ink} strokeWidth={2} />
            </button>
          : <span style={{ width: 44 }} />}
        <span aria-hidden="true" className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%, -50%)" }}><Mark size={30} color={t.mark} /></span>
        {right || <span style={{ width: 44 }} />}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-7" style={{ overscrollBehavior: "contain" }}>
        <h1 style={{ ...TYPE.screen, color: t.ink, paddingTop: SPACE.tight, ...rise(0) }}>{title}</h1>
        {sub && <p data-auth-sub="" style={{ ...TYPE.body, color: t.sub, marginTop: 6, ...rise(40) }}>{sub}</p>}
        <div style={{ paddingTop: SPACE.block - 4, paddingBottom: SPACE.block, ...rise(70) }}>{children}</div>
      </div>
      {footer && <div className="px-7 pt-2 shrink-0" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>{footer}</div>}
    </div>
  );
}

/* THE APP'S OWN TEXT BOX, with its label over it: the wash on its soft
   foot, 54 tall, the words at 16 (under which iOS zooms the page); a
   red ring and one plain line under it for a problem, the brand's ring
   while it is being typed in. A name can be said (the microphone); an
   email or a password cannot, and carries none. */
function AuthField({ label, value, onChange, type = "text", error, onBlur, reveal, autoFocus, autoComplete, inputMode, mic }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const [focus, setFocus] = useState(false);
  const bad = !!error;
  return (
    <label className="block" style={{ marginBottom: SPACE.row }}>
      <span className="block" style={{ ...TYPE.eyebrow, color: bad ? DANGER : t.sub, marginBottom: 6 }}>{label}</span>
      <span className="flex items-center" style={{ minHeight: 54, gap: 4, paddingLeft: 16, paddingRight: reveal || mic ? 4 : 16, borderRadius: R.surface, background: t.wash,
                                                  border: `${EDGE_W}px solid ${bad ? DANGER : focus ? t.accent : "transparent"}`, boxShadow: lipOf(SOFT_LIP(t), 2),
                                                  transition: "border-color 160ms" }}>
        <input type={reveal && shown ? "text" : type} value={value} autoFocus={autoFocus} autoComplete={autoComplete} inputMode={inputMode}
               aria-label={typeof label === "string" ? label : undefined} aria-invalid={bad || undefined}
               onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onBlur && onBlur(); }}
               onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-0 outline-none"
               style={{ fontFamily: ui, fontSize: 16, color: t.ink, background: "transparent", height: 50 }} />
        {mic && <MicBtn size={40} onText={(txt) => onChange(value ? `${value} ${txt}` : txt)} />}
        {reveal && value.length > 0 && (
          <button type="button" onClick={(e) => { e.preventDefault(); haptic(6); setShown(!shown); }} className="shrink-0 flex items-center justify-center active:opacity-50"
                  style={{ width: 44, height: 44 }} aria-label={shown ? tr("Hide password") : tr("Show password")}>
            <Eye size={18} color={shown ? t.accent : t.faint} strokeWidth={1.8} />
          </button>
        )}
      </span>
      {bad && <span className="block" role="alert" style={{ ...TYPE.caption, color: DANGER, marginTop: 6 }}>{error}</span>}
    </label>
  );
}

/* Scrolls the first problem into view and puts the cursor in it —
   the button is never disabled, so nobody is left guessing why. */
const showProblem = (ref) => {
  const el = ref && ref.current;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = el.querySelector("input");
  if (input) setTimeout(() => input.focus(), 250);
};

/* a choice that answers and goes on: the chosen tile shows for a beat, then the next screen */
const ANSWER_MS = 240;
function useAnswer(onPick) {
  const gone = useRef(false), timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (value) => {
    if (gone.current) return;
    gone.current = true;
    timer.current = setTimeout(() => { hapticSuccess(); onPick(value); }, ANSWER_MS);
  };
}

/* ---------- landing ---------- */
function Landing({ invite, onCreate, onSignIn }) {
  return (
    <ThemeCtx.Provider value={NEUTRAL}>
      <div className="flex flex-col" style={{ height: "100dvh", background: NEUTRAL.page }}>
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* THE CARD'S BACK (24 November): the mark in the card's gold foil
              over the name, and a fine rule of the same gold under it, as the
              business card's white side carries them — the front door is the
              card in the hand. The name stays the ink: gold words on white
              would read 2.4:1 (FOIL is for a mark and a line on white, never a word) */}
          <span data-foil="" style={{ animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) both" }}><Mark size={48} color={FOIL} /></span>
          <span className="mt-5" style={{ fontFamily: display, fontSize: 14, fontWeight: 500,
                         letterSpacing: "0.42em", paddingLeft: "0.42em", color: NEUTRAL.ink,
                         animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) 90ms both" }}>{BRAND}</span>
          <span aria-hidden="true" data-foil-rule="" className="mt-5" style={{ width: 56, height: 1, background: FOIL,
                         animation: "fadeUp 700ms cubic-bezier(.22,1,.36,1) 150ms both" }} />
        </div>
        <div className="px-7" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
                                        animation: "fadeUp 640ms cubic-bezier(.22,1,.36,1) 200ms both" }}>
          {invite && (
            <p className="text-center mb-5" style={{ ...TYPE.body, color: NEUTRAL.ink }}>
              {tr("You've been invited")}
              <span className="block" style={{ ...TYPE.small, color: NEUTRAL.sub, marginTop: 2 }}>
                {invite.kind === "family" ? tr("Family code") : tr("Coach code")} {invite.code}
              </span>
            </p>
          )}
          <div className="mb-2.5">
            <Button tone="ink" onClick={onCreate}>{tr("Create account")}</Button>
          </div>
          <Button tone="quiet" onClick={onSignIn}>{tr("Sign in")}</Button>
          {/* the company's website, findable before an account exists: a quiet line under the two keys, 44 to a finger */}
          <button data-tour="auth-about" onClick={() => { haptic(6); openAbout(); }} className="w-full active:opacity-50"
                  style={{ minHeight: 44, marginTop: 4, fontFamily: ui, fontSize: 14, fontWeight: 600, color: NEUTRAL.sub }}>
            {tr("About Nosca")}
          </button>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

/* ---------- 1 · join as ---------- */
function WhoStep({ initial, onPick, onBack, onSignIn }) {
  const t = useT();
  const [sel, setSel] = useState(initial || null);
  const answer = useAnswer(onPick);
  const pick = (r) => { setSel(r); answer(r); };
  return (
    <AuthShell onBack={onBack} title={tr("Join as")}
               right={onSignIn && (
                 <button data-tour="auth-signin-instead" onClick={() => { haptic(6); onSignIn(); }} className="active:opacity-50 px-3"
                         style={{ minHeight: 44, fontFamily: ui, fontSize: 16, fontWeight: 600, color: t.accent }}>{tr("Sign in")}</button>
               )}>
      <Choice label={tr("Coach")}  on={sel === "coach"}  onSelect={() => pick("coach")} />
      <Choice label={tr("Player")} on={sel === "player"} onSelect={() => pick("player")} delay={50} />
      <Choice label={tr("Parent")} on={sel === "parent"} onSelect={() => pick("parent")} delay={100} />
    </AuthShell>
  );
}

/* ---------- 2 · main sport ---------- */
function SportStep({ initial, onPick, onBack }) {
  const [sel, setSel] = useState(initial || null);
  const answer = useAnswer(onPick);
  /* each tile its own sport's colour, two across (at three "Equestrian" is cut at 320) */
  return (
    <AuthShell onBack={onBack} title={tr("Main sport")}>
      <SportGrid ids={Object.keys(SPORTS)} picked={sel} onPick={(id) => { setSel(id); answer(id); }} cols={2} tour="signup-sport" />
    </AuthShell>
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

  const errName  = show("name")  && name.trim().length < 2 ? tr("Enter your name") : null;
  const errEmail = show("email") && !emailOk(email)        ? tr("Enter a valid email") : null;
  const errPass  = show("pass")  && pass.length < MIN_PASS ? `${tr("Use at least")} ${MIN_PASS} ${tr("characters")}` : null;
  const dobBad   = show("dob") && dobIssue;
  const dobMsg   = age === "invalid" ? tr("That date doesn't exist") : tr("Enter your date of birth");

  const problems = [
    name.trim().length < 2 && nameWrap,
    dobIssue && dobWrap,
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

  return (
    <AuthShell onBack={onBack} title={tr("Your details")}
               footer={<>
                 <ErrLine>{err}</ErrLine>
                 {err === ALREADY && <div className="mb-3"><Button tone="quiet" onClick={() => onSignInInstead(email.trim().toLowerCase())}>{tr("Sign in")}</Button></div>}
                 <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr(role === "coach" ? "Create account" : "Continue")}</Button>
               </>}>
      <div ref={nameWrap}><AuthField label={tr("Name")} value={name} onChange={setName} onBlur={() => mark("name")} error={errName} autoComplete="name" mic /></div>

      {wantsDob && (
        <div ref={dobWrap} style={{ marginBottom: SPACE.row }}>
          <span className="block" style={{ ...TYPE.eyebrow, color: dobBad ? DANGER : t.sub, marginBottom: 6 }}>{tr("Date of birth")}</span>
          <div className="flex items-center gap-2">
            <DobBox ref={dRef} value={d} onChange={setD} ph={tr("DD")} len={2} bad={dobBad} onDone={() => mRef.current && mRef.current.focus()} />
            <DobBox ref={mRef} value={m} onChange={setM} ph={tr("MM")} len={2} bad={dobBad} onDone={() => yRef.current && yRef.current.focus()} />
            <DobBox ref={yRef} value={y} onChange={setY} ph={tr("YYYY")} len={4} bad={dobBad} onDone={() => { mark("dob"); yRef.current && yRef.current.blur(); }} />
            {typeof age === "number" && <Check size={18} color={STEADY} strokeWidth={2.2} aria-label={`${age}`} style={{ marginLeft: 4 }} />}
          </div>
          {dobBad
            ? <p role="alert" style={{ ...TYPE.caption, color: DANGER, marginTop: 6 }}>{dobMsg}</p>
            : typeof age === "number" && age < ADULT
              ? <p style={{ ...TYPE.caption, color: t.sub, marginTop: 6 }}>{tr("A parent's family code comes next")}</p>
              : null}
        </div>
      )}

      <div ref={emailWrap}><AuthField label={tr("Email")} value={email} onChange={setEmail} onBlur={() => mark("email")} type="email" error={errEmail} autoComplete="email" inputMode="email" /></div>
      <AuthField label={`${tr("Mobile")} · ${tr("optional")}`} value={phone} onChange={setPhone} type="tel" autoComplete="tel" inputMode="tel" />
      <div ref={passWrap}><AuthField label={tr("Password")} value={pass} onChange={setPass} onBlur={() => mark("pass")} type="password" error={errPass} reveal autoComplete="new-password" /></div>
      <p style={{ ...TYPE.caption, color: t.faint, marginTop: 4 }}>{tr("By continuing you accept the Terms and Privacy Policy.")}</p>
    </AuthShell>
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

/* under the boxes, one line: who the code belongs to, Checking…, the problem, or the hint — and the same height
   whichever, so the screen never moves under a code being typed */
function CodeStatus({ look, value, issue, hint, tried }) {
  const t = useT();
  const complete = cleanCode(value).length === 6;
  const line = (children, color) => <p className="flex items-center justify-center gap-1.5 text-center" style={{ ...TYPE.small, minHeight: 20, marginTop: 10, color }}>{children}</p>;
  if (look.status === "ok") {
    return line(<><Check size={15} color={STEADY} strokeWidth={2.2} />
      <span>{look.name}{look.sport && SPORTS[look.sport] ? ` · ${SPORTS[look.sport].label}` : ""}{look.members != null ? ` · ${look.members} ${look.members === 1 ? tr("person") : tr("people")}` : ""}</span></>, t.ink);
  }
  if (complete && (look.status === "checking" || look.status === "idle")) return line(tr("Checking…"), t.faint);
  if (issue && (complete || tried)) return line(issue, DANGER);
  if (hint) return line(hint, t.sub);
  return line(null, t.sub);
}

/* ---------- 4 · your codes (players and parents) ---------- */
function CodesStep({ junior, parent, initial, busy, err, onBack, onDone, onSkip, onSignInInstead }) {
  const t = useT();
  const [coach, setCoach] = useState(initial?.coach || "");
  const [fam, setFam] = useState(initial?.family || "");
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  const coachLook = useCodeLookup("find_coach_by_code", coach);
  const famLook = useCodeLookup("find_family_by_code", fam);
  const coachWrap = useRef(null), famWrap = useRef(null);

  const issueFor = (value, look, noun) => {
    const c = cleanCode(value);
    if (!c) return null;
    if (c.length < 6) return tr("Enter all six characters");
    if (look.status === "error") return tr("Couldn't check that code. Try again");
    if (look.status === "miss") return noun === "coach" ? tr("No coach with that code") : tr("No family with that code");
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

  const label = (text) => <p style={{ ...TYPE.eyebrow, color: t.sub, marginBottom: 8 }}>{text}</p>;

  return (
    <AuthShell onBack={onBack} title={parent ? tr("Your family") : tr("Your codes")}
               footer={<>
                 <ErrLine>{err}</ErrLine>
                 {err === ALREADY && <div className="mb-3"><Button tone="quiet" onClick={onSignInInstead}>{tr("Sign in")}</Button></div>}
                 <Button tone="ink" disabled={busy} onClick={submit}>{busy || pending ? "…" : tr("Create account")}</Button>
                 {!junior && <QuietLink onClick={onSkip} disabled={busy}>{parent ? tr("Start a new family") : tr("Skip for now")}</QuietLink>}
               </>}>
      {!parent && (
        <div ref={coachWrap} style={{ paddingBottom: SPACE.block - 6 }}>
          {label(tr("Coach code"))}
          <CodeBoxes value={coach} onChange={setCoach} bad={!!coachIssue && (cleanCode(coach).length === 6 || tried)} />
          <CodeStatus look={coachLook} value={coach} issue={coachIssue} tried={tried} />
        </div>
      )}
      <div ref={famWrap}>
        {label(tr("Family code"))}
        <CodeBoxes value={fam} onChange={setFam} bad={!!famIssue && (cleanCode(fam).length === 6 || (tried && (junior || !!cleanCode(fam))))} />
        <CodeStatus look={famLook} value={fam} issue={famIssue} tried={tried && junior}
                    hint={junior ? FAMILY_REQUIRED : null} />
      </div>
    </AuthShell>
  );
}

/* ---------- check your inbox ---------- */
function InboxStep({ email, note, onResend, onChangeEmail, onSignIn, onBack }) {
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
    hapticSuccess(); setWait(30); setSent(tr("Sent"));
  };
  return (
    <AuthShell onBack={onBack} title={tr("Check your inbox")} sub={note || tr("Open the link we sent to")}
               footer={<>
                 <Button tone="ink" onClick={onSignIn}>{tr("Sign in")}</Button>
                 <QuietLink onClick={resend} disabled={!!wait}>{wait ? `${tr("Resend email")} · ${wait}s` : tr("Resend email")}</QuietLink>
                 <QuietLink onClick={onChangeEmail}>{tr("Use a different email")}</QuietLink>
               </>}>
      <p style={{ ...TYPE.title, color: t.ink, wordBreak: "break-all" }}>{email}</p>
      <p style={{ ...TYPE.small, color: t.faint, marginTop: SPACE.tight }}>{tr("Check spam if it's not there")}</p>
      {sent && <p role="status" style={{ ...TYPE.small, marginTop: SPACE.tight, color: sent === tr("Sent") ? STEADY : DANGER }}>{sent}</p>}
    </AuthShell>
  );
}

/* ---------- sign in ---------- */
function SignInStep({ initialEmail, busy, err, onBack, onSubmit, onForgot, clearErr, sub, onCreate }) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail || "");
  const [pass, setPass] = useState("");
  const [tried, setTried] = useState(false);
  const emailWrap = useRef(null), passWrap = useRef(null);
  const eEmail = tried && !emailOk(email) ? tr("Enter your email") : null;
  const ePass = tried && !pass ? tr("Enter your password") : null;
  const submit = () => {
    if (busy) return;
    if (!emailOk(email) || !pass) { setTried(true); hapticWarn(); showProblem(!emailOk(email) ? emailWrap : passWrap); return; }
    onSubmit(email.trim().toLowerCase(), pass);
  };
  return (
    <AuthShell onBack={onBack} title={tr("Sign in")} sub={sub}
               footer={<>
                 <ErrLine>{err}</ErrLine>
                 <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr("Sign in")}</Button>
                 {onCreate && <QuietLink tour="auth-create-instead" onClick={onCreate}>{tr("Create account")}</QuietLink>}
               </>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div ref={emailWrap}><AuthField label={tr("Email")} value={email} onChange={(v) => { setEmail(v); clearErr(); }}
               type="email" autoFocus={!initialEmail && !sub} error={eEmail} autoComplete="email" inputMode="email" /></div>
        <div ref={passWrap}><AuthField label={tr("Password")} value={pass} onChange={(v) => { setPass(v); clearErr(); }}
               type="password" reveal autoFocus={!!initialEmail} error={ePass} autoComplete="current-password" /></div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      {/* the least important control on the screen: a quiet line, never a heading under the password */}
      <button onClick={() => { haptic(6); onForgot(email.trim().toLowerCase()); }} className="active:opacity-50"
              style={{ minHeight: 44, fontFamily: ui, fontSize: 15, fontWeight: 500, color: t.sub }}>
        {tr("Forgot password?")}
      </button>
    </AuthShell>
  );
}

/* ---------- forgot password ---------- */
function ForgotStep({ initialEmail, busy, err, onBack, onSend }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [tried, setTried] = useState(false);
  const wrap = useRef(null);
  const eEmail = tried && !emailOk(email) ? tr("Enter your email") : null;
  const submit = () => {
    if (busy) return;
    if (!emailOk(email)) { setTried(true); hapticWarn(); showProblem(wrap); return; }
    onSend(email.trim().toLowerCase());
  };
  return (
    <AuthShell onBack={onBack} title={tr("Reset password")}
               footer={<>
                 <ErrLine>{err}</ErrLine>
                 <Button tone="ink" disabled={busy} onClick={submit}>{busy ? "…" : tr("Send reset link")}</Button>
               </>}>
      <div ref={wrap}>
        <AuthField label={tr("Email")} value={email} onChange={setEmail} type="email"
                   autoFocus={!initialEmail} error={eEmail} autoComplete="email" inputMode="email" />
      </div>
    </AuthShell>
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
  const e1 = (touched.p1 || tried) && p1.length < MIN_PASS ? `${tr("Use at least")} ${MIN_PASS} ${tr("characters")}` : null;
  const e2 = (touched.p2 || tried) && p2 !== p1 ? tr("These don't match") : null;
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
      <AuthShell title={tr("New password")} sub={email || null}
                 footer={<>
                   <ErrLine>{err}</ErrLine>
                   <Button tone="ink" disabled={busy} onClick={save}>{busy ? "…" : tr("Save")}</Button>
                   <QuietLink onClick={clearRecovery} disabled={busy}>{tr("Not now")}</QuietLink>
                 </>}>
        <div ref={w1}><AuthField label={tr("New password")} value={p1} onChange={setP1} onBlur={() => mark("p1")}
               type="password" reveal error={e1} autoFocus autoComplete="new-password" /></div>
        <div ref={w2}><AuthField label={tr("Confirm password")} value={p2} onChange={setP2} onBlur={() => mark("p2")}
               type="password" reveal error={e2} autoComplete="new-password" /></div>
      </AuthShell>
    </Neutral>
  );
}

/* ================================================================== */

/* a Home Screen app on an iPhone keeps its own storage: whoever signed up in Safari is signed out in it */
const homeScreenIphone = () => isStandalone() && isIos();
const signedInHereBefore = () => { try { return window.localStorage.getItem("nosca.here") === "1"; } catch (e) { return false; } };

export default function Auth({ invite, mode, onInviteUsed, start }) {
  /* where the front door opens: the question itself when the card's page handed over (`start`), Sign in inside an
     iPhone's Home Screen app, else the landing */
  const [first] = useState(() => start || (homeScreenIphone() ? "signin" : "landing"));
  const [stage, setStage] = useState(first);
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
          setInbox({ email, kind: "signup", note: tr("Confirm your email first") });
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
      /* The join link did its job here — the trigger linked the account
         from the code — so the app is not offered it again. */
      if (invite && c && (c.coach_code === invite.code || c.family_code === invite.code) && onInviteUsed) onInviteUsed();

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
    /* opened on Sign in in an iPhone's Home Screen app: the one line that says why, and Create account under the key */
    const opening = first === "signin";
    return (
      <Neutral>
        <SignInStep initialEmail={signinEmail} busy={busy} err={err} clearErr={() => setErr("")}
                    onBack={() => go("landing")} onSubmit={signIn}
                    sub={opening && !signedInHereBefore() ? tr("Signed up in Safari? Sign in once here.") : null}
                    onCreate={opening ? () => go("who") : null}
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
        <InboxStep email={inbox.email} note={inbox.note} onResend={resend}
                   onBack={() => go(inbox.kind === "reset" ? "forgot" : role ? "details" : "signin")}
                   onChangeEmail={() => go(inbox.kind === "reset" ? "forgot" : role ? "details" : "signin")}
                   onSignIn={() => { setSigninEmail(inbox.email); go("signin"); }} />
      </Neutral>
    );
  }

  if (stage === "who") {
    return (
      <Neutral>
        <WhoStep initial={role} onBack={() => go("landing")} onSignIn={() => go("signin")}
                 onPick={(r) => { setRole(r); go("sport"); }} />
      </Neutral>
    );
  }

  if (stage === "sport") {
    return (
      <Neutral>
        <SportStep initial={sport} onBack={() => go("who")} onPick={(id) => { setSport(id); go("details"); }} />
      </Neutral>
    );
  }

  if (stage === "codes") {
    return (
      <Neutral>
        <CodesStep junior={typeof details?.age === "number" && details.age < ADULT} parent={role === "parent"}
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
                     if (role === "player" || role === "parent") { setStage("codes"); return; }
                     createAccount(d, null);
                   }} />
    </Neutral>
  );
}
