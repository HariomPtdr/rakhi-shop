/* ══════════════════════════════════════════════════════════
   MOVING THE PHOTOS TO S3, ONCE

   Every photo uploaded before the shop moved to S3 is still in
   Supabase Storage. The database does not care — it stores a
   bare file name, never an address — so the only thing needed
   is for the same names to exist in the S3 bucket too.

   That is all this does: read the list of names out of the
   database, fetch each one from Supabase, and put it in S3
   under exactly the same name. Nothing is deleted, nothing in
   the database is touched, and Supabase keeps its copy — so if
   anything goes wrong, unsetting CDN_URL puts everything back.

   Done in batches with a cursor rather than all at once. A
   Lambda has fifteen seconds; a few hundred photos do not fit
   in that, and a job that dies halfway through leaving no
   record of where it got to is worse than one that has to be
   called six times.

   Copying is a write, so it asks the same is_admin() that
   every other write asks.
   ══════════════════════════════════════════════════════════ */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const json = (status, body) => ({
  statusCode: status,
  headers: {"content-type": "application/json"},
  body: JSON.stringify(body)
});

/* small enough that a slow batch still finishes inside the timeout,
   big enough that a few hundred photos is a handful of calls */
const BATCH = 15;
const MAX_BYTES = 8 * 1024 * 1024;

const TYPE_BY_EXT = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", gif: "image/gif"
};

let s3 = null;

export async function handler(event){
  if(event.httpMethod !== "POST") return json(405, {error: "POST only"});

  const SB_URL  = process.env.SUPABASE_URL;
  const SB_ANON = process.env.SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BUCKET  = process.env.S3_BUCKET;
  const REGION  = process.env.S3_REGION || process.env.AWS_REGION;
  const SB_BUCKET = process.env.SUPABASE_BUCKET || "product-images";
  if(!SB_URL || !SB_ANON || !SERVICE) return json(500, {error: "The database is not configured here."});
  if(!BUCKET)                          return json(500, {error: "No image bucket is configured here."});

  const auth = event.headers.authorization || event.headers.Authorization || "";
  if(!auth.startsWith("Bearer ")) return json(401, {error: "Sign in first."});

  let admin = false;
  try{
    const res = await fetch(SB_URL + "/rest/v1/rpc/is_admin", {
      method: "POST",
      headers: {apikey: SB_ANON, Authorization: auth, "content-type": "application/json"},
      body: "{}"
    });
    if(!res.ok) return json(401, {error: "Sign in again."});
    admin = (await res.json()) === true;
  }catch(e){ return json(502, {error: "Could not check who you are."}); }
  if(!admin) return json(403, {error: "Only the shop owner can do this."});

  let body = {};
  try{ body = JSON.parse(event.body || "{}"); }catch(e){}
  const after = String(body.after || "");

  /* ── every photo the shop knows about ──
     Both places a file name can be recorded: the gallery rows, and the
     cover still stored on the product itself. Read with the service key so
     an inactive product's photo is not quietly left behind. */
  const head = {apikey: SERVICE, Authorization: "Bearer " + SERVICE};
  let names = [];
  try{
    const [gal, prod] = await Promise.all([
      fetch(SB_URL + "/rest/v1/product_images?select=path", {headers: head}).then(r => r.json()),
      fetch(SB_URL + "/rest/v1/products?select=image_path", {headers: head}).then(r => r.json())
    ]);
    names = [
      ...(Array.isArray(gal)  ? gal.map(r => r.path)        : []),
      ...(Array.isArray(prod) ? prod.map(r => r.image_path) : [])
    ].filter(Boolean);
  }catch(e){
    return json(502, {error: "Could not read the photo list."});
  }

  /* sorted and de-duplicated, so the cursor means the same thing on every
     call and a photo used as both cover and gallery row is copied once */
  const all = [...new Set(names)].sort();
  const queue = after ? all.filter(n => n > after) : all;
  const batch = queue.slice(0, BATCH);

  if(!s3) s3 = new S3Client(REGION ? {region: REGION} : {});

  const copied = [], failed = [];
  for(const name of batch){
    try{
      const url = SB_URL + "/storage/v1/object/public/"
                + encodeURIComponent(SB_BUCKET) + "/"
                + String(name).split("/").map(encodeURIComponent).join("/");
      const res = await fetch(url);
      if(!res.ok){ failed.push({name, why: "not in Supabase (" + res.status + ")"}); continue; }

      const buf = Buffer.from(await res.arrayBuffer());
      if(!buf.length){ failed.push({name, why: "empty"}); continue; }
      if(buf.length > MAX_BYTES){ failed.push({name, why: "too big to copy"}); continue; }

      /* Supabase knows what it stored; the extension is the fallback for
         anything written before the type was recorded properly */
      const ext  = (name.split(".").pop() || "").toLowerCase();
      const type = res.headers.get("content-type") || TYPE_BY_EXT[ext] || "application/octet-stream";

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: name, Body: buf, ContentType: type,
        CacheControl: "public, max-age=31536000, immutable"
      }));
      copied.push(name);
    }catch(err){
      console.error("copy failed", name, err && err.message);
      failed.push({name, why: (err && err.message) || "copy failed"});
    }
  }

  const last = batch.length ? batch[batch.length - 1] : after;
  return json(200, {
    total:   all.length,
    copied:  copied.length,
    failed,
    done:    queue.length <= BATCH,
    next:    last,
    /* so the dashboard can show "40 of 260" rather than a spinner */
    remaining: Math.max(0, queue.length - batch.length)
  });
}
