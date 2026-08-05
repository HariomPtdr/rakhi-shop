/* ══════════════════════════════════════════════════════════
   collection
   ══════════════════════════════════════════════════════════ */
let state = { cat:"all", sort:"feat" };
/* catalogue numbers follow the order of the list; rebuilt if the list is
   later replaced by the one in the database */
let IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)]));
const numberCatalogue = ()=>{ IDX = new Map(PRODUCTS.map((p,i)=>[p.id, two(i+1)])); };

$("#chips").innerHTML = CATS.map(c=>
  `<button class="chip" data-c="${c.k}" aria-pressed="${c.k===state.cat}">${c.n}</button>`).join("");
$("#chips").addEventListener("click", e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  state.cat=b.dataset.c;
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
  return PRODUCTS.filter(p=>state.cat==="all"||p.cat===state.cat).sort(by);
}
function paintGrid(){
  const list=visible();
  $("#rCount").textContent = `${two(list.length)} ${list.length===1?"design":"designs"}`;
  $("#grid").innerHTML = list.map(p=>`
    <article class="card panel">
      <div class="card-top">
        <div class="shot">${thumb(p)}</div>
        <span class="idx">№ ${IDX.get(p.id)}</span>
        <span class="pill ${p.img?"pill-real":"pill-art"}">${p.img?"Photo":"Drawing"}</span>
        ${heartBtn(p.id)}
      </div>
      <h3 class="card-n">${esc(p.name)}</h3>
      <p class="card-d">${esc(p.desc)}</p>
      <div class="card-b">
        <span class="card-p">${inr(p.price)}</span>
        <span class="card-u">per piece</span>
      </div>
      <div class="card-acts">
        <button class="btn btn-dark" data-add="${p.id}">Add</button>
        <button class="btn btn-ghost" data-open="${p.id}">View</button>
      </div>
    </article>`).join("");
}
let lastBtn=null;
$("#grid").addEventListener("click", e=>{
  const a=e.target.closest("[data-add]");
  if(a){ lastBtn=a; addItem(PRODUCTS.find(p=>p.id===a.dataset.add)); return; }
  const o=e.target.closest("[data-open]");
  if(o) openProduct(o.dataset.open);
});
const closeLb=fromBack=>{
  if(!isOn("#lb")) return;
  $("#lb").classList.remove("on");
  afterClose(fromBack);
};
/* wrapped, not passed straight in: a click event as `fromBack` reads as
   "the back button did this" and leaves the pushed history entry behind */
$("#lbX").onclick = ()=>closeLb();
$("#lb").addEventListener("click", ()=>closeLb());
