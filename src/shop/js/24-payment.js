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

const payIsCod = () => payWith !== "upi";

function paintPayBox(){
  const box = $("#payBox");
  if(!box) return;

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
        <b>Pay now by UPI</b>
        <span>We send the bill on WhatsApp with the UPI id.</span>
      </button>
    </div>`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-pay]");
  if(!b) return;
  payWith = b.dataset.pay === "upi" ? "upi" : "cod";
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
    btn.innerHTML = `<svg class="wa" width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.9.53 3.68 1.46 5.2L2 22l5.1-1.6a9.8 9.8 0 004.94 1.33c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2zm5.7 13.9c-.24.67-1.4 1.28-1.93 1.33-.53.06-1.02.1-1.75-.16-.73-.27-2.5-.98-4.28-3.1-1.4-1.67-1.62-2.9-1.7-3.4-.07-.5.2-1.35.55-1.7.35-.36.6-.4.83-.4h.5c.2 0 .4-.03.6.47.2.5.7 1.8.76 1.93.06.13.1.28 0 .45-.1.17-.34.44-.5.6-.16.15-.3.28-.15.55.14.27.6 1.06 1.3 1.7.9.83 1.6 1.1 1.87 1.23.27.14.43.12.6-.05.16-.16.66-.75.84-1 .18-.27.36-.22.6-.13.24.1 1.5.72 1.76.85.26.13.43.2.5.3.06.12.06.66-.18 1.34z"/></svg> Send the bill and pay`;
    if(hint && !placedBill) hint.textContent = "Opens Ray Art Gallery’s WhatsApp chat";
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
function showOrderDone(b){
  const ask = wa(`Hello Ray Art Gallery, about my order ${billNo}.`);
  $("#bill").innerHTML = `
    <div class="bill-done">
      <div class="done-tick" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
      </div>
      <b>Your order is in.</b>
      <p>${esc(billNo)} · ${inr(billTotal())} to pay when it arrives.</p>
      <p class="done-call"><b>We will call you to confirm it</b> on
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
}
