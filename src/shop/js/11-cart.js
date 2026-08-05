/* ══════════════════════════════════════════════════════════
   cart
   ══════════════════════════════════════════════════════════ */
/* A cart saved in the browser can be days old. By then a product may have
   been repriced, renamed or removed altogether — so never trust what was
   stored. Every line is checked against the current PRODUCTS/SETS and
   either refreshed or dropped. Without this, a returning customer can
   order something you no longer sell, at last week's price. */
const MAX_QTY = 99;
function catalogue(id){
  return PRODUCTS.find(p=>p.id===id) || SETS.find(x=>x.id===id) || null;
}
function cleanCart(rows){
  const out = [];
  for(const r of Array.isArray(rows) ? rows : []){
    const src = catalogue(r && r.id);
    if(!src) continue;                                   // no longer sold
    const qty = Math.max(1, Math.min(MAX_QTY, parseInt(r.qty, 10) || 1));
    out.push({
      id:   src.id,
      name: src.name,                                    // current name
      price:src.price,                                   // current price
      qty,
      note: SETS.some(x=>x.id===src.id) ? "designs to be picked on WhatsApp" : ""
    });
  }
  return out;
}
let cart=[];
try{ cart = cleanCart(JSON.parse(localStorage.getItem("rag_cart") || "[]")); }
catch(e){ cart = []; }

/* Set by the account code once it is ready. Declared with var so that the
   first save() below — which runs before that code — sees undefined
   instead of throwing. The phone is always written to; the server copy is
   an extra, and never something the basket waits for. */
var sbPush = null;
const save=()=>{
  try{ localStorage.setItem("rag_cart",JSON.stringify(cart)); }catch(e){}
  if(sbPush) sbPush();
};
save();                                                  // write the cleaned version back

const sub   = ()=>cart.reduce((s,r)=>s+r.price*r.qty,0);
const ship  = ()=>cart.length===0?0:(sub()>=SHOP.freeShipAbove?0:SHOP.shipFlat);
const tot   = ()=>sub()+ship();
const nItems= ()=>cart.reduce((s,r)=>s+r.qty,0);

function addItem(p){
  if(!p) return;
  if(mustSignIn("add this to your basket")) return;
  const row=cart.find(r=>r.id===p.id);
  if(row) row.qty = Math.min(MAX_QTY, row.qty + 1);
  else cart.push({id:p.id, name:p.name, price:p.price, qty:1, note:p.note||""});
  save(); paintCart(true); toast("Added — "+p.name);
  track("add_cart", p.id, {qty: (cart.find(r=>r.id===p.id) || {}).qty || 1});
  if(lastBtn) throwPetals(lastBtn);
  setTimeout(openCart, 260);
}
function thumbFor(id){
  const p=PRODUCTS.find(x=>x.id===id);
  return p ? thumb(p) : `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="rgba(217,184,119,.2)"/>
    <circle cx="20" cy="20" r="7.5" fill="none" stroke="#a8842f" stroke-width="1.4"/>
    <circle cx="20" cy="20" r="2.4" fill="#a8842f"/></svg>`;
}
function paintCart(bump){
  const n=nItems();
  /* both counts — the one in the header and the one on a product page */
  for(const badge of [$("#cartN"), $("#pvCartN")]){
    badge.textContent = n;
    if(bump){ badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
  }

  /* the bar across the bottom of a phone: how many, how much, view cart */
  $("#cbK").textContent = n===1 ? "1 item" : n+" items";
  $("#cbV").textContent = inr(tot());
  $("#cartbar").classList.toggle("on", n>0);
  document.body.classList.toggle("hascart", n>0);
  $("#pvCart").hidden = n===0;

  if(!cart.length){
    $("#drB").innerHTML=`<div class="empty"><p>Nothing here yet.</p>
      <button class="btn btn-ghost" id="emptyGo">Browse the collection</button></div>`;
    $("#drF").hidden=true; return;
  }
  $("#drB").innerHTML = cart.map((r,i)=>`
    <div class="ci">
      <div class="ci-i">${thumbFor(r.id)}</div>
      <div class="ci-m">
        <div class="ci-n">${esc(r.name)}</div>
        ${r.note?`<div class="ci-note">${esc(r.note)}</div>`:""}
        <div class="ci-p">${inr(r.price)} each</div>
        <div class="ci-r">
          <span class="stp">
            <button type="button" data-dn="${i}" aria-label="One less">−</button>
            <span>${r.qty}</span>
            <button type="button" data-up="${i}" aria-label="One more">+</button>
          </span>
          <button class="ci-x" data-rm="${i}">Remove</button>
          <span class="ci-amt">${inr(r.price*r.qty)}</span>
        </div>
      </div>
    </div>`).join("");

  $("#sItems").textContent=n;
  $("#sSub").textContent=inr(sub());
  $("#sShip").textContent=ship()===0?"Free":inr(ship());
  $("#sTot").textContent=inr(tot());
  const left=SHOP.freeShipAbove-sub();
  $("#sHint").innerHTML = left>0
    ? `Add ${inr(left)} more and delivery is <b>free</b>.`
    : `Delivery is <b>free</b> on this order.`;
  $("#drF").hidden=false;
}
$("#drB").addEventListener("click", e=>{
  if(e.target.id==="emptyGo"){ closeCart(); document.getElementById("collection").scrollIntoView(); return; }
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.up!=null) cart[b.dataset.up].qty = Math.min(MAX_QTY, cart[b.dataset.up].qty + 1);
  else if(b.dataset.dn!=null){ if(--cart[b.dataset.dn].qty<1) cart.splice(b.dataset.dn,1); }
  else if(b.dataset.rm!=null){
    const gone = cart[b.dataset.rm];
    cart.splice(b.dataset.rm,1);
    if(gone) track("remove_cart", gone.id, {qty: gone.qty});
  }
  else return;
  save(); paintCart();
});
