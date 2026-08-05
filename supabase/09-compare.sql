-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 9: is that good?
--
--  Run after 01–08. Safe to run twice.
--
--  "₹147" is not information. "₹147, up from ₹96 last week" is. Every
--  number on the Overview now comes with the same number from the period
--  immediately before it, so the dashboard can say which way things are
--  going instead of leaving the seller to remember last week.
--
--  This only replaces admin_overview(). Nothing else changes.
-- ════════════════════════════════════════════════════════════════════

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
  v_prev timestamptz := now() - make_interval(days => v_days * 2);
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
  -- the same length of time, immediately before this one
  prev as (
    select * from public.orders
     where created_at >= v_prev and created_at < v_from and status <> 'cancelled'
  ),
  lines as (
    select oi.* from public.order_items oi join live l on l.id = oi.order_id
  ),
  ev as (
    select * from public.events where created_at >= v_from
  ),
  daily as (
    select g::date as d,
           count(x.id)                                                      as orders,
           coalesce(sum(x.total) filter (where x.status <> 'cancelled'), 0)  as revenue
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

    -- the same window, one window earlier
    'prev', jsonb_build_object(
      'revenue', (select coalesce(sum(total), 0) from prev),
      'orders',  (select count(*)                from prev),
      'aov',     (select case when count(*) = 0 then 0
                          else round(coalesce(sum(total), 0)::numeric / count(*)) end from prev),
      'buyers',  (select count(distinct user_id) from prev),
      'customers',(select count(*) from public.profiles
                    where created_at >= v_prev and created_at < v_from and role = 'customer')),

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
