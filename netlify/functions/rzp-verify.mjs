/* ══════════════════════════════════════════════════════════
   VERIFY A PAYMENT, THEN MARK THE ORDER PAID

   Razorpay hands the browser three strings after a successful
   payment. Two of them are ids and one is a signature over the
   other two, made with the key secret. Only something holding
   that secret can produce it — which is the whole point, and
   why this runs here and not in the page.

   Belt and braces: the signature is checked, and then the
   payment is fetched from Razorpay directly and its amount and
   status compared with our own order. A valid signature over a
   ₹1 payment is still not payment for a ₹500 rakhi.

   Only then is paid_at set — and the database trigger written
   in part 16 moves the order to confirmed and tells the
   customer, exactly as it does when the seller marks a UPI
   payment received by hand.
   ══════════════════════════════════════════════════════════ */
import crypto from "node:crypto";

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
  const SERVICE    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!KEY_ID || !KEY_SECRET) return json(500, {error: "Payments are not configured yet."});
  if(!SB_URL || !SERVICE)    return json(500, {error: "The database is not configured here."});

  let b;
  try{ b = JSON.parse(event.body || "{}"); }
  catch(e){ return json(400, {error: "Bad request."}); }

  const rzpOrder   = String(b.razorpay_order_id || "");
  const rzpPayment = String(b.razorpay_payment_id || "");
  const signature  = String(b.razorpay_signature || "");
  if(!rzpOrder || !rzpPayment || !signature) return json(400, {error: "Missing payment details."});

  /* ── the signature ── */
  const expected = crypto.createHmac("sha256", KEY_SECRET)
    .update(rzpOrder + "|" + rzpPayment).digest("hex");

  /* compared in constant time, so the comparison itself gives nothing away */
  const a = Buffer.from(expected, "utf8"), c = Buffer.from(signature, "utf8");
  if(a.length !== c.length || !crypto.timingSafeEqual(a, c)){
    console.error("signature mismatch for", rzpOrder);
    return json(400, {error: "That payment could not be verified."});
  }

  /* ── and what Razorpay itself says about the payment ── */
  const auth64 = Buffer.from(KEY_ID + ":" + KEY_SECRET).toString("base64");
  const pRes = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(rzpPayment),
    {headers: {Authorization: "Basic " + auth64}});
  const pay = await pRes.json().catch(() => ({}));
  if(!pRes.ok || !pay.id) return json(502, {error: "Could not check that payment."});
  if(pay.order_id !== rzpOrder) return json(400, {error: "That payment is for a different order."});
  if(!["captured", "authorized"].includes(pay.status)){
    return json(400, {error: "That payment has not gone through."});
  }

  /* ── our order, found by theirs ── */
  const head = {apikey: SERVICE, Authorization: "Bearer " + SERVICE,
                "content-type": "application/json"};
  const oRes = await fetch(SB_URL + "/rest/v1/orders?select=id,bill_no,total,paid_at"
                         + "&rzp_order_id=eq." + encodeURIComponent(rzpOrder) + "&limit=1",
                         {headers: head});
  const rows = await oRes.json().catch(() => []);
  const order = Array.isArray(rows) && rows[0];
  if(!order) return json(404, {error: "No order matches that payment."});

  if(Math.round(Number(order.total) * 100) !== Number(pay.amount)){
    console.error("amount mismatch", order.bill_no, order.total, pay.amount);
    return json(400, {error: "The amount paid does not match the bill."});
  }

  if(order.paid_at){                       /* already done — say so calmly */
    return json(200, {ok: true, bill_no: order.bill_no, already: true});
  }

  const patch = await fetch(SB_URL + "/rest/v1/orders?id=eq." + encodeURIComponent(order.id), {
    method: "PATCH",
    headers: Object.assign({Prefer: "return=representation"}, head),
    body: JSON.stringify({paid_at: new Date().toISOString(), rzp_payment_id: rzpPayment})
  });
  if(!patch.ok){
    const text = await patch.text().catch(() => "");
    console.error("could not mark paid", patch.status, text);
    return json(500, {error: "Payment taken, but the order did not update. We will fix it — keep this: " + rzpPayment});
  }
  const [updated] = await patch.json().catch(() => [{}]);

  return json(200, {ok: true, bill_no: order.bill_no, status: (updated && updated.status) || "confirmed"});
}
