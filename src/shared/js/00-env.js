/* ══════════════════════════════════════════════════════════
   ENVIRONMENT
   Written in by build.py from .env (or from the environment
   variables set in Netlify), never typed in by hand and never
   committed with real values in it.

     SUPABASE_URL         https://abcdefgh.supabase.co
     SUPABASE_ANON_KEY    the "anon public" key, eyJ…
     SUPABASE_BUCKET      the storage bucket for product photos

   The anon key is *meant* to be public — it ships inside every
   Supabase website. What protects the data is row level
   security in supabase/01-schema.sql, not the secrecy of this
   string. The service_role key is the one that must never
   appear here; nothing in this project uses it.

   Left empty, both pages still work: the shop falls back to the
   catalogue written into its own JavaScript and keeps the
   basket on the phone, and the dashboard says it is not
   configured instead of failing.
   ══════════════════════════════════════════════════════════ */
const ENV = {
  SUPABASE_URL:      "",
  SUPABASE_ANON_KEY: "",
  SUPABASE_BUCKET:   "product-images"
};
