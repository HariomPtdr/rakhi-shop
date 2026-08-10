/* ══════════════════════════════════════════════════════════
   ⚙️  SHOP SETTINGS — edit only this block
   ══════════════════════════════════════════════════════════ */
const SHOP = {
  whatsapp:      "919319848309",      // 91 + the 10-digit number, no + or spaces
  upi:           "ray.tejra-1@okicici",  // only until the settings row loads
  instagram:     "ray_art_24",        // handle without the @. Leave "" to hide the button.
  email:         "patidarh178@gmail.com",  // shown in the footer. Leave "" to hide it.
  /* Dates live here once, as ISO. The text on screen is worked out from
     them, so "28 Aug" can never drift out of step with 2026-08-28. */
  festivalDate:  "2026-08-28",        // Raksha Bandhan — confirm from the panchang
  orderByDate:   "2026-08-21",        // last date for normal delivery
  freeShipAbove: 499,
  /* Delivery is also free once the basket holds this many rakhis, whatever
     they cost — two ₹39 rakhis is a real order and charging ₹49 to carry
     them is most of the price of a third. 0 turns the rule off and leaves
     only the amount above.

     The number the shop actually uses comes from the settings row; this is
     the fallback until that arrives, and place_order() checks it again on
     the way in — a banner the checkout will not honour is the one kind of
     copy that costs money to be wrong. */
  freeShipMinQty: 2,
  shipFlat:      49,
  /* How long it takes to get there. Written here once and read by the
     product page, so the promise on every rakhi says the same thing. The
     city is where the rakhis are actually made, which is why it is quicker. */
  codEnabled:    true,               // the seller can turn cash off in Settings
  localCity:     "Indore",
  localPin:      "452",               // pincodes starting with this are local
  localDays:     2,
  awayDays:      7,
  billPrefix:    "RAG",
  /* The hero rail slides on its own every 5.2s. It stops permanently as soon
     as anyone swipes, taps an arrow or a dot, and never moves at all for
     visitors who have "reduce motion" switched on. Set to false to have it
     sit still and wait to be swiped. */
  heroSlide:     true
};
