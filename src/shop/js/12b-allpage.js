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

/* ── Filter ──
   Opens the shelves on a phone. From tablet up they are simply there and
   the button is not drawn, so this never runs. */
const apTools = $("#apTools"), apFilter = $("#apFilter");
const apShelves = open => {
  apTools.classList.toggle("open", open);
  if(apFilter) apFilter.setAttribute("aria-expanded", String(open));
};
if(apFilter) apFilter.onclick = () => {
  /* Sort hangs off the same bar and opens downwards into the same space, so
     one closes the other. Both at once is two panels over each other with
     the chips showing through the gaps. */
  if(typeof closeSort === "function") closeSort();
  apShelves(!apTools.classList.contains("open"));
};
/* and the other way round */
$("#sortBtn").addEventListener("click", () => apShelves(false));
/* Picking a shelf answers the question the panel was asking, so it closes
   itself — the grid underneath is what they wanted to look at. */
$("#chips").addEventListener("click", e => {
  if(!e.target.closest(".chip")) return;
  if(matchMedia("(max-width:759px)").matches) apShelves(false);
});

/* ── the way in and out ── */
$("#apBack").onclick = () => closeAll();
$("#apCart").onclick = () => { closeAll(); openCart(); };

/* Escape, and the phone's back button, both mean the same thing here as
   they do on a rakhi's own page. */
addEventListener("keydown", e => {
  if(e.key === "Escape" && allOpen() && !isOn("#drawer")) closeAll();
});

/* The hash decides which view is showing — same rule as the product page,
   so the two can never both think they are open. */
function syncAllRoute(){
  if(location.hash === "#all") openAll(true);
  else if(allOpen()) hideAll();
}
addEventListener("hashchange", syncAllRoute);
syncAllRoute();
