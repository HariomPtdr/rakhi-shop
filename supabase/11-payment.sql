-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 11: how they are paying
--
--  Run after 01–10. Safe to run twice.
--
--  Two ways to order, and they are genuinely different journeys:
--
--    cash on delivery — the order is placed from the shop and that is the
--                       end of it. Nothing is owed until it arrives, so
--                       there is nothing to send anyone to WhatsApp for.
--
--    pay now by UPI   — the money has to change hands, and this shop has
--                       no payment gateway. So the bill goes to WhatsApp
--                       with the UPI id on it, and the order is recorded
--                       as awaiting payment until the seller says
--                       otherwise.
--
--  place_order is dropped and recreated rather than overloaded, for the
--  same reason as last time: two functions of one name with different
--  arguments leaves PostgREST unable to say which a call meant.
-- ════════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists payment text not null default 'cod';
alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders add constraint orders_payment_check
  check (payment in ('cod', 'upi'));

-- paid or not, and when the seller said so
alter table public.orders add column if not exists paid_at timestamptz;

drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb);
drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb,text);
drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb,text,text);

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

-- the seller is told which kind of order arrived, since they are answered
-- differently: one is packed, the other is chased for payment first
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items text;
begin
  select string_agg(name || ' × ' || qty, ', ')
    into v_items
    from public.order_items where order_id = new.id;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('seller', null, 'order_placed', new.id,
          new.name || ' ordered ' || to_char(new.total, 'FM₹9,99,999')
            || case when new.payment = 'upi' then ' — paying by UPI' else ' — cash on delivery' end,
          coalesce(v_items, '') ||
            case when coalesce(btrim(new.note), '') <> ''
                 then ' — “' || btrim(new.note) || '”' else '' end);
  return new;
end;
$$;
