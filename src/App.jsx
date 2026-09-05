import React, { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Auth from "./pages/Auth";
import Arrival from "./pages/Arrival";
import Nosca from "./Nosca";
import { useNoscaData } from "./lib/useNoscaData";

/* The full designed application, behind the real sign-in.
 *
 * Appending ?demo to the URL brings back the design harness: the
 * preview toolbar, persona switcher and phone frame. The previous
 * plain pilot screens are preserved in App.pilot.jsx.bak and in
 * src/pages, so nothing built so far has been discarded.
 */

const isDemoUrl = () => typeof window !== "undefined" && (
  window.location.search.includes("demo")
  || window.location.hash.includes("demo")
  || window.location.pathname.replace(/\/+$/, "").endsWith("/demo")
);

/* A join link — https://<site>/?join=CODE or ?family=CODE — is read once
   when the app starts and taken out of the address bar, so a reload
   doesn't offer the invitation twice and the code never sits in the
   URL a person shares on. Never in the design harness. */
const INVITE = (() => {
  if (typeof window === "undefined" || isDemoUrl()) return null;
  const params = new URLSearchParams(window.location.search);
  const clean = (v) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const join = clean(params.get("join")), family = clean(params.get("family"));
  if (!join && !family) return null;
  params.delete("join"); params.delete("family");
  const rest = params.toString();
  try {
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  } catch (e) { /* nothing depends on it */ }
  return join ? { kind: "coach", code: join } : { kind: "family", code: family };
})();

/* Whole years between a date of birth and today. Used only to decide
   whether booking and messaging should be handled by the coach instead
   of the player themselves — the database enforces the same rule
   independently, so this is what drives the interface, not the only
   thing standing between a minor and those actions. */
function isUnder18(dob) {
  if (!dob) return false;
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const beforeBirthday = now.getMonth() < b.getMonth()
    || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (beforeBirthday) age--;
  return age < 18;
}

/* Set by Auth the moment an account is created; read here once and
   cleared, so the arrival screen shows exactly one time. */
const readArrival = () => {
  try { return window.sessionStorage.getItem("nosca.arrival") || null; } catch (e) { return null; }
};

function SignedIn({ profile, signOut, email, invite, onInviteUsed }) {
  const data = useNoscaData(profile);
  const { refreshProfile } = useAuth();
  const [arrival, setArrival] = useState(readArrival);
  useEffect(() => { try { window.sessionStorage.removeItem("nosca.arrival"); } catch (e) { /* private mode */ } }, []);

  /* One object per real change. Nosca resets its navigation whenever
     this prop's identity changes, and SignedIn re-renders on every data
     refresh — so a fresh object each render would send the coach back
     to Today after every save. Memoised on the fields it is made of. */
  const account = useMemo(() => ({
    id: profile.id, role: profile.role, name: profile.name, sport: profile.sport,
    accountType: profile.account_type,
    email: email || null,
    phone: profile.phone || null,
    club: profile.club || null,
    /* Either answer marks someone as a minor: what they chose at
       sign-up, or what their date of birth says. Trusting only the
       date would miss a junior who mistyped it; trusting only the
       choice would miss one who picked "adult player" by accident. */
    juvenile: profile.role === "player"
      && (profile.account_type === "junior" || isUnder18(profile.date_of_birth)),
  }), [profile.id, profile.role, profile.name, profile.sport, profile.account_type,
       profile.phone, profile.club, profile.date_of_birth, email]);

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "#FAF7F0", color: "#A39E93", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (data.loadError) {
    /* An unrecoverable spinner is worse than an honest error. This
       always gives a way out, even if the database itself is broken. */
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
           style={{ background: "#FAF7F0" }}>
        <p style={{ color: "#1A1815", fontSize: 15, marginBottom: 8 }}>Couldn't load your data.</p>
        <p style={{ color: "#A39E93", fontSize: 13, marginBottom: 24 }}>{data.loadError}</p>
        <button onClick={data.reload}
                style={{ background: "#1A1815", color: "#fff", borderRadius: 9,
                         padding: "12px 24px", fontSize: 14, marginBottom: 12, width: 200 }}>
          Try again
        </button>
        <button onClick={signOut} style={{ color: "#A39E93", fontSize: 13, textDecoration: "underline" }}>
          Sign out
        </button>
      </div>
    );
  }

  /* Straight after creating the account: the code to hand out, or who
     they're linked to. Once, then the app. The data hook stays mounted
     underneath, so the app opens with everything already loaded. */
  if (arrival) {
    return <Arrival role={arrival} profile={profile} data={data} onDone={() => setArrival(null)} />;
  }

  return (
    <Nosca
      account={account}
      data={data}
      onSignOut={signOut}
      onJoinCoach={async (code) => {
        const res = await data.joinCoach(code);
        if (res && !res.error) await refreshProfile();
        return res;
      }}
      /* Personal details and Branding write to the profile row; the
         cached sign-in profile is refreshed so the header and the
         settings sub-line follow without a reload. */
      onProfileChanged={refreshProfile}
      /* a join link opened while signed in: the app offers it once */
      invite={invite}
      onInviteUsed={onInviteUsed}
    />
  );
}

function Gate() {
  const { session, profile, loadingProfile, signOut, needsProfile, loadError, refreshProfile, recovery } = useAuth();
  const demo = isDemoUrl();
  const [stuck, setStuck] = React.useState(false);
  /* The join link, held until whichever side uses it: the sign-up
     (codes pre-filled) or the signed-in app (offered once). Cleared
     then, so a later sign-in in this tab is not offered it again. */
  const [invite, setInvite] = useState(INVITE);
  const inviteUsed = () => setInvite(null);

  React.useEffect(() => {
    if (!loadingProfile) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 8000);   // long enough for a real load, short enough not to feel broken
    return () => clearTimeout(t);
  }, [loadingProfile]);

  // The design harness needs no account — it is for us, not for users.
  if (demo) return <Nosca demo />;

  if (session === undefined) return null;
  if (!session) return <Auth invite={invite} onInviteUsed={inviteUsed} />;

  /* Arrived from a password-reset email. There is a session, but the
     one thing to do is set the new password — before the app. */
  if (recovery) return <Auth mode="recovery" />;

  /* Everything from here to the end only applies while there is no
     profile yet. Once one is loaded the app stays mounted, even while
     a refresh is in flight — otherwise joining a coach (which refreshes
     the profile) would tear the whole interface down mid-moment. */
  if (profile) return <SignedIn profile={profile} signOut={signOut} email={session?.user?.email} invite={invite} onInviteUsed={inviteUsed} />;

  /* The database refused or failed the read. This is a fault to be
     fixed, not something the person did — so it says what the
     database said, rather than blaming their account. */
  if (loadError && !loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
           style={{ background: "#FAF7F0" }}>
        <p style={{ color: "#1A1815", fontSize: 17, marginBottom: 10 }}>Couldn't load your account</p>
        <p style={{ color: "#6B6560", fontSize: 13.5, lineHeight: 1.55, maxWidth: 340, marginBottom: 8 }}>
          The database returned:
        </p>
        <p style={{ color: "#C4342A", fontSize: 13, lineHeight: 1.5, maxWidth: 340,
                    marginBottom: 24, fontFamily: "ui-monospace, monospace" }}>
          {loadError}
        </p>
        <button onClick={() => window.location.reload()}
                style={{ background: "#1A1815", color: "#fff", borderRadius: 9,
                         padding: "13px 26px", fontSize: 14.5, width: 220, marginBottom: 12 }}>
          Try again
        </button>
        <button onClick={signOut} style={{ color: "#A39E93", fontSize: 13, textDecoration: "underline" }}>
          Sign out
        </button>
      </div>
    );
  }

  /* Signed in but the profile couldn't be READ. With the trigger in
     place the row always exists, so reaching here means the read
     itself failed — and the cause worth naming is the recursive
     policy that used to sit on this table, which raised on every
     select. Retrying costs nothing and succeeds the moment the SQL
     has been run, so this offers that rather than a dead end. */
  if (needsProfile && !loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
           style={{ background: "#FAF7F0" }}>
        <p style={{ color: "#1A1815", fontSize: 17, marginBottom: 10 }}>Couldn't load your account</p>
        <p style={{ color: "#6B6560", fontSize: 14, lineHeight: 1.55, maxWidth: 340, marginBottom: 26 }}>
          Your account is there, but its details couldn't be read. If
          nosca.sql hasn't been run in Supabase yet, that's the reason —
          run it, then press Try again.
        </p>
        <button onClick={refreshProfile}
                style={{ background: "#1A1815", color: "#fff", borderRadius: 9,
                         padding: "13px 26px", fontSize: 14.5, width: 220, marginBottom: 14 }}>
          Try again
        </button>
        <button onClick={signOut} style={{ color: "#A39E93", fontSize: 13, textDecoration: "underline" }}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
         style={{ background: "#FAF7F0" }}>
      <p style={{ color: "#A39E93", fontSize: 14, marginBottom: stuck ? 20 : 0 }}>Loading…</p>
      {stuck && (
        <button onClick={signOut} style={{ color: "#A39E93", fontSize: 13, textDecoration: "underline" }}>
          Taking too long? Sign out
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
