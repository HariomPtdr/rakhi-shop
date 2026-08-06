/* ══════════════════════════════════════════════════════════
   HOW THEY ARE PAYING

   Two genuinely different journeys, and the page should stop
   pretending they are one.

   Cash on delivery — nothing is owed until the rakhi arrives,
   so there is nothing to send anyone to WhatsApp for. The
   order is placed here, and that is the end of it.

   Pay now by UPI — money has to change hands and this shop has
   no payment gateway. So the bill goes to WhatsApp with the UPI
   id on it, which is where the payment actually happens.

   Cash is the default because it is the one that finishes
   without leaving the page, and because "nothing upfront" is
   what the shop has always promised.
   ══════════════════════════════════════════════════════════ */
let payWith = "cod";        // "cod" | "upi"
let lastOrderId = null;     // the order just placed, so it can be paid for later

const payIsCod = () => payWith !== "upi";

function paintPayBox(){
  const box = $("#payBox");
  if(!box) return;

  /* The seller can stop taking cash from Settings — a courier who collects
     it charges for the privilege, and that is a decision that changes with
     the season. With cash off there is nothing to choose between, so the
     shop says how it is paid for instead of pretending to ask. */
  if(!SHOP.codEnabled){
    payWith = "upi";
    box.innerHTML = `
      <div class="pay-k">How you will pay</div>
      <div class="pay-only">
        <b>${RZP_ON ? "Paid online" : "By UPI, on WhatsApp"}</b>
        <span>${RZP_ON
          ? "UPI, card, wallet or netbanking — whichever you like. The order is confirmed the moment the payment goes through."
          : "We send the bill with the UPI id. The order is confirmed the moment your payment reaches us — usually within the hour."}</span>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="pay-k">How would you like to pay?</div>
    <div class="pay-opts" role="radiogroup" aria-label="How would you like to pay?">
      <button type="button" class="pay-opt${payIsCod() ? " on" : ""}" data-pay="cod"
              role="radio" aria-checked="${payIsCod()}">
        <b>Cash on delivery</b>
        <span>Pay the courier when it reaches you. Nothing now.</span>
      </button>
      <button type="button" class="pay-opt${payIsCod() ? "" : " on"}" data-pay="upi"
              role="radio" aria-checked="${!payIsCod()}">
        <b>${RZP_ON ? "Pay now" : "Pay now by UPI"}</b>
        <span>${RZP_ON
          ? "UPI, card, wallet or netbanking. Confirmed the moment it goes through."
          : "We send the bill on WhatsApp. Confirmed once it reaches us."}</span>
      </button>
    </div>`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pay]");
  if(!b) return;
  const want = b.dataset.pay === "upi" ? "upi" : "cod";
  if(want === "cod" && !SHOP.codEnabled) return;
  payWith = want;
  paintBill();
});

/* ── what the send button becomes ── */
function paintPayAction(){
  const btn = $("#billSend"), hint = $("#shHint");
  if(!btn) return;

  if(payIsCod()){
    btn.classList.add("cod");
    btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 12.5 9 17.5 20 6.5"/></svg> Place the order`;
    if(hint && !placedBill) hint.textContent = "Pay the courier when it arrives";
  }else{
    btn.classList.remove("cod");
    if(RZP_ON){
      btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>
        Pay ${inr(billTotal())}`;
      if(hint && !placedBill) hint.textContent = "UPI, card or netbanking — confirmed at once";
    }else{
      btn.innerHTML = `<svg class="wa" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.9.53 3.68 1.46 5.2L2 22l5.1-1.6a9.8 9.8 0 004.94 1.33c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2zm5.7 13.9c-.24.67-1.4 1.28-1.93 1.33-.53.06-1.02.1-1.75-.16-.73-.27-2.5-.98-4.28-3.1-1.4-1.67-1.62-2.9-1.7-3.4-.07-.5.2-1.35.55-1.7.35-.36.6-.4.83-.4h.5c.2 0 .4-.03.6.47.2.5.7 1.8.76 1.93.06.13.1.28 0 .45-.1.17-.34.44-.5.6-.16.15-.3.28-.15.55.14.27.6 1.06 1.3 1.7.9.83 1.6 1.1 1.87 1.23.27.14.43.12.6-.05.16-.16.66-.75.84-1 .18-.27.36-.22.6-.13.24.1 1.5.72 1.76.85.26.13.43.2.5.3.06.12.06.66-.18 1.34z"/></svg> Send the bill and pay`;
      if(hint && !placedBill) hint.textContent = "Confirmed once your payment reaches us";
    }
  }
}

/* ── the cash journey, which finishes here ── */
async function placeCodOrder(){
  const bad = Object.keys(F).filter(id => !ok(id, true));
  if(bad.length){ $("#" + bad[0]).focus(); toast("Fill name, phone, address, city, pincode"); return; }
  if(ordersPaused()){ toast(shopPauseNote || "Not taking orders right now."); return; }
  if(!signedIn()){ mustSignIn("place this order"); return; }

  const btn = $("#billSend");
  btn.classList.add("busy");
  btn.style.pointerEvents = "none";
  const restore = () => { btn.classList.remove("busy"); btn.style.pointerEvents = ""; };

  paintBill();
  const b = {
    name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(),
    addr: $("#bAddr").value.trim(),  city: $("#bCity").value.trim(),
    pin:  $("#bPin").value.trim(),   note: $("#bNote").value.trim()
  };

  try{
    await recordOrder(b, "cod");
    if(!placedBill) throw new Error("not saved");
    track("place_order", null, {items: nItems(), value: billTotal(), bill_no: billNo, payment: "cod"});
    flushTrack();
    showOrderDone(b);
  }catch(err){
    restore();
    toast("Could not place it just now. Try once more, or send it on WhatsApp.");
  }
}

/* what they see instead of being thrown at WhatsApp */
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
      <p class="done-call"><b>${paidNow ? "We will call you about it" : "We will call you to confirm it"}</b> on
         ${esc($("#bPhone").value.trim() || "your number")}, usually the same day.
         Anything else — a change, a question, a design — message us on WhatsApp.
         You can follow it in <a href="#account" id="doneAcct">your orders</a>.</p>
      <div class="done-acts">
        <a class="btn btn-dark" href="${esc(ask)}" target="_blank" rel="noopener">
          <svg class="wa" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.9.53 3.68 1.46 5.2L2 22l5.1-1.6a9.8 9.8 0 004.94 1.33c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2zm5.7 13.9c-.24.67-1.4 1.28-1.93 1.33-.53.06-1.02.1-1.75-.16-.73-.27-2.5-.98-4.28-3.1-1.4-1.67-1.62-2.9-1.7-3.4-.07-.5.2-1.35.55-1.7.35-.36.6-.4.83-.4h.5c.2 0 .4-.03.6.47.2.5.7 1.8.76 1.93.06.13.1.28 0 .45-.1.17-.34.44-.5.6-.16.15-.3.28-.15.55.14.27.6 1.06 1.3 1.7.9.83 1.6 1.1 1.87 1.23.27.14.43.12.6-.05.16-.16.66-.75.84-1 .18-.27.36-.22.6-.13.24.1 1.5.72 1.76.85.26.13.43.2.5.3.06.12.06.66-.18 1.34z"/></svg>
          Chat on WhatsApp</a>
        <button class="btn btn-ghost" id="donePdf" type="button">Save PDF copy</button>
      </div>
    </div>`;
  /* Everything that was for deciding is done deciding. Leaving the payment
     chooser, the code box and the address fields on screen under a
     confirmation reads as though the order did not really go through. */
  ["#payBox", "#couponBox", "#pinBox", "#addrBox", "#addrFields"].forEach(sel => {
    const el = $(sel); if(el) el.hidden = true;
  });
  $$("#billModal .fg").forEach(el => { el.hidden = true; });

  $("#shTot").textContent = inr(billTotal());
  $("#shHint").textContent = "Saved to your account · " + billNo;
  const send = $("#billSend");
  send.innerHTML = "Done";
  send.classList.add("cod");
  send.style.pointerEvents = "none";
  send.style.opacity = ".55";
  $("#billPrint").hidden = true;

  const pdf = $("#donePdf");
  if(pdf) pdf.onclick = () => { downloadPdf(); toast("PDF saved to your phone"); };
  const acct = $("#doneAcct");
  if(acct) acct.onclick = e => { e.preventDefault(); closeBill(); requestAnimationFrame(() => openAcct("orders")); };
  const again = $("#donePayNow");
  if(again && lastOrderId) again.onclick = () => payForOrder(lastOrderId, {
    onPaid: () => showOrderDone(b, true)
  });
}

/* ── the UPI journey, which finishes on WhatsApp ──
   The chat opens either way; this is what is behind it when they come back.
   Saying "sent" and nothing else leaves someone wondering whether they have
   ordered anything at all — and with no gateway here, they have not, until
   the money arrives and the seller says so. */
function showPaymentSent(b, viaGateway){
  const ask = wa(`Hello Ray Art Gallery, about paying for my order ${billNo}.`);
  $("#bill").innerHTML = `
    <div class="bill-done">
      <div class="done-tick wait" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>
      </div>
      <b>${viaGateway ? "Your order is waiting to be paid." : "Your bill is on WhatsApp."}</b>
      <p>${esc(billNo)} · ${inr(billTotal())} to pay.</p>
      <p class="done-call">${viaGateway
        ? `<b>Nothing has been charged.</b> The order is saved and waiting — pay it
           whenever you like from <a href="#account" id="doneAcct">your orders</a>,
           and it is confirmed the moment the payment goes through.`
        : `<b>Pay in the chat</b>, and the order is confirmed the moment it reaches
           us — usually within the hour. Nothing is made before that, so nothing is
           lost if you change your mind.
           You can follow it in <a href="#account" id="doneAcct">your orders</a>.`}</p>
      <div class="done-acts">
        ${viaGateway
          ? `<button class="btn btn-dark" id="donePayNow" type="button">Pay now</button>`
          : `<a class="btn btn-dark" href="${esc(ask)}" target="_blank" rel="noopener">
               Open the chat again</a>`}
        <button class="btn btn-ghost" id="donePdf" type="button">Save PDF copy</button>
      </div>
    </div>`;

  ["#payBox", "#couponBox", "#pinBox", "#addrBox", "#addrFields"].forEach(sel => {
    const el = $(sel); if(el) el.hidden = true;
  });
  $$("#billModal .fg").forEach(el => { el.hidden = true; });

  $("#shTot").textContent = inr(billTotal());
  $("#shHint").textContent = "Waiting for your payment · " + billNo;
  const send = $("#billSend");
  send.innerHTML = "Sent";
  send.style.pointerEvents = "none";
  send.style.opacity = ".55";
  $("#billPrint").hidden = true;

  const pdf = $("#donePdf");
  if(pdf) pdf.onclick = () => { downloadPdf(); toast("PDF saved to your phone"); };
  const acct = $("#doneAcct");
  if(acct) acct.onclick = e => { e.preventDefault(); closeBill(); requestAnimationFrame(() => openAcct("orders")); };
}

/* ── the gateway journey ──
   The order goes in first and is paid second. So there is always a bill
   number and always a row, and a payment sheet closed halfway leaves an
   order waiting rather than money belonging to nothing. */
async function placeAndPay(){
  const bad = Object.keys(F).filter(id => !ok(id, true));
  if(bad.length){ $("#" + bad[0]).focus(); toast("Fill name, phone, address, city, pincode"); return; }
  if(ordersPaused()){ toast(shopPauseNote || "Not taking orders right now."); return; }
  if(!signedIn()){ mustSignIn("place this order"); return; }

  const btn = $("#billSend");
  btn.classList.add("busy");
  btn.style.pointerEvents = "none";
  const restore = () => { btn.classList.remove("busy"); btn.style.pointerEvents = ""; };

  const b = {
    name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(),
    addr: $("#bAddr").value.trim(),  city: $("#bCity").value.trim(),
    pin:  $("#bPin").value.trim(),   note: $("#bNote").value.trim()
  };

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

  const paid = await payForOrder(order.id, {
    onPaid: () => { showOrderDone(b, true); }
  });
  if(!paid){
    /* the order is real and waiting — say so rather than leaving them
       staring at a sheet that has closed */
    showPaymentSent(b, true);
  }
}
