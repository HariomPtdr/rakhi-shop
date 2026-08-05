# Ray Art Gallery

A handmade-rakhi shop, and the dashboard for running it.

Customers browse on a phone, fill a basket, and the page writes their bill and
opens your WhatsApp with the whole thing typed out. Signed in, their basket,
their saved rakhis and their orders follow them to any phone. You get `/admin`:
the orders as they arrive, the catalogue, the customers, and the numbers
underneath all three.

No framework, no npm, no build tooling beyond one Python file. The published
shop is a single HTML file that makes **zero network requests** until it asks
the database a question.

---

## Start here

```sh
python3 build.py                       # → dist/
cd dist && python3 -m http.server 8000 # → localhost:8000
```

Then, in order:

| | |
|---|---|
| **[docs/SUPABASE.md](docs/SUPABASE.md)** | Create the database, and make yourself the seller. Twenty minutes, once. |
| **[docs/DEPLOY.md](docs/DEPLOY.md)** | The two environment values, and putting it on Netlify. |
| **[docs/DASHBOARD.md](docs/DASHBOARD.md)** | Running the shop from `/admin`, screen by screen. |
| **[docs/STRUCTURE.md](docs/STRUCTURE.md)** | Where the code is and why it is in that order. |

---

## What is in it

**The shop** — a two-column grid built for a phone, a page and a shareable link
for every rakhi (`…/#p/nazar`), a bottom-sheet cart, a bill with a real number,
a heart on every card, and an account section with orders, a wishlist and saved
delivery details. It works with the database switched off: the basket lives on
the phone and the catalogue is written into the page.

**The dashboard** at `/admin` — six screens: Overview, Orders, Products,
Customers, Insights, Settings. Orders move Placed → Confirmed → Shipped →
Delivered with one button, and the tracking id you save appears in the
customer's own account. Prices and stock are edited in place. Photos upload
straight from the products table.

**Authentication** — Supabase Auth, one session shared by the shop and the
dashboard. Email and password, **Continue with Google** (drawn only when the
project actually has the provider on, so it can never lead anywhere broken), and
a forgotten-password link that comes back into the page and asks for the new one.
Tokens are read out of the address bar and wiped from it immediately, so none is
ever left in a URL to be copied or shared.

**The database** — Postgres on Supabase, with row level security on every table,
prices recomputed server-side on every order, and an order's totals locked
against editing after the fact. Three SQL files, tested against a real Postgres
before shipping.

## The settings you must change

`src/shop/js/01-shop.js`:

```js
whatsapp:  "919319848309",       // 91 + the 10 digits
upi:       "rayartgallery@upi",  // ⚠ printed on every bill — set your real one
instagram: "ray_art_24",
email:     "patidarh178@gmail.com",
```

Everything else — prices, the delivery charge, the festival dates — is edited in
the dashboard once the database is up, and is live for the next visitor.

## Before you take real orders

- [ ] **A real UPI ID** in `src/shop/js/01-shop.js` — it prints on every bill
- [ ] Real prices on every rakhi (Products, in the dashboard)
- [ ] Run the three SQL files, and make your account the seller
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` set in Netlify, and a fresh deploy
- [ ] Replace `https://example.com` in the `og:` tags with your real address
- [ ] Confirm the Raksha Bandhan date and your cut-off (Settings)
- [ ] Photograph the remaining designs and replace the drawings

## How ordering works

1. The customer adds rakhis to the cart.
2. "Create the bill" asks for name, phone, address, city, pincode — all checked.
3. The page builds a bill with a number (`RAG-260805-01`) and the totals.
4. **"Send order to Ray Art Gallery"** opens *your* WhatsApp with the whole bill
   already written. They only press send.
5. **"Save PDF copy"** downloads the same bill for their records.

The message is the order. If they are signed in, a copy is also recorded in the
database — priced there, from your products table, not from whatever the browser
claims — and appears in your dashboard and in their account. If Supabase is
unreachable the message still goes; only the copy is missed.

### Why the order goes as text and not as a PDF attachment

| | reaches your number | can attach a file |
|---|---|---|
| `wa.me/<your number>` link | **yes, always** | no — text only |
| the phone's share sheet | no — the customer picks the app *and the contact* | yes |

No web API does both. The share sheet would let the order go to a friend,
another app, or nowhere, and you would never see it. So the button uses the
`wa.me` link to your number and the complete order is written into the message:
items, quantities, rates, subtotal, delivery, total, name, phone, address,
pincode and their note. Nothing is lost by not attaching a file.

## Built for phones

Almost everyone opens this on a phone, so that is what it is designed and tested
for; the desktop layout is the adaptation.

Two-column grid. Sticky cart bar. Cart and bill are bottom sheets you can drag
down. Android's back button closes the open sheet instead of leaving the shop.
Every button is at least 40px; form fields are 16px so iOS does not zoom. Padding
respects the iPhone home bar. No 3D transforms and no backdrop blur on phones —
the two things that make a cheap Android stutter — and blur is added back only on
desktop. The decorative petals are drawn once and left still on a phone; no
animation loop runs in the background draining the battery.

Measured on an emulated mid-range phone (360×640, 4× slower CPU, Slow 4G):
largest contentful paint **203 ms**, layout shift **0.00**, **0** network
requests.

## The design

Spectral for display and prices, Libre Franklin for headings and text. The
colours come from the rakhi itself: turquoise resham thread, haldi yellow,
sindoor red, ivory seed bead and gold frame, over warm card stock.

A thread runs across the top of the page with a bead that slides as you scroll.
Marigold petals are thrown when something goes in the cart. Rangoli turns slowly
behind the page on desktop. Everything animates transform or background only,
and all of it switches off for anyone who has "reduce motion" turned on.
