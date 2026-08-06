/* ══════════════════════════════════════════════════════════
   HOW THEY ARE PAYING

   Two ways, and neither of them is a chat any more.

   Pay now — Razorpay's own sheet, on this page: UPI, card,
   wallet or netbanking. The order is placed first and paid
   second, so there is always a bill number and always a row;
   the payment confirms the order by itself, in seconds, with
   nobody checking a phone.

   Cash on delivery — nothing is owed until the rakhi arrives.
   The seller can switch this off in Settings.

   Sending a bill to WhatsApp to be paid by hand is gone. It
   asked the customer to trust a UPI id typed into a chat and
   asked the seller to reconcile payments from memory. What is
   left of WhatsApp here is for asking questions, which is what
   it was always good at.
   ══════════════════════════════════════════════════════════ */
let payWith = "online";     // "online" | "cod"
let lastOrderId = null;     // the order just placed, so it can be paid for later

const canPayOnline = () => RZP_ON;
const canPayCash   = () => SHOP.codEnabled !== false;
const payIsCod     = () => payWith === "cod";

/* what is actually on offer, and what to fall back to if the seller has
   switched something off since this page was opened */
function payMethods(){
  const out = [];
  if(canPayOnline()) out.push("online");
  if(canPayCash())   out.push("cod");
  return out;
}
function settlePayWith(){
  const ways = payMethods();
  if(ways.length && !ways.includes(payWith)) payWith = ways[0];
}

function paintPayBox(){
  const box = $("#payBox");
  if(!box) return;
  settlePayWith();
  const ways = payMethods();

  if(!ways.length){
    box.innerHTML = `
      <div class="pay-k">Paying</div>
      <div class="pay-only warn">
        <b>No way to pay just now</b>
        <span>Card and UPI are being set up, and cash on delivery is switched
          off. Message us and we will take the order by hand.</span>
      </div>`;
    return;
  }

  /* one way of paying is a statement, not a question */
  if(ways.length === 1){
    const only = ways[0];
    box.innerHTML = `
      <div class="pay-k">Paying</div>
      <div class="pay-only">
        <b>${only === "online" ? "Card, UPI or netbanking" : "Cash on delivery"}</b>
        <span>${only === "online"
          ? "Paid on this page. Your order is confirmed the moment it goes through."
          : "Pay the courier when it reaches you. Nothing now."}</span>
        ${only === "online" ? secureLine() : ""}
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="pay-k">How would you like to pay?</div>
    <div class="pay-opts" role="radiogroup" aria-label="How would you like to pay?">
      <button type="button" class="pay-opt${payIsCod() ? "" : " on"}" data-pay="online"
              role="radio" aria-checked="${!payIsCod()}">
        <b>Pay now</b>
        <span>UPI, card, wallet or netbanking. Confirmed at once.</span>
        ${secureLine()}
      </button>
      <button type="button" class="pay-opt${payIsCod() ? " on" : ""}" data-pay="cod"
              role="radio" aria-checked="${payIsCod()}">
        <b>Cash on delivery</b>
        <span>Pay the courier when it reaches you. Nothing now.</span>
      </button>
    </div>`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pay]");
  if(!b) return;
  const want = b.dataset.pay;
  if(!payMethods().includes(want)) return;
  payWith = want;
  paintBill();
});

/* Said once, where the money is actually asked for. Not decoration: a small
   shop asking for a card number has to say who is holding it, and the honest
   answer is that we never see it — the sheet belongs to Razorpay and the
   card never touches this page. */
function secureLine(){
  return `<span class="pay-secure">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2"/>
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>
    Secured by Razorpay · we never see your card</span>`;
}

/* ── what the send button becomes ── */
function paintPayAction(){
  const btn = $("#billSend"), hint = $("#shHint");
  if(!btn) return;

  if(!payMethods().length){
    btn.innerHTML = "Not taking orders";
    btn.style.pointerEvents = "none";
    btn.style.opacity = ".55";
    if(hint && !placedBill) hint.textContent = "Message us and we will take it by hand";
    return;
  }
  btn.style.pointerEvents = "";
  btn.style.opacity = "";

  if(payIsCod()){
    btn.classList.add("cod");
    btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 12.5 9 17.5 20 6.5"/></svg> Place the order`;
    if(hint && !placedBill) hint.textContent = "Pay the courier when it arrives";
  }else{
    btn.classList.remove("cod");
    btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>
      Pay ${inr(billTotal())}`;
    if(hint && !placedBill) hint.textContent = "UPI, card or netbanking · secured by Razorpay";
  }
}

/* ── everything both journeys need before an order can exist ── */
function billReady(){
  const bad = Object.keys(F).filter(id => !ok(id, true));
  if(bad.length){ $("#" + bad[0]).focus(); toast("Fill name, phone, address, city, pincode"); return false; }
  if(ordersPaused()){ toast(shopPauseNote || "Not taking orders right now."); return false; }
  if(!signedIn()){ mustSignIn("place this order"); return false; }
  return true;
}
const billDetails = () => ({
  name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(),
  addr: $("#bAddr").value.trim(),  city: $("#bCity").value.trim(),
  pin:  $("#bPin").value.trim(),   note: $("#bNote").value.trim()
});

/* ── cash on delivery, which finishes here ── */
async function placeCodOrder(){
  if(!billReady()) return;

  const btn = $("#billSend");
  btn.classList.add("busy");
  btn.style.pointerEvents = "none";
  const restore = () => { btn.classList.remove("busy"); btn.style.pointerEvents = ""; };

  paintBill();
  const b = billDetails();
  try{
    const order = await recordOrder(b, "cod");
    if(!placedBill) throw new Error("not saved");
    lastOrderId = order && order.id;
    track("place_order", null, {items: nItems(), value: billTotal(), bill_no: billNo, payment: "cod"});
    flushTrack();
    showOrderDone(b);
  }catch(err){
    restore();
    toast("Could not place it just now. Try once more.");
  }
}

/* ── paying, which finishes on this page too ──
   The order goes in first. A sheet closed halfway then leaves an order
   waiting to be paid rather than money belonging to nothing, and that order
   can be paid later from the account. */
async function placeAndPay(){
  if(!billReady()) return;

  const btn = $("#billSend");
  btn.classList.add("busy");
  btn.style.pointerEvents = "none";
  const restore = () => { btn.classList.remove("busy"); btn.style.pointerEvents = ""; };

  const b = billDetails();
  let order;
  try{
    order = await recordOrder(b, "upi");
    if(!order || !order.id) throw new Error("not saved");
    lastOrderId = order.id;
  }catch(err){
    restore();
    toast("Could not place it just now. Try once more.");
    return;
  }

  track("place_order", null, {items: nItems(), value: billTotal(), bill_no: billNo, payment: "upi"});
  flushTrack();

  const paid = await payForOrder(order.id, {button: btn, onPaid: () => showOrderDone(b, true)});
  if(!paid){
    /* the order has been taken back out; put the bill back the way it was so
       they can simply press Pay again */
    restore();
    billNo = makeBillNo();
    paintBill();
  }
}

/* ── the screen after an order is in ── */
function showOrderDone(b, paidNow){
  const ask = wa(`Hello Ray Art Gallery, about my order ${billNo}.`);
  $("#bill").innerHTML = `
    <div class="bill-done">
      <div class="done-tick" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
      </div>
      <b>${paidNow ? "Paid — your order is confirmed." : "Your order is in."}</b>
      <p>${esc(billNo)} · ${inr(billTotal())}${paidNow ? " paid." : " to pay when it arrives."}</p>
      <p class="done-call"><b>We will call you</b> on
         ${esc($("#bPhone").value.trim() || "your number")}, usually the same day.
         Anything else — a change, a question, a design — message us on WhatsApp.</p>
      <div class="done-acts">
        <button class="btn btn-dark" id="doneOrders" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 6.5h16M4 12h16M4 17.5h10"/></svg>
          See my orders</button>
        <a class="btn btn-ghost" href="${esc(ask)}" target="_blank" rel="noopener">Message us</a>
        <button class="btn btn-ghost" id="donePdf" type="button">Save PDF copy</button>
      </div>
    </div>`;
  finishBillScreen(paidNow ? "Paid · " + billNo : "Saved to your account · " + billNo, "Done");
}

/* The housekeeping both end screens share. Everything that was for deciding
   is done deciding; leaving the payment chooser and the address fields on
   screen under a confirmation reads as though nothing happened. */
function finishBillScreen(hint, buttonText){
  ["#payBox", "#couponBox", "#pinBox", "#addrBox", "#addrFields"].forEach(sel => {
    const el = $(sel); if(el) el.hidden = true;
  });
  $$("#billModal .fg").forEach(el => { el.hidden = true; });

  $("#shTot").textContent = inr(billTotal());
  $("#shHint").textContent = hint;
  const send = $("#billSend");
  send.innerHTML = buttonText;
  send.classList.add("cod");
  send.style.pointerEvents = "none";
  send.style.opacity = ".55";
  $("#billPrint").hidden = true;

  const pdf = $("#donePdf");
  if(pdf) pdf.onclick = () => { downloadPdf(); toast("PDF saved to your phone"); };

  /* Straight to the list the order is now in. The bill closes first and the
     account opens on the next frame, because closing pops a history entry
     and opening in the same tick loses the one just pushed. */
  const seeOrders = () => { closeBill(); requestAnimationFrame(() => openAcct("orders")); };
  const orders = $("#doneOrders");
  if(orders) orders.onclick = seeOrders;
  const acct = $("#doneAcct");
  if(acct) acct.onclick = e => { e.preventDefault(); seeOrders(); };
}
