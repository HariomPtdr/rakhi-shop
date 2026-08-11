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

function openAll(fromHash){
  if(allOpen()) return;
  paintAll();
  apEl.classList.add("on");
  apEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("ap-on");
  apEl.scrollTop = 0;
  lock();
  if(!fromHash && location.hash !== "#all") location.hash = "all";
  document.title = "The collection — Ray Art Gallery";
}

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
  const list = visible();
  box.innerHTML = list.length
    ? list.map(p => railCard(p, {bare:true, tags:true})).join("")
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
const paintFilterCount = () => { $("#fsheetN").textContent = visible().length; };

/* ── the price bands and the sort, inside the sheet ──
   Both drawn from the lists the rest of the shop already uses: BANDS is
   what the Shop by Budget circles are cut from and what visible() filters
   on, SORTS is what the desktop listbox offers. A second idea of what
   "under ₹100" means, or a fifth way of ordering the shop, is a second
   thing that has to be kept true.

   Only bands that hold something are drawn. A price filter offering an
   empty shelf is worse than one offering fewer. */
function paintFilterSheet(){
  const bands = $("#fsheetBands");
  if(bands){
    const live = BANDS.filter(b => PRODUCTS.some(p => p.price >= b.lo && p.price < b.hi));
    bands.innerHTML = `
      <button class="fs-b" data-band="" aria-pressed="${!state.band}">Any price</button>` +
      live.map(b => `
      <button class="fs-b" data-band="${b.k}" aria-pressed="${state.band === b.k}">${b.n}</button>`).join("");
  }
  const sort = $("#fsheetSort");
  if(sort){
    sort.innerHTML = SORTS.map(o => `
      <button class="fs-b" data-sort="${o.k}" aria-pressed="${state.sort === o.k}">${o.n}</button>`).join("");
  }
}

$("#fsheetBands").addEventListener("click", e => {
  const b = e.target.closest("[data-band]");
  if(!b) return;
  state.band = b.dataset.band || null;
  /* a shelf and a price at once is how you arrive at nothing and cannot
     tell which of the two emptied it */
  if(state.band){
    state.cat = "all";
    $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === "all")));
  }
  paintGrid();
  paintFilterSheet();
  paintFilterCount();
});
$("#fsheetSort").addEventListener("click", e => {
  const b = e.target.closest("[data-sort]");
  if(!b) return;
  state.sort = b.dataset.sort;
  if(typeof paintSort === "function") paintSort();   /* keeps the desktop listbox in step */
  paintGrid();
  paintFilterSheet();
});

if(apFilter) apFilter.onclick = () => fsheetOn() ? closeFilter() : openFilter();
$("#fsheetX").onclick = closeFilter;
$("#fsheetGrab").onclick = closeFilter;
$("#fsheetGo").onclick = closeFilter;
/* the dim behind it */
fsheet.addEventListener("click", e => { if(e.target === fsheet) closeFilter(); });
$("#fsheetClear").onclick = () => {
  state.cat = "all"; state.band = null; state.sort = "feat";
  $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === "all")));
  if(typeof paintSort === "function") paintSort();
  paintGrid();
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
   so the two can never both think they are open. */
function syncAllRoute(){
  if(location.hash === "#all") openAll(true);
  else if(allOpen()) hideAll();
}
addEventListener("hashchange", syncAllRoute);
syncAllRoute();
