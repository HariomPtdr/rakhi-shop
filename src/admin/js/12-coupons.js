/* ══════════════════════════════════════════════════════════
   COUPONS

   Made here, switched off here, deleted here.

   The one thing this screen owes you is a straight answer to
   "is this code working right now?" — a coupon can be switched
   off, not started yet, expired, or fully used, and all four
   look identical in a table of dates and counts. So each row
   says which of those it is, in a word.

   What a code is worth is never decided by this page or by the
   shop; both ask the database. This is only where the rules are
   written down.
   ══════════════════════════════════════════════════════════ */
let couponRows = [];

VIEWS.coupons = async function(){
  couponRows = await SB.rpc("admin_coupons") || [];
  paintCoupons();
};

/* the one question that matters, answered in a word */
function couponState(c){
  const now = Date.now();
  if(!c.active)                                          return ["Off", "no"];
  if(c.starts_at && new Date(c.starts_at).getTime() > now) return ["Starts later", ""];
  if(c.ends_at && new Date(c.ends_at).getTime() < now)     return ["Expired", "no"];
  if(c.max_uses != null && c.used_count >= c.max_uses)     return ["Used up", "no"];
  return ["Live", "ok"];
}

function couponWorth(c){
  if(c.kind === "percent")   return c.value + "% off" + (c.max_discount ? `, up to ${inr(c.max_discount)}` : "");
  if(c.kind === "amount")    return inr(c.value) + " off";
  return "Free delivery";
}

function couponRules(c){
  const bits = [];
  if(c.min_order)  bits.push("basket over " + inr(c.min_order));
  bits.push(c.per_customer === 1 ? "once per customer" : c.per_customer + " per customer");
  if(c.max_uses != null) bits.push(c.used_count + " of " + c.max_uses + " used");
  if(c.starts_at)  bits.push("from " + dayText(c.starts_at));
  if(c.ends_at)    bits.push("until " + dayText(c.ends_at));
  return bits.join(" · ");
}

function paintCoupons(){
  const live = couponRows.filter(c => couponState(c)[0] === "Live").length;
  const given = couponRows.reduce((s, c) => s + (c.given_away || 0), 0);
  const brought = couponRows.reduce((s, c) => s + (c.revenue || 0), 0);

  view().innerHTML = `
    <div class="head">
      <h1>Coupons</h1>
      <span class="sub">${live} working right now, ${couponRows.length} in total</span>
      <span class="spacer"></span>
      <button class="btn btn-sm" id="cpNew" type="button">Make a code</button>
    </div>

    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      ${kpi(String(live), "codes working now", couponRows.length - live + " off or finished")}
      ${kpi(inr(given), "given away", "across every order that used one")}
      ${kpi(inr(brought), "brought in", "what those orders were worth")}
    </div>

    <div class="card">
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr>
          <th>Code</th><th>What it gives</th><th>When it applies</th>
          <th class="num">Used</th><th class="num">Given away</th><th class="num">Brought in</th>
          <th>State</th><th></th>
        </tr></thead>
        <tbody>${couponRows.map(c => {
          const [label, cls] = couponState(c);
          return `<tr class="flat">
            <td><span class="mono strong" style="font-size:13px">${esc(c.code)}</span>
                ${c.note ? `<br><span class="dim" style="font-size:11px">${esc(c.note)}</span>` : ""}</td>
            <td class="strong">${esc(couponWorth(c))}</td>
            <td class="dim" style="font-size:12px">${esc(couponRules(c)) || "any order"}</td>
            <td class="num">${c.uses || 0}</td>
            <td class="num">${c.given_away ? inr(c.given_away) : "—"}</td>
            <td class="num strong">${c.revenue ? inr(c.revenue) : "—"}</td>
            <td><span class="chip ${cls}">${label}</span></td>
            <td><div class="rowacts">
              <button class="chip" data-cptoggle="${esc(c.code)}" type="button">${
                c.active ? "Switch off" : "Switch on"}</button>
              <button class="chip no" data-cpdel="${esc(c.code)}" type="button">Delete</button>
            </div></td>
          </tr>`;
        }).join("") || `<tr class="flat"><td colspan="8"><p class="empty">
          No codes yet. One good one — say 10% off for the first week — is usually
          worth more than five competing ones.</p></td></tr>`}
        </tbody></table></div>
      <p class="empty" style="text-align:left; padding:14px 2px 0">
        <b>Switch off</b> keeps the code and its history, and stops it working —
        use it to pause a code you may want back. <b>Delete</b> removes it for
        good; orders that already used it keep their discount.</p>
    </div>`;

  $("#cpNew").onclick = newCoupon;
  view().querySelectorAll("[data-cptoggle]").forEach(b => {
    b.onclick = () => toggleCoupon(b.dataset.cptoggle);
  });
  view().querySelectorAll("[data-cpdel]").forEach(b => {
    b.onclick = () => deleteCoupon(b.dataset.cpdel);
  });
}

/* ── making one ── */
function newCoupon(){
  const suggestion = "RAKHI" + String(new Date().getFullYear()).slice(2);
  openPanel("Make a code", `
    <form id="cpForm">
      <div class="fg two">
        <div><label class="lab" for="cpCode">The code</label>
          <input class="inp mono" id="cpCode" value="${suggestion}" maxlength="24"
                 style="text-transform:uppercase" required></div>
        <div><label class="lab" for="cpKind">What it gives</label>
          <select class="inp" id="cpKind">
            <option value="percent">A percentage off</option>
            <option value="amount">A fixed amount off</option>
            <option value="free_ship">Free delivery</option>
          </select></div>
      </div>

      <div class="fg two" id="cpValueRow">
        <div><label class="lab" for="cpValue"><span id="cpValueLab">Percent off</span></label>
          <input class="inp" id="cpValue" inputmode="numeric" value="10"></div>
        <div id="cpCapWrap"><label class="lab" for="cpCap">Never more than ₹ <span class="dim">(optional)</span></label>
          <input class="inp" id="cpCap" inputmode="numeric" placeholder="e.g. 100"></div>
      </div>

      <div class="fg two">
        <div><label class="lab" for="cpMin">Only on baskets over ₹</label>
          <input class="inp" id="cpMin" inputmode="numeric" value="0"></div>
        <div><label class="lab" for="cpPer">Times one customer may use it</label>
          <input class="inp" id="cpPer" inputmode="numeric" value="1"></div>
      </div>

      <div class="fg two">
        <div><label class="lab" for="cpMax">Total uses allowed <span class="dim">(blank = no limit)</span></label>
          <input class="inp" id="cpMax" inputmode="numeric" placeholder="unlimited"></div>
        <div><label class="lab" for="cpEnds">Stops working on <span class="dim">(optional)</span></label>
          <input class="inp" id="cpEnds" type="date"></div>
      </div>

      <div class="fg">
        <div><label class="lab" for="cpNote">What it is for <span class="dim">(only you see this)</span></label>
          <input class="inp" id="cpNote" placeholder="Instagram launch"></div>
      </div>

      <p class="empty" style="text-align:left; padding:10px 0 0">
        A percentage without a ceiling is how a big order costs you money —
        set "never more than" unless you mean it.</p>

      <div class="acts"><button class="btn" type="submit">Make it</button></div>
    </form>`);

  const kind = $("#cpKind"), lab = $("#cpValueLab"), cap = $("#cpCapWrap"), row = $("#cpValueRow");
  const sync = () => {
    const k = kind.value;
    row.style.display = k === "free_ship" ? "none" : "";
    cap.style.display = k === "percent" ? "" : "none";
    lab.textContent = k === "percent" ? "Percent off" : "Amount off ₹";
    if(k === "amount" && $("#cpValue").value === "10") $("#cpValue").value = "50";
  };
  kind.onchange = sync; sync();

  $("#cpForm").addEventListener("submit", async e => {
    e.preventDefault();
    const k = kind.value;
    const row2 = {
      code:  $("#cpCode").value.trim().toUpperCase(),
      kind:  k,
      value: k === "free_ship" ? 0 : parseInt($("#cpValue").value, 10),
      max_discount: (k === "percent" && $("#cpCap").value.trim()) ? parseInt($("#cpCap").value, 10) : null,
      min_order:    parseInt($("#cpMin").value, 10) || 0,
      per_customer: parseInt($("#cpPer").value, 10) || 1,
      max_uses:     $("#cpMax").value.trim() ? parseInt($("#cpMax").value, 10) : null,
      ends_at:      $("#cpEnds").value ? new Date($("#cpEnds").value + "T23:59:59").toISOString() : null,
      note:         $("#cpNote").value.trim() || null,
      active: true
    };
    if(!/^[A-Z0-9]{3,24}$/.test(row2.code))
      return toast("A code is 3–24 letters and digits, no spaces.");
    if(k === "percent" && !(row2.value >= 1 && row2.value <= 90))
      return toast("A percentage has to be between 1 and 90.");
    if(k === "amount" && !(row2.value > 0))
      return toast("Give the amount it takes off.");

    try{
      await SB.insert("coupons", row2);
      closePanel();
      toast(row2.code + " is ready to hand out");
      render();
    }catch(err){
      toast(/duplicate|unique/i.test(err.message) ? "That code already exists." : err.message);
    }
  });
}

async function toggleCoupon(code){
  const c = couponRows.find(x => x.code === code);
  if(!c) return;
  try{
    await SB.patch("coupons?code=eq." + encodeURIComponent(code), {active: !c.active});
    c.active = !c.active;
    paintCoupons();
    toast(c.active ? code + " is working again" : code + " will no longer be accepted");
  }catch(err){ toast(err.message); }
}

async function deleteCoupon(code){
  const c = couponRows.find(x => x.code === code);
  if(!c) return;
  const used = c.uses || 0;
  const msg = used
    ? `${code} has been used ${used} ${plural(used, "time")}. Deleting it keeps those orders and their discounts, but the code is gone for good. Switch it off instead?`
    : `Delete ${code}? It has never been used, so nothing is lost.`;
  if(!confirm(msg)) return;
  try{
    await SB.del("coupons?code=eq." + encodeURIComponent(code));
    couponRows = couponRows.filter(x => x.code !== code);
    paintCoupons();
    toast(code + " deleted");
  }catch(err){ toast(err.message); }
}
