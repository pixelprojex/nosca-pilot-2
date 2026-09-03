import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const [loadError, setLoadError] = useState(null);
  const loadedFor = useRef(null);   // whose profile the last load was for

  const loadProfile = async (userId) => {
    loadedFor.current = userId;
    setLoadingProfile(true);
    setNeedsProfile(false);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("profiles").select("*").eq("id", userId).maybeSingle();

      if (error) {
        /* Show what the database actually said. The previous version
           reported "your account isn't finished" for any failure at
           all, which was badly misleading: the real cause was a
           recursive security policy making every read impossible, and
           the message sent people off to re-create an account that
           already existed and was fine. An unreadable profile and a
           missing profile are different problems and now read
           differently. */
        loadedFor.current = null;   // so the next sign-in event tries again
        setProfile(null);
        setLoadError(error.message || "Couldn't read your profile.");
        setNeedsProfile(false);
      } else if (!data) {
        loadedFor.current = null;
        setProfile(null);
        setLoadError(null);
        setNeedsProfile(true);
      } else {
        setLoadError(null);
        setProfile(data);
      }
    } catch (e) {
      loadedFor.current = null;
      setProfile(null);
      setLoadError((e && e.message) || "Couldn't reach the database.");
      setNeedsProfile(false);
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      /* The listener below usually gets here first with INITIAL_SESSION;
         this only loads if it hasn't already. */
      if (data.session && data.session.user.id !== loadedFor.current) loadProfile(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next);
      if (!next) { loadedFor.current = null; setProfile(null); setNeedsProfile(false); setLoadError(null); return; }
      /* Tokens refresh quietly in the background, and the library
         re-announces the same session when a tab regains focus. Neither
         changes who is signed in, so neither refetches the profile — a
         refetch here would re-render the whole app from the top each
         time the phone woke up. */
      if (next.user.id !== loadedFor.current || event === "USER_UPDATED") loadProfile(next.user.id);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedFor.current = null;
    setProfile(null);
    setNeedsProfile(false);
    setLoadError(null);
  };

  return (
    <Ctx.Provider value={{
      session, profile, setProfile, loadingProfile, needsProfile, loadError, signOut,
      refreshProfile: () => session && loadProfile(session.user.id),
    }}>
      {children}
    </Ctx.Provider>
  );
}
