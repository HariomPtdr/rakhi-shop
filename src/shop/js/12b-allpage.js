/* ══════════════════════════════════════════════════════════
   THE FULL COLLECTION

   The home page carries a shelf two cards deep. This is the
   rest of it: everything, in a grid, with the chips and the
   sort that narrowing it down needs.

   A view over the page rather than a second HTML file. The
   cart, the account, the hearts and every script behind them
   already live here — a separate page would be a second copy
   of all of it to keep in step, for one grid. The product page
   and the order page are built the same way, and share the
   same lock/unlock and the same rule that the hash is what
   decides which view is showing.
   ══════════════════════════════════════════════════════════ */
const apEl = $("#ap");

const allOpen = () => apEl.classList.contains("on");

/* ── one view, a page per shelf ──
   #all is everything; #c/kids is the same view opened on one shelf. They
   are the same grid, the same chips, the same sort and the same sheet —
   what changes is the shelf it starts on and the words over it.

   Built this way on purpose. A separate page per shelf would be six more
   copies of the cart, the wishlist, the filter sheet and the card, all to
   be kept in step, and the moment a shelf were added there would be a
   seventh. Here a shelf added to shared/js/05-cats.js has its page the
   same day, because the page is this one. */
/* the lotus the whole collection is headed with, kept so that leaving a
   shelf puts it back */
const AP_MARK = ($(".ap-kick svg") || {}).innerHTML || "";
/* ── the page that is not a shelf ──
   Bestsellers is the same view again, filtered by the seller's own ticks
   rather than by products.cat. It is deliberately not in SHOP_CATS: that
   list is what the dashboard files rakhis onto, and "bestseller" is not a
   place to put one — it is a tick on a rakhi that is already somewhere. */
const AP_SPECIAL = {
  best: {
    n:"Bestsellers", card:{ t:"Bestsellers", sub:"Loved by thousands of families" },
    hero:{ kick:"Loved most",
           h:["Best","Sellers."],
           sub:["Handpicked favourites","loved by thousands of families."],
           mark:'<path d="M4 18h16l1.3-9.4-5 3.4L12 4.3 7.7 12l-5-3.4Z" fill="currentColor"/>'
                +'<path d="M4.6 20.4h14.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' }
  }
};
/* every page this view can be on: the shelves, and Bestsellers */
const viewOf = k => catOf(k) || AP_SPECIAL[k] || null;
const isView = k => !!viewOf(k);
const viewHash = k => (k === "best" ? "#best" : "#c/" + k);

const AP_HEAD = {
  kick: "Our collection",
  h2:   "Handpicked Rakhis<br>for Every Bond",
  sub:  "Explore our exclusive range<br class=\"ap-br\"> and find the perfect one."
};

/* ── the banner over a shelf ──
   Six shelves under one banner reading "Handpicked Rakhis for Every Bond"
   were six pages that looked like the same page arriving again. Each shelf
   brings its own: its own mark over its own kicker, its own two lines, its
   own sentence under them, its own photograph at the left-hand end, and —
   where the shelf's subject is a colour — its own colour.

   All of it out of shared/js/05-cats.js, so a shelf added there is a shelf
   with a banner, not a shelf with a banner still to write. */
function paintApHead(k){
  const c = k && viewOf(k);
  const hero = c && c.hero;
  const kick = $(".ap-kick b"), h2 = $(".ap-hero h2"), sub = $(".ap-sub"),
        mark = $(".ap-kick svg"), box = $(".ap-hero");

  if(kick && h2 && sub){
    kick.textContent = hero ? hero.kick : AP_HEAD.kick;
    h2.innerHTML     = hero ? hero.h.map(esc).join("<br>") : AP_HEAD.h2;
    sub.innerHTML    = hero ? `${hero.sub[0]}<br class="ap-br"> ${hero.sub[1]}` : AP_HEAD.sub;
  }
  /* the mark keeps the lotus's own 24×14 box on the collection and takes a
     24×24 one on a shelf, where the glyphs are drawn square */
  if(mark){
    mark.setAttribute("viewBox", hero ? "0 0 24 24" : "0 0 24 14");
    mark.innerHTML = hero ? hero.mark : AP_MARK;
  }
  if(box){
    box.classList.toggle("ap-hero-cat", !!hero);
    /* The shop is maroon and gold. The evil eye is the one shelf whose
       subject is itself a colour, and it gets it; everything else inherits
       what the banner already was. */
    box.style.setProperty("--ap-ink", (hero && hero.ink) || "#7A1418");
  }
  /* ── the shelf's own photograph ──
     Handed to the stylesheet rather than set on the element, because it is
     wanted on a wide screen and not on a phone: the picture is the card's,
     660px across, and a phone at three times the pixel ratio asked more of
     it than it had and went soft. On a desktop the same file is being shown
     smaller than it is, which is where it is sharp.

     The banner's own gypsophila stands in on the shelves that have no
     picture of their own — Bestsellers is not a shelf and has none. */
  if(box){
    box.style.setProperty("--cat-img",
      (c && c.card.img) ? `url("../../assets/images/${c.card.img}")` : "");
  }

  /* ── the bar says where you are ──
     The shop's name at the top of a shelf's own page was the one line up
     there not telling somebody anything they did not know — they are in the
     shop, they have been for a while. The shelf's name goes in its place
     and the shop's drops to the line underneath, which is where the
     wordmark's second line already was. */
  const n = $(".ap-brand .brand-n"), s2 = $(".ap-brand .brand-s");
  if(n) n.textContent  = c ? c.n : "Ray Art Gallery";
  if(s2) s2.textContent = c ? "Ray Art Gallery" : "Handmade Rakhi";
}

/* The hash always says what is on screen, so a shelf can be sent to
   somebody, opened again from history, or reloaded onto the same shelf.
   Replaced rather than pushed: pressing four chips in a row should not put
   four entries between the shop and the way back to it. */
function apHash(){ return isView(apState.cat) ? viewHash(apState.cat) : "#all"; }
function apSyncHash(){
  if(!allOpen()) return;
  const want = apHash();
  if(location.hash !== want) history.replaceState(null, "", want);
  document.title = ((viewOf(apState.cat) || {}).n || "The collection")
                 + " — Ray Art Gallery";
  paintApHead(apState.cat);
}

/* cat: the shelf to open on. Anything that is not a shelf — including
   nothing at all — is the whole collection. */
function openAll(fromHash, cat){
  const k = isView(cat) ? cat : null;
  /* Always, not only when the view is closed. Going from #best or a shelf
     to #all left the old page's filter in place and showed one rakhi under
     a banner reading Our collection: the address said everything and the
     grid disagreed with it. Opening a page sets what that page is. */
  apState.cat  = k || "all";
  apState.band = null;        /* a price and a shelf at once is how you get nothing */
  $$("#chips .chip").forEach(c =>
    c.setAttribute("aria-pressed", String(c.dataset.c === apState.cat)));
  paintApHead(k);
  if(allOpen()){ paintAll(); apSyncHash(); return; }
  paintAll();
  apEl.classList.add("on");
  apEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("ap-on");
  apEl.scrollTop = 0;
  lock();
  const want = apHash();
  if(!fromHash && location.hash !== want) location.hash = want.slice(1);
  document.title = ((viewOf(k) || {}).n || "The collection") + " — Ray Art Gallery";
}

/* The way in from a category card, the footer's Shop column, or anywhere
   else that names a shelf. */
function openCat(k, fromHash){
  if(!isView(k)) return openAll(fromHash);
  if(allOpen()){
    openAll(fromHash, k);
    apEl.scrollTop = 0;
    if(!fromHash) location.hash = viewHash(k).slice(1);
    return;
  }
  openAll(fromHash, k);
}
/* the way in from the row on the home page */
const openBest = fromHash => openCat("best", fromHash);

function hideAll(){
  closeFilter();
  apEl.classList.remove("on");
  apEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("ap-on");
  unlock();
  document.title = AP_TITLE;
}

function closeAll(fromHash){
  if(!allOpen()) return;
  hideAll();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}
const AP_TITLE = document.title;

/* Everything the chips and the sort have left, all of it. There is no
   paging here on purpose: this is the view somebody opened *because* they
   wanted the whole list, and a whole list that arrives in instalments is
   the thing they were trying to get away from. */
function paintAll(){
  const box = $("#apGrid");
  if(!box) return;
  /* apState, not state: the chips and the sort up there belong to this view,
     and the shelf on the home page is left as its own controls set it. */
  const list = visible(apState);
  const count = $("#rCount");
  if(count) count.textContent = `${two(list.length)} ${list.length === 1 ? "design" : "designs"}`;
  box.innerHTML = list.length
    ? list.map(p => railCard(p, {bare:true})).join("")
    : `<p class="ap-empty">Nothing matches that yet. Try another shelf.</p>`;
  if(typeof paintHearts === "function") paintHearts();
}

/* ══════════════════════════════════════════════════════════
   THE FILTER SHEET

   On a phone the shelves rise from the bottom rather than
   pushing the grid down the page — a panel that grows in place
   moves the thing you were looking at, and shelves are chosen
   with a thumb, which lives at the bottom of the screen.

   The chips inside it are the same buttons the wide bar uses,
   moved rather than copied. Two sets of them would be two
   things to keep in step, and the pressed one would eventually
   disagree with the grid.
   ══════════════════════════════════════════════════════════ */
const fsheet = $("#fsheet"), apFilter = $("#apFilter");
const fsheetOn = () => fsheet.classList.contains("on");

function openFilter(){
  if(fsheetOn()) return;
  /* Sort hangs off the same bar; one panel at a time. */
  if(typeof closeSort === "function") closeSort();
  $("#fsheetChips").appendChild($("#chips"));
  fsheet.classList.add("on");
  fsheet.setAttribute("aria-hidden", "false");
  if(apFilter) apFilter.setAttribute("aria-expanded", "true");
  paintFilterSheet();
  paintFilterCount();
}
function closeFilter(){
  if(!fsheetOn()) return;
  fsheet.classList.remove("on");
  fsheet.setAttribute("aria-hidden", "true");
  if(apFilter) apFilter.setAttribute("aria-expanded", "false");
  /* The chips go home once it has slid out of sight. Moved back while it
     is still animating, they vanish from under the thumb that just
     pressed one. */
  setTimeout(() => {
    if(!fsheetOn()) $("#apChips").querySelector(".ap-chips-in").appendChild($("#chips"));
  }, reduced ? 0 : 380);
}
const paintFilterCount = () => { $("#fsheetN").textContent = visible(apState).length; };

/* ── the price bands and the sort, inside the sheet ──
   Both drawn from the lists the rest of the shop already uses: BANDS is
   what the Shop by Budget circles are cut from and what visible() filters
   on, SORTS is what the desktop listbox offers. A second idea of what
   "under ₹100" means, or a fifth way of ordering the shop, is a second
   thing that has to be kept true.

   Only bands that hold something are drawn. A price filter offering an
   empty shelf is worse than one offering fewer. */
function paintFilterSheet(){
  /* ── shelf ──
     Only where it means something. On a shelf's own page the question has
     already been answered by the card that was pressed to get here, and the
     section was the tallest thing in the sheet: seven buttons offering to
     take somebody off the page they just asked for. */
  const onShelf = isView(apState.cat);
  const shelf = $("#fsheetShelf");
  if(shelf) shelf.hidden = onShelf;

  const bands = $("#fsheetBands");
  if(bands){
    /* the bands that hold something *on this page* — on the Kids shelf,
       Above ₹300 is not a filter, it is an empty room */
    const pool = visibleIgnoring(apState, "band");
    const live = BANDS.filter(b => pool.some(p => p.price >= b.lo && p.price < b.hi));
    bands.innerHTML = `
      <button class="fs-b" data-band="" aria-pressed="${!apState.band}">Any price</button>` +
      live.map(b => `
      <button class="fs-b" data-band="${b.k}" aria-pressed="${apState.band === b.k}">${b.n}</button>`).join("");
  }

  /* ── style ──
     The tags the rakhis in front of somebody actually carry, counted from
     the page rather than from a fixed list, so the buttons can never offer
     a style this shelf does not have. Six at most: the ones the shelf has
     most of. A shelf whose rakhis carry no tags draws nothing. */
  const styleWrap = $("#fsheetStyleWrap"), style = $("#fsheetStyle");
  if(styleWrap && style){
    const pool = visibleIgnoring(apState, "tag");
    const n = new Map();
    pool.forEach(p => (p.tags || []).map(tagKey).filter(Boolean)
      .forEach(t => n.set(t, (n.get(t) || 0) + 1)));
    /* a tag every rakhi on the page carries cannot narrow it down */
    const live = [...n.entries()].filter(([, c]) => c < pool.length)
                   .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
    styleWrap.hidden = !live.length;
    style.innerHTML = live.length ? `
      <button class="fs-b" data-tag="" aria-pressed="${!apState.tag}">Any style</button>` +
      live.map(t => `
      <button class="fs-b" data-tag="${esc(t)}" aria-pressed="${apState.tag === t}">${esc(tagLabel(t))}</button>`).join("") : "";
  }

  /* ── availability ──
     Drawn only when there is something to put away. A shop with nothing
     sold out offering to hide what is sold out is a button that does
     nothing, in a sheet where every other button does something. */
  const stockWrap = $("#fsheetStockWrap"), stock = $("#fsheetStock");
  if(stockWrap && stock){
    const pool = visibleIgnoring(apState, "stock");
    const anyOut = pool.some(p => p.stock === 0);
    stockWrap.hidden = !anyOut;
    stock.innerHTML = anyOut ? `
      <button class="fs-b" data-stock="0" aria-pressed="${!apState.stock}">Everything</button>
      <button class="fs-b" data-stock="1" aria-pressed="${!!apState.stock}">In stock only</button>` : "";
  }

  const sort = $("#fsheetSort");
  if(sort){
    sort.innerHTML = SORTS.map(o => `
      <button class="fs-b" data-sort="${o.k}" aria-pressed="${apState.sort === o.k}">${o.n}</button>`).join("");
  }
}

$("#fsheetBands").addEventListener("click", e => {
  const b = e.target.closest("[data-band]");
  if(!b) return;
  apState.band = b.dataset.band || null;
  /* a shelf and a price at once is how you arrive at nothing and cannot
     tell which of the two emptied it */
  if(apState.band){
    apState.cat = "all";
    $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === "all")));
  }
  paintAll();
  apSyncHash();
  paintFilterSheet();
  paintFilterCount();
});
$("#fsheetStyle").addEventListener("click", e => {
  const b = e.target.closest("[data-tag]");
  if(!b) return;
  apState.tag = b.dataset.tag || null;
  paintAll();
  paintFilterSheet();
  paintFilterCount();
});
$("#fsheetStock").addEventListener("click", e => {
  const b = e.target.closest("[data-stock]");
  if(!b) return;
  apState.stock = b.dataset.stock === "1";
  paintAll();
  paintFilterSheet();
  paintFilterCount();
});
$("#fsheetSort").addEventListener("click", e => {
  const b = e.target.closest("[data-sort]");
  if(!b) return;
  apState.sort = b.dataset.sort;
  if(typeof paintSort === "function") paintSort();   /* keeps the desktop listbox in step */
  paintAll();
  paintFilterSheet();
});

if(apFilter) apFilter.onclick = () => fsheetOn() ? closeFilter() : openFilter();
$("#fsheetX").onclick = closeFilter;
$("#fsheetGrab").onclick = closeFilter;
$("#fsheetGo").onclick = closeFilter;
/* the dim behind it */
fsheet.addEventListener("click", e => { if(e.target === fsheet) closeFilter(); });
$("#fsheetClear").onclick = () => {
  /* On a shelf's own page, Clear all clears the filters — not the shelf.
     Somebody on Kids Rakhis pressing it wants the price and the style back
     to anything, not to be moved to the whole shop. */
  if(!isView(apState.cat)) apState.cat = "all";
  apState.band = null; apState.sort = "feat"; apState.tag = null; apState.stock = false;
  $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === apState.cat)));
  if(typeof paintSort === "function") paintSort();
  paintAll();
  apSyncHash();
  paintFilterSheet();
  paintFilterCount();
};
/* Picking a shelf leaves the sheet up: the button under it counts what
   that shelf holds, so the choice can be changed before committing to it. */
$("#chips").addEventListener("click", e => {
  if(!e.target.closest(".chip")) return;
  /* the chip handler clears the band, so the band row has to be redrawn */
  paintFilterSheet();
  paintFilterCount();
});

/* ── the way in and out ── */
$("#apBack").onclick = () => closeAll();
$("#apHome").onclick = e => { e.preventDefault(); closeAll(); };
$("#apCart").onclick = () => openCart();
$("#apWish").onclick = () => openAcct("wishlist");

/* Escape, and the phone's back button, both mean the same thing here as
   they do on a rakhi's own page. */
addEventListener("keydown", e => {
  if(e.key !== "Escape" || !allOpen() || isOn("#drawer")) return;
  /* innermost first: the sheet over the view, then the view */
  if(fsheetOn()) closeFilter(); else closeAll();
});

/* The hash decides which view is showing — same rule as the product page,
   so the two can never both think they are open. #c/<shelf> is the same
   view opened on one shelf; a shelf nobody has heard of falls back to the
   whole collection rather than an empty grid. */
function syncAllRoute(){
  const m = /^#c\/([\w-]+)$/.exec(location.hash);
  if(m) openCat(m[1], true);
  else if(location.hash === "#best") openCat("best", true);
  else if(location.hash === "#all") openAll(true);
  else if(allOpen()) hideAll();
}
addEventListener("hashchange", syncAllRoute);
syncAllRoute();
