/* ══════════════════════════════════════════════════════════
   THE SHELVES

   One list, read by both pages. The shop builds three things
   from it — the Shop by Category row, the chips over the
   collection, and a page of its own for every shelf at
   #c/<key> — and the dashboard builds the menu the seller
   picks from when a rakhi goes up.

   That is the whole point of it being here. The two used to
   keep their own lists: the shop knew six shelves and drew
   five cards, the dashboard offered six raw keys with no
   names on them, and a rakhi filed under a key the shop had
   never heard of simply disappeared from it. Adding a shelf
   is one entry in this file now, and the card, the chip, the
   page and the dashboard's menu all arrive with it.

   k    the value stored in products.cat. Never change one of
        these without a migration — it is what the rows say.
   n    the shelf's full name: the chips, and the dashboard.
   card the Shop by Category card and the head of the shelf's
        own page. img is a file in assets/images/.
   ══════════════════════════════════════════════════════════ */
const SHOP_CATS = [
  { k:"evil-eye", n:"Evil eye rakhis",
    card:{ t:"Evil Eye", sub:"Kept safe from the eye", img:"cat-evil-eye.webp" } },

  { k:"lumba", n:"Bhabhi rakhis",
    card:{ t:"Bhaiya Bhabhi", sub:"Celebrate togetherness", img:"cat-bhaiya.webp" } },

  { k:"kids", n:"Kids rakhis",
    card:{ t:"Kids", sub:"Made to make them smile", img:"cat-kids.webp" } },

  { k:"traditional", n:"Religious rakhis",
    card:{ t:"Religious", sub:"Blessed by every ritual", img:"cat-religious.webp" } },

  { k:"pearl", n:"Designer rakhis",
    card:{ t:"Designer", sub:"Made to be looked at", img:"cat-designer.webp" } },

  /* Premium last on the row and first in the chips: the row is scrolled
     through and the chips are read at a glance, and it is the shelf the
     shop would rather sell either way. */
  { k:"premium", n:"Premium rakhis",
    card:{ t:"Premium", sub:"For the ones who notice", img:"cat-premium.webp" } }
];

const CAT_BY_KEY = new Map(SHOP_CATS.map(c => [c.k, c]));
const isCat   = k => CAT_BY_KEY.has(k);
const catOf   = k => CAT_BY_KEY.get(k) || null;
/* The full name — "Evil eye rakhis" — for the chips and the dashboard. */
const catName = k => (CAT_BY_KEY.get(k) || {}).n || "";
/* The short one — "Evil eye" — for the card, the page's heading and the
   label on a rakhi that carries no tags of its own. On a page of rakhis,
   under a photograph of a rakhi, the word rakhi is not doing any work. */
const catShort = k => ((CAT_BY_KEY.get(k) || {}).card || {}).t || "";
