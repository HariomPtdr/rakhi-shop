/* ══════════════════════════════════════════════════════════
   ONE ORDER, ITS OWN PAGE

   The list in the account is a list: enough to recognise an
   order by, not enough to answer a question about it. Anything
   worth knowing — what was in it, what it cost, where it is
   going, what has happened to it, what we have said about it —
   was either squeezed into a card or not there at all.

   So the card keeps one job, recognising, and gains a button.
   This is what the button opens: everything about one order, in
   the order somebody actually wants it. Where it is, then what
   is in it, then where it is going, then what was paid, then
   every word that has passed between us about it.

   It is a hash route like the product page, so it can be shared,
   reloaded and reached with the back button.
   ══════════════════════════════════════════════════════════ */
let opOrder  = null;      // the order being shown
let opNotes  = [];        // everything said about it
let opBusy   = false;

const orderPageOpen = () => isOn("#op");

/* replaceState rather than setting location.hash.
   The account sheet closes itself with history.back(), which pops
   asynchronously — and a hash pushed in the meantime is exactly what that
   pop throws away. Replacing the entry instead means the address bar still
   says which order this is, and can still be shared or reloaded, without
   putting an entry in the way of a sheet that is already unwinding one. */
function openOrderPage(id){
  if(!id) return;
  if(location.hash !== "#order/" + id){
    history.replaceState(null, "", "#order/" + id);
  }
  showOrderPage(id);
}

async function showOrderPage(id){
  opBusy = true;
  $("#op").classList.add("on");
  $("#op").setAttribute("aria-hidden", "false");
  /* It is its own scrolling box, and a box keeps where it was left. Opened
     from halfway down the account list it would open halfway down the order —
     under the bar, mid-sentence. Every order starts at its own top. */
  $("#op").scrollTop = 0;
  document.body.style.overflow = "hidden";
  $("#opIn").innerHTML = `<p class="ac-empty">Loading…</p>`;

  if(!signedIn()){
    $("#opIn").innerHTML = `<p class="ac-empty">Sign in to see this order.</p>`;
    opBusy = false;
    return;
  }

  try{
    const rows = await SB.rest("orders?select=*,order_items(name,qty,price,product_id)"
                             + "&id=eq." + encodeURIComponent(id) + "&limit=1");
    opOrder = (Array.isArray(rows) && rows[0]) || null;
  }catch(e){ opOrder = null; }

  if(!opOrder){
    $("#opIn").innerHTML = `<p class="ac-empty">That order is not here.</p>`;
    opBusy = false;
    return;
  }

  /* everything said about this order, in one place: the automatic notes
     about it moving along, and anything the shop wrote by hand */
  try{
    opNotes = await SB.rest("notifications?select=id,kind,title,body,created_at"
                          + "&order_id=eq." + encodeURIComponent(id)
                          + "&order=created_at.desc") || [];
  }catch(e){ opNotes = []; }

  opBusy = false;
  paintOrderPage();
  $("#op").scrollTop = 0;      /* again: the real content is taller than "Loading…" */
}

function closeOrderPage(){
  if(!orderPageOpen()) return;
  $("#op").classList.remove("on");
  $("#op").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if(/^#order\//.test(location.hash)){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/* ── the tracker, big enough to read ── */
function opTrack(o){
  if(o.status === "cancelled"){
    return `<div class="op-track cancelled"><span class="ac-chip no">Cancelled</span>
      <p>${esc(o.cancel_reason || "This order will not be sent.")}</p></div>`;
  }
  const at = STATUS[o.status] ? STATUS[o.status].step : 0;
  return `<div class="op-track">${STATUS_FLOW.map((s, i) => `
    <div class="op-step${i <= at ? " done" : ""}${i === at ? " now" : ""}">
      <i aria-hidden="true"></i>
      <b>${STATUS[s].label}</b>
      <span>${i === at ? STATUS[s].hint : ""}</span>
    </div>`).join("")}</div>`;
}

function paintOrderPage(){
  const o = opOrder;
  if(!o) return;
  const items = o.order_items || [];
  const paidLine = o.payment === "upi"
    ? (o.paid_at ? "Paid online · " + agoText(o.paid_at) : "Not paid")
    : "Cash on delivery · " + inr(o.total) + " to the courier";
  const canCancel = o.status === "placed" || o.status === "confirmed";
  const ask = wa(`Hello Ray Art Gallery, about my order ${o.bill_no}.`);
  const messages = opNotes.filter(n => n.kind === "message");
  const updates  = opNotes.filter(n => n.kind !== "message");

  $("#opIn").innerHTML = `
    <div class="op-head">
      <div>
        <span class="op-no">${esc(o.bill_no)}</span>
        <h1>${esc(STATUS[o.status] ? STATUS[o.status].label : o.status)}</h1>
        <p>${esc(dayText(o.created_at))} · ${items.length} ${plural(items.length, "rakhi")}</p>
      </div>
      <span class="op-total">${inr(o.total)}</span>
    </div>

    ${opTrack(o)}

    ${o.tracking_id && o.status !== "cancelled" ? `
      <div class="op-trk">
        <div><b>${esc(o.courier || "Courier")}</b><span>${esc(o.tracking_id)}</span></div>
        <button class="btn btn-ghost btn-sm" data-copy="${esc(o.tracking_id)}">Copy</button>
      </div>` : ""}

    <div class="op-k">What is in it</div>
    <div class="op-items">
      ${items.map(i => {
        const p = i.product_id ? catalogue(i.product_id) : null;
        return `<div class="op-item">
          <span class="op-shot">${p ? thumb(p) : ""}</span>
          <div>
            <b>${esc(i.name)}</b>
            <span>${i.qty} × ${inr(i.price)}</span>
          </div>
          <span class="op-amt">${inr(i.price * i.qty)}</span>
        </div>`;
      }).join("")}
    </div>

    <div class="op-sums">
      <div class="line"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>
      ${o.discount ? `<div class="line"><span>Discount${
        o.coupon_code ? " (" + esc(o.coupon_code) + ")" : ""}</span>
        <span>− ${inr(o.discount)}</span></div>` : ""}
      <div class="line"><span>Delivery</span><span>${o.shipping ? inr(o.shipping) : "Free"}</span></div>
      <div class="line tot"><span>Total</span><span>${inr(o.total)}</span></div>
      <div class="line"><span>Payment</span><span>${esc(paidLine)}</span></div>
    </div>

    <div class="op-k">Going to</div>
    <div class="op-to">
      <b>${esc(o.name)}</b>
      <p>${esc(o.address)}<br>${esc(o.city)} — ${esc(o.pincode)}</p>
      <span class="mono">${esc(o.phone)}</span>
      ${o.note ? `<p class="op-note">“${esc(o.note)}”</p>` : ""}
      ${canCancel ? `<button class="op-link" data-editaddr="${esc(o.id)}">Change the address</button>` : ""}
    </div>
    ${editingAddr === o.id ? addrForm(o) : ""}

    ${messages.length ? `
      <div class="op-k">From Ray Art Gallery</div>
      <div class="op-msgs">
        ${messages.map(m => `<div class="op-msg">
          <p>${esc(m.body || m.title)}</p>
          <span>${esc(dayTimeText(m.created_at))}</span>
        </div>`).join("")}
      </div>` : ""}

    <div class="op-k">What has happened</div>
    <div class="hist op-hist">
      ${updates.length ? updates.slice().reverse().map(n => `
        <div class="hev"><i></i><div>
          <b>${esc(n.title)}</b>
          <span>${esc(dayTimeText(n.created_at))}${n.body ? " · " + esc(n.body) : ""}</span>
        </div></div>`).join("")
      : `<div class="hev"><i></i><div>
           <b>Order placed</b><span>${esc(dayTimeText(o.created_at))}</span></div></div>`}
    </div>

    ${cancelling === o.id ? cancelForm(o) : ""}

    <div class="op-acts">
      ${items.some(i => i.product_id)
        ? `<button class="btn btn-dark" data-opagain="1">Buy these again</button>` : ""}
      <button class="btn btn-ghost" data-opbill="1">Download the bill</button>
      ${o.status === "delivered" && items.some(i => i.product_id)
        ? `<button class="btn btn-ghost" data-oprate="${esc(items.find(i => i.product_id).product_id)}"
            >Rate what arrived</button>` : ""}
      <a class="btn btn-ghost" href="${esc(ask)}" target="_blank" rel="noopener">Ask about it</a>
      ${canCancel ? `<button class="btn btn-ghost op-cancel" data-cancel="${esc(o.id)}">Cancel this order</button>` : ""}
    </div>`;
}

/* ── the way in and out ── */
$("#opBack").onclick = () => {
  /* back to the orders list they came from, not to the shop */
  closeOrderPage();
  requestAnimationFrame(() => openAcct("orders"));
};

$("#opIn").addEventListener("click", async e => {
  const copy = e.target.closest("[data-copy]");
  if(copy){
    try{ await navigator.clipboard.writeText(copy.dataset.copy); toast("Tracking id copied"); }
    catch(err){ toast("Could not copy"); }
    return;
  }
  if(e.target.closest("[data-opbill]")){ downloadOrderBill(opOrder); return; }
  if(e.target.closest("[data-opagain]")){ buyTheseAgain(opOrder); return; }

  const rate = e.target.closest("[data-oprate]");
  if(rate){ closeOrderPage(); requestAnimationFrame(() => openProduct(rate.dataset.oprate)); return; }

  /* Changing the address, attaching a location and calling the order off all
     happen here now. The forms and the rules behind them are the ones the
     account already used — only the surface they are drawn on has moved. */
  const addr = e.target.closest("[data-editaddr]");
  if(addr){ editingAddr = addr.dataset.editaddr; paintOrderPage(); return; }
  if(e.target.closest("[data-addrno]")){ editingAddr = null; paintOrderPage(); return; }
  const ay = e.target.closest("[data-addryes]");
  if(ay){ await saveOrderAddress(ay.dataset.addryes); return; }

  const op = e.target.closest("[data-orderpin]");
  if(op){ await pinThisOrder(op.dataset.orderpin); return; }
  const pp = e.target.closest("[data-pastepin]");
  if(pp){ await pastePinFor(pp.dataset.pastepin); return; }

  const cx = e.target.closest("[data-cancel]");
  if(cx){ cancelling = cx.dataset.cancel; cancelWhy = 0; paintOrderPage(); return; }
  if(e.target.closest("[data-cancelno]")){ cancelling = null; paintOrderPage(); return; }
  const cy = e.target.closest("[data-cancelyes]");
  if(cy){ await doCancel(cy.dataset.cancelyes); return; }

  const why = e.target.closest("[data-why]");
  if(why){
    cancelWhy = CANCEL_REASONS.indexOf(why.dataset.why);
    [...why.parentElement.children].forEach((b, i) => {
      b.classList.toggle("on", i === cancelWhy);
      b.setAttribute("aria-checked", String(i === cancelWhy));
    });
  }
});

/* Both the account and this page can be the thing on screen when an order
   changes, so whichever it is gets repainted rather than each caller
   guessing. */
async function orderChanged(){
  acctOrders = null;
  if(orderPageOpen() && opOrder) await showOrderPage(opOrder.id);
  if(isOn("#acctModal")){ paintAcct(); loadAcctData(); }
}

/* A cold load of #order/<id> — a shared link, a reload, a bookmark — opens
   it. Nothing else listens on the hash: the page is opened and closed by its
   own buttons, and hooking hashchange here only made it fight the sheets. */
function syncOrderRoute(){
  const m = /^#order\/([\w-]+)$/.exec(location.hash);
  if(m) showOrderPage(m[1]);
}
syncOrderRoute();     /* honour #order/<id> on a cold load, as the product page does */

/* ── the bill, months later ──
   The copy saved at the till is on somebody's phone somewhere. This is the
   same document, drawn by the same shared builder the shop and the dashboard
   both use, from the order as the database has it — so it is right even if
   the address was corrected afterwards. */
function downloadOrderBill(o){
  if(!o) return;
  const items = o.order_items || [];
  savePdfFile(billPdfFile({
    billNo: o.bill_no,
    date:   new Date(o.created_at).toLocaleDateString("en-IN",
              {day: "2-digit", month: "short", year: "numeric"}),
    lines:  items.map(i => ({name: i.name, qty: i.qty, price: i.price})),
    subtotal: o.subtotal,
    discount: o.discount || 0,
    discountCode: o.coupon_code || "",
    shipping: o.shipping,
    total:  o.total,
    to: {name: o.name, addr: o.address, city: o.city, pin: o.pincode,
         phone: o.phone, note: o.note},
    footer: [
      o.payment === "upi"
        ? (o.paid_at ? "Paid online." : "To be paid online.")
        : "Cash on delivery - " + inr(o.total) + " to the courier.",
      "An order summary, not a tax invoice. Amounts in INR."
    ]
  }, "RayArtGallery-" + o.bill_no + ".pdf"));
  toast("Bill saved to your phone");
}

/* ── the same rakhis, again ──
   At today's prices and only what is still made: a basket quietly filled
   with last year's price is a worse surprise than being told the price has
   changed. Anything gone from the shop is said out loud rather than
   silently dropped. */
function buyTheseAgain(o){
  if(!o) return;
  const items = o.order_items || [];
  let added = 0, gone = 0, out = 0;

  items.forEach(i => {
    const p = i.product_id ? catalogue(i.product_id) : null;
    if(!p){ gone++; return; }
    if(p.stock === 0){ out++; return; }
    const row = cart.find(r => r.id === p.id);
    if(row) row.qty = Math.min(MAX_QTY, row.qty + i.qty);
    else cart.push({id: p.id, name: p.name, price: p.price,
                    qty: Math.min(MAX_QTY, i.qty), note: ""});
    added++;
  });

  if(!added){
    toast(out ? "Those are sold out just now." : "Those are not in the shop any more.");
    return;
  }
  save();
  paintCart(true);
  if(typeof pushCart === "function") pushCart();

  const missing = gone + out;
  toast(added + " " + plural(added, "rakhi") + " in your basket"
      + (missing ? " — " + missing + " no longer available" : ""));

  if(orderPageOpen()){
    closeOrderPage();
    requestAnimationFrame(() => openCart());
  }else if(isOn("#acctModal") && sheetHist){
    addEventListener("popstate", () => openCart(), {once: true});
    closeAcct();
  }else{
    closeAcct();
    openCart();
  }
}
