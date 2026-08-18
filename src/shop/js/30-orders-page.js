/* ══════════════════════════════════════════════════════════
   YOUR ORDERS, AS A PAGE

   The list used to be a pane inside the account sheet: a row
   per order, a 40px thumbnail, a bill number and two buttons,
   scrolling in a window the height of a postcard. It answered
   "which order was that" and nothing else — where it had got
   to, what was in it and what it cost were all a tap away on
   the order's own page, which meant three taps to find out
   whether the parcel had shipped.

   A card, then, not a row. What it cost and what state it is
   in at the top, the rakhis themselves under that as
   photographs, the five-step tracker with the sentence that
   actually answers "so where is it", and the two things anybody
   does from a list of past orders — open it, or buy it again.

   And chips across the top. Twenty-five orders is a scroll, and
   "which of these has not arrived yet" is a question the list
   itself should be able to answer.
   ══════════════════════════════════════════════════════════ */
const odEl = $("#od");
const ordersOpen = () => odEl && odEl.classList.contains("on");

let odOrders = null;      // every order, newest first — fetched once per visit
let odFilter = "all";
let odLoading = false;

/* The chips, and what each one keeps. "Shipped" holds out-for-delivery too:
   they are one thing to the person waiting — it has left, it has not
   arrived — and a chip that hides today's parcel under a sixth name nobody
   was looking for is worse than four honest ones. */
const OD_FILTERS = [
  ["all",       "All Orders", null],
  ["placed",    "Placed",     ["placed"]],
  ["confirmed", "Confirmed",  ["confirmed"]],
  ["shipped",   "Shipped",    ["shipped", "out_for_delivery"]],
  ["delivered", "Delivered",  ["delivered"]],
  ["cancelled", "Cancelled",  ["cancelled"]]
];

function odMatch(o, key){
  const f = OD_FILTERS.find(x => x[0] === key);
  if(!f || !f[2]) return true;
  return f[2].indexOf(o.status) !== -1;
}

/* ══════════════════════════════════════════════════════════
   DRAWING IT
   ══════════════════════════════════════════════════════════ */

/* the round mark beside the status: a parcel, ticked once it is delivered
   and crossed once it is called off */
function odMark(o){
  const box = `<path d="M4 8.2 12 4l8 4.2v7.6L12 20l-8-4.2Z"/><path d="m4 8.2 8 4.2 8-4.2"/><path d="M12 12.4V20"/>`;
  const done = o.status === "delivered", off = o.status === "cancelled";
  return `<span class="od-mark${done ? " done" : ""}${off ? " off" : ""}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${box}</svg>
    ${done ? `<i class="od-mark-b" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"
           stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg></i>` : ""}
    ${off ? `<i class="od-mark-b off" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"
           stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg></i>` : ""}
  </span>`;
}

/* ── the rakhis, as photographs ──
   Four at most and then "+2", because five thumbnails on a 360px phone are
   five things too small to recognise.

   One tile per line, always — including for a rakhi the shop no longer
   sells. order_items.product_id is "on delete set null", so deleting a
   product severs an old order's only link to a photograph and there is
   genuinely nothing left to show. Skipping those lines was worse than
   admitting them: an order of three rakhis that had all been retired drew
   no pictures at all, which reads as the pictures being broken rather than
   as the rakhis being gone. The gold rosette is the same mark the cart
   uses for the same reason, and the line of names underneath is always
   drawn too — that one is always right. */
const OD_NOPIC = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" fill="rgba(217,184,119,.18)"/>
  <circle cx="20" cy="20" r="7.5" fill="none" stroke="#a8842f" stroke-width="1.4"/>
  <circle cx="20" cy="20" r="2.4" fill="#a8842f"/></svg>`;

function odShots(items){
  if(!items.length) return "";
  const show = items.slice(0, 4), rest = items.length - show.length;
  return `<div class="od-shots">
    ${show.map(i => {
      const p = i.product_id ? catalogue(i.product_id) : null;
      return `<span class="od-shot${p ? "" : " od-gone"}">${
        p ? thumb(p) : OD_NOPIC}</span>`;
    }).join("")}
    ${rest > 0 ? `<span class="od-shot od-more">+${rest}</span>` : ""}
  </div>`;
}

/* the five steps, small enough for a card and readable at arm's length */
function odTrack(o){
  if(o.status === "cancelled") return "";
  const at = STATUS[o.status] ? STATUS[o.status].step : 0;
  return `<div class="ac-track od-track">${STATUS_FLOW.map((s, i) => `
    <span class="ac-step${i <= at ? " done" : ""}${i === at ? " now" : ""}">
      <i aria-hidden="true"></i><b>${STATUS[s].short || STATUS[s].label}</b>
    </span>`).join("")}</div>`;
}

function odCard(o){
  const items = o.order_items || [];
  const names = items.map(i => `${esc(i.name)} × ${i.qty}`).join(" · ");
  const n = items.reduce((s, i) => s + (i.qty || 0), 0);
  const st = STATUS[o.status] || {label: o.status, cls: ""};
  const canAgain = items.some(i => i.product_id && catalogue(i.product_id));
  /* Counted rather than assumed: an order from before a rakhi was retired
     is still that customer's order, and the card has to say why it looks
     thinner than the others. */
  const gone = items.filter(i => !(i.product_id && catalogue(i.product_id))).length;
  const off = o.status === "cancelled";

  return `<article class="od-card${off ? " off" : ""}">
    <header class="od-top">
      ${odMark(o)}
      <div class="od-top-t">
        <b class="${esc(st.cls)}">${esc(st.label)}</b>
        <span>Placed on ${esc(dayTimeText(o.created_at))}</span>
      </div>
      <span class="od-tot">${inr(o.total)}</span>
    </header>

    ${odShots(items)}

    <p class="od-names">${names || "—"}</p>
    ${gone ? `<p class="od-gone-note">${gone === items.length
        ? "These are not in the shop any more."
        : gone + " of these " + (gone === 1 ? "is" : "are") + " not in the shop any more."}</p>` : ""}

    ${odTrack(o)}

    <p class="od-where${off ? " off" : o.status === "delivered" ? " done" : ""}">${esc(odWhereLine(o))}</p>

    <div class="od-meta">
      <span>${esc(o.bill_no)}</span>
      <span>${n} ${plural(n, "rakhi")}</span>
      ${o.tracking_id && !off ? `<span>${esc(o.courier || "Courier")} · ${esc(o.tracking_id)}</span>` : ""}
    </div>

    <footer class="od-acts">
      <button class="od-act" data-oview="${esc(o.id)}" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 3.4h8.4L18.6 7.6V20.6H6Z"/><path d="M14.2 3.4v4.4h4.4"/>
          <path d="M9 12.4h6M9 16h4"/></svg>
        View Details</button>
      ${canAgain ? `<button class="od-act od-again" data-oagain="${esc(o.id)}" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.4v4.2h-4.2"/></svg>
        Order Again</button>` : ""}
    </footer>
  </article>`;
}

/* One sentence saying where it is. The tracker is a picture of the process;
   this is the answer to the question somebody opened the page with. */
function odWhereLine(o){
  const when = dayText(o.status_at || o.created_at);
  return {
    placed:    "We confirm every order by hand — usually within a day.",
    confirmed: o.payment === "upi" ? "Paid. Confirmed and being made."
                                   : "Confirmed and being made.",
    shipped:   o.courier ? "On its way with " + o.courier + "." : "On its way.",
    out_for_delivery: "Out for delivery — it reaches you today."
      + (o.payment === "cod" ? " Please keep " + inr(o.total) + " ready." : ""),
    delivered: "Delivered on " + when + ".",
    cancelled: "Cancelled on " + when + "."
  }[o.status] || "";
}

function paintOdChips(){
  const box = $("#odChips");
  if(!box) return;
  const list = odOrders || [];
  box.innerHTML = OD_FILTERS.map(([key, label]) => {
    const n = key === "all" ? list.length : list.filter(o => odMatch(o, key)).length;
    return `<button class="od-chip${odFilter === key ? " on" : ""}${
      odOrders && !n ? " empty" : ""}" role="tab" aria-selected="${odFilter === key}"
      data-odf="${key}" type="button">${label}${
      odOrders && n && key !== "all" ? ` <i>${n}</i>` : ""}</button>`;
  }).join("");
}

function paintOrders(){
  paintOdChips();
  const box = $("#odIn");
  if(!box) return;

  if(!signedIn()){
    box.innerHTML = `<p class="ac-empty">Sign in to see your orders.</p>`;
    return;
  }
  if(!odOrders){
    box.innerHTML = `<p class="ac-empty">Loading…</p>`;
    return;
  }
  if(!odOrders.length){
    box.innerHTML = `<div class="od-none">
      <p class="ac-empty">No orders yet. Once you send a bill on WhatsApp while
        signed in, it appears here — with where it has got to and, once it ships,
        its tracking id.</p>
      <a class="wl-go" href="#all" data-odclose="1">Browse the collection
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 12h15M13 6l6 6-6 6"/></svg></a>
    </div>`;
    return;
  }

  const rows = odOrders.filter(o => odMatch(o, odFilter));
  if(!rows.length){
    /* the chip is still lit, so the empty line says which one and offers the
       way back rather than looking like the account has lost its orders */
    const label = (OD_FILTERS.find(f => f[0] === odFilter) || [])[1] || "that";
    box.innerHTML = `<p class="ac-empty">Nothing ${esc(String(label).toLowerCase())} just now.
      <button class="pf-link" data-odf="all" type="button">Show every order</button></p>`;
    return;
  }
  box.innerHTML = rows.map(odCard).join("");
}

/* ══════════════════════════════════════════════════════════
   LOADING
   ══════════════════════════════════════════════════════════ */
/* Fetched once per visit and kept, like the catalogue. Anything that changes
   an order — cancelling one, correcting an address — clears it rather than
   patching it, so what is drawn is always what the server says. */
function odPrime(){
  if(!SB_ON || !signedIn()) return Promise.resolve([]);
  if(odOrders || odLoading) return Promise.resolve(odOrders || []);
  odLoading = true;
  return loadOrders().then(rows => {
    odOrders = Array.isArray(rows) ? rows : [];
    odLoading = false;
    if(ordersOpen()) paintOrders();
    return odOrders;
  }).catch(err => {
    odLoading = false;
    if(ordersOpen()){
      $("#odIn").innerHTML = `<p class="ac-empty">Could not load your orders just now.</p>`;
    }
    throw err;
  });
}

/* ── the list is stale ──
   Called from everywhere an order changes: a payment lands, one is
   cancelled, an address is corrected, somebody signs out. One name for the
   idiom rather than "acctOrders = null" scattered across five files, and it
   redraws the page if the page happens to be the thing on screen. */
function forgetOrders(){
  odOrders = null;
  if(ordersOpen()){ paintOrders(); odPrime().catch(() => {}); }
}

const OD_TITLE = "Your orders — Ray Art Gallery";

function openOrders(fromHash){
  if(!SB_ON) return;
  if(!signedIn()){ openAcct(); return; }

  paintOrders();
  odEl.classList.add("on");
  odEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("od-on");
  odEl.scrollTop = 0;
  lock();
  if(!fromHash && location.hash !== "#orders") location.hash = "orders";
  document.title = OD_TITLE;
  odPrime().catch(() => {});
}

function hideOrders(){
  /* left by whatever door — the register no longer has anything to say */
  if(typeof pfSentTo !== "undefined") pfSentTo = null;
  odEl.classList.remove("on");
  odEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("od-on");
  if(!sheetOpen()){ $("#scrim").classList.remove("on"); unlock(); }
  document.title = "Ray Art Gallery — Handmade Rakhi";
}

function closeOrders(fromHash){
  if(!ordersOpen()) return;
  hideOrders();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function syncOrdersRoute(){
  if(location.hash === "#orders") openOrders(true);
  else if(ordersOpen()) hideOrders();
}
addEventListener("hashchange", syncOrdersRoute);

/* ══════════════════════════════════════════════════════════
   WIRING
   ══════════════════════════════════════════════════════════ */
fillBrandMark("#odHome .brand-mk-slot");
$("#odCart").onclick = () => openCart();
$("#odHome").onclick = e => { e.preventDefault(); closeOrders(); };
/* Back to the profile when the profile is what opened this, and out to the
   shop when anything else did. The wordmark is always the way out. */
$("#odBack").onclick = () => pfReturn("orders", closeOrders);

/* The chips live outside the repainting body so the one just pressed does
   not move under the thumb. Only the list below is redrawn. */
$("#odChips").addEventListener("click", e => {
  const c = e.target.closest("[data-odf]");
  if(!c) return;
  odFilter = c.dataset.odf;
  paintOrders();
  $("#odIn").scrollIntoView({block: "nearest"});
});

$("#odIn").addEventListener("click", e => {
  const f = e.target.closest("[data-odf]");
  if(f){ odFilter = f.dataset.odf; paintOrders(); return; }

  if(e.target.closest("[data-odclose]")){ closeOrders(); return; }

  const ov = e.target.closest("[data-oview]");
  if(ov){
    const id = ov.dataset.oview;
    closeOrders();
    requestAnimationFrame(() => openOrderPage(id));
    return;
  }

  const ag = e.target.closest("[data-oagain]");
  if(ag){
    const order = (odOrders || []).find(x => x.id === ag.dataset.oagain);
    if(order) buyTheseAgain(order);
    return;
  }
});

syncOrdersRoute();     /* #orders on a cold load */
