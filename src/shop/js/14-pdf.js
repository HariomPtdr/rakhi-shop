/* ══════════════════════════════════════════════════════════
   The bill as a PDF.

   A wa.me link can only pre-fill text — nothing on the web can
   attach a file to a WhatsApp chat through it. The Web Share API
   can, by handing the file to the phone's own share sheet, so
   that is what the button uses when the browser supports it.

   The PDF is written by hand here. It uses only the fonts every
   PDF reader already has built in, so there is nothing to load
   and the page still makes zero network requests. Those fonts
   have no rupee glyph, so the PDF says "Rs." — the WhatsApp text
   still uses ₹.
   ══════════════════════════════════════════════════════════ */
const PDF = {
  W: 420, H: 595, M: 34,          // A5 portrait, in points
  cw: 0.6,                        // Courier: every glyph is 0.6em wide
  /* the built-in fonts are WinAnsi — keep to characters they have */
  safe(t){
    return String(t)
      .replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"').replace(/·/g, "-").replace(/№/g, "No.")
      .replace(/[^\x20-\x7E]/g, "");
  },
  esc(t){ return t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); },
  wrap(t, chars){
    const words = this.safe(t).split(/\s+/), lines = []; let cur = "";
    for(const w of words){
      if(!cur.length) cur = w;
      else if((cur + " " + w).length <= chars) cur += " " + w;
      else { lines.push(cur); cur = w; }
    }
    if(cur.length) lines.push(cur);
    return lines.length ? lines : [""];
  }
};

/* lay the bill out and return the finished PDF as a string of bytes */
function billPdf(){
  const { W, H, M, cw } = PDF;
  const ops = [];
  let y = H - M - 6;

  const put = (t, x, size, bold) => {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${PDF.esc(PDF.safe(t))}) Tj ET`);
  };
  const wide   = (t, size, bold) => (bold ? 0.58 : cw) * size * PDF.safe(t).length;
  const right  = (t, xr, size, bold) => put(t, xr - wide(t, size, bold), size, bold);
  const centre = (t, size, bold) => put(t, (W - wide(t, size, bold)) / 2, size, bold);
  const rule   = dashed => ops.push(`${dashed ? "[2 2] 0 d" : "[] 0 d"} 0.7 w ${M} ${y.toFixed(1)} m ${W - M} ${y.toFixed(1)} l S`);
  const gap    = n => { y -= n; };

  /* columns, measured from the right edge */
  const xAmt = W - M, xRate = W - M - 58, xQty = W - M - 104, itemChars = 34;

  centre("RAY ART GALLERY", 17, true);           gap(13);
  centre("HANDMADE RAKHI - ORDER SUMMARY", 7);   gap(11);
  rule(true);                                    gap(14);
  put(`Bill No: ${billNo}`, M, 8.5);
  right(`Date: ${today()}`, xAmt, 8.5);          gap(18);

  put("ITEM", M, 7);
  right("QTY", xQty, 7); right("RATE", xRate, 7); right("AMOUNT", xAmt, 7);
  gap(5); rule(false); gap(12);

  cart.forEach((r, i) => {
    const lines = PDF.wrap(`${two(i + 1)}. ${r.name}`, itemChars);
    put(lines[0], M, 8.5);
    right(String(r.qty), xQty, 8.5);
    right(inr(r.price), xRate, 8.5);
    right(inr(r.price * r.qty), xAmt, 8.5);
    for(let k = 1; k < lines.length; k++){ gap(10); put("    " + lines[k], M, 8.5); }
    if(r.note) PDF.wrap(r.note, itemChars + 4).forEach(l => { gap(10); put("    " + l, M, 7.5); });
    gap(13);
  });

  gap(1); rule(true); gap(14);
  put("Subtotal", M, 8.5);       right(inr(sub()), xAmt, 8.5);   gap(12);
  if(couponDiscount()){
    put(`Discount (${coupon.code})`, M, 8.5);
    right("-" + inr(couponDiscount()), xAmt, 8.5);               gap(12);
  }
  put("Delivery", M, 8.5);
  right(shipNow() === 0 ? "FREE" : inr(shipNow()), xAmt, 8.5);   gap(6);
  rule(false); gap(15);
  put("TOTAL PAYABLE", M, 11, true);
  right(inr(billTotal()), xAmt, 11, true);                       gap(20);
  rule(true); gap(15);

  const b = {
    name: $("#bName").value.trim(), phone: $("#bPhone").value.trim(),
    addr: $("#bAddr").value.trim(), city: $("#bCity").value.trim(),
    pin:  $("#bPin").value.trim(),  note: $("#bNote").value.trim()
  };
  put("DELIVER TO", M, 7);                                       gap(13);
  [b.name, ...PDF.wrap(b.addr, 46), `${b.city} ${b.pin}`.trim(), `Phone: ${b.phone}`]
    .filter(Boolean).forEach(l => { put(l, M, 8.5); gap(11); });
  if(b.note){ gap(4); PDF.wrap("Note: " + b.note, 46).forEach(l => { put(l, M, 8.5); gap(11); }); }

  gap(6); rule(true); gap(12);
  put(`Payment - UPI to ${SHOP.upi}, or cash on delivery.`, M, 7); gap(9);
  put("An order summary, not a tax invoice. Amounts in INR.", M, 7);

  /* assemble the file; everything above is ASCII, so length == bytes */
  const stream = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  ];
  let pdf = "%PDF-1.4\n";
  const at = [];
  objs.forEach((o, i) => { at.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  at.forEach(off => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

const pdfName = () => `RayArtGallery-${billNo}.pdf`;
function pdfFile(){
  const src = billPdf();                 // build the document once
  const bytes = new Uint8Array(src.length);
  for(let i = 0; i < src.length; i++) bytes[i] = src.charCodeAt(i) & 0xFF;
  return new File([bytes], pdfName(), {type:"application/pdf"});
}
function downloadPdf(file){
  const url = URL.createObjectURL(file || pdfFile());
  const a = document.createElement("a");
  a.href = url; a.download = pdfName();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}

$("#toBill").onclick=()=>{
  if(!cart.length) return;
  if(ordersPaused()){
    toast(shopPauseNote || "We have stopped taking orders for a few days.");
    return;
  }
  billNo = makeBillNo();
  placedBill = "";
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
  const bad=Object.keys(F).filter(id=>!ok(id,true));
  if(bad.length){
    e.preventDefault(); $("#"+bad[0]).focus();
    toast("Fill name, phone, address, city, pincode"); return;
  }
  /* refresh the message, then let the link open the shop's chat */
  paintBill();
  track("place_order", null, {items: nItems(), value: tot(), bill_no: billNo});
  flushTrack();                 /* the tab is about to lose focus to WhatsApp */
  /* and, for a signed-in customer, keep a copy of the order they can look
     up later. Never in the way: the chat opens either way. */
  if(typeof recordOrder === "function"){
    recordOrder({
      name:$("#bName").value.trim(), phone:$("#bPhone").value.trim(),
      addr:$("#bAddr").value.trim(),  city:$("#bCity").value.trim(),
      pin:$("#bPin").value.trim(),    note:$("#bNote").value.trim()
    });
  }
});

$("#shareLink").onclick=e=>{
  e.preventDefault();
  const text=`Handmade rakhis from Ray Art Gallery — ${location.href}`;
  if(navigator.share) navigator.share({title:"Ray Art Gallery", text}).catch(()=>{});
  else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
};

/* rangoli into the background — a single painted layer, not 336 DOM nodes */
$("#m1").style.backgroundImage = asBg(rangoli("#9C7620"));
$("#m2").style.backgroundImage = asBg(rangoli("#1B8497"));
const strip = rangoliStrip();
$$(".divider.rangoli").forEach(d=>{ d.innerHTML = strip; io.observe(d); });
Object.keys(STEP_ICONS).forEach(id=>{ const el=$("#"+id); if(el) el.innerHTML=STEP_ICONS[id]; });
