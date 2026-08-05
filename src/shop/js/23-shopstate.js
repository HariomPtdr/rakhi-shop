/* ══════════════════════════════════════════════════════════
   THE SHOP'S OWN STATE

   Three things the seller changes from the dashboard and this
   page has to honour without a rebuild: who to WhatsApp, the
   line across the top, and whether orders are being taken at
   all.

   Pausing keeps the whole shop readable. Someone who came for a
   rakhi can still look at it and still save it — they simply
   cannot send a bill, and they are told why. A shop that goes
   silent when it is full loses the customer; one that says
   "back on Monday" usually does not.
   ══════════════════════════════════════════════════════════ */

/* the footer and the floating button are drawn once at boot from SHOP;
   redraw them when the database says something different */
function paintContact(){
  const wa = $("#fab"), fwa = $("#footWa");
  const ask = wa ? wa.getAttribute("data-ask") || ASK : ASK;
  if(wa)  wa.href  = "https://wa.me/" + SHOP.whatsapp + "?text=" + encodeURIComponent(ask);
  if(fwa) fwa.href = "https://wa.me/" + SHOP.whatsapp + "?text=" + encodeURIComponent(ask);

  const ig = $("#footIg");
  if(ig){
    if(SHOP.instagram){ ig.href = "https://instagram.com/" + SHOP.instagram; ig.hidden = false; }
    else ig.hidden = true;
  }
  const mail = $("#footMail");
  if(mail){
    if(SHOP.email){ mail.href = "mailto:" + SHOP.email; mail.hidden = false; }
    else mail.hidden = true;
  }
}

/* ── the line across the top ── */
function paintAnnouncement(text, paused, note){
  let bar = $("#announce");
  const msg = paused
    ? (note || "We have stopped taking orders for a few days.")
    : (text || "");

  if(!msg){
    if(bar) bar.remove();
    document.body.classList.remove("has-announce");
    return;
  }
  if(!bar){
    bar = document.createElement("div");
    bar.id = "announce";
    bar.className = "announce";
    document.body.insertBefore(bar, document.body.firstChild);
  }
  bar.className = "announce" + (paused ? " paused" : "");
  bar.innerHTML = `<span>${paused ? "<b>Not taking orders</b> — " : ""}${esc(msg)}</span>`;
  document.body.classList.add("has-announce");
}

/* ── and the one thing it stops ── */
function ordersPaused(){ return shopPaused; }
