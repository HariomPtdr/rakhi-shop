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

function cardActs(p, opts){
  const o = opts || {};
  const out = p.stock === 0;
  /* icon:true — the bag on its own, for a card where the corner it sits in
     is already the only thing that can be pressed apart from the card
     itself. Sold out still has to say so in words: a crossed-out bag is a
     guess, and it is the one state nobody may guess at. */
  if(o.icon && !out) return `
    <button class="btn btn-dark rc-cart" data-add="${p.id}"
            aria-label="Add ${esc(p.name)} to cart">${BAG_SVG}</button>`;
  return `
    <button class="btn btn-dark" data-add="${p.id}"${out ? " disabled" : ""}>${
      out ? "Sold out" : (o.long ? "Add to cart" : "Add")}${out ? "" : BAG_SVG}</button>`;
}

document.addEventListener("click", e => {
  const a = e.target.closest("[data-add]");
  if(a){
    if(a.disabled) return;
    lastBtn = a;
    addItem(PRODUCTS.find(p => p.id === a.dataset.add));
    return;
  }
  /* the whole card opens the rakhi, not only the View button — the picture
     and the name are what people actually aim at. Everything on a card that
     does something else of its own has to be excluded, or hearting a rakhi
     would also walk you into it. */
  const g = e.target.closest("[data-go]");
  if(!g) return;
  if(e.target.closest(".heart, [data-add], .tag, input, select, textarea")) return;
  const other = e.target.closest("a, button");
  if(other && other !== g && !other.hasAttribute("data-go")) return;
  openProduct(g.dataset.go);
});
