/* ══════════════════════════════════════════════════════════
   OVERVIEW

   The one screen to open in the morning: what came in, what
   still has to go out, and what is running low. Everything on
   it arrives in a single call — admin_overview() — so it is
   one round trip on a phone at the counter, not fifteen.
   ══════════════════════════════════════════════════════════ */
VIEWS.overview = async function(){
  const d = await SB.rpc("admin_overview", {p_days: range});

  const daily = (d.daily || []).map(r => ({
    label: dayText(r.d).slice(0, 6),
    short: new Date(r.d).getDate() + "",
    value: r.revenue,
    title: dayText(r.d) + " · " + inr(r.revenue) + " · " + r.orders + " " + plural(r.orders, "order")
  }));

  const f = d.funnel || {};
  const steps = [
    {label:"Visitors",  value:f.visitors  || 0},
    {label:"Looked",    value:f.views     || 0},
    {label:"Added",     value:f.carts     || 0},
    {label:"Started",   value:f.checkouts || 0},
    {label:"Ordered",   value:f.orders    || 0}
  ];

  const stat = d.status_counts || {};
  const statusRows = ["placed","confirmed","shipped","delivered","cancelled"]
    .filter(s => stat[s])
    .map(s => ({label: STATUS[s].label, value: stat[s], text: stat[s]}));

  view().innerHTML = `
    <div class="head">
      <h1>Overview</h1>
      <span class="sub">last ${range === 365 ? "year" : range + " days"}</span>
      <span class="spacer"></span>
      ${rangePicker()}
    </div>

    <div class="kpis">
      ${kpi(inr(d.revenue), "Revenue", d.orders + " " + plural(d.orders, "order"))}
      ${kpi(inr(d.aov), "Average order", d.units + " " + plural(d.units, "piece") + " sold")}
      ${kpi(String(d.to_ship), "To send out",
            d.pending + " not yet confirmed", d.to_ship > 0)}
      ${kpi(String(d.new_customers), "New customers",
            d.buyers + " bought in this period")}
    </div>

    <div class="grid g3">
      <div class="card">
        <h2>Revenue, day by day</h2>
        ${barsSVG(daily, {alt:"Revenue per day"})}
      </div>
      <div class="card">
        <h2>How a visit goes</h2>
        ${funnelHTML(steps)}
        <p class="empty" style="padding:14px 0 0; text-align:left">
          ${f.views ? pct(f.orders, f.views) + "% of the rakhis looked at ended in an order." :
            "Nothing recorded yet — the numbers here fill in as people visit."}</p>
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h2>Best sellers</h2>
        ${hbars((d.top_products || []).map(p => ({
            label: p.name, value: p.revenue,
            text: inr(p.revenue) + " · " + p.units
          })), {empty:"No sales in this period."})}
      </div>
      <div class="card">
        <h2>Where the orders are</h2>
        ${hbars(statusRows, {alt:true, empty:"No orders in this period."})}
        <div style="margin-top:16px">
          <h2>Running low</h2>
          ${(d.low_stock || []).length
            ? hbars(d.low_stock.map(p => ({label:p.name, value:Math.max(p.stock, 0.15), text:p.stock + " left"})), {alt:true})
            : `<p class="empty" style="padding:8px 0; text-align:left">Nothing under five —
                 or stock is not being counted. Products → Stock.</p>`}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>Just in</h2>
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr><th>Bill</th><th>Customer</th><th>Where</th>
          <th class="num">Pieces</th><th class="num">Total</th><th>Status</th><th>When</th></tr></thead>
        <tbody>${(d.recent_orders || []).map(o => `
          <tr data-order="${esc(o.id)}">
            <td class="mono nowrap">${esc(o.bill_no)}</td>
            <td class="strong nowrap">${esc(o.name)}</td>
            <td class="dim nowrap">${esc(o.city || "—")}</td>
            <td class="num">${o.units}</td>
            <td class="num strong">${inr(o.total)}</td>
            <td>${statusChipHTML(o.status)}</td>
            <td class="dim nowrap">${esc(agoText(o.created_at))}</td>
          </tr>`).join("") || `<tr class="flat"><td colspan="7"><p class="empty">
            No orders yet. They appear here the moment a signed-in customer sends a bill.</p></td></tr>`}
        </tbody></table></div>
    </div>

    <p class="empty" style="text-align:left; padding:14px 2px">
      ${inr(d.lifetime_revenue)} across ${d.lifetime_orders} ${plural(d.lifetime_orders, "order")} all time ·
      ${d.customers} ${plural(d.customers, "customer")} ·
      ${d.repeat_buyers} ${plural(d.repeat_buyers, "has", "have")} ordered more than once ·
      ${d.open_baskets} ${plural(d.open_baskets, "basket")} left full, worth ${inr(d.open_basket_value)}
    </p>`;

  view().querySelectorAll("[data-order]").forEach(tr => {
    tr.onclick = () => showOrder(tr.dataset.order);
  });
};
