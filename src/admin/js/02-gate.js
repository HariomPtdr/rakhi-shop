/* ══════════════════════════════════════════════════════════
   THE GATE

   Two questions, in this order: is anyone signed in, and does
   the database consider them the seller.

   The second is asked of Postgres — is_admin() — not of
   anything in this page. Hiding the screens in the browser is
   only so the wrong person is not shown an empty dashboard; it
   is not what stops them. Every request behind every screen is
   refused by row level security regardless of what this file
   decides to display.
   ══════════════════════════════════════════════════════════ */
let me = null;                 // {id, email, name, role}
let gateMode = "in";           // "in" · "forgot" · "reset"

function gateMsg(text, good){
  $("#gateMsg").innerHTML = text ? `<p class="msg${good ? " good" : ""}">${esc(text)}</p>` : "";
}

const GOOGLE_G = `<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5.1-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z"/>
  <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.5 46 24 46z"/>
  <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.8-.7-4.4s.3-3.1.7-4.4v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.5z"/>
  <path fill="#EA4335" d="M24 10.3c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.8 29.9 2 24 2 15.5 2 8.1 6.7 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9.5 12.2-9.5z"/></svg>`;

/* The gate is one form that changes its mind three times: sign in, ask for a
   reset link, and — after coming back from that email — set a new password. */
function paintGate(){
  const forgot = gateMode === "forgot", reset = gateMode === "reset";

  /* below the form, matching the shop: the password is the way in most people
     here already have, and Google is the shortcut underneath it */
  $("#gateGoogle").innerHTML = (!forgot && !reset && SB.hasProvider("google"))
    ? `<div class="or"><span>or</span></div>
       <button class="btn btn-google" id="gGoogle" type="button">
         ${GOOGLE_G}<span>Continue with Google</span></button>` : "";

  const passRow = $("#gatePassRow"), email = $("#gEmail");
  if(reset){
    email.closest("div").hidden = true;
    passRow.hidden = false;
    passRow.querySelector("label").textContent = "New password";
    $("#gPass").placeholder = "At least 8 characters";
    $("#gPass").autocomplete = "new-password";
    $("#gGo").textContent = "Save the new password";
  }else{
    email.closest("div").hidden = false;
    passRow.hidden = forgot;
    $("#gGo").textContent = forgot ? "Email me a link" : "Sign in";
  }
  /* always offered, even mid-reset — there has to be a way to back out */
  $("#gForgot").textContent = (forgot || reset) ? "Back to signing in" : "Forgotten your password?";

  const g = $("#gGoogle");
  if(g) g.onclick = () => SB.oauth("google", location.origin + location.pathname);
}

function showGate(msg){
  $("#app").hidden = true;
  $("#gate").hidden = false;
  if(msg) gateMsg(msg);
  paintGate();
  /* asked once; the Google button appears if the project has it switched on */
  SB.providers().then(paintGate);
  const email = $("#gEmail");
  if(email && !email.value && matchMedia("(min-width:720px)").matches) email.focus();
}

function showApp(){
  $("#gate").hidden = true;
  $("#app").hidden = false;
  const u = SB.user();
  $("#whoName").textContent = (me && (me.name || me.email)) || (u && u.email) || "";
}

/* Signed in, and the account is simply not the owner. This used to sign them
   straight back out and return them to the sign-in box, which read as "your
   password was wrong" — it never was. The session is left alone and the
   reason is put on the screen, with the one query that fixes it. */
function showNotOwner(){
  const u = SB.user();
  showApp();
  $$("#nav button").forEach(b => { b.disabled = true; b.style.opacity = ".4"; });
  failedPermission((u && u.email) || "that account");
}

/* Is this account the seller? The answer comes from the database. */
async function checkAdmin(){
  const u = SB.user();
  if(!u) return null;
  const rows = await SB.rest("profiles?select=id,full_name,email,role&id=eq."
                           + encodeURIComponent(u.id) + "&limit=1");
  const p = (Array.isArray(rows) && rows[0]) || null;
  if(!p || p.role !== "admin") return null;
  return {id:u.id, email:p.email || u.email, name:p.full_name || u.name || "", role:p.role};
}

$("#gForgot").addEventListener("click", e => {
  e.preventDefault();
  gateMode = gateMode === "in" ? "forgot" : "in";
  gateMsg("");
  paintGate();
});

$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = ($("#gEmail").value || "").trim();
  const pass  = $("#gPass").value || "";
  const btn   = $("#gGo");

  /* back from the reset email, already signed in by the link */
  if(gateMode === "reset"){
    if(pass.length < 8) return gateMsg("Use a password of at least 8 characters.");
    btn.disabled = true; btn.textContent = "Saving…";
    try{
      await SB.updatePassword(pass);
      gateMode = "in";
      me = await checkAdmin();
      if(!me) throw new Error("Password changed, but this account is not the shop's owner.");
      showApp();
      await render();
      return;
    }catch(err){
      gateMsg(err.message);
      paintGate();
      return;
    }finally{ btn.disabled = false; }
  }

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return gateMsg("Enter a valid email address.");

  if(gateMode === "forgot"){
    btn.disabled = true; btn.textContent = "Sending…";
    try{
      await SB.resetPassword(email, location.origin + location.pathname);
      gateMode = "in";
      gateMsg("If that email has an account, a link is on its way to it.", true);
    }catch(err){ gateMsg(err.message); }
    btn.disabled = false;
    return paintGate();
  }

  if(!pass) return gateMsg("Enter your password.");

  btn.disabled = true; btn.textContent = "Signing in…";
  gateMsg("");
  try{
    await SB.signIn(email, pass);
    me = await checkAdmin();
    if(!me) return showNotOwner();
    showApp();
    await render();
  }catch(err){
    const m = String(err.message || "");
    gateMsg(/invalid login/i.test(m) ? "That email and password do not match." : m);
  }finally{
    btn.disabled = false; btn.textContent = "Sign in";
  }
});

$("#signOut").onclick = () => {
  SB.signOut();
  me = null;
  location.reload();
};
