/* ══════════════════════════════════════════════════════════
   INSIGHTS

   Every card says what it found, in a sentence, before it shows
   a chart. That order matters: a chart answers a question you
   already have, and this screen exists for the questions a
   shopkeeper has not thought to ask yet.

   A chart with one bar in it is not shown at all — one tall bar
   beside nothing is a shape, not a trend, and reading it as one
   is worse than not having it. Below that threshold the card
   says the number in words instead.
   ══════════════════════════════════════════════════════════ */
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOUR_NAME = h =>
  h === 0 ? "midnight" : h === 12 ? "noon"
  : h < 12 ? h + " in the morning"
  : h < 17 ? (h - 12) + " in the afternoon"
  : h < 21 ? (h - 12) + " in the evening"
  : (h - 12) + " at night";

VIEWS.insights = async function(){
  const d = await SB.rpc("admin_insights", {p_days: range});
  const period = range === 365 ? "year" : "last " + range + " days";

  const hours = Array.from({length: 24}, (_, h) => {
    const hit = (d.by_hour || []).find(x => x.h === h);
    return {label: HOUR_NAME(h), short: (h % 4 === 0 ? h : ""),
            value: hit ? hit.orders : 0,
            title: h + ":00 – " + (h + 1) + ":00 · " + (hit ? hit.orders : 0) + " orders"};
  });
  const days = WEEK.map((name, i) => {
    const hit = (d.by_weekday || []).find(x => x.w === i + 1);
    return {label: name, short: name, value: hit ? hit.orders : 0};
  });

  const nvr = d.new_vs_repeat || {new:0, repeat:0};
  const nvrTotal = (nvr.new || 0) + (nvr.repeat || 0);
  const cities = d.by_city || [];
  const cats = d.by_category || [];
  const wanted = d.wanted || [];
  const left = d.abandoned || [];

  /* the one sentence each card is for */
  const wantedGap = wanted.filter(w => w.wishes > 0 && w.units === 0);
  const topCity = cities[0];
  const cityShare = topCity && cities.length
    ? pct(topCity.revenue, cities.reduce((s, c) => s + c.revenue, 0)) : 0;
  const leftValue = left.reduce((s, b) => s + b.value, 0);

  view().innerHTML = `
    <div class="head">
      <h1>Insights</h1>
      <span class="sub">${period} · what the numbers are saying</span>
      <span class="spacer"></span>
      ${rangePicker()}
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>Wanted more than bought</h2>
        <p class="finding${wantedGap.length ? "" : " none"}">${
          wantedGap.length
            ? `<b>${esc(wantedGap[0].name)}</b> has been saved by ${wantedGap[0].wishes} ${
                plural(wantedGap[0].wishes, "person", "people")} and bought by nobody.
               ${wantedGap[0].stock === 0
                 ? "It is marked sold out — that is why."
                 : "It is in stock, so the price or the photo is what is stopping them."}`
            : wanted.length
              ? "Everything people have saved has also sold. Nothing is stuck."
              : "Nobody has saved a rakhi yet. The heart on each card is what fills this in."
        }</p>
        ${hbars(wanted.map(w => ({
            label: w.name, value: w.wishes,
            text: w.wishes + " saved · " + w.units + " sold"
          })), {empty:"Nothing saved yet."})}
      </div>

      <div class="card">
        <h2>Where the orders go</h2>
        <p class="finding${cities.length ? "" : " none"}">${
          cities.length
            ? (cities.length === 1
                ? `Every order so far has gone to <b>${esc(topCity.city)}</b>. Worth knowing
                   before you pay for delivery anywhere else.`
                : `<b>${esc(topCity.city)}</b> is ${cityShare}% of the money, across ${
                   cities.length} ${plural(cities.length, "town")}.`)
            : "No orders in this period."
        }</p>
        ${hbars(cities.map(c => ({
            label: c.city || "—", value: c.revenue, text: inr(c.revenue) + " · " + c.orders
          })), {alt:true, empty:"No orders in this period."})}

        <div style="margin-top:18px">
          <h2>What sells, by kind</h2>
          <p class="finding${cats.length ? "" : " none"}">${
            cats.length
              ? `<b>${esc(cats[0].cat || "packs")}</b> brings in the most — ${
                  inr(cats[0].revenue)} of ${inr(cats.reduce((s, c) => s + c.revenue, 0))}.`
              : "Nothing sold in this period."
          }</p>
          ${hbars(cats.map(c => ({
              label: c.cat || "packs", value: c.revenue,
              text: inr(c.revenue) + " · " + c.units + " pcs"
            })), {empty:"Nothing sold in this period."})}
        </div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h2>What hour they order</h2>
        <p class="finding${hours.some(h => h.value) ? "" : " none"}">${(() => {
          const top = hours.reduce((a, b) => b.value > a.value ? b : a, hours[0]);
          if(!top.value) return "No orders yet, so there is no pattern to see.";
          const n = hours.filter(h => h.value).length;
          return n === 1
            ? `The only order so far came in around <b>${esc(top.label)}</b>.`
            : `Most orders come in around <b>${esc(top.label)}</b>. That is when to be
               near your phone, and a good hour to post.`;
        })()}</p>
        ${barChart(hours, {alt:"Orders by hour", peak:false, values:false})}
      </div>

      <div class="card">
        <h2>What day they order</h2>
        <p class="finding${days.some(x => x.value) ? "" : " none"}">${(() => {
          const top = days.reduce((a, b) => b.value > a.value ? b : a, days[0]);
          if(!top.value) return "No orders yet, so there is no pattern to see.";
          const n = days.filter(x => x.value).length;
          return n === 1
            ? `Everything so far has arrived on a <b>${esc(top.label)}</b>.`
            : `<b>${esc(top.label)}</b> is the busiest day.`;
        })()}</p>
        ${barChart(days, {alt:"Orders by weekday", peak:false})}
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h2>New against returning</h2>
        <p class="finding${nvrTotal ? "" : " none"}">${
          !nvrTotal ? "No orders in this period."
          : nvr.repeat === 0
            ? `All ${nvr.new} ${plural(nvr.new, "order")} came from someone ordering for the
               first time. Nobody has come back yet — that is normal early, and it is the
               number to watch after the season.`
            : `${pct(nvr.repeat, nvrTotal)}% of orders came from someone who had bought
               before. Getting one of those costs nothing.`
        }</p>
        ${nvrTotal ? hbars([
            {label:"First order",    value:nvr.new || 0,
             text:(nvr.new || 0) + " · " + pct(nvr.new || 0, nvrTotal) + "%"},
            {label:"Ordered before", value:nvr.repeat || 0,
             text:(nvr.repeat || 0) + " · " + pct(nvr.repeat || 0, nvrTotal) + "%"}
          ]) : ""}

        <div style="margin-top:18px">
          <h2>What people searched for</h2>
          <p class="finding${(d.searches || []).length ? "" : " none"}">${
            (d.searches || []).length
              ? `They typed <b>${esc(d.searches[0].q)}</b> most. If you do not sell it, that
                 is a thing to make.`
              : "Nobody has searched yet."
          }</p>
          ${hbars((d.searches || []).map(s => ({label: s.q, value: s.n, text: s.n})),
                  {alt:true, empty:"Nothing searched yet."})}
        </div>
      </div>

      <div class="card">
        <h2>Baskets filled and left</h2>
        <p class="finding${left.length ? "" : " none"}">${
          left.length
            ? `${left.length} ${plural(left.length, "person", "people")} left ${inr(leftValue)}
               in a basket. One message usually finishes about half of it — that is
               ${inr(Math.round(leftValue / 2))} for the price of asking.`
            : "Nothing is sitting in a basket. Everyone who filled one sent it."
        }</p>
        ${left.length ? `<div class="tbl-scroll"><table class="tbl">
          <thead><tr><th>Who</th><th class="num">Worth</th><th>Left</th><th></th></tr></thead>
          <tbody>${left.map(b => `
            <tr class="flat">
              <td><span class="strong">${esc(b.name || b.email || "—")}</span>
                <br><span class="dim" style="font-size:11px">${b.items} ${
                  plural(b.items, "piece")}</span></td>
              <td class="num strong">${inr(b.value)}</td>
              <td class="dim nowrap">${esc(agoText(b.at))}</td>
              <td>${b.phone ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
                    href="${esc(waLink(b.phone, `Namaste ${String(b.name || "").split(" ")[0]}, `
                      + `you left ${b.items} ${plural(b.items, "rakhi")} in your basket at Ray Art Gallery. `
                      + `Shall I keep them for you?`))}">Nudge</a>` : ""}</td>
            </tr>`).join("")}</tbody></table></div>` : ""}
      </div>
    </div>`;
};
