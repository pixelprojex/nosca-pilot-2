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

export const supabase = createClient(url, anonKey);
