/* ══════════════════════════════════════════════════════════
   The bill as a PDF, and getting it to WhatsApp.

   A wa.me link can only pre-fill text — nothing on the web can
   attach a file to a WhatsApp chat through it. The Web Share API
   can, by handing the file to the phone's own share sheet, so
   that is what the button uses when the browser supports it.

   The document itself is drawn in shared/04-billpdf.js, which
   the dashboard uses too: the seller's copy has to be the same
   piece of paper the customer got.
   ══════════════════════════════════════════════════════════ */

/* what is on screen, as the plain object the drawer wants */
function billForPdf(){
  return {
    billNo: billNo,
    date:   today(),
    lines:  cart.map(r => ({name: r.name, qty: r.qty, price: r.price, note: r.note})),
    subtotal: sub(),
    discount: couponDiscount(),
    discountCode: coupon.code,
    shipping: shipNow(),
    total:  billTotal(),
    to: {
      name: $("#bName").value.trim(), addr: $("#bAddr").value.trim(),
      city: $("#bCity").value.trim(), pin:  $("#bPin").value.trim(),
      phone: $("#bPhone").value.trim(), note: $("#bNote").value.trim()
    },
    footer: [
      `Payment - UPI to ${SHOP.upi}, or cash on delivery.`,
      "An order summary, not a tax invoice. Amounts in INR."
    ]
  };
}

const pdfName = () => `RayArtGallery-${billNo}.pdf`;
function pdfFile(){ return billPdfFile(billForPdf(), pdfName()); }
function downloadPdf(file){ savePdfFile(file || pdfFile()); }

$("#toBill").onclick=()=>{
  if(!cart.length) return;
  if(ordersPaused()){
    toast(shopPauseNote || "We have stopped taking orders for a few days.");
    return;
  }
  billNo = makeBillNo();
  placedBill = "";
  payWith = "cod";      /* a new bill starts on cash again */
  addrMode = "saved";   /* and on the address they usually use */
  $("#billPrint").hidden = false;
  $("#billSend").style.pointerEvents = "";
  $("#billSend").style.opacity = "";
  /* everything the finished-order screen hid, back again — miss one here and
     the next bill opens with no address fields on it */
  ["#payBox", "#couponBox", "#pinBox", "#addrBox", "#addrFields"].forEach(sel => {
    const el = $(sel); if(el) el.hidden = false;
  });
  $$("#billModal .fg").forEach(el => { el.hidden = false; });
  $("#shHint").textContent = "Opens Ray Art Gallery’s WhatsApp chat";
  if(typeof fillBillFromProfile === "function") fillBillFromProfile();
  /* hand over from the cart to the bill: hide one, show the other.
     The body stays locked and history stays put, so nothing can
     race in and shut the bill again. */
  $("#drawer").classList.remove("on");
  openSheet("#billModal");
  paintBill();
  track("begin_checkout", null, {items: nItems(), value: billTotal()});
  recheckCoupon();
  /* don't autofocus on a phone — it throws the keyboard over the bill */
  if(matchMedia("(min-width:720px)").matches) $("#bName").focus();
};
function closeBill(fromBack){
  if(!isOn("#billModal")) return;
  $("#billModal").classList.remove("on");
  afterClose(fromBack);
  /* The order is on the record now, so the basket has done its job. Emptied
     on the way out rather than the moment they press send, so the PDF and
     the bill on screen stay intact while the sheet is still open. */
  if(placedBill){
    placedBill = "";
    clearCoupon();                 /* a code is spent with the order */
    cart = [];
    save(); paintCart();
  }
}
$("#billClose").onclick=()=>closeBill();
$("#billModal").addEventListener("click", e=>{ if(e.target.id==="billModal") closeBill(); });
/* a copy for the customer's own records — attachable in the chat if they want */
$("#billPrint").onclick=()=>{
  const bad=Object.keys(F).filter(id=>!ok(id,true));
  if(bad.length){ $("#"+bad[0]).focus(); toast("Fill your details first"); return; }
  paintBill(); downloadPdf(); toast("PDF saved to your phone");
};

/* Send the order to the shop.
   -------------------------------------------------------------
   This is a plain wa.me link to SHOP.whatsapp, so the order always
   lands in Ray Art Gallery's own chat — the customer never chooses
   a destination and it cannot be sent to the wrong person.

   The trade-off is deliberate: a wa.me link carries text only. The
   share sheet could attach the PDF, but it lets the customer pick
   any app or contact, which means orders would go astray. Reaching
   the shop matters more than the attachment, so the whole bill is
   written into the message instead, and the PDF stays available
   next to it as a saved copy.
   ------------------------------------------------------------- */
$("#billSend").addEventListener("click", e=>{
  /* Cash on delivery finishes here. Nothing is owed until the rakhi
     arrives, so there is nothing to send anyone to WhatsApp for. */
  if(payIsCod()){
    e.preventDefault();
    if(placedBill) return;              /* already placed; do not double it */
    placeCodOrder();
    return;
  }

  /* With a gateway configured, paying does not leave the page at all:
     the order goes in and the payment sheet opens on top of it. */
  if(RZP_ON){
    e.preventDefault();
    if(placedBill) return;
    placeAndPay();
    return;
  }

  const bad=Object.keys(F).filter(id=>!ok(id,true));
  if(bad.length){
    e.preventDefault(); $("#"+bad[0]).focus();
    toast("Fill name, phone, address, city, pincode"); return;
  }
  if(ordersPaused()){
    e.preventDefault();
    toast(shopPauseNote || "Not taking orders right now."); return;
  }
  /* refresh the message, then let the link open the shop's chat */
  paintBill();
  track("place_order", null, {items: nItems(), value: billTotal(), bill_no: billNo, payment: "upi"});
  flushTrack();                 /* the tab is about to lose focus to WhatsApp */
  /* and, for a signed-in customer, keep a copy of the order they can look
     up later. Never in the way: the chat opens either way. */
  if(typeof recordOrder === "function"){
    const b = {
      name:$("#bName").value.trim(), phone:$("#bPhone").value.trim(),
      addr:$("#bAddr").value.trim(),  city:$("#bCity").value.trim(),
      pin:$("#bPin").value.trim(),    note:$("#bNote").value.trim()
    };
    recordOrder(b, "upi");
    /* and behind the chat, something that says what happens next. The order
       exists but is not confirmed: no gateway here, so the seller confirms
       it when the money actually arrives. */
    showPaymentSent(b);
  }
});

$("#shareLink").onclick=e=>{
  e.preventDefault();
  const text=`Handmade rakhis from Ray Art Gallery — ${location.href}`;
  if(navigator.share) navigator.share({title:"Ray Art Gallery", text}).catch(()=>{});
  else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
};

/* ── the decoration, after the shop ──
   Two 400×400 rangoli, five dividers of about sixty nodes each and the four
   step icons: none of it is the reason anyone opened the page, and all of it
   used to be drawn before the first paint. The two mandalas were measured as
   the largest thing painted on the screen — the browser was waiting for
   decoration to decide the page had loaded.

   Now the rakhis paint first and the ornament arrives on the next idle
   moment. On a phone that is the difference between a page that appears and
   a page that hangs. The strips are one painted background rather than five
   copies of a sixty-node SVG, which takes ~300 elements out of the document
   and off every later layout pass. */
function paintOrnament(){
  $("#m1").style.backgroundImage = asBg(rangoli("#9C7620"));
  $("#m2").style.backgroundImage = asBg(rangoli("#1B8497"));
  /* the strips are drawn as you reach them. Five of them at sixty nodes
     each is three hundred elements in every layout pass, for a rule between
     sections that nobody has scrolled to yet. */
  const strip = rangoliStrip();
  const near = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if(!en.isIntersecting) return;
      en.target.innerHTML = strip;
      obs.unobserve(en.target);
      io.observe(en.target);          /* and the existing one draws it in */
    });
  }, {rootMargin: "250px"});
  $$(".divider.rangoli").forEach(d => near.observe(d));
  Object.keys(STEP_ICONS).forEach(id => { const el = $("#" + id); if(el) el.innerHTML = STEP_ICONS[id]; });
}
if("requestIdleCallback" in window) requestIdleCallback(paintOrnament, {timeout: 1800});
else setTimeout(paintOrnament, 300);
