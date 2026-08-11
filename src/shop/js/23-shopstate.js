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
/* who to tell when the page itself is wrong */
const DEV = {name: "Hariom Patidar", whatsapp: "919636408450"};

function paintContact(){
  const wa = $("#fab");
  const ask = wa ? wa.getAttribute("data-ask") || ASK : ASK;
  const link = "https://wa.me/" + SHOP.whatsapp + "?text=" + encodeURIComponent(ask);
  ["#fab","#footWa","#faqWa"].forEach(s=>{ const a=$(s); if(a) a.href = link; });

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

  /* the free-delivery line in the footer, from the same number as the bill */
  const fs = $("#footShip");
  if(fs){
    fs.textContent = SHOP.freeShipMinQty > 0
      ? `Prices in INR · free delivery on ${SHOP.freeShipMinQty} rakhis or more`
      : SHOP.freeShipAbove > 0
        ? `Prices in INR · free delivery over ${inr(SHOP.freeShipAbove)}`
        : "Prices in INR · free delivery on everything";
  }

  /* ── reporting a fault ──
     Everything the person cannot be expected to describe — which page, which
     phone, which browser — is filled in for them. All they have to write is
     what went wrong. */
  /* The maker's name is the link. The email version sat beside it saying
     the same thing twice, and the shop's own address is not where a fault
     in the page should land. */
  const bugWa = $("#bugWa");
  if(bugWa){
    const body = [
      "What happened:", "", "",
      "What I expected:", "", "",
      "— sent from the shop —",
      "Page: " + location.href,
      "Screen: " + innerWidth + "×" + innerHeight,
      "Browser: " + navigator.userAgent
    ].join("\n");
    /* the developer's own number, not the shop's — a fault in the page is
       not something the person packing rakhis can do anything about */
    bugWa.href = "https://wa.me/" + DEV.whatsapp + "?text=" + encodeURIComponent(body);
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
