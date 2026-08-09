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
  SUPABASE_BUCKET:   "product-images",

  /* Where the product photos are served from — the CloudFront address in
     front of the S3 bucket, e.g. https://d111111abcdef8.cloudfront.net
     (no trailing slash).

     Left empty, everything falls back to Supabase Storage exactly as
     before. That is deliberate: the switch between the two is one
     environment variable, so it can be turned on, looked at, and turned
     off again without a code change. */
  CDN_URL:           "",

  /* Where the seller dashboard is published. Set ADMIN_PATH in .env and in
     Netlify to something nobody would type by accident; the shop reads it
     from here to link the owner straight to it.

     This is not what protects the dashboard — the database is, and it
     refuses anyone whose profile is not role = 'admin'. It just means a
     stranger cannot find it by adding /admin to the address. */
  ADMIN_PATH:        "admin",

  /* Razorpay's *public* key id, the one their own checkout script expects to
     find in the page. The key secret is not here and must never be: it lives
     in Netlify's environment variables, where the two functions under
     netlify/functions read it. Left empty, the shop falls back to sending
     the bill on WhatsApp exactly as it did before. */
  RAZORPAY_KEY_ID:   "",

  /* Where the payment functions answer, e.g.
     https://xxxxxxxx.lambda-url.ap-south-1.on.aws (no trailing slash).

     Left empty they are reached at /api/…, which the host rewrites onto the
     same functions — one address, no CORS, nothing third-party in the page.
     That is the nicer arrangement and it is still the default.

     It is worth setting when the site is served from one region and the
     functions run in another. Amplify's rewrite is not a redirect: the
     request travels to wherever the app is hosted and is forwarded from
     there, so a customer in Mumbai reaching a Mumbai function through a
     Stockholm app crosses Europe twice for one order. Measured, that is
     around 950ms against 100ms straight to the function.

     Set this and the browser talks to the function directly. The address
     is not a secret — Razorpay's webhook already posts to it — but the
     function URL must then allow this origin under Configuration →
     Function URL → CORS, or the browser will refuse the call. */
  API_BASE:          ""
};

/* One place that knows where the functions are, because the shop, the
   dashboard and the photo upload all have to agree. */
const API_ROOT = (ENV.API_BASE || "/api").replace(/\/+$/, "");
const apiUrl = name => API_ROOT + "/" + name;
