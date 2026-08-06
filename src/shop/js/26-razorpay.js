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

const fnUrl = name => "/.netlify/functions/" + name;

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
async function payForOrder(orderId, opts){
  const o = opts || {};
  if(!RZP_ON) return false;

  const ok = await loadRazorpay();
  if(!ok){
    toast("Could not reach the payment page. Pay on WhatsApp instead.");
    return false;
  }

  let made;
  try{
    made = await callFn("rzp-create-order", {order_id: orderId}, true);
  }catch(err){
    toast(err.message);
    return false;
  }

  return new Promise(resolve => {
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
          resolve(true);
        }catch(err){
          /* the money may well have gone through — never say it did not */
          toast(err.message + " Keep this: " + r.razorpay_payment_id);
          resolve(false);
        }
      },

      modal: {
        ondismiss: () => {
          toast("Payment cancelled — the order is still waiting for it");
          resolve(false);
        }
      }
    });

    rzp.on("payment.failed", res => {
      const d = (res && res.error) || {};
      toast(d.description || "That payment did not go through. Try again.");
    });

    rzp.open();
  });
}
