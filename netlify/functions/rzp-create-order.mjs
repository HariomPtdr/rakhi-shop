/* ══════════════════════════════════════════════════════════
   CREATE A RAZORPAY ORDER

   The one thing this exists for: the amount is read from our
   own database, not taken from whoever called. A browser can
   ask to pay for order X; it cannot say what X costs.

   It also proves the caller owns the order, by asking Supabase
   with the caller's own token — the same row-level rules the
   shop runs under. Nobody can start a payment against someone
   else's bill.

   Node 18 on Netlify has fetch and node:crypto built in, so
   there is no SDK and no node_modules — the same bargain the
   rest of this project makes.
   ══════════════════════════════════════════════════════════ */

const json = (status, body) => ({
  statusCode: status,
  headers: {"content-type": "application/json", "cache-control": "no-store"},
  body: JSON.stringify(body)
});

export async function handler(event){
  if(event.httpMethod !== "POST") return json(405, {error: "POST only"});

  const KEY_ID     = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  const SB_URL     = process.env.SUPABASE_URL;
  const SB_ANON    = process.env.SUPABASE_ANON_KEY;
  if(!KEY_ID || !KEY_SECRET) return json(500, {error: "Payments are not configured yet."});
  if(!SB_URL || !SB_ANON)    return json(500, {error: "The database is not configured here."});

  /* the customer's own Supabase token, passed straight through */
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if(!auth.startsWith("Bearer ")) return json(401, {error: "Sign in first."});

  let body;
  try{ body = JSON.parse(event.body || "{}"); }
  catch(e){ return json(400, {error: "Bad request."}); }
  const orderId = String(body.order_id || "").trim();
  if(!orderId) return json(400, {error: "Which order?"});

  /* ── whose order is it, and what does it actually cost? ──
     Asked as the customer, so row-level security answers the first
     question for us: a row they may not read simply is not there. */
  const q = SB_URL + "/rest/v1/orders?select=id,bill_no,total,status,payment,paid_at,"
          + "name,phone,rzp_order_id&id=eq." + encodeURIComponent(orderId) + "&limit=1";
  const res = await fetch(q, {headers: {apikey: SB_ANON, Authorization: auth}});
  if(!res.ok) return json(502, {error: "Could not read that order."});
  const rows = await res.json();
  const order = Array.isArray(rows) && rows[0];
  if(!order) return json(404, {error: "That order is not yours, or is gone."});

  if(order.paid_at)              return json(409, {error: "That one is already paid."});
  if(order.status !== "placed")  return json(409, {error: "That order is not waiting for payment."});
  if(order.payment !== "upi")    return json(409, {error: "That order is cash on delivery."});

  const paise = Math.round(Number(order.total) * 100);
  if(!Number.isFinite(paise) || paise < 100) return json(400, {error: "That amount is too small to charge."});

  /* Already started once — the same Razorpay order is reused rather than
     making a second one, so an abandoned sheet does not leave a trail of
     half-open payments against one bill. */
  if(order.rzp_order_id){
    return json(200, {
      key_id: KEY_ID, order_id: order.rzp_order_id, amount: paise,
      currency: "INR", bill_no: order.bill_no,
      name: order.name, phone: order.phone
    });
  }

  const auth64 = Buffer.from(KEY_ID + ":" + KEY_SECRET).toString("base64");
  const made = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {"content-type": "application/json", Authorization: "Basic " + auth64},
    body: JSON.stringify({
      amount: paise,
      currency: "INR",
      receipt: order.bill_no,
      notes: {bill_no: order.bill_no, order_id: order.id}
    })
  });
  const rzp = await made.json().catch(() => ({}));
  if(!made.ok || !rzp.id){
    console.error("razorpay order failed", made.status, rzp);
    return json(made.status === 401 ? 401 : 502,
      {error: made.status === 401 ? "Payment keys are not right." : "Could not start the payment."});
  }

  /* remembered against our own order, with the service key, because a
     customer may not write to their order — and the verify step finds our
     order by this id */
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(SERVICE){
    await fetch(SB_URL + "/rest/v1/orders?id=eq." + encodeURIComponent(order.id), {
      method: "PATCH",
      headers: {apikey: SERVICE, Authorization: "Bearer " + SERVICE,
                "content-type": "application/json", Prefer: "return=minimal"},
      body: JSON.stringify({rzp_order_id: rzp.id})
    }).catch(e => console.error("could not store rzp_order_id", e));
  }

  return json(200, {
    key_id: KEY_ID, order_id: rzp.id, amount: paise, currency: "INR",
    bill_no: order.bill_no, name: order.name, phone: order.phone
  });
}
