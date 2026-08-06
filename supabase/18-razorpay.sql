-- ════════════════════════════════════════════════════════════════════
--  Ray Art Gallery — database, part 18: paying by card, UPI or netbanking
--
--  Run after 01–17. Safe to run twice.
--
--  Until now a UPI order waited for the seller to see the money in their
--  own app and say so. A gateway does that part: the customer pays in a
--  sheet that Razorpay puts on the page, Razorpay tells us the payment
--  succeeded, and the order confirms itself.
--
--  Two columns, and nothing else. Everything that follows a payment —
--  paid_at being set, the order moving to confirmed, the customer being
--  told — already exists and is untouched by this.
--
--  The signature check and the marking-paid happen in a Netlify function
--  with the key secret, never in the browser. This file is only the
--  place the two Razorpay references are written down, so a payment can
--  always be traced from a bill number to a transaction in their
--  dashboard and back.
-- ════════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists rzp_order_id   text;
alter table public.orders add column if not exists rzp_payment_id text;

-- one Razorpay order belongs to one of ours; the verify step looks up
-- our order by theirs, so it has to be quick and it has to be unique
create unique index if not exists orders_rzp_order_idx
  on public.orders (rzp_order_id) where rzp_order_id is not null;

create index if not exists orders_awaiting_payment_idx
  on public.orders (created_at desc)
  where payment = 'upi' and paid_at is null and status = 'placed';

select 'ready — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Netlify' as next_step;
