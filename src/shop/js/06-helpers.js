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

/* ══════════════════════════════════════════════════════════
   the tags on a rakhi

   A rakhi sits on one shelf — that is `cat`, and it is what the
   chips above the collection sort by. Tags are everything else
   true about it: an evil eye rakhi that is also a designer one,
   a kids rakhi that is also a cartoon one.

   Written once here because the same chips are drawn on the
   bestseller card, in the collection and on the rakhi's own page,
   and three copies of this would have drifted apart by the third
   time somebody changed the wording.

   A tag is stored lowercase and hyphenated so that "Evil Eye",
   "evil eye" and "evil-eye" are one tag rather than three; it is
   shown back the way it reads.

   They are labels and nothing else. They were buttons that filtered
   the shop, which meant a tap on a card did one of two different
   things depending on which two millimetres of it you hit — and the
   card's own job is to open the rakhi. The chips above the
   collection are where filtering lives.
   ══════════════════════════════════════════════════════════ */
const tagKey   = t => String(t).trim().toLowerCase().replace(/\s+/g, "-");
const tagLabel = t => String(t).replace(/-/g, " ")
                       .replace(/\b\w/g, c => c.toUpperCase());

/* max: a card is not a place for eleven of them. The rakhi's own page
   passes Infinity, because that is where the whole list belongs.

   quiet: leave off the "+2" that says how many did not fit. On the
   bestseller card it was a third chip taking a second row to report that
   there was not room for a third chip. */
function tagChips(p, max, quiet){
  const list = (p && p.tags || []).map(tagKey).filter(Boolean);
  if(!list.length) return "";
  const seen = new Set(), keep = [];
  list.forEach(t => { if(!seen.has(t)){ seen.add(t); keep.push(t); } });
  const cap = max == null ? 3 : max;
  const shown = keep.slice(0, cap);
  const rest  = keep.length - shown.length;
  return `<div class="tags">${shown.map(t =>
    `<span class="tag">${esc(tagLabel(t))}</span>`
  ).join("")}${rest > 0 && !quiet ? `<span class="tag tag-more">+${rest}</span>` : ""}</div>`;
}
