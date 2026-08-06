/* ══════════════════════════════════════════════════════════
   RAZORPAY TELLS US DIRECTLY

   The browser is a bad witness. It can lose signal between
   paying and coming back, the phone can die, the tab can be
   closed by a thumb — and then Razorpay has the money and we
   have an order that still says nobody paid.

   So Razorpay also tells our server, server to server, and
   that message does not depend on anyone's phone surviving.
   Whichever arrives first — the customer's browser or this —
   marks the order paid; the second finds it already done and
   says so quietly.

   The signature here is made with the WEBHOOK secret, which is
   a different string from the key secret and is set when the
   webhook is created in Razorpay's dashboard. It is computed
   over the raw body, so the body must not be parsed, reordered
   or re-encoded before it is checked.
   ══════════════════════════════════════════════════════════ */
import crypto from "node:crypto";

const ok = body => ({
  statusCode: 200,
  headers: {"content-type": "application/json"},
  body: JSON.stringify(body || {ok: true})
});
const no = (status, why) => ({
  statusCode: status,
  headers: {"content-type": "application/json"},
  body: JSON.stringify({error: why})
});

export async function handler(event){
  if(event.httpMethod !== "POST") return no(405, "POST only");

  const SECRET  = process.env.RAZORPAY_WEBHOOK_SECRET;
  const SB_URL  = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!SECRET)            return no(500, "No webhook secret set here.");
  if(!SB_URL || !SERVICE) return no(500, "The database is not configured here.");

  /* the body exactly as it arrived — Netlify base64s it for some content
     types, and hashing the decoded form would never match */
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");

  const sent = event.headers["x-razorpay-signature"]
            || event.headers["X-Razorpay-Signature"] || "";
  const expected = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(String(sent), "utf8");
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)){
    console.error("webhook signature mismatch");
    return no(400, "bad signature");
  }

  let body;
  try{ body = JSON.parse(raw); }
  catch(e){ return no(400, "bad body"); }

  const kind = body.event || "";
  /* order.paid arrives as well on some accounts; either is enough, and the
     second one finds the work already done */
  if(kind !== "payment.captured" && kind !== "order.paid"){
    return ok({ignored: kind});
  }

  const pay = (((body.payload || {}).payment || {}).entity) || {};
  const rzpOrder   = pay.order_id;
  const rzpPayment = pay.id;
  const paise      = Number(pay.amount);
  if(!rzpOrder || !rzpPayment) return ok({ignored: "no payment in payload"});

  const head = {apikey: SERVICE, Authorization: "Bearer " + SERVICE,
                "content-type": "application/json"};

  const res = await fetch(SB_URL + "/rest/v1/orders?select=id,bill_no,total,paid_at"
                        + "&rzp_order_id=eq." + encodeURIComponent(rzpOrder) + "&limit=1",
                        {headers: head});
  const rows = await res.json().catch(() => []);
  const order = Array.isArray(rows) && rows[0];

  /* ── a payment with no order behind it ──
     The customer closed the sheet, the order was taken back out, and the
     payment landed anyway. Rare, and the one case where somebody has paid
     for nothing — so the seller is told rather than it being written to a
     log nobody reads. */
  if(!order){
    console.error("paid with no matching order", rzpOrder, rzpPayment);
    await fetch(SB_URL + "/rest/v1/notifications", {
      method: "POST",
      headers: Object.assign({Prefer: "return=minimal"}, head),
      body: JSON.stringify({
        audience: "seller", user_id: null, kind: "message", order_id: null,
        title: "A payment arrived with no order behind it",
        body: "₹" + Math.round(paise / 100) + " · " + rzpPayment
            + ". Refund it in Razorpay, or find the customer and place the order by hand."
      })
    }).catch(() => {});
    return ok({noted: true});
  }

  if(order.paid_at) return ok({already: true, bill_no: order.bill_no});

  if(Math.round(Number(order.total) * 100) !== paise){
    console.error("webhook amount mismatch", order.bill_no, order.total, paise);
    return ok({mismatch: true});          /* 200: do not make Razorpay retry */
  }

  const patch = await fetch(SB_URL + "/rest/v1/orders?id=eq." + encodeURIComponent(order.id), {
    method: "PATCH",
    headers: Object.assign({Prefer: "return=minimal"}, head),
    body: JSON.stringify({paid_at: new Date().toISOString(), rzp_payment_id: rzpPayment})
  });
  if(!patch.ok){
    const text = await patch.text().catch(() => "");
    console.error("webhook could not mark paid", patch.status, text);
    return no(500, "could not update");   /* 500 so Razorpay tries again */
  }

  return ok({paid: order.bill_no});
}
