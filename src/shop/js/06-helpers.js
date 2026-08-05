/* ══════════════════════════════════════════════════════════
   helpers
   ══════════════════════════════════════════════════════════ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* one observer reveals everything that scrolls into view */
const io=new IntersectionObserver(es=>{
  es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
},{rootMargin:"-50px"});
/* inr, esc, two, dayText and the order statuses live in
   src/shared/js/01-format.js — the dashboard needs the same ones */
const wa=m=>`https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(m)}`;
let toastT;
function toast(m){
  const t=$("#toast"); t.textContent=m; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200);
}
