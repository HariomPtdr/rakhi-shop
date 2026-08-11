/* ══════════════════════════════════════════════════════════
   the featured rail
   ══════════════════════════════════════════════════════════ */
let RAIL = [];

/* ── the rail fills as it is swiped ──
   It used to be four rakhis and then the end of the road. Now it starts
   with six and takes another six each time the swipe nears the end, until
   the whole catalogue has been through it. Loading them all at the start
   would be a dozen pictures fetched so that four could be looked at. */
const RAIL_STEP = 6;
let railShown = 0;

const railPool = () => [...PRODUCTS].sort((a,b) => a.feat - b.feat);

/* ── the bestseller card ──
   The same card as Shop by Category — the same width, the same ivory, the
   same gold hairline, the picture running to the card's own edges — with a
   rakhi's own facts in the block underneath and the bag where that card
   keeps its arrow. Three rows of cards down one page should be three of
   the same card, not three different ideas of what a card is.

   The rating line is drawn only when there is one. A shop that prints
   ★ 0.0 (0) under everything has told you the truth in the least useful
   way there is. */
function railCard(p, o){
  o = (o && typeof o === "object") ? o : {};   /* .map() passes an index here */
  const off = (p.mrp && p.mrp > p.price) ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const out = p.stock === 0;
  /* bare: the same card without the shop's name over every one of them and
     without the tags. On a rail of six the name says whose these are; on a
     wall of the whole catalogue it is the same three words forty times, and
     the tags underneath it are forty more. Both go, and the card comes down
     by two lines without anything being lost that is not said elsewhere.

     The saving goes too. On six hand-picked rakhis it is the reason to look
     twice; on the whole catalogue it is a red number beside every single
     price, and a discount that is on everything is not a discount. The
     struck-out price stays, which says the same thing quietly.

     tags: puts the labels back on a bare card. The shelf on the home page
     has no room for them under a name; the full collection does, and there
     they are what tells one ivory card from the next at a glance. */
  const bare = !!o.bare;
  return `
    <article class="rc" data-go="${p.id}">
      <div class="rc-shot">
        ${thumb(p)}${
        out ? `<span class="rc-tag">Sold out</span>`
            : bare ? "" : `<span class="rc-tag">Bestseller</span>`}
        ${heartBtn(p.id)}
      </div>
      <div class="rc-b">${
        bare ? "" : `
        <span class="rc-brand">Ray Art Gallery</span>`}
        <h3 class="rc-n">${esc(p.name)}</h3>${
        (bare && !o.tags) ? "" : `
        ${tagChips(p, 2, true)}`}
        <span class="rc-rule"></span>${
        p.ratings ? `
        <div class="rc-r">${starsHtml(p.rating, 11)}<span>(${p.ratings})</span></div>` : ""}
        <div class="rc-foot">
          <div class="rc-prices">
            <span class="rc-p">${inr(p.price)}</span>${
            p.mrp && p.mrp > p.price ? `<s class="rc-mrp">${inr(p.mrp)}</s>` : ""}${
            off && !bare ? `<span class="rc-off">${off}% OFF</span>` : ""}
          </div>
          <div class="rc-go">${cardActs(p, {icon:true})}</div>
        </div>
      </div>
    </article>`;
}

function paintRail(){
  const pool = railPool();
  railShown = Math.min(RAIL_STEP, pool.length);
  RAIL = pool.slice(0, railShown);
  $("#rail").innerHTML = RAIL.map(p => railCard(p)).join("");
}
paintRail();


const railEl = $("#rail"), dotEls = () => [...$("#railDots").children];
function railCards(){ return [...railEl.children]; }
let railAt = 0, stopsPx = [0];                    // the one source of truth

/* Where the rail can actually come to rest.

   Stopping only at card edges left the final card unreachable: with two
   cards on screen the furthest card offset sits past the maximum scroll,
   so it could never be scrolled to. Every card offset short of the end
   is a stop, and the end itself is the last one — which always brings the
   remaining cards fully into view. */
function measureStops(){
  const max = railEl.scrollWidth - railEl.clientWidth;
  if(max < 2){ stopsPx = [0]; return; }
  const first = railCards()[0];
  const base = first.getBoundingClientRect().left + railEl.scrollLeft;
  const out = [];
  railCards().forEach(c=>{
    const off = Math.round(c.getBoundingClientRect().left + railEl.scrollLeft - base);
    if(off < max - 4) out.push(off);
  });
  out.push(max);
  stopsPx = out;
}
function buildDots(){
  measureStops();
  $("#railDots").innerHTML = stopsPx.map((_,i)=>
    `<button role="tab" data-i="${i}" aria-selected="${i===railAt}"
       aria-label="Show rakhis ${i+1} of ${stopsPx.length}"></button>`).join("");
  const idle = stopsPx.length <= 1;               // nothing to slide: no controls
  $("#railDots").hidden = idle;
  $("#railPrev").hidden = idle;
  $("#railNext").hidden = idle;
}

function markDot(i){
  railAt = Math.max(0, Math.min(i, stopsPx.length - 1));
  dotEls().forEach((d,n)=>d.setAttribute("aria-selected", String(n===railAt)));
}

/* While a smooth scroll is running the rail passes over earlier stops, and
   the listener below would read one of those as the current position — so
   an impatient second tap on Next could go backwards. Ignore the listener
   until the animation has had time to land. */
let railBusy = 0;

/* Another handful, appended where the swipe is already heading. Called from
   the scroll below rather than on a timer, so a rail nobody touches never
   fetches a picture nobody asked to see. */
function railMore(){
  const pool = railPool();
  if(railShown >= pool.length) return;
  const next = pool.slice(railShown, railShown + RAIL_STEP);
  railShown += next.length;
  RAIL = pool.slice(0, railShown);
  railEl.insertAdjacentHTML("beforeend", next.map(p => railCard(p)).join(""));
  buildDots();                 /* more cards, more places to stop */
  markDot(railAt);
}

/* whichever stop is nearest is the one showing */
let railTick = false;
railEl.addEventListener("scroll", ()=>{
  if(railTick || Date.now() < railBusy) return;
  railTick = true;
  requestAnimationFrame(()=>{
    const left = railEl.scrollLeft;
    /* within a card and a half of the end: time for more */
    if(railEl.scrollWidth - (left + railEl.clientWidth) < 320) railMore();
    let best = 0, dist = Infinity;
    stopsPx.forEach((x,i)=>{
      const d = Math.abs(x - left);
      if(d < dist){ dist = d; best = i; }
    });
    markDot(best);
    railTick = false;
  });
}, {passive:true});

function railGo(i){
  const n = stopsPx.length;                       // wrap among real stops only
  const at = ((i % n) + n) % n;
  railBusy = Date.now() + (reduced ? 0 : 700);
  railEl.scrollTo({left: stopsPx[at], behavior: reduced ? "auto" : "smooth"});
  markDot(at);
}
$("#railDots").addEventListener("click", e=>{
  const b = e.target.closest("[data-i]"); if(b) railGo(+b.dataset.i);
});
$("#railPrev").onclick = ()=>railGo(railAt - 1);
$("#railNext").onclick = ()=>railGo(railAt + 1);
/* arrow keys once the rail has focus */
railEl.addEventListener("keydown", e=>{
  if(e.key === "ArrowRight"){ e.preventDefault(); railGo(railAt + 1); }
  if(e.key === "ArrowLeft"){  e.preventDefault(); railGo(railAt - 1); }
});

/* Add and View are handled once for every card, in 06b-cardacts.js */

buildDots();
let railFit;
addEventListener("resize", ()=>{
  clearTimeout(railFit);
  railFit = setTimeout(()=>{ buildDots(); railGo(railAt); }, 180);
}, {passive:true});

/* optional auto-advance — off by default, and it gives up for good the
   moment somebody touches the rail, which is the only polite version */
if(SHOP.heroSlide && !reduced){
  let stop = false;
  const halt = ()=>{ stop = true; };
  /* it gives up for good the moment anyone takes over — the only polite
     version of an auto-advancing carousel */
  ["pointerdown","touchstart","wheel","keydown","focusin"].forEach(ev =>
    railEl.addEventListener(ev, halt, {passive:true, once:true}));
  [$("#railDots"), $("#railPrev"), $("#railNext")].forEach(el =>
    el.addEventListener("pointerdown", halt, {passive:true, once:true}));
  setInterval(()=>{
    if(stop || document.hidden) return;
    railGo(railAt + 1);
  }, 5200);
}

/* The sets grid and the custom-order vocabulary were painted here. Both
   sections came off the page, so there is nothing left to paint into —
   SETS, THREADS and CHARMS stay in the data, where the cart and the order
   sheet still read them. */
