/* ══════════════════════════════════════════════════════════
   THE HERO'S THREE PHOTOGRAPHS

   They cross-fade, and that is the whole of it. No library, no
   swipe, no dots: it is a backdrop, not something to operate.
   Nothing in it can be clicked, so there is nothing to reach
   with a keyboard and nothing for a screen reader to announce —
   the markup says aria-hidden and this file leaves it alone.

   Three things it does bother to get right:

     the first picture is the only one fetched while the page
     is still loading, because the other two are behind it and
     nobody is waiting on them;

     it stops when the tab is not being looked at, since a
     timer firing every few seconds in a background tab is a
     phone battery being spent on nobody;

     it does not run at all for somebody who has asked their
     device to keep still. Their first picture stays.
   ══════════════════════════════════════════════════════════ */
(() => {
  const stage  = document.querySelector(".hero-stage");
  if(!stage) return;
  const slides = [...stage.querySelectorAll(".hero-slide")];
  if(slides.length < 2) return;

  const still = matchMedia("(prefers-reduced-motion: reduce)");

  /* the two behind the first, once nothing is competing for the connection */
  const wake = () => slides.forEach(s => s.classList.remove("is-late"));
  if(document.readyState === "complete") setTimeout(wake, 400);
  else addEventListener("load", () => setTimeout(wake, 400), {once:true});

  const HOLD = 5200;
  let at = 0, timer = null;

  function step(){
    slides[at].classList.remove("is-on");
    at = (at + 1) % slides.length;
    slides[at].classList.add("is-on");
  }

  function start(){
    if(timer || still.matches) return;
    timer = setInterval(() => { if(!document.hidden) step(); }, HOLD);
  }
  function stop(){
    if(!timer) return;
    clearInterval(timer);
    timer = null;
  }

  /* A tab left open all afternoon should not come back mid-fade, and phones
     throttle timers in the background anyway — so it is stopped outright and
     started again on return. */
  addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  still.addEventListener("change", () => still.matches ? stop() : start());

  start();
})();
