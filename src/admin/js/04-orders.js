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

/* Columns that arrive with a later SQL file. Asking for one that is not
   there yet fails the whole select, and an Orders screen that will not load
   is a much worse outcome than not knowing when an address was corrected or
   which Razorpay payment settled a bill. The first refusal names the column;
   it is dropped and the query is asked again. */
const OPTIONAL_COLS = {
  address_at:     true,      /* 14-address.sql   */
  rzp_payment_id: true       /* 18-razorpay.sql  */
};

const ORDER_SELECT = () =>
  "select=id,bill_no,name,phone,address,city,pincode,note,subtotal,shipping,"
  + "total,status,courier,tracking_id,admin_note,created_at,status_at,user_id,lat,lng,"
  + Object.keys(OPTIONAL_COLS).filter(c => OPTIONAL_COLS[c]).map(c => c + ",").join("")
  + "payment,discount,coupon_code,"
  + "order_items(name,qty,price,product_id)";

/* every order query goes through here, so the retry is written once */
async function askOrders(build){
  for(let tries = 0; tries < Object.keys(OPTIONAL_COLS).length + 1; tries++){
    try{
      return await SB.rest(build());
    }catch(err){
      const missing = Object.keys(OPTIONAL_COLS)
        .find(c => OPTIONAL_COLS[c] && new RegExp(c, "i").test(err.message || ""));
      if(!missing) throw err;
      OPTIONAL_COLS[missing] = false;
    }
  }
  return await SB.rest(build());
}

const oneOrderQuery = id => "orders?" + ORDER_SELECT() + "&id=eq." + encodeURIComponent(id) + "&limit=1";

function orderQuery(limit, offset){
  let q = "orders?" + ORDER_SELECT() + "&order=created_at.desc&limit=" + limit + "&offset=" + offset;
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
  const rows = await askOrders(() => orderQuery(ORD_PAGE + 1, ordPage * ORD_PAGE));
  const more = rows.length > ORD_PAGE;
  const page = rows.slice(0, ORD_PAGE);

  const tabs = [["", "All"]].concat(
    ["placed","confirmed","shipped","out_for_delivery","delivered","cancelled"]
      .map(s => [s, STATUS[s].label]));

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
            <td class="dim nowrap">${esc(o.city)}${o.lat != null
                 ? ` <span title="an exact location is attached">📍</span>` : ""}
                <br><span class="mono">${esc(o.pincode)}</span></td>
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
    const all = await askOrders(() => orderQuery(1000, 0));
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
    if(!o) o = (await askOrders(() => oneOrderQuery(id)))[0];
    if(!o) return openPanel("Order", `<p class="empty">That order is gone.</p>`);

    const hist = await SB.rest("order_status_log?select=from_status,to_status,note,created_at"
                             + "&order_id=eq." + encodeURIComponent(o.id) + "&order=created_at.asc");
    /* what has already been said about this order, so nothing gets said twice.
       Empty until 13-messages.sql is run — the policy that lets the seller
       read them comes with it. */
    let msgs = [];
    try{
      msgs = await SB.rest("notifications?select=id,body,created_at,read_at"
                         + "&order_id=eq." + encodeURIComponent(o.id)
                         + "&kind=eq.message&order=created_at.desc") || [];
    }catch(e){}
    paintOrder(o, hist, null, msgs);

    /* The pin is copied onto the order when it is placed, so an order placed
       before they attached their location has none. The account may still
       have one — worth showing, marked as what it is. */
    if(o.lat == null && o.user_id){
      try{
        const p = (await SB.rest("profiles?select=lat,lng,located_at&id=eq."
                               + encodeURIComponent(o.user_id) + "&limit=1"))[0];
        if(p && p.lat != null && p.lng != null) paintOrder(o, hist, p, msgs);
      }catch(e){}
    }
  }catch(err){
    openPanel("Order", `<p class="empty">${esc(err.message)}</p>`);
  }
}

function paintOrder(o, hist, laterPin, msgs){
  const items = o.order_items || [];
  const sent  = msgs || [];
  /* the pin on the order, or the one on their account if the order has none */
  const pin = (o.lat != null && o.lng != null) ? {lat:o.lat, lng:o.lng, own:true}
            : (laterPin ? {lat:laterPin.lat, lng:laterPin.lng, own:false} : null);
  const next = {placed:"confirmed", confirmed:"shipped",
                shipped:"out_for_delivery", out_for_delivery:"delivered"}[o.status];
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
      <div class="row"><span>Address</span><span>${esc(o.address)}${o.address_at
        ? `<br><span class="dim" style="font-size:11.5px">changed by the customer ${
            esc(agoText(o.address_at))} — check the label</span>` : ""}</span></div>
      <div class="row"><span>City</span><span>${esc(o.city)} — ${esc(o.pincode)}</span></div>
      ${o.note ? `<div class="row"><span>Their note</span><span>${esc(o.note)}</span></div>` : ""}
    </div>
    <div class="acts">
      <a class="btn btn-sm" href="${esc(waLink(o.phone, msg))}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn btn-ghost btn-sm" href="tel:+91${esc(o.phone)}">Call</a>
      <button class="btn btn-ghost btn-sm" id="copyAddr" type="button">Copy address</button>
      <button class="btn btn-ghost btn-sm" id="billPdf" type="button">Bill PDF</button>
    </div>
    <div class="acts">
      ${pin ? `
        <a class="btn btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${pin.lat}%2C${pin.lng}">📍 Exact pin</a>
        <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/dir/?api=1&destination=${pin.lat}%2C${pin.lng}">Directions</a>
        ${pin.own ? "" : `<span class="dim" style="align-self:center; font-size:11.5px">
           from their account — attached after this order was placed</span>`}`
      : `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${
             encodeURIComponent([o.address, o.city, o.pincode].filter(Boolean).join(", "))}">Find on the map</a>
         <span class="dim" style="align-self:center; font-size:11.5px">no exact pin — searched by address</span>`}
    </div>

    <div class="k">What they ordered</div>
    <!-- each line opens that rakhi's own page, so "how many of these have I
         sold, and is it still in stock" is one tap from the order that
         raised the question -->
    ${items.map(i => `<div class="line">
       ${i.product_id
         ? `<button class="linkish" type="button" data-prod="${esc(i.product_id)}"
              >${esc(i.name)} × ${i.qty}</button>`
         : `<span>${esc(i.name)} × ${i.qty}</span>`}
       <span>${inr(i.price * i.qty)}</span></div>`).join("")}
    <div class="line"><span class="dim">Subtotal</span><span>${inr(o.subtotal)}</span></div>
    ${o.discount ? `<div class="line"><span class="dim">Discount${
      o.coupon_code ? " (" + esc(o.coupon_code) + ")" : ""}</span><span>− ${inr(o.discount)}</span></div>` : ""}
    <div class="line"><span class="dim">Delivery</span><span>${o.shipping ? inr(o.shipping) : "Free"}</span></div>
    <div class="line tot"><span>Total</span><span>${inr(o.total)}</span></div>
    <div class="line"><span class="dim">Payment</span><span class="strong">${
      o.payment === "upi"
        ? (o.paid_at ? "Paid online · " + esc(agoText(o.paid_at)) : "Not paid yet")
        : "Cash on delivery — collect " + inr(o.total)}</span></div>
    ${o.payment === "upi" && o.paid_at ? `
      <div class="paid">
        <div>
          <b>${inr(o.total)} received</b>
          <span>${esc(dayTimeText(o.paid_at))}</span>
          ${o.rzp_payment_id
            ? `<span class="mono">${esc(o.rzp_payment_id)}</span>` : ""}
        </div>
        ${o.rzp_payment_id ? `
          <div class="paid-acts">
            <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
               href="https://dashboard.razorpay.com/app/payments/${esc(o.rzp_payment_id)}"
              >Open in Razorpay</a>
            <button class="chip" type="button" data-copy="${esc(o.rzp_payment_id)}">Copy id</button>
          </div>` : ""}
      </div>` : ""}
    ${o.payment === "upi" && !o.paid_at ? `<p class="empty" style="text-align:left; padding:8px 0 0">
      This one was never paid for. Nothing here needs doing — a payment that
      does not complete now takes its order back out with it, so this is
      either from before the gateway or a payment still in flight.</p>` : ""}

    <div class="k">Move it along</div>
    <div class="acts">
      ${next && !(o.payment === "upi" && next === "confirmed")
        ? `<button class="btn btn-sm" data-set="${next}">Mark ${STATUS[next].label.toLowerCase()}</button>`
        : ""}
      ${o.payment === "upi" && next === "confirmed"
        ? `<span class="dim" style="align-self:center; font-size:11.5px">
             Confirming is the payment's job now — Razorpay does it.</span>` : ""}
      ${o.status !== "cancelled" && o.status !== "delivered"
        ? `<button class="btn btn-ghost btn-sm" data-set="cancelled">Cancel order</button>` : ""}
      ${o.status === "cancelled" ? `<button class="btn btn-ghost btn-sm" data-set="placed">Reopen</button>` : ""}
    </div>

    <!-- ── a word to the customer ──
         Status changes write their own notification. This is for the
         sentence that does not fit one: the thread that ran out, the
         pincode that is a digit short, the parcel going out tomorrow. It
         sits against the order in their account whether or not they saw
         it on their phone. A conversation still belongs on WhatsApp. -->
    <div class="k">Tell them something</div>
    ${o.user_id ? `
      <form id="msgForm">
        <div class="fg">
          <div><textarea class="inp" id="oMsg" rows="2" maxlength="500"
            placeholder="Posting tomorrow morning — it will reach you before the 24th."></textarea></div>
        </div>
        <div class="acts">
          <button class="btn btn-sm" type="submit">Send to their account</button>
          <a class="btn btn-ghost btn-sm" href="${esc(waLink(o.phone, msg))}"
             target="_blank" rel="noopener">Say it on WhatsApp instead</a>
        </div>
      </form>
      ${sent.length ? `<div class="hist" style="margin-top:14px">${sent.map(m => `
        <div class="hev"><i></i><div>
          <b>${esc(m.body)}</b>
          <span>${esc(dayTimeText(m.created_at))} · ${
            m.read_at ? "read " + esc(agoText(m.read_at)) : "not read yet"}</span>
        </div></div>`).join("")}</div>` : ""}`
    : `<p class="empty" style="text-align:left; padding:0">This order was placed
        without an account, so there is nowhere to send a notification. WhatsApp
        is the only way to reach them.</p>`}

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

  $("#panelB").querySelectorAll("[data-copy]").forEach(b => {
    b.onclick = async () => {
      try{ await navigator.clipboard.writeText(b.dataset.copy); toast("Payment id copied"); }
      catch(e){ toast("Could not copy"); }
    };
  });

  const copy = $("#copyAddr");
  if(copy) copy.onclick = async () => {
    const text = `${o.name}\n${o.address}\n${o.city} — ${o.pincode}\n${o.phone}`;
    try{ await navigator.clipboard.writeText(text); toast("Address copied"); }
    catch(e){ toast("Could not copy"); }
  };

  /* the same piece of paper the customer got, drawn by the shared builder */
  const pdfBtn = $("#billPdf");
  if(pdfBtn) pdfBtn.onclick = () => {
    const bill = {
      billNo: o.bill_no,
      date:   new Date(o.created_at).toLocaleDateString("en-IN",
                {day:"2-digit", month:"short", year:"numeric"}),
      lines:  items.map(i => ({name: i.name, qty: i.qty, price: i.price})),
      subtotal: o.subtotal,
      discount: o.discount || 0,
      discountCode: o.coupon_code || "",
      shipping: o.shipping,
      total:  o.total,
      to: {name: o.name, addr: o.address, city: o.city, pin: o.pincode,
           phone: o.phone, note: o.note},
      footer: [
        o.payment === "upi"
          ? (o.paid_at ? "Paid by UPI." : "To be paid by UPI.")
          : "Cash on delivery - collect " + inr(o.total) + ".",
        "An order summary, not a tax invoice. Amounts in INR."
      ]
    };
    savePdfFile(billPdfFile(bill, "RayArtGallery-" + o.bill_no + ".pdf"));
    toast("Bill saved");
  };

  /* an ordered line opens that rakhi's page */
  $("#panelB").querySelectorAll("[data-prod]").forEach(b => {
    b.onclick = () => openProductPanel(b.dataset.prod);
  });

  const msgForm = $("#msgForm");
  if(msgForm) msgForm.addEventListener("submit", async e => {
    e.preventDefault();
    const box = $("#oMsg"), body = box.value.trim();
    if(!body) return toast("Write something first.");
    const btn = msgForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try{
      await SB.rpc("message_customer", {p_order: o.id, p_body: body});
      box.value = "";
      toast("Sent — it is in their account now");
      await showOrder(o.id);
    }catch(err){
      toast(/function|404|schema cache/i.test(err.message || "")
        ? "Run supabase/13-messages.sql first — this needs it."
        : err.message);
      btn.disabled = false;
    }
  });

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
