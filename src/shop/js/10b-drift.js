/* ══════════════════════════════════════════════════════════
   THE WHOLE COLLECTION, DRIFTING

   Two rows carrying the entire catalogue, moving on their own
   in opposite directions.

   The trick a marquee needs is that the row has to hold its
   contents twice. The animation slides the track exactly half
   its own width and then snaps back to nought — and because
   the second half is a copy of the first, the frame it snaps
   to is identical to the frame it left, so nothing is seen to
   jump. Any other distance and the seam is visible on every
   lap.

   The duration is worked out from the width rather than fixed,
   so a shop of forty rakhis drifts at the same speed as a shop
   of ten instead of forty times faster. It is measured after
   the pictures have been laid out, because a track measured
   before them is a track measured empty.
   ══════════════════════════════════════════════════════════ */

/* px per second — slow enough to read a name off it in passing */
const DRIFT_SPEED = 26;

function driftTile(p){
  const off = (p.mrp && p.mrp > p.price) ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  return `
    <article class="dtile" data-go="${p.id}">
      <div class="dtile-shot">
        ${thumb(p)}${
        off ? `<span class="dtile-off">${off}% off</span>` : ""}
      </div>
      <div class="dtile-b">
        <h3 class="dtile-n">${esc(p.name)}</h3>
        <span class="dtile-p">${inr(p.price)}</span>
      </div>
    </article>`;
}

/* Split so that neither row is the other's leftovers: taking the first half
   for the top row would put every featured rakhi on one row and everything
   the seller ranked last on the other. Alternating gives both rows the same
   spread, top to bottom of the order. */
function driftSplit(){
  const pool = [...PRODUCTS].sort((a, b) => a.feat - b.feat);
  const a = [], b = [];
  pool.forEach((p, i) => (i % 2 ? b : a).push(p));
  return [a, b];
}

function driftFill(el, list){
  if(!el) return;
  if(!list.length){ el.innerHTML = ""; return; }
  /* twice, so the loop has somewhere identical to snap back to */
  const once = list.map(driftTile).join("");
  el.innerHTML = once + once;
}

/* The length of one lap, from the width the browser actually gave it. */
function driftTime(el){
  if(!el) return;
  const half = el.scrollWidth / 2;
  if(half < 40) return;                       /* nothing laid out yet */
  el.style.setProperty("--lap", (half / DRIFT_SPEED).toFixed(1) + "s");
  el.style.setProperty("--half", half.toFixed(1) + "px");
}

function paintDrift(){
  const sec = $("#showcase");
  if(!sec) return;
  const [a, b] = driftSplit();
  /* one row of one rakhi is not two rows of anything */
  sec.hidden = PRODUCTS.length < 4;
  if(sec.hidden) return;
  driftFill($("#driftA"), a);
  driftFill($("#driftB"), b);
  /* after layout, not during it — measured now the track is still 0 wide */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    driftTime($("#driftA"));
    driftTime($("#driftB"));
  }));
}
paintDrift();

/* ── letting somebody stop it ──
   A row that is still moving under a thumb is a row you tap the wrong
   rakhi on. Touching it holds it still, and it starts again a moment after
   the thumb leaves — long enough that a tap lands on what it was aimed at.

   Hover does the same thing on a pointer, in CSS. */
(function(){
  const rows = $("#driftRows");
  if(!rows) return;
  let go;
  const hold = () => { clearTimeout(go); rows.classList.add("held"); };
  const free = () => { clearTimeout(go); go = setTimeout(() => rows.classList.remove("held"), 900); };
  rows.addEventListener("pointerdown", hold, {passive:true});
  rows.addEventListener("pointerup", free, {passive:true});
  rows.addEventListener("pointercancel", free, {passive:true});
  rows.addEventListener("pointerleave", free, {passive:true});
  /* a tab nobody is looking at should not be animating anything */
  document.addEventListener("visibilitychange", () => {
    rows.classList.toggle("hidden-tab", document.hidden);
  });
})();

/* the rows are as wide as the window, so a resize changes the lap */
let driftFit;
addEventListener("resize", () => {
  clearTimeout(driftFit);
  driftFit = setTimeout(() => { driftTime($("#driftA")); driftTime($("#driftB")); }, 200);
}, {passive:true});
