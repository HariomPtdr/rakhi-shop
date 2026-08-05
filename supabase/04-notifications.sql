-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 4: telling people what happened
--
--  Run this after 01, 02 and 03. Safe to run twice.
--
--  Two things:
--
--    notifications   one row per thing worth knowing. The customer is told
--                    when their order moves; the seller is told when an
--                    order arrives or is cancelled.
--
--    cancel_order()  a customer calling off their own order, but only
--                    while it can still be called off.
--
--  The rows are written by triggers on the orders table, not by either
--  page. A notification that the browser has to remember to send is a
--  notification that goes missing the moment someone closes the tab
--  mid-request — and "your order shipped" is exactly the message that
--  must not go missing.
-- ════════════════════════════════════════════════════════════════════

-- why an order was called off, and by whom
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists cancelled_by  text
  check (cancelled_by is null or cancelled_by in ('customer','seller'));

-- ─────────────────────────────────────────────────────────────────────
-- 1. the notifications themselves
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          bigserial primary key,
  -- who it is for. audience 'seller' rows have no user_id: they belong to
  -- whoever is the owner at the time, not to one account.
  audience    text not null check (audience in ('customer','seller')),
  user_id     uuid references auth.users (id) on delete cascade,
  kind        text not null check (kind in
                ('order_placed','order_status','order_cancelled')),
  order_id    uuid references public.orders (id) on delete cascade,
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notif_mine_idx   on public.notifications (user_id, created_at desc);
create index if not exists notif_seller_idx on public.notifications (audience, created_at desc);
create index if not exists notif_unread_idx on public.notifications (audience, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

-- a customer sees their own, and may mark them read. Nobody may write one
-- through the API at all — the triggers below are the only author.
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select using (audience = 'customer' and user_id = auth.uid());

drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update using (audience = 'customer' and user_id = auth.uid())
          with check (audience = 'customer' and user_id = auth.uid());

drop policy if exists "seller reads its notifications" on public.notifications;
create policy "seller reads its notifications" on public.notifications
  for select using (audience = 'seller' and public.is_admin());

drop policy if exists "seller marks notifications read" on public.notifications;
create policy "seller marks notifications read" on public.notifications
  for update using (audience = 'seller' and public.is_admin())
          with check (audience = 'seller' and public.is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 2. a new order tells the seller
-- ─────────────────────────────────────────────────────────────────────
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
          new.name || ' ordered ' || to_char(new.total, 'FM₹9,99,999'),
          coalesce(v_items, '') ||
            case when coalesce(btrim(new.note), '') <> ''
                 then ' — “' || btrim(new.note) || '”' else '' end);
  return new;
end;
$$;

-- After insert, not before: order_items are written after the order row, so
-- a BEFORE trigger would find nothing to list. It is a statement-level
-- concern in disguise — the lines exist only once place_order() has put
-- them there, which is why this is a deferred constraint trigger.
drop trigger if exists on_order_placed on public.orders;
create constraint trigger on_order_placed
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.notify_new_order();

-- ─────────────────────────────────────────────────────────────────────
-- 3. a status change tells the customer
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_title := case new.status
    when 'confirmed' then 'Order ' || new.bill_no || ' is confirmed'
    when 'shipped'   then 'Order ' || new.bill_no || ' is on its way'
    when 'delivered' then 'Order ' || new.bill_no || ' was delivered'
    when 'cancelled' then 'Order ' || new.bill_no || ' was cancelled'
    else 'Order ' || new.bill_no || ' is now ' || new.status
  end;

  v_body := case new.status
    when 'confirmed' then 'We have it and are making it now.'
    when 'shipped'   then case when coalesce(new.tracking_id, '') <> ''
                            then coalesce(new.courier, 'Courier') || ' · ' || new.tracking_id
                            else 'It has been handed to the courier.' end
    when 'delivered' then 'Thank you. We hope the tying goes well.'
    when 'cancelled' then coalesce(nullif(btrim(new.cancel_reason), ''),
                                   'It will not be sent.')
    else null
  end;

  if new.user_id is not null then
    insert into public.notifications (audience, user_id, kind, order_id, title, body)
    values ('customer', new.user_id,
            case when new.status = 'cancelled' then 'order_cancelled' else 'order_status' end,
            new.id, v_title, v_body);
  end if;

  -- a customer calling off their own order is news for the seller too
  if new.status = 'cancelled' and coalesce(new.cancelled_by, '') = 'customer' then
    insert into public.notifications (audience, user_id, kind, order_id, title, body)
    values ('seller', null, 'order_cancelled', new.id,
            new.name || ' cancelled ' || new.bill_no,
            coalesce(nullif(btrim(new.cancel_reason), ''), 'No reason given.'));
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_status_notify on public.orders;
create trigger on_order_status_notify
  after update on public.orders
  for each row execute function public.notify_order_status();

-- ─────────────────────────────────────────────────────────────────────
-- 4. a customer calling off their own order
--
--    Only while it can still be called off. Once it is with the courier
--    it is too late, and saying so plainly is kinder than a button that
--    fails. Whatever stock the order took is put back.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.cancel_order(p_order uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o   public.orders;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select * into v_o from public.orders
   where id = p_order and user_id = v_uid
     for update;

  if not found then
    raise exception 'That order is not yours.' using errcode = '42501';
  end if;

  if v_o.status = 'cancelled' then
    return v_o;                                   -- already done; not an error
  end if;

  if v_o.status in ('shipped', 'delivered') then
    raise exception 'This order has already been sent, so it cannot be cancelled here. Message us on WhatsApp and we will sort it out.';
  end if;

  update public.orders
     set status        = 'cancelled',
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         cancelled_by  = 'customer'
   where id = p_order
   returning * into v_o;

  -- put back whatever it took out of stock
  update public.products p
     set stock = p.stock + i.qty
    from public.order_items i
   where i.order_id = p_order
     and p.id = i.product_id
     and p.stock is not null;

  return v_o;
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. marking a pile of them read in one call
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.mark_notifications_read(p_ids bigint[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.notifications
     set read_at = now()
   where read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.mark_notifications_read(bigint[]) from public;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
