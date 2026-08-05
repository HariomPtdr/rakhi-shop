-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 1 of 3: the shop
--
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Then 02-admin.sql, then 03-seed.sql. Safe to run any of them twice.
--
--  What it creates
--    shop_settings   one row: delivery charge, free-delivery limit, dates
--    products        the catalogue — rakhis and sets, photos, stock
--    profiles        one row per customer, made automatically on signup
--    cart_items      the basket, per customer, so it survives a new phone
--    wishlists       the hearts on the product cards
--    orders          placed orders + order_items + a status history
--    events          what people looked at, added and wished for — the
--                    numbers the seller dashboard is built from
--
--  Row level security is on for every table. A customer can only ever
--  read or write rows that are their own; the catalogue and the settings
--  row are world-readable and nobody can change them from the website.
--  Everything involving money goes through a function that recomputes
--  the totals from the products table, so a tampered browser can change
--  what it *shows* but never what gets recorded.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
-- 1. shop settings — one row, id = 1
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.shop_settings (
  id                smallint primary key default 1 check (id = 1),
  free_ship_above   integer not null default 499 check (free_ship_above >= 0),
  ship_flat         integer not null default 49  check (ship_flat >= 0),
  festival_date     date    not null default '2026-08-28',
  order_by_date     date    not null default '2026-08-21',
  updated_at        timestamptz not null default now()
);

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 2. catalogue
--    id is a slug ("nazar"), not a number, so the links sent on
--    WhatsApp stay readable: …/#p/nazar
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id           text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  kind         text not null default 'rakhi' check (kind in ('rakhi','set')),
  name         text not null check (length(btrim(name)) > 1),
  price        integer not null check (price >= 0),
  mrp          integer check (mrp is null or mrp >= price),   -- struck-out price
  cat          text,                                          -- evil-eye, pearl, …
  feat         integer not null default 999,                  -- order in the grid
  descr        text,
  image_path   text,        -- path inside the product-images bucket, or null
  art          jsonb,       -- {"thread":"#3BC4DE","bead":"#FDFCF7","charm":"nazar"}
  includes     text[],      -- bullet list, sets only
  best         boolean not null default false,                -- "best value" badge
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- how many are left to sell, and what each one cost to make.
-- stock null means "not counted" — the shop sells it without asking.
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists cost  integer;

create index if not exists products_live_idx on public.products (active, kind, feat);

-- ─────────────────────────────────────────────────────────────────────
-- 3. profiles — the delivery details a customer does not want to retype,
--    and the one flag that says who may open the seller dashboard
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  address     text,
  city        text,
  pincode     text check (pincode is null or pincode ~ '^[0-9]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 'customer' for everyone. 'admin' is the shop — set it by hand, once, in
-- the SQL editor (the line is at the bottom of 03-seed.sql). Nothing in
-- either page can promote an account, which is the point.
alter table public.profiles add column if not exists role text not null default 'customer';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer','admin'));

-- a copy of the sign-up email, so the dashboard can list customers
-- without being handed the keys to auth.users
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_admin_idx on public.profiles (role) where role = 'admin';

-- ── who is allowed to become the seller ──
-- The list of emails that get role = 'admin' the moment they sign up. It
-- exists to solve one awkward problem: the dashboard needs an admin, but an
-- admin needs an account, and an account cannot be made until the shop is
-- running. Put your email here before you sign up and the two happen in the
-- right order by themselves.
--
-- No policies are declared on this table at all, and RLS is on — which means
-- nothing reaching the API through the publishable key can read it, add to it
-- or even learn it exists. Only the SQL editor and the trigger below touch it.
create table if not exists public.admin_emails (
  email     text primary key check (email = lower(btrim(email))),
  added_at  timestamptz not null default now()
);
alter table public.admin_emails enable row level security;

-- a profile appears the moment someone signs up, so the app never has to
-- guess whether the row exists
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := 'customer';
begin
  -- an email on the list above is the shop, however they choose to sign in
  if exists (select 1 from public.admin_emails a
              where a.email = lower(btrim(coalesce(new.email, '')))) then
    v_role := 'admin';
  end if;

  -- Signing up with an email gives 'full_name'; signing in with Google gives
  -- 'name' as well, and sometimes only that. Take whichever is there.
  insert into public.profiles (id, full_name, email, role)
  values (new.id,
          nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                new.raw_user_meta_data ->> 'name', '')), ''),
          new.email,
          v_role)
  on conflict (id) do update
    set email     = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        -- never demote: if either side says admin, admin it stays
        role      = case when 'admin' in (public.profiles.role, excluded.role)
                         then 'admin' else public.profiles.role end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- 4. the basket
--    note is part of the key so "Two Rakhi Pack (designs to be picked on
--    WhatsApp)" and a plain line stay separate rows
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.cart_items (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  note        text not null default '',
  qty         integer not null check (qty between 1 and 99),
  updated_at  timestamptz not null default now(),
  primary key (user_id, product_id, note)
);

create index if not exists cart_items_when_idx on public.cart_items (updated_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- 5. wishlists — the heart on a product card
--    Kept apart from the basket on purpose: a wish is a request for the
--    shop to make more of something, which is a different question from
--    what someone is about to buy.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.wishlists (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists wishlists_product_idx on public.wishlists (product_id);

-- ─────────────────────────────────────────────────────────────────────
-- 6. orders
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  -- The bill number is made on the customer's phone, so it is only
  -- promised to be unique to them. Unique per customer still catches a
  -- double send, without one customer's number blocking another's.
  bill_no     text not null,
  name        text not null,
  phone       text not null,
  address     text not null,
  city        text not null,
  pincode     text not null,
  note        text,
  subtotal    integer not null check (subtotal >= 0),
  shipping    integer not null check (shipping >= 0),
  total       integer not null check (total >= 0),
  status      text not null default 'placed'
                check (status in ('placed','confirmed','shipped','delivered','cancelled')),
  created_at  timestamptz not null default now()
);

-- what the seller fills in after the order arrives
alter table public.orders add column if not exists courier     text;
alter table public.orders add column if not exists tracking_id text;
alter table public.orders add column if not exists admin_note  text;
alter table public.orders add column if not exists status_at   timestamptz not null default now();
alter table public.orders add column if not exists updated_at  timestamptz not null default now();

create index if not exists orders_mine_idx   on public.orders (user_id, created_at desc);
create index if not exists orders_recent_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create unique index if not exists orders_bill_per_user_idx on public.orders (user_id, bill_no);

create table if not exists public.order_items (
  id          bigserial primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  text references public.products (id) on delete set null,
  name        text not null,          -- snapshot: the name at the time of the order
  price       integer not null,       -- snapshot: the price at the time of the order
  qty         integer not null check (qty > 0),
  note        text not null default ''
);

create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- every status change, kept — so "when did this actually ship?" has an
-- answer, and the customer can be shown a real timeline
create table if not exists public.order_status_log (
  id          bigserial primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references auth.users (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists order_status_log_idx on public.order_status_log (order_id, created_at);

-- writing the history is the database's job, not the dashboard's, so it
-- cannot be forgotten or faked from a browser
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_at := now();
    insert into public.order_status_log (order_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(),
            nullif(btrim(coalesce(new.admin_note, '')), ''));
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_order_status on public.orders;
create trigger on_order_status before update on public.orders
  for each row execute function public.log_order_status();

-- ─────────────────────────────────────────────────────────────────────
-- 7. events — what happened on the site
--
--    One narrow table behind every number on the dashboard. A guest is
--    counted under a random id kept in their own browser; signing in
--    attaches their user id from then on. No names, no addresses, no
--    third party: none of it leaves this database.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          bigserial primary key,
  user_id     uuid references auth.users (id) on delete set null,
  anon_id     text check (anon_id is null or length(anon_id) <= 64),
  kind        text not null check (kind in (
                'view_shop','view_product','add_cart','remove_cart',
                'wish_add','wish_remove','begin_checkout','place_order',
                'search','whatsapp')),
  product_id  text references public.products (id) on delete set null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_time_idx    on public.events (created_at desc);
create index if not exists events_kind_idx    on public.events (kind, created_at desc);
create index if not exists events_product_idx on public.events (product_id, kind);
create index if not exists events_user_idx    on public.events (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- 8. row level security
-- ─────────────────────────────────────────────────────────────────────
alter table public.shop_settings    enable row level security;
alter table public.products         enable row level security;
alter table public.profiles         enable row level security;
alter table public.cart_items       enable row level security;
alter table public.wishlists        enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_status_log enable row level security;
alter table public.events           enable row level security;

-- the shop front: readable by anyone, writable by nobody through the API.
-- 02-admin.sql adds the seller's own write policies on top of these.
drop policy if exists "settings are public" on public.shop_settings;
create policy "settings are public" on public.shop_settings
  for select using (true);

drop policy if exists "live products are public" on public.products;
create policy "live products are public" on public.products
  for select using (active);

-- your own profile, nobody else's
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- your own basket
drop policy if exists "read own cart" on public.cart_items;
create policy "read own cart" on public.cart_items
  for select using (auth.uid() = user_id);

drop policy if exists "insert own cart" on public.cart_items;
create policy "insert own cart" on public.cart_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own cart" on public.cart_items;
create policy "update own cart" on public.cart_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own cart" on public.cart_items;
create policy "delete own cart" on public.cart_items
  for delete using (auth.uid() = user_id);

-- your own wishlist
drop policy if exists "read own wishlist" on public.wishlists;
create policy "read own wishlist" on public.wishlists
  for select using (auth.uid() = user_id);

drop policy if exists "insert own wishlist" on public.wishlists;
create policy "insert own wishlist" on public.wishlists
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own wishlist" on public.wishlists;
create policy "delete own wishlist" on public.wishlists
  for delete using (auth.uid() = user_id);

-- your own orders, read only. They are written by place_order() below, so
-- a browser cannot invent an order or edit one after it is placed.
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select using (
    exists (select 1 from public.orders o
             where o.id = order_items.order_id and o.user_id = auth.uid())
  );

drop policy if exists "read own order history" on public.order_status_log;
create policy "read own order history" on public.order_status_log
  for select using (
    exists (select 1 from public.orders o
             where o.id = order_status_log.order_id and o.user_id = auth.uid())
  );

-- events: anyone may add one about themselves, nobody may read them back.
-- Only the seller sees them, through the policy in 02-admin.sql.
drop policy if exists "anyone may record an event" on public.events;
create policy "anyone may record an event" on public.events
  for insert with check (user_id is null or user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- 9. cart functions
--    One round trip each, and atomic, so a flaky phone connection cannot
--    leave half a basket on the server.
-- ─────────────────────────────────────────────────────────────────────

-- Replace the whole basket. p_items: [{"product_id":"nazar","qty":2,"note":""}]
create or replace function public.sync_cart(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  delete from public.cart_items where user_id = v_uid;

  insert into public.cart_items (user_id, product_id, note, qty)
  select v_uid,
         x.product_id,
         coalesce(x.note, ''),
         least(greatest(x.qty, 1), 99)
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
           as x(product_id text, qty integer, note text)
   where x.product_id is not null
     and exists (select 1 from public.products p
                  where p.id = x.product_id and p.active)
  on conflict (user_id, product_id, note)
  do update set qty = excluded.qty, updated_at = now();
end;
$$;

-- Sign-in merge. Keeps the larger quantity of the two baskets, so signing
-- in twice cannot silently double an order, and returns the basket that won.
create or replace function public.merge_cart(p_items jsonb)
returns table (product_id text, note text, qty integer)
language plpgsql
security invoker
set search_path = public
as $$
-- The three names this function returns are also three column names, and
-- "on conflict (user_id, product_id, note)" cannot tell them apart — it
-- fails with "column reference is ambiguous". This says: inside this body,
-- a bare name is always the column.
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  insert into public.cart_items as c (user_id, product_id, note, qty)
  select v_uid,
         x.product_id,
         coalesce(x.note, ''),
         least(greatest(x.qty, 1), 99)
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
           as x(product_id text, qty integer, note text)
   where x.product_id is not null
     and exists (select 1 from public.products p
                  where p.id = x.product_id and p.active)
  on conflict (user_id, product_id, note)
  do update set qty = greatest(c.qty, excluded.qty), updated_at = now();

  return query
    select c.product_id, c.note, c.qty
      from public.cart_items c
     where c.user_id = v_uid
     order by c.updated_at;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 10. wishlist merge — the same idea for the hearts a guest tapped
--     before signing in. Merging never removes anything.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.merge_wishlist(p_ids text[])
returns table (product_id text, created_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
-- same reason as merge_cart: the returned names shadow the columns
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  insert into public.wishlists (user_id, product_id)
  select v_uid, x.id
    from unnest(coalesce(p_ids, '{}'::text[])) as x(id)
   where exists (select 1 from public.products p where p.id = x.id and p.active)
  on conflict (user_id, product_id) do nothing;

  return query
    select w.product_id, w.created_at
      from public.wishlists w
     where w.user_id = v_uid
     order by w.created_at desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 11. place an order
--     Prices and the delivery charge are recomputed here from the
--     catalogue and the settings row. Whatever the browser claims the
--     total is, this is the number that gets stored.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.place_order(
  p_bill_no  text,
  p_name     text,
  p_phone    text,
  p_address  text,
  p_city     text,
  p_pincode  text,
  p_note     text,
  p_items    jsonb            -- [{"product_id":"nazar","qty":2,"note":""}]
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

  -- The lines, priced from the catalogue rather than from what was sent.
  -- Held in a jsonb value, not a temporary table: a security definer
  -- function pins its search_path, and pg_temp is deliberately not on it.
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

  insert into public.orders
    (user_id, bill_no, name, phone, address, city, pincode, note,
     subtotal, shipping, total)
  values
    (v_uid, btrim(p_bill_no), btrim(p_name), btrim(p_phone), btrim(p_address),
     btrim(p_city), btrim(p_pincode), nullif(btrim(coalesce(p_note,'')), ''),
     v_sub, v_ship, v_sub + v_ship)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, price, qty, note)
  select v_order.id, l.product_id, l.name, l.price, l.qty, l.note
    from jsonb_to_recordset(v_lines)
           as l(product_id text, name text, price integer, qty integer, note text);

  -- the first entry in the history, so the timeline starts where the order does
  insert into public.order_status_log (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'placed', v_uid);

  -- count down the stock of anything that is being counted
  update public.products p
     set stock = greatest(0, p.stock - l.qty)
    from jsonb_to_recordset(v_lines) as l(product_id text, qty integer)
   where p.id = l.product_id and p.stock is not null;

  -- the basket has become an order
  delete from public.cart_items where user_id = v_uid;

  return v_order;
end;
$$;

-- signed-in customers only; the publishable key cannot reach these at all
revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.sync_cart(jsonb)       from public;
revoke all on function public.merge_cart(jsonb)      from public;
revoke all on function public.merge_wishlist(text[]) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.sync_cart(jsonb)       to authenticated;
grant execute on function public.merge_cart(jsonb)      to authenticated;
grant execute on function public.merge_wishlist(text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 12. keep updated_at honest
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists touch_products on public.products;
create trigger touch_products before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_settings on public.shop_settings;
create trigger touch_settings before update on public.shop_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 13. photo storage
--     One public bucket. Anyone can look at a rakhi; only the seller can
--     put one there — from the dashboard or from the Supabase Storage
--     screen. The upload policies are in 02-admin.sql.
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images are public" on storage.objects;
create policy "product images are public" on storage.objects
  for select using (bucket_id = 'product-images');
