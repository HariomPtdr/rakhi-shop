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
   card the Shop by Category card. img is a file in
        assets/images/, and it is the photograph the shelf's
        own page is headed with too.
   hero the banner over the shelf's page: its own mark, its own
        two lines and its own colour. Six pages under one
        banner reading "Handpicked Rakhis for Every Bond" were
        six pages that looked like the same page — the words
        over a shelf should be about that shelf.

        h    two lines. Kept as two rather than one wrapped by
             the browser: where it breaks is the difference
             between a headline and a sentence that ran out.
        sub  one sentence, in two lines on a phone.
        mark the glyph over the kicker, drawn on a 24×24 grid.
        ink  the headline's colour. The shop is maroon and
             gold; the evil eye is the one shelf whose own
             colour is its subject, and navy is that colour.
   ══════════════════════════════════════════════════════════ */
const SHOP_CATS = [
  { k:"evil-eye", n:"Evil eye rakhis",
    card:{ t:"Evil Eye", sub:"Kept safe from the eye", img:"cat-evil-eye.webp" },
    hero:{ kick:"Evil eye collection",
           h:["Protection. Positivity.","Pure Bonds."],
           sub:["Shield your bond from negativity","and welcome happiness &amp; good vibes."],
           ink:"#1E3A6E",
           mark:'<ellipse cx="12" cy="12" rx="10" ry="6.4" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                +'<circle cx="12" cy="12" r="3.6" fill="currentColor"/>'
                +'<circle cx="12" cy="12" r="1.5" fill="#FBF6EC"/>' } },

  { k:"lumba", n:"Bhabhi rakhis",
    card:{ t:"Bhaiya Bhabhi", sub:"Celebrate togetherness", img:"cat-bhaiya.webp" },
    hero:{ kick:"Bhaiya Bhabhi collection",
           h:["Stronger Together.","Forever Bonded."],
           sub:["Celebrate the beautiful bond","of love, respect &amp; togetherness."],
           mark:'<path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z" fill="currentColor"/>' } },

  { k:"kids", n:"Kids rakhis",
    card:{ t:"Kids", sub:"Made to make them smile", img:"cat-kids.webp" },
    hero:{ kick:"Kids collection",
           h:["Bright Colours.","Biggest Smiles."],
           sub:["Little rakhis for little wrists,","made to be shown off all day."],
           mark:'<path d="M12 2.8l2.7 5.8 6.3.8-4.6 4.4 1.1 6.3-5.5-3-5.5 3 1.1-6.3L3 9.4l6.3-.8Z" fill="currentColor"/>' } },

  { k:"traditional", n:"Religious rakhis",
    card:{ t:"Religious", sub:"Blessed by every ritual", img:"cat-religious.webp" },
    hero:{ kick:"Religious collection",
           h:["Divine Blessings.","Sacred Bonds."],
           sub:["Invoke blessings and protect","your bond with faith &amp; love."],
           mark:'<path d="M12 2.4 19 8v13H5V8Z" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                +'<path d="M12 5.6 16.4 9v4.2h-8.8V9Z" fill="currentColor" opacity=".85"/>'
                +'<path d="M10.4 21v-4.2a1.6 1.6 0 0 1 3.2 0V21Z" fill="none" stroke="currentColor" stroke-width="1.4"/>' } },

  { k:"pearl", n:"Designer rakhis",
    card:{ t:"Designer", sub:"Made to be looked at", img:"cat-designer.webp" },
    hero:{ kick:"Designer collection",
           h:["Style. Sophistication.","Sisterly Love."],
           sub:["Contemporary designs for","the most special bond."],
           mark:'<path d="M12 3.2c2.2 2.6 3.3 4.9 3.3 7 0 2-1.1 3.7-3.3 5.1-2.2-1.4-3.3-3.1-3.3-5.1 0-2.1 1.1-4.4 3.3-7Z" fill="currentColor"/>'
                +'<path d="M12 17c-3.1 2.2-6.2 2.5-9.3 1 2-2.6 4.6-3.5 7.7-2.8Z" fill="currentColor" opacity=".75"/>'
                +'<path d="M12 17c3.1 2.2 6.2 2.5 9.3 1-2-2.6-4.6-3.5-7.7-2.8Z" fill="currentColor" opacity=".75"/>' } },

  /* Premium last on the row and first in the chips: the row is scrolled
     through and the chips are read at a glance, and it is the shelf the
     shop would rather sell either way. */
  { k:"premium", n:"Premium rakhis",
    card:{ t:"Premium", sub:"For the ones who notice", img:"cat-premium.webp" },
    hero:{ kick:"Premium collection",
           h:["Quiet Gold.","Lasting Grace."],
           sub:["Kundan, zardosi and pearl,","for the ones who notice."],
           mark:'<path d="M12 2.6 15 9l6.6.7-4.9 4.5 1.4 6.5L12 17.4 5.9 20.7l1.4-6.5L2.4 9.7 9 9Z" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                +'<circle cx="12" cy="11.6" r="2.2" fill="currentColor"/>' } }
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
