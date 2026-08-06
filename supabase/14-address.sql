-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 14: correcting an order
--
--  Run after 01–13. Safe to run twice.
--
--  A wrong pincode is the commonest reason a parcel comes back, and it
--  is always noticed a minute after the order goes in. Until now the
--  only fix was WhatsApp, and the address on the order — the one the
--  label is written from — stayed wrong.
--
--  So: the customer may correct where it is going, and add or change
--  the instruction with it, for as long as nobody has handed it to a
--  courier. Once it is shipped the label exists and this refuses.
--
--  The seller is told, because an address that changes after they have
--  written the label is exactly the kind of thing that must not be
--  discovered at the post office.
-- ════════════════════════════════════════════════════════════════════

-- who last touched the address, and when — so the dashboard can say so
alter table public.orders add column if not exists address_at timestamptz;

create or replace function public.update_order_address(
  p_order   uuid,
  p_name    text,
  p_phone   text,
  p_address text,
  p_city    text,
  p_pincode text,
  p_note    text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
  v_was   text;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order;
  if v_order.id is null then
    raise exception 'no such order';
  end if;
  -- their own order, and nobody else's
  if v_order.user_id is distinct from v_uid then
    raise exception 'not your order' using errcode = '42501';
  end if;
  if v_order.status not in ('placed', 'confirmed') then
    raise exception 'It is already on its way — send us a message instead.';
  end if;

  if coalesce(btrim(p_name), '') = ''
     or p_phone !~ '^[6-9][0-9]{9}$'
     or coalesce(btrim(p_address), '') = ''
     or coalesce(btrim(p_city), '') = ''
     or p_pincode !~ '^[0-9]{6}$' then
    raise exception 'those delivery details are incomplete';
  end if;

  v_was := v_order.address || ', ' || v_order.city || ' ' || v_order.pincode;

  update public.orders
     set name       = btrim(p_name),
         phone      = btrim(p_phone),
         address    = btrim(p_address),
         city       = btrim(p_city),
         pincode    = btrim(p_pincode),
         note       = nullif(btrim(coalesce(p_note, '')), ''),
         address_at = now()
   where id = p_order
  returning * into v_order;

  -- the seller finds out now, not at the post office
  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('seller', null, 'order_status', v_order.id,
          v_order.name || ' changed the address on ' || v_order.bill_no,
          'Now: ' || v_order.address || ', ' || v_order.city || ' ' || v_order.pincode
            || '. Was: ' || v_was);

  insert into public.order_status_log (order_id, from_status, to_status, changed_by, note)
  values (v_order.id, v_order.status, v_order.status, v_uid, 'Address updated by the customer');

  return v_order;
end;
$$;

revoke all on function public.update_order_address(uuid,text,text,text,text,text,text) from public;
grant execute on function public.update_order_address(uuid,text,text,text,text,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- the pin, attached to one order rather than to the account
--
-- Someone sending a rakhi to their brother's flat should be able to drop
-- a pin on the flat without their own home moving with it. This writes
-- the location onto the order itself, and leaves the profile alone.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.set_order_pin(
  p_order uuid,
  p_lat   numeric,
  p_lng   numeric
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'that is not a place on earth';
  end if;

  select * into v_order from public.orders where id = p_order;
  if v_order.id is null then
    raise exception 'no such order';
  end if;
  if v_order.user_id is distinct from v_uid then
    raise exception 'not your order' using errcode = '42501';
  end if;
  if v_order.status not in ('placed', 'confirmed') then
    raise exception 'It is already on its way.';
  end if;

  update public.orders set lat = p_lat, lng = p_lng where id = p_order
  returning * into v_order;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('seller', null, 'order_status', v_order.id,
          v_order.name || ' attached a location to ' || v_order.bill_no,
          'The order now has an exact pin for the courier.');

  return v_order;
end;
$$;

revoke all on function public.set_order_pin(uuid,numeric,numeric) from public;
grant execute on function public.set_order_pin(uuid,numeric,numeric) to authenticated;
