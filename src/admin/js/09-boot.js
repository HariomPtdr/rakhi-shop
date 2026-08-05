/* ══════════════════════════════════════════════════════════
   BOOT AND ROUTING

   Six screens, one at a time, the name of the open one in the
   address bar so a reload comes back to it and the browser's
   back button does what it looks like it does.
   ══════════════════════════════════════════════════════════ */
async function render(){
  const fn = VIEWS[currentView];
  if(!fn) return;
  loading();
  try{
    await fn();
  }catch(err){
    const msg = String((err && err.message) || "");

    /* 401 is the only one that really means "signed out". A session can
       expire while the tab sits open overnight; say so and ask again. */
    if(err && err.status === 401){
      me = null;
      return showGate("That session has ended. Sign in again.");
    }

    /* 403 is different, and treating it as an expired session was wrong:
       the reports raise "not allowed" when the database does not consider
       this account the shop's owner. Bouncing to the sign-in box made that
       look like a login that silently failed, when in fact the login
       worked and the *permission* is missing. Say which. */
    if(err && (err.status === 403 || /not allowed/i.test(msg))){
      const who = (me && me.email) || (SB.user() && SB.user().email) || "that account";
      return failedPermission(who);
    }

    failed(err);
  }
  /* the range picker is drawn by whichever screen wants one */
  const r = $("#range");
  if(r) r.querySelectorAll("[data-days]").forEach(b => {
    b.onclick = () => { range = parseInt(b.dataset.days, 10); render(); };
  });
}

function go(name){
  if(!VIEWS[name]) name = "overview";
  currentView = name;
  $$("#nav button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === name)));
  if(location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  closePanel();
  render();
}

$("#nav").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if(b) go(b.dataset.view);
});
addEventListener("hashchange", () => {
  const name = location.hash.replace(/^#/, "");
  if(name && name !== currentView) go(name);
});

(async function start(){
  if(!SB.on){
    return showGate("This dashboard is not connected to a database yet. "
                  + "Set SUPABASE_URL and SUPABASE_ANON_KEY and build again — docs/DEPLOY.md.");
  }
  /* Back from Google, or from the reset email? Both arrive as a session in the
     address bar, which consumeUrl() reads and then wipes. */
  let landed = null;
  try{
    landed = SB.consumeUrl();
  }catch(err){
    return showGate(err.message);          /* cancelled at Google's consent screen */
  }
  if(landed){
    try{ await SB.whoAmI(); }catch(e){}
    if(!SB.signedIn()){
      SB.signOut();                        /* stale link — do not keep the shell */
      return showGate("That link has expired. Ask for a new one.");
    }
    if(landed === "recovery"){
      gateMode = "reset";
      return showGate("Choose a new password for this account.");
    }
  }

  if(!SB.signedIn()) return showGate();
  try{
    me = await checkAdmin();
  }catch(err){
    return showGate(err.status === 401 ? "" : err.message);
  }
  if(!me) return showNotOwner();
  showApp();
  const start = location.hash.replace(/^#/, "");
  go(VIEWS[start] ? start : "overview");
})();
