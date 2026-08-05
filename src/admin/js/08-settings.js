/* ══════════════════════════════════════════════════════════
   SETTINGS

   The four numbers that change what every visitor is told: the
   delivery charge, the amount that makes it free, and the two
   dates the countdown and the cut-off notice are worked out
   from. They live in one row in the database, so changing one
   here changes it for the next person who opens the shop —
   there is nothing to rebuild and nothing to re-upload.
   ══════════════════════════════════════════════════════════ */
VIEWS.settings = async function(){
  const rows = await SB.rest("shop_settings?select=*&id=eq.1&limit=1");
  const s = rows[0] || {};

  view().innerHTML = `
    <div class="head"><h1>Settings</h1>
      <span class="sub">live on the shop the moment you save</span></div>

    <div class="grid g2">
      <div class="card">
        <h2>Delivery and dates</h2>
        <form id="setForm">
          <div class="fg two">
            <div><label class="lab" for="sFlat">Delivery charge ₹</label>
              <input class="inp" id="sFlat" inputmode="numeric" value="${s.ship_flat}"></div>
            <div><label class="lab" for="sFree">Free above ₹</label>
              <input class="inp" id="sFree" inputmode="numeric" value="${s.free_ship_above}"></div>
          </div>
          <div class="fg two">
            <div><label class="lab" for="sFest">Raksha Bandhan</label>
              <input class="inp" id="sFest" type="date" value="${esc(s.festival_date || "")}"></div>
            <div><label class="lab" for="sCut">Last order date</label>
              <input class="inp" id="sCut" type="date" value="${esc(s.order_by_date || "")}"></div>
          </div>
          <div class="acts"><button class="btn" type="submit">Save</button></div>
        </form>
      </div>

      <div class="card">
        <h2>This account</h2>
        <div class="rows">
          <div class="row"><span>Signed in</span><span class="strong">${esc(me.email)}</span></div>
          <div class="row"><span>Role</span><span><span class="chip ok">seller</span></span></div>
          <div class="row"><span>Database</span><span class="mono" style="font-size:11px; word-break:break-all">${
            esc(SB.url())}</span></div>
        </div>
        <div class="k">Handing this over</div>
        <p class="empty" style="text-align:left; padding:0">
          Whoever runs the shop needs an ordinary account on it, and then one line
          in Supabase → SQL Editor:</p>
        <pre class="mono" style="white-space:pre-wrap; font-size:11px; background:rgba(255,255,255,.6);
          padding:11px; border-radius:var(--r-sm); margin-top:9px; line-height:1.6">update public.profiles set role = 'admin'
 where email = 'them@example.com';</pre>
        <p class="empty" style="text-align:left">To take it away again, set it back to
          <span class="mono">'customer'</span>. Nothing on either page can do this —
          which is why nobody can promote themselves.</p>
      </div>
    </div>`;

  $("#setForm").addEventListener("submit", async e => {
    e.preventDefault();
    const body = {
      ship_flat:       parseInt($("#sFlat").value, 10),
      free_ship_above: parseInt($("#sFree").value, 10),
      festival_date:   $("#sFest").value || null,
      order_by_date:   $("#sCut").value  || null
    };
    if(!Number.isFinite(body.ship_flat) || body.ship_flat < 0)             return toast("Delivery charge has to be a number.");
    if(!Number.isFinite(body.free_ship_above) || body.free_ship_above < 0) return toast("The free-delivery amount has to be a number.");
    if(!body.festival_date || !body.order_by_date)                         return toast("Both dates are needed.");
    if(body.order_by_date > body.festival_date)                            return toast("The last order date has to come before the festival.");
    try{
      await SB.patch("shop_settings?id=eq.1", body);
      toast("Saved — the shop is showing this now");
    }catch(err){ toast(err.message); }
  });
};
