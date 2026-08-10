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

if(apFilter) apFilter.onclick = () => fsheetOn() ? closeFilter() : openFilter();
$("#fsheetX").onclick = closeFilter;
$("#fsheetGrab").onclick = closeFilter;
$("#fsheetGo").onclick = closeFilter;
/* the dim behind it */
fsheet.addEventListener("click", e => { if(e.target === fsheet) closeFilter(); });
$("#fsheetClear").onclick = () => {
  state.cat = "all"; state.band = null;
  $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === "all")));
  paintGrid();
  paintFilterCount();
};
/* Picking a shelf leaves the sheet up: the button under it counts what
   that shelf holds, so the choice can be changed before committing to it. */
$("#chips").addEventListener("click", e => {
  if(e.target.closest(".chip")) paintFilterCount();
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
