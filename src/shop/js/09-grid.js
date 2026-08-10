/* ══════════════════════════════════════════════════════════
   collection
   ══════════════════════════════════════════════════════════ */
let state = { cat:"all", band:null, sort:"feat" };
/* catalogue numbers follow the order of the list; rebuilt if the list is
   later replaced by the one in the database */
let IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)]));
const numberCatalogue = ()=>{ IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)])); };

$("#chips").innerHTML = CATS.map(c=>
  `<button class="chip" data-c="${c.k}" aria-pressed="${c.k===state.cat}">${c.n}</button>`).join("");
$("#chips").addEventListener("click", e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  state.cat=b.dataset.c;
  state.band=null;              /* one filter at a time; the chips are the way out */
  $$("#chips .chip").forEach(c=>c.setAttribute("aria-pressed", String(c.dataset.c===state.cat)));
  paintGrid();
});
/* ── the sort listbox ──────────────────────────────────────
   Replaces a native <select>, so it has to reimplement what the
   browser gave us for free: keyboard control, roving focus, and
   closing on Escape or a tap outside.
   ───────────────────────────────────────────────────────── */
const SORTS = [
  {k:"feat", n:"Featured"},
  {k:"lo",   n:"Price low to high"},
  {k:"hi",   n:"Price high to low"},
  {k:"az",   n:"Name A–Z"}
];
const sortBtn = $("#sortBtn"), sortMenu = $("#sortMenu");
let sortHot = 0;

sortMenu.innerHTML = SORTS.map((o,i)=>
  `<li role="option" id="sort-${o.k}" data-k="${o.k}" aria-selected="${o.k===state.sort}" tabindex="-1">${o.n}</li>`
).join("");

const sortItems = () => [...sortMenu.children];
function paintSort(){
  $("#sortNow").textContent = (SORTS.find(o=>o.k===state.sort)||SORTS[0]).n;
  sortItems().forEach(li=>li.setAttribute("aria-selected", String(li.dataset.k===state.sort)));
}
function hotSort(i){
  sortHot = (i + SORTS.length) % SORTS.length;
  sortItems().forEach((li,n)=>li.classList.toggle("hot", n===sortHot));
  sortItems()[sortHot].focus();
}
function openSort(){
  sortMenu.hidden = false;
  sortBtn.setAttribute("aria-expanded","true");
  hotSort(Math.max(0, SORTS.findIndex(o=>o.k===state.sort)));
}
function closeSort(refocus){
  if(sortMenu.hidden) return;
  sortMenu.hidden = true;
  sortBtn.setAttribute("aria-expanded","false");
  sortItems().forEach(li=>li.classList.remove("hot"));
  if(refocus) sortBtn.focus();
}
function pickSort(k){
  state.sort = k;
  paintSort(); paintGrid();
  closeSort(true);
}

sortBtn.addEventListener("click", ()=>{ sortMenu.hidden ? openSort() : closeSort(true); });
sortMenu.addEventListener("click", e=>{
  const li = e.target.closest("li[data-k]");
  if(li) pickSort(li.dataset.k);
});
sortBtn.addEventListener("keydown", e=>{
  if(e.key === "ArrowDown" || e.key === "Enter" || e.key === " "){ e.preventDefault(); openSort(); }
});
sortMenu.addEventListener("keydown", e=>{
  switch(e.key){
    case "ArrowDown": e.preventDefault(); hotSort(sortHot + 1); break;
    case "ArrowUp":   e.preventDefault(); hotSort(sortHot - 1); break;
    case "Home":      e.preventDefault(); hotSort(0); break;
    case "End":       e.preventDefault(); hotSort(SORTS.length - 1); break;
    case "Enter":
    case " ":         e.preventDefault(); pickSort(SORTS[sortHot].k); break;
    case "Escape":    e.preventDefault(); closeSort(true); break;
    case "Tab":       closeSort(false); break;
  }
});
/* a tap anywhere else, or a scroll, dismisses it */
document.addEventListener("pointerdown", e=>{
  if(!sortMenu.hidden && !e.target.closest(".sortwrap")) closeSort(false);
}, true);
addEventListener("scroll", ()=>closeSort(false), {passive:true});
paintSort();

function thumb(p, full){
  /* data-fb marks a photo that can be replaced by the drawing if it fails to
     load — a missing file in the bucket should not leave a broken picture */
  if(p.img) return `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy"
    width="480" height="480" data-fb="${p.id}">`;
  return `<img class="art" src="${asSrc(art(p.art, full))}" alt="Drawing of ${esc(p.name)}" loading="lazy">`;
}
/* error does not bubble, so this listens in the capture phase */
addEventListener("error", e=>{
  const img = e.target;
  if(!img || img.tagName !== "IMG" || !img.dataset || !img.dataset.fb) return;
  const p = PRODUCTS.find(x=>x.id === img.dataset.fb);
  img.dataset.fb = "";                              /* try this once only */
  if(!p) return;
  img.classList.add("art");
  img.src = asSrc(art(p.art, true));
  img.alt = "Drawing of " + p.name;
  const box = img.closest(".card-top, .rc-shot, .pv-frame");
  const tag = box && box.querySelector(".pill, .rc-tag, .pv-badge");
  if(tag){
    tag.textContent = "Drawing";
    tag.classList.remove("pill-real", "real");
    tag.classList.add(tag.classList.contains("pill") ? "pill-art" : "art");
  }
}, true);
function visible(){
  const by={feat:(a,b)=>a.feat-b.feat, lo:(a,b)=>a.price-b.price,
            hi:(a,b)=>b.price-a.price, az:(a,b)=>a.name.localeCompare(b.name)}[state.sort];
  const band = state.band && BANDS.find(b => b.k === state.band);
  return PRODUCTS
    .filter(p => state.cat === "all" || p.cat === state.cat)
    .filter(p => !band || (p.price >= band.lo && p.price < band.hi))
    .sort(by);
}
/* ── how much of the collection is on the shelf ──
   Building a few hundred cards in one go is a long first paint and a lot of
   DOM for a phone to hold, for a customer who will look at the first six.
   They arrive a handful at a time, appended as the shelf is pushed towards
   its end, so the end of it is never actually reached. The count above it
   still says how many there are altogether. */
const PAGE = 12;
let shown = PAGE;

function paintGrid(){
  const list = visible();
  shown = Math.min(PAGE, list.length);   /* a new filter or sort starts at the left */
  $("#rCount").textContent = `${two(list.length)} ${list.length === 1 ? "design" : "designs"}`;
  const box = $("#grid");
  box.innerHTML = list.slice(0, shown).map(cardHtml).join("");
  box.scrollLeft = 0;
  if(typeof driftMarks === "function") driftMarks();
}

/* the next handful, appended rather than repainted: rebuilding the cards
   already on the shelf would drop their images and flash the whole thing */
function showMore(){
  const list = visible();
  if(shown >= list.length) return;
  const next = list.slice(shown, shown + PAGE);
  shown += next.length;
  $("#grid").insertAdjacentHTML("beforeend", next.map(cardHtml).join(""));
  if(typeof paintHearts === "function") paintHearts();
  if(typeof driftMarks === "function") driftMarks();
}

/* Fetched ahead of the push rather than on a timer, so a shelf nobody
   touches never builds a card nobody asked to see. A card and a half from
   the end is far enough ahead that the next ones are there before the last
   one is. */
$("#grid").addEventListener("scroll", () => {
  const el = $("#grid");
  if(el.scrollWidth - (el.scrollLeft + el.clientWidth) < 340) showMore();
}, {passive:true});

/* One card for the whole shop. The shelf used to carry a different one —
   a number in the corner, a Photo/Drawing tag, the description, "per
   piece" — which meant the same rakhi looked like two different offers
   depending on which row of the page you met it in. */
function cardHtml(p){
  return railCard(p, {bare:true});
}

/* Add and View are handled once for every card, in 06b-cardacts.js */
const closeLb=fromBack=>{
  if(!isOn("#lb")) return;
  $("#lb").classList.remove("on");
  afterClose(fromBack);
};
/* wrapped, not passed straight in: a click event as `fromBack` reads as
   "the back button did this" and leaves the pushed history entry behind */
$("#lbX").onclick = ()=>closeLb();
$("#lb").addEventListener("click", ()=>closeLb());

/* ══════════════════════════════════════════════════════════
   SHOP BY CATEGORY → the chips below

   A card that only jumped to the collection would land somebody
   on the whole catalogue and leave them to narrow it down by
   hand — having just told us exactly what they wanted. So it
   sets the filter first and then goes, and the chip is pressed
   when they arrive, which is also how they see how to get back
   out to everything.
   ══════════════════════════════════════════════════════════ */
const catRail = $("#catRail");
if(catRail) catRail.addEventListener("click", e => {
  const a = e.target.closest("[data-cat]");
  if(!a) return;
  e.preventDefault();
  state.cat = a.dataset.cat;
  $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === state.cat)));
  paintGrid();
  /* the chip row scrolls too — a pressed chip off the side of the screen is
     a filter nobody can see they are inside of */
  const chip = $(`#chips .chip[data-c="${state.cat}"]`);
  if(chip) chip.scrollIntoView({block:"nearest", inline:"center"});
  document.getElementById("collection").scrollIntoView({behavior: reduced ? "auto" : "smooth", block:"start"});
});


/* ══════════════════════════════════════════════════════════
   SHOP BY BUDGET

   People arrive with a number in their head far more often
   than a category: a hundred rupees for a cousin, three for a
   brother. This asks that question directly.

   The bands are fixed but the row is not — a band with nothing
   in it is not drawn. Today three of the five appear, because
   nothing here costs more than ₹199; the day something does,
   its band arrives on its own. A price filter that offers an
   empty shelf is worse than one that offers fewer.
   ══════════════════════════════════════════════════════════ */
const BANDS = [
  {k:"b1", lo:0,   hi:50,       n:"Under ₹50",   s:"Budget Friendly<br>Simple Yet Meaningful", img:"budget-under-50.webp"},
  {k:"b2", lo:50,  hi:100,      n:"₹50 – ₹100",  s:"Budget Friendly<br>Simple Yet Meaningful", img:"budget-50-100.webp"},
  {k:"b3", lo:100, hi:200,      n:"₹100 – ₹200", s:"Budget Friendly<br>Simple Yet Meaningful", img:"budget-100-200.webp"},
  {k:"b4", lo:200, hi:300,      n:"₹200 – ₹300", s:"Premium Quality<br>Elegance That Lasts", img:"budget-200-300.webp"},
  {k:"b5", lo:300, hi:Infinity,  n:"Above ₹300",  s:"Luxury Redefined<br>Crafted to Perfection", img:"budget-above-300.webp"}
];

function paintBudget(){
  const rail = $("#budRail");
  if(!rail) return;
  const rows = BANDS.map(b => {
    const inIt = PRODUCTS.filter(p => p.price >= b.lo && p.price < b.hi);
    return {b, inIt};
  }).filter(r => r.inIt.length);

  /* one band left standing is not a choice, it is a label */
  $("#budget").hidden = rows.length < 2;
  if(rows.length < 2) return;

  rail.innerHTML = rows.map(({b, inIt}, i) => {
    /* Use promotional image if available, otherwise fall back to product thumbnail */
    const imgHtml = b.img 
      ? `<img src="../../assets/images/${b.img}" alt="${b.n} rakhis" width="660" height="660" loading="lazy" decoding="async">`
      : thumb([...inIt].sort((x, y) => y.price - x.price)[0]);
    return `
      <button class="bud" data-band="${b.k}" type="button">
        <span class="bud-o t${i % 5}">${imgHtml}</span>
        <span class="bud-n">${b.n}</span>
        <span class="bud-s">${b.s}</span>
      </button>`;
  }).join("");
}
paintBudget();

$("#budRail").addEventListener("click", e => {
  const b = e.target.closest("[data-band]");
  if(!b) return;
  state.band = b.dataset.band;
  state.cat  = "all";           /* a price and a category at once is how you get nothing */
  $$("#chips .chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.c === "all")));
  paintGrid();
  document.getElementById("collection").scrollIntoView({behavior: reduced ? "auto" : "smooth", block:"start"});
});
