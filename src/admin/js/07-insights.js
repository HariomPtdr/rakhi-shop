/* ══════════════════════════════════════════════════════════
   INSIGHTS

   The questions a sales report cannot answer:

     what people want that you are not selling them
     which baskets were filled and left
     where in India the orders are coming from
     what hour of the day they arrive, so you know when to be
       at your phone
     how much of the trade is people coming back

   Every one of them changes what you make or when you post.
   ══════════════════════════════════════════════════════════ */
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

VIEWS.insights = async function(){
  const d = await SB.rpc("admin_insights", {p_days: range});

  const hours = Array.from({length: 24}, (_, h) => {
    const hit = (d.by_hour || []).find(x => x.h === h);
    return {label: h + ":00", short: (h % 6 === 0 ? h : ""), value: hit ? hit.orders : 0,
            title: h + ":00 – " + (h + 1) + ":00 · " + (hit ? hit.orders : 0) + " orders"};
  });
  const days = WEEK.map((name, i) => {
    const hit = (d.by_weekday || []).find(x => x.w === i + 1);
    return {label: name, short: name, value: hit ? hit.orders : 0};
  });

  const nvr = d.new_vs_repeat || {new:0, repeat:0};
  const nvrTotal = (nvr.new || 0) + (nvr.repeat || 0);

  view().innerHTML = `
    <div class="head">
      <h1>Insights</h1>
      <span class="sub">last ${range === 365 ? "year" : range + " days"}</span>
      <span class="spacer"></span>
      ${rangePicker()}
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>Wanted more than bought</h2>
        <p class="empty" style="text-align:left; padding:0 0 12px">
          Hearts on the left, pieces actually sold on the right. A long bar with
          a small number beside it is a rakhi people want and are not buying —
          usually the price, or it ran out.</p>
        ${hbars((d.wanted || []).map(w => ({
            label: w.name, value: w.wishes,
            text: w.wishes + " ♥ · " + w.units + " sold" + (w.stock === 0 ? " · sold out" : "")
          })), {empty:"Nobody has hearted anything yet."})}
      </div>

      <div class="card">
        <h2>Where the orders go</h2>
        ${hbars((d.by_city || []).map(c => ({
            label: c.city || "—", value: c.revenue, text: inr(c.revenue) + " · " + c.orders
          })), {alt:true, empty:"No orders in this period."})}
        <div style="margin-top:18px">
          <h2>What sells, by kind</h2>
          ${hbars((d.by_category || []).map(c => ({
              label: c.cat || "packs", value: c.revenue, text: inr(c.revenue) + " · " + c.units + " pcs"
            })), {empty:"No sales in this period."})}
        </div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h2>What hour they order</h2>
        ${barsSVG(hours, {height:110, alt:"Orders by hour of the day"})}
        <p class="empty" style="text-align:left; padding:8px 0 0">
          India time. Worth knowing before you decide when to post on Instagram.</p>
      </div>
      <div class="card">
        <h2>What day they order</h2>
        ${barsSVG(days, {height:110, alt:"Orders by day of the week"})}
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h2>New against returning</h2>
        ${nvrTotal ? hbars([
            {label:"First order", value:nvr.new || 0,
             text:(nvr.new || 0) + " · " + pct(nvr.new || 0, nvrTotal) + "%"},
            {label:"Ordered before", value:nvr.repeat || 0,
             text:(nvr.repeat || 0) + " · " + pct(nvr.repeat || 0, nvrTotal) + "%"}
          ]) : `<p class="empty">No orders in this period.</p>`}
        <div style="margin-top:18px">
          <h2>What people searched for</h2>
          ${hbars((d.searches || []).map(s => ({label: s.q, value: s.n, text: s.n})),
                  {alt:true, empty:"No searches recorded."})}
        </div>
      </div>

      <div class="card">
        <h2>Baskets filled and left</h2>
        <p class="empty" style="text-align:left; padding:0 0 12px">
          Signed-in customers with something still in the basket. One message
          usually finishes half of these.</p>
        ${(d.abandoned || []).length ? `<div class="tbl-scroll"><table class="tbl">
          <thead><tr><th>Who</th><th class="num">Worth</th><th>Left</th><th></th></tr></thead>
          <tbody>${d.abandoned.map(b => `
            <tr class="flat">
              <td><span class="strong">${esc(b.name || b.email || "—")}</span>
                <br><span class="dim" style="font-size:11px">${b.items} ${plural(b.items, "piece")}</span></td>
              <td class="num strong">${inr(b.value)}</td>
              <td class="dim nowrap">${esc(agoText(b.at))}</td>
              <td>${b.phone ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
                    href="${esc(waLink(b.phone, `Namaste ${String(b.name || "").split(" ")[0]}, `
                      + `you left ${b.items} ${plural(b.items, "rakhi")} in your basket at Ray Art Gallery. `
                      + `Shall I keep them for you?`))}">Nudge</a>` : ""}</td>
            </tr>`).join("")}</tbody></table></div>`
          : `<p class="empty">No baskets waiting.</p>`}
      </div>
    </div>`;
};
