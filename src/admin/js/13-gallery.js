/* ══════════════════════════════════════════════════════════
   PHOTOS OF ONE RAKHI

   A handmade thing is bought on how it looks, and one photo
   cannot show the thread, the bead and the back of it.

   The first photo is the cover — it is what the card, the cart
   and the dashboard row show. So "make this the cover" is the
   same action as "move this to the front", and the database
   keeps products.image_path in step by itself. There is no
   separate cover field to fall out of agreement with the order.
   ══════════════════════════════════════════════════════════ */
let galleryFor = null, galleryRows = [];

async function managePhotos(id){
  galleryFor = id;
  editing = null;                 /* photos alone, not the whole product panel */
  const p = prodRows.find(x => x.id === id);
  openPanel("Photos — " + ((p && p.name) || id), `<p class="load">Loading…</p>`);
  await reloadGallery();
}

async function reloadGallery(){
  try{
    galleryRows = await SB.rest("product_images?select=id,path,sort&product_id=eq."
                              + encodeURIComponent(galleryFor) + "&order=sort.asc,id.asc") || [];
  }catch(e){ galleryRows = []; }
  paintGallery();
}

function paintGallery(){
  /* the whole product is open, and its photo list is a section inside it —
     repainting the panel from here would throw away everything typed into
     the form beside it */
  if(productPanelOpen()){ paintPhotos(true); return; }

  const p = prodRows.find(x => x.id === galleryFor);

  openPanel("Photos — " + ((p && p.name) || galleryFor), `
    <p class="empty" style="text-align:left; padding:0 0 14px">
      The first photo is what the shop shows on the card. Drag is fiddly on a
      phone, so use the arrows — moving one to the front makes it the cover.</p>

    <div class="gal">
      ${galleryRows.map((r, i) => `
        <div class="gal-row">
          <span class="gal-pic"><img src="${esc(SB.photoUrl(r.path))}" alt=""></span>
          <div class="gal-m">
            ${i === 0 ? `<span class="chip ok">Cover</span>` : `<span class="dim">Photo ${i + 1}</span>`}
            <span class="mono dim" style="display:block; font-size:10.5px; margin-top:3px;
              overflow:hidden; text-overflow:ellipsis">${esc(r.path)}</span>
          </div>
          <div class="gal-acts">
            <button class="chip" data-up="${i}" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="chip" data-down="${i}" type="button" ${
              i === galleryRows.length - 1 ? "disabled" : ""}>↓</button>
            <button class="chip no" data-rm="${esc(r.path)}" type="button">Remove</button>
          </div>
        </div>`).join("") || `<p class="empty">No photos yet — the shop draws the
          design instead and labels it "Drawing".</p>`}
    </div>

    <div class="acts" style="margin-top:16px">
      <button class="btn" id="galAdd" type="button">Add photos</button>
      ${galleryRows.length ? `<span class="dim" style="align-self:center; font-size:12px">
        ${galleryRows.length} ${plural(galleryRows.length, "photo")}</span>` : ""}
    </div>
    <p class="empty" style="text-align:left">
      Several at once is fine. Keep each around 60–90 KB or the shop is slow on
      mobile data — anything over 3 MB is refused.</p>`);

  $("#galAdd").onclick = addPhotos;
  $("#panelB").querySelectorAll("[data-up]").forEach(b => {
    b.onclick = () => movePhoto(Number(b.dataset.up), -1);
  });
  $("#panelB").querySelectorAll("[data-down]").forEach(b => {
    b.onclick = () => movePhoto(Number(b.dataset.down), 1);
  });
  $("#panelB").querySelectorAll("[data-rm]").forEach(b => {
    b.onclick = () => removePhoto(b.dataset.rm);
  });
}

/* ── ordering ──
   Sent as the whole list in one call, so the cover cannot flicker through
   three different photos while several row updates land one by one. */
async function movePhoto(i, dir){
  const j = i + dir;
  if(j < 0 || j >= galleryRows.length) return;
  const next = galleryRows.slice();
  [next[i], next[j]] = [next[j], next[i]];
  galleryRows = next;
  paintGallery();
  try{
    await SB.rpc("set_image_order", {p_product: galleryFor, p_paths: next.map(r => r.path)});
    const p = prodRows.find(x => x.id === galleryFor);
    if(p) p.image_path = next[0] ? next[0].path : null;
    paintProducts();
    if(i === 0 || j === 0) toast("Cover changed — the shop shows this one now");
  }catch(err){ toast(err.message); reloadGallery(); }
}

async function removePhoto(path){
  try{
    await SB.del("product_images?product_id=eq." + encodeURIComponent(galleryFor)
               + "&path=eq." + encodeURIComponent(path));
    await reloadGallery();
    const p = prodRows.find(x => x.id === galleryFor);
    if(p) p.image_path = galleryRows[0] ? galleryRows[0].path : null;
    paintProducts();
    toast(galleryRows.length ? "Removed" : "All photos gone — the drawing comes back");
  }catch(err){ toast(err.message); }
}

/* ── adding ──
   Several at a time, uploaded one after another rather than all at once:
   a phone on 4G handling six parallel uploads finishes none of them. */
function addPhotos(){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp"; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...(inp.files || [])];
    if(!files.length) return;

    const tooBig = files.filter(f => f.size > 3 * 1024 * 1024);
    if(tooBig.length){
      return toast(tooBig.length + " " + plural(tooBig.length, "photo")
                 + " over 3 MB — shrink and try again");
    }

    let n = 0, sort = galleryRows.length;
    for(const file of files){
      toast(`Uploading ${n + 1} of ${files.length}…`);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const name = galleryFor + "-" + Date.now() + "-" + n + "." + ext;
      try{
        await SB.upload(name, file);
        await SB.insert("product_images", {product_id: galleryFor, path: name, sort: sort++});
        n++;
      }catch(err){
        toast(err.message);
        if(err.raw) console.error("Upload failed:", err.status, err.raw);
        break;
      }
    }
    await reloadGallery();
    const p = prodRows.find(x => x.id === galleryFor);
    if(p) p.image_path = galleryRows[0] ? galleryRows[0].path : null;
    paintProducts();
    if(n) toast(n + " " + plural(n, "photo") + " added — live on the shop now");
  };
  inp.click();
}
