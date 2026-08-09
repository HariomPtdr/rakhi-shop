/* ══════════════════════════════════════════════════════════
   the featured rail
   ══════════════════════════════════════════════════════════ */
let RAIL = [];
function paintRail(){
  RAIL = [...PRODUCTS].sort((a,b)=>a.feat-b.feat).slice(0,4);
  $("#rail").innerHTML = RAIL.map(p=>`
    <article class="rc" data-go="${p.id}">
      <div class="rc-shot">
        ${thumb(p)}
        <span class="rc-tag ${p.img?"real":"art"}">${p.img?"Photo":"Drawing"}</span>
        ${heartBtn(p.id)}
      </div>
      <h3 class="rc-n">${esc(p.name)}</h3>
      <span class="rc-rule" aria-hidden="true">
        <svg viewBox="0 0 12 11" fill="currentColor"><path d="M6 10.2 1.2 5.4A2.9 2.9 0 0 1 6 2.1a2.9 2.9 0 0 1 4.8 3.3Z"/></svg>
      </span>
      <div class="rc-b">
        <span class="rc-p">${inr(p.price)}</span>${cardActs(p)}
      </div>
    </article>`).join("");
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

/* whichever stop is nearest is the one showing */
let railTick = false;
railEl.addEventListener("scroll", ()=>{
  if(railTick || Date.now() < railBusy) return;
  railTick = true;
  requestAnimationFrame(()=>{
    const left = railEl.scrollLeft;
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

/* sets */
function paintSets(){
  $("#setGrid").innerHTML = SETS.map(s=>`
    <div class="set panel${s.best?" set-best":""}">
      ${s.best?`<span class="set-tag">Best value</span>`:""}
      <h3 class="set-n">${esc(s.name)}</h3>
      <div class="set-p"><b>${inr(s.price)}</b>
        ${s.was?`<s>${inr(s.was)}</s><em>save ${inr(s.was-s.price)}</em>`:""}</div>
      <ul class="set-l">${s.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>
      <button class="btn btn-dark" data-set="${s.id}">Add to cart</button>
    </div>`).join("");
}
paintSets();
$("#setGrid").addEventListener("click", e=>{
  const b=e.target.closest("[data-set]"); if(!b) return;
  lastBtn=b;
  const s=SETS.find(x=>x.id===b.dataset.set);
  addItem({id:s.id, name:s.name, price:s.price, note:"designs to be picked on WhatsApp"});
});

/* custom-order vocabulary */
$("#vThreads").innerHTML = THREADS.map(t=>
  `<span class="sw"><i style="background:${t.c}"></i>${t.n}</span>`).join("");
$("#vCharms").innerHTML = CHARMS.map(c=>
  `<span class="tagx"><img class="ico" src="${asSrc(charmIcon(c.k))}" alt="" width="24" height="24">${c.n}</span>`).join("");
