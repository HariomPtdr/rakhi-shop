# Putting the shop on AWS

Two pieces. Amplify serves the site; one Lambda answers the three payment
endpoints. Supabase does not move, and neither do the photos — those stay
where they are until the S3 work is done.

    your domain
        │
        ▼
    Amplify Hosting ──── /api/* rewritten ────▶ Lambda Function URL
    (runs build.py,                              (holds the secrets)
     serves dist/)                                 │        │
                                                   ▼        ▼
                                              Supabase   Razorpay

Do it in this order. Nothing here deletes or changes the Netlify site, so
if a step misbehaves the shop is still up while you sort it out.

---

## Before anything

Region **ap-south-1 (Mumbai)**. Set it in the top-right dropdown before you
create a single resource — nothing can be moved between regions afterwards,
and Mumbai is the closest one to your customers.

---

## 1. The Lambda

**Lambda → Create function**

| Field | Value |
|---|---|
| Name | `rakhi-payments` |
| Runtime | Node.js 22.x |
| Architecture | arm64 (cheaper, same speed) |

Then:

1. **Code → Upload from → .zip file** → upload `aws/rzp-lambda.zip`

   The zip is committed so it can be downloaded straight from GitHub
   without a terminal. It is built from `netlify/functions/*.mjs`, so if
   any of those three files ever changes, run `sh aws/package.sh` and
   upload it again — otherwise the Lambda keeps running the old copy of
   the code that checks payment signatures.
2. **Runtime settings → Handler** stays `index.handler`
3. **Configuration → General → Timeout**: 15 seconds
4. **Configuration → Environment variables** — add these six:

   | Key | Where it comes from | Needed by |
   |---|---|---|
   | `RAZORPAY_KEY_ID` | Razorpay dashboard, the `rzp_live_…` one | create-order, verify |
   | `RAZORPAY_KEY_SECRET` | Razorpay dashboard — this one is a secret | create-order, verify |
   | `RAZORPAY_WEBHOOK_SECRET` | set when you create the webhook, step 4 | webhook |
   | `SUPABASE_URL` | Supabase → Project settings → API | all three |
   | `SUPABASE_ANON_KEY` | same page — the anon/public key | create-order |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page — **never** put this in the site | all three |

   Six, not five. `SUPABASE_ANON_KEY` is easy to leave out here because it
   is also an Amplify variable, and the shop looks fine without it — right
   up until a customer tries to pay and gets "The database is not
   configured here."

5. **Configuration → Function URL → Create**
   - Auth type: **NONE**. The endpoints do their own checking: two verify a
     Supabase token, the third verifies Razorpay's signature. IAM auth here
     would lock out the browser and Razorpay both.
   - CORS: leave off. Nothing calls this cross-origin — the browser reaches
     it through Amplify on the same domain, and Razorpay is a server.
6. Copy the URL it gives you. It looks like
   `https://xxxxxxxx.lambda-url.ap-south-1.on.aws/`

---

## 2. Amplify

**Amplify → Create new app → GitHub** → `rakhi-shop`, branch `master`.

It will read `amplify.yml` from the repo, so the build settings fill
themselves in: build command `python3 build.py`, output `dist`.

**App settings → Environment variables** — all five that `build.py` reads.
They are the same five already in your local `.env` and in Netlify:

| Key | Notes |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | the anon key, **not** the service role key |
| `SUPABASE_BUCKET` | `product-images` |
| `ADMIN_PATH` | where the dashboard is published |
| `RAZORPAY_KEY_ID` | the `rzp_live_…` id — public by design, it has to be in the page to open the checkout |

Leave out any one of these and the build still succeeds — it just produces
a shop with no photos, or no checkout, or no dashboard. `build.py` prints
which ones it found at the end of the build; read that line.

**App settings → Rewrites and redirects → Add rule**

| Source | Target | Type |
|---|---|---|
| `/api/<*>` | `https://xxxxxxxx.lambda-url.ap-south-1.on.aws/<*>` | 200 (Rewrite) |

`<*>` is Amplify's wildcard: `/api/rzp-verify` arrives at the Lambda as
`/rzp-verify`. One slash before it, not two.

A **rewrite**, not a redirect — the browser keeps talking to your own
domain and never learns the AWS address, which is what keeps this
same-origin with no CORS to arrange.

**Rules apply from the top down.** If Amplify has added a catch-all
(`/<*>` → `/index.html`), drag this rule above it, or every `/api/`
request gets the shop's HTML instead of the Lambda.

Then **Run build**. It should finish in under a minute.

### Is the rewrite working?

Open `https://<your-app>.amplifyapp.com/api/rzp-verify` in a browser.

| What comes back | What it means |
|---|---|
| `{"error":"POST only"}` | working — a browser sends GET, and that endpoint takes POST |
| the shop's homepage | the rule is not matching; check its order and the `<*>` |
| `{"error":"no such endpoint"}` | the rewrite works, the path does not — look for a double slash |
| a network or CORS error | wrong target, or the Function URL is not enabled |

---

## 3. Check it before pointing money at it

Open the Amplify URL and:

- the shop loads, rakhis and prices are there → Supabase env vars are right
- open the dashboard at your `ADMIN_PATH` → `ADMIN_PATH` is right
- put something in the basket and start a payment. The Razorpay sheet
  should open. **Close it without paying** — the order should vanish and
  the rakhi should still be in your basket.
- then pay ₹39 for real. The order should appear in the dashboard marked
  paid, and a notification should arrive.

If the payment sheet does not open, it is almost always the rewrite: open
the browser's network tab and look at what `/api/rzp-create-order`
returned.

---

## 4. The webhook — last, and pointed at the Lambda directly

**Razorpay → Settings → Webhooks → Add New Webhook**

| Field | Value |
|---|---|
| URL | `https://xxxxxxxx.lambda-url.ap-south-1.on.aws/rzp-webhook` |
| Events | `payment.captured`, `order.paid` |
| Secret | make one up, long and random |

Put that same secret into the Lambda's `RAZORPAY_WEBHOOK_SECRET`.

**Straight at the Function URL, not through `/api/`.** The signature is an
HMAC over the raw bytes of the request, so a proxy that re-encodes the body
on the way through would break a check that is the only thing standing
between us and a forged payment. Taking Amplify out of that path removes
the risk entirely.

This is why it is last: it is the one thing that, while switched over, is
no longer pointing at Netlify.

---

## 5. Only then

Keep the Netlify site until a real payment has worked here twice. It costs
nothing to leave it up, and it is the thing you fall back to.

---

## What this costs

Lambda's 1M requests a month is free permanently and you will not come near
it. Amplify charges for build minutes and data served; at 1.4 MB a page and
this much traffic it is small, but it is not zero — the budget alert you set
is what tells you if that ever stops being true.
