import { createClient } from "@supabase/supabase-js";

/* These two values come from Supabase → Project Settings → API.
   They are set as environment variables (see .env.example) so the
   real keys never get committed to the repo. */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly rather than silently rendering a blank app.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Set them in a .env file locally, or in Netlify → Site settings → Environment variables."
  );
}

/* Signing in once should be enough. These are the library's defaults,
   set out here deliberately rather than assumed, because "you stay
   signed in on your own device" is a promise the app makes to the
   person using it, not an implementation detail:
     persistSession   — keep the session in local storage, so closing
                        the tab or restarting the phone doesn't sign
                        them out
     autoRefreshToken — renew it quietly in the background before it
                        expires, so a returning user never meets a
                        login screen they didn't ask for
     detectSessionInUrl — pick up the token from an email confirmation
                        link and complete the sign-in automatically */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "nosca.auth",
  },
});
