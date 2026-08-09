/* ══════════════════════════════════════════════════════════
   SUPABASE CLIENT
   Plain fetch against the auth, REST and storage endpoints —
   no client library, so neither page downloads anything it does
   not need. Shared by the shop and the seller dashboard.

   Everything is on this one object so the two pages cannot
   drift apart on session handling, token refresh or the wording
   of a network error.

     SB.on            configured at all?
     SB.signedIn()    is there a live session?
     SB.user()        {id, email, name} or null
     SB.rest(query)   GET  /rest/v1/<query>
     SB.from(t, q)    GET  /rest/v1/<t>?<q>
     SB.rpc(fn, args) POST /rest/v1/rpc/<fn>
     SB.patch(p, b)   PATCH a REST path
     SB.signIn / signUp / signOut
     SB.oauth("google")   hand the browser to Google and back
     SB.consumeUrl()      pick a session out of the address bar
     SB.whoAmI()          who that session belongs to
     SB.resetPassword / updatePassword
     SB.providers()   which sign-in methods the project has on
     SB.photoUrl(p)   public URL for a file in the photo bucket
     SB.onChange(fn)  called whenever the session changes

   A session that arrives through the address bar has a token but
   no user attached, so signedIn() stays false until whoAmI() has
   filled it in. Always: consumeUrl() → whoAmI() → then paint.
   ══════════════════════════════════════════════════════════ */
/* A Blob as base64, without the "data:image/webp;base64," that FileReader
   puts on the front. Done in one go rather than over a growing string:
   String.fromCharCode.apply on a megabyte of bytes overflows the stack on
   exactly the large photo it is most needed for. */
function toBase64(blob){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i < 0 ? s : s.slice(i + 1));
    };
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(blob);
  });
}

const SB = (function(){
  let URL_ = "", KEY_ = "", BUCKET_ = "product-images", SES_KEY = "rag_session";
  let CDN_ = "";                       /* CloudFront, when the photos live on S3 */
  let session = null, refreshing = null, providerCache = null;
  const listeners = [];
  const nowSec = () => Math.floor(Date.now() / 1000);

  function init(o){
    URL_    = String((o && o.url)    || "").replace(/\/+$/, "");
    KEY_    = String((o && o.key)    || "");
    BUCKET_ = String((o && o.bucket) || "product-images");
    CDN_    = String((o && o.cdn)    || "").replace(/\/+$/, "");
    if(o && o.sessionKey) SES_KEY = o.sessionKey;
    api.on = !!(URL_ && KEY_);
    session = read();
    return api.on;
  }

  /* ── the session, kept beside the basket in localStorage ── */
  function read(){
    try{
      const s = JSON.parse(localStorage.getItem(SES_KEY) || "null");
      if(s && s.access_token && s.refresh_token && s.user && s.user.id){
        /* Sessions stored before the avatar was read have no such field, and
           nothing would ever add one: the session is only rewritten when the
           token refreshes. So the picture never appeared for anyone already
           signed in. Mark it and let whoAmI() fill it in on the next load. */
        if(!("avatar" in s.user)) s.stale = true;
        return s;
      }
    }catch(e){}
    return null;
  }
  function write(s){
    session = s || null;
    try{
      if(session) localStorage.setItem(SES_KEY, JSON.stringify(session));
      else localStorage.removeItem(SES_KEY);
    }catch(e){}
    listeners.forEach(fn => { try{ fn(session); }catch(e){} });
  }
  /* Google hands back a name and a profile picture; an email sign-up hands
     back neither. Both are read the same way here so the rest of the app
     never has to know which was used. */
  function shapeUser(u){
    const m = u.user_metadata || {};
    return {
      id:     u.id,
      email:  u.email || "",
      name:   m.full_name || m.name || "",
      avatar: m.avatar_url || m.picture || ""
    };
  }

  function shape(j){
    if(!j || !j.access_token) return null;
    const u = j.user || {};
    return {
      access_token:  j.access_token,
      refresh_token: j.refresh_token || "",
      expires_at:    nowSec() + (parseInt(j.expires_in, 10) || 3600),
      user: u.id ? shapeUser(u) : null
    };
  }

  /* ── one wrapper for every call ── */
  async function call(path, opt){
    const o = opt || {};
    const h = {apikey: KEY_};
    if(o.body !== undefined) h["Content-Type"] = "application/json";
    h.Authorization = "Bearer " + ((o.auth !== false && session) ? session.access_token : KEY_);
    /* applied last, so a call carrying its own token — signing out uses the
       one being thrown away — is not overwritten by the line above */
    if(o.headers) Object.assign(h, o.headers);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeout || 12000);
    let res;
    try{
      res = await fetch(URL_ + path, {
        method:  o.method || "GET",
        headers: h,
        body:    o.body === undefined ? undefined : JSON.stringify(o.body),
        signal:  ctl.signal
      });
    }catch(err){
      clearTimeout(timer);
      throw new Error(err && err.name === "AbortError"
        ? "The server did not answer. Check your connection."
        : "Could not reach the server. Check your connection.");
    }
    clearTimeout(timer);

    const text = await res.text();
    let data = null;
    if(text){ try{ data = JSON.parse(text); }catch(e){ data = text; } }
    if(!res.ok){
      const m = data && typeof data === "object"
        ? (data.message || data.error_description || data.msg || data.error_message || data.error || data.hint)
        : null;
      const err = new Error(String(m || ("Request failed (" + res.status + ")")));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* An access token lasts an hour. Renew it a minute early, once, however
     many calls are waiting on it. */
  async function fresh(){
    if(!session) return null;
    if(session.expires_at - nowSec() > 60) return session;
    if(!session.refresh_token){ write(null); return null; }
    if(!refreshing){
      refreshing = call("/auth/v1/token?grant_type=refresh_token", {
        method:"POST", auth:false, body:{refresh_token: session.refresh_token}
      }).then(j => {
        const s = shape(j);
        if(s){ if(!s.user && session) s.user = session.user; write(s); }
        else write(null);
        refreshing = null;
      }, () => {
        write(null);                 /* refresh token rejected: sign out quietly */
        refreshing = null;
      });
    }
    try{ await refreshing; }catch(e){}
    return session;
  }

  async function authed(path, opt){ await fresh(); return call(path, opt); }

  const api = {
    on: false,
    init,
    url:    () => URL_,
    bucket: () => BUCKET_,
    session:  () => session,
    signedIn: () => !!(session && session.access_token && session.user),
    user:     () => (session && session.user) || null,

    /* A token good for the next minute at least, for the rare thing that has
       to talk to something other than Supabase on the customer's behalf —
       the payment functions ask the database "is this really their order?"
       with it. Refreshed first, or an hour-old page starts a payment nobody
       is signed in for. */
    token: async () => { const s = await fresh(); return (s && s.access_token) || null; },

    call,                                             /* raw, no refresh */
    authed,                                           /* refreshes first */
    rest:  q => authed("/rest/v1/" + q),
    from:  (table, query) => authed("/rest/v1/" + table + (query ? "?" + query : "")),
    rpc:   (fn, args) => authed("/rest/v1/rpc/" + fn, {method:"POST", body: args || {}}),
    patch: (path, body) => authed("/rest/v1/" + path,
             {method:"PATCH", headers:{Prefer:"return=representation"}, body}),
    insert:(table, body, opts) => authed("/rest/v1/" + table,
             {method:"POST", headers:{Prefer:(opts && opts.prefer) || "return=minimal"}, body}),
    del:   path => authed("/rest/v1/" + path, {method:"DELETE"}),

    onChange(fn){ if(typeof fn === "function") listeners.push(fn); },

    async signUp(email, password, fullName){
      const j = await call("/auth/v1/signup", {
        method:"POST", auth:false,
        body:{email, password, data:{full_name: fullName || ""}}
      });
      const s = shape(j);
      if(s) write(s);
      return s;                       /* null when email confirmation is on */
    },
    async signIn(email, password){
      const j = await call("/auth/v1/token?grant_type=password", {
        method:"POST", auth:false, body:{email, password}
      });
      const s = shape(j);
      if(!s) throw new Error("Could not sign in.");
      write(s);
      return s;
    },
    signOut(){
      const had = session;
      write(null);
      if(had) call("/auth/v1/logout", {
        method:"POST", auth:false,
        headers:{Authorization:"Bearer " + had.access_token}
      }).catch(() => {});
    },
    /* ── forgotten passwords ──
       The link in the email goes to Supabase, which checks the token and
       bounces the browser back to redirectTo carrying a live session in the
       address bar. consumeUrl() below picks it up and says it was a recovery,
       and the page then asks for the new password. redirectTo has to be on
       the project's allow-list: Authentication → URL Configuration. */
    async resetPassword(email, redirectTo){
      return call("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo || location.origin + location.pathname),
                  {method:"POST", auth:false, body:{email}});
    },
    async updatePassword(password){
      const j = await authed("/auth/v1/user", {method:"PUT", body:{password}});
      /* the reply is the user, not a session — keep the one we are already on */
      return j;
    },

    /* ── signing in with Google ──
       No client library, so this is the plain redirect: hand the browser to
       Supabase, which does the dance with Google and sends it back with the
       tokens in the fragment. No code_challenge is sent, so the answer comes
       back as an implicit-flow hash rather than a PKCE code — which is the
       one a page with no build step can read. */
    oauth(provider, redirectTo){
      const to = redirectTo || (location.origin + location.pathname);
      location.href = URL_ + "/auth/v1/authorize?provider=" + encodeURIComponent(provider)
                    + "&redirect_to=" + encodeURIComponent(to);
    },

    /* Read a session out of the address bar and tidy it away again, so a
       token never sits in the URL to be copied, shared or logged.
       Returns "signin" | "recovery" | null, or throws what Google said. */
    consumeUrl(){
      const raw = location.hash.replace(/^#/, "");
      if(!raw || raw.indexOf("access_token=") === -1 && raw.indexOf("error=") === -1) return null;
      const q = new URLSearchParams(raw);

      const clean = () => history.replaceState(null, "", location.pathname + location.search);

      if(q.get("error") || q.get("error_description")){
        const msg = q.get("error_description") || q.get("error");
        clean();
        throw new Error(String(msg).replace(/\+/g, " "));
      }
      const access = q.get("access_token");
      if(!access) return null;

      write({
        access_token:  access,
        refresh_token: q.get("refresh_token") || "",
        expires_at:    nowSec() + (parseInt(q.get("expires_in"), 10) || 3600),
        user: null                       /* filled in by whoAmI() below */
      });
      clean();
      return q.get("type") === "recovery" ? "recovery" : "signin";
    },

    /* The hash carries a token but no user, so ask who it belongs to. */
    async whoAmI(){
      if(!session) return null;
      const u = await call("/auth/v1/user");
      if(u && u.id){
        session.user = shapeUser(u);
        write(session);
      }
      return api.user();
    },

    /* Which providers the project actually has switched on, so a Google
       button is only ever shown when pressing it will work.

       Asked once per page load and no longer than that. It used to be kept
       in sessionStorage, which was wrong twice over: a tab opened before
       Google was switched on went on hiding the button for as long as it
       stayed open, and one failed request cached the failure and hid the
       button for good. A failure is not remembered either — the next call
       asks again. It is one small request on a screen that is already
       waiting for the person to type. */
    async providers(){
      if(providerCache) return providerCache;
      try{
        const s = await call("/auth/v1/settings", {auth:false, timeout:6000});
        providerCache = (s && s.external) || {};
        return providerCache;
      }catch(e){
        return {};
      }
    },
    hasProvider: name => !!(providerCache && providerCache[name]),

    /* ── where a photo is read from ──
       CloudFront if there is one, Supabase Storage if not. The database
       stores a bare file name either way, never a URL, which is the whole
       reason moving the photos to another bucket is these three lines and
       not a migration of every row that mentions one. */
    photoUrl: p => CDN_
      ? CDN_ + "/" + String(p).split("/").map(encodeURIComponent).join("/")
      : URL_ + "/storage/v1/object/public/"
        + encodeURIComponent(BUCKET_) + "/"
        + String(p).split("/").map(encodeURIComponent).join("/"),

    /* ── putting a file in the bucket ──
       This has to live here, beside fresh(), and not be written out by hand
       at the call site. Doing it by hand is how it ended up sending a raw
       session.access_token with no refresh: every other request goes through
       authed(), which renews a token a minute before it expires, so an hour
       into a session everything kept working *except* the upload, which
       quietly started failing with 401.

       It also reads the error body. Storage answers with a real explanation
       — an expired JWT, or a row level security policy that refused the
       insert — and swallowing that in favour of "Upload refused (400)" left
       nothing to act on. */
    async upload(path, file, opts){
      await fresh();
      if(!session || !session.access_token){
        throw new Error("You are signed out. Sign in again and retry the upload.");
      }
      const o = opts || {};

      /* ── on S3, the photo goes through our own endpoint ──
         S3 has no idea who a Supabase user is, so the function on the other
         end asks the same is_admin() the storage policy used to ask before
         it writes anything. Sent as base64 in JSON: a photo is redrawn to
         about 120 KB before it gets here, so the third that base64 adds
         costs nothing worth engineering around. */
      if(CDN_){
        const type = file.type || o.contentType || "application/octet-stream";
        const data = await toBase64(file);
        let res, out = null;
        try{
          res = await fetch(apiUrl("upload-image"), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: "Bearer " + session.access_token
            },
            body: JSON.stringify({path: String(path), type: type, data: data})
          });
          const text = await res.text();
          if(text){ try{ out = JSON.parse(text); }catch(e){ out = null; } }
        }catch(err){
          throw new Error("Could not reach the upload server. Check your connection.");
        }
        if(!res.ok){
          const err = new Error((out && out.error) || ("Upload refused (" + res.status + ")"));
          err.status = res.status;
          throw err;
        }
        return out;
      }

      const url = URL_ + "/storage/v1/object/" + encodeURIComponent(BUCKET_) + "/"
                + String(path).split("/").map(encodeURIComponent).join("/");
      let res;
      try{
        res = await fetch(url, {
          method: "POST",
          headers: {
            apikey: KEY_,
            Authorization: "Bearer " + session.access_token,
            /* a file dragged from some apps arrives with no type at all */
            "Content-Type": file.type || o.contentType || "application/octet-stream",
            "x-upsert": o.upsert === false ? "false" : "true"
          },
          body: file
        });
      }catch(err){
        throw new Error("Could not reach the storage server. Check your connection.");
      }

      const text = await res.text();
      let data = null;
      if(text){ try{ data = JSON.parse(text); }catch(e){ data = text; } }

      if(!res.ok){
        const raw = (data && typeof data === "object"
          && (data.message || data.error || data.msg)) || String(data || "");
        /* the two that actually happen, said in words a shopkeeper can use */
        const friendly =
          /jwt|expired|invalid token/i.test(raw) || res.status === 401
            ? "That sign-in had expired. It has been renewed — press upload once more."
          : /row-level security|violates|not authorized|permission/i.test(raw) || res.status === 403
            ? "Storage refused the upload for this account. It needs the seller "
              + "policies from supabase/02-admin.sql — run that file again."
          : /exceeded|too large|size/i.test(raw)
            ? "That file is larger than the bucket allows."
          : (raw || ("Upload failed (" + res.status + ")"));
        const err = new Error(friendly);
        err.status = res.status;
        err.raw = raw;
        throw err;
      }
      return data;
    }
  };
  return api;
})();

/* Both pages carry the same three values, so the client configures itself the
   moment it loads and neither page can forget to. The session key is shared
   deliberately: sign in on the shop and the dashboard already knows you. */
SB.init({
  url:        ENV.SUPABASE_URL,
  key:        ENV.SUPABASE_ANON_KEY,
  bucket:     ENV.SUPABASE_BUCKET,
  cdn:        ENV.CDN_URL,
  sessionKey: "rag_session"
});
