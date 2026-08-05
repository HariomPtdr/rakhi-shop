/* ══════════════════════════════════════════════════════════
   CUSTOMERS

   Who has bought, how much, how long ago, and what they have
   been looking at since. Opening one shows everything the shop
   knows about them in one place: their orders, the rakhis they
   have hearted, what is sitting in their basket right now, and
   the last sixty things they did on the site.

   It is all first-party — their own account, their own orders.
   Nothing here came from anywhere but this shop.
   ══════════════════════════════════════════════════════════ */
let cusQuery = "";
let cusSort  = "spend";
let cusPage  = 0;
const CUS_PAGE = 40;

VIEWS.customers = async function(){
  const d = await SB.rpc("admin_customers", {
    p_q: cusQuery || null, p_limit: CUS_PAGE, p_offset: cusPage * CUS_PAGE, p_sort: cusSort
  });
  const rows = d.rows || [];
  const more = (cusPage + 1) * CUS_PAGE < d.total;

  view().innerHTML = `
    <div class="head">
      <h1>Customers</h1>
      <span class="sub">${d.total} with an account</span>
      <span class="spacer"></span>
      <div class="search"><input class="inp" id="cusQ" type="search" placeholder="Name, email, phone, city"
        value="${esc(cusQuery)}" autocomplete="off"></div>
      <button class="btn btn-ghost btn-sm" id="cusCsv" type="button">Export CSV</button>
    </div>

    <div class="card">
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr>
          ${[["name","Customer"],["","Where"],["orders","Orders"],["spend","Spent"],
             ["","Wished"],["","In basket"],["recent","Last order"],["","Last seen"]]
            .map(([k, label]) => `<th${["orders","spend"].includes(k) ? ' class="num"' : ""}>${
              k ? `<button data-sort="${k}" style="all:unset; cursor:pointer">${label}${
                    cusSort === k ? " ↓" : ""}</button>` : label}</th>`).join("")}
        </tr></thead>
        <tbody>${rows.map(c => `
          <tr data-cus="${esc(c.id)}">
            <td class="nowrap">
              <span class="strong">${esc(c.full_name || "—")}</span>
              ${c.role === "admin" ? ` <span class="chip">you</span>` : ""}
              <br><span class="dim" style="font-size:11px">${esc(c.email || "")}</span>
            </td>
            <td class="dim nowrap">${esc(c.city || "—")}${c.phone
              ? `<br><span class="mono">${esc(c.phone)}</span>` : ""}</td>
            <td class="num">${c.orders}</td>
            <td class="num strong">${inr(c.spend)}</td>
            <td class="num dim">${c.wishes || "—"}</td>
            <td class="num dim">${c.basket ? inr(c.basket) : "—"}</td>
            <td class="dim nowrap">${c.last_order ? esc(agoText(c.last_order)) : "never"}</td>
            <td class="dim nowrap">${c.last_seen_at ? esc(agoText(c.last_seen_at)) : "—"}</td>
          </tr>`).join("") || `<tr class="flat"><td colspan="8"><p class="empty">
            ${cusQuery ? "Nobody matches that." : "No accounts yet."}</p></td></tr>`}
        </tbody></table></div>
    </div>

    <div class="acts" style="justify-content:center; margin-top:16px">
      <button class="btn btn-ghost btn-sm" id="cusPrev" ${cusPage ? "" : "disabled"}>← Back</button>
      <span class="dim" style="align-self:center; font-size:12px">Page ${cusPage + 1}</span>
      <button class="btn btn-ghost btn-sm" id="cusNext" ${more ? "" : "disabled"}>More →</button>
    </div>`;

  view().querySelectorAll("[data-cus]").forEach(tr => {
    tr.onclick = () => showCustomer(tr.dataset.cus);
  });
  view().querySelectorAll("[data-sort]").forEach(b => {
    b.onclick = () => { cusSort = b.dataset.sort; cusPage = 0; render(); };
  });
  $("#cusPrev").onclick = () => { if(cusPage){ cusPage--; render(); } };
  $("#cusNext").onclick = () => { if(more){ cusPage++; render(); } };

  let qT;
  $("#cusQ").addEventListener("input", e => {
    clearTimeout(qT);
    const v = e.target.value;
    qT = setTimeout(() => { cusQuery = v.trim(); cusPage = 0; render().then(() => {
      const el = $("#cusQ"); if(el){ el.focus(); el.setSelectionRange(v.length, v.length); }
    }); }, 350);
  });

  $("#cusCsv").onclick = async () => {
    const all = await SB.rpc("admin_customers", {p_q: cusQuery || null, p_limit: 200, p_offset: 0, p_sort: cusSort});
    downloadCSV("customers.csv", (all.rows || []).map(c => ({
      name: c.full_name || "", email: c.email || "", phone: c.phone || "",
      city: c.city || "", pincode: c.pincode || "",
      orders: c.orders, spent: c.spend, wishlist: c.wishes,
      basket_value: c.basket, last_order: c.last_order || "", joined: c.created_at
    })));
  };
};

const ACT_WORDS = {
  view_shop:"opened the shop", view_product:"looked at", add_cart:"added to the basket",
  remove_cart:"took out of the basket", wish_add:"hearted", wish_remove:"un-hearted",
  begin_checkout:"started a bill", place_order:"sent an order", search:"searched",
  whatsapp:"opened WhatsApp"
};

async function showCustomer(id){
  openPanel("Customer", `<p class="load">Loading…</p>`);
  try{
    const d = await SB.rpc("admin_customer", {p_user: id});
    const p = d.profile || {}, t = d.totals || {};
    const first = (p.full_name || "there").split(" ")[0];

    openPanel(p.full_name || p.email || "Customer", `
      <div class="rows">
        <div class="row"><span>Email</span><span>${esc(p.email || "—")}</span></div>
        <div class="row"><span>Phone</span><span class="mono">${esc(p.phone || "—")}</span></div>
        <div class="row"><span>Address</span><span>${esc(p.address || "—")}</span></div>
        <div class="row"><span>City</span><span>${esc(p.city || "—")}${
          p.pincode ? " — " + esc(p.pincode) : ""}</span></div>
        <div class="row"><span>Joined</span><span>${esc(dayText(p.created_at))}</span></div>
        <div class="row"><span>Last seen</span><span>${p.last_seen_at ? esc(agoText(p.last_seen_at)) : "—"}</span></div>
      </div>
      ${p.phone ? `<div class="acts">
        <a class="btn btn-sm" target="_blank" rel="noopener"
           href="${esc(waLink(p.phone, `Namaste ${first}, this is Ray Art Gallery.`))}">WhatsApp</a>
        <a class="btn btn-ghost btn-sm" href="tel:+91${esc(p.phone)}">Call</a></div>` : ""}

      <div class="kpis" style="grid-template-columns:repeat(3,1fr); margin:18px 0 0">
        ${kpi(String(t.orders || 0), "orders")}
        ${kpi(inr(t.spend || 0), "spent")}
        ${kpi(String((d.wishlist || []).length), "hearted")}
      </div>

      <div class="k">Orders</div>
      ${(d.orders || []).map(o => `
        <div class="line" style="align-items:baseline">
          <span><span class="mono">${esc(o.bill_no)}</span>
            <br><span class="dim" style="font-size:11.5px">${esc(dayText(o.created_at))} ·
            ${(o.items || []).map(i => esc(i.name) + " ×" + i.qty).join(", ")}</span></span>
          <span style="text-align:right">${inr(o.total)}<br>${statusChipHTML(o.status)}</span>
        </div>`).join("") || `<p class="empty" style="text-align:left">No orders yet.</p>`}

      <div class="k">Hearted</div>
      ${(d.wishlist || []).map(w => `<div class="line"><span>${esc(w.name)}</span>
        <span class="dim">${inr(w.price)} · ${esc(agoText(w.created_at))}</span></div>`).join("")
        || `<p class="empty" style="text-align:left">Nothing hearted.</p>`}

      <div class="k">In their basket now</div>
      ${(d.basket || []).map(b => `<div class="line"><span>${esc(b.name)} × ${b.qty}</span>
        <span class="dim">${inr(b.price * b.qty)}</span></div>`).join("")
        || `<p class="empty" style="text-align:left">Empty.</p>`}

      <div class="k">What they have been doing</div>
      <div class="hist">${(d.activity || []).slice(0, 30).map(a => `
        <div class="hev"><i></i><div>
          <b>${esc(ACT_WORDS[a.kind] || a.kind)}${a.product_id ? " " + esc(a.product_id) : ""}${
            a.kind === "search" && a.meta && a.meta.q ? ' "' + esc(a.meta.q) + '"' : ""}</b>
          <span>${esc(dayTimeText(a.created_at))}</span>
        </div></div>`).join("") || `<p class="empty" style="text-align:left">
          Nothing recorded yet.</p>`}</div>`);
  }catch(err){
    openPanel("Customer", `<p class="empty">${esc(err.message)}</p>`);
  }
}
