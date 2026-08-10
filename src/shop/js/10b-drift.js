/* ══════════════════════════════════════════════════════════
   THE COLLECTION

   One shelf carrying the entire catalogue, two cards deep,
   pushed along by hand.

   It was two rows that scrolled separately. That meant swiping
   twice to see the same catalogue, and the pairing — which
   rakhi sat above which — was decided by nothing. One grid
   filling column by column moves as one thing under one thumb.

   It used to move on its own, too. A row that moves on its own
   is a row you cannot read: the thing you were about to look at
   walks off the edge, and the rakhi you meant to press is not
   where your thumb lands.

   The card is the bestseller card without the shop's name over
   every one of them and without the tags — on a rail of six the
   name says whose these are, on a wall of the whole catalogue
   it is the same three words forty times.
   ══════════════════════════════════════════════════════════ */

/* One list, in the seller's own order. The grid lays it out down-then-
   across, so the shelf fills column by column and the order still reads
   left to right — which is the order somebody swiping through it meets
   them in. No splitting: two lists meant deciding which rakhi went above
   which, and there was never an answer to that. */
function paintDrift(){
  const sec = $("#showcase");
  if(!sec) return;
  /* one shelf of one rakhi is not a collection */
  sec.hidden = PRODUCTS.length < 4;
  if(sec.hidden) return;
  const A = $("#driftA");
  if(A) A.innerHTML = [...PRODUCTS].sort((a, b) => a.feat - b.feat)
    .map(p => railCard(p, {bare:true})).join("");
}
paintDrift();

/* ── the arrows, on a pointer only ──
   A mouse cannot swipe a scroll container. On touch the swipe is the
   control and an arrow is a thing to miss. One page is however much of the
   row is on screen, less one card, so nothing is ever stepped clean over. */
(function(){
  const rows = $("#driftRows");
  if(!rows) return;

  const track = () => $("#driftA");

  function page(dir){
    const row = track();
    if(!row) return;
    const card = row.querySelector(".rc");
    /* a page, less one card, so nothing is ever stepped clean over */
    const step = card
      ? Math.max(row.clientWidth - card.getBoundingClientRect().width, card.getBoundingClientRect().width)
      : row.clientWidth * .8;
    row.scrollBy({left: dir * step, behavior: reduced ? "auto" : "smooth"});
  }

  rows.addEventListener("click", e => {
    const b = e.target.closest("[data-drift]");
    if(b) page(b.dataset.drift === "next" ? 1 : -1);
  });

  /* An arrow pointing at a wall is worse than no arrow: each one goes when
     there is nothing left that way. Checked on scroll rather than on a
     timer, and only once a frame. */
  let tick = false;
  function marks(){
    tick = false;
    const tr = track();
    if(!tr) return;
    const max = tr.scrollWidth - tr.clientWidth;
    const prev = rows.querySelector('[data-drift="prev"]');
    const next = rows.querySelector('[data-drift="next"]');
    /* 2px of slack: a scroll position is a float and rarely lands on 0 */
    if(prev) prev.hidden = tr.scrollLeft <= 2;
    if(next) next.hidden = tr.scrollLeft >= max - 2 || max < 4;
  }
  rows.addEventListener("scroll", () => {
    if(tick) return;
    tick = true;
    requestAnimationFrame(marks);
  }, {passive:true, capture:true});

  /* after the pictures have been laid out, and again whenever the window
     changes what fits */
  requestAnimationFrame(() => requestAnimationFrame(marks));
  let fit;
  addEventListener("resize", () => { clearTimeout(fit); fit = setTimeout(marks, 200); }, {passive:true});
  window.driftMarks = marks;
})();
