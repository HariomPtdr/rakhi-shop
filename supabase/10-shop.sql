-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 10: the things a shop changes
--
--  Run after 01–09. Safe to run twice.
--
--  The WhatsApp number, the UPI id, the Instagram handle and the email
--  were written into src/shop/js/01-shop.js, which means changing any of
--  them needs an edit, a build and a deploy. The UPI id is printed on
--  every bill. A shop should not need a developer to correct the line
--  people are asked to pay into.
--
--  They move here, where the dashboard can change them and the next
--  visitor sees it. The file keeps its copies as the fallback for when
--  the database cannot be reached, exactly like the catalogue.
-- ════════════════════════════════════════════════════════════════════

alter table public.shop_settings add column if not exists whatsapp  text;
alter table public.shop_settings add column if not exists upi       text;
alter table public.shop_settings add column if not exists instagram text;
alter table public.shop_settings add column if not exists email     text;

-- one line across the top of the shop, for whatever is true this week
alter table public.shop_settings add column if not exists announcement text;

-- Taking orders, or not. After the cut-off, or when the week's work is
-- already more than can be made, a shop that says so plainly keeps the
-- customer — one that takes an order it cannot fill does not.
alter table public.shop_settings add column if not exists orders_paused boolean not null default false;
alter table public.shop_settings add column if not exists pause_note text;

-- 91 and ten digits, no plus and no spaces: the shape wa.me needs
alter table public.shop_settings drop constraint if exists shop_whatsapp_check;
alter table public.shop_settings add constraint shop_whatsapp_check
  check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$');

alter table public.shop_settings drop constraint if exists shop_announcement_check;
alter table public.shop_settings add constraint shop_announcement_check
  check (announcement is null or length(announcement) <= 160);

-- seed them from what the file already says, so nothing changes on screen
-- the first time this runs
update public.shop_settings
   set whatsapp  = coalesce(whatsapp,  '919319848309'),
       upi       = coalesce(upi,       'rayartgallery@upi'),
       instagram = coalesce(instagram, 'ray_art_24'),
       email     = coalesce(email,     'patidarh178@gmail.com')
 where id = 1;
