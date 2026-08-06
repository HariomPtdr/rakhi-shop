/* ══════════════════════════════════════════════════════════
   ONE RAKHI, EVERYTHING ABOUT IT

   The table edits a price and a stock count, because those are
   the two that change weekly. Everything else — the name, the
   words under it, the kind, where it sits in the grid, the
   photos — lives here, on the row you tapped.

   With the card drawn beside the form, by the shop's own code
   (shared/03-art.js), updating as it is typed. A description is
   written to be read on a product card, not in a form field,
   and the difference between "two lines" and "five lines on a
   phone" is only visible when you can see the card.

   The form is painted once. Photos and the preview repaint on
   their own afterwards, so adding a photo halfway through
   rewriting the description does not throw the description
   away.
   ══════════════════════════════════════════════════════════ */
const CATS_EDIT   = ["evil-eye","pearl","traditional","kids","lumba","premium"];
const CHARMS_EDIT = ["nazar","moti","rudraksh","om","swastik","ful","star","dil"];

let editing = null;      // the product as the database last confirmed it
let galleryReady = false;  // its photo list has actually come back

/* the panel is on screen and it is this product's */
const productPanelOpen = () => !!(editing && $("#pvPreview"));

async function openProductPanel(id){
  /* opened from an order line as well as from the products table, and that
     screen may never have been visited — so fetch the numbers if they are
     not already here rather than doing nothing */
  if(!prodRows.find(p => p.id === id)){
    openPanel("Loading…", `<p class="load">Loading…</p>`);
    try{
      const d = await SB.rpc("admin_product_stats", {p_days: range});
      prodRows = d.products || [];
    }catch(e){ return openPanel("That rakhi", `<p class="empty">${esc(e.message)}</p>`); }
  }
  const stats = prodRows.find(p => p.id === id);
  if(!stats) return openPanel("That rakhi", `<p class="empty">It is not in the catalogue any more.</p>`);

  editing = Object.assign({}, stats);
  galleryFor = id;
  galleryRows = [];
  galleryReady = false;
  openPanel(stats.name || id, `<p class="load">Loading…</p>`);

  /* admin_product_stats carries the numbers, not the words — descr, art,
     mrp and the ratings come off the row itself */
  try{
    const rows = await SB.rest("products?select=*&id=eq." + encodeURIComponent(id));
    if(rows && rows[0]) editing = Object.assign({}, editing, rows[0]);
  }catch(e){ /* the panel still works on what the table already knows */ }

  paintProductPanel();
  reloadGallery();
}

/* ── the card, as the shop will draw it ──
   Same shape and same words as paintGrid() in the shop, from whatever is
   in the form at this moment rather than from what is saved. */
function previewCard(p){
  const out = p.stock === 0;
  /* until the photo list is back, image_path is the honest answer; after it
     is back, an empty list means the last photo was just removed */
  const cover = galleryReady ? (galleryRows[0] ? galleryRows[0].path : null) : p.image_path;
  const photo = cover ? SB.photoUrl(cover) : null;
  const shot  = photo
    ? `<img src="${esc(photo)}" alt="">`
    : `<img class="art" src="${asSrc(art(p.art || {thread:"#C0272D", bead:"#FDFCF7", charm:"nazar"}, false))}" alt="">`;

  return `<article class="pvw${out ? " pvw-out" : ""}">
    <div class="pvw-top">
      <div class="pvw-shot">${shot}</div>
      <span class="pvw-pill${out ? " out" : photo ? " real" : ""}">${
        out ? "Sold out" : photo ? "Photo" : "Drawing"}</span>
      <span class="pvw-heart" aria-hidden="true">♡</span>
    </div>
    <h3>${esc(p.name || "Untitled")}</h3>
    ${p.rating_count ? `<div class="pvw-r">${starsHtml(Number(p.rating_avg) || 0, 12)}
      <span>${p.rating_count}</span></div>` : ""}
    <p>${esc(p.descr || "No description yet — the card shows this line under the name.")}</p>
    <div class="pvw-b">
      <span class="pvw-p">${inr(p.price || 0)}${
        p.mrp ? ` <s>${inr(p.mrp)}</s>` : ""}</span>
      <span class="pvw-u">${out ? "sold out" : "per piece"}</span>
    </div>
    <div class="pvw-acts">
      <span class="pvw-btn dark">${out ? "Sold out" : "Add"}</span>
      <span class="pvw-btn">View</span>
    </div>
  </article>`;
}

/* what is in the form right now, over what is saved */
function draft(){
  if(!$("#eName")) return editing;
  const num = id => {
    const raw = ($("#" + id).value || "").trim();
    return raw === "" ? null : parseInt(raw, 10);
  };
  return Object.assign({}, editing, {
    name:  $("#eName").value,
    descr: $("#eDesc").value,
    price: num("ePrice") || 0,
    mrp:   num("eMrp"),
    stock: num("eStock"),
    art:   $("#eThread") ? {thread: $("#eThread").value, bead: "#FDFCF7", charm: $("#eCharm").value}
                         : editing.art
  });
}

function paintPreview(){
  const box = $("#pvPreview");
  if(box) box.innerHTML = previewCard(draft());
}

/* ── the photos, repainted on their own ── */
function paintPhotos(loaded){
  if(loaded) galleryReady = true;
  const box = $("#pvGal");
  if(!box) return;
  box.innerHTML = galleryRows.map((r, i) => `
    <div class="gal-row">
      <span class="gal-pic"><img src="${esc(SB.photoUrl(r.path))}" alt=""></span>
      <div class="gal-m">
        ${i === 0 ? `<span class="chip ok">Cover</span>` : `<span class="dim">Photo ${i + 1}</span>`}
      </div>
      <div class="gal-acts">
        <button class="chip" data-up="${i}" type="button" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="chip" data-down="${i}" type="button" ${
          i === galleryRows.length - 1 ? "disabled" : ""}>↓</button>
        <button class="chip no" data-rm="${esc(r.path)}" type="button">Remove</button>
      </div>
    </div>`).join("")
    || `<p class="empty" style="padding:14px 4px">No photos — the shop draws the
        design instead, and labels it "Drawing" so nobody mistakes it for one.</p>`;

  box.querySelectorAll("[data-up]").forEach(b =>
    b.onclick = () => movePhoto(Number(b.dataset.up), -1));
  box.querySelectorAll("[data-down]").forEach(b =>
    b.onclick = () => movePhoto(Number(b.dataset.down), 1));
  box.querySelectorAll("[data-rm]").forEach(b =>
    b.onclick = () => removePhoto(b.dataset.rm));
  paintPreview();
}

function paintProductPanel(){
  const p = editing;
  if(!p) return;
  const cats = CATS_EDIT.includes(p.cat) || !p.cat ? CATS_EDIT : CATS_EDIT.concat([p.cat]);

  openPanel(p.name || p.id, `
    <div class="pgrid">
      <div>
        <div class="k">On the shop</div>
        <div id="pvPreview">${previewCard(p)}</div>
        <p class="pvw-note">This is the card, drawn the way the shop draws it.
          It follows what you type.</p>
      </div>
      <div>
        <div class="k">How it has done${p.units || p.views ? "" : " so far"}</div>
        <div class="rows">
          <div class="row"><span>Seen</span><span class="strong">${p.views} ${
            plural(p.views, "time")}</span></div>
          <div class="row"><span>Hearted</span><span class="strong">${p.wishes}</span></div>
          <div class="row"><span>Sold</span><span class="strong">${p.units} · ${
            inr(p.revenue)}</span></div>
          ${p.cost != null ? `<div class="row"><span>Kept</span><span class="strong">${
            inr((p.price - p.cost) * p.units)} after cost</span></div>` : ""}
          ${p.rating_count ? `<div class="row"><span>Rated</span><span class="strong">${
            Number(p.rating_avg).toFixed(1)} from ${p.rating_count} ${
            plural(p.rating_count, "review")}</span></div>` : ""}
          <div class="row"><span>Link</span><span class="strong mono">#p/${esc(p.id)}</span></div>
        </div>
        <div class="acts">
          <button class="btn btn-ghost btn-sm" type="button" id="eLive">${
            p.active ? "Hide from the shop" : "Put back on the shop"}</button>
          <button class="btn btn-ghost btn-sm" type="button" id="eSold">${
            p.stock === 0 ? "Back in stock" : "Mark sold out"}</button>
        </div>
        ${p.active ? "" : `<p class="pvw-note warn">Hidden — nobody can see this
          on the shop right now.</p>`}
      </div>
    </div>

    <div class="k">What it is</div>
    <form id="pEdit">
      <div class="fg two">
        <div><label class="lab" for="eName">Name</label>
          <input class="inp" id="eName" value="${esc(p.name || "")}" maxlength="80"></div>
        <div><label class="lab" for="eCat">Kind</label>
          <select class="inp" id="eCat">
            ${cats.map(c => `<option value="${esc(c)}"${
              p.cat === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
          </select></div>
      </div>
      <div class="fg">
        <div><label class="lab" for="eDesc">The line under the name
            <span class="dim">— about ten words is what fits</span></label>
          <textarea class="inp" id="eDesc" rows="2" maxlength="300"
            placeholder="Turquoise silk thread, white seed beads, a hand-painted eye."
            >${esc(p.descr || "")}</textarea></div>
      </div>

      <div class="k">Money</div>
      <div class="fg two">
        <div><label class="lab" for="ePrice">Price ₹</label>
          <input class="inp" id="ePrice" inputmode="numeric" value="${p.price}"></div>
        <div><label class="lab" for="eMrp">Struck-out price ₹
            <span class="dim">(optional)</span></label>
          <input class="inp" id="eMrp" inputmode="numeric" value="${p.mrp == null ? "" : p.mrp}"
            placeholder="shown crossed out"></div>
      </div>
      <div class="fg two">
        <div><label class="lab" for="eCost">What it costs you ₹
            <span class="dim">(only you see this)</span></label>
          <input class="inp" id="eCost" inputmode="numeric" value="${p.cost == null ? "" : p.cost}"
            placeholder="for the margin"></div>
        <div><label class="lab" for="eStock">Stock
            <span class="dim">(blank = do not count)</span></label>
          <input class="inp" id="eStock" inputmode="numeric" value="${
            p.stock == null ? "" : p.stock}" placeholder="—"></div>
      </div>

      <div class="k">Where it sits</div>
      <div class="fg two">
        <div><label class="lab" for="eFeat">Order in the grid
            <span class="dim">(lower comes first)</span></label>
          <input class="inp" id="eFeat" inputmode="numeric" value="${p.feat}"></div>
        <div><label class="lab" for="eBest">Badge</label>
          <select class="inp" id="eBest">
            <option value=""${p.best ? "" : " selected"}>none</option>
            <option value="1"${p.best ? " selected" : ""}>best value</option>
          </select></div>
      </div>

      <div class="k">The drawing</div>
      <p class="pvw-note">Used until there is a photo — and again if every photo
        is removed.</p>
      <div class="fg two">
        <div><label class="lab" for="eThread">Thread colour</label>
          <input class="inp" id="eThread" type="color"
            value="${esc((p.art && p.art.thread) || "#C0272D")}"></div>
        <div><label class="lab" for="eCharm">Centre piece</label>
          <select class="inp" id="eCharm">
            ${CHARMS_EDIT.map(c => `<option value="${c}"${
              (p.art && p.art.charm) === c ? " selected" : ""}>${c}</option>`).join("")}
          </select></div>
      </div>

      <div class="acts">
        <button class="btn" type="submit" id="eSave">Save</button>
        <button class="btn btn-ghost" type="button" id="eCancel">Close</button>
      </div>
    </form>

    <div class="k">Photos</div>
    <p class="pvw-note">The first one is the cover — it is what the card, the
      cart and this dashboard show. Use the arrows; moving one to the front
      makes it the cover.</p>
    <div class="gal" id="pvGal"><p class="load">Loading…</p></div>
    <div class="acts">
      <button class="btn btn-ghost btn-sm" id="galAdd" type="button">Add photos</button>
      <a class="btn btn-ghost btn-sm" id="eOpen" target="_blank" rel="noopener"
         href="../#p/${encodeURIComponent(p.id)}">Open it on the shop →</a>
    </div>
    <p class="empty" style="text-align:left">Keep each photo around 60–90 KB or the
      shop is slow on mobile data — anything over 3 MB is refused.</p>`);

  ["eName","eDesc","ePrice","eMrp","eStock","eThread","eCharm"].forEach(id => {
    const el = $("#" + id);
    if(el){ el.addEventListener("input", paintPreview); el.addEventListener("change", paintPreview); }
  });

  $("#pEdit").addEventListener("submit", e => { e.preventDefault(); saveProduct(); });
  $("#eCancel").onclick = closePanel;
  $("#eLive").onclick = async () => { await toggleLive(editing.id); syncPanel(); };
  $("#eSold").onclick = async () => { await toggleSoldOut(editing.id); syncPanel(); };
  $("#galAdd").onclick = addPhotos;
  if(galleryReady) paintPhotos();   /* else the list says Loading… until it is */
}

/* one of the quick buttons changed the row under us — take the new values
   without throwing away anything half-typed */
function syncPanel(){
  const fresh = prodRows.find(x => x.id === (editing && editing.id));
  if(!fresh) return;
  editing = Object.assign({}, editing, fresh);
  if($("#eStock")) $("#eStock").value = editing.stock == null ? "" : editing.stock;
  if($("#eLive"))  $("#eLive").textContent = editing.active ? "Hide from the shop" : "Put back on the shop";
  if($("#eSold"))  $("#eSold").textContent = editing.stock === 0 ? "Back in stock" : "Mark sold out";
  paintPreview();
}

async function saveProduct(){
  const p = editing;
  const num = id => {
    const raw = ($("#" + id).value || "").trim();
    return raw === "" ? null : parseInt(raw, 10);
  };
  const body = {
    name:  $("#eName").value.trim(),
    cat:   $("#eCat").value || null,
    descr: $("#eDesc").value.trim() || null,
    price: num("ePrice"),
    mrp:   num("eMrp"),
    cost:  num("eCost"),
    stock: num("eStock"),
    feat:  num("eFeat") == null ? 999 : num("eFeat"),
    best:  $("#eBest").value === "1",
    art:   {thread: $("#eThread").value, bead: "#FDFCF7", charm: $("#eCharm").value}
  };

  if(body.name.length < 2) return toast("Give it a name.");
  if(body.price == null || !Number.isFinite(body.price) || body.price < 0)
    return toast("A price has to be a number.");
  /* the database refuses mrp < price, and a refusal here says why */
  if(body.mrp != null && body.mrp < body.price)
    return toast("The struck-out price has to be higher than the price — or leave it blank.");
  if(body.stock != null && (!Number.isFinite(body.stock) || body.stock < 0))
    return toast("Stock has to be a whole number, or blank.");
  if(body.cost != null && (!Number.isFinite(body.cost) || body.cost < 0))
    return toast("The cost has to be a number, or blank.");

  const btn = $("#eSave");
  btn.disabled = true;
  try{
    await SB.patch("products?id=eq." + encodeURIComponent(p.id), body);
    editing = Object.assign({}, editing, body);
    const row = prodRows.find(x => x.id === p.id);
    if(row) Object.assign(row, body);
    $("#panelT").textContent = body.name;
    paintProducts();
    paintPreview();
    toast("Saved — this is what the shop shows now");
  }catch(err){
    toast(/mrp/i.test(err.message)
      ? "The struck-out price has to be higher than the price."
      : err.message);
  }finally{ btn.disabled = false; }
}
