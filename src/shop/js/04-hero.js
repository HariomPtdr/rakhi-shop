/* ══════════════════════════════════════════════════════════
   THE HERO'S THREE PHOTOGRAPHS

   A row four screens wide, moved one screen along every few
   seconds. The fourth picture is the first one again, so when
   the row reaches the end it is put back to the start with the
   transition switched off — the picture on screen is identical
   either side of that, so there is nothing to see.

   It is a backdrop, not something to operate: nothing in it can
   be clicked, so there is nothing to reach with a keyboard and
   nothing for a screen reader to announce. The markup says
   aria-hidden and this file leaves it alone.

   Three things it does bother to get right:

     the first picture is the only one fetched while the page is
     still loading, because the other two are off to the right
     of it and nobody is waiting on them;

     it stops when the tab is not being looked at, since a timer
     firing every few seconds in a background tab is a phone
     battery being spent on nobody;

     it does not run at all for somebody who has asked their
     device to keep still. Their first picture stays.
   ══════════════════════════════════════════════════════════ */
(() => {
  const track = document.getElementById("heroTrack");
  if(!track) return;
  const slides = track.children.length;      /* three, plus the repeat */
  if(slides < 3) return;

  const REAL = slides - 1;                   /* how many are actually different */
  const STEP = 100 / slides;                 /* one screen, as a share of the row */
  const HOLD = 5200;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  let at = 0, timer = null;
  const put = () => { track.style.transform = `translate3d(-${at * STEP}%,0,0)`; };

  /* the two to the right of the first, once nothing is competing for the
     connection */
  const wake = () => track.querySelectorAll(".is-late")
                          .forEach(s => s.classList.remove("is-late"));
  if(document.readyState === "complete") setTimeout(wake, 400);
  else addEventListener("load", () => setTimeout(wake, 400), {once:true});

  function step(){
    at++;
    put();
  }

  /* Landed on the repeat: same picture, so the row can be moved back to the
     start without the transition and nobody is any the wiser. Reading
     offsetWidth in between is what makes the browser apply the jump before
     the transition is turned back on, rather than animating it. */
  track.addEventListener("transitionend", e => {
    if(e.propertyName !== "transform" || at < REAL) return;
    track.classList.add("is-jump");
    at = 0;
    put();
    void track.offsetWidth;
    track.classList.remove("is-jump");
  });

  function start(){
    if(timer || still.matches) return;
    timer = setInterval(() => { if(!document.hidden) step(); }, HOLD);
  }
  function stop(){
    if(!timer) return;
    clearInterval(timer);
    timer = null;
  }

  /* A tab left open all afternoon should not come back mid-slide, and phones
     throttle timers in the background anyway — so it is stopped outright and
     started again on return. */
  addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  still.addEventListener("change", () => still.matches ? stop() : start());

  start();
})();
