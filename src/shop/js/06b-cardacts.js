/* ══════════════════════════════════════════════════════════
   THE TWO BUTTONS UNDER A RAKHI

   The same rakhi is drawn in three places — the collection, the
   featured rail on the home page, and the "more rakhis" rail at
   the bottom of a product page — and it had three different
   pairs of buttons: Add then View, View then Add, and View on
   its own in the solid style. So the same thing looked like a
   different offer depending on where you met it, and the solid
   button meant "buy this" in one place and "look at this" in
   another.

   One rule, written once and used everywhere:

     the one button always puts it in the basket
     the card itself always opens its page
     sold out replaces the button and never the card

   There was a View button beside it. It was the second way to
   do a thing the whole card already did — the picture and the
   name are what people aim at, and the click below has always
   handled them. A button that duplicates the surface it sits on
   is a button spending space to say nothing.

   Only the wording changes with the width of the card, and only
   between "Add" and "Add to cart".

   The clicks are handled here too, on the document, so a rakhi
   drawn somewhere new works without remembering to wire it up.
   ══════════════════════════════════════════════════════════ */
let lastBtn = null;          // the button the petals are thrown from

const BAG_SVG = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5.5 8h13l-1 12.5h-11Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>`;

/* ── once it is in the basket ──
   The button stops being "add this" and becomes "how many" — the same
   change the drawer shows, made where the decision is. Somebody who wants
   two of something should not have to press Add twice and be shown the
   cart twice to find out whether it worked.

   How many are in the basket, or 0 if none.

   In a try, and not out of superstition. `cart` and MAX_QTY are declared
   with const in 11-cart.js, six files after this one — and the grid and the
   rail both draw their cards at the top level of files that load before it.
   Reading a const before its declaration has run is a ReferenceError, and
   `typeof` does not save you from it the way it does an undeclared name: it
   throws too. An unguarded read here would take the rest of 09-grid.js down
   with it on every load, silently, on a page that still looked right.

   Before the basket exists nothing can be in it, so 0 is also the true
   answer — paintCart() redraws every one of these the moment it does. */
const inCart = id => {
  try{
    const r = cart.find(x => x.id === id);
    return r ? r.qty : 0;
  }catch(e){ return 0; }
};

function qtyStepper(p, n){
  const last = n <= 1;      /* one more press and it leaves the basket */
  return `
    <span class="qty" role="group" aria-label="How many ${esc(p.name)}">
      <button type="button" data-dec="${p.id}" aria-label="${
        last ? "Remove " + esc(p.name) + " from the basket" : "One less"}">${
        last ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                  <path d="M6 7h12M10 7V5.4h4V7M9 11v6M15 11v6M7 7l.9 13h8.2L17 7"/></svg>`
             : "&minus;"}</button>
      <b aria-live="polite">${n}</b>
      <button type="button" data-inc="${p.id}" aria-label="One more"${
        n >= 99 ? " disabled" : ""}>+</button>
    </span>`;
}

/* The wrapper is display:contents, so it is a node paintActs() can rewrite
   without existing in the layout — every rule written against the button
   inside it goes on working as though the wrapper were not there. */
function cardActs(p, opts){
  const o = opts || {};
  const out = p.stock === 0;
  const n = out ? 0 : inCart(p.id);
  const inner = out
    ? `<button class="btn btn-dark" data-add="${p.id}" disabled>Sold out</button>`
    : n > 0
      ? qtyStepper(p, n)
      /* The compact cards carried a bag on its own in a rounded square. It
         was the one button on the page that did not say what it did, and it
         was the wrong shape besides: the moment it is pressed it becomes the
         capsule stepper, so the card changed shape under the thumb. It says
         Add now, in the capsule the stepper already uses. */
      : o.icon
        ? `<button class="btn btn-dark rc-cart" data-add="${p.id}"
                   aria-label="Add ${esc(p.name)} to cart">Add${BAG_SVG}</button>`
        : `<button class="btn btn-dark" data-add="${p.id}">${
             o.long ? "Add to cart" : "Add"}${BAG_SVG}</button>`;
  return `<span class="acts${o.icon ? " acts-icon" : ""}" data-acts="${p.id}"${
    o.long ? ` data-long="1"` : ""}>${inner}</span>`;
}

/* Every card drawn anywhere, brought back into step with the basket. Called
   from paintCart(), so adding from the rail updates the same rakhi in the
   grid and on its own page without any of them knowing about each other. */
function paintActs(){
  $$("[data-acts]").forEach(box => {
    const p = catalogue(box.dataset.acts)
           || PRODUCTS.find(x => x.id === box.dataset.acts);
    if(!p) return;
    const n = p.stock === 0 ? 0 : inCart(p.id);
    const stepper = box.querySelector(".qty");

    /* Already a stepper and still one: change the number in it rather than
       replacing it. Rewriting the markup on every press throws away the
       button that was just pressed, which loses keyboard focus and makes
       a held-down finger land on a node that no longer exists. */
    if(stepper && n > 0){
      const b = stepper.querySelector("b");
      if(b && b.textContent !== String(n)) b.textContent = n;
      const inc = stepper.querySelector("[data-inc]");
      if(inc) inc.disabled = n >= 99;
      /* the last one out wears a bin, so that swap does need the markup */
      const wasLast = !!stepper.querySelector("[data-dec] svg");
      if(wasLast === (n > 1)) box.innerHTML = innerOf(p, box);
      return;
    }
    const next = innerOf(p, box);
    if(box.innerHTML !== next) box.innerHTML = next;
  });
}

/* cardActs() emits its own wrapper; these are its innards on their own */
function innerOf(p, box){
  const tmp = document.createElement("div");
  tmp.innerHTML = cardActs(p, {icon: box.classList.contains("acts-icon"),
                               long: box.dataset.long === "1"});
  return tmp.firstElementChild.innerHTML;
}

document.addEventListener("click", e => {
  const a = e.target.closest("[data-add]");
  if(a){
    if(a.disabled) return;
    lastBtn = a;
    addItem(PRODUCTS.find(p => p.id === a.dataset.add));
    return;
  }
  /* ── the stepper on a card ──
     One less on the last one takes it out of the basket, which is why that
     press wears a bin rather than a minus: a minus that empties something
     is a minus that has to be guessed at. */
  const up = e.target.closest("[data-inc]");
  if(up){
    if(up.disabled) return;
    const row = cart.find(x => x.id === up.dataset.inc);
    if(row){
      row.qty = Math.min(MAX_QTY, row.qty + 1);
      save(); paintCart(true);
      lastBtn = up; throwPetals(up);
      track("add_cart", row.id, {qty: row.qty});
    }
    return;
  }
  const dn = e.target.closest("[data-dec]");
  if(dn){
    const at = cart.findIndex(x => x.id === dn.dataset.dec);
    if(at !== -1){
      const row = cart[at];
      if(row.qty > 1) row.qty--;
      else { cart.splice(at, 1); track("remove_cart", row.id, {qty: 1}); }
      save(); paintCart();
    }
    return;
  }
  /* the whole card opens the rakhi, not only the View button — the picture
     and the name are what people actually aim at. Everything on a card that
     does something else of its own has to be excluded, or hearting a rakhi
     would also walk you into it. */
  const g = e.target.closest("[data-go]");
  if(!g) return;
  if(e.target.closest(".heart, [data-add], [data-inc], [data-dec], input, select, textarea")) return;
  const other = e.target.closest("a, button");
  if(other && other !== g && !other.hasAttribute("data-go")) return;
  openProduct(g.dataset.go);
});
