import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

/* AUTH
 *
 * A database trigger creates the profile in the same transaction as
 * the user, so a session always has a profile behind it. That removes
 * the whole category of problem this file used to work around —
 * retries, orphan detection, signing people out of accounts they had
 * just created.
 *
 * One case remains worth handling: a profile that genuinely isn't
 * there, which now only happens if the database was wiped underneath
 * a live session. That gets a clear signal rather than a silent
 * sign-out.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);   // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const loadProfile = async (userId) => {
    setLoadingProfile(true);
    setNeedsProfile(false);
    try {
      const { data, error } = await supabase
        .from("profiles").select("*").eq("id", userId).maybeSingle();

      if (error) {
        /* A real failure reading the row — network, or permissions.
           Don't sign out: the session is fine and a retry may work. */
        setProfile(null);
        setNeedsProfile(true);
      } else if (!data) {
        setProfile(null);
        setNeedsProfile(true);
      } else {
        setProfile(data);
      }
    } catch (e) {
      setProfile(null);
      setNeedsProfile(true);
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      if (next) loadProfile(next.user.id);
      else { setProfile(null); setNeedsProfile(false); }
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setNeedsProfile(false);
  };

  return (
    <Ctx.Provider value={{
      session, profile, setProfile, loadingProfile, needsProfile, signOut,
      refreshProfile: () => session && loadProfile(session.user.id),
    }}>
      {children}
    </Ctx.Provider>
  );
}
