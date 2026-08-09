/* ══════════════════════════════════════════════════════════
   ONE LAMBDA, THREE DOORS

   Razorpay needs a server for exactly three things: making an
   order with the real amount, checking the signature when the
   customer comes back, and listening for the webhook that says
   the money arrived even if the customer's phone did not.

   All three want the same secrets and the same database, so
   they are one function with one URL rather than three of each.

   The handlers themselves are not rewritten here. They are the
   files that were tested against Netlify, copied in unchanged by
   aws/package.sh — this is only the doorway that turns a Lambda
   Function URL request into what they already expect.

   Function URLs speak payload format 2.0: the method lives in
   requestContext.http.method rather than httpMethod, and the
   response shape {statusCode, headers, body} is the same one
   the handlers already return, so it passes straight back.
   ══════════════════════════════════════════════════════════ */
import { handler as createOrder } from "./handlers/rzp-create-order.mjs";
import { handler as verify }      from "./handlers/rzp-verify.mjs";
import { handler as webhook }     from "./handlers/rzp-webhook.mjs";
import { handler as uploadImage } from "./handlers/upload-image.mjs";

const ROUTES = {
  "rzp-create-order": createOrder,
  "rzp-verify":       verify,
  "rzp-webhook":      webhook,
  "upload-image":     uploadImage
};

const no = (status, why) => ({
  statusCode: status,
  headers: {"content-type": "application/json"},
  body: JSON.stringify({error: why})
});

export async function handler(event){
  /* The last segment names the door. Written this way so the same
     function answers whether it is reached at /api/rzp-verify through
     the Amplify rewrite or at /rzp-verify directly — Razorpay's webhook
     is pointed straight at the Function URL, on purpose. */
  const path = String(event.rawPath || event.path || "");
  const name = path.split("/").filter(Boolean).pop() || "";
  const route = ROUTES[name];
  if(!route) return no(404, "no such endpoint");

  const method = (event.requestContext && event.requestContext.http
                  && event.requestContext.http.method)
              || event.httpMethod || "GET";

  /* The body is handed over exactly as it arrived, base64 flag and all.
     The webhook's signature is an HMAC over the raw bytes, so anything
     that decodes, re-encodes or reorders it here would break a check
     that is the only thing standing between us and a forged payment. */
  const res = await route({
    httpMethod: method,
    headers: event.headers || {},
    body: event.body || "",
    isBase64Encoded: !!event.isBase64Encoded
  });

  return res;
}
