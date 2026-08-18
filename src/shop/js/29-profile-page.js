/* ══════════════════════════════════════════════════════════
   YOUR PROFILE, AS A PAGE

   The account was a bottom sheet with five tabs in it. A sheet
   is the right shape for one decision — pick an address, confirm
   a cancel — and the wrong shape for a place you go to look
   things up, which is what an account is. Five tabs in a box
   two-thirds of a phone tall meant every list inside it scrolled
   in a window, under a header that never moved, above the shop
   still sitting there dimmed.

   So it is a page now, wearing the bar the collection, the
   wishlist and an order already wear: who you are at the top,
   the three things people actually come for as tiles, and then
   everything the account holds as a plain list of rows. Each row
   goes somewhere real — Orders and Saved Addresses to pages of
   their own, Updates, Profile Information and Help to views of
   this one, because each of those is a short form and does not
   need a shell of its own.

   The sheet is not gone: it is what a signed-out visitor gets,
   and it now holds nothing but the sign-in. One screen, one job.
   ══════════════════════════════════════════════════════════ */
const pfEl = $("#pf");
const profileOpen = () => pfEl && pfEl.classList.contains("on");

/* "home" · "updates" · "info" · "help" — the sub-screens that are short
   enough to live under this page's bar rather than claim one of their own */
let pfView = "home";
let pfNote = null;         // {text, good} — the same one-line reply the sheet gave

const PF_TITLES = {home:"Profile", updates:"Updates", info:"Profile Information", help:"Help & Support"};

/* ══════════════════════════════════════════════════════════
   THE PARTS IT IS DRAWN FROM
   ══════════════════════════════════════════════════════════ */

/* Line icons at one weight, drawn rather than fetched, so the row list reads
   as one set. Each is 24×24 on the same grid as every other icon on the
   site. */
const PF_ICONS = {
  bag: `<path d="M5.5 8h13l-1 12.5h-11Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/>`,
  heart: `<path d="M12 20.4S3.8 15.3 3.8 9.7A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.2 2.4c0 5.6-8.2 10.7-8.2 10.7Z"/>`,
  help: `<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><path d="M4.5 13.2h1.6a1 1 0 0 1 1 1v2.6a1 1 0 0 1-1 1H4.5Z"/><path d="M19.5 13.2h-1.6a1 1 0 0 0-1 1v2.6a1 1 0 0 0 1 1h1.6Z"/><path d="M17.9 18.8a3.4 3.4 0 0 1-3.4 2.4h-1.2"/>`,
  pin: `<path d="M12 21.5s6.6-6 6.6-11a6.6 6.6 0 1 0-13.2 0c0 5 6.6 11 6.6 11Z"/><circle cx="12" cy="10.4" r="2.5"/>`,
  user: `<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="9.6" r="3"/><path d="M6.3 19.3a6.2 6.2 0 0 1 11.4 0"/>`,
  bell: `<path d="M18 16.4V11a6 6 0 1 0-12 0v5.4L4.6 18.6h14.8Z"/><path d="M10 21.2a2.3 2.3 0 0 0 4 0"/>`,
  shield: `<path d="M12 21.4c4.4-1.8 6.6-5 6.6-9.6V5.6L12 3 5.4 5.6v6.2c0 4.6 2.2 7.8 6.6 9.6Z"/><path d="m9.2 12.2 2 2 3.6-4"/>`
};
const pfIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PF_ICONS[k] || ""}</svg>`;

const PF_CHEV = `<svg class="pf-chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

function pfNoteHtml(){
  if(!pfNote) return "";
  return `<p class="ac-msg${pfNote.good ? " good" : ""}">${esc(pfNote.text)}</p>`;
}
function pfSay(text, good){
  pfNote = text ? {text, good: !!good} : null;
  paintProfile();
}

/* ── who you are ──
   The name, then the phone under it. The phone rather than the email on
   purpose: it is what the courier rings and what the shop messages on, so
   it is the line somebody wants to check is right — and the one worth
   asking for when it is missing. */
function pfHeadCard(){
  const u = SB.user() || {};
  const p = profile || {};
  const nm = p.full_name || u.name || (u.email || "").split("@")[0] || "Your account";
  const sub = p.phone ? p.phone : (u.email || "");

  return `<div class="pf-who">
    ${avatarHtml("pf-av")}
    <div class="pf-who-t">
      <b>${esc(nm)}</b>
      <span>${esc(sub)}</span>
      ${!p.phone ? `<button class="pf-add-ph" data-pfview="info" type="button">
        Add your phone number</button>` : ""}
    </div>
  </div>`;
}

/* ── the three things people come here for ──
   Orders, help, wishlist. They are all in the list underneath as well, and
   that is deliberate: the tiles are for the thumb that already knows what it
   wants, the list is for the eye that is reading what is here. */
function pfTiles(){
  const tiles = [
    ["orders",   "bag",   "Your Orders",    ""],
    ["help",     "help",  "Help & Support", ""],
    ["wishlist", "heart", "Your Wishlist",  wish.length ? String(wish.length) : ""]
  ];
  return `<div class="pf-tiles">${tiles.map(([go, ic, label, n]) => `
    <button class="pf-tile" data-pfgo="${go}" type="button">
      <span class="pf-tile-i">${pfIcon(ic)}${n ? `<i>${esc(n)}</i>` : ""}</span>
      <span class="pf-tile-l">${label}</span>
    </button>`).join("")}</div>`;
}

/* ── everything the account holds ──
   One row each, with what is behind it said in the second line where a
   number answers the question before the tap does: "1 Address" is the whole
   reason somebody was going to open that screen. */
function pfRows(){
  const p = profile || {};
  const nAddr = (addrBook || []).length;
  const nOrd  = pfOrderCount();

  const rows = [
    ["orders", "bag", "Your Orders",
      nOrd == null ? "" : nOrd ? `${nOrd} ${plural(nOrd, "order")}` : "Nothing yet", ""],
    ["wishlist", "heart", "Your Wishlist",
      wish.length ? `${wish.length} ${plural(wish.length, "rakhi")} saved` : "Nothing saved yet", ""],
    ["updates", "bell", "Updates",
      "Where your orders have got to", unreadCount ? String(unreadCount) : ""],
    ["help", "help", "Help & Support", "We answer on WhatsApp", ""],
    ["addresses", "pin", "Saved Addresses",
      nAddr ? `${nAddr} ${plural(nAddr, "Address", "Addresses")}` : "None saved yet", ""],
    ["info", "user", "Profile Information",
      p.full_name ? "Your name, phone and password" : "Add your name and phone", ""]
  ];

  /* the seller's own way in, and only ever the seller's: role comes off the
     profile row, which nothing on this page can write */
  if(p.role === "admin"){
    rows.push(["admin", "shield", "Seller Dashboard", "Orders, stock and settings", ""]);
  }

  return `<div class="pf-list">${rows.map(([go, ic, label, sub, badge]) => `
    <button class="pf-row" data-pfgo="${go}" type="button">
      <span class="pf-row-i">${pfIcon(ic)}</span>
      <span class="pf-row-t"><b>${label}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</span>
      ${badge ? `<i class="pf-row-n">${esc(badge)}</i>` : ""}
      ${PF_CHEV}
    </button>`).join("")}</div>`;
}

/* The order count is worth showing and not worth a round trip of its own:
   whatever the orders page last loaded is used, and the line is simply left
   off until something has. */
function pfOrderCount(){
  if(typeof odOrders === "undefined" || !odOrders) return null;
  return odOrders.filter(o => o.status !== "cancelled").length;
}

/* ══════════════════════════════════════════════════════════
   THE FOUR SCREENS
   ══════════════════════════════════════════════════════════ */
function pfHome(){
  return pfHeadCard() + pfNoteHtml() + pfTiles() + pfRows() + `
    <div class="pf-out">
      <button class="btn btn-ghost btn-full" id="pfOut" type="button">Sign out</button>
    </div>
    <p class="pf-fine">We keep your name, phone and addresses so you do not have to type
      them again, and nothing else.</p>`;
}

/* ── updates ──
   Every note the shop has written about an order, newest first, each one a
   way into the order it is about. Opening this screen is reading them. */
function pfUpdates(){
  if(!acctNotifs){
    return `<p class="ac-empty">Loading…</p>`;
  }
  if(!acctNotifs.length){
    return `<p class="ac-empty">Nothing yet. When an order is confirmed, sent or
      delivered it is written here — and the tracking id comes with it. Anything
      Ray Art Gallery needs to tell you about an order lands here too.</p>`;
  }
  return `<div class="pf-pane">${acctNotifs.map(n => `
    <div class="ac-notif${n.read_at ? "" : " unread"}${n.order_id ? " tappable" : ""}"
         ${n.order_id ? `data-oview="${esc(n.order_id)}"` : ""}>
      <div class="ac-n-top">
        <b>${esc(n.title)}</b>
        <span>${esc(agoText(n.created_at))}</span>
      </div>
      ${n.body ? `<p>${esc(n.body)}</p>` : ""}
      ${n.order_id ? `<span class="ac-n-go">See the order →</span>` : ""}
    </div>`).join("")}</div>`;
}

/* ── profile information ──
   The name and the phone, which is all this screen is for now that the
   address has an address book of its own. The password is under it because
   it is the other thing about the account rather than about an order, and
   signing out is at the bottom because it is the last thing anybody does. */
function pfInfo(){
  const u = SB.user() || {};
  const p = profile || {};
  const nAddr = (addrBook || []).length;

  return pfNoteHtml() + `
    <form id="pfForm" class="pf-pane" novalidate>
      <div class="pf-k">About you</div>
      <div class="fg"><div class="fld"><label for="pfName">Full name</label>
        <input type="text" id="pfName" autocomplete="name" placeholder="Priyanka Sharma"
               value="${esc(p.full_name || u.name || "")}"></div></div>
      <div class="fg"><div class="fld"><label for="pfPhone">Phone</label>
        <input type="tel" id="pfPhone" autocomplete="tel" inputmode="numeric" maxlength="10"
               placeholder="10 digits" value="${esc(p.phone || "")}"></div></div>
      <p class="pf-fine">This is what the courier rings and what we message you on.</p>
      <div class="ac-acts">
        <button class="btn btn-dark btn-full" id="pfSave" type="submit">Save</button>
      </div>
    </form>

    <div class="pf-pane">
      <div class="pf-k">Email</div>
      <div class="pf-flat">
        <b>${esc(u.email || "—")}</b>
        <span>Your orders and any password link are sent here. It cannot be changed
          from this screen — message us and we will move the account.</span>
      </div>
    </div>

    <div class="pf-pane">
      <div class="pf-k">Where your rakhis go</div>
      <button class="pf-row" data-pfgo="addresses" type="button">
        <span class="pf-row-i">${pfIcon("pin")}</span>
        <span class="pf-row-t"><b>Saved Addresses</b><span>${
          nAddr ? `${nAddr} ${plural(nAddr, "Address", "Addresses")}` : "None saved yet"}</span></span>
        ${PF_CHEV}
      </button>
    </div>

    <form id="pfPass" class="pf-pane" novalidate>
      <div class="pf-k">Password</div>
      <div class="fg two">
        <div class="fld"><label for="pfNew">New password</label>
          <input type="password" id="pfNew" autocomplete="new-password" placeholder="At least 8 characters"></div>
        <div class="fld"><label for="pfNew2">Again</label>
          <input type="password" id="pfNew2" autocomplete="new-password" placeholder="The same one"></div>
      </div>
      <p class="pf-fine">${u.avatar
        ? "You signed in with Google. Setting a password here lets you sign in either way."
        : "Changing it signs you in with the new one next time. This phone stays signed in."}</p>
      <div class="ac-acts">
        <button class="btn btn-ghost btn-full" id="pfPassSave" type="submit">Change password</button>
      </div>
    </form>

    <div class="pf-out">
      <button class="btn btn-ghost btn-full" id="pfOut" type="button">Sign out</button>
    </div>`;
}

/* ── help ──
   Three ways to reach a person and one link to the answers most people
   wanted. WhatsApp first because that is where this shop actually replies. */
function pfHelp(){
  const asks = [
    ["Where is my order?",        "Hello Ray Art Gallery, where has my order got to?"],
    ["Change my delivery address","Hello Ray Art Gallery, I need to change the address on my order."],
    ["Cancel or change an order", "Hello Ray Art Gallery, I need to change an order."],
    ["Something arrived damaged", "Hello Ray Art Gallery, something in my order arrived damaged."],
    ["Something else",            "Hello Ray Art Gallery, I need some help."]
  ];
  return `<div class="pf-pane">
    <div class="pf-help-h">
      <span>${pfIcon("help")}</span>
      <div>
        <b>We answer on WhatsApp</b>
        <p>Usually within the hour, by a person, not a robot. Tell us the bill
           number and we can see everything about the order.</p>
      </div>
    </div>

    <div class="pf-k">What is it about?</div>
    <div class="pf-list pf-asks">
      ${asks.map(([label, msg]) => `
        <a class="pf-row" href="${esc(wa(msg))}" target="_blank" rel="noopener">
          <span class="pf-row-t"><b>${esc(label)}</b></span>
          ${PF_CHEV}
        </a>`).join("")}
    </div>

    <div class="ac-acts two" style="margin-top:16px">
      <a class="btn btn-dark" href="${esc(wa("Hello Ray Art Gallery, I need some help."))}"
         target="_blank" rel="noopener">Chat on WhatsApp</a>
      ${SHOP.email ? `<a class="btn btn-ghost" href="mailto:${esc(SHOP.email)}">Email us</a>` : ""}
    </div>

    <p class="pf-fine">Looking for delivery times, what a rakhi is made of, or how a
      return works? Those are answered on the shop's
      <a class="pf-link" href="#faq" data-pfclose="1">questions page</a>.</p>
  </div>`;
}

function paintProfile(){
  const box = $("#pfIn");
  if(!box) return;

  const title = $("#pfTitle");
  if(title) title.textContent = PF_TITLES[pfView] || "Profile";

  if(!signedIn()){
    box.innerHTML = `<p class="ac-empty">Sign in to see your account.</p>`;
    return;
  }
  box.innerHTML = pfView === "updates" ? pfUpdates()
                : pfView === "info"    ? pfInfo()
                : pfView === "help"    ? pfHelp()
                : pfHome();

  if(pfView === "updates") pfLoadNotifs();
}

/* the same fetch-once-and-keep the sheet used, moved here with the screen */
function pfLoadNotifs(){
  if(acctNotifs) return;
  acctNotifs = [];
  loadNotifs().then(rows => {
    acctNotifs = Array.isArray(rows) ? rows : [];
    if(profileOpen() && pfView === "updates") paintProfile();
    const unread = acctNotifs.filter(n => !n.read_at).map(n => n.id);
    if(unread.length){
      SB.rpc("mark_notifications_read", {p_ids: unread})
        .then(() => {
          acctNotifs.forEach(n => { n.read_at = n.read_at || new Date().toISOString(); });
          unreadCount = 0;
          paintAcctBtn();
        }).catch(() => {});
    }
  }).catch(() => { acctNotifs = null; });
}

/* ══════════════════════════════════════════════════════════
   OPENING AND LEAVING
   ══════════════════════════════════════════════════════════ */
const PF_TITLE_DOC = "Your profile — Ray Art Gallery";

function openProfile(view, fromHash){
  if(!SB_ON) return;
  /* signed out, there is no profile to show — the sheet still holds the
     sign-in, and that is what a tap on the account button should get */
  if(!signedIn()){ openAcct(); return; }

  pfView = view || "home";
  pfNote = null;
  paintProfile();

  pfEl.classList.add("on");
  pfEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("pf-on");
  pfEl.scrollTop = 0;
  lock();
  if(!fromHash){
    const want = pfView === "home" ? "#profile" : "#profile/" + pfView;
    if(location.hash !== want) location.hash = want.slice(1);
  }
  document.title = PF_TITLE_DOC;

  /* the address count on the rows is a fact about the account, so it is
     fetched with the account rather than when the address page is opened */
  loadAddresses().then(() => { if(profileOpen()) paintProfile(); }).catch(() => {});
  /* and so is the order count — the orders page keeps the list, this only
     asks it to fill it if it has not already */
  /* the orders page is script 30 and this is script 29, so on a cold load of
     #profile it does not exist yet — the count simply waits for the first
     time the page is opened by a tap, which is every other time */
  if(typeof odPrime === "function"){
    odPrime().then(() => { if(profileOpen() && pfView === "home") paintProfile(); }).catch(() => {});
  }
}

function hideProfile(){
  pfEl.classList.remove("on");
  pfEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pf-on");
  if(!sheetOpen()){ $("#scrim").classList.remove("on"); unlock(); }
  document.title = "Ray Art Gallery — Handmade Rakhi";
}

function closeProfile(fromHash){
  if(!profileOpen()) return;
  hideProfile();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/* Back inside the profile means "up one", not "out of the shop": from a
   sub-view it returns to the list of rows, and only from the list itself
   does it leave. That is what the arrow at the top left of the screenshot
   promises, and a back button that skips a level is the fastest way to make
   somebody stop trusting it. */
function pfBack(){
  if(pfView !== "home"){ openProfile("home"); return; }
  closeProfile();
}

function syncProfileRoute(){
  const m = /^#profile(?:\/(updates|info|help))?$/.exec(location.hash);
  if(m) openProfile(m[1] || "home", true);
  else if(profileOpen()) hideProfile();
}
addEventListener("hashchange", syncProfileRoute);

/* ══════════════════════════════════════════════════════════
   WIRING
   ══════════════════════════════════════════════════════════ */
fillBrandMark("#pfHome .brand-mk-slot");
$("#pfCart").onclick = () => openCart();
$("#pfHome").onclick = e => { e.preventDefault(); closeProfile(); };
$("#pfBack").onclick = () => pfBack();

/* ── where back goes ──
   Orders, the wishlist and the address book are each reachable two ways:
   from this page, and from the menu, the bill's "see your orders", or a
   link somebody sent themselves. Back has to mean different things in
   those two cases — returning to a profile page they never opened is as
   wrong as dumping them on the shop when they were three rows deep in
   their account.

   So one register, written as this page hands over and read once by the
   back button of whoever it handed to. It is cleared when that page is
   left by any other door — the wordmark, a link, the hash — so a second
   visit by another route can never inherit the first visit's answer.

   Cleared on the way out rather than on the way in, which is where this
   first went: setting location.hash re-enters open() through hashchange a
   tick later, and that re-entry wiped the register between handing over
   and being asked for it. */
let pfSentTo = null;
function pfCameFromProfile(where){
  const yes = pfSentTo === where;
  pfSentTo = null;
  return yes;
}
/* the way back out of a page that this one opened */
function pfReturn(where, close){
  const back = pfCameFromProfile(where);
  close();
  if(back) requestAnimationFrame(() => openProfile("home"));
}

/* every row and tile on the page goes through one place, so a row added to
   the list needs nothing but a name in pfRows() */
function pfGo(where){
  const hand = (open, tag) => {
    closeProfile();
    pfSentTo = tag;
    requestAnimationFrame(open);
  };
  if(where === "orders")    { hand(openOrders,    "orders");    return; }
  if(where === "wishlist")  { hand(openWish,      "wishlist");  return; }
  if(where === "addresses") { hand(openAddresses, "addresses"); return; }
  if(where === "admin")     { location.href = ENV.ADMIN_PATH + "/"; return; }
  if(where === "updates" || where === "info" || where === "help"){ openProfile(where); return; }
}

$("#pfIn").addEventListener("click", e => {
  const go = e.target.closest("[data-pfgo]");
  if(go){ pfGo(go.dataset.pfgo); return; }

  const view = e.target.closest("[data-pfview]");
  if(view){ openProfile(view.dataset.pfview); return; }

  /* a link out of the profile and into the shop — the page has to come down
     or the anchor lands behind it */
  if(e.target.closest("[data-pfclose]")){ closeProfile(); return; }

  if(e.target.closest("#pfOut")){ signOut(); closeProfile(); return; }

  /* an update about an order opens that order */
  const ov = e.target.closest("[data-oview]");
  if(ov){
    const id = ov.dataset.oview;
    closeProfile();
    requestAnimationFrame(() => openOrderPage(id));
    return;
  }
});

$("#pfIn").addEventListener("submit", e => {
  e.preventDefault();
  if(e.target.id === "pfForm") return pfSaveInfo();
  if(e.target.id === "pfPass") return pfChangePassword();
});

async function pfSaveInfo(){
  const name  = ($("#pfName").value  || "").trim();
  const phone = ($("#pfPhone").value || "").trim();
  if(name.length < 2)                        return pfSay("Enter your name.");
  if(phone && !/^[6-9]\d{9}$/.test(phone))   return pfSay("That phone number does not look right.");

  const btn = $("#pfSave");
  if(btn){ btn.disabled = true; btn.textContent = "Saving…"; }
  try{
    await saveProfile({full_name: name, phone: phone || null});
    fillBillFromProfile();
    paintAcctBtn();
    pfSay("Saved.", true);
    toast("Saved");
  }catch(err){
    pfSay(err.message || "Could not save just now.");
  }
}

async function pfChangePassword(){
  const a = ($("#pfNew").value  || "").trim();
  const b = ($("#pfNew2").value || "").trim();
  if(a.length < 8) return pfSay("A password needs at least 8 characters.");
  if(a !== b)      return pfSay("Those two are not the same.");

  const btn = $("#pfPassSave");
  if(btn){ btn.disabled = true; btn.textContent = "Changing…"; }
  try{
    await SB.updatePassword(a);
    pfSay("Password changed. Use it the next time you sign in.", true);
    toast("Password changed");
  }catch(err){
    pfSay(err.message || "Could not change it just now.");
  }
}

syncProfileRoute();     /* #profile on a cold load, as every other page does */
