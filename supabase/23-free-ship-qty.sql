-- ══════════════════════════════════════════════════════════
-- free delivery on two rakhis, whatever they cost
--
-- Until now delivery was free above an amount and nothing else.
-- Two ₹39 rakhis is a real order, and ₹49 to carry them is most
-- of the price of a third — so the shop is now offering it on
-- any basket of two or more, and that offer is on the front page.
--
-- A banner is not a rule. place_order() recomputes every rupee
-- of an order on the way in and ignores whatever the browser
-- worked out, so an offer the checkout has not been told about
-- is an offer the customer is shown and then charged for. This
-- is where it becomes true.
--
-- free_ship_min_qty is the count of rakhis that earns it. 0
-- turns the rule off and leaves only free_ship_above, which is
-- the behaviour every order before this one had.
-- ══════════════════════════════════════════════════════════

alter table public.shop_settings
  add column if not exists free_ship_min_qty integer not null default 2
    check (free_ship_min_qty >= 0);

comment on column public.shop_settings.free_ship_min_qty is
  'Rakhis in a basket that earn free delivery whatever they cost. '
  '0 = off, and only free_ship_above applies. The shop reads this for '
  'the banner and the cart; place_order() checks it again and its '
  'answer is the one that is charged.';

-- ── place_order(), with the second way to earn it ──
-- Copied whole from 16-payment-mode.sql rather than written afresh:
-- this function is what takes the money, and the only lines that
-- differ are the count of pieces and the case that reads it.

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
  v_qty   integer;
  v_minq  integer;
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
         count(*),
         coalesce(sum(s.q), 0)
    into v_lines, v_sub, v_count, v_qty
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

  select free_ship_above, ship_flat, free_ship_min_qty
    into v_free, v_flat, v_minq
    from public.shop_settings where id = 1;
  v_free := coalesce(v_free, 499);
  v_flat := coalesce(v_flat, 49);
  v_minq := coalesce(v_minq, 0);
  -- Two ways to earn it: enough rakhis, or enough money. Everything the
  -- browser worked out is thrown away at this line — this is the number
  -- that is charged, and it is the one the banner has to be written from.
  v_ship := case
              when v_minq > 0 and v_qty >= v_minq then 0
              when v_sub >= v_free                then 0
              else v_flat
            end;

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
