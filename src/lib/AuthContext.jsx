import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const loadProfile = async (userId) => {
    setLoadingProfile(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!data) {
        /* The session exists but the profile row is gone — this happens
           after a reset wipes the accounts table. Sign out cleanly so
           the person lands on the sign-in screen rather than spinning
           forever. */
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
      refreshProfile: () => session && loadProfile(session.user.id),
    }}>
      {children}
    </Ctx.Provider>
  );
}
