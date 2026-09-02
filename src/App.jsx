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

function SignedIn({ profile, signOut }) {
  const data = useNoscaData(profile);

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
        juvenile: profile.role === "player" && isUnder18(profile.date_of_birth),
      }}
      data={data}
      onSignOut={signOut}
    />
  );
}

function Gate() {
  const { session, profile, loadingProfile, signOut } = useAuth();
  const demo = typeof window !== "undefined" && window.location.search.includes("demo");
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
  return <SignedIn profile={profile} signOut={signOut} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
