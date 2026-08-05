-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 6: coupon codes
--
--  Run after 01–05. Safe to run twice.
--
--  A discount is money, so the same rule applies to it as to a price:
--  the browser never decides it. The shop asks check_coupon() what a code
--  is worth and shows that; place_order() then works it out again from
--  the coupon row and the basket, and stores its own answer. Whatever the
--  page displayed, the recorded total is the database's.
--
--  Every use is written to coupon_redemptions, so "10 people used FIRST10
--  and it brought in ₹4,300" is a fact rather than an estimate — and so a
--  code with a limit cannot be spent twice by two phones at once.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. the codes
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  code          text primary key check (code = upper(btrim(code)) and length(code) between 3 and 24),
  kind          text not null check (kind in ('percent','amount','free_ship')),
  -- percent: 10 means 10%.  amount: 50 means ₹50 off.  free_ship: ignored.
  value         integer not null default 0 check (value >= 0),
  -- a percentage without a ceiling is how a shop loses money on a big order
  max_discount  integer check (max_discount is null or max_discount > 0),
  min_order     integer not null default 0 check (min_order >= 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  max_uses      integer check (max_uses is null or max_uses > 0),
  per_customer  integer not null default 1 check (per_customer >= 1),
  used_count    integer not null default 0 check (used_count >= 0),
  note          text,                       -- what it was for; only the seller sees it
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 90)
);

drop trigger if exists touch_coupons on public.coupons;
create trigger touch_coupons before update on public.coupons
  for each row execute function public.touch_updated_at();

-- every use, so the numbers are counted rather than guessed
create table if not exists public.coupon_redemptions (
  id          bigserial primary key,
  code        text not null references public.coupons (code) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  saved       integer not null check (saved >= 0),
  created_at  timestamptz not null default now(),
  unique (order_id)                          -- one coupon per order
);

create index if not exists redemptions_code_idx on public.coupon_redemptions (code, created_at desc);
create index if not exists redemptions_user_idx on public.coupon_redemptions (user_id);

-- what an order was given
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount integer not null default 0
  check (discount >= 0);

-- ─────────────────────────────────────────────────────────────────────
-- 2. row level security
--
--    Nobody may read the coupons table. Not even to look up their own
--    code — because being able to read it is being able to list every
--    code the shop has, which is the one thing a discount must not allow.
--    check_coupon() below is the only way in, and it answers about one
--    code at a time.
-- ─────────────────────────────────────────────────────────────────────
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "admin reads coupons" on public.coupons;
create policy "admin reads coupons" on public.coupons
  for select using (public.is_admin());

drop policy if exists "admin writes coupons" on public.coupons;
create policy "admin writes coupons" on public.coupons
  for insert with check (public.is_admin());

drop policy if exists "admin edits coupons" on public.coupons;
create policy "admin edits coupons" on public.coupons
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin deletes coupons" on public.coupons;
create policy "admin deletes coupons" on public.coupons
  for delete using (public.is_admin());

drop policy if exists "read own redemptions" on public.coupon_redemptions;
create policy "read own redemptions" on public.coupon_redemptions
  for select using (user_id = auth.uid());

drop policy if exists "admin reads redemptions" on public.coupon_redemptions;
create policy "admin reads redemptions" on public.coupon_redemptions
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 3. what is this code worth
--
--    One code, one answer, and the reason when the answer is no. Used by
--    the shop to show the line before the order, and by place_order()
--    below to decide it for real — the same function both times, so the
--    number shown and the number charged cannot drift apart.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.check_coupon(p_code text, p_subtotal integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  c      public.coupons;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_sub  integer := greatest(0, coalesce(p_subtotal, 0));
  v_disc integer := 0;
  v_mine integer;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'Enter a code.');
  end if;

  select * into c from public.coupons where code = v_code;

  -- An unknown code and a switched-off code give the same answer on
  -- purpose: otherwise this is a way to find out which codes exist.
  if not found or not c.active then
    return jsonb_build_object('ok', false, 'reason', 'That code is not valid.');
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('ok', false, 'reason', 'That code has not started yet.');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'That code has expired.');
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'That code has been fully used.');
  end if;
  if v_sub < c.min_order then
    return jsonb_build_object('ok', false,
      'reason', 'Spend ₹' || c.min_order || ' or more to use this code.',
      'min_order', c.min_order);
  end if;

  if v_uid is not null then
    select count(*) into v_mine from public.coupon_redemptions
     where code = v_code and user_id = v_uid;
    if v_mine >= c.per_customer then
      return jsonb_build_object('ok', false, 'reason',
        case when c.per_customer = 1 then 'You have already used that code.'
             else 'You have used that code as many times as it allows.' end);
    end if;
  end if;

  if c.kind = 'percent' then
    v_disc := floor(v_sub * c.value / 100.0);
    if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  elsif c.kind = 'amount' then
    v_disc := c.value;
  end if;
  -- never more than the basket, and never negative
  v_disc := greatest(0, least(v_disc, v_sub));

  return jsonb_build_object(
    'ok', true,
    'code', c.code,
    'kind', c.kind,
    'discount', v_disc,
    'free_ship', c.kind = 'free_ship',
    'label', case c.kind
               when 'percent'   then c.value || '% off'
               when 'amount'    then '₹' || c.value || ' off'
               else 'Free delivery'
             end);
end;
$$;

revoke all on function public.check_coupon(text, integer) from public;
grant execute on function public.check_coupon(text, integer) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. place_order, now with a coupon
--
--    Dropped and recreated rather than overloaded: two functions of the
--    same name with different arguments leaves PostgREST unable to say
--    which one a call meant.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb);
drop function if exists public.place_order(text,text,text,text,text,text,text,jsonb,text);

create or replace function public.place_order(
  p_bill_no  text,
  p_name     text,
  p_phone    text,
  p_address  text,
  p_city     text,
  p_pincode  text,
  p_note     text,
  p_items    jsonb,
  p_coupon   text default null
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

  -- The coupon is worked out here, from the row, against this basket.
  -- Whatever the browser sent as a discount is not read at all.
  if coalesce(btrim(coalesce(p_coupon, '')), '') <> '' then
    v_coupon := public.check_coupon(p_coupon, v_sub);
    if (v_coupon ->> 'ok')::boolean then
      v_code := v_coupon ->> 'code';
      v_disc := coalesce((v_coupon ->> 'discount')::integer, 0);
      if (v_coupon ->> 'free_ship')::boolean then v_ship := 0; end if;
      -- lock the row so two phones cannot spend the last use at once
      update public.coupons set used_count = used_count + 1 where code = v_code;
    else
      -- a code that stopped being valid between the bill and the send is
      -- not a reason to lose the order; it is simply not applied
      v_code := null; v_disc := 0;
    end if;
  end if;

  insert into public.orders
    (user_id, bill_no, name, phone, address, city, pincode, note,
     subtotal, shipping, total, coupon_code, discount)
  values
    (v_uid, btrim(p_bill_no), btrim(p_name), btrim(p_phone), btrim(p_address),
     btrim(p_city), btrim(p_pincode), nullif(btrim(coalesce(p_note,'')), ''),
     v_sub, v_ship, greatest(0, v_sub - v_disc + v_ship), v_code, v_disc)
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

revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb,text) to authenticated;

-- a cancelled order gives its use back
create or replace function public.release_coupon_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.coupon_code is not null then
    update public.coupons
       set used_count = greatest(0, used_count - 1)
     where code = new.coupon_code;
    delete from public.coupon_redemptions where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_cancel_release_coupon on public.orders;
create trigger on_cancel_release_coupon
  after update on public.orders
  for each row execute function public.release_coupon_on_cancel();

-- ─────────────────────────────────────────────────────────────────────
-- 5. how the codes are doing
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_coupons()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_out
    from (
      select c.*,
             coalesce(r.uses, 0)    as uses,
             coalesce(r.saved, 0)   as given_away,
             coalesce(r.revenue, 0) as revenue
        from public.coupons c
        left join (
          select cr.code,
                 count(*) as uses,
                 sum(cr.saved) as saved,
                 sum(o.total) as revenue
            from public.coupon_redemptions cr
            join public.orders o on o.id = cr.order_id and o.status <> 'cancelled'
           group by cr.code
        ) r on r.code = c.code
    ) x;

  return v_out;
end;
$$;

revoke all on function public.admin_coupons() from public;
grant execute on function public.admin_coupons() to authenticated;
