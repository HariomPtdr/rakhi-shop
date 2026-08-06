-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 21: out for delivery
--
--  Run after 01–20. Safe to run twice.
--
--  "Shipped" covers three days of a parcel crossing the country and the
--  twenty minutes when somebody is at the end of the road with it. Those
--  are not the same news. The second is the one worth a message: it is
--  the only status a customer can act on — be at home, answer the phone,
--  have the cash ready.
--
--  So the ladder gains a rung between shipped and delivered. Nothing
--  above or below it changes: cancelling is still only allowed before it
--  is handed over, and delivered is still the end.
-- ════════════════════════════════════════════════════════════════════

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('placed','confirmed','shipped','out_for_delivery','delivered','cancelled'));

-- the log records where an order went; it has to know the same words
alter table public.order_status_log drop constraint if exists order_status_log_to_status_check;
alter table public.order_status_log drop constraint if exists order_status_log_from_status_check;

-- ─────────────────────────────────────────────────────────────────────
-- what the customer is told, now that there is one more thing to say
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
  if new.status = old.status then
    return new;
  end if;

  v_title := case new.status
    when 'confirmed'        then 'Order ' || new.bill_no || ' is confirmed'
    when 'shipped'          then 'Order ' || new.bill_no || ' has been sent'
    when 'out_for_delivery' then 'Order ' || new.bill_no || ' is out for delivery'
    when 'delivered'        then 'Order ' || new.bill_no || ' was delivered'
    when 'cancelled'        then 'Order ' || new.bill_no || ' was cancelled'
    else 'Order ' || new.bill_no || ' is now ' || new.status
  end;

  v_body := case new.status
    when 'confirmed' then 'We have it and are making it now.'
    when 'shipped'   then case when coalesce(new.tracking_id, '') <> ''
                            then coalesce(new.courier, 'Courier') || ' · ' || new.tracking_id
                            else 'It has been handed to the courier.' end
    when 'out_for_delivery' then 'It reaches you today. Keep your phone nearby'
                                 || case when new.payment = 'cod'
                                         then ' and the cash ready.' else '.' end
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

  if new.status = 'cancelled' and coalesce(new.cancelled_by, '') = 'customer' then
    insert into public.notifications (audience, user_id, kind, order_id, title, body)
    values ('seller', null, 'order_cancelled', new.id,
            new.name || ' cancelled ' || new.bill_no,
            coalesce(nullif(btrim(new.cancel_reason), ''), 'No reason given.'));
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- and a review still waits for the parcel to actually arrive
--
-- has_received() checks for 'delivered' and nothing else, so a rung added
-- below it changes nothing — this is only here to say that was checked.
-- ─────────────────────────────────────────────────────────────────────
select 'out_for_delivery added; delivered still gates reviews' as note;
