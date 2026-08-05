-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 5: reviews and ratings
--
--  Run after 01–04. Safe to run twice.
--
--  The whole point of this file is one rule, and it is enforced by the
--  database rather than by the page:
--
--      you may review a rakhi only if one of your own orders
--      containing it reached 'delivered'.
--
--  Not "if you are signed in". Not "if the button was shown to you". The
--  insert policy itself goes and looks for a delivered order of yours with
--  that rakhi in it, so a review cannot be written by anyone who did not
--  receive the thing — including by someone typing into the API directly.
--  A shop's rating is only worth reading if that is true.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. the reviews
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          bigserial primary key,
  product_id  text not null references public.products (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  body        text check (body is null or length(body) <= 1200),
  -- the seller can hide a review, but never edit or delete one: a shop that
  -- can rewrite its reviews has no reviews
  status      text not null default 'published' check (status in ('published','hidden')),
  seller_reply text check (seller_reply is null or length(seller_reply) <= 1200),
  replied_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- one review per person per rakhi. Buying it twice does not buy two votes.
  unique (product_id, user_id)
);

create index if not exists reviews_product_idx on public.reviews (product_id, status, created_at desc);
create index if not exists reviews_mine_idx    on public.reviews (user_id);

-- the numbers the shop shows, kept on the product so a card needs no join
alter table public.products add column if not exists rating_avg   numeric(2,1);
alter table public.products add column if not exists rating_count integer not null default 0;

-- ─────────────────────────────────────────────────────────────────────
-- 2. did this person actually receive it
--
--    Used by the insert policy below, and by the shop to decide whether to
--    offer the form at all. Both ask the same question of the same data,
--    so the button and the rule can never disagree.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.has_received(p_product text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.orders o
      join public.order_items i on i.order_id = o.id
     where o.user_id = auth.uid()
       and o.status  = 'delivered'
       and i.product_id = p_product
  );
$$;

revoke all on function public.has_received(text) from public;
grant execute on function public.has_received(text) to authenticated;

-- everything the account sheet needs to offer the right forms: what they
-- have received, and what they have already said about it
create or replace function public.my_reviewables()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by x.delivered_at desc), '[]'::jsonb)
    into v_out
    from (
      select distinct on (i.product_id)
             i.product_id,
             p.name,
             p.image_path,
             max(o.status_at) over (partition by i.product_id) as delivered_at,
             r.id      as review_id,
             r.rating  as my_rating,
             r.body    as my_body
        from public.orders o
        join public.order_items i on i.order_id = o.id
        join public.products p    on p.id = i.product_id
        left join public.reviews r on r.product_id = i.product_id and r.user_id = v_uid
       where o.user_id = v_uid and o.status = 'delivered'
       order by i.product_id, o.status_at desc
    ) x;

  return v_out;
end;
$$;

revoke all on function public.my_reviewables() from public;
grant execute on function public.my_reviewables() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. who may read and write one
-- ─────────────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;

-- anyone may read published reviews: that is what they are for
drop policy if exists "published reviews are public" on public.reviews;
create policy "published reviews are public" on public.reviews
  for select using (status = 'published');

-- and you can always see your own, even if it was hidden
drop policy if exists "read own review" on public.reviews;
create policy "read own review" on public.reviews
  for select using (user_id = auth.uid());

-- THE RULE. The insert is refused unless a delivered order of theirs
-- contains this rakhi.
drop policy if exists "review only what you received" on public.reviews;
create policy "review only what you received" on public.reviews
  for insert with check (
    user_id = auth.uid()
    and status = 'published'
    and seller_reply is null
    and public.has_received(product_id)
  );

-- they may change their mind about their own review, and nothing else
drop policy if exists "edit own review" on public.reviews;
create policy "edit own review" on public.reviews
  for update using (user_id = auth.uid())
          with check (user_id = auth.uid() and status = 'published' and seller_reply is null);

drop policy if exists "delete own review" on public.reviews;
create policy "delete own review" on public.reviews
  for delete using (user_id = auth.uid());

-- the seller reads everything, including hidden ones, and may hide one or
-- reply to it. Not edit it, and not delete it.
drop policy if exists "admin reads every review" on public.reviews;
create policy "admin reads every review" on public.reviews
  for select using (public.is_admin());

drop policy if exists "admin moderates a review" on public.reviews;
create policy "admin moderates a review" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- A customer editing their own row must not be able to change the rating of
-- someone else's, move it to another rakhi, or write the seller's reply into
-- it. A trigger says what may change, since a policy cannot compare columns.
create or replace function public.guard_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    -- the seller may only hide/unhide and reply
    if new.rating     is distinct from old.rating
       or new.body    is distinct from old.body
       or new.user_id is distinct from old.user_id
       or new.product_id is distinct from old.product_id then
      raise exception 'the shop cannot edit what a customer wrote';
    end if;
    if new.seller_reply is distinct from old.seller_reply then
      new.replied_at := case when nullif(btrim(coalesce(new.seller_reply,'')),'') is null
                             then null else now() end;
    end if;
  else
    if new.user_id is distinct from old.user_id
       or new.product_id  is distinct from old.product_id
       or new.seller_reply is distinct from old.seller_reply
       or new.status is distinct from old.status then
      raise exception 'not yours to change';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_reviews on public.reviews;
create trigger guard_reviews before update on public.reviews
  for each row execute function public.guard_review_update();

-- ─────────────────────────────────────────────────────────────────────
-- 4. the average, kept on the product
--
--    Recomputed whenever a review lands, changes or goes. Hidden reviews
--    are left out of both the average and the count, so hiding one
--    actually hides it.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid text := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_avg = sub.avg_r,
         rating_count = sub.n
    from (
      select round(avg(rating)::numeric, 1) as avg_r, count(*)::int as n
        from public.reviews
       where product_id = v_pid and status = 'published'
    ) sub
   where p.id = v_pid;

  -- no published reviews left: clear it rather than leave a stale star
  update public.products
     set rating_avg = null
   where id = v_pid and rating_count = 0;

  return null;
end;
$$;

drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ─────────────────────────────────────────────────────────────────────
-- 5. the reviews under one rakhi, with the reviewer's first name
--
--    A function rather than a view so it can join profiles without handing
--    the whole profiles table to the public. Only a first name is returned:
--    enough to read as a person, not enough to identify one.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.product_reviews(p_product text, p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
    from (
      select r.id, r.rating, r.body, r.seller_reply, r.replied_at, r.created_at,
             split_part(coalesce(nullif(btrim(pr.full_name), ''), 'A customer'), ' ', 1) as who
        from public.reviews r
        left join public.profiles pr on pr.id = r.user_id
       where r.product_id = p_product and r.status = 'published'
       order by r.created_at desc
       limit greatest(1, least(coalesce(p_limit, 20), 100))
    ) x;
$$;

revoke all on function public.product_reviews(text, integer) from public;
grant execute on function public.product_reviews(text, integer) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. the seller's list
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_reviews(p_limit integer default 60)
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

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
    into v_out
    from (
      select r.id, r.rating, r.body, r.status, r.seller_reply, r.replied_at,
             r.created_at, r.product_id,
             p.name as product_name,
             coalesce(nullif(btrim(pr.full_name), ''), pr.email, 'A customer') as who
        from public.reviews r
        join public.products p on p.id = r.product_id
        left join public.profiles pr on pr.id = r.user_id
       order by r.created_at desc
       limit greatest(1, least(coalesce(p_limit, 60), 200))
    ) x;

  return v_out;
end;
$$;

revoke all on function public.admin_reviews(integer) from public;
grant execute on function public.admin_reviews(integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 7. asking for one
--
--    A notification when an order is delivered, pointing at the rakhis in
--    it. This is the moment someone is most willing to say something.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.notify_ask_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_items text;
begin
  if new.status <> 'delivered' or old.status = 'delivered' or new.user_id is null then
    return new;
  end if;

  select string_agg(distinct name, ', ') into v_items
    from public.order_items where order_id = new.id;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('customer', new.user_id, 'order_status', new.id,
          'How was ' || coalesce(v_items, 'your order') || '?',
          'You can leave a rating now — it is the only thing that helps '
          || 'the next person decide.');
  return new;
end;
$$;

drop trigger if exists on_delivered_ask_review on public.orders;
create trigger on_delivered_ask_review
  after update on public.orders
  for each row execute function public.notify_ask_review();
