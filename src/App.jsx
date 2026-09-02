import React from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Auth from "./pages/Auth";
import Nosca from "./Nosca";
import { useNoscaData } from "./lib/useNoscaData";

/* The full designed application, behind the real sign-in.
 *
 * Nosca still runs on its own seeded data at this point — porting each
 * screen onto the database is the next stage of work, done one screen
 * at a time so the app stays usable throughout. What this gives us now
 * is the real interface, live, behind real accounts.
 *
 * Appending ?demo to the URL brings back the design harness: the
 * preview toolbar, persona switcher and phone frame. The previous
 * plain pilot screens are preserved in App.pilot.jsx.bak and in
 * src/pages, so nothing built so far has been discarded.
 */
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

function SignedIn({ profile, signOut, email }) {
  const data = useNoscaData(profile);
  const { refreshProfile } = useAuth();

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

  return (
    <Nosca
      account={{
        id: profile.id, role: profile.role, name: profile.name, sport: profile.sport,
        accountType: profile.account_type,
        email: email || null,
        phone: profile.phone || null,
        /* Either answer marks someone as a minor: what they chose at
           sign-up, or what their date of birth says. Trusting only the
           date would miss a junior who mistyped it; trusting only the
           choice would miss one who picked "adult player" by accident. */
        juvenile: profile.role === "player"
          && (profile.account_type === "junior" || isUnder18(profile.date_of_birth)),
      }}
      data={data}
      onSignOut={signOut}
      onJoinCoach={async (code) => {
        const res = await data.joinCoach(code);
        if (res && !res.error) await refreshProfile();
        return res;
      }}
    />
  );
}

function Gate() {
  const { session, profile, loadingProfile, signOut, needsProfile } = useAuth();
  const demo = typeof window !== "undefined" && (
    window.location.search.includes("demo")
    || window.location.hash.includes("demo")
    || window.location.pathname.replace(/\/+$/, "").endsWith("/demo")
  );
  const [stuck, setStuck] = React.useState(false);

  React.useEffect(() => {
    if (!loadingProfile) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 8000);   // long enough for a real load, short enough not to feel broken
    return () => clearTimeout(t);
  }, [loadingProfile]);

  // The design harness needs no account — it is for us, not for users.
  if (demo) return <Nosca demo />;

  if (session === undefined) return null;
  if (!session) return <Auth />;

  /* Signed in, but the profile row never got created — an interrupted
     sign-up. Rather than a dead end, say what happened and give the
     two things that actually fix it. */
  if (needsProfile && !loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
           style={{ background: "#FAF7F0" }}>
        <p style={{ color: "#1A1815", fontSize: 17, marginBottom: 10 }}>Your account isn't finished</p>
        <p style={{ color: "#6B6560", fontSize: 14, lineHeight: 1.55, maxWidth: 330, marginBottom: 26 }}>
          The account exists but its details were never saved — usually because
          email confirmation interrupted the sign-up. Signing out and signing
          up again with the same email will finish it.
        </p>
        <button onClick={signOut}
                style={{ background: "#1A1815", color: "#fff", borderRadius: 9,
                         padding: "13px 26px", fontSize: 14.5, width: 220 }}>
          Sign out and start again
        </button>
      </div>
    );
  }

  if (loadingProfile || !profile) {
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
  return <SignedIn profile={profile} signOut={signOut} email={session?.user?.email} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
