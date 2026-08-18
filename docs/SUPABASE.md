# The database

Twenty minutes, once. After it the shop has accounts, baskets that survive a new
phone, wishlists, a record of every order, and a dashboard for you at `/admin`.

Supabase's free tier is enough for a rakhi season. None of this costs money.

Your project already exists: **bvyuoznbmffwvzzwdlfs**. Step 1 is only for a
second one.

---

## 1. Make a project — *skip if you already have one*

1. Sign up at **supabase.com** and create a project.
2. Choose the region closest to your customers — **Mumbai (ap-south-1)** for India.
3. Save the database password it asks you to set. The website never needs it.

## 2. Create the tables

**SQL Editor** in the left sidebar → **New query**. Paste each file, press
**Run**, in this order. Every file below is in the `supabase/` folder.

The first three are the shop. Everything after them adds one thing each, in
the order the shop grew, and each assumes the ones before it have been run.

| # | File | What it does |
|---|---|---|
| 1 | `01-schema.sql` | The tables, the security rules, the cart and order functions, the photo bucket. |
| 2 | `02-admin.sql` | The seller: who you are, what you may see, and the five reports the dashboard is built from. |
| 3 | `03-seed.sql` | The ten rakhis and two packs the site ships with, so nothing changes on screen. |
| 4 | `04-notifications.sql` | Telling people what happened — the Updates screen, written by trigger as an order moves. |
| 5 | `05-reviews.sql` | Reviews and ratings. The insert policy checks you actually received the rakhi. |
| 6 | `06-coupons.sql` | Coupon codes and who has redeemed them. |
| 7 | `07-images.sql` | More than one photo per rakhi. |
| 8 | `08-location.sql` | Where to actually deliver — a dropped pin on a profile and on an order. |
| 9 | `09-compare.sql` | "Is that good?" — this week against last. |
| 10 | `10-shop.sql` | The things a shop changes: shipping, the pause, the festival dates. |
| 11 | `11-payment.sql` | How they are paying. |
| 12 | `12-coupon-note.sql` | The seller's answer to "where do I get a code?". |
| 13 | `13-messages.sql` | A word from the seller, on one order. |
| 14 | `14-address.sql` | Correcting an order, until it is handed to a courier. |
| 15 | `15-admin.sql` | A second owner. |
| 16 | `16-payment-mode.sql` | Who decides how it is paid for. |
| 17 | `17-contact.sql` | The UPI id on every bill. |
| 18 | `18-razorpay.sql` | Paying by card, UPI or netbanking. |
| 19 | `19-discard.sql` | An order that never happened. |
| 20 | `20-notify-on-payment.sql` | Told when the money is in. |
| 21 | `21-out-for-delivery.sql` | The fifth step on the tracker. |
| 22 | `22-tags.sql` | Tags on a rakhi, beyond the one shelf it lives on. |
| 23 | `23-free-ship-qty.sql` | Free delivery on two rakhis, whatever they cost. |
| 24 | `24-mrp.sql` | An old price on every rakhi, so the card can show the saving. |
| 25 | `25-addresses.sql` | The address book: several addresses per account, one of them the default. |

Each should end with `Success`. Running any of them a second time is harmless —
they are written to be re-run.

**If you are only catching up**, run the ones you have not yet. Nothing here is
retired by a later file: `25-addresses.sql`, for instance, keeps writing the
default address back onto `profiles` so everything built against those columns
before it carries on working.

## 3. Turn off the confirmation email (recommended)

**Authentication → Sign In / Providers → Email**, turn **Confirm email** off.

Why: on the free tier Supabase sends only a few emails an hour, and a customer
who does not receive one cannot sign in at all. Off, an account works the moment
it is made.

The trade-off, honestly: someone could sign up with an email that is not theirs.
For a shop where the order is confirmed on WhatsApp anyway, that costs you
nothing. Turn it on later if you ever email customers.

Keep **Minimum password length** at 8 or more — both pages ask for 8.

## 3b. Where people are allowed to come back to

Both "Continue with Google" and the forgotten-password email send the browser
away and then back, and Supabase will only send it back to an address you have
listed.

**Authentication → URL Configuration**:

- **Site URL** — `https://your-site.netlify.app`
- **Redirect URLs** — add these, one per line:

  ```
  https://your-site.netlify.app/**
  http://localhost:8000/**
  ```

The `/**` covers every page on the site, the dashboard included, without
naming any of them here. The `localhost` line lets you test on this machine.
Add your custom domain the day you set one up, or sign-in will bounce back to
the Netlify address instead.

## 3c. Sign in with Google — optional

Worth doing: on a phone it is one tap and there is no password to forget, and
most people abandon a sign-up form before they finish it.

The shop asks Supabase which providers are switched on and only draws the
button if Google actually is, so nothing is broken while you have not done this
— the button simply is not there.

1. **console.cloud.google.com** → create a project (or use one you have).
2. **APIs & Services → OAuth consent screen** → External → fill in the app name,
   your support email, and publish it.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorised redirect URIs**, paste the callback Supabase shows you on
   its Google provider page. It is:

   ```
   https://bvyuoznbmffwvzzwdlfs.supabase.co/auth/v1/callback
   ```

5. Copy the **Client ID** and **Client secret**.
6. In Supabase: **Authentication → Sign In / Providers → Google** → turn it on,
   paste both, **Save**.

Open the shop, tap the account button, and "Continue with Google" is there.

Someone who signs in with Google gets a profile row like anyone else, with
their name filled in from their Google account. They have no password — if they
ever want one, "Forgotten your password?" sends them a link to set it.

## 4. Make yourself the seller

The dashboard opens for exactly one kind of account: one whose profile row says
`role = 'admin'`. Nothing in either page can grant that — which is precisely why
nobody can grant it to themselves.

**`03-seed.sql` already does it for you.** Near the bottom it has your email:

```sql
insert into public.admin_emails (email) values
  (lower('patidarh178@gmail.com'))          -- ← your email
on conflict (email) do nothing;
```

Change it if you will sign in as someone else, then run the file. It works in
either order:

- **You have not signed up yet** — a trigger makes you an admin the moment you
  do, whether you use a password or Google.
- **You already signed up** — the update just below promotes the account you
  have.

So the whole thing is: run the three files, create an account on the shop with
that email, open `/admin`. Nothing else.

`admin_emails` has row level security on and **no policies at all**, so nothing
reaching the API with the publishable key can read it, add to it, or learn that
it exists. Only the SQL editor and the signup trigger touch it. Tested: a
signed-in customer sees zero rows and cannot insert their own address.

To hand the shop to someone else, add their email to that table. To take it
back, delete their row and set their profile's `role` to `'customer'`.

## 5. The keys

**Project Settings → API keys**. Two things:

- **Project URL** — `https://something.supabase.co`
- the **publishable** key — `sb_publishable_…`. Older projects call this the
  **anon public** key and it starts `eyJ…`; either works.

They go in `.env`, which is not in git:

```
SUPABASE_URL=https://bvyuoznbmffwvzzwdlfs.supabase.co
SUPABASE_ANON_KEY=sb_publishable_…
SUPABASE_BUCKET=product-images
```

Then `python3 build.py`.

That key is **meant** to be public — it ships inside every Supabase website.
What protects your data is the row level security in `01-schema.sql`, not the
secrecy of the key. Someone holding it can read the catalogue and their own
rows, and nothing else.

The one that must never go near a browser is the **service_role** (or
`sb_secret_…`) key. Nothing here uses it, and `build.py` refuses to build if it
finds one in the environment.

## 6. The photos

Two ways:

- **From the dashboard.** Products → tap the little picture on any row → choose
  a file. It goes into the bucket and onto the shop immediately.
- **From Supabase.** Storage → `product-images` → drag files in, then set
  `image_path` on the matching row in **Table editor → products**.

Shrink them first or the shop is slow on mobile data:

```sh
sips -Z 900 pearl-rakhi.jpg -s formatOptions 75
```

Aim for 60–90 KB each. A rakhi with `image_path` empty keeps showing the
drawing, labelled **Drawing**, so nobody mistakes it for a photograph.

---

## What is in there

| Table | What it holds |
|---|---|
| `shop_settings` | One row: delivery charge, free-delivery limit, the two dates. |
| `products` | The catalogue — price, category, photo, stock, cost. |
| `profiles` | One per customer, made automatically at signup. Holds `role`. |
| `cart_items` | Baskets, per customer. |
| `wishlists` | The hearts. |
| `orders` · `order_items` | Placed orders and their lines, priced by the database. |
| `order_status_log` | Every status change, written by a trigger. |
| `events` | Looked at, added, hearted, started a bill, sent it. |

### The rules underneath

- **Row level security is on for every table.** A customer reads and writes only
  rows whose `user_id` is their own. The catalogue and the settings row are
  world-readable and read-only. The seller — and only the seller — sees the
  rest, and Postgres decides that, not JavaScript.
- **Prices are never trusted from the browser.** `place_order()` recomputes
  every line from `products` and the delivery charge from `shop_settings`, then
  stores that. Editing the page in devtools changes what you *see*, never what
  is recorded.
- **Orders cannot be written through the API at all** — only by `place_order()`.
  Once placed, the totals cannot be edited by anyone, seller included: a trigger
  refuses it. Status, courier, tracking id and your own private note are the
  only things that can change.
- **Orders are recorded, never blocked.** The WhatsApp message is still the
  order. Recording it is a separate, best-effort call; if Supabase is down the
  message still goes and the customer is told the copy could not be saved.
- **A Supabase outage is not a broken shop.** If the catalogue cannot be
  fetched, the page falls back to the list written into its own JavaScript. The
  basket and the wishlist keep working on the phone. Only accounts, history and
  the dashboard go quiet.

### It has been tested

Both SQL files were run against a real Postgres 16 before they were shipped, and
these were checked, not assumed:

- a customer sees their own two orders and no one else's
- a customer cannot change an order status or a price
- the seller sees every order, every basket and every event
- `place_order()` ignores a browser that claims a rakhi costs ₹999
- stock counts down when an order is placed
- an order's total cannot be edited after the fact, by anyone
- all five reports return the right numbers on known data

That run also turned up a real bug in the original schema: `merge_cart()` threw
`column reference "product_id" is ambiguous` every time it was called, so
signing in never actually merged a basket. It is fixed in `01-schema.sql`.

---

## If something is wrong

**The account button never appears.** `SUPABASE_URL` or `SUPABASE_ANON_KEY` is
empty, or you are looking at a page built before you filled them in. Check
`.env`, run `python3 build.py`, open `dist/index.html`.

**"Could not reach the server."** Wrong project URL, or the project is paused —
free projects pause after a week of no traffic. Open the Supabase dashboard to
wake it.

**`Could not find the table 'public.products'`** — the SQL in step 2 has not
been run yet.

**The dashboard says the account is not the shop's owner.** Step 4 has not been
done, or it was done for a different email. The check query there tells you.

**Signing up says the password is too short.** Supabase's minimum is higher than
8. Lower it under Authentication → Providers → Email.

**"Open the confirmation link we emailed you."** Confirm email is still on —
step 3.

**Google sends them back to the wrong address, or says the redirect is not
allowed.** The address is not in **Authentication → URL Configuration →
Redirect URLs** — step 3b. This is also what happens the first time you put the
site on a custom domain.

**The Google button is not there.** The provider is not switched on in Supabase.
The page asks before it draws the button, so this is the button telling you the
truth. Step 3c.

**The reset email arrives but the link just opens the shop.** The address it
came back to is not on the redirect list — step 3b — or the link has been used
already. They are good once, for an hour.

**Prices on the site are not the ones in the table.** The page keeps its own
copy as a fallback and only replaces it when the fetch succeeds. Reload; if it
is still wrong, open the browser console and look for the failing request.

**Nothing in `orders` after a customer sends a bill.** They were not signed in.
Guests are deliberately not recorded: an unauthenticated write endpoint is an
invitation to spam.
