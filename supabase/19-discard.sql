-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 19: an order that never happened
--
--  Run after 01–18. Safe to run twice.
--
--  While payments were taken on WhatsApp, an order had to exist before
--  the money did: the bill was the thing being sent. So an unpaid order
--  sat waiting, and both sides could see it waiting.
--
--  With a gateway there are two outcomes and no middle: it is paid, or
--  nothing happened. Somebody who closes the payment sheet has not
--  ordered anything, and leaving a row behind saying they did is a lie
--  the seller then has to chase.
--
--  So the order is placed, the sheet opens, and if the payment does not
--  complete the order is discarded — properly: the stock it took goes
--  back, a coupon it spent is unspent, and the row is gone rather than
--  sitting in the list as noise.
--
--  Guarded so it can only ever remove something that was never real:
--  their own order, never paid, still placed, and made in the last hour.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.discard_unpaid_order(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order;
  if v_order.id is null then
    return false;                                  -- already gone; fine
  end if;
  if v_order.user_id is distinct from v_uid then
    raise exception 'not your order' using errcode = '42501';
  end if;

  -- everything that would make this a real order stops it being discarded
  if v_order.paid_at is not null then return false; end if;
  if v_order.payment <> 'upi'      then return false; end if;
  if v_order.status  <> 'placed'   then return false; end if;
  if v_order.created_at < now() - interval '1 hour' then return false; end if;

  -- the stock it took comes back
  update public.products p
     set stock = p.stock + oi.qty
    from public.order_items oi
   where oi.order_id = v_order.id
     and p.id = oi.product_id
     and p.stock is not null;

  -- and a coupon it spent is unspent
  if v_order.coupon_code is not null then
    update public.coupons
       set used_count = greatest(0, used_count - 1)
     where code = v_order.coupon_code;
    delete from public.coupon_redemptions where order_id = v_order.id;
  end if;

  -- the notifications about an order that never happened go with it
  delete from public.notifications  where order_id = v_order.id;
  delete from public.order_status_log where order_id = v_order.id;
  delete from public.order_items      where order_id = v_order.id;
  delete from public.orders           where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.discard_unpaid_order(uuid) from public;
grant execute on function public.discard_unpaid_order(uuid) to authenticated;
