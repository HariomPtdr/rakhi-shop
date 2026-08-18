/* ══════════════════════════════════════════════════════════
   YOUR ACCOUNT

   Four screens in one sheet, because a phone has room for one
   thing at a time:

     signed out   sign in · create account · forgotten password
     Orders       every bill, where it has got to, its tracking id
     Wishlist     the hearts, with a way to buy them
     Details      the name and address the bill fills itself from

   None of it is compulsory. A guest can browse, fill a basket
   and send a bill on WhatsApp exactly as before — they simply
   do not get a copy afterwards.
   ══════════════════════════════════════════════════════════ */
let acctView = "in";      // "in" · "up" · "forgot" · "reset"
let acctNote = null;      // {text, good} shown at the top of the sheet
let acctNotifs = null;    // every note about an order, read by the Updates screen
let cancelling = null;    // the order id whose "are you sure" is open
let cancelWhy  = 0;       // which reason is picked, by index
let editingAddr = null;   // the order id whose address is being corrected

/* The picture Google gave us, or the first letter of their name. The
   picture is the one thing an account can show that says "this is really
   yours" at a glance, so it is worth the one <img>. */
function avatarHtml(cls){
  const u = SB.user() || {};
  const nm = (profile && profile.full_name) || u.name || u.email || "?";
  const letter = esc(nm.trim().charAt(0).toUpperCase() || "?");
  if(u.avatar){
    /* referrerpolicy: Google's CDN serves a 403 placeholder when a referrer
       it does not recognise is sent. onerror falls back to the letter. */
    return `<span class="${cls}"><img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer"
      onerror="this.remove()"><i>${letter}</i></span>`;
  }
  return `<span class="${cls}"><i>${letter}</i></span>`;
}

const acctOpenBtn = $("#acctOpen");

function paintAcctBtn(){
  if(!SB_ON) return;
  const el = $("#acctInitial"), svg = acctOpenBtn.querySelector("svg"), u = SB.user();
  /* a dot when something has happened they have not read */
  acctOpenBtn.classList.toggle("has-news", signedIn() && unreadCount > 0);
  if(signedIn() && u){
    const src = (profile && profile.full_name) || u.name || u.email || "?";
    el.textContent = src.trim().charAt(0).toUpperCase();
    /* their own picture, when Google gave us one */
    acctOpenBtn.style.backgroundImage = u.avatar ? `url("${u.avatar}")` : "";
    acctOpenBtn.classList.toggle("has-pic", !!u.avatar);
    el.hidden = false; svg.style.display = "none";
    acctOpenBtn.classList.add("in");
    acctOpenBtn.setAttribute("aria-label", "Your account — signed in");
  }else{
    acctOpenBtn.style.backgroundImage = "";
    acctOpenBtn.classList.remove("has-pic");
    el.hidden = true; svg.style.display = "";
    acctOpenBtn.classList.remove("in");
    acctOpenBtn.setAttribute("aria-label", "Sign in");
  }
  /* the menu says the same thing in words; keep the two in step from one place */
  paintNavAuth();
}

/* ── the foot of the menu sheet ──
   The account is reached from a 42px circle in the header, which is easy to
   miss. The menu is where someone goes when they are looking for something,
   so it says plainly whether they are signed in, and offers the one action
   that follows from that. */
function paintNavAuth(){
  const box = $("#navAuth");
  if(!box) return;
  if(!SB_ON){ box.innerHTML = ""; return; }

  const u = SB.user();
  if(signedIn() && u){
    const nm = (profile && profile.full_name) || u.name || u.email || "";
    /* The menu is where somebody looks when they are looking for something,
       so everything the account holds is named here rather than hidden
       behind one button called "Your orders". As chips rather than five more
       full-width rows: this menu already has the shop's five sections in it,
       and doubling its length to say the same things twice would be worse
       than the button it replaces. Each one opens the page that draws it —
       the same screens, not a second copy of them. */
    const where = [
      ["profile",   "Profile",   ""],
      ["orders",    "Orders",    ""],
      ["updates",   "Updates",   unreadCount ? String(unreadCount) : ""],
      ["basket",    "Basket",    nItems() ? String(nItems()) : ""],
      ["wishlist",  "Saved",     wish.length ? String(wish.length) : ""],
      ["addresses", "Addresses", ""]
    ];
    box.innerHTML = `
      <div class="nav-who">
        ${avatarHtml("nav-av")}
        <div><b>${esc(nm)}</b><span>${esc(u.email)}</span></div>
      </div>
      <div class="nav-tabs">
        ${where.map(([tab, label, n]) => `
          <button class="nav-tab${tab === "updates" && unreadCount ? " has-news" : ""}"
                  data-navtab="${tab}">${label}${n ? ` <i>${esc(n)}</i>` : ""}</button>`).join("")}
      </div>
      <div class="nav-auth-acts">
        <button class="btn btn-ghost btn-full" data-navact="out">Sign out</button>
      </div>`;
  }else{
    box.innerHTML = `
      <p class="nav-auth-lead">Sign in to add rakhis to your basket, save the
         ones you like, and keep a copy of every order.</p>
      <div class="nav-auth-acts">
        <button class="btn btn-dark" data-navact="in">Sign in</button>
        <button class="btn btn-ghost" data-navact="up">Create account</button>
      </div>`;
  }
}

$("#navAuth").addEventListener("click", e => {
  /* Each chip is a page now, so the menu names the page rather than a tab
     inside a sheet that no longer has tabs. The basket is the one exception:
     it is a drawer and was always a drawer. */
  const tab = e.target.closest("[data-navtab]");
  if(tab){
    const which = tab.dataset.navtab;
    closeNav();
    requestAnimationFrame(() => {
      if(which === "orders")    return openOrders();
      if(which === "wishlist")  return openWish();
      if(which === "addresses") return openAddresses();
      if(which === "basket")    return openCart();
      openProfile(which === "updates" ? "updates" : "home");
    });
    return;
  }
  const b = e.target.closest("[data-navact]");
  if(!b) return;
  const what = b.dataset.navact;
  if(what === "out"){ signOut(); paintNavAuth(); return; }
  closeNav();
  if(what === "in" || what === "up"){ acctView = what; }
  /* the sheet's history entry pops asynchronously — open after it has */
  requestAnimationFrame(() => openAcct(what === "account" ? "orders" : undefined));
});

function acctNoteHtml(){
  if(!acctNote) return "";
  return `<p class="ac-msg${acctNote.good ? " good" : ""}">${esc(acctNote.text)}</p>`;
}

/* the Google mark, drawn rather than fetched — the page still loads nothing */
const GOOGLE_G = `<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5.1-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z"/>
  <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.5 46 24 46z"/>
  <path fill="#FBBC05" d="M11.8 28.4c-.4-1.3-.7-2.8-.7-4.4s.3-3.1.7-4.4v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.5z"/>
  <path fill="#EA4335" d="M24 10.3c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 3.8 29.9 2 24 2 15.5 2 8.1 6.7 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9.5 12.2-9.5z"/></svg>`;

/* ── signed out: one form, four moods ── */
function acctSignedOut(){
  const up = acctView === "up", forgot = acctView === "forgot";

  /* Under the form, not over it. Email and password is what most people here
     already have, so it keeps the top of the sheet; Google is the shortcut
     offered afterwards. Only drawn when the project actually has the provider
     switched on, so it can never lead to Supabase's "unsupported provider"
     page. */
  const google = SB.hasProvider("google") ? `
    <div class="ac-or"><span>or</span></div>
    <button class="btn btn-google" id="acGoogle" type="button">
      ${GOOGLE_G}<span>Continue with Google</span></button>` : "";

  if(acctView === "reset"){
    return `
      <p class="ac-lead">Choose a new password. You are already signed in on this
         phone — this only sets the password you will use next time.</p>
      ${acctNoteHtml()}
      <form id="acctReset" novalidate>
        <div class="fg"><div class="fld"><label for="acNew">New password <i>*</i></label>
          <input type="password" id="acNew" autocomplete="new-password" placeholder="At least 8 characters"></div></div>
        <div class="ac-acts">
          <button class="btn btn-dark btn-full" id="acSetPass" type="submit">Save the new password</button>
        </div>
      </form>`;
  }

  return `
    <p class="ac-lead">Sign in and your basket, your saved rakhis and every order you
       place follow you to any phone.</p>
    <div class="ac-tabs" role="tablist">
      <button role="tab" data-view="in" aria-selected="${acctView === "in"}">Sign in</button>
      <button role="tab" data-view="up" aria-selected="${up}">Create account</button>
    </div>
    ${acctNoteHtml()}
    ${forgot ? `<p class="ac-lead" style="margin-bottom:14px">Type the email you signed up
       with and we will send a link that lets you set a new password.</p>` : ""}
    <form id="acctForm" novalidate>
      ${up ? `<div class="fg"><div class="fld"><label for="acName">Your name <i>*</i></label>
        <input type="text" id="acName" autocomplete="name" placeholder="Priyanka Sharma"></div></div>` : ""}
      <div class="fg"><div class="fld"><label for="acEmail">Email <i>*</i></label>
        <input type="email" id="acEmail" autocomplete="email" inputmode="email" placeholder="you@example.com"></div></div>
      ${forgot ? "" : `<div class="fg"><div class="fld"><label for="acPass">Password <i>*</i></label>
        <input type="password" id="acPass" autocomplete="${up ? "new-password" : "current-password"}"
               placeholder="${up ? "At least 8 characters" : "Your password"}"></div></div>`}
      <div class="ac-acts">
        <button class="btn btn-dark btn-full" id="acGo" type="submit">${
          forgot ? "Email me a link" : up ? "Create account" : "Sign in"}</button>
      </div>
      <p class="ac-fine ac-mid">${forgot
        ? `<a href="#" data-view="in">Back to signing in</a>`
        : up ? "" : `<a href="#" data-view="forgot">Forgotten your password?</a>`}</p>
    </form>
    ${forgot ? "" : google}
    <p class="ac-fine">We keep your name, phone and the addresses you save so you do not
       have to type them again, and nothing else. Orders are still confirmed on WhatsApp.</p>`;
}

/* ── correcting where it is going ──
   A wrong pincode is the commonest reason a parcel comes back, and it is
   always spotted a minute after the order goes in. Allowed until somebody
   hands it to a courier — the database enforces the same rule, and tells
   the seller what changed, so a label already written is never quietly
   wrong. */
function addrForm(o){
  /* ── the addresses they already keep ──
     The commonest correction is not a typo in the street: it is that the
     order went to the wrong one of the two or three addresses the account
     already holds. Retyping a saved address to fix that is the whole
     mistake happening a second time, so the saved ones are offered as
     buttons that fill the boxes below. Buttons, not a swap: the fields
     stay the thing that is submitted, so update_order_address and the rule
     it enforces do not have to know this exists. */
  const book = (addrBook || []).filter(a =>
    a.address !== o.address || a.pincode !== o.pincode);   /* not the one it is already going to */
  const pick = book.length ? `
    <div class="ac-usesaved">
      <span class="ac-c-lab">Send it to one you have saved</span>
      <div class="ac-saved-row">
        ${book.map(a => `<button type="button" data-usesaved="${esc(a.id)}">
          <b>${esc(a.label || "Saved")}</b>
          <span>${esc(a.full_name)} · ${esc(a.city)} ${esc(a.pincode)}</span>
        </button>`).join("")}
      </div>
    </div>` : "";

  return `<div class="ac-addrbox">
    <b>Where should ${esc(o.bill_no)} go?</b>
    <p>You can change this until it is handed to the courier. We are told, so
       nothing goes out to the old address.</p>
    ${pick}
    <div class="fg two">
      <div class="fld"><label for="eaName">Name</label>
        <input type="text" id="eaName" value="${esc(o.name || "")}" autocomplete="name"></div>
      <div class="fld"><label for="eaPhone">Phone</label>
        <input type="tel" id="eaPhone" inputmode="numeric" maxlength="10"
               value="${esc(o.phone || "")}" autocomplete="tel"></div>
    </div>
    <div class="fg"><div class="fld"><label for="eaAddr">Delivery address</label>
      <textarea id="eaAddr" autocomplete="street-address">${esc(o.address || "")}</textarea></div></div>
    <div class="fg two">
      <div class="fld"><label for="eaCity">City</label>
        <input type="text" id="eaCity" value="${esc(o.city || "")}"></div>
      <div class="fld"><label for="eaPin">Pincode</label>
        <input type="tel" id="eaPin" inputmode="numeric" maxlength="6" value="${esc(o.pincode || "")}"></div>
    </div>
    <div class="fg"><div class="fld"><label for="eaNote">Instructions for the courier</label>
      <textarea id="eaNote" placeholder="Second floor, ring the bell twice. Or: leave it with the shop below."
        >${esc(o.note || "")}</textarea></div></div>

    <div class="ac-pin">
      ${o.lat != null
        ? `<span class="ac-pin-on">A location is attached to this order.
             <a href="${esc(mapsLink(o.lat, o.lng))}" target="_blank" rel="noopener">Check it</a></span>`
        : `<span class="dim">No exact location on this order yet.</span>`}
      <div class="ac-pin-acts">
        <button type="button" data-orderpin="${esc(o.id)}">Use my location</button>
        <button type="button" data-pastepin="${esc(o.id)}">Paste a map link</button>
      </div>
    </div>

    <div class="ac-c-acts">
      <button class="btn btn-ghost" data-addrno="1">Leave it</button>
      <button class="btn btn-dark ac-a-go" data-addryes="${esc(o.id)}">Save the address</button>
    </div>
  </div>`;
}

/* Fills the form above from a saved address without submitting anything.
   They still press Save, and they can still correct a line of it first —
   picking is a shortcut through the typing, not a decision. */
function useSavedForOrder(addrId){
  const a = (addrBook || []).find(x => x.id === addrId);
  if(!a) return;
  const map = {eaName:"full_name", eaPhone:"phone", eaAddr:"address",
               eaCity:"city", eaPin:"pincode", eaNote:"note"};
  for(const id in map){
    const el = $("#" + id);
    if(el) el.value = a[map[id]] || "";
  }
  toast("Filled in from " + (a.label || "your saved address"));
}

async function saveOrderAddress(id){
  const v = i => ($("#" + i) ? $("#" + i).value.trim() : "");
  const btn = $(".ac-a-go");
  if(!/^[6-9][0-9]{9}$/.test(v("eaPhone"))) return note("That phone number does not look right.");
  if(!/^[0-9]{6}$/.test(v("eaPin")))        return note("A pincode is six digits.");
  if(!v("eaName") || !v("eaAddr") || !v("eaCity")) return note("Fill the name, address and city.");

  if(btn){ btn.disabled = true; btn.textContent = "Saving…"; }
  try{
    await SB.rpc("update_order_address", {
      p_order: id, p_name: v("eaName"), p_phone: v("eaPhone"),
      p_address: v("eaAddr"), p_city: v("eaCity"), p_pincode: v("eaPin"),
      p_note: v("eaNote")
    });
    editingAddr = null;
    toast("Address updated — we have been told");
    await orderChanged();
  }catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Save the address"; }
    note(/function|404|schema cache/i.test(err.message || "")
      ? "This needs supabase/14-address.sql to be run first."
      : (err.message || "Could not save that just now."));
  }
}

/* ── calling off an order ──
   Asked, not just done. A cancel is irreversible from the customer's side
   and the seller may already be making it, so it takes a deliberate second
   tap — and the reason goes to the seller, who can then do something about
   whatever caused it. */
const CANCEL_REASONS = [
  "I ordered it by mistake",
  "I want a different design or colour",
  "It will not arrive in time",
  "I found a problem with my address",
  "Something else"
];

function cancelForm(o){
  return `<div class="ac-cancelbox">
    <b>Cancel ${esc(o.bill_no)}?</b>
    <p>It is still ${esc((STATUS[o.status] || {}).label || o.status).toLowerCase()}, so it can
       be called off. Once it is with the courier it cannot. This cannot be undone —
       you would need to order again.</p>
    <span class="ac-c-lab">Why, so we can do better</span>
    <!-- Buttons, not a <select>. A native dropdown on a phone opens as a
         slab of system chrome in the middle of a page that has been made to
         look like nothing else on the phone, and five short reasons do not
         need to be hidden behind a tap in the first place. -->
    <div class="ac-why" role="radiogroup" aria-label="Why, so we can do better">
      ${CANCEL_REASONS.map((r, i) => `
        <button type="button" role="radio" data-why="${esc(r)}"
                aria-checked="${i === cancelWhy}" class="${i === cancelWhy ? "on" : ""}">${esc(r)}</button>`).join("")}
    </div>
    <div class="ac-c-acts">
      <button class="btn btn-ghost" data-cancelno="1">Keep the order</button>
      <button class="btn btn-dark ac-c-go" data-cancelyes="${esc(o.id)}">Yes, cancel it</button>
    </div>
  </div>`;
}

async function doCancel(id){
  const why = CANCEL_REASONS[cancelWhy] || "";
  const btn = $(".ac-c-go");
  if(btn){ btn.disabled = true; btn.textContent = "Cancelling…"; }
  try{
    await SB.rpc("cancel_order", {p_order: id, p_reason: why});
    cancelling = null;
    acctNotifs = null;                       /* re-read, so the status is the server's */
    toast("Order cancelled");
    await orderChanged();
  }catch(err){
    cancelling = null;
    if(orderPageOpen()) paintOrderPage(); else paintAcct();
    toast(err.message || "Could not cancel it just now.");
  }
}

/* ── the sheet, now that it holds one thing ──
   Everything an account holds — orders, updates, addresses, the details,
   the wishlist — is a page of its own. What is left in this sheet is the
   one screen that cannot be a page, because it is what somebody sees
   before there is an account to make a page out of: the sign-in.

   Signed in, there is nothing here to draw. Anything that still asks for
   the sheet is asking for the account, and the account is the profile
   page, so it is sent there. */
function paintAcct(){
  const body = $("#acctBody");
  if(!body) return;
  /* "reset" is the one screen a signed-in person still sees here: they
     arrived on a password link, which signs them in on the way. */
  if(signedIn() && acctView !== "reset"){ body.innerHTML = ""; return; }
  body.innerHTML = acctSignedOut();
}

function openAcct(where){
  if(!SB_ON) return;
  if(signedIn()){
    /* the sheet may be the thing on screen — it closes before the page
       under it opens, and the pop that closing causes is waited for, or
       the page's own hash is thrown away by it */
    const go = () => where === "orders" ? openOrders() : openProfile(where === "updates" ? "updates" : "home");
    if(isOn("#acctModal") && sheetHist){
      addEventListener("popstate", () => go(), {once: true});
      closeAcct();
    }else{
      closeAcct();
      go();
    }
    return;
  }
  acctNote = null;
  paintAcct();
  openSheet("#acctModal");
}
function closeAcct(fromBack){
  if(!isOn("#acctModal")) return;
  $("#acctModal").classList.remove("on");
  afterClose(fromBack);
  if(location.hash === "#account"){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/* ── the sheet's own clicks ──
   Four of them, because there are four things on it: switch between signing
   in and creating an account, ask for a password link, come back from one,
   and Google. Everything the sheet used to catch — a wishlist row, an order,
   a cancel, a stepper — is caught by the page that now draws it. */
$("#acctBody").addEventListener("click", e => {
  const view = e.target.closest("[data-view]");
  if(view){ e.preventDefault(); acctView = view.dataset.view; acctNote = null; paintAcct(); return; }

  if(e.target.closest("#acGoogle")){
    /* No fragment on the way out: Supabase puts the session in the fragment
       when it sends the browser back, and anything already there is lost.
       landFromLink() opens the account again on arrival. */
    SB.oauth("google", location.origin + location.pathname);
  }
});
$("#acctBody").addEventListener("submit", e => {
  e.preventDefault();
  if(e.target.id === "acctForm")  return submitAuth();
  if(e.target.id === "acctReset") return submitNewPassword();
});

function busy(sel, on, label){
  const b = $(sel); if(!b) return;
  b.disabled = on;
  b.style.opacity = on ? ".6" : "";
  if(label) b.textContent = label;
}
function note(text, good){
  acctNote = {text, good: !!good};
  paintAcct();
}

async function submitAuth(){
  const up     = acctView === "up";
  const forgot = acctView === "forgot";
  const email  = ($("#acEmail").value || "").trim();
  const pass   = forgot ? "" : ($("#acPass").value || "");
  const name   = up ? ($("#acName").value || "").trim() : "";

  if(up && name.length < 2)                        return note("Enter your name.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return note("Enter a valid email address.");
  if(!forgot && pass.length < 8)                   return note("Use a password of at least 8 characters.");

  busy("#acGo", true, forgot ? "Sending…" : up ? "Creating…" : "Signing in…");
  try{
    if(forgot){
      /* No fragment — the session comes back in one, and landFromLink()
         opens the sheet on "choose a new password" by itself. */
      await SB.resetPassword(email, location.origin + location.pathname);
      acctView = "in";
      return note("If that email has an account, a link is on its way to it. "
                + "Open it on this phone and you can set a new password.", true);
    }
    if(up){
      const s = await SB.signUp(email, pass, name);
      if(s){
        await afterSignIn();
        closeAcct();
        requestAnimationFrame(() => openProfile("info"));
        toast("Welcome");
        return;
      }
      /* email confirmation is on in the project: nothing to sign in with yet */
      acctView = "in";
      return note("Account created. Open the link we emailed you, then sign in.", true);
    }
    await SB.signIn(email, pass);
    await afterSignIn();
    acctNote = null;
    forgetOrders();
    /* Closed, and nothing opened over it. Most sign-ins here happen halfway
       through a checkout, and a profile page thrown up in front of somebody
       who was about to pay is a page they have to find their way out of. */
    closeAcct();
    toast("Signed in");
  }catch(err){
    const m = String(err.message || "");
    note(/invalid login/i.test(m)                  ? "That email and password do not match."
       : /already regist|already exists/i.test(m)  ? "That email already has an account — sign in instead."
       : /email not confirmed/i.test(m)            ? "Open the confirmation link we emailed you first."
       : m || "Something went wrong.");
    busy("#acGo", false, forgot ? "Email me a link" : up ? "Create account" : "Sign in");
  }
}

/* the second half of "forgotten password": they are back from the email,
   already signed in by the link, and now choose what to use next time */
async function submitNewPassword(){
  const pass = $("#acNew").value || "";
  if(pass.length < 8) return note("Use a password of at least 8 characters.");
  busy("#acSetPass", true, "Saving…");
  try{
    await SB.updatePassword(pass);
    await afterSignIn();
    acctView = "in";
    forgetOrders();
    closeAcct();
    toast("Password changed");
  }catch(err){
    note(err.message || "Could not change it just now.");
  }
}

/* ── coming back from Google, or from the reset email ──
   Both arrive the same way: a session sitting in the address bar. It is read
   and wiped before anything is drawn, so a token is never left in a URL to be
   shared or copied by accident. */
async function landFromLink(){
  let kind = null;
  try{
    kind = SB.consumeUrl();
  }catch(err){
    /* Google says no — usually the account was cancelled at the consent screen */
    openAcct(); note(err.message);
    return false;
  }
  if(!kind) return false;

  try{
    await SB.whoAmI();
  }catch(err){}
  if(!signedIn()){
    /* the token in the link was stale or already used. Throw it away rather
       than leaving a half-session in storage for the next visit to trip on. */
    SB.signOut();
    openAcct(); note("That link has expired. Ask for a new one.");
    return false;
  }

  await afterSignIn();
  forgetOrders();

  if(kind === "recovery"){
    /* They are signed in — openAcct() would send them to the profile, and
       the box for choosing a new password is in the sheet. So the sheet is
       opened directly, which is the one time anything does that. */
    acctView = "reset";
    paintAcct();
    openSheet("#acctModal");
  }else{
    openAcct("orders");
    toast("Signed in");
  }
  return true;
}

/* ── wiring ── */
if(SB_ON){
  acctOpenBtn.hidden = false;
  acctOpenBtn.onclick = () => openAcct();
  $("#acctClose").onclick = () => closeAcct();
  $("#acctModal").addEventListener("click", e => { if(e.target.id === "acctModal") closeAcct(); });

  /* #account is still a real address — every email and bookmark that ever
     linked to it keeps working. Signed in it now means the profile page, and
     openAcct() is what knows that, so the route asks it rather than deciding
     for itself.

     A link from an email normally loads the page fresh, but if this tab is
     already open on it the fragment changes underneath us instead — so watch
     for that too rather than sitting there doing nothing. */
  const acctRoute = () => {
    if(location.hash.indexOf("access_token=") !== -1){ landFromLink(); return; }
    if(location.hash === "#account" && !isOn("#acctModal") && !profileOpen()) openAcct();
  };
  addEventListener("hashchange", acctRoute);

  /* ── why this waits for the document ──
     Landing from a Google link or a password link now ends on a page —
     the orders page, the profile — and those are declared in files that
     load after this one. This file is script 19 of 31; its boot used to
     run the moment it was parsed, which is before scripts 20 to 31 exist,
     and reaching openOrders() from there is a ReferenceError rather than
     a sign-in. DOMContentLoaded is after the last script tag, and the
     scripts sit at the end of the body, so this is the first moment the
     whole shop is defined. */
  addEventListener("DOMContentLoaded", async () => {
    const landed = await landFromLink();
    /* which providers are on decides whether the Google button is drawn, so
       ask before the sheet can be opened, and redraw if it already is */
    SB.providers().then(() => { if(isOn("#acctModal")) paintAcct(); });
    if(!landed) acctRoute();
  });
}

paintGrid();
paintCart();
paintHearts();
syncRoute();          /* honour #p/<id> on a cold load */
