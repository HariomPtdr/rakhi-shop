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
const SB = (function(){
  let URL_ = "", KEY_ = "", BUCKET_ = "product-images", SES_KEY = "rag_session";
  let session = null, refreshing = null, providerCache = null;
  const listeners = [];
  const nowSec = () => Math.floor(Date.now() / 1000);

  function init(o){
    URL_    = String((o && o.url)    || "").replace(/\/+$/, "");
    KEY_    = String((o && o.key)    || "");
    BUCKET_ = String((o && o.bucket) || "product-images");
    if(o && o.sessionKey) SES_KEY = o.sessionKey;
    api.on = !!(URL_ && KEY_);
    session = read();
    return api.on;
  }

  /* ── the session, kept beside the basket in localStorage ── */
  function read(){
    try{
      const s = JSON.parse(localStorage.getItem(SES_KEY) || "null");
      if(s && s.access_token && s.refresh_token && s.user && s.user.id) return s;
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
  function shape(j){
    if(!j || !j.access_token) return null;
    const u = j.user || {};
    return {
      access_token:  j.access_token,
      refresh_token: j.refresh_token || "",
      expires_at:    nowSec() + (parseInt(j.expires_in, 10) || 3600),
      user: u.id ? {id:u.id, email:u.email || "", name:(u.user_metadata || {}).full_name || ""} : null
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
        session.user = {id:u.id, email:u.email || "",
                        name:(u.user_metadata || {}).full_name || (u.user_metadata || {}).name || ""};
        write(session);
      }
      return api.user();
    },

    /* Which providers the project actually has switched on. Asked once and
       remembered for the tab, so a Google button is only ever shown when
       pressing it will work. */
    async providers(){
      if(providerCache) return providerCache;
      try{
        const cached = sessionStorage.getItem("rag_providers");
        if(cached) return (providerCache = JSON.parse(cached));
      }catch(e){}
      try{
        const s = await call("/auth/v1/settings", {auth:false, timeout:6000});
        providerCache = (s && s.external) || {};
      }catch(e){
        providerCache = {};
      }
      try{ sessionStorage.setItem("rag_providers", JSON.stringify(providerCache)); }catch(e){}
      return providerCache;
    },
    hasProvider: name => !!(providerCache && providerCache[name]),

    photoUrl: p => URL_ + "/storage/v1/object/public/"
      + encodeURIComponent(BUCKET_) + "/"
      + String(p).split("/").map(encodeURIComponent).join("/")
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
  sessionKey: "rag_session"
});
