/* ══════════════════════════════════════════════════════════
   ORDERS

   The screen this dashboard exists for. An order arrives on
   WhatsApp as a message and lands here as a record; this is
   where it is confirmed, given a tracking id, and marked
   delivered — and every one of those changes is written into
   the history by the database, so the customer's own account
   shows the same thing without anyone re-typing it.
   ══════════════════════════════════════════════════════════ */
let ordFilter = "";        // "" = all
let ordQuery  = "";
let ordPage   = 0;
const ORD_PAGE = 30;

const ORDER_SELECT = "select=id,bill_no,name,phone,address,city,pincode,note,subtotal,shipping,"
                   + "total,status,courier,tracking_id,admin_note,created_at,status_at,user_id,lat,lng,payment,discount,coupon_code,"
                   + "order_items(name,qty,price,product_id)";

const oneOrderQuery = id => "orders?" + ORDER_SELECT + "&id=eq." + encodeURIComponent(id) + "&limit=1";

function orderQuery(limit, offset){
  let q = "orders?" + ORDER_SELECT + "&order=created_at.desc&limit=" + limit + "&offset=" + offset;
  if(ordFilter) q += "&status=eq." + encodeURIComponent(ordFilter);
  if(ordQuery){
    const t = ordQuery.replace(/[(),*]/g, " ").trim();
    if(t) q += "&or=(bill_no.ilike.*" + encodeURIComponent(t) + "*,"
             + "name.ilike.*"    + encodeURIComponent(t) + "*,"
             + "phone.ilike.*"   + encodeURIComponent(t) + "*,"
             + "city.ilike.*"    + encodeURIComponent(t) + "*)";
  }
  return q;
}

VIEWS.orders = async function(){
  /* one more than a page, so "is there a next page" needs no count query */
  const rows = await SB.rest(orderQuery(ORD_PAGE + 1, ordPage * ORD_PAGE));
  const more = rows.length > ORD_PAGE;
  const page = rows.slice(0, ORD_PAGE);

  const tabs = [["", "All"]].concat(
    ["placed","confirmed","shipped","delivered","cancelled"].map(s => [s, STATUS[s].label]));

  view().innerHTML = `
    <div class="head">
      <h1>Orders</h1>
      <span class="spacer"></span>
      <div class="search"><input class="inp" id="ordQ" type="search" placeholder="Bill number, name, phone, city"
        value="${esc(ordQuery)}" autocomplete="off"></div>
      <button class="btn btn-ghost btn-sm" id="ordCsv" type="button">Export CSV</button>
    </div>

    <div class="range" style="margin-bottom:14px; width:max-content; max-width:100%; overflow-x:auto">
      ${tabs.map(([v, label]) =>
        `<button type="button" data-status="${v}" aria-pressed="${ordFilter === v}">${label}</button>`).join("")}
    </div>

    <div class="card">
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr><th>Bill</th><th>Customer</th><th>Where</th><th>Items</th>
          <th class="num">Total</th><th>Pay</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>${page.map(o => `
          <tr data-order="${esc(o.id)}">
            <td class="mono nowrap">${esc(o.bill_no)}</td>
            <td class="nowrap"><span class="strong">${esc(o.name)}</span><br>
                <span class="dim mono">${esc(o.phone)}</span></td>
            <td class="dim nowrap">${esc(o.city)}<br><span class="mono">${esc(o.pincode)}</span></td>
            <td class="dim">${(o.order_items || []).length} ${plural((o.order_items||[]).length, "line")}
              · ${(o.order_items || []).reduce((s, i) => s + i.qty, 0)} pcs</td>
            <td class="num strong">${inr(o.total)}</td>
            <td>${o.payment === "upi"
                 ? (o.paid_at ? `<span class="chip ok">UPI paid</span>`
                              : `<span class="chip no">UPI due</span>`)
                 : `<span class="chip">COD</span>`}</td>
            <td>${statusChipHTML(o.status)}${o.tracking_id
                 ? `<br><span class="dim mono" style="font-size:10px">${esc(o.tracking_id)}</span>` : ""}</td>
            <td class="dim nowrap">${esc(dayTimeText(o.created_at))}</td>
          </tr>`).join("") || `<tr class="flat"><td colspan="8"><p class="empty">
            ${ordQuery || ordFilter ? "Nothing matches that." :
              "No orders yet. One appears here the moment a signed-in customer sends a bill."}
          </p></td></tr>`}
        </tbody></table></div>
    </div>

    <div class="acts" style="justify-content:center; margin-top:16px">
      <button class="btn btn-ghost btn-sm" id="ordPrev" ${ordPage ? "" : "disabled"}>← Newer</button>
      <span class="dim" style="align-self:center; font-size:12px">Page ${ordPage + 1}</span>
      <button class="btn btn-ghost btn-sm" id="ordNext" ${more ? "" : "disabled"}>Older →</button>
    </div>`;

  view().querySelectorAll("[data-order]").forEach(tr => {
    tr.onclick = () => showOrder(tr.dataset.order, page.find(o => o.id === tr.dataset.order));
  });
  view().querySelectorAll("[data-status]").forEach(b => {
    b.onclick = () => { ordFilter = b.dataset.status; ordPage = 0; render(); };
  });
  $("#ordPrev").onclick = () => { if(ordPage){ ordPage--; render(); } };
  $("#ordNext").onclick = () => { if(more){ ordPage++; render(); } };

  let qT;
  $("#ordQ").addEventListener("input", e => {
    clearTimeout(qT);
    const v = e.target.value;
    qT = setTimeout(() => { ordQuery = v.trim(); ordPage = 0; render().then(() => {
      const el = $("#ordQ"); if(el){ el.focus(); el.setSelectionRange(v.length, v.length); }
    }); }, 350);
  });

  $("#ordCsv").onclick = async () => {
    const all = await SB.rest(orderQuery(1000, 0));
    downloadCSV("orders.csv", all.map(o => ({
      bill_no: o.bill_no, placed: o.created_at, status: o.status,
      name: o.name, phone: o.phone, address: o.address, city: o.city, pincode: o.pincode,
      items: (o.order_items || []).map(i => i.name + " x" + i.qty).join(" | "),
      payment: o.payment, paid_at: o.paid_at || "",
      subtotal: o.subtotal, discount: o.discount || 0, coupon: o.coupon_code || "",
      shipping: o.shipping, total: o.total,
      courier: o.courier || "", tracking_id: o.tracking_id || "", note: o.note || ""
    })));
  };
};

/* ── one order ── */
async function showOrder(id, known){
  openPanel("Order", `<p class="load">Loading…</p>`);
  let o = known;
  try{
    if(!o) o = (await SB.rest(oneOrderQuery(id)))[0];
    if(!o) return openPanel("Order", `<p class="empty">That order is gone.</p>`);

    const hist = await SB.rest("order_status_log?select=from_status,to_status,note,created_at"
                             + "&order_id=eq." + encodeURIComponent(o.id) + "&order=created_at.asc");
    paintOrder(o, hist);
  }catch(err){
    openPanel("Order", `<p class="empty">${esc(err.message)}</p>`);
  }
}

function paintOrder(o, hist){
  const items = o.order_items || [];
  const next = {placed:"confirmed", confirmed:"shipped", shipped:"delivered"}[o.status];
  const msg = `Namaste ${o.name.split(" ")[0]}, about your Ray Art Gallery order ${o.bill_no}`
            + (o.tracking_id ? ` — it is on its way, tracking ${o.tracking_id}.` : ".");

  openPanel(o.bill_no, `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
      ${statusChipHTML(o.status)}
      <span class="dim" style="font-size:12px">${esc(dayTimeText(o.created_at))}</span>
      <span class="spacer"></span>
      <span class="strong" style="font-family:var(--display); font-size:21px">${inr(o.total)}</span>
    </div>

    <div class="k">Send to</div>
    <div class="rows">
      <div class="row"><span>Name</span><span class="strong">${esc(o.name)}</span></div>
      <div class="row"><span>Phone</span><span class="mono">${esc(o.phone)}</span></div>
      <div class="row"><span>Address</span><span>${esc(o.address)}</span></div>
      <div class="row"><span>City</span><span>${esc(o.city)} — ${esc(o.pincode)}</span></div>
      ${o.note ? `<div class="row"><span>Their note</span><span>${esc(o.note)}</span></div>` : ""}
    </div>
    <div class="acts">
      <a class="btn btn-sm" href="${esc(waLink(o.phone, msg))}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn btn-ghost btn-sm" href="tel:+91${esc(o.phone)}">Call</a>
      <button class="btn btn-ghost btn-sm" id="copyAddr" type="button">Copy address</button>
    </div>
    <div class="acts">
      ${o.lat != null && o.lng != null ? `
        <a class="btn btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}">📍 Exact pin</a>
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/dir/?api=1&destination=${o.lat}%2C${o.lng}">Directions</a>`
      : `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${
             encodeURIComponent([o.address, o.city, o.pincode].filter(Boolean).join(", "))}">Find on the map</a>
         <span class="dim" style="align-self:center; font-size:11.5px">no exact pin — searched by address</span>`}
    </div>

    <div class="k">What they ordered</div>
    ${items.map(i => `<div class="line"><span>${esc(i.name)} × ${i.qty}</span>
       <span>${inr(i.price * i.qty)}</span></div>`).join("")}
    <div class="line"><span class="dim">Subtotal</span><span>${inr(o.subtotal)}</span></div>
    ${o.discount ? `<div class="line"><span class="dim">Discount${
      o.coupon_code ? " (" + esc(o.coupon_code) + ")" : ""}</span><span>− ${inr(o.discount)}</span></div>` : ""}
    <div class="line"><span class="dim">Delivery</span><span>${o.shipping ? inr(o.shipping) : "Free"}</span></div>
    <div class="line tot"><span>Total</span><span>${inr(o.total)}</span></div>
    <div class="line"><span class="dim">Paying by</span><span class="strong">${
      o.payment === "upi"
        ? (o.paid_at
            ? `UPI — paid ${esc(agoText(o.paid_at))}`
            : "UPI — not received yet")
        : "Cash on delivery — collect " + inr(o.total)}</span></div>
    ${o.payment === "upi" ? `<div class="acts">
      <button class="btn btn-sm${o.paid_at ? " btn-ghost" : ""}" data-paid="${o.paid_at ? "0" : "1"}">${
        o.paid_at ? "Mark as not paid" : "Mark the money received"}</button>
      ${!o.paid_at ? `<span class="dim" style="align-self:center; font-size:11.5px">
        Check your UPI app first — nothing here can tell you it arrived.</span>` : ""}
    </div>` : ""}

    <div class="k">Move it along</div>
    <div class="acts">
      ${next ? `<button class="btn btn-sm" data-set="${next}">Mark ${STATUS[next].label.toLowerCase()}</button>` : ""}
      ${o.status !== "cancelled" && o.status !== "delivered"
        ? `<button class="btn btn-ghost btn-sm" data-set="cancelled">Cancel order</button>` : ""}
      ${o.status === "cancelled" ? `<button class="btn btn-ghost btn-sm" data-set="placed">Reopen</button>` : ""}
    </div>

    <div class="k">Courier</div>
    <form id="trkForm">
      <div class="fg two">
        <div><label class="lab" for="oCour">Courier</label>
          <input class="inp" id="oCour" value="${esc(o.courier || "")}" placeholder="Delhivery, India Post…"></div>
        <div><label class="lab" for="oTrk">Tracking id</label>
          <input class="inp" id="oTrk" value="${esc(o.tracking_id || "")}" placeholder="Shown in their account"></div>
      </div>
      <div class="fg">
        <div><label class="lab" for="oNote">Your note <span class="dim">(only you see this)</span></label>
          <textarea class="inp" id="oNote" rows="2">${esc(o.admin_note || "")}</textarea></div>
      </div>
      <div class="acts"><button class="btn btn-sm" type="submit">Save</button></div>
    </form>

    <div class="k">History</div>
    <div class="hist">${(hist || []).map(h => `
      <div class="hev"><i></i><div>
        <b>${esc(STATUS[h.to_status] ? STATUS[h.to_status].label : h.to_status)}</b>
        <span>${esc(dayTimeText(h.created_at))}${h.note ? " · " + esc(h.note) : ""}</span>
      </div></div>`).join("") || `<p class="empty">Nothing recorded.</p>`}</div>`);

  $("#panelB").querySelectorAll("[data-set]").forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      try{
        await SB.patch("orders?id=eq." + encodeURIComponent(o.id), {status: b.dataset.set});
        toast("Marked " + (STATUS[b.dataset.set] || {}).label);
        o.status = b.dataset.set;
        await showOrder(o.id);
        render();
      }catch(err){ toast(err.message); b.disabled = false; }
    };
  });

  const paidBtn = $("#panelB").querySelector("[data-paid]");
  if(paidBtn) paidBtn.onclick = async () => {
    paidBtn.disabled = true;
    try{
      const when = paidBtn.dataset.paid === "1" ? new Date().toISOString() : null;
      await SB.patch("orders?id=eq." + encodeURIComponent(o.id), {paid_at: when});
      o.paid_at = when;
      toast(when ? "Marked as paid" : "Marked as not paid");
      await showOrder(o.id);
      render();
    }catch(err){ toast(err.message); paidBtn.disabled = false; }
  };

  const copy = $("#copyAddr");
  if(copy) copy.onclick = async () => {
    const text = `${o.name}\n${o.address}\n${o.city} — ${o.pincode}\n${o.phone}`;
    try{ await navigator.clipboard.writeText(text); toast("Address copied"); }
    catch(e){ toast("Could not copy"); }
  };

  $("#trkForm").addEventListener("submit", async e => {
    e.preventDefault();
    try{
      await SB.patch("orders?id=eq." + encodeURIComponent(o.id), {
        courier:     $("#oCour").value.trim() || null,
        tracking_id: $("#oTrk").value.trim()  || null,
        admin_note:  $("#oNote").value.trim() || null
      });
      toast("Saved — the customer sees the tracking id in their account");
      render();
    }catch(err){ toast(err.message); }
  });
}
