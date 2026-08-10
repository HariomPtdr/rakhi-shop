/* ══════════════════════════════════════════════════════════
   THE WHOLE COLLECTION

   Two rows carrying the entire catalogue, pushed along by hand.

   They used to move on their own. A row that moves on its own
   is a row you cannot read: the thing you were about to look at
   walks off the edge, and the rakhi you meant to press is not
   where your thumb lands. Anything that has to be caught is not
   a shop, it is a fairground game. They sit still now and go
   where they are pushed.

   The card is the bestseller card without the shop's name over
   every one of them and without the tags — on a rail of six the
   name says whose these are, on a wall of the whole catalogue
   it is the same three words forty times.
   ══════════════════════════════════════════════════════════ */

/* Split by alternating rather than in half: taking the first half for the
   top row would put every featured rakhi on one row and everything the
   seller ranked last on the other. This gives both rows the same spread. */
function driftSplit(){
  const pool = [...PRODUCTS].sort((a, b) => a.feat - b.feat);
  const a = [], b = [];
  pool.forEach((p, i) => (i % 2 ? b : a).push(p));
  return [a, b];
}

function paintDrift(){
  const sec = $("#showcase");
  if(!sec) return;
  const [a, b] = driftSplit();
  /* one row of one rakhi is not two rows of anything */
  sec.hidden = PRODUCTS.length < 4;
  if(sec.hidden) return;
  const A = $("#driftA"), B = $("#driftB");
  if(A) A.innerHTML = a.map(p => railCard(p, {bare:true})).join("");
  if(B) B.innerHTML = b.map(p => railCard(p, {bare:true})).join("");
}
paintDrift();

/* ── the arrows, on a pointer only ──
   A mouse cannot swipe a scroll container. On touch the swipe is the
   control and an arrow is a thing to miss. One page is however much of the
   row is on screen, less one card, so nothing is ever stepped clean over. */
(function(){
  const rows = $("#driftRows");
  if(!rows) return;

  function page(row, dir){
    const card = row.querySelector(".rc");
    const step = card
      ? Math.max(row.clientWidth - card.getBoundingClientRect().width, card.getBoundingClientRect().width)
      : row.clientWidth * .8;
    row.scrollBy({left: dir * step, behavior: reduced ? "auto" : "smooth"});
  }

  rows.addEventListener("click", e => {
    const b = e.target.closest("[data-drift]");
    if(!b) return;
    const row = b.closest(".drift-row").querySelector(".drift-track");
    page(row, b.dataset.drift === "next" ? 1 : -1);
  });

  /* An arrow pointing at a wall is worse than no arrow: each one goes when
     there is nothing left that way. Checked on scroll rather than on a
     timer, and only once a frame. */
  let tick = false;
  function marks(){
    tick = false;
    $$(".drift-row").forEach(rw => {
      const tr = rw.querySelector(".drift-track");
      if(!tr) return;
      const max = tr.scrollWidth - tr.clientWidth;
      const prev = rw.querySelector('[data-drift="prev"]');
      const next = rw.querySelector('[data-drift="next"]');
      /* 2px of slack: a scroll position is a float and rarely lands on 0 */
      if(prev) prev.hidden = tr.scrollLeft <= 2;
      if(next) next.hidden = tr.scrollLeft >= max - 2 || max < 4;
    });
  }
  $$(".drift-track").forEach(tr =>
    tr.addEventListener("scroll", () => {
      if(tick) return;
      tick = true;
      requestAnimationFrame(marks);
    }, {passive:true}));

  /* after the pictures have been laid out, and again whenever the window
     changes what fits */
  requestAnimationFrame(() => requestAnimationFrame(marks));
  let fit;
  addEventListener("resize", () => { clearTimeout(fit); fit = setTimeout(marks, 200); }, {passive:true});
  window.driftMarks = marks;
})();
