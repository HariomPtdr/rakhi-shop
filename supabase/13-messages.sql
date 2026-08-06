-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 13: a word from the seller
--
--  Run after 01–12. Safe to run twice.
--
--  Until now the customer only ever heard from the shop when a status
--  changed, in words this file wrote months ago. But most of what a
--  seller actually needs to say does not fit a status:
--
--    "the turquoise thread has run out — is red all right?"
--    "your pincode is one digit short, can you check it?"
--    "posting tomorrow morning, it will reach before the 24th"
--
--  WhatsApp is still the place for a conversation. This is for the
--  sentence that should sit permanently against the order, where the
--  customer will find it in their account whether or not they saw the
--  message on their phone.
--
--  It is a notification, not a chat: one way, tied to one order. The
--  customer answers on WhatsApp, where they were always going to.
-- ════════════════════════════════════════════════════════════════════

-- 'message' joins the three kinds the notification list already knows
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order_placed','order_status','order_cancelled','message'));

-- ─────────────────────────────────────────────────────────────────────
-- the seller writes to the customer of one order
--
-- security definer, because the customer's notification rows are not
-- otherwise the seller's to insert. Everything it needs is derived from
-- the order id — the caller cannot name the recipient, so this cannot be
-- used to write to anyone who has not ordered.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.message_customer(
  p_order uuid,
  p_body  text
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_row   public.notifications;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_body = '' then
    raise exception 'nothing to send';
  end if;
  if length(v_body) > 500 then
    raise exception 'that is too long for a notification — send it on WhatsApp';
  end if;

  select * into v_order from public.orders where id = p_order;
  if v_order.id is null then
    raise exception 'no such order';
  end if;
  -- an order placed by a guest has nobody to notify
  if v_order.user_id is null then
    raise exception 'that order has no account behind it — use WhatsApp';
  end if;

  insert into public.notifications (audience, user_id, kind, order_id, title, body)
  values ('customer', v_order.user_id, 'message', v_order.id,
          'About your order ' || v_order.bill_no, v_body)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.message_customer(uuid, text) from public;
grant execute on function public.message_customer(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- the seller can see what was sent
--
-- Read only, and only rows attached to an order — which is every
-- customer notification this shop creates. Without it the dashboard
-- could send a message and then have no way to show that it went, so
-- the seller would send it twice.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "admin reads order notifications" on public.notifications;
create policy "admin reads order notifications" on public.notifications
  for select using (order_id is not null and public.is_admin());
