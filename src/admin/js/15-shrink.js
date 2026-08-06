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
  if(blob.size <= SHRINK.floor && !/\.png$/i.test(name || "")) return blob;

  let img;
  try{ img = await loadBitmap(blob); }
  catch(e){ return blob; }

  const scale = Math.min(1, SHRINK.max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  /* a cut-out has to stay a cut-out */
  if(/png/i.test(blob.type) && hasAlpha(canvas)) return blob;

  const out = await new Promise(res => canvas.toBlob(res, "image/jpeg", SHRINK.quality));
  if(!out || out.size >= blob.size) return blob;      /* no gain, no change */
  return out;
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
    await SB.upload(path, new File([small], path, {type: "image/jpeg"}), {contentType: "image/jpeg"});
    toast(kb(before) + " → " + kb(small.size) + " — customers load it "
        + Math.round(before / small.size) + "× faster");
    if(typeof paintPhotos === "function") paintPhotos();
  }catch(err){
    toast(err.message || "Could not shrink that one.");
  }
}
