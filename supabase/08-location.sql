-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 8: where to actually deliver
--
--  Run after 01–07. Safe to run twice.
--
--  Indian addresses are often written for a person who already knows the
--  area — "near the water tank, behind the school". A courier does not.
--  So a customer may optionally drop a pin, and the order carries the
--  coordinates alongside the words.
--
--  Nothing is embedded and no key is needed. The pin comes from the
--  browser's own geolocation, with the customer's permission, and the
--  dashboard turns it into an ordinary maps link. No script from Google
--  runs on the shop, so no address is sent anywhere until the seller
--  chooses to open the link.
-- ════════════════════════════════════════════════════════════════════

-- remembered on the profile, so it is not asked for twice
alter table public.profiles add column if not exists lat numeric(9,6);
alter table public.profiles add column if not exists lng numeric(9,6);
alter table public.profiles add column if not exists located_at timestamptz;

-- and copied onto each order, so it is what was true when that one was placed
alter table public.orders add column if not exists lat numeric(9,6);
alter table public.orders add column if not exists lng numeric(9,6);

-- a pin has to be on Earth
alter table public.profiles drop constraint if exists profiles_latlng_check;
alter table public.profiles add constraint profiles_latlng_check
  check ((lat is null and lng is null)
      or (lat between -90 and 90 and lng between -180 and 180));

alter table public.orders drop constraint if exists orders_latlng_check;
alter table public.orders add constraint orders_latlng_check
  check ((lat is null and lng is null)
      or (lat between -90 and 90 and lng between -180 and 180));

-- ─────────────────────────────────────────────────────────────────────
-- place_order carries the pin over
--
-- Taken from the profile rather than from the arguments, so the shape of
-- the call does not change again — and so the browser cannot claim a
-- location the customer never agreed to give.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.copy_pin_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lat is null and new.user_id is not null then
    select p.lat, p.lng into new.lat, new.lng
      from public.profiles p where p.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_pin on public.orders;
create trigger on_order_pin before insert on public.orders
  for each row execute function public.copy_pin_to_order();
