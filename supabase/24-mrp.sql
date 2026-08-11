-- ══════════════════════════════════════════════════════════
-- an old price on every rakhi
--
-- The card shows the saving in the label row above the name —
-- "40% OFF" beside the struck-out old price — and it can only
-- show it where `mrp` is set. Every product in the shop had it
-- null, so the row was empty on every card and the cards did
-- not look like each other.
--
-- MRP = price / 0.6, rounded to the rupee: a flat 40% off the
-- whole shop. The card computes the percentage from the two
-- numbers rather than storing it, so if a price is edited later
-- the label follows it without anything else being touched.
--
-- This is a price list, not a schema change. Re-running it is
-- safe, and setting an mrp by hand in the dashboard afterwards
-- overrides it for that rakhi.
-- ══════════════════════════════════════════════════════════

update public.products
   set mrp = round(price / 0.6)
 where price is not null
   and price > 0;

-- Undo, should the shop ever want the plain prices back:
--   update public.products set mrp = null;
