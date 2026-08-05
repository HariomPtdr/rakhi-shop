-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 12: how to get a code
--
--  Run after 01–11. Safe to run twice.
--
--  A discount box with nothing beside it is a small insult: it tells
--  someone a cheaper price exists and not how to get it. This is the
--  seller's own answer to "where do I find a code?", shown behind an
--  icon next to the box, and written from the dashboard.
-- ════════════════════════════════════════════════════════════════════

alter table public.shop_settings add column if not exists coupon_note text;
alter table public.shop_settings drop constraint if exists shop_coupon_note_check;
alter table public.shop_settings add constraint shop_coupon_note_check
  check (coupon_note is null or length(coupon_note) <= 400);

update public.shop_settings
   set coupon_note = coalesce(coupon_note,
     'Codes go out on our Instagram and to anyone who has ordered before. '
     || 'Follow @ray_art_24, or ask us on WhatsApp — we usually have one running.')
 where id = 1;
