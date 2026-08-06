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
  const shot = pvShot(p);
  const gallery = pvGallery(p);
  $("#pvCrumb").textContent = `Collection / № ${IDX.get(p.id)}`;

  $("#pvIn").innerHTML = `
    <div class="pv-top">
    <div class="pv-shot">
      <span class="pv-glow" aria-hidden="true"></span>
      ${gallery.length > 1 ? `
        <div class="pv-slides" id="pvSlides" role="group" aria-label="Photos of ${esc(p.name)}">
          ${gallery.map((src, i) => `
            <button class="pv-slide" data-zoom="${i}" aria-label="Photo ${i + 1} of ${gallery.length}">
              <img src="${esc(src)}" alt="${esc(p.name)}" ${i ? 'loading="lazy"' : ""}>
            </button>`).join("")}
        </div>
        <span class="pv-badge real">Photo</span>
        <button class="pv-arrow prev" id="pvPrev" aria-label="Previous photo">‹</button>
        <button class="pv-arrow next" id="pvNext" aria-label="Next photo">›</button>
        <div class="pv-dots" id="pvDots" aria-hidden="true">
          ${gallery.map((_, i) => `<i class="${i === pvShotAt ? "on" : ""}"></i>`).join("")}
        </div>`
      : `<button class="pv-frame" id="pvZoom" aria-label="View ${esc(p.name)} larger">
          ${shot.html}
          <span class="pv-badge ${shot.real ? "real" : "art"}">${shot.tag}</span>
        </button>
        <div class="pv-zoomhint" aria-hidden="true"></div>`}
      ${heartBtn(p.id, true)}
      ${gallery.length > 1 ? `<div class="pv-thumbs" role="group" aria-label="More photos">
        ${gallery.map((src, i) => `
          <button type="button" class="pv-th${i === pvShotAt ? " on" : ""}" data-shot="${i}"
            aria-label="Photo ${i + 1} of ${gallery.length}" aria-pressed="${i === pvShotAt}">
            <img src="${esc(src)}" alt="" loading="lazy">
          </button>`).join("")}
      </div>` : ""}
    </div>

    <div class="pv-body">
      <div class="pv-no">№ ${IDX.get(p.id)}</div>
      <h1 class="pv-name">${esc(p.name)}</h1>
      ${p.ratings ? `<button class="pv-rate" id="pvToReviews">
         ${starsHtml(p.rating, 15)}
         <span><b>${Number(p.rating).toFixed(1)}</b> · ${p.ratings} ${
           plural(p.ratings, "review")}</span></button>` : ""}
      <div class="pv-price"><b>${inr(p.price)}</b><span>per piece</span></div>
      <p class="pv-desc">${esc(p.desc)}</p>

      <div class="pv-rule"></div>

      <!-- One row: how many, and the two things you can do with it. Three
           stacked full-width buttons made every choice look equally urgent
           and pushed the promises off the screen. Buy now is the one people
           on a phone actually want, so it is the solid one. -->
      <div class="pv-buy">
        <span class="stp">
          <button type="button" id="pvDown" aria-label="One less">−</button>
          <span id="pvQty">${pvQty}</span>
          <button type="button" id="pvUp" aria-label="One more">+</button>
        </span>
        ${p.stock === 0
          ? `<button class="btn btn-dark" id="pvAdd" disabled>Sold out</button>`
          : `<button class="btn btn-dark" id="pvBuy">Buy now</button>`}
      </div>
      ${p.stock === 0 ? "" : `
        <button class="btn btn-ghost btn-full pv-add2" id="pvAdd">Add to cart</button>`}
      <a class="pv-ask-link" id="pvAsk" href="#" target="_blank" rel="noopener">
        <svg class="wa" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.9.53 3.68 1.46 5.2L2 22l5.1-1.6a9.8 9.8 0 004.94 1.33c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2zm5.7 13.9c-.24.67-1.4 1.28-1.93 1.33-.53.06-1.02.1-1.75-.16-.73-.27-2.5-.98-4.28-3.1-1.4-1.67-1.62-2.9-1.7-3.4-.07-.5.2-1.35.55-1.7.35-.36.6-.4.83-.4h.5c.2 0 .4-.03.6.47.2.5.7 1.8.76 1.93.06.13.1.28 0 .45-.1.17-.34.44-.5.6-.16.15-.3.28-.15.55.14.27.6 1.06 1.3 1.7.9.83 1.6 1.1 1.87 1.23.27.14.43.12.6-.05.16-.16.66-.75.84-1 .18-.27.36-.22.6-.13.24.1 1.5.72 1.76.85.26.13.43.2.5.3.06.12.06.66-.18 1.34z"/></svg>
        Ask about this on WhatsApp</a>

      ${etaHtml()}

      <ul class="pv-promise">
        <li>You approve a photo before we ship it</li>
        <li>Pay by UPI or on delivery — nothing upfront</li>
        <li>Made to order by hand, so no two are identical</li>
      </ul>
      <div class="pv-facts trust" role="list">${trustPills()}</div>
    </div>
    </div>

    <div class="pv-reviews" id="pvReviews">
      <div class="pv-k">What people said</div>
      <div id="pvReviewBody"><p class="ac-empty">Loading…</p></div>
    </div>

    <div class="pv-more">
      <div class="pv-k">More rakhis</div>
      <div class="rail-wrap"><div class="rail" id="pvRail" role="group" aria-label="More rakhis"></div></div>
    </div>`;

  /* the ones worth showing next, not simply the first six in the catalogue:
     the same kind first, then whatever is nearest in price */
  const near = PRODUCTS.filter(x => x.id !== p.id).map(x => ({
    p: x,
    score: (x.cat === p.cat ? 0 : 100) + Math.abs(x.price - p.price) / 10
             + (x.stock === 0 ? 500 : 0) + (x.img ? -8 : 0)
  })).sort((a, b) => a.score - b.score).slice(0, 8).map(x => x.p);

  $("#pvRail").innerHTML = near.map(x=>`
    <article class="rc">
      <div class="rc-shot">
        ${thumb(x)}<span class="rc-tag ${x.img?"real":"art"}">${x.img?"Photo":"Drawing"}</span>
        ${heartBtn(x.id)}
      </div>
      <h3 class="rc-n">${esc(x.name)}</h3>
      <div class="rc-b"><span class="rc-p">${inr(x.price)}</span>${cardActs(x)}</div>
    </article>`).join("");

  $("#pvAsk").href = wa(
`Hello Ray Art Gallery, I am asking about № ${IDX.get(p.id)} — ${p.name} (${inr(p.price)}).`
+ `\n\nHow many days will it take?`);
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
  const dots = $("#pvDots");
  if(dots) [...dots.children].forEach((d, i) => d.classList.toggle("on", i === n));
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
  paintStill();                        /* drop the drift petals off the lifted canvas */
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
  loadReviews(id);
}
function hideProduct(){
  pvEl.classList.remove("on");
  pvEl.setAttribute("aria-hidden","true");
  document.body.classList.remove("pv-on");
  paintStill();                        /* and put them back behind the shop */
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

  /* Buy now: the same basket, straight to the bill. It adds rather than
     replaces — silently throwing away a basket someone spent ten minutes
     filling is not a shortcut, it is a loss. The bill lists everything, so
     nothing is hidden either way. */
  if(e.target.closest("#pvBuy")){
    const p = pvProduct(); if(!p) return;
    if(p.stock === 0){ toast(p.name + " is sold out"); return; }
    if(ordersPaused()){ toast(shopPauseNote || "Not taking orders right now."); return; }
    if(mustSignIn("buy this")) return;
    const row = cart.find(r => r.id === p.id && !r.note);
    if(row) row.qty = Math.min(MAX_QTY, row.qty + pvQty);
    else cart.push({id:p.id, name:p.name, price:p.price, qty:pvQty});
    save(); paintCart(true);
    track("add_cart", p.id, {qty: pvQty, via: "buy_now"});
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
