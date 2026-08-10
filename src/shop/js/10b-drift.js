/* ══════════════════════════════════════════════════════════
   PUSHING THE COLLECTION ALONG

   The shelf is two cards deep and goes where it is pushed. What
   is on it is decided in 09-grid.js, which is the collection
   itself — the chips, the sort and the budget bands all narrow
   the same list this draws.

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

/* The shelf is filled by paintGrid() in 09-grid.js — it is the collection
   now, so what goes on it is whatever the chips, the sort and the budget
   bands have narrowed it to. This file is only the pushing of it. */

/* ── the arrows, on a pointer only ──
   A mouse cannot swipe a scroll container. On touch the swipe is the
   control and an arrow is a thing to miss. One page is however much of the
   row is on screen, less one card, so nothing is ever stepped clean over. */
(function(){
  const rows = $("#driftRows");
  if(!rows) return;

  const track = () => $("#grid");

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
