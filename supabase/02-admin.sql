-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 2 of 3: the seller
--
--  Run this after 01-schema.sql. Safe to run twice.
--
--  Everything the dashboard at /admin needs, and nothing a customer can
--  reach. One flag decides it: profiles.role = 'admin'. Every policy and
--  every function below asks is_admin() first, so an ordinary signed-in
--  customer holding the same publishable key gets nothing extra — the
--  dashboard is not protected by being at a secret address, it is
--  protected by the database refusing to answer.
--
--  The reports are functions rather than views on purpose. A view runs
--  as its owner and would quietly hand its rows to anyone who found the
--  name; a security definer function that checks is_admin() on its first
--  line cannot.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. who is the seller
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. what the seller may see and change
--    These sit alongside the customer policies from 01-schema.sql.
--    Postgres ORs permissive policies together, so a customer keeps
--    exactly the access they had and the seller gets the rest.
-- ─────────────────────────────────────────────────────────────────────

-- the catalogue, including anything switched off
drop policy if exists "admin reads every product"  on public.products;
create policy "admin reads every product" on public.products
  for select using (public.is_admin());

drop policy if exists "admin adds a product"       on public.products;
create policy "admin adds a product" on public.products
  for insert with check (public.is_admin());

drop policy if exists "admin edits a product"      on public.products;
create policy "admin edits a product" on public.products
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin removes a product"    on public.products;
create policy "admin removes a product" on public.products
  for delete using (public.is_admin());

-- delivery charge, free-delivery limit, the two dates
drop policy if exists "admin edits the settings" on public.shop_settings;
create policy "admin edits the settings" on public.shop_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- orders: read every one, and change the status, courier and tracking id.
-- The money columns are locked below by a trigger, not by hope.
drop policy if exists "admin reads every order" on public.orders;
create policy "admin reads every order" on public.orders
  for select using (public.is_admin());

drop policy if exists "admin updates an order" on public.orders;
create policy "admin updates an order" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin reads every order item" on public.order_items;
create policy "admin reads every order item" on public.order_items
  for select using (public.is_admin());

drop policy if exists "admin reads every status change" on public.order_status_log;
create policy "admin reads every status change" on public.order_status_log
  for select using (public.is_admin());

-- customers, their baskets, their wishlists and what they did on the site
drop policy if exists "admin reads every profile" on public.profiles;
create policy "admin reads every profile" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admin reads every cart" on public.cart_items;
create policy "admin reads every cart" on public.cart_items
  for select using (public.is_admin());

drop policy if exists "admin reads every wishlist" on public.wishlists;
create policy "admin reads every wishlist" on public.wishlists
  for select using (public.is_admin());

drop policy if exists "admin reads every event" on public.events;
create policy "admin reads every event" on public.events
  for select using (public.is_admin());

-- product photos: the seller uploads from the dashboard
drop policy if exists "admin uploads product images" on storage.objects;
create policy "admin uploads product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin replaces product images" on storage.objects;
create policy "admin replaces product images" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin deletes product images" on storage.objects;
create policy "admin deletes product images" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 3. an order's money is a matter of record
--    The seller can move an order along and add a tracking id. Nobody,
--    seller included, can edit the totals, the lines or who placed it
--    through the API — an order is what was agreed, not what someone
--    remembers later.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.guard_order_update()
returns trigger
language plpgsql
as $$
begin
  if new.subtotal is distinct from old.subtotal
     or new.shipping is distinct from old.shipping
     or new.total    is distinct from old.total
     or new.user_id  is distinct from old.user_id
     or new.bill_no  is distinct from old.bill_no
     or new.created_at is distinct from old.created_at then
    raise exception 'an order''s totals cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_orders on public.orders;
create trigger guard_orders before update on public.orders
  for each row execute function public.guard_order_update();

-- ─────────────────────────────────────────────────────────────────────
-- 4. the dashboard's front page
--     One call, one round trip, every number on the Overview screen.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_out  jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with o as (
    select * from public.orders where created_at >= v_from
  ),
  live as (
    select * from o where status <> 'cancelled'
  ),
  lines as (
    select oi.* from public.order_items oi join live l on l.id = oi.order_id
  ),
  ev as (
    select * from public.events where created_at >= v_from
  ),
  daily as (
    select g::date as d,
           count(x.id)                                                   as orders,
           coalesce(sum(x.total) filter (where x.status <> 'cancelled'), 0) as revenue
      from generate_series(
             (now() at time zone 'Asia/Kolkata')::date - (v_days - 1),
             (now() at time zone 'Asia/Kolkata')::date,
             interval '1 day') g
      left join public.orders x
        on (x.created_at at time zone 'Asia/Kolkata')::date = g::date
     group by g
     order by g
  ),
  tops as (
    select l.product_id,
           coalesce(max(l.name), l.product_id)   as name,
           sum(l.qty)                            as units,
           sum(l.qty * l.price)                  as revenue
      from lines l
     where l.product_id is not null
     group by l.product_id
     order by sum(l.qty * l.price) desc
     limit 8
  ),
  recent as (
    select o2.id, o2.bill_no, o2.name, o2.city, o2.total, o2.status, o2.created_at,
           (select coalesce(sum(qty), 0) from public.order_items i where i.order_id = o2.id) as units
      from public.orders o2
     order by o2.created_at desc
     limit 8
  ),
  lowstock as (
    select id, name, stock
      from public.products
     where active and stock is not null and stock <= 5
     order by stock asc, name asc
     limit 12
  ),
  baskets as (
    select c.user_id, sum(c.qty * p.price) as value, max(c.updated_at) as at
      from public.cart_items c join public.products p on p.id = c.product_id
     group by c.user_id
  )
  select jsonb_build_object(
    'days',            v_days,
    'generated_at',    now(),

    'revenue',         (select coalesce(sum(total), 0)   from live),
    'orders',          (select count(*)                  from o),
    'cancelled',       (select count(*)                  from o where status = 'cancelled'),
    'units',           (select coalesce(sum(qty), 0)     from lines),
    'aov',             (select case when count(*) = 0 then 0
                                else round(coalesce(sum(total), 0)::numeric / count(*)) end from live),
    'buyers',          (select count(distinct user_id)   from live),
    'pending',         (select count(*) from public.orders where status = 'placed'),
    'to_ship',         (select count(*) from public.orders where status in ('placed','confirmed')),

    'lifetime_revenue',(select coalesce(sum(total), 0) from public.orders where status <> 'cancelled'),
    'lifetime_orders', (select count(*) from public.orders),
    'customers',       (select count(*) from public.profiles where role = 'customer'),
    'new_customers',   (select count(*) from public.profiles
                          where created_at >= v_from and role = 'customer'),
    'repeat_buyers',   (select count(*) from (
                          select user_id from public.orders
                           where status <> 'cancelled' and user_id is not null
                           group by user_id having count(*) > 1) r),

    'status_counts',   (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                          from (select status, count(*) as n from o group by status) s),

    'daily',           (select coalesce(jsonb_agg(jsonb_build_object(
                                 'd', d, 'orders', orders, 'revenue', revenue) order by d), '[]'::jsonb)
                          from daily),

    'top_products',    (select coalesce(jsonb_agg(jsonb_build_object(
                                 'id', product_id, 'name', name,
                                 'units', units, 'revenue', revenue)), '[]'::jsonb)
                          from tops),

    'recent_orders',   (select coalesce(jsonb_agg(jsonb_build_object(
                                 'id', id, 'bill_no', bill_no, 'name', name, 'city', city,
                                 'total', total, 'status', status, 'units', units,
                                 'created_at', created_at) order by created_at desc), '[]'::jsonb)
                          from recent),

    'low_stock',       (select coalesce(jsonb_agg(jsonb_build_object(
                                 'id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
                          from lowstock),

    'open_baskets',    (select count(*) from baskets),
    'open_basket_value',(select coalesce(sum(value), 0) from baskets),

    'funnel',          jsonb_build_object(
                         'visitors',  (select count(distinct coalesce(user_id::text, anon_id)) from ev),
                         'views',     (select count(*) from ev where kind = 'view_product'),
                         'carts',     (select count(*) from ev where kind = 'add_cart'),
                         'checkouts', (select count(*) from ev where kind = 'begin_checkout'),
                         'orders',    (select count(*) from o))
  ) into v_out;

  return v_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. every rakhi, with how it is actually doing
--     Views, hearts, baskets and sales side by side: the four numbers
--     that answer "make more of which one?"
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_product_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_out  jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with ev as (
    select * from public.events where created_at >= v_from and product_id is not null
  ),
  sold as (
    select oi.product_id, sum(oi.qty) as units, sum(oi.qty * oi.price) as revenue
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.created_at >= v_from and o.status <> 'cancelled'
     group by oi.product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'kind', p.kind, 'cat', p.cat,
           'price', p.price, 'cost', p.cost, 'stock', p.stock,
           'active', p.active, 'feat', p.feat, 'image_path', p.image_path,
           'views',   (select count(*) from ev where ev.product_id = p.id and ev.kind = 'view_product'),
           'carts',   (select count(*) from ev where ev.product_id = p.id and ev.kind = 'add_cart'),
           'wishes',  (select count(*) from public.wishlists w where w.product_id = p.id),
           'units',   coalesce(s.units, 0),
           'revenue', coalesce(s.revenue, 0),
           'margin',  case when p.cost is null then null else (p.price - p.cost) * coalesce(s.units, 0) end
         ) order by coalesce(s.revenue, 0) desc, p.feat asc), '[]'::jsonb)
    into v_out
    from public.products p
    left join sold s on s.product_id = p.id;

  return jsonb_build_object('days', v_days, 'products', v_out);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. the customer list
--     Who they are, what they have spent, when they were last here.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_customers(
  p_q      text    default null,
  p_limit  integer default 50,
  p_offset integer default 0,
  p_sort   text    default 'spend'          -- spend | recent | orders | name
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q      text    := nullif(btrim(coalesce(p_q, '')), '');
  v_out    jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Sorted first, then paged. One statement, so the count and the page
  -- can never disagree about which rows matched.
  with base as (
    select pr.id, pr.full_name, pr.email, pr.phone, pr.city, pr.pincode,
           pr.role, pr.created_at, pr.last_seen_at,
           coalesce(o.orders, 0)   as orders,
           coalesce(o.spend, 0)    as spend,
           o.last_order,
           coalesce(w.wishes, 0)   as wishes,
           coalesce(c.basket, 0)   as basket
      from public.profiles pr
      left join (
        select user_id,
               count(*) filter (where status <> 'cancelled')                as orders,
               coalesce(sum(total) filter (where status <> 'cancelled'), 0) as spend,
               max(created_at)                                             as last_order
          from public.orders where user_id is not null group by user_id
      ) o on o.user_id = pr.id
      left join (
        select user_id, count(*) as wishes from public.wishlists group by user_id
      ) w on w.user_id = pr.id
      left join (
        select c.user_id, sum(c.qty * p.price) as basket
          from public.cart_items c join public.products p on p.id = c.product_id
         group by c.user_id
      ) c on c.user_id = pr.id
     where v_q is null
        or pr.full_name ilike '%' || v_q || '%'
        or pr.email     ilike '%' || v_q || '%'
        or pr.phone     ilike '%' || v_q || '%'
        or pr.city      ilike '%' || v_q || '%'
  ),
  ranked as (
    select b.*,
           count(*) over () as total,
           row_number() over (order by
             case when p_sort = 'name'   then lower(coalesce(b.full_name, b.email, '')) end asc  nulls last,
             case when p_sort = 'recent' then extract(epoch from coalesce(b.last_order, b.created_at)) end desc nulls last,
             case when p_sort = 'orders' then b.orders end desc nulls last,
             case when p_sort not in ('name','recent','orders') then b.spend end desc nulls last,
             b.created_at desc) as rn
      from base b
  )
  select jsonb_build_object(
           'total', coalesce(max(r.total), 0),
           'rows',  coalesce(jsonb_agg(to_jsonb(r) - 'rn' - 'total' order by r.rn)
                      filter (where r.rn > v_offset and r.rn <= v_offset + v_limit), '[]'::jsonb))
    into v_out
    from ranked r;

  return v_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. one customer, everything about them
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_customer(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', (select to_jsonb(pr) from public.profiles pr where pr.id = p_user),

    'orders',  (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', o.id, 'bill_no', o.bill_no, 'total', o.total,
                  'status', o.status, 'created_at', o.created_at,
                  'city', o.city, 'courier', o.courier, 'tracking_id', o.tracking_id,
                  'items', (select coalesce(jsonb_agg(jsonb_build_object(
                              'name', i.name, 'qty', i.qty, 'price', i.price)), '[]'::jsonb)
                              from public.order_items i where i.order_id = o.id)
                ) order by o.created_at desc), '[]'::jsonb)
                from public.orders o where o.user_id = p_user),

    'wishlist',(select coalesce(jsonb_agg(jsonb_build_object(
                  'id', p.id, 'name', p.name, 'price', p.price,
                  'image_path', p.image_path, 'created_at', w.created_at)
                  order by w.created_at desc), '[]'::jsonb)
                from public.wishlists w join public.products p on p.id = w.product_id
                where w.user_id = p_user),

    'basket',  (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', p.id, 'name', p.name, 'qty', c.qty, 'price', p.price,
                  'updated_at', c.updated_at)), '[]'::jsonb)
                from public.cart_items c join public.products p on p.id = c.product_id
                where c.user_id = p_user),

    'activity',(select coalesce(jsonb_agg(jsonb_build_object(
                  'kind', e.kind, 'product_id', e.product_id, 'meta', e.meta,
                  'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
                from (select * from public.events
                       where user_id = p_user order by created_at desc limit 60) e),

    'totals',  (select jsonb_build_object(
                  'orders', count(*) filter (where status <> 'cancelled'),
                  'spend',  coalesce(sum(total) filter (where status <> 'cancelled'), 0),
                  'first',  min(created_at),
                  'last',   max(created_at))
                from public.orders where user_id = p_user)
  ) into v_out;

  return v_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. the deeper read
--     Where the customers are, when they shop, what they want that is
--     not selling, and how many baskets were left behind.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_insights(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_from timestamptz := now() - make_interval(days => v_days);
  v_out  jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with o as (
    select * from public.orders where created_at >= v_from and status <> 'cancelled'
  ),
  lines as (
    select oi.*, p.cat
      from public.order_items oi
      join o on o.id = oi.order_id
      left join public.products p on p.id = oi.product_id
  ),
  ev as (
    select * from public.events where created_at >= v_from
  ),
  firsts as (
    select user_id, min(created_at) as first_at
      from public.orders where user_id is not null group by user_id
  )
  select jsonb_build_object(
    'days', v_days,

    'by_category',  (select coalesce(jsonb_agg(jsonb_build_object(
                       'cat', coalesce(cat, 'set'), 'units', units, 'revenue', revenue)
                       order by revenue desc), '[]'::jsonb)
                     from (select cat, sum(qty) as units, sum(qty * price) as revenue
                             from lines group by cat) c),

    'by_city',      (select coalesce(jsonb_agg(jsonb_build_object(
                       'city', city, 'orders', n, 'revenue', revenue) order by revenue desc), '[]'::jsonb)
                     from (select initcap(btrim(city)) as city, count(*) as n, sum(total) as revenue
                             from o group by initcap(btrim(city)) order by sum(total) desc limit 10) c),

    'by_hour',      (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'orders', n) order by h), '[]'::jsonb)
                     from (select extract(hour from created_at at time zone 'Asia/Kolkata')::int as h,
                                  count(*) as n
                             from o group by 1) x),

    'by_weekday',   (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'orders', n) order by w), '[]'::jsonb)
                     from (select extract(isodow from created_at at time zone 'Asia/Kolkata')::int as w,
                                  count(*) as n
                             from o group by 1) x),

    'new_vs_repeat',(select jsonb_build_object(
                       'new',    count(*) filter (where o.created_at = f.first_at),
                       'repeat', count(*) filter (where o.created_at > f.first_at))
                     from o join firsts f on f.user_id = o.user_id),

    -- wanted more than bought: the hearts that never turned into a sale
    'wanted',       (select coalesce(jsonb_agg(to_jsonb(x) order by x.wishes desc), '[]'::jsonb)
                     from (
                       select p.id, p.name, w.n as wishes, coalesce(s.units, 0) as units, p.stock
                         from (select product_id, count(*) as n from public.wishlists group by product_id) w
                         join public.products p on p.id = w.product_id
                         left join (select oi.product_id, sum(oi.qty) as units
                                      from public.order_items oi join o on o.id = oi.order_id
                                     group by oi.product_id) s on s.product_id = p.id
                        order by w.n desc, p.name asc
                        limit 12) x),

    -- left in the basket and never sent
    'abandoned',    (select coalesce(jsonb_agg(to_jsonb(x) order by x.value desc), '[]'::jsonb)
                     from (
                       select b.user_id, pr.full_name as name, pr.email, pr.phone,
                              b.items, b.value, b.at
                         from (select c.user_id, sum(c.qty) as items,
                                      sum(c.qty * p.price) as value, max(c.updated_at) as at
                                 from public.cart_items c join public.products p on p.id = c.product_id
                                group by c.user_id) b
                         join public.profiles pr on pr.id = b.user_id
                        order by b.value desc
                        limit 20) x),

    'searches',     (select coalesce(jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc), '[]'::jsonb)
                     from (select lower(btrim(meta ->> 'q')) as q, count(*) as n
                             from ev where kind = 'search' and coalesce(btrim(meta ->> 'q'), '') <> ''
                            group by 1 order by count(*) desc limit 15) s),

    'traffic',      (select coalesce(jsonb_agg(jsonb_build_object(
                       'd', d, 'visitors', visitors, 'views', views) order by d), '[]'::jsonb)
                     from (select (created_at at time zone 'Asia/Kolkata')::date as d,
                                  count(distinct coalesce(user_id::text, anon_id)) as visitors,
                                  count(*) filter (where kind = 'view_product') as views
                             from ev group by 1) t)
  ) into v_out;

  return v_out;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 9. only a signed-in seller can call any of it
--     (each function checks is_admin() as well — the grant just keeps
--      the anonymous key from even attempting the call)
-- ─────────────────────────────────────────────────────────────────────
revoke all on function public.admin_overview(integer)               from public;
revoke all on function public.admin_product_stats(integer)          from public;
revoke all on function public.admin_customers(text,integer,integer,text) from public;
revoke all on function public.admin_customer(uuid)                  from public;
revoke all on function public.admin_insights(integer)               from public;

grant execute on function public.admin_overview(integer)               to authenticated;
grant execute on function public.admin_product_stats(integer)          to authenticated;
grant execute on function public.admin_customers(text,integer,integer,text) to authenticated;
grant execute on function public.admin_customer(uuid)                  to authenticated;
grant execute on function public.admin_insights(integer)               to authenticated;
