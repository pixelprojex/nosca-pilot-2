import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const signingUp = useRef(false);

  const loadProfile = async (userId) => {
    setLoadingProfile(true);
    try {
      /* During sign-up the session exists a moment before the profile
         row does — signUp() creates the account, and only then does the
         insert run. Looking once and giving up would sign the person
         straight back out of the account they just created, which is
         exactly what was happening. So: look a few times, briefly,
         before concluding the row genuinely isn't there. */
      let data = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (res.data) { data = res.data; break; }
        if (signingUp.current) await new Promise((r) => setTimeout(r, 400));
        else break;                       // not mid-sign-up: one look is enough
      }

      if (!data) {
        /* No row after all that — the account really is orphaned, which
           happens after a reset wipes the profiles table. Sign out
           cleanly rather than spinning forever. */
        await supabase.auth.signOut();
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (e) {
      /* Network error or anything else unexpected — sign out rather
         than leaving the app in an unrecoverable loading state. */
      await supabase.auth.signOut();
      setProfile(null);
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadProfile(newSession.user.id);
      else { setProfile(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{
      session, profile, setProfile, loadingProfile, signOut,
      beginSignUp: () => { signingUp.current = true; },
      endSignUp: () => { signingUp.current = false; },
      refreshProfile: () => session && loadProfile(session.user.id),
    }}>
      {children}
    </Ctx.Provider>
  );
}
