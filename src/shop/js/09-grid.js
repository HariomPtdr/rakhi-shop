/* ══════════════════════════════════════════════════════════
   collection
   ══════════════════════════════════════════════════════════ */
/* ── two shelves, two filters ──
   The shelf on the home page and the full collection behind "View all" are
   two different views of the same catalogue, and they were sharing one
   filter. Narrowing the collection to Kids rakhis quietly narrowed the home
   shelf behind it, so closing the view left the home page holding a filter
   nobody had set there and no chip on screen saying so.

   `state` is the home shelf: it is set by the Shop by Category cards and the
   Shop by Budget bands, which are the only controls next to it.
   `apState` is the full collection: the chips, the sort and the filter sheet,
   all of which live inside that view. Neither writes to the other. */
let state   = { cat:"all", band:null, sort:"feat", tag:null, stock:false };
let apState = { cat:"all", band:null, sort:"feat", tag:null, stock:false };
/* catalogue numbers follow the order of the list; rebuilt if the list is
   later replaced by the one in the database */
let IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)]));
const numberCatalogue = ()=>{ IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)])); };

/* The chips live inside the full collection, so they narrow that view and
   nothing else. */
$("#chips").innerHTML = CATS.map(c=>
  `<button class="chip" data-c="${c.k}" aria-pressed="${c.k===apState.cat}">${c.n}</button>`).join("");
$("#chips").addEventListener("click", e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  apState.cat=b.dataset.c;
  apState.band=null;            /* one filter at a time; the chips are the way out */
  $$("#chips .chip").forEach(c=>c.setAttribute("aria-pressed", String(c.dataset.c===apState.cat)));
  paintAll();
  /* the address follows the chip: a shelf chosen here is the same page as a
     shelf arrived at from a category card, and it can be sent to somebody */
  if(typeof apSyncHash === "function") apSyncHash();
});
/* ── the sort listbox ──────────────────────────────────────
   Replaces a native <select>, so it has to reimplement what the
   browser gave us for free: keyboard control, roving focus, and
   closing on Escape or a tap outside.
   ───────────────────────────────────────────────────────── */
/* ── the ways of ordering it ──
   Each one carries a mark and a line saying what it does. A list of four
   phrases all starting with "Price" is four things to read carefully; a
   mark beside each is one to recognise. */
const SORTS = [
  {k:"feat", n:"Featured",     s:"What the shop shows first",
   i:`<path d="M12 3.6l2.5 5.3 5.7.8-4.2 4 1 5.7-5-2.7-5 2.7 1-5.7-4.2-4 5.7-.8Z"/>`},
  {k:"lo",   n:"Price: low to high", s:"The gentlest first",
   i:`<path d="M4 19.5 19.5 4.5M19.5 4.5H13M19.5 4.5V11"/>`},
  {k:"hi",   n:"Price: high to low", s:"The finest first",
   i:`<path d="M4 4.5 19.5 19.5M19.5 19.5H13M19.5 19.5V13"/>`},
  {k:"az",   n:"Name A–Z",     s:"Straight down the list",
   i:`<path d="M4.5 19.5 9 5l4.5 14.5M6 15h6M17 5v14M17 19l-2.4-2.6M17 19l2.4-2.6"/>`}
];
const sortBtn = $("#sortBtn"), sortMenu = $("#sortMenu");
let sortHot = 0;

sortMenu.innerHTML = SORTS.map(o => `
  <li role="option" id="sort-${o.k}" data-k="${o.k}"
      aria-selected="${o.k === apState.sort}" tabindex="-1">
    <span class="so-i" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round">${o.i}</svg>
    </span>
    <span class="so-t"><b>${o.n}</b><i>${o.s}</i></span>
    <span class="so-r" aria-hidden="true"></span>
  </li>`).join("");

const sortItems = () => [...sortMenu.children];
function paintSort(){
  $("#sortNow").textContent = (SORTS.find(o=>o.k===apState.sort)||SORTS[0]).n;
  sortItems().forEach(li=>li.setAttribute("aria-selected", String(li.dataset.k===apState.sort)));
}
function hotSort(i){
  sortHot = (i + SORTS.length) % SORTS.length;
  sortItems().forEach((li,n)=>li.classList.toggle("hot", n===sortHot));
  sortItems()[sortHot].focus();
}
function openSort(){
  sortMenu.hidden = false;
  sortBtn.setAttribute("aria-expanded","true");
  hotSort(Math.max(0, SORTS.findIndex(o=>o.k===apState.sort)));
}
function closeSort(refocus){
  if(sortMenu.hidden) return;
  sortMenu.hidden = true;
  sortBtn.setAttribute("aria-expanded","false");
  sortItems().forEach(li=>li.classList.remove("hot"));
  if(refocus) sortBtn.focus();
}
function pickSort(k){
  apState.sort = k;
  paintSort(); paintAll();
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
/* Whose filter to read: the home shelf's by default, the collection's when
   that view asks. */
/* ── the bestsellers ──
   The seller's ticks, where there are enough of them to be a page: fewer
   than four ticked is not a shelf of favourites, it is a shelf of one, so
   the featured order stands in — which is exactly what the row on the home
   page shows, and it is the same answer to the same question. */
function bestPool(){
  const flagged = PRODUCTS.filter(p => p.best);
  if(flagged.length >= 4) return flagged;
  return [...PRODUCTS].sort((a,b) => (a.feat || 999) - (b.feat || 999))
                      .slice(0, Math.min(8, PRODUCTS.length));
}

function visible(st){
  st = st || state;
  const by={feat:(a,b)=>a.feat-b.feat, lo:(a,b)=>a.price-b.price,
            hi:(a,b)=>b.price-a.price, az:(a,b)=>a.name.localeCompare(b.name)}[st.sort];
  /* A budget page carries its band in the view key — "b:b2" — because the
     view key is what the address, the banner and the bar are built from.
     Unpacked here so that everything downstream sees a plain band. */
  let cat = st.cat, bk = st.band;
  if(typeof cat === "string" && cat.startsWith("b:")){ bk = cat.slice(2); cat = "all"; }
  const band = bk && BANDS.find(b => b.k === bk);
  const best = cat === "best" ? new Set(bestPool().map(p => p.id)) : null;
  return PRODUCTS
    .filter(p => best ? best.has(p.id) : (cat === "all" || p.cat === cat))
    .filter(p => !band || (p.price >= band.lo && p.price < band.hi))
    /* a style, out of the tags the rakhis themselves carry */
    .filter(p => !st.tag || (p.tags || []).map(tagKey).includes(st.tag))
    /* sold out put away, for somebody buying today rather than asking */
    .filter(p => !st.stock || p.stock !== 0)
    .sort(by);
}
/* What the rest of the filters would leave, ignoring one of them: the tag
   buttons are drawn from the shelf somebody is on and priced-out styles are
   not offered, but a style must not be hidden because it is the one already
   chosen. */
function visibleIgnoring(st, key){
  const relaxed = Object.assign({}, st); relaxed[key] = key === "stock" ? false : null;
  return visible(relaxed);
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
  const box = $("#grid");
  box.innerHTML = list.slice(0, shown).map(cardHtml).join("");
  box.scrollLeft = 0;
  if(typeof driftMarks === "function") driftMarks();
  /* The full view has its own filter now, but it is drawn from the same
     catalogue: whatever repainted this shelf — a fresh list out of the
     database, a sold-out mark — has to reach that grid too. */
  if(typeof paintAll === "function") paintAll();
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
/* ── the row of shelves ──
   One card per shelf, drawn from the one list both pages read. The row used
   to be written out by hand, and it had drifted: the card headed Designer
   opened Premium, and the shelf that had no card of its own had no way into
   it from the home page at all. */
function paintCats(){
  const rail = $("#catRail");
  if(!rail) return;
  rail.innerHTML = SHOP_CATS.map(c => `
    <a class="cat" href="#c/${c.k}" data-cat="${c.k}">
      <span class="cat-shot">
        <img src="../../assets/images/${c.card.img}" alt="${esc(c.card.t)} rakhi"
             width="660" height="880" loading="lazy" decoding="async">
      </span>
      <span class="cat-b">
        <span class="cat-n">${esc(c.card.t)}<br>Rakhi</span>
        <span class="cat-rule"></span>
        <span class="cat-s">${esc(c.card.sub)}</span>
        <span class="cat-go" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12h15M13 6l6 6-6 6"/></svg>
        </span>
      </span>
    </a>`).join("");
}
paintCats();

/* Bound to the category rail and to the footer's Shop column, which lists
   the same shelves.

   It used to narrow the shelf on the home page and scroll to it, which
   answered "show me kids rakhis" with four of them and the rest of the home
   page still underneath. Each shelf has a page of its own now — the
   collection, opened on that shelf — and this is the way in. */
function catJump(e){
  const a = e.target.closest("[data-cat]");
  if(!a) return;
  e.preventDefault();
  openCat(a.dataset.cat);
}
const catRail = $("#catRail");
if(catRail) catRail.addEventListener("click", catJump);
const footNav = document.querySelector(".foot-in");
if(footNav) footNav.addEventListener("click", catJump);


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

/* Same decision the category cards made: a band asked for is a page of that
   band, not four of them halfway down the home page with the rest of the
   home page still underneath. */
$("#budRail").addEventListener("click", e => {
  const b = e.target.closest("[data-band]");
  if(!b) return;
  openCat("b:" + b.dataset.band);
});

