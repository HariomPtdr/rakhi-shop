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

     the solid button always puts it in the basket
     the quiet button always opens its page
     sold out replaces the first and never the second

   Only the wording changes with the width of the card, and only
   between "Add" and "Add to cart".

   The clicks are handled here too, on the document, so a rakhi
   drawn somewhere new works without remembering to wire it up.
   ══════════════════════════════════════════════════════════ */
let lastBtn = null;          // the button the petals are thrown from

function cardActs(p, opts){
  const o = opts || {};
  const out = p.stock === 0;
  return `
    <button class="btn btn-dark" data-add="${p.id}"${out ? " disabled" : ""}>${
      out ? "Sold out" : (o.long ? "Add to cart" : "Add")}</button>
    <button class="btn btn-ghost" data-go="${p.id}">View</button>`;
}

document.addEventListener("click", e => {
  const a = e.target.closest("[data-add]");
  if(a){
    if(a.disabled) return;
    lastBtn = a;
    addItem(PRODUCTS.find(p => p.id === a.dataset.add));
    return;
  }
  const g = e.target.closest("[data-go]");
  if(g) openProduct(g.dataset.go);
});
