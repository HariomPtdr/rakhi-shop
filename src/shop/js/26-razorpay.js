/* ══════════════════════════════════════════════════════════
   PAYING, THROUGH RAZORPAY

   The order is placed first and paid second — never the other
   way round. So there is always a bill number, always a row in
   the database, and an abandoned payment leaves an order
   waiting rather than a payment belonging to nothing.

   Three steps, and the middle one is the only part the browser
   is trusted with:

     1. a function makes a Razorpay order from the amount in
        our database — the page cannot name a price;
     2. Razorpay's own sheet takes the money;
     3. a function checks the signature, checks the amount with
        Razorpay directly, and marks the order paid. The
        database trigger then confirms it and tells the
        customer, exactly as when the seller marks a payment in
        by hand.

   Their script is fetched only when somebody is actually
   paying. Every other page load still makes no request to
   anyone but Supabase.
   ══════════════════════════════════════════════════════════ */
const RZP_ON = !!(ENV.RAZORPAY_KEY_ID && SB_ON);
const RZP_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let rzpLoading = null;

function loadRazorpay(){
  if(window.Razorpay) return Promise.resolve(true);
  if(rzpLoading) return rzpLoading;
  rzpLoading = new Promise(resolve => {
    const s = document.createElement("script");
    s.src = RZP_SRC;
    s.onload  = () => resolve(true);
    s.onerror = () => { rzpLoading = null; resolve(false); };
    document.head.appendChild(s);
  });
  return rzpLoading;
}

/* One address, whoever is hosting. On AWS this is an Amplify rewrite onto
   the Lambda's Function URL; on Netlify it is a redirect onto that host's
   own functions. Same origin either way, so there is no CORS to arrange and
   no third-party address in the page. */
const fnUrl = name => "/api/" + name;

async function callFn(name, body, withToken){
  const headers = {"content-type": "application/json"};
  if(withToken){
    const token = await SB.token();
    if(!token) throw new Error("Sign in first.");
    headers.Authorization = "Bearer " + token;
  }
  const res = await fetch(fnUrl(name), {method: "POST", headers, body: JSON.stringify(body)});
  const out = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(out.error || "That did not work just now.");
  return out;
}

/* ── pay for an order that already exists ──
   Used from the bill the moment it is placed, and from the account for an
   order somebody left unpaid. Both end in the same place. */
let paying = false;                       /* one payment at a time, ever */

async function payForOrder(orderId, opts){
  const o = opts || {};
  if(!RZP_ON) return false;
  if(paying) return false;                /* a double tap is not two payments */
  paying = true;

  /* Their script is a few hundred kilobytes over a phone connection, and a
     button that does nothing for two seconds is a button people press
     again. */
  const btn = o.button;
  const wasHtml = btn ? btn.innerHTML : null;
  if(btn){ btn.disabled = true; btn.innerHTML = "Opening…"; }
  const release = () => {
    paying = false;
    if(btn){ btn.disabled = false; btn.innerHTML = wasHtml; }
  };

  const ok = await loadRazorpay();
  if(!ok){
    release();
    toast("Could not reach the payment page. Check your connection and try again.");
    return false;
  }

  let made;
  try{
    made = await callFn("rzp-create-order", {order_id: orderId}, true);
  }catch(err){
    release();
    toast(err.message);
    return false;
  }
  release();

  paying = true;                          /* held until the sheet is done with */
  return new Promise(resolve => {
    const done = v => { paying = false; resolve(v); };
    const rzp = new window.Razorpay({
      key: made.key_id,
      order_id: made.order_id,
      amount: made.amount,
      currency: made.currency || "INR",
      name: "Ray Art Gallery",
      description: "Order " + made.bill_no,
      image: location.origin + "/assets/images/nazar-rakhi.jpg",
      prefill: {
        name:    made.name || "",
        contact: made.phone || "",
        email:   (SB.user() && SB.user().email) || ""
      },
      notes: {bill_no: made.bill_no},
      theme: {color: "#1B8497"},

      handler: async (r) => {
        toast("Checking the payment…");
        try{
          const done = await callFn("rzp-verify", {
            razorpay_order_id:   r.razorpay_order_id,
            razorpay_payment_id: r.razorpay_payment_id,
            razorpay_signature:  r.razorpay_signature
          });
          acctOrders = null;                     /* the status has moved */
          if(typeof o.onPaid === "function") o.onPaid(done);
          else toast("Paid — your order is confirmed");
          if(isOn("#acctModal")){ paintAcct(); loadAcctData(); }
          done(true);
        }catch(err){
          /* the money may well have gone through — never say it did not */
          toast(err.message + " Keep this: " + r.razorpay_payment_id);
          done(false);
        }
      },

      modal: {
        ondismiss: async () => {
          const paidAnyway = await undoOrder(orderId, "Payment cancelled — nothing was charged");
          if(paidAnyway && typeof o.onPaid === "function") o.onPaid({ok: true, late: true});
          done(!!paidAnyway);
        }
      }
    });

    rzp.on("payment.failed", async res => {
      const d = (res && res.error) || {};
      await undoOrder(orderId, d.description || "That payment did not go through");
    });

    rzp.open();
  });
}

/* ── an order that never happened ──
   With a gateway there are two outcomes and no middle: it is paid, or
   nothing happened. Somebody who closes the sheet has not ordered anything,
   and leaving a row behind saying they did is a lie the seller has to chase
   and the customer has to look at.

   So the order is taken back out — the stock it held returns, a coupon it
   spent is unspent — and the basket is put back exactly as it was, ready to
   try again. */
async function undoOrder(orderId, why){
  /* ── the one race worth waiting for ──
     Somebody can pay and then close the sheet before the confirmation gets
     back, and the webhook can land a moment later. Discarding then would
     delete an order that has been paid for. So the order is read once more
     first, and if the money is in, this is a confirmation and not a
     cancellation. */
  try{
    const rows = await SB.rest("orders?select=id,paid_at,status&id=eq."
                             + encodeURIComponent(orderId) + "&limit=1");
    const row = Array.isArray(rows) && rows[0];
    if(row && row.paid_at){
      acctOrders = null;
      toast("Paid — your order is confirmed");
      return true;                       /* nothing to undo */
    }
  }catch(e){}

  try{
    await SB.rpc("discard_unpaid_order", {p_order: orderId});
  }catch(err){
    /* it may simply have been paid a second later; either way, nothing
       here is worth interrupting them with */
  }
  placedBill = "";                 /* so closing the bill does not empty the basket */
  lastOrderId = null;
  acctOrders = null;
  if(typeof pushCart === "function") pushCart();     /* the basket, back on the server */
  paintCart();
  toast(why + " — your basket is as it was");
  return false;
}
