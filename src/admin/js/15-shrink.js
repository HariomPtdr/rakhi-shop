/* ══════════════════════════════════════════════════════════
   PHOTOS THE SIZE A PHONE CAN AFFORD

   A photo straight off a phone camera is three to eight
   megabytes. One of them was sitting in the bucket at 2.7 MB,
   and every customer opening that rakhi on mobile data was
   paying for all of it — for a picture displayed at about 500
   pixels wide.

   So nothing is uploaded at full size any more. The browser
   redraws it onto a canvas at most 1400px on its long edge and
   encodes it as JPEG, which is the whole job: no service, no
   key, no waiting. A 2.7 MB photo comes out around 150 KB and
   looks identical at the size it is shown.

   Transparency is the one thing this would ruin, so a PNG that
   actually uses it is left alone.

   The same routine is offered for photos already in the bucket
   — "Shrink" on a heavy one fetches it, redraws it, and puts it
   back under the same name.
   ══════════════════════════════════════════════════════════ */
const SHRINK = {
  max: 1400,        // longest edge, in pixels
  quality: 0.82,    // JPEG quality — indistinguishable at this size
  floor: 260 * 1024 // below this, leave it alone; it is already small
};

/* is this PNG actually using its transparency, or is it just a photo
   somebody saved as a PNG? Only the second kind is safe to re-encode. */
function hasAlpha(canvas){
  const c = canvas.getContext("2d", {willReadFrequently: true});
  const w = canvas.width, h = canvas.height;
  /* a grid of samples rather than every pixel — enough to catch a cut-out */
  for(let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))){
    const row = c.getImageData(0, y, w, 1).data;
    for(let x = 3; x < row.length; x += 4 * Math.max(1, Math.floor(w / 40))){
      if(row[x] < 250) return true;
    }
  }
  return false;
}

function loadBitmap(blob){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("that file is not an image")); };
    img.src = url;
  });
}

/* returns a Blob — the original if there is nothing to gain */
async function shrinkImage(blob, name){
  let img;
  try{ img = await loadBitmap(blob); }
  catch(e){ return blob; }

  /* Decided on both, not on weight alone. A 3000x4000 photograph of a plain
     wall can compress to under 200KB, and leaving it at 3000 wide means every
     phone that opens the shop decodes twelve million pixels to show five
     hundred of them across — which is memory and time, not bytes. */
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if(long <= SHRINK.max && blob.size <= SHRINK.floor) return blob;

  const scale = Math.min(1, SHRINK.max / long);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  /* a cut-out has to stay a cut-out */
  if(/png/i.test(blob.type) && hasAlpha(canvas)) return blob;

  /* Encoded more than once if it has to be. A picture of hard-edged colour —
     a screenshot, a poster, a collage — can come out of JPEG larger than the
     PNG it started as, and the first version of this handed such a file back
     untouched at its full 3000px. Two lower qualities are tried before
     giving up.

     WebP is tried before JPEG because it is about a third smaller for the
     same picture at the same quality, and every browser that can open this
     shop can display it. */
  let best = null;
  for(const type of ["image/webp", "image/jpeg"]){
    for(const q of [SHRINK.quality, 0.7, 0.6]){
      const out = await encodeAs(canvas, type, q);
      if(!out) break;                       // this browser cannot write that type
      if(!best || out.size < best.size) best = out;
      if(out.size < blob.size) return out;  // the best quality that still saves
    }
  }

  /* Nothing beat the original on weight. If the original is also far bigger
     than it needs to be on screen, the resized copy still wins: twelve
     million pixels decoded on a phone to show five hundred across costs
     memory and time whatever the file weighs. */
  if(best && long > SHRINK.max * 2) return best;
  return blob;
}

/* A browser that cannot encode the type it was asked for does not refuse —
   it quietly hands back a PNG, which for a photograph is bigger than what
   went in. So the type that comes out is checked rather than trusted. */
async function encodeAs(canvas, type, q){
  const out = await new Promise(res => canvas.toBlob(res, type, q));
  return out && out.type === type ? out : null;
}

const kb = n => n >= 1024 * 1024
  ? (n / 1024 / 1024).toFixed(1) + " MB"
  : Math.round(n / 1024) + " KB";

/* ── a photo already in the bucket ──
   Fetched from the public URL, redrawn, and written back over the same
   name. The path in the database never changes, so nothing else has to
   know this happened — but the file name is what browsers cache, so a
   shrunk photo may take a few minutes to look different on a page that
   has already seen it. */
async function shrinkStored(path){
  toast("Fetching…");
  try{
    const res = await fetch(SB.photoUrl(path) + "?t=" + Date.now(), {cache: "no-store"});
    if(!res.ok) throw new Error("could not fetch that photo");
    const blob = await res.blob();
    const before = blob.size;

    toast("Shrinking…");
    const small = await shrinkImage(blob, path);
    if(small.size >= before){
      return toast("Already as small as it usefully gets (" + kb(before) + ")");
    }

    toast("Uploading…");
    /* written back under the name already in the database, so the type has
       to travel as a header — the extension on the path may now be a lie */
    await SB.upload(path, new File([small], path, {type: small.type}),
                    {contentType: small.type});
    toast(kb(before) + " → " + kb(small.size) + " — customers load it "
        + Math.round(before / small.size) + "× faster");
    if(typeof paintPhotos === "function") paintPhotos();
    return {before: before, after: small.size};
  }catch(err){
    toast(err.message || "Could not shrink that one.");
  }
}

/* ── every heavy photo in one go ──
   One at a time rather than all at once, for the same reason uploads are:
   a phone on 4G given six of these finishes none of them. */
async function shrinkAllStored(paths){
  let done = 0, before = 0, after = 0;
  for(const path of paths){
    let n = 0;
    try{
      const res = await fetch(SB.photoUrl(path), {method: "HEAD", cache: "no-store"});
      n = Number(res.headers.get("content-length") || 0);
    }catch(e){}
    if(n <= SHRINK.floor) continue;          // already the size it should be
    const r = await shrinkStored(path);
    if(r && r.after){ done++; before += r.before; after += r.after; }
  }
  toast(done
    ? done + " " + plural(done, "photo") + " redrawn — " + kb(before) + " → " + kb(after)
    : "Every photo is already as small as it usefully gets");
  return done;
}
