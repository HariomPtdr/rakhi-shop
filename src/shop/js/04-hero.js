/* ══════════════════════════════════════════════════════════
   THE HERO'S THREE PHOTOGRAPHS

   A row four screens wide, moved one screen along at a time.
   The fourth picture is the first one again, so when the row
   reaches the end it is put back to the start with the
   transition switched off — the picture on screen is identical
   either side of that, so there is nothing to see.

   It moves on its own, and it can also be pushed. A picture
   that only changes on a timer asks you to wait for it; one
   that answers a finger is something you can look through. The
   timer stops the moment a drag begins and starts again when it
   ends, because nothing is more irritating than a slideshow
   advancing out from under the hand moving it.

   Three things it is careful about:

     the first picture is the only one fetched while the page is
     still loading, because the other two are off to the right
     of it and nobody is waiting on them;

     it stops when the tab is not being looked at, since a timer
     firing in a background tab is a phone battery spent on
     nobody;

     it does not move on its own at all for somebody who has
     asked their device to keep still — though they can still
     push it by hand, because that is their own doing.
   ══════════════════════════════════════════════════════════ */
(() => {
  const track = document.getElementById("heroTrack");
  if(!track) return;
  const hero = track.closest(".hero");
  const count = track.children.length;           /* three, plus the repeat */
  if(!hero || count < 3) return;

  const REAL = count - 1;                        /* how many are actually different */
  const STEP = 100 / count;                      /* one screen, as a share of the row */
  const HOLD = 7000;                             /* long enough to read the words under it */
  const GRAB = 55;                               /* px before a drag counts as a change */
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let at = 0, timer = null;

  /* The fourth picture is the first one, so the fourth mark is the first
     mark — modulo, and the row of dots never has to know about the repeat. */
  const dots = [...document.querySelectorAll("#heroDots i")];
  const mark = () => dots.forEach((d, i) => d.classList.toggle("on", i === at % REAL));

  const put = (dx) => {
    track.style.transform = dx
      ? `translate3d(calc(-${at * STEP}% + ${dx}px),0,0)`
      : `translate3d(-${at * STEP}%,0,0)`;
    if(!dx) mark();
  };
  /* apply a move with the transition off, in one frame */
  const snap = fn => {
    track.classList.add("is-jump");
    fn();
    void track.offsetWidth;
    track.classList.remove("is-jump");
  };

  /* the two to the right of the first, once nothing is competing for the
     connection */
  const wake = () => track.querySelectorAll(".is-late")
                          .forEach(s => s.classList.remove("is-late"));
  if(document.readyState === "complete") setTimeout(wake, 400);
  else addEventListener("load", () => setTimeout(wake, 400), {once:true});

  /* ── stepping, either way ──
     Both ends are handled before the move rather than after it. Going on
     from the repeat means jumping back to the first — same picture, so the
     jump cannot be seen — and moving off it; going back from the first
     means jumping to the repeat and moving off that.

     Before, and not after, because "after" meant a transitionend, and a
     transition can be cancelled: starting a drag switches the transition
     off to follow the finger, and a transition switched off mid-flight
     never ends. Interrupt the row on its way to the repeat and the reset
     was simply never delivered — the row stayed on the fourth picture, and
     the next step took it to a fifth that does not exist, which is a
     screen of nothing. Nothing here now depends on an event a finger can
     cancel. */
  function next(){
    if(at >= REAL) snap(() => { at = 0; put(); });
    at++; put();
  }
  function prev(){
    if(at <= 0) snap(() => { at = REAL; put(); });
    at--; put();
  }

  /* The row can still settle on the repeat by itself, with nothing
     interrupting it. Putting it back keeps the count small; if this never
     arrives, next() covers the same ground. */
  track.addEventListener("transitionend", e => {
    if(e.propertyName === "transform" && at >= REAL) snap(() => { at = 0; put(); });
  });

  function start(){
    if(timer || still.matches) return;
    timer = setInterval(() => { if(!document.hidden) next(); }, HOLD);
  }
  function stop(){ clearInterval(timer); timer = null; }

  /* ── pushing it by hand ──
     The stage sits behind the words, so the whole hero listens. Which means
     telling a drag apart from a tap on Shop now, and from a thumb starting
     a vertical scroll: the first eight pixels decide which of the three it
     is, and until they do nothing moves. */
  let down = false, sx = 0, sy = 0, dx = 0, decided = false, sideways = false;

  hero.addEventListener("pointerdown", e => {
    if(e.pointerType === "mouse" && e.button !== 0) return;
    down = true; decided = false; sideways = false;
    sx = e.clientX; sy = e.clientY; dx = 0;
    stop();
  });

  hero.addEventListener("pointermove", e => {
    if(!down) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if(!decided){
      if(Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      decided = true;
      sideways = Math.abs(mx) > Math.abs(my);
      if(!sideways){ down = false; start(); return; }   /* they are scrolling */
      track.classList.add("is-jump");                   /* follow the finger exactly */
    }
    dx = mx;
    put(dx);
  }, {passive:true});

  function release(){
    if(!down) return;
    down = false;
    if(sideways){
      track.classList.remove("is-jump");
      if(dx <= -GRAB)      next();
      else if(dx >= GRAB)  prev();
      else                 put();                       /* not far enough — back */
    }
    dx = 0;
    start();
  }
  hero.addEventListener("pointerup", release);
  hero.addEventListener("pointercancel", release);
  hero.addEventListener("pointerleave", release);

  /* A drag that ends on Shop now must not also press it. */
  hero.addEventListener("click", e => {
    if(sideways && Math.abs(dx) > 8){ e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* A tab left open all afternoon should not come back mid-slide, and phones
     throttle timers in the background anyway — so it is stopped outright and
     started again on return. */
  addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  still.addEventListener("change", () => still.matches ? stop() : start());

  mark();
  start();
})();

/* ══════════════════════════════════════════════════════════
   THE BAR'S BACKGROUND, OR THE LACK OF ONE

   Over the hero it has none — it is the hero's own card stock,
   which is the only way a floating bar over a picture avoids
   reading as a panel cut out and laid on top of it. Once the
   hero has gone past, it needs one: below here the bar floats
   over the catalogue, and text scrolling under text cannot be
   read.

   It takes the pill as soon as the page moves at all — a
   pixel watched just below the top of the document, so the
   first bit of scroll crosses it. Held back until the whole
   hero had gone by, the bar spent most of the first screen
   looking like it had come loose from the page.

   A watcher on one pixel rather than a scroll handler. The
   browser reports the crossing itself; nothing runs on the
   frames in between, which is the difference between this and
   a listener that fires all the way down the page.
   ══════════════════════════════════════════════════════════ */
(() => {
  const mark = document.createElement("div");
  mark.setAttribute("aria-hidden", "true");
  mark.style.cssText = "position:absolute;top:24px;left:0;width:1px;height:1px;pointer-events:none";
  document.body.appendChild(mark);
  new IntersectionObserver(([e]) => {
    document.body.classList.toggle("nav-solid", !e.isIntersecting);
  }).observe(mark);
})();
