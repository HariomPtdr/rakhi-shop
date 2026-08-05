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
let acctTab  = "orders";  // orders · updates · basket · wishlist · details
let acctOrders = null;    // cached for this opening of the sheet
let acctNotifs = null;    // the same, for the updates tab
let cancelling = null;    // the order id whose "are you sure" is open

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
    box.innerHTML = `
      <div class="nav-who">
        <span class="nav-av">${esc((nm || "?").trim().charAt(0).toUpperCase())}</span>
        <div><b>${esc(nm)}</b><span>${esc(u.email)}</span></div>
      </div>
      <div class="nav-auth-acts">
        <button class="btn btn-dark" data-navact="account">Your orders</button>
        <button class="btn btn-ghost" data-navact="out">Sign out</button>
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
    <p class="ac-fine">We keep your name, phone and address so you do not have to type
       them again, and nothing else. Orders are still confirmed on WhatsApp.</p>`;
}

/* ── the status of one order, drawn as the four steps it goes through ── */
function orderTrack(o){
  if(o.status === "cancelled"){
    return `<div class="ac-track cancelled"><span class="ac-chip no">Cancelled</span></div>`;
  }
  const at = STATUS[o.status] ? STATUS[o.status].step : 0;
  return `<div class="ac-track">${STATUS_FLOW.map((s, i) => `
    <span class="ac-step${i <= at ? " done" : ""}${i === at ? " now" : ""}">
      <i aria-hidden="true"></i><b>${STATUS[s].label}</b>
    </span>`).join("")}</div>`;
}

function orderCard(o){
  const items = (o.order_items || []);
  const lines = items.map(i => `${esc(i.name)} × ${i.qty}`).join(" · ");
  const ask = wa(`Hello Ray Art Gallery, about my order ${o.bill_no} (${inr(o.total)}).`);
  /* the same rule the database enforces, so the button is never offered
     where cancel_order() would refuse it */
  const canCancel = o.status === "placed" || o.status === "confirmed";
  return `<div class="ac-order">
    <div class="ac-o-top">
      <span class="ac-o-no">${esc(o.bill_no)}</span>
      <span class="ac-o-d">${esc(dayText(o.created_at))}</span>
      <span class="ac-o-t">${inr(o.total)}</span>
    </div>
    <div class="ac-o-l">${lines || "—"}</div>
    ${orderTrack(o)}
    ${o.tracking_id ? `<div class="ac-o-trk">
       <span>${esc(o.courier || "Courier")}</span>
       <b>${esc(o.tracking_id)}</b>
       <button class="ac-copy" type="button" data-copy="${esc(o.tracking_id)}">Copy</button>
     </div>` : ""}
    <div class="ac-o-foot">
      <span>${o.shipping ? inr(o.subtotal) + " + " + inr(o.shipping) + " delivery" : "Delivery free"}</span>
      ${canCancel ? `<button class="ac-cancel" data-cancel="${esc(o.id)}">Cancel order</button>` : ""}
      <a class="ac-ask" href="${ask}" target="_blank" rel="noopener">Ask about this order</a>
    </div>
    ${cancelling === o.id ? cancelForm(o) : ""}
  </div>`;
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
    <label class="ac-c-lab" for="acWhy">Why, so we can do better</label>
    <select class="ac-c-sel" id="acWhy">
      ${CANCEL_REASONS.map(r => `<option>${esc(r)}</option>`).join("")}
    </select>
    <div class="ac-c-acts">
      <button class="btn btn-ghost" data-cancelno="1">Keep the order</button>
      <button class="btn btn-dark ac-c-go" data-cancelyes="${esc(o.id)}">Yes, cancel it</button>
    </div>
  </div>`;
}

async function doCancel(id){
  const why = ($("#acWhy") && $("#acWhy").value) || "";
  const btn = $(".ac-c-go");
  if(btn){ btn.disabled = true; btn.textContent = "Cancelling…"; }
  try{
    await SB.rpc("cancel_order", {p_order: id, p_reason: why});
    cancelling = null;
    acctOrders = null;                       /* re-read, so the status is the server's */
    acctNotifs = null;
    toast("Order cancelled");
    paintAcct();
    loadAcctData();
  }catch(err){
    cancelling = null;
    paintAcct();
    note(err.message || "Could not cancel it just now.");
  }
}

function wishCard(id){
  const p = catalogue(id);
  if(!p) return "";
  const out = p.stock === 0;
  return `<div class="ac-wish">
    <div class="ac-w-i">${thumbFor(p.id)}</div>
    <div class="ac-w-m">
      <div class="ac-w-n">${esc(p.name)}</div>
      <div class="ac-w-p">${inr(p.price)}${out ? ` <span class="ac-w-out">Sold out</span>` : ""}</div>
      <div class="ac-w-r">
        <button class="btn btn-dark" data-wadd="${esc(p.id)}"${out ? " disabled" : ""}>Add to cart</button>
        <button class="btn btn-ghost" data-wopen="${esc(p.id)}">View</button>
        <button class="ac-w-x" data-wish="${esc(p.id)}" aria-label="Remove ${esc(p.name)} from your wishlist">Remove</button>
      </div>
    </div>
  </div>`;
}

function acctBody(){
  const u = SB.user();
  const nm = (profile && profile.full_name) || (u && u.name) || "";
  const spent = (acctOrders || [])
    .filter(o => o.status !== "cancelled")
    .reduce((s, o) => s + (o.total || 0), 0);
  const nOrders = (acctOrders || []).filter(o => o.status !== "cancelled").length;

  const unread = (acctNotifs || []).filter(n => !n.read_at).length;

  const head = `
    <div class="ac-who">
      ${avatarHtml("ac-av")}
      <div>
        <b>${esc(nm || "Your account")}</b>
        <span>${esc(u ? u.email : "")}</span>
      </div>
    </div>
    ${profile && profile.role === "admin"
      ? `<a class="ac-admin" href="${esc(ENV.ADMIN_PATH)}/">Open the seller dashboard →</a>` : ""}
    <div class="ac-stats">
      <div><b>${acctOrders ? nOrders : "—"}</b><span>${plural(nOrders, "order")}</span></div>
      <div><b>${acctOrders ? inr(spent) : "—"}</b><span>spent</span></div>
      <div><b>${wish.length}</b><span>saved</span></div>
    </div>
    ${acctNoteHtml()}
    <div class="ac-tabs ac-tabs-3 ac-tabs-scroll" role="tablist">
      <button role="tab" data-tab="orders"   aria-selected="${acctTab === "orders"}">Orders</button>
      <button role="tab" data-tab="updates"  aria-selected="${acctTab === "updates"}">Updates${
        unread ? ` <i class="dot">${unread}</i>` : ""}</button>
      <button role="tab" data-tab="basket"   aria-selected="${acctTab === "basket"}">Basket${
        nItems() ? ` <i>${nItems()}</i>` : ""}</button>
      <button role="tab" data-tab="wishlist" aria-selected="${acctTab === "wishlist"}">Saved${
        wish.length ? ` <i>${wish.length}</i>` : ""}</button>
      <button role="tab" data-tab="details"  aria-selected="${acctTab === "details"}">Details</button>
    </div>`;

  if(acctTab === "updates"){
    if(!acctNotifs) return head + `<div class="ac-pane"><p class="ac-empty">Loading…</p></div>`;
    if(!acctNotifs.length){
      return head + `<div class="ac-pane"><p class="ac-empty">Nothing yet. When an order
        is confirmed, sent or delivered, it is written here — and the tracking
        id comes with it.</p></div>`;
    }
    return head + `<div class="ac-pane">${acctNotifs.map(n => `
      <div class="ac-notif${n.read_at ? "" : " unread"}">
        <div class="ac-n-top">
          <b>${esc(n.title)}</b>
          <span>${esc(agoText(n.created_at))}</span>
        </div>
        ${n.body ? `<p>${esc(n.body)}</p>` : ""}
      </div>`).join("")}</div>`;
  }

  if(acctTab === "basket"){
    if(!cart.length){
      return head + `<div class="ac-pane"><p class="ac-empty">Your basket is empty.
        Everything you add is kept here and on any other phone you sign in from.</p></div>`;
    }
    const left = SHOP.freeShipAbove - sub();
    return head + `<div class="ac-pane">
      ${cart.map((r, i) => `
        <div class="ac-wish">
          <div class="ac-w-i">${thumbFor(r.id)}</div>
          <div class="ac-w-m">
            <div class="ac-w-n">${esc(r.name)}</div>
            ${r.note ? `<div class="ac-w-note">${esc(r.note)}</div>` : ""}
            <div class="ac-w-p">${inr(r.price)} each</div>
            <div class="ac-w-r">
              <span class="stp">
                <button type="button" data-bdn="${i}" aria-label="One less">−</button>
                <span>${r.qty}</span>
                <button type="button" data-bup="${i}" aria-label="One more">+</button>
              </span>
              <b class="ac-w-amt">${inr(r.price * r.qty)}</b>
              <button class="ac-w-x" data-brm="${i}" aria-label="Remove ${esc(r.name)}">Remove</button>
            </div>
          </div>
        </div>`).join("")}
      <div class="ac-sum">
        <div><span>Items</span><span>${nItems()}</span></div>
        <div><span>Subtotal</span><span>${inr(sub())}</span></div>
        <div><span>Delivery</span><span>${ship() === 0 ? "Free" : inr(ship())}</span></div>
        <div class="ac-sum-t"><span>Total</span><span>${inr(tot())}</span></div>
        <p class="ac-empty" style="margin-top:8px">${left > 0
          ? `Add ${inr(left)} more and delivery is free.`
          : `Delivery is free on this order.`}</p>
      </div>
      <button class="btn btn-dark btn-full" id="acToBill">Create the bill</button>
    </div>`;
  }

  if(acctTab === "wishlist"){
    const rows = wish.map(wishCard).filter(Boolean).join("");
    return head + `<div class="ac-pane">${rows || `<p class="ac-empty">Nothing saved yet.
      Tap the heart on any rakhi and it waits for you here — on this phone, and on
      any other you sign in from.</p>`}</div>`;
  }

  if(acctTab === "details"){
    return head + `<div class="ac-pane">
      <form id="acctProfile" novalidate>
        <div class="fg two">
          <div class="fld"><label for="pName">Full name</label>
            <input type="text" id="pName" autocomplete="name" value="${esc(nm)}"></div>
          <div class="fld"><label for="pPhone">Phone</label>
            <input type="tel" id="pPhone" autocomplete="tel" inputmode="numeric" maxlength="10"
                   value="${esc((profile && profile.phone) || "")}"></div>
        </div>
        <div class="fg"><div class="fld"><label for="pAddr">Address</label>
          <textarea id="pAddr" autocomplete="street-address">${esc((profile && profile.address) || "")}</textarea></div></div>
        <div class="fg two">
          <div class="fld"><label for="pCity">City</label>
            <input type="text" id="pCity" autocomplete="address-level2" value="${esc((profile && profile.city) || "")}"></div>
          <div class="fld"><label for="pPin">Pincode</label>
            <input type="tel" id="pPin" autocomplete="postal-code" inputmode="numeric" maxlength="6"
                   value="${esc((profile && profile.pincode) || "")}"></div>
        </div>
        <p class="ac-fine">Saved once, and every bill you make fills itself in from it.</p>
        <div class="ac-acts two">
          <button class="btn btn-dark" id="pSave" type="submit">Save details</button>
          <button class="btn btn-ghost" id="acOut" type="button">Sign out</button>
        </div>
      </form></div>`;
  }

  /* orders */
  if(!acctOrders) return head + `<div class="ac-pane" id="acOrders"><p class="ac-empty">Loading…</p></div>`;
  if(!acctOrders.length){
    return head + `<div class="ac-pane"><p class="ac-empty">No orders yet. Once you send a bill
      on WhatsApp while signed in, it appears here — with where it has got to and,
      once it ships, its tracking id.</p></div>`;
  }
  return head + `<div class="ac-pane">${acctOrders.map(orderCard).join("")}</div>`;
}

function paintAcct(){
  const body = $("#acctBody");
  if(!body) return;
  body.innerHTML = signedIn() ? acctBody() : acctSignedOut();
  if(signedIn()) loadAcctData();
}

/* Orders and updates are fetched once per opening of the sheet and then
   kept, so switching tabs is instant. Anything that changes them — placing
   an order, cancelling one — clears the copy rather than patching it, so
   what is shown is always what the server says. */
function loadAcctData(){
  if(!signedIn()) return;

  if(acctTab === "orders" && !acctOrders){
    acctOrders = [];                                  /* stops a second fetch */
    loadOrders().then(rows => {
      acctOrders = Array.isArray(rows) ? rows : [];
      if(isOn("#acctModal") && signedIn()) paintAcct();
    }).catch(() => {
      acctOrders = null;
      const box = $("#acOrders");
      if(box) box.innerHTML = `<p class="ac-empty">Could not load your orders just now.</p>`;
    });
  }

  if(acctTab === "updates" && !acctNotifs){
    acctNotifs = [];
    loadNotifs().then(rows => {
      acctNotifs = Array.isArray(rows) ? rows : [];
      if(isOn("#acctModal") && signedIn()) paintAcct();
      /* opening the tab is reading them */
      const unread = acctNotifs.filter(n => !n.read_at).map(n => n.id);
      if(unread.length){
        SB.rpc("mark_notifications_read", {p_ids: unread})
          .then(() => { acctNotifs.forEach(n => { n.read_at = n.read_at || new Date().toISOString(); });
                        paintAcctBtn(); })
          .catch(() => {});
      }
    }).catch(() => { acctNotifs = null; });
  }
}

function openAcct(tab){
  if(!SB_ON) return;
  acctNote = null;
  if(tab) acctTab = tab;
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

/* ── everything the sheet can be clicked on ── */
$("#acctBody").addEventListener("click", async e => {
  const view = e.target.closest("[data-view]");
  if(view){ e.preventDefault(); acctView = view.dataset.view; acctNote = null; paintAcct(); return; }

  const tab = e.target.closest("[data-tab]");
  if(tab){ acctTab = tab.dataset.tab; acctNote = null; paintAcct(); return; }

  if(e.target.closest("#acOut")){ signOut(); return; }

  if(e.target.closest("#acGoogle")){
    /* No fragment on the way out: Supabase puts the session in the fragment
       when it sends the browser back, and anything already there is lost.
       landFromLink() opens the sheet again on arrival. */
    SB.oauth("google", location.origin + location.pathname);
    return;
  }

  const add = e.target.closest("[data-wadd]");
  if(add){ addItem(catalogue(add.dataset.wadd)); return; }

  /* the basket tab: the same stepper and Remove as the cart drawer, so a
     customer never has to leave their account to fix a quantity */
  const up = e.target.closest("[data-bup]"), dn = e.target.closest("[data-bdn]"),
        rm = e.target.closest("[data-brm]");
  if(up || dn || rm){
    if(up) cart[up.dataset.bup].qty = Math.min(MAX_QTY, cart[up.dataset.bup].qty + 1);
    else if(dn){ if(--cart[dn.dataset.bdn].qty < 1) cart.splice(dn.dataset.bdn, 1); }
    else {
      const gone = cart[rm.dataset.brm];
      cart.splice(rm.dataset.brm, 1);
      if(gone) track("remove_cart", gone.id, {qty: gone.qty});
    }
    save(); paintCart(); paintAcct();
    return;
  }

  if(e.target.closest("#acToBill")){
    closeAcct();
    requestAnimationFrame(() => { openCart(); $("#toBill").click(); });
    return;
  }

  /* View, on a wishlist row.
     Closing the sheet calls history.back() to drop the entry it pushed, and
     that pops *asynchronously*. Setting the product's hash in the same tick
     meant the pop landed afterwards and threw the new hash away again — so
     the sheet closed and nothing else happened. Wait for the pop, then open. */
  const open = e.target.closest("[data-wopen]");
  if(open){
    const id = open.dataset.wopen;
    if(isOn("#acctModal") && sheetHist){
      addEventListener("popstate", () => openProduct(id), {once:true});
      closeAcct();
    }else{
      closeAcct();
      openProduct(id);
    }
    return;
  }

  const cx = e.target.closest("[data-cancel]");
  if(cx){ cancelling = cx.dataset.cancel; paintAcct(); return; }
  if(e.target.closest("[data-cancelno]")){ cancelling = null; paintAcct(); return; }
  const cy = e.target.closest("[data-cancelyes]");
  if(cy){ doCancel(cy.dataset.cancelyes); return; }

  const copy = e.target.closest("[data-copy]");
  if(copy){
    try{ await navigator.clipboard.writeText(copy.dataset.copy); toast("Tracking id copied"); }
    catch(err){ toast(copy.dataset.copy); }
    return;
  }
});
$("#acctBody").addEventListener("submit", e => {
  e.preventDefault();
  if(e.target.id === "acctForm")    return submitAuth();
  if(e.target.id === "acctProfile") return submitProfile();
  if(e.target.id === "acctReset")   return submitNewPassword();
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
      if(s){ await afterSignIn(); acctTab = "details"; return note("Welcome. Your details are below.", true); }
      /* email confirmation is on in the project: nothing to sign in with yet */
      acctView = "in";
      return note("Account created. Open the link we emailed you, then sign in.", true);
    }
    await SB.signIn(email, pass);
    await afterSignIn();
    acctNote = null;
    acctOrders = null;
    acctTab = "orders";
    paintAcct();
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
    acctView = "in"; acctTab = "orders"; acctOrders = null;
    paintAcct();
    toast("Password changed");
  }catch(err){
    note(err.message || "Could not change it just now.");
  }
}

async function submitProfile(){
  const p = {
    full_name: ($("#pName").value  || "").trim() || null,
    phone:     ($("#pPhone").value || "").trim() || null,
    address:   ($("#pAddr").value  || "").trim() || null,
    city:      ($("#pCity").value  || "").trim() || null,
    pincode:   ($("#pPin").value   || "").trim() || null
  };
  if(p.phone && !/^[6-9]\d{9}$/.test(p.phone)) return note("Enter a valid 10-digit phone number.");
  if(p.pincode && !/^\d{6}$/.test(p.pincode))  return note("Enter a valid 6-digit pincode.");
  busy("#pSave", true, "Saving…");
  try{
    await saveProfile(p);
    fillBillFromProfile();
    paintAcctBtn();
    note("Saved.", true);
    toast("Details saved");
  }catch(err){
    note(err.message || "Could not save just now.");
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
  acctOrders = null;

  if(kind === "recovery"){
    acctView = "reset";
    openAcct();
    paintAcct();
  }else{
    acctTab = "orders";
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

  /* #account is a real address, so "your orders" can be linked to.
     A link from an email normally loads the page fresh, but if this tab is
     already open on it the fragment changes underneath us instead — so watch
     for that too rather than sitting there doing nothing. */
  const acctRoute = () => {
    if(location.hash.indexOf("access_token=") !== -1){ landFromLink(); return; }
    if(location.hash === "#account" && !isOn("#acctModal")) openAcct();
  };
  addEventListener("hashchange", acctRoute);

  (async () => {
    const landed = await landFromLink();
    /* which providers are on decides whether the Google button is drawn, so
       ask before the sheet can be opened, and redraw if it already is */
    SB.providers().then(() => { if(isOn("#acctModal")) paintAcct(); });
    if(!landed) acctRoute();
  })();
}

paintGrid();
paintCart();
paintHearts();
syncRoute();          /* honour #p/<id> on a cold load */
