/* ══════════════════════════════════════════════════════════
   Sheets: the cart, the bill and the zoom view.

   Two things have to be right here, and both bit me:

   1. Locking the body is the only reliable way to stop the page
      scrolling behind an open sheet on iOS, and the scroll
      position must be saved and restored by hand. A boolean —
      not a counter — because a counter drifts out of balance the
      moment one path forgets to pair its calls.

   2. history.back() is ASYNCHRONOUS. Popping an entry while
      opening the next sheet meant the popstate landed after the
      new sheet was up and closed it again. So: ONE history entry
      covers "a sheet is open", and moving between sheets does not
      touch history at all.
   ══════════════════════════════════════════════════════════ */
let lockY = 0, isLocked = false;
function lock(){
  if(isLocked) return;
  isLocked = true;
  lockY = scrollY;
  document.body.style.top = (-lockY) + "px";
  document.body.classList.add("locked");
}
function unlock(){
  if(!isLocked) return;
  isLocked = false;
  document.body.classList.remove("locked");
  document.body.style.top = "";
  /* instant, not smooth — otherwise the page visibly slides back */
  const prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, lockY);
  document.documentElement.style.scrollBehavior = prev;
}

const isOn = sel => $(sel).classList.contains("on");
/* Two different questions, and confusing them left a blur on the screen:
   — sheetOpen: is a dimmed sheet up? decides the scrim and the history entry.
   — anyOpen:   is anything up at all? decides only the body scroll lock.
   The product page is not a sheet. It holds the lock but must never keep
   the scrim alive, or closing the zoom over it strands the dim layer. */
const sheetOpen = () => isOn("#drawer") || isOn("#billModal") || isOn("#lb")
                     || isOn("#acctModal") || isOn("#navModal");
const anyOpen = () => sheetOpen()
                   || (typeof productOpen === "function" && productOpen());

/* Android's back button closes the sheet instead of leaving the shop */
let sheetHist = false;
function histOpen(){
  if(sheetHist) return;
  sheetHist = true;
  history.pushState({sheet:1}, "");
}
function histClose(){
  if(!sheetHist) return;
  sheetHist = false;
  history.back();
}
addEventListener("popstate", ()=>{
  if(!sheetHist) return;
  sheetHist = false;                 // the entry is already gone
  $("#lb").classList.remove("on");
  $("#acctModal").classList.remove("on");
  $("#navModal").classList.remove("on");
  $("#billModal").classList.remove("on");
  $("#drawer").classList.remove("on");
  $("#scrim").classList.remove("on");
  /* the product page is not a sheet — if it is still showing, the page
     behind it must stay locked */
  if(!anyOpen()) unlock();
});

/* called after any sheet hides: tidy up only if nothing is left open */
function afterClose(fromBack){
  if(sheetOpen()) return;              /* another sheet is still on top */
  $("#scrim").classList.remove("on");
  if(!anyOpen()) unlock();             /* the product page keeps the lock */
  if(!fromBack) histClose();
}
function openSheet(sel){
  $(sel).classList.add("on");
  $("#scrim").classList.add("on");
  lock();                              /* no-op when already locked */
  histOpen();
}

const openCart  = ()=>{ if(!isOn("#drawer")) openSheet("#drawer"); };
const closeCart = fromBack =>{
  if(!isOn("#drawer")) return;
  $("#drawer").classList.remove("on");
  afterClose(fromBack);
};
$("#cartOpen").onclick=openCart; $("#cartClose").onclick=()=>closeCart();
$("#cbGo").onclick=openCart;
$("#pvCart").onclick=openCart;

/* drag the sheet down to dismiss it, the way a native sheet behaves */
(function(){
  const dr=$("#drawer");
  let y0=null, dy=0;
  const start=e=>{
    if(matchMedia("(min-width:720px)").matches) return;
    y0=e.touches[0].clientY; dy=0; dr.style.transition="none";
  };
  const move=e=>{
    if(y0===null) return;
    dy=Math.max(0, e.touches[0].clientY-y0);
    dr.style.transform="translateY("+dy+"px)";
  };
  const end=()=>{
    if(y0===null) return;
    dr.style.transition=""; dr.style.transform="";
    if(dy>90) closeCart();
    y0=null;
  };
  [$("#grab"), $("#drT").parentElement].forEach(el=>{
    el.addEventListener("touchstart", start, {passive:true});
    el.addEventListener("touchmove",  move,  {passive:true});
    el.addEventListener("touchend",   end);
    el.addEventListener("touchcancel",end);
  });
})();
/* one place decides what "close" means, so the scrim, the ✕ buttons and
   Escape can never disagree about which sheet is on top */
function closeTop(){
  if(isOn("#lb"))        return closeLb();
  if(isOn("#acctModal")) return closeAcct();
  if(isOn("#navModal"))  return closeNav();
  if(isOn("#billModal")) return closeBill();
  closeCart();
}

/* ── the menu ──
   The header's five links do not fit on a phone, so they live here instead.
   Tapping one closes the sheet first and then jumps, or the browser scrolls
   the page underneath a sheet that is still covering it. */
function openNav(){
  openSheet("#navModal");
  $("#navOpen").setAttribute("aria-expanded", "true");
}
function closeNav(fromBack){
  if(!isOn("#navModal")) return;
  $("#navModal").classList.remove("on");
  $("#navOpen").setAttribute("aria-expanded", "false");
  afterClose(fromBack);
}
$("#navOpen").onclick  = openNav;
$("#navClose").onclick = () => closeNav();
$("#navModal").addEventListener("click", e => { if(e.target.id === "navModal") closeNav(); });
$("#navSheet").addEventListener("click", e => {
  const a = e.target.closest("a[href^='#']");
  if(!a) return;
  e.preventDefault();
  const target = document.querySelector(a.getAttribute("href"));
  closeNav();
  /* after the scroll lock is released, not before */
  requestAnimationFrame(() => { if(target) target.scrollIntoView({behavior:"smooth"}); });
});
$("#scrim").onclick = closeTop;
document.addEventListener("keydown", e=>{
  if(e.key !== "Escape") return;
  if(!$("#sortMenu").hidden) return;   // the sort menu handles its own Escape
  closeTop();
});
