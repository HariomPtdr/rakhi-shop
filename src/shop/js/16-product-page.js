/* ══════════════════════════════════════════════════════════
   PRODUCT PAGE — a hash route, not a separate file.

   #p/nazar opens the Nazar rakhi. Every rakhi gets a link you can
   send to one customer on WhatsApp, the back button behaves, and
   the page still ships as one file with no extra requests.

   A listed rakhi is shown exactly as it is made — no colour picker
   here. Choosing your own thread and beads is the made-to-order
   route on the home page, over WhatsApp.
   ══════════════════════════════════════════════════════════ */
const pvEl = $("#pv");
let pvId = null, pvQty = 1;
/* which photo of the gallery is showing; reset whenever a rakhi opens */
let pvShotAt = 0;

const pvProduct = () => PRODUCTS.find(p => p.id === pvId);
const productOpen = () => pvEl.classList.contains("on");

function pvArt(p){
  return `<img class="art" src="${asSrc(art(p.art, true))}" alt="Drawing of ${esc(p.name)}">`;
}
/* every photo of this rakhi, cover first. Falls back to the single
   image_path for a catalogue loaded before galleries existed. */
function pvGallery(p){
  if(p.imgs && p.imgs.length) return p.imgs;
  return p.img ? [p.img] : [];
}
function pvShot(p){
  const g = pvGallery(p);
  if(g.length){
    const src = g[Math.min(pvShotAt, g.length - 1)];
    return {html:`<img src="${src}" alt="${esc(p.name)}" data-fb="${p.id}">`, tag:"Photo", real:true};
  }
  return {html: pvArt(p), tag:"Drawing", real:false};
}

function paintProduct(){
  const p = pvProduct(); if(!p) return;
  /* The cover is already known, so the page draws immediately with it and
     the rest of the photos slide in behind. Asked for once per rakhi. */
  if(typeof loadGallery === "function" && !p.imgsLoaded && !p.imgsLoading){
    loadGallery(p).then(got => { if(got && pvProduct() === p) paintProduct(); });
  }
  const shot = pvShot(p);
  const gallery = pvGallery(p);
  const out = p.stock === 0;
  const off = (p.mrp && p.mrp > p.price) ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const shelf = CATS.find(c => c.k === p.cat);

  /* the ones worth showing next, not simply the first six in the catalogue:
     the same kind first, then whatever is nearest in price */
  const near = PRODUCTS.filter(x => x.id !== p.id).map(x => ({
    p: x,
    score: (x.cat === p.cat ? 0 : 100) + Math.abs(x.price - p.price) / 10
             + (x.stock === 0 ? 500 : 0) + (x.img ? -8 : 0)
  })).sort((a, b) => a.score - b.score).slice(0, 10).map(x => x.p);

  $("#pvIn").innerHTML = `
    <!-- ── where this rakhi lives ──
         The bar used to say "Collection / № 07", which is a filing number.
         This says the shop, the shelf and the rakhi, and the first two are
         the way back to them. -->
    <nav class="pv-crumbs" aria-label="Breadcrumb">
      <a href="#top" data-crumb="home">Home</a>
      <span aria-hidden="true">›</span>
      ${shelf ? `<a href="#c/${shelf.k}" data-crumb="shelf">${esc(shelf.n)}</a>
      <span aria-hidden="true">›</span>` : ""}
      <b>${esc(p.name)}</b>
    </nav>

    <div class="pv-top">
    <div class="pv-left">
    <div class="pv-shot">
      ${gallery.length ? `
        <div class="pv-slides" id="pvSlides" role="group" aria-label="Photos of ${esc(p.name)}">
          ${gallery.map((src, i) => `
            <button class="pv-slide" data-zoom="${i}" aria-label="Photo ${i + 1} of ${gallery.length}">
              <img src="${esc(src)}" alt="${esc(p.name)}" ${i ? 'loading="lazy"' : ""}>
            </button>`).join("")}
        </div>`
      : `<button class="pv-frame" id="pvZoom" aria-label="View ${esc(p.name)} larger">
          ${shot.html}
        </button>`}
      ${out ? `<span class="pv-badge pv-badge-out">Sold out</span>`
            : p.best ? `<span class="pv-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3.2l2.6 5.5 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.5l5.9-.8Z"/></svg>
          Bestseller</span>` : ""}
      ${heartBtn(p.id, true)}
      ${gallery.length > 1 ? `
        <button class="pv-arrow prev" id="pvPrev" aria-label="Previous photo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <button class="pv-arrow next" id="pvNext" aria-label="Next photo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <span class="pv-count" id="pvCount">${pvShotAt + 1} / ${gallery.length}</span>` : ""}
    </div>

    ${gallery.length > 1 ? `<div class="pv-thumbs" role="group" aria-label="More photos">
      ${gallery.map((src, i) => `
        <button type="button" class="pv-th${i === pvShotAt ? " on" : ""}" data-shot="${i}"
          aria-label="Photo ${i + 1} of ${gallery.length}" aria-pressed="${i === pvShotAt}">
          <img src="${esc(src)}" alt="" loading="lazy">
        </button>`).join("")}
    </div>` : ""}

    <div class="pv-panel">
      <div class="pv-k">Product description
        <span class="pv-k-orn" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.4c1.5 1.9 1.5 4.2 0 6.1-1.5-1.9-1.5-4.2 0-6.1Zm0 19.2c-1.5-1.9-1.5-4.2 0-6.1 1.5 1.9 1.5 4.2 0 6.1ZM2.4 12c1.9-1.5 4.2-1.5 6.1 0-1.9 1.5-4.2 1.5-6.1 0Zm19.2 0c-1.9 1.5-4.2 1.5-6.1 0 1.9-1.5 4.2-1.5 6.1 0ZM5.2 5.2c2.4.3 4 1.9 4.3 4.3-2.4-.3-4-1.9-4.3-4.3Zm13.6 13.6c-2.4-.3-4-1.9-4.3-4.3 2.4.3 4 1.9 4.3 4.3Zm0-13.6c-.3 2.4-1.9 4-4.3 4.3.3-2.4 1.9-4 4.3-4.3ZM5.2 18.8c.3-2.4 1.9-4 4.3-4.3-.3 2.4-1.9 4-4.3 4.3Z"/>
            <circle cx="12" cy="12" r="2.1"/>
          </svg>
        </span>
      </div>
      <p class="pv-desc">${esc(p.desc)}</p>
    </div>

    </div>

    <!-- ── the side that does the selling ──
         The name, what it costs, how many, and the two buttons. It stays
         on screen while the pictures and the description scroll past it,
         because a decision made three screens down should not need
         scrolling back up to act on. -->
    <div class="pv-right">
      <div class="pv-buycard">
        <h1 class="pv-name">${esc(p.name)}</h1>

        <div class="pv-price">
          <b>${inr(p.price)}</b>${off ? `<s>${inr(p.mrp)}</s>
          <span class="pv-off">${off}% OFF</span>` : ""}
        </div>
        <p class="pv-tax">Inclusive of all taxes · per piece</p>
        <!-- What it is, in four words, directly under what it costs — above
             the paragraph rather than below it, because somebody scanning
             the page reads the labels and only then the sentence. -->
        ${tagChips(p, Infinity)}

        ${out ? `
          <p class="pv-soldout">This one has gone. Ask us on WhatsApp and we
             will tell you when it is back.</p>
          <button class="btn btn-dark btn-full" id="pvAdd" disabled>Sold out</button>`
        : `
          <div class="pv-qty">
            <span class="pv-qty-k">Quantity</span>
            <span class="stp">
              <button type="button" id="pvDown" aria-label="One less">−</button>
              <span id="pvQty">${pvQty}</span>
              <button type="button" id="pvUp" aria-label="One more">+</button>
            </span>
          </div>

          <button class="pv-act pv-act-add" id="pvAdd">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5.5 8h13l-1 12.5h-11Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>
            Add to cart
          </button>
          <button class="pv-act pv-act-buy" id="pvBuy">
            Buy now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.2 2 4.6 13.4h5.2L9.4 22l8.8-11.6h-5.4Z"/></svg>
          </button>`}

      </div>

    ${etaHtml()}

    <div class="pv-trust">
      <div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2.8 4.6 5.4v6c0 4.2 3 8 7.4 9.8 4.4-1.8 7.4-5.6 7.4-9.8v-6Z"/>
          <path d="M8.6 12.2l2.4 2.4 4.4-4.6"/></svg>
        <b>Secure payments</b><span>UPI, card or on delivery</span>
      </div>
      <div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 7.4h11.4v9.2H2z"/><path d="M13.4 10.6h3.9l3.1 3.2v2.8h-7z"/>
          <circle cx="6.6" cy="18.4" r="1.9"/><circle cx="16.4" cy="18.4" r="1.9"/></svg>
        <b>Pan-India delivery</b><span>About ${SHOP.awayDays} days to most pincodes</span>
      </div>
      <div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 9.6c-1-1.9-4.3-1.7-4.3 1 0 1.9 2.6 3.6 4.3 4.8 1.7-1.2 4.3-2.9 4.3-4.8 0-2.7-3.3-2.9-4.3-1Z"/>
          <path d="M3 16.4c1.6-.9 3-.7 4.4.2l2.2 1.4c.7.4 1.2.5 2 .5h5.1c1.3 0 2.3.5 3.3 1.5"/></svg>
        <b>Crafted with care</b><span>Tied by hand in ${esc(SHOP.localCity)}</span>
      </div>
    </div>

    </div>
    </div>

    <!-- ── you may also like ──
         At the foot of the page rather than beside the buy panel: somebody
         is only interested in another rakhi once they have finished with
         this one, and a second catalogue up beside the price competes with
         the thing the page is for.

         One row that runs off the right edge and is pushed, not a grid —
         a grid here is the shop starting again under its own product page. -->
    ${near.length ? `
    <div class="pv-also">
      <div class="pv-also-h">
        <div class="pv-k">You may also like</div>
        <a href="#all" id="pvAlsoAll">View all</a>
      </div>
      <div class="pv-also-g" id="pvRail">
        ${near.map(x => railCard(x, {bare:true})).join("")}
      </div>
    </div>` : ""}

    <!-- ── the bar along the bottom, on a phone ──
         The two buttons that matter, always in reach: a phone screen holds
         about a third of this page, so the panel they used to live in was
         off the top of it for most of the scroll — and the answer to "do I
         want this" arrives while looking at the last photograph, not while
         looking at the button.

         The left slot is the shop's own Add button, which is why it turns
         into a stepper the moment the rakhi is in the basket: that is what
         every Add in this shop does, and paintCart() keeps it in step
         without this page knowing anything about it. -->
    <div class="pvbar">
      <div class="pvbar-slot">${cardActs(p, {long:true})}</div>
      ${out ? "" : `
      <button class="pvbar-buy" type="button" data-pvbuy>
        Buy now
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.2 2 4.6 13.4h5.2L9.4 22l8.8-11.6h-5.4Z"/></svg>
      </button>`}
    </div>`;

}

/* ── how long it will take ──
   The rakhis are made in Indore, so an Indore address is a day or two and
   the rest of the country is a week. Saying both is honest; saying which
   one applies to the person reading is useful, so when the account already
   knows where they are, that line is the one in bold.

   Nothing here is a guarantee — it says "about", because a courier in the
   week before Raksha Bandhan is not a promise anyone should make. */
function isLocal(){
  if(!profile) return false;
  const city = (profile.city || "").trim().toLowerCase();
  const pin  = (profile.pincode || "").trim();
  return city === SHOP.localCity.toLowerCase() || pin.startsWith(SHOP.localPin);
}

function etaHtml(){
  const known = !!(profile && (profile.city || profile.pincode));
  const local = known && isLocal();
  const where = known ? (profile.city || "").trim() : "";

  return `<div class="pv-eta">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/>
      <circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>
    </svg>
    <div>
      <b>${known
        ? (local
            ? `About ${SHOP.localDays} days to ${esc(where || SHOP.localCity)}`
            : `Within a week to ${esc(where || "your city")}`)
        : `${SHOP.localCity} in about ${SHOP.localDays} days`}</b>
      <span>${known
        ? (local
            ? `We make them here in ${esc(SHOP.localCity)}, so yours has the shortest way to go.`
            : `Made to order in ${esc(SHOP.localCity)} and posted the same week — about ${SHOP.awayDays} days to most pincodes.`)
        : `Everywhere else in India within a week. Sign in and we will say which one is yours.`}</span>
    </div>
  </div>`;
}

/* ── the slider ──
   Scrolling the strip is what moves it, on a phone by swiping and on a
   desktop by the arrows. Only the dots and the thumbnails are repainted,
   never the whole page: repainting mid-swipe would snap the strip back to
   the start under the finger. */
function slideTo(i){
  const strip = $("#pvSlides");
  const g = pvGallery(pvProduct() || {});
  if(!strip || !g.length) return;
  const n = Math.max(0, Math.min(i, g.length - 1));
  strip.scrollTo({left: n * strip.clientWidth, behavior: "smooth"});
  markSlide(n);
}
function markSlide(n){
  if(n === pvShotAt) return;
  pvShotAt = n;
  /* "3 / 6" in the corner of the picture rather than a row of dots. Six dots
     under a photograph are six marks to count; the number says the same
     thing without being counted, and it survives a gallery of twenty. */
  const count = $("#pvCount");
  if(count) count.textContent = `${n + 1} / ${pvGallery(pvProduct() || {}).length}`;
  $$(".pv-th").forEach((b, i) => {
    b.classList.toggle("on", i === n);
    b.setAttribute("aria-pressed", String(i === n));
  });
}
function openZoom(i){
  const p = pvProduct(); if(!p) return;
  const g = pvGallery(p);
  const src = g.length ? g[Math.min(i, g.length - 1)] : null;
  $("#lbIn").innerHTML =
    (src ? `<img src="${src}" alt="${esc(p.name)}">` : pvArt(p)) +
    `<div class="lb-n">№ ${IDX.get(p.id)} — ${esc(p.name)}${
      g.length > 1 ? ` · ${i + 1} of ${g.length}` : ""}</div>` +
    `<div class="lb-p">${inr(p.price)}</div>`;
  openSheet("#lb");
}

function openProduct(id, fromHash){
  if(!PRODUCTS.some(x=>x.id===id)) return;
  if(pvId !== id){ pvId = id; pvQty = 1; pvShotAt = 0; }
  paintProduct();
  pvEl.classList.add("on");
  pvEl.setAttribute("aria-hidden","false");
  document.body.classList.add("pv-on");
  pvEl.scrollTop = 0;
  lock();
  if(!fromHash && location.hash !== "#p/"+id) location.hash = "p/"+id;
  document.title = `${pvProduct().name} — Ray Art Gallery`;
  /* follow the strip as a finger moves it */
  const strip = $("#pvSlides");
  if(strip){
    let tick = false;
    strip.addEventListener("scroll", () => {
      if(tick) return;
      tick = true;
      requestAnimationFrame(() => {
        markSlide(Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth)));
        tick = false;
      });
    }, {passive:true});
  }
  track("view_product", id);
}
function hideProduct(){
  pvEl.classList.remove("on");
  pvEl.setAttribute("aria-hidden","true");
  document.body.classList.remove("pv-on");
  pvId = null;
  /* leaving must never reveal a dim layer that belonged to a sheet
     opened over this page */
  if(!sheetOpen()){ $("#scrim").classList.remove("on"); unlock(); }
  document.title = "Ray Art Gallery — Handmade Rakhi";
}
/* The browser's own back button should step back through the rakhis you
   looked at — that is what people expect. The arrow in the bar means
   something different: leave the product view entirely. So it drops the
   hash instead of walking history backwards into the previous product. */
function closeProduct(fromHash){
  if(!productOpen()) return;
  hideProduct();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

/* the hash is the single source of truth for which rakhi is showing */
function syncRoute(){
  const m = /^#p\/([\w-]+)$/.exec(location.hash);
  if(m) openProduct(m[1], true);
  else if(productOpen()) hideProduct();
}
addEventListener("hashchange", syncRoute);

$("#pvBack").onclick = ()=>closeProduct();
/* the wordmark and the heart in the bar, doing what they do everywhere else */
$("#pvHome").onclick = e => { e.preventDefault(); closeProduct(); };
$("#pvWish").onclick = () => { hideProduct(); openWish(); };
/* the mandala, borrowed rather than written out a third time */
fillBrandMark("#pvHome .brand-mk-slot");
$("#pvShare").onclick = async ()=>{
  const p = pvProduct(); if(!p) return;
  const text = `${p.name} — ${inr(p.price)} · Ray Art Gallery\n${location.href}`;
  if(navigator.share){
    try{ await navigator.share({title:p.name, text}); return; }
    catch(e){ if(e && e.name === "AbortError") return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};

/* one delegated handler for the whole product page */
$("#pvIn").addEventListener("click", e=>{
  if(e.target.closest("#pvUp")){   pvQty = Math.min(MAX_QTY, pvQty+1); $("#pvQty").textContent = pvQty; return; }
  if(e.target.closest("#pvDown")){ pvQty = Math.max(1, pvQty-1);       $("#pvQty").textContent = pvQty; return; }

  const th = e.target.closest("[data-shot]");
  if(th){ slideTo(parseInt(th.dataset.shot, 10) || 0); return; }
  if(e.target.closest("#pvPrev")){ slideTo(pvShotAt - 1); return; }
  if(e.target.closest("#pvNext")){ slideTo(pvShotAt + 1); return; }
  const z = e.target.closest("[data-zoom]");
  if(z){ openZoom(parseInt(z.dataset.zoom, 10) || 0); return; }

  /* ── the crumbs, and View all ──
     Each one leaves this view first. Setting a hash while a full-screen page
     is still open leaves two of them stacked with the address naming only
     one, which is the trap every view on this site is written around. */
  const crumb = e.target.closest("[data-crumb]");
  if(crumb){
    e.preventDefault();
    const shelf = crumb.dataset.crumb === "shelf" ? (pvProduct() || {}).cat : null;
    /* Home drops the hash on its way out; a shelf hands it to the collection,
       which writes its own. */
    if(shelf){ hideProduct(); openCat(shelf); }
    else closeProduct();
    return;
  }
  if(e.target.closest("#pvAlsoAll")){ e.preventDefault(); hideProduct(); openAll(); return; }

  /* Buy now: the same basket, straight to the bill. It adds rather than
     replaces — silently throwing away a basket someone spent ten minutes
     filling is not a shortcut, it is a loss. The bill lists everything, so
     nothing is hidden either way. */
  if(e.target.closest("#pvBuy") || e.target.closest("[data-pvbuy]")){
    const p = pvProduct(); if(!p) return;
    if(p.stock === 0){ toast(p.name + " is sold out"); return; }
    if(ordersPaused()){ toast(shopPauseNote || "Not taking orders right now."); return; }
    if(mustSignIn("buy this")) return;
    const row = cart.find(r => r.id === p.id && !r.note);
    /* Already in the basket — from the stepper in the bar, or from a card on
       another page — and Buy now means "take me to the bill", not "and one
       more". It used to add regardless, so somebody who had counted out
       three and then pressed Buy now arrived at a bill for four. */
    if(row) track("add_cart", p.id, {qty: row.qty, via: "buy_now"});
    else{
      cart.push({id:p.id, name:p.name, price:p.price, qty:pvQty});
      track("add_cart", p.id, {qty: pvQty, via: "buy_now"});
    }
    save(); paintCart(true);
    closeProduct();
    requestAnimationFrame(() => $("#toBill").click());
    return;
  }

  const add = e.target.closest("#pvAdd");
  if(add){
    const p = pvProduct(); if(!p) return;   /* a stale tap while the page closes */
    if(p.stock === 0){ toast(p.name + " is sold out"); return; }
    /* this page fills the basket itself rather than going through addItem(),
       because it adds pvQty at once — so it asks for the sign-in itself too */
    if(mustSignIn("add this to your basket")) return;
    lastBtn = add;
    const row = cart.find(r => r.id===p.id && !r.note);
    if(row) row.qty = Math.min(MAX_QTY, row.qty + pvQty);
    else cart.push({id:p.id, name:p.name, price:p.price, qty:pvQty});
    save(); paintCart(true); toast(`Added — ${p.name}`);
    throwPetals(add);
    return;
  }
  if(e.target.closest("#pvZoom")){ openZoom(pvShotAt); return; }
});

$$(".rv").forEach(el=>io.observe(el));
