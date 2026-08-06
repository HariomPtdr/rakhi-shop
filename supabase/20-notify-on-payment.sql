-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 20: told when the money is in
--
--  Run after 01–19. Safe to run twice.
--
--  The seller was told the moment an order row appeared. That was right
--  when an order and a commitment were the same thing. They are not any
--  more: an online order is written before the payment sheet opens, and
--  if the payment does not complete the row is taken back out again.
--
--  So the bell would ring, the seller would look, and the order would be
--  gone. A notification that has to be un-sent is worse than none.
--
--  Now:
--    cash on delivery — told at once, as before. There is no payment
--                       step; the order is the commitment.
--    paid online      — told when the money arrives, which is the same
--                       moment the order becomes real.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. at insert: only the orders that are already real
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
  -- an online order is not news until it is paid for; part 20's other
  -- trigger says so then
  if new.payment <> 'cod' then
    return new;
  end if;

  select string_agg(name || ' × ' || qty, ', ')
    into v_items
    from public.order_items where order_id = new.id;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('seller', null, 'order_placed', new.id,
          new.name || ' ordered ' || to_char(new.total, 'FM₹9,99,999') || ' — cash on delivery',
          coalesce(v_items, '') ||
            case when coalesce(btrim(new.note), '') <> ''
                 then ' — “' || btrim(new.note) || '”' else '' end);
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. and when a payment lands, that is the new order
--
-- After the update rather than before it, so the row it describes is the
-- one that was actually written — and the order_items it reads are there.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.notify_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items text;
begin
  if new.paid_at is null or old.paid_at is not null then
    return new;                                  -- not the moment it was paid
  end if;

  select string_agg(name || ' × ' || qty, ', ')
    into v_items
    from public.order_items where order_id = new.id;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('seller', null, 'order_placed', new.id,
          new.name || ' ordered ' || to_char(new.total, 'FM₹9,99,999') || ' — paid',
          coalesce(v_items, '') ||
            case when coalesce(btrim(new.note), '') <> ''
                 then ' — “' || btrim(new.note) || '”' else '' end);
  return new;
end;
$$;

drop trigger if exists on_order_paid_notify on public.orders;
create trigger on_order_paid_notify after update on public.orders
  for each row execute function public.notify_paid_order();
