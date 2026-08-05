# Running the shop from `/admin`

Sign in with the account you made the owner (`docs/SUPABASE.md`, step 4). It is
the same account you use in the shop; signing in on one signs you in on the
other.

Six screens. Everything on them is live — a price changed here is what the next
visitor sees, with nothing to rebuild or re-upload.

---

## Overview

The screen to open in the morning.

- **Revenue · Average order · To send out · New customers** for the period, with
  7 days / 30 days / 90 days / 1 year across the top.
- **Revenue day by day.** Hover a bar for the date, the amount and the count.
- **How a visit goes** — visitors → looked at a rakhi → added one → started a
  bill → sent it. Where the bars fall away is where you are losing people. Under
  it, the plain number: what share of the rakhis people looked at ended in an
  order.
- **Best sellers**, by money rather than by count.
- **Where the orders are** — how many placed, confirmed, shipped, delivered.
- **Running low** — anything with fewer than five left. Nothing here means
  either you have plenty or you are not counting stock.
- **Just in** — the last eight orders. Tap one to open it.

## Orders

Filter by status along the top; search by bill number, name, phone or city.
**Export CSV** takes what you are looking at into a spreadsheet.

Tap any order:

- **Send to** — name, phone, the full address, and their note. **WhatsApp** opens
  their chat with the greeting already written; **Call** dials; **Copy address**
  puts the whole thing on the clipboard for the courier's form.
- **What they ordered**, with the totals as they were priced when the order was
  placed. These cannot be edited — not by you either. An order is a record of
  what was agreed.
- **Move it along** — one button, always the next step: Placed → Confirmed →
  Shipped → Delivered. Cancel is separate, and a cancelled order can be
  reopened.
- **Courier and tracking id.** Save it and the customer sees it in their own
  account, on the same order, with a copy button. Nobody has to be told.
- **Your note** is private. The customer never sees it.
- **History** — every change with its time, written by the database itself when
  the change happened, so it cannot be forgotten or made up afterwards.

## Products

Every rakhi with the four numbers that matter next to each other: **Seen**,
**Wished**, **Sold**, **Revenue**. Tap a column heading to sort by it.

- **Price** and **Stock** are edited in place — type and press Enter. Blank stock
  means "do not count this one"; the shop keeps selling it either way. A count
  goes down by itself as orders come in.
- **Live / Hidden** takes a design off sale without deleting anything.
- **Tap the picture** on a row to upload a photo. It goes straight into Supabase
  storage and onto the shop. Shrink it first — 60–90 KB is plenty.
- **Add a rakhi** asks for a name, a link name (this becomes its address:
  `…/#p/blue-moti`), a price, and a thread colour with a centre piece. Until
  there is a photo the shop draws the design from those two and labels it
  "Drawing".

A rakhi with a long **Wished** bar and a small **Sold** number is the most
useful row on this screen: people want it and are not buying it. Usually the
price, or it ran out.

## Customers

Everyone with an account: where they are, how many orders, how much spent, how
many rakhis hearted, what is in their basket right now, when they last ordered
and when they were last on the site. Search and sort; export to CSV.

Tap one for everything the shop knows about them — their orders, their
wishlist, their basket as it stands, and the last sixty things they did on the
site in plain words ("hearted nazar", "started a bill"). WhatsApp and Call are
one tap from there.

## Insights

The questions a sales report cannot answer.

- **Wanted more than bought** — hearts against pieces sold.
- **Where the orders go** — the top cities, by money.
- **What sells, by kind** — evil-eye, pearl, kids, lumba, premium, packs.
- **What hour** and **what day** orders arrive, in India time. Worth knowing
  before you decide when to post on Instagram.
- **New against returning.**
- **What people searched for.**
- **Baskets filled and left** — signed-in customers with something still in the
  basket, most valuable first, each with a **Nudge** button that opens WhatsApp
  with a message already written. One message usually finishes half of these.

## Settings

Delivery charge, the amount that makes delivery free, the Raksha Bandhan date
and your last order date. All four are live the moment you save: the countdown
on the shop, the "free over ₹499" line, and the delivery on every bill.

Under it, how to hand the dashboard to someone else — one line of SQL, because
nothing in either page can promote an account.

---

## What the customer sees of all this

- **Their orders**, with the four steps drawn as a line, and the tracking id you
  saved, with a copy button.
- **Their wishlist**, with Add to cart next to each.
- **Their details**, saved once, filling in every bill after that.

All of it under the account button in the shop's header, or at `/#account`.

## What is not collected

No third-party analytics, no advertising id, no cookies beyond the sign-in
session. A guest is a random string kept in their own browser and nothing else
until they sign in. Every number on every screen above came out of your own
database.
