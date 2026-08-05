/* ══════════════════════════════════════════════════════════
   PRODUCTS

   The catalogue, with the four numbers that decide what to
   make more of next to each row: looked at, added to a basket,
   hearted, sold. A rakhi hearted forty times and sold twice is
   priced wrong or out of stock — that is not visible in a
   sales report, and it is the whole reason this screen shows
   all four together.

   Price and stock are edited in place. A photo can be dropped
   straight into the storage bucket from here; the shop picks
   it up on its next load, with no rebuild.
   ══════════════════════════════════════════════════════════ */
let prodRows = [];
let prodSort = "revenue";

VIEWS.products = async function(){
  const d = await SB.rpc("admin_product_stats", {p_days: range});
  prodRows = d.products || [];
  paintProducts();
};

function sortProducts(){
  const by = {
    revenue: (a, b) => b.revenue - a.revenue,
    units:   (a, b) => b.units - a.units,
    views:   (a, b) => b.views - a.views,
    wishes:  (a, b) => b.wishes - a.wishes,
    stock:   (a, b) => (a.stock == null ? 1e9 : a.stock) - (b.stock == null ? 1e9 : b.stock),
    name:    (a, b) => a.name.localeCompare(b.name),
    feat:    (a, b) => a.feat - b.feat
  }[prodSort];
  return [...prodRows].sort(by);
}

function paintProducts(){
  const rows = sortProducts();
  const cols = [["feat","Order"],["name","Name"],["views","Seen"],["wishes","Wished"],
                ["units","Sold"],["revenue","Revenue"],["stock","Stock"]];

  view().innerHTML = `
    <div class="head">
      <h1>Products</h1>
      <span class="sub">${rows.length} in the catalogue · numbers from the last ${
        range === 365 ? "year" : range + " days"}</span>
      <span class="spacer"></span>
      ${rangePicker()}
      <button class="btn btn-sm" id="pNew" type="button">Add a rakhi</button>
    </div>

    <div class="card">
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr>
          <th></th>
          ${cols.slice(1).map(([k, label]) =>
            `<th${["views","wishes","units","revenue","stock"].includes(k) ? ' class="num"' : ""}>
               <button class="sortby" data-sort="${k}" style="all:unset; cursor:pointer">${label}${
                 prodSort === k ? " ↓" : ""}</button></th>`).join("")}
          <th class="num">Price</th><th>Live</th>
        </tr></thead>
        <tbody>${rows.map(p => `
          <tr class="flat" data-id="${esc(p.id)}">
            <td>${picHTML(p)}</td>
            <td><div class="prod"><div><b>${esc(p.name)}</b>
              <span>${esc(p.kind === "set" ? "pack" : (p.cat || "—"))} · ${esc(p.id)}</span></div></div></td>
            <td class="num dim">${p.views}</td>
            <td class="num dim">${p.wishes}</td>
            <td class="num strong">${p.units}</td>
            <td class="num">${inr(p.revenue)}</td>
            <td class="num"><input class="inp mini" data-stock="${esc(p.id)}" inputmode="numeric"
                 value="${p.stock == null ? "" : p.stock}" placeholder="—" aria-label="Stock"></td>
            <td class="num"><input class="inp mini" data-price="${esc(p.id)}" inputmode="numeric"
                 value="${p.price}" aria-label="Price"></td>
            <td><div class="rowacts">
              <button class="chip ${p.active ? "ok" : "no"}" data-live="${esc(p.id)}" type="button"
                >${p.active ? "Live" : "Hidden"}</button>
              <button class="chip" data-photo="${esc(p.id)}" type="button"
                >${p.image_path ? "Change photo" : "Add photo"}</button>
              <button class="chip ${p.stock === 0 ? "no" : ""}" data-sold="${esc(p.id)}" type="button"
                >${p.stock === 0 ? "Back in stock" : "Sold out"}</button>
            </div></td>
          </tr>`).join("")}
        </tbody></table></div>
      <p class="empty" style="text-align:left; padding:14px 2px 0">
        Type over a price or a stock count and press Enter. Blank stock means
        "do not count it" — the shop keeps selling it either way.
        Tap a row's picture to change the photo.</p>
    </div>`;

  view().querySelectorAll("[data-sort]").forEach(b => {
    b.onclick = () => { prodSort = b.dataset.sort; paintProducts(); };
  });
  view().querySelectorAll("[data-price], [data-stock]").forEach(inp => {
    inp.addEventListener("keydown", e => { if(e.key === "Enter") inp.blur(); });
    inp.addEventListener("change", () => saveField(inp));
  });
  view().querySelectorAll("[data-live]").forEach(b => {
    b.onclick = () => toggleLive(b.dataset.live);
  });
  view().querySelectorAll("[data-photo]").forEach(b => {
    b.onclick = () => pickPhoto(b.dataset.photo);
  });
  view().querySelectorAll("[data-sold]").forEach(b => {
    b.onclick = () => toggleSoldOut(b.dataset.sold);
  });
  view().querySelectorAll(".pic").forEach(el => {
    const tr = el.closest("tr");
    el.style.cursor = "pointer";
    el.onclick = () => pickPhoto(tr.dataset.id);
  });
  $("#pNew").onclick = newProduct;
}

async function saveField(inp){
  const id    = inp.dataset.price || inp.dataset.stock;
  const field = inp.dataset.price ? "price" : "stock";
  const raw   = inp.value.trim();
  const value = raw === "" ? (field === "stock" ? null : null) : parseInt(raw, 10);

  if(field === "price" && (value == null || !Number.isFinite(value) || value < 0)){
    toast("A price has to be a number"); return paintProducts();
  }
  if(field === "stock" && raw !== "" && (!Number.isFinite(value) || value < 0)){
    toast("Stock has to be a whole number, or blank"); return paintProducts();
  }
  try{
    await SB.patch("products?id=eq." + encodeURIComponent(id), {[field]: value});
    const row = prodRows.find(p => p.id === id);
    if(row) row[field] = value;
    inp.style.boxShadow = "inset 0 0 0 1.5px var(--teal)";
    setTimeout(() => { inp.style.boxShadow = ""; }, 900);
    toast(field === "price" ? "Price updated — live on the shop now" : "Stock updated");
  }catch(err){ toast(err.message); paintProducts(); }
}

async function toggleLive(id){
  const row = prodRows.find(p => p.id === id);
  if(!row) return;
  try{
    await SB.patch("products?id=eq." + encodeURIComponent(id), {active: !row.active});
    row.active = !row.active;
    paintProducts();
    toast(row.active ? "Back on the shop" : "Hidden from the shop");
  }catch(err){ toast(err.message); }
}

/* ── sold out ──
   Stock 0 rather than hiding it: the rakhi stays on the shop, marked sold
   out, so the people who wanted it can still heart it — and the dashboard
   can tell you how many did. Hiding it loses that. "Back in stock" clears
   the count rather than guessing a number, which puts it back to being
   sold without being counted. */
async function toggleSoldOut(id){
  const row = prodRows.find(p => p.id === id);
  if(!row) return;
  const now = row.stock === 0 ? null : 0;
  try{
    await SB.patch("products?id=eq." + encodeURIComponent(id), {stock: now});
    row.stock = now;
    paintProducts();
    toast(now === 0 ? "Marked sold out — the shop shows it as unavailable"
                    : "Back on sale, with stock not counted");
  }catch(err){ toast(err.message); }
}

/* ── the photo ──
   Straight into the bucket, then the file name onto the row. The shop
   reads image_path on its next load, so there is nothing to rebuild. */
function pickPhoto(id){
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if(!file) return;
    if(file.size > 3 * 1024 * 1024){
      return toast("That photo is over 3 MB. Shrink it first — 60–90 KB is plenty.");
    }
    toast("Uploading…");
    const name = id + "-" + Date.now() + "." + (file.name.split(".").pop() || "jpg").toLowerCase();
    try{
      const res = await fetch(SB.url() + "/storage/v1/object/" + SB.bucket() + "/" + encodeURIComponent(name), {
        method: "POST",
        headers: {
          apikey: ENV.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SB.session().access_token,
          "Content-Type": file.type,
          "x-upsert": "true"
        },
        body: file
      });
      if(!res.ok) throw new Error("Upload refused (" + res.status + "). Is this account the seller?");
      await SB.patch("products?id=eq." + encodeURIComponent(id), {image_path: name});
      const row = prodRows.find(p => p.id === id);
      if(row) row.image_path = name;
      paintProducts();
      toast("Photo is live on the shop");
    }catch(err){ toast(err.message); }
  };
  inp.click();
}

/* ── a new design ── */
function newProduct(){
  openPanel("Add a rakhi", `
    <form id="npForm">
      <div class="fg two">
        <div><label class="lab" for="npName">Name</label>
          <input class="inp" id="npName" placeholder="Blue Moti Rakhi" required></div>
        <div><label class="lab" for="npId">Link name</label>
          <input class="inp" id="npId" placeholder="blue-moti" required></div>
      </div>
      <div class="fg two">
        <div><label class="lab" for="npPrice">Price ₹</label>
          <input class="inp" id="npPrice" inputmode="numeric" placeholder="69" required></div>
        <div><label class="lab" for="npStock">Stock <span class="dim">(blank = do not count)</span></label>
          <input class="inp" id="npStock" inputmode="numeric" placeholder=""></div>
      </div>
      <div class="fg two">
        <div><label class="lab" for="npCat">Kind</label>
          <select class="inp" id="npCat">
            ${["evil-eye","pearl","traditional","kids","lumba","premium"].map(c =>
              `<option value="${c}">${c}</option>`).join("")}
          </select></div>
        <div><label class="lab" for="npFeat">Order in the grid</label>
          <input class="inp" id="npFeat" inputmode="numeric" value="${prodRows.length + 1}"></div>
      </div>
      <div class="fg">
        <div><label class="lab" for="npDesc">A line or two about it</label>
          <textarea class="inp" id="npDesc" rows="2"
            placeholder="Turquoise silk thread, white seed beads, a hand-painted eye."></textarea></div>
      </div>
      <div class="fg two">
        <div><label class="lab" for="npThread">Thread colour</label>
          <input class="inp" id="npThread" type="color" value="#C0272D"></div>
        <div><label class="lab" for="npCharm">Centre piece</label>
          <select class="inp" id="npCharm">
            ${["nazar","moti","rudraksh","om","swastik","ful","star","dil"].map(c =>
              `<option value="${c}">${c}</option>`).join("")}
          </select></div>
      </div>
      <p class="empty" style="text-align:left; padding:12px 0 0">
        Until you add a photo the shop draws the design from these two, and
        labels it "Drawing" so nobody mistakes it for a photograph.</p>
      <div class="acts"><button class="btn" type="submit">Add it</button></div>
    </form>`);

  const name = $("#npName"), id = $("#npId");
  name.addEventListener("input", () => {
    if(id.dataset.touched) return;
    id.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  });
  id.addEventListener("input", () => { id.dataset.touched = "1"; });

  $("#npForm").addEventListener("submit", async e => {
    e.preventDefault();
    const row = {
      id:    id.value.trim(),
      kind:  "rakhi",
      name:  name.value.trim(),
      price: parseInt($("#npPrice").value, 10),
      cat:   $("#npCat").value,
      feat:  parseInt($("#npFeat").value, 10) || 999,
      descr: $("#npDesc").value.trim() || null,
      stock: $("#npStock").value.trim() === "" ? null : parseInt($("#npStock").value, 10),
      art:   {thread: $("#npThread").value, bead: "#FDFCF7", charm: $("#npCharm").value},
      active:true
    };
    if(!/^[a-z0-9-]{2,40}$/.test(row.id)) return toast("The link name can only be lowercase letters, digits and dashes.");
    if(row.name.length < 2)               return toast("Give it a name.");
    if(!Number.isFinite(row.price) || row.price < 0) return toast("Give it a price.");
    try{
      await SB.insert("products", row);
      closePanel();
      toast(row.name + " is on the shop");
      render();
    }catch(err){
      toast(/duplicate|unique/i.test(err.message) ? "That link name is already taken." : err.message);
    }
  });
}
