-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 16: who decides how it is paid for
--
--  Run after 01–15. Safe to run twice.
--
--  Two changes, both about the same thing: the seller decides.
--
--  1. Cash on delivery can be switched off.
--
--     A courier who collects cash charges for it, and a rakhi at ₹49
--     does not always carry that. Whether the shop offers it is a
--     business decision that changes with the season, so it belongs in
--     Settings and not in a deploy. The shop hides the option when it is
--     off, and place_order refuses it as well — a hidden button is a
--     hint, not a rule.
--
--  2. A UPI order is not really an order until the money arrives.
--
--     There is no payment gateway here: the bill goes to WhatsApp, the
--     customer pays there, and the seller sees it in their own UPI app.
--     So the order sits as placed-and-unpaid until the seller says the
--     money came, and the moment they do it becomes confirmed — one
--     action, not two, because "I have the money" and "yes, I am making
--     it" are the same decision.
--
--     Cash on delivery is untouched by this. Nothing is owed until it
--     arrives, so those orders are confirmed the ordinary way.
-- ════════════════════════════════════════════════════════════════════

alter table public.shop_settings
  add column if not exists cod_enabled boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────
-- place_order, refusing cash when the shop is not taking it
--
-- Same signature as part 11, so nothing else changes and PostgREST has
-- no second overload to choose between.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.place_order(
  p_bill_no  text,
  p_name     text,
  p_phone    text,
  p_address  text,
  p_city     text,
  p_pincode  text,
  p_note     text,
  p_items    jsonb,
  p_coupon   text default null,
  p_payment  text default 'cod'
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_sub   integer := 0;
  v_ship  integer := 0;
  v_free  integer;
  v_flat  integer;
  v_order public.orders;
  v_count integer;
  v_lines jsonb;
  v_coupon jsonb;
  v_disc  integer := 0;
  v_code  text := null;
  v_pay   text := case when lower(coalesce(p_payment,'cod')) = 'upi' then 'upi' else 'cod' end;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if coalesce(btrim(p_bill_no), '') = '' then
    raise exception 'bill number missing';
  end if;
  if coalesce(btrim(p_name), '') = ''
     or p_phone !~ '^[6-9][0-9]{9}$'
     or coalesce(btrim(p_address), '') = ''
     or coalesce(btrim(p_city), '') = ''
     or p_pincode !~ '^[0-9]{6}$' then
    raise exception 'delivery details are incomplete';
  end if;

  -- a shop that has stopped taking orders means it
  if exists (select 1 from public.shop_settings where id = 1 and orders_paused) then
    raise exception 'The shop has stopped taking orders for now.';
  end if;

  -- and a shop that has stopped taking cash means that too
  if v_pay = 'cod'
     and exists (select 1 from public.shop_settings where id = 1 and not cod_enabled) then
    raise exception 'Cash on delivery is not available at the moment — please pay by UPI.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', p.id, 'name', p.name, 'price', p.price,
           'qty', s.q, 'note', s.n)), '[]'::jsonb),
         coalesce(sum(p.price * s.q), 0),
         count(*)
    into v_lines, v_sub, v_count
    from (
      select x.product_id            as pid,
             least(greatest(x.qty, 1), 99) as q,
             coalesce(x.note, '')     as n
        from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
               as x(product_id text, qty integer, note text)
       where x.product_id is not null
    ) s
    join public.products p on p.id = s.pid and p.active;

  if v_count = 0 then
    raise exception 'nothing in the order';
  end if;

  select free_ship_above, ship_flat into v_free, v_flat
    from public.shop_settings where id = 1;
  v_free := coalesce(v_free, 499);
  v_flat := coalesce(v_flat, 49);
  v_ship := case when v_sub >= v_free then 0 else v_flat end;

  if coalesce(btrim(coalesce(p_coupon, '')), '') <> '' then
    v_coupon := public.check_coupon(p_coupon, v_sub);
    if (v_coupon ->> 'ok')::boolean then
      v_code := v_coupon ->> 'code';
      v_disc := coalesce((v_coupon ->> 'discount')::integer, 0);
      if (v_coupon ->> 'free_ship')::boolean then v_ship := 0; end if;
      update public.coupons set used_count = used_count + 1 where code = v_code;
    else
      v_code := null; v_disc := 0;
    end if;
  end if;

  insert into public.orders
    (user_id, bill_no, name, phone, address, city, pincode, note,
     subtotal, shipping, total, coupon_code, discount, payment)
  values
    (v_uid, btrim(p_bill_no), btrim(p_name), btrim(p_phone), btrim(p_address),
     btrim(p_city), btrim(p_pincode), nullif(btrim(coalesce(p_note,'')), ''),
     v_sub, v_ship, greatest(0, v_sub - v_disc + v_ship), v_code, v_disc, v_pay)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, price, qty, note)
  select v_order.id, l.product_id, l.name, l.price, l.qty, l.note
    from jsonb_to_recordset(v_lines)
           as l(product_id text, name text, price integer, qty integer, note text);

  if v_code is not null then
    insert into public.coupon_redemptions (code, order_id, user_id, saved)
    values (v_code, v_order.id, v_uid, v_disc);
  end if;

  insert into public.order_status_log (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'placed', v_uid);

  update public.products p
     set stock = greatest(0, p.stock - l.qty)
    from jsonb_to_recordset(v_lines) as l(product_id text, qty integer)
   where p.id = l.product_id and p.stock is not null;

  delete from public.cart_items where user_id = v_uid;

  return v_order;
end;
$$;

revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb,text,text) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- the money arriving is the confirmation
--
-- The seller marks a UPI order paid from the dashboard. That is the same
-- moment they decide to make it, so the order moves itself from placed
-- to confirmed — and the notification the customer gets is the ordinary
-- "Order confirmed" one, written by the trigger that already exists.
--
-- Only ever forwards, and only from placed: an order already shipped is
-- not dragged backwards by a payment being reconciled late.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.confirm_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid_at is not null and old.paid_at is null
     and new.payment = 'upi' and new.status = 'placed' then
    new.status := 'confirmed';
    new.status_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_paid on public.orders;
create trigger on_order_paid before update on public.orders
  for each row execute function public.confirm_on_payment();
