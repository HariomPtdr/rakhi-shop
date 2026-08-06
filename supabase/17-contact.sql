-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 17: the UPI id on every bill
--
--  Run after 01–16. Safe to run twice.
--
--  The shop shipped with a made-up UPI id — rayartgallery@upi — as a
--  placeholder, and it is still the one printed on every bill and shown
--  to everyone paying. Anyone who tried to pay it has been sending money
--  nowhere.
--
--  This is the real one. It is a setting rather than a line of code
--  precisely so it never needs a deploy again: Settings → How people
--  reach you changes it from the dashboard, and this file only exists
--  because it needs correcting once from outside.
-- ════════════════════════════════════════════════════════════════════

update public.shop_settings
   set upi = 'ray.tejra-1@okicici'
 where id = 1;

select upi as now_printed_on_every_bill,
       whatsapp as orders_arrive_here,
       case when cod_enabled then 'offered' else 'not offered' end as cash_on_delivery
  from public.shop_settings where id = 1;

-- ── cash on delivery ──
-- Currently switched off, so the shop offers UPI only. If that was not
-- deliberate, this puts it back — or use the button in Settings.
--
-- update public.shop_settings set cod_enabled = true where id = 1;
