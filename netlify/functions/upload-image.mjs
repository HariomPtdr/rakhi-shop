/* ══════════════════════════════════════════════════════════
   PUTTING A PHOTO IN THE BUCKET

   While the photos lived in Supabase Storage, the database
   itself decided who could add one: a row level security
   policy said `bucket_id = 'product-images' and is_admin()`,
   and the browser could hold nothing that got around it.

   S3 has no idea who a Supabase user is. So this function
   becomes that boundary, and it has to be exactly as strict —
   an upload endpoint that forgets to ask who is calling is an
   invitation to fill someone else's bucket.

   It asks the same question the old policy asked, by calling
   the very same is_admin() as the caller. Not a second
   definition of "the seller" that could drift from the first:
   the one every other policy already uses.

   The file goes up through here rather than by a presigned URL
   on purpose. Presigning means signing an S3 request by hand,
   and a subtle mistake there fails as "SignatureDoesNotMatch"
   with nothing to debug. The photos are redrawn to about
   120 KB before they are sent, which is nowhere near any limit
   worth avoiding.
   ══════════════════════════════════════════════════════════ */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const json = (status, body) => ({
  statusCode: status,
  headers: {"content-type": "application/json"},
  body: JSON.stringify(body)
});

/* Base64 inflates by a third, and Lambda will not accept a request much
   past 6 MB. Refused here with a sentence that says what to do, rather
   than by the platform with a 413 nobody can act on. */
const MAX_BYTES = 4 * 1024 * 1024;

const TYPES = {
  "image/webp": true,
  "image/jpeg": true,
  "image/png":  true
};

/* A key is a file name, not a path. Anything with a slash, a dot-dot or a
   backslash in it is refused outright rather than cleaned up — quietly
   repairing a hostile name is how one ends up writing somewhere else. */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/;

let s3 = null;

export async function handler(event){
  if(event.httpMethod !== "POST") return json(405, {error: "POST only"});

  const SB_URL   = process.env.SUPABASE_URL;
  const SB_ANON  = process.env.SUPABASE_ANON_KEY;
  const BUCKET   = process.env.S3_BUCKET;
  const REGION   = process.env.S3_REGION || process.env.AWS_REGION;
  if(!SB_URL || !SB_ANON) return json(500, {error: "The database is not configured here."});
  if(!BUCKET)             return json(500, {error: "No image bucket is configured here."});

  const auth = event.headers.authorization || event.headers.Authorization || "";
  if(!auth.startsWith("Bearer ")) return json(401, {error: "Sign in first."});

  /* ── the same question the storage policy used to ask ── */
  let admin = false;
  try{
    const res = await fetch(SB_URL + "/rest/v1/rpc/is_admin", {
      method: "POST",
      headers: {apikey: SB_ANON, Authorization: auth, "content-type": "application/json"},
      body: "{}"
    });
    if(!res.ok) return json(401, {error: "Sign in again."});
    admin = (await res.json()) === true;
  }catch(e){
    return json(502, {error: "Could not check who you are."});
  }
  if(!admin) return json(403, {error: "Only the shop owner can add photos."});

  let body;
  try{ body = JSON.parse(event.body || "{}"); }
  catch(e){ return json(400, {error: "Bad request."}); }

  const key  = String(body.path || "").trim();
  const type = String(body.type || "").toLowerCase();
  if(!SAFE_KEY.test(key)) return json(400, {error: "That file name is not allowed."});
  if(!TYPES[type])        return json(400, {error: "Photos only — JPEG, PNG or WebP."});

  let bytes;
  try{ bytes = Buffer.from(String(body.data || ""), "base64"); }
  catch(e){ return json(400, {error: "That file did not arrive properly."}); }
  if(!bytes.length)            return json(400, {error: "That file is empty."});
  if(bytes.length > MAX_BYTES) return json(413, {error: "That photo is too big to send. Shrink it first."});

  /* One client for the life of the container, not one per upload */
  if(!s3) s3 = new S3Client(REGION ? {region: REGION} : {});

  try{
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: type,
      /* Every name carries the moment it was made, so a name is never
         reused for different bytes and the CDN can hold it forever. */
      CacheControl: "public, max-age=31536000, immutable"
    }));
  }catch(err){
    console.error("s3 put failed", err && err.name, err && err.message);
    return json(502, {error: "The photo could not be stored. Try again."});
  }

  return json(200, {ok: true, path: key, bytes: bytes.length});
}
