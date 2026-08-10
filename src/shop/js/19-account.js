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
let cancelWhy  = 0;       // which reason is picked, by index
let editingAddr = null;   // the order id whose address is being corrected
let detailsEditing = false;  // the saved address is being changed, not just read

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
       than the button it replaces. Each one opens the account on that tab —
       the same screens, not a second copy of them. */
    const where = [
      ["orders",   "Orders",  ""],
      ["updates",  "Updates", unreadCount ? String(unreadCount) : ""],
      ["basket",   "Basket",  nItems() ? String(nItems()) : ""],
      ["wishlist", "Saved",   wish.length ? String(wish.length) : ""],
      ["details",  "Details", ""]
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
  const tab = e.target.closest("[data-navtab]");
  if(tab){
    const which = tab.dataset.navtab;
    closeNav();
    requestAnimationFrame(() => openAcct(which));
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
      <i aria-hidden="true"></i><b>${STATUS[s].short || STATUS[s].label}</b>
    </span>`).join("")}</div>`;
}

/* ── where it has got to, in one sentence ──
   Four dots and a word are a picture of the process, not an answer to
   "so where is my rakhi". This is the answer. */
function orderWhere(o){
  const when = dayText(o.status_at || o.created_at);
  const line = {
    placed:    "We confirm every order by hand — usually within a day.",
    confirmed: o.payment === "upi" ? "Paid. Confirmed and being made."
                                   : "Confirmed and being made.",
    shipped:   o.courier ? "On its way with " + o.courier + "." : "On its way.",
    out_for_delivery: "Out for delivery — it reaches you today."
      + (o.payment === "cod" ? " Please keep " + inr(o.total) + " ready." : ""),
    delivered: "Delivered on " + when + ".",
    cancelled: "Cancelled on " + when + "."
  }[o.status];
  return line ? `<p class="ac-o-where">${esc(line)}</p>` : "";
}

function orderCard(o){
  const items = (o.order_items || []);
  const lines = items.map(i => `${esc(i.name)} × ${i.qty}`).join(" · ");
  /* the first rakhi in the order is the one that makes it recognisable —
     people remember what they bought, not what the bill was numbered */
  const first = items.find(i => i.product_id && catalogue(i.product_id));
  const pic   = first ? catalogue(first.product_id) : null;
  const done  = o.status === "delivered";
  const rateable = done && first;

  /* A list is for recognising an order and getting on with it. Everything
     that explains — where it has got to, what is in it, where it is going,
     what has been said about it — is one tap away on the order's own page,
     where there is room to say it properly. */
  return `<div class="ac-order">
    <span class="ac-o-pic">${pic ? thumb(pic) : ""}</span>
    <div class="ac-o-mid">
      <div class="ac-o-top">
        <span class="ac-o-no">${esc(o.bill_no)}</span>
        <span class="ac-o-d">${esc(dayText(o.created_at))}</span>
        <span class="ac-o-t">${inr(o.total)}</span>
      </div>
      <div class="ac-o-l">${lines || "—"}</div>
      <span class="ac-o-st ${esc((STATUS[o.status] || {}).cls || "")}">${
        esc((STATUS[o.status] || {}).label || o.status)}</span>
    </div>
    <div class="ac-o-acts">
      <button class="btn btn-dark btn-sm" data-oview="${esc(o.id)}">${
        done ? "View order" : "Track order"}</button>
      ${rateable ? `<button class="btn btn-ghost btn-sm" data-ofeed="${esc(first.product_id)}"
        >Feedback</button>` : ""}
      ${done && first ? `<button class="btn btn-ghost btn-sm" data-oagain="${esc(o.id)}"
        >Buy again</button>` : ""}
    </div>
  </div>`;
}

/* ── correcting where it is going ──
   A wrong pincode is the commonest reason a parcel comes back, and it is
   always spotted a minute after the order goes in. Allowed until somebody
   hands it to a courier — the database enforces the same rule, and tells
   the seller what changed, so a label already written is never quietly
   wrong. */
function addrForm(o){
  return `<div class="ac-addrbox">
    <b>Where should ${esc(o.bill_no)} go?</b>
    <p>You can change this until it is handed to the courier. We are told, so
       nothing goes out to the old address.</p>
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

function wishCard(id){
  const p = catalogue(id);
  if(!p) return "";
  const out = p.stock === 0;
  return `<div class="ac-wish">
    <div class="ac-w-i">${thumbFor(p.id)}</div>
    <div class="ac-w-m">
      <div class="ac-w-top">
        <span class="ac-w-n">${esc(p.name)}</span>
        <span class="ac-w-p">${inr(p.price)}</span>
      </div>
      ${out ? `<div class="ac-w-note ac-w-out">Sold out just now</div>` : ""}
      <div class="ac-w-r">
        <button class="btn btn-dark btn-sm" data-wadd="${esc(p.id)}"${out ? " disabled" : ""}>Add</button>
        <button class="btn btn-ghost btn-sm" data-wopen="${esc(p.id)}">View</button>
        <button class="ac-w-x" data-wish="${esc(p.id)}"
                aria-label="Remove ${esc(p.name)} from your saved rakhis">Remove</button>
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
        id comes with it. Anything Ray Art Gallery needs to tell you about an
        order lands here too.</p></div>`;
    }
    /* every update is about an order, so every update is a way into it */
    return head + `<div class="ac-pane">${acctNotifs.map(n => `
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

  if(acctTab === "basket"){
    if(!cart.length){
      return head + `<div class="ac-pane"><p class="ac-empty">Your basket is empty.
        Everything you add is kept here and on any other phone you sign in from.</p></div>`;
    }
    return head + `<div class="ac-pane">
      ${cart.map((r, i) => `
        <div class="ac-wish">
          <div class="ac-w-i">${thumbFor(r.id)}</div>
          <div class="ac-w-m">
            <div class="ac-w-top">
              <span class="ac-w-n">${esc(r.name)}</span>
              <span class="ac-w-p">${inr(r.price * r.qty)}</span>
            </div>
            <div class="ac-w-note">${inr(r.price)} each${
              r.note ? ` · ${esc(r.note)}` : ""}</div>
            <div class="ac-w-r">
              <span class="stp">
                <button type="button" data-bdn="${i}" aria-label="One less">−</button>
                <span>${r.qty}</span>
                <button type="button" data-bup="${i}" aria-label="One more">+</button>
              </span>
              <button class="ac-w-x" data-brm="${i}" aria-label="Remove ${esc(r.name)}">Remove</button>
            </div>
          </div>
        </div>`).join("")}
      <div class="ac-sum">
        <div><span>Items</span><span>${nItems()}</span></div>
        <div><span>Subtotal</span><span>${inr(sub())}</span></div>
        <div><span>Delivery</span><span>${ship() === 0 ? "Free" : inr(ship())}</span></div>
        <div class="ac-sum-t"><span>Total</span><span>${inr(tot())}</span></div>
        <p class="ac-empty" style="margin-top:8px">${shipNudge()}</p>
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
    /* An address that is already saved is a fact, not a form. Five boxes
       standing open every time say "check this", when the honest state is
       "this is where your rakhis go, change it if that is wrong". Nothing
       to add is a different screen again: one button, not five empty
       boxes. */
    const p = profile || {};
    const hasAddr = !!(p.full_name && p.phone && p.address && p.city && p.pincode);

    return head + `<div class="ac-pane">
      <div class="ac-sec-k" style="margin-bottom:12px">Delivery address</div>

      ${!detailsEditing && hasAddr ? `
        <div class="addr-card">
          <span class="addr-tick" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
          </span>
          <div>
            <b>${esc(p.full_name)}</b>
            <p>${esc(p.address)}<br>${esc(p.city)} — ${esc(p.pincode)}</p>
            <span class="addr-ph">${esc(p.phone)}</span>
          </div>
        </div>
        <p class="ac-fine">Every bill fills itself in from this. Changing it does not
          change an order already placed — open that order and change it there.</p>
        <div class="ac-acts">
          <button class="btn btn-ghost btn-full" id="pEdit" type="button">Change address</button>
        </div>` : ""}

      ${!detailsEditing && !hasAddr ? `
        <p class="ac-fine" style="margin-top:0">Nothing saved yet. Add it once and every
          bill you make fills itself in — you will not type it again.</p>
        <div class="ac-acts">
          <button class="btn btn-dark btn-full" id="pEdit" type="button">Add your address</button>
        </div>` : ""}

      ${detailsEditing ? `
      <form id="acctProfile" novalidate>
        <div class="fg two">
          <div class="fld"><label for="pName">Full name</label>
            <input type="text" id="pName" autocomplete="name" value="${esc(nm)}"></div>
          <div class="fld"><label for="pPhone">Phone</label>
            <input type="tel" id="pPhone" autocomplete="tel" inputmode="numeric" maxlength="10"
                   value="${esc(p.phone || "")}"></div>
        </div>
        <div class="fg"><div class="fld"><label for="pAddr">Address</label>
          <textarea id="pAddr" autocomplete="street-address">${esc(p.address || "")}</textarea></div></div>
        <div class="fg two">
          <div class="fld"><label for="pCity">City</label>
            <input type="text" id="pCity" autocomplete="address-level2" value="${esc(p.city || "")}"></div>
          <div class="fld"><label for="pPin">Pincode</label>
            <input type="tel" id="pPin" autocomplete="postal-code" inputmode="numeric" maxlength="6"
                   value="${esc(p.pincode || "")}"></div>
        </div>
        <div class="ac-acts two">
          <button class="btn btn-dark" id="pSave" type="submit">${
            hasAddr ? "Save the address" : "Save it"}</button>
          ${hasAddr ? `<button class="btn btn-ghost" id="pCancel" type="button">Leave it</button>` : ""}
        </div>
      </form>` : ""}

      <div class="ac-sec">
        <div class="ac-sec-k">Password</div>
        <form id="acctPass" novalidate>
          <div class="fg two">
            <div class="fld"><label for="pNew">New password</label>
              <input type="password" id="pNew" autocomplete="new-password"
                     placeholder="At least 8 characters"></div>
            <div class="fld"><label for="pNew2">Again</label>
              <input type="password" id="pNew2" autocomplete="new-password"
                     placeholder="The same one"></div>
          </div>
          <p class="ac-fine">${SB.user() && SB.user().avatar
            ? "You signed in with Google. Setting a password here lets you sign in either way."
            : "Changing it signs you in with the new one next time. This phone stays signed in."}</p>
          <div class="ac-acts">
            <button class="btn btn-ghost btn-full" id="pPassSave" type="submit">Change password</button>
          </div>
        </form>
      </div>

      <div class="ac-sec">
        <div class="ac-sec-k">Help</div>
        <p class="ac-fine" style="margin-top:0">Anything at all — a change to an order, a
          design you cannot find, something that will not work. We answer on
          WhatsApp, usually within the hour.</p>
        <div class="ac-acts two">
          <a class="btn btn-dark" href="${esc(wa("Hello Ray Art Gallery, I need some help."))}"
             target="_blank" rel="noopener">
            <svg class="wa" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.9.53 3.68 1.46 5.2L2 22l5.1-1.6a9.8 9.8 0 004.94 1.33c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2zm5.7 13.9c-.24.67-1.4 1.28-1.93 1.33-.53.06-1.02.1-1.75-.16-.73-.27-2.5-.98-4.28-3.1-1.4-1.67-1.62-2.9-1.7-3.4-.07-.5.2-1.35.55-1.7.35-.36.6-.4.83-.4h.5c.2 0 .4-.03.6.47.2.5.7 1.8.76 1.93.06.13.1.28 0 .45-.1.17-.34.44-.5.6-.16.15-.3.28-.15.55.14.27.6 1.06 1.3 1.7.9.83 1.6 1.1 1.87 1.23.27.14.43.12.6-.05.16-.16.66-.75.84-1 .18-.27.36-.22.6-.13.24.1 1.5.72 1.76.85.26.13.43.2.5.3.06.12.06.66-.18 1.34z"/></svg>
            Chat on WhatsApp</a>
          ${SHOP.email ? `<a class="btn btn-ghost" href="mailto:${esc(SHOP.email)}">Email us</a>` : ""}
        </div>
      </div>

      <div class="ac-sec">
        <div class="ac-acts"><button class="btn btn-ghost btn-full" id="acOut" type="button"
          >Sign out</button></div>
      </div></div>`;
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
  detailsEditing = false;      /* a fresh look, not a half-finished edit */
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

  if(e.target.closest("#pEdit")){ detailsEditing = true; paintAcct(); return; }
  if(e.target.closest("#pCancel")){ detailsEditing = false; paintAcct(); return; }

  const fb = e.target.closest("[data-ofeed]");
  if(fb){
    /* the review form lives on the rakhi's own page, where the database
       has already been asked whether this person may write one */
    const id = fb.dataset.ofeed;
    if(isOn("#acctModal") && sheetHist){
      addEventListener("popstate", () => openProduct(id), {once: true});
      closeAcct();
    }else{ closeAcct(); openProduct(id); }
    return;
  }

  const ag = e.target.closest("[data-oagain]");
  if(ag){
    const order = (acctOrders || []).find(x => x.id === ag.dataset.oagain);
    if(order) buyTheseAgain(order);
    return;
  }

  const ov = e.target.closest("[data-oview]");
  if(ov){
    /* the sheet's history entry pops asynchronously; wait for it, or the
       order page's hash is thrown away by the pop that follows */
    const id = ov.dataset.oview;
    if(isOn("#acctModal") && sheetHist){
      addEventListener("popstate", () => openOrderPage(id), {once: true});
      closeAcct();
    }else{
      closeAcct();
      openOrderPage(id);
    }
    return;
  }

  const ea = e.target.closest("[data-editaddr]");
  if(ea){ editingAddr = ea.dataset.editaddr; cancelling = null; paintAcct(); return; }
  if(e.target.closest("[data-addrno]")){ editingAddr = null; paintAcct(); return; }
  const ay = e.target.closest("[data-addryes]");
  if(ay){ saveOrderAddress(ay.dataset.addryes); return; }
  const op = e.target.closest("[data-orderpin]");
  if(op){ pinThisOrder(op.dataset.orderpin); return; }
  const pp = e.target.closest("[data-pastepin]");
  if(pp){ pastePinFor(pp.dataset.pastepin); return; }

  const cx = e.target.closest("[data-cancel]");
  if(cx){ cancelling = cx.dataset.cancel; editingAddr = null; cancelWhy = 0; paintAcct(); return; }

  /* picking a reason repaints only the row of reasons — repainting the whole
     account would scroll the box they are reading out from under them */
  const why = e.target.closest("[data-why]");
  if(why){
    cancelWhy = CANCEL_REASONS.indexOf(why.dataset.why);
    [...why.parentElement.children].forEach((b, i) => {
      b.classList.toggle("on", i === cancelWhy);
      b.setAttribute("aria-checked", String(i === cancelWhy));
    });
    return;
  }
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
  if(e.target.id === "acctPass")    return changePassword();
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
    detailsEditing = false;                /* back to reading it, not editing it */
    paintAcct();
    toast("Address saved");
  }catch(err){
    note(err.message || "Could not save just now.");
  }
}

/* ── the password, from inside the account ──
   The forgotten-password path exists for people who cannot get in. This is
   for people who are already in and simply want a different one — or who
   signed in with Google and would like a password as well, so they are not
   locked out of their own orders the day they lose that account. */
async function changePassword(){
  const a = ($("#pNew").value  || "").trim();
  const b = ($("#pNew2").value || "").trim();
  if(a.length < 8)  return note("A password needs at least 8 characters.");
  if(a !== b)       return note("Those two are not the same.");

  busy("#pPassSave", true, "Changing…");
  try{
    await SB.updatePassword(a);
    $("#pNew").value = ""; $("#pNew2").value = "";
    note("Password changed. Use it the next time you sign in.", true);
    toast("Password changed");
  }catch(err){
    note(err.message || "Could not change it just now.");
  }
  busy("#pPassSave", false, "Change password");
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
