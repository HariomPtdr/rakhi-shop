/* ══════════════════════════════════════════════════════════
   SETTINGS

   Everything a shop changes without needing a developer.

   The contact details used to live in a source file, which
   meant correcting the UPI id — the line printed on every bill
   asking people to pay — took an edit, a build and a deploy.
   They are in the database now, and the next visitor sees the
   change.

   Saving is per card rather than one button for the page, so
   changing the delivery charge cannot quietly rewrite the UPI
   id you were halfway through typing.
   ══════════════════════════════════════════════════════════ */
let settingsRow = {};

VIEWS.settings = async function(){
  const rows = await SB.rest("shop_settings?select=*&id=eq.1&limit=1");
  settingsRow = rows[0] || {};
  paintSettings();
};

function paintSettings(){
  const s = settingsRow;
  const shopUrl = location.origin + "/";

  view().innerHTML = `
    <div class="head"><h1>Settings</h1>
      <span class="sub">live on the shop the moment you save</span></div>

    ${s.orders_paused ? `<div class="notice warn">
      <b>The shop is not taking orders.</b>
      <span>Customers can browse and save rakhis, but the bill button is turned
        off and they are told why. Turn it back on below.</span>
    </div>` : ""}

    <div class="grid g2">

      <div class="card">
        <h2>Delivery and dates</h2>
        <form id="setDelivery">
          <div class="fg two">
            <div><label class="lab" for="sFlat">Delivery charge ₹</label>
              <input class="inp" id="sFlat" inputmode="numeric" value="${esc(s.ship_flat)}"></div>
            <div><label class="lab" for="sFree">Free above ₹</label>
              <input class="inp" id="sFree" inputmode="numeric" value="${esc(s.free_ship_above)}"></div>
          </div>
          <div class="fg two">
            <div><label class="lab" for="sFest">Raksha Bandhan</label>
              <input class="inp" id="sFest" type="date" value="${esc(s.festival_date || "")}"></div>
            <div><label class="lab" for="sCut">Last order date</label>
              <input class="inp" id="sCut" type="date" value="${esc(s.order_by_date || "")}"></div>
          </div>
          <p class="empty" style="text-align:left; padding:10px 0 0">
            The countdown on the shop, the "free over ₹${esc(s.free_ship_above)}" line
            and the delivery on every bill all come from these four.</p>
          <div class="acts"><button class="btn" type="submit">Save</button></div>
        </form>
      </div>

      <div class="card">
        <h2>How people reach you</h2>
        <form id="setContact">
          <div class="fg two">
            <div><label class="lab" for="sWa">WhatsApp <span class="dim">(91 + 10 digits)</span></label>
              <input class="inp mono" id="sWa" inputmode="numeric" value="${esc(s.whatsapp || "")}"
                     placeholder="919319848309"></div>
            <div><label class="lab" for="sUpi">UPI id <span class="dim">— printed on every bill</span></label>
              <input class="inp mono" id="sUpi" value="${esc(s.upi || "")}"
                     placeholder="you@upi"></div>
          </div>
          <div class="fg two">
            <div><label class="lab" for="sIg">Instagram <span class="dim">(without the @)</span></label>
              <input class="inp" id="sIg" value="${esc(s.instagram || "")}" placeholder="ray_art_24"></div>
            <div><label class="lab" for="sMail">Email shown in the footer</label>
              <input class="inp" id="sMail" type="email" value="${esc(s.email || "")}"></div>
          </div>
          <p class="empty" style="text-align:left; padding:10px 0 0">
            Every order arrives in the WhatsApp chat of the number above. Get it
            wrong and orders go to a stranger — it is worth reading twice.</p>
          <div class="acts"><button class="btn" type="submit">Save</button></div>
        </form>
      </div>
    </div>

    <div class="grid g2" style="margin-top:12px">

      <div class="card">
        <h2>A line across the shop</h2>
        <form id="setNotice">
          <div class="fg">
            <div><label class="lab" for="sAnn">Announcement <span class="dim">(blank for none)</span></label>
              <input class="inp" id="sAnn" maxlength="160" value="${esc(s.announcement || "")}"
                placeholder="Orders after 21 Aug ship the same week"></div>
          </div>
          <p class="empty" style="text-align:left; padding:10px 0 0">
            Shown at the top of every page until you clear it. Good for a
            delivery delay, a festival cut-off, or a day off.</p>
          <div class="acts"><button class="btn" type="submit">Save</button></div>
        </form>

        <div style="margin-top:22px">
          <h2>How they can pay</h2>
          <div class="rows">
            <div class="row"><span>Cash on delivery</span>
              <span class="strong">${s.cod_enabled === false
                ? `<span class="chip no">Not offered</span>`
                : `<span class="chip ok">Offered</span>`}</span></div>
            <div class="row"><span>Card, UPI, netbanking</span>
              <span class="strong"><span class="chip ok">Razorpay</span></span></div>
          </div>
          <form id="setCod" style="margin-top:10px">
            <div class="acts">
              <button class="btn${s.cod_enabled === false ? "" : " btn-ghost"}" type="submit">${
                s.cod_enabled === false ? "Start taking cash again" : "Stop taking cash"}</button>
            </div>
          </form>
          <p class="empty" style="text-align:left">
            A courier who collects cash charges for it, and a ₹49 rakhi does not
            always carry that. With cash off, the shop takes card and UPI only —
            and the database refuses a cash order as well, so a stale page cannot
            slip one through.</p>
          <p class="empty" style="text-align:left; padding-top:0">
            Paying online is handled by Razorpay: the customer pays on the shop,
            the payment is verified on our side, and the order confirms itself.
            Nothing here needs marking by hand, and the money settles into your
            bank account on Razorpay's usual schedule.</p>
        </div>

        <div style="margin-top:22px">
          <h2>Where the codes come from</h2>
          <form id="setCouponNote">
            <div class="fg">
              <div><label class="lab" for="sCpNote">Shown behind the <b>?</b> next to the
                  discount box <span class="dim">(blank hides the ?)</span></label>
                <textarea class="inp" id="sCpNote" rows="3" maxlength="400"
                  placeholder="Codes go out on our Instagram and to anyone who has ordered before."
                  >${esc(s.coupon_note || "")}</textarea></div>
            </div>
            <p class="empty" style="text-align:left; padding:10px 0 0">
              A discount box with nothing beside it tells someone a cheaper price
              exists and not how to get it. This is your answer to "where do I
              find a code?" — and a fair reason to follow you.</p>
            <div class="acts"><button class="btn" type="submit">Save</button></div>
          </form>
        </div>

        <div style="margin-top:22px">
          <h2>Taking orders</h2>
          <div class="rows">
            <div class="row"><span>Right now</span>
              <span class="strong">${s.orders_paused
                ? `<span class="chip no">Paused</span>`
                : `<span class="chip ok">Open</span>`}</span></div>
          </div>
          <form id="setPause" style="margin-top:10px">
            <div class="fg">
              <div><label class="lab" for="sPauseNote">What to tell them while paused</label>
                <input class="inp" id="sPauseNote" maxlength="160" value="${esc(s.pause_note || "")}"
                  placeholder="Back on Monday — this week is full."></div>
            </div>
            <div class="acts">
              <button class="btn${s.orders_paused ? "" : " btn-ghost"}" type="submit">${
                s.orders_paused ? "Start taking orders again" : "Stop taking orders"}</button>
            </div>
          </form>
          <p class="empty" style="text-align:left">
            Paused, the shop still shows everything and people can still save
            rakhis — they simply cannot send a bill. Better than silence when
            the week is already full.</p>
        </div>
      </div>

      <div class="card">
        <h2>This account</h2>
        <div class="rows">
          <div class="row"><span>Signed in</span><span class="strong">${esc(me.email)}</span></div>
          <div class="row"><span>Role</span><span><span class="chip ok">seller</span></span></div>
          <div class="row"><span>Database</span><span class="mono" style="font-size:11px; word-break:break-all">${
            esc(SB.url())}</span></div>
        </div>

        <div class="k">The two addresses</div>
        <div class="rows">
          <div class="row"><span>The shop</span>
            <span><a href="${esc(shopUrl)}" target="_blank" rel="noopener">${esc(shopUrl)}</a></span></div>
          <div class="row"><span>This dashboard</span>
            <span class="mono" style="font-size:11.5px; word-break:break-all">${esc(location.origin + location.pathname)}</span></div>
        </div>
        <div class="acts">
          <button class="btn btn-ghost btn-sm" id="copyShop" type="button">Copy the shop link</button>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener"
             href="https://wa.me/?text=${encodeURIComponent("Handmade rakhis from Ray Art Gallery — " + shopUrl)}">Share on WhatsApp</a>
        </div>
        <p class="empty" style="text-align:left">
          Keep the dashboard address to yourself. It is not what protects it —
          the database refuses anyone who is not the owner — but there is no
          reason to hand it out.</p>

        <div class="k">Handing this over</div>
        <p class="empty" style="text-align:left; padding:0">
          Whoever runs the shop needs an ordinary account on it, and then one
          line in Supabase → SQL Editor:</p>
        <pre class="mono" style="white-space:pre-wrap; font-size:11px; background:rgba(255,255,255,.6);
          padding:11px; border-radius:var(--r-sm); margin-top:9px; line-height:1.6">update public.profiles set role = 'admin'
 where email = 'them@example.com';</pre>
        <p class="empty" style="text-align:left">To take it away again, set it back to
          <span class="mono">'customer'</span>. Nothing on either page can do this —
          which is why nobody can promote themselves.</p>
      </div>
    </div>`;

  /* ── saving, one card at a time ── */
  $("#setDelivery").addEventListener("submit", async e => {
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
    await saveSettings(body, "Delivery and dates saved");
  });

  $("#setContact").addEventListener("submit", async e => {
    e.preventDefault();
    const wa = $("#sWa").value.replace(/\D/g, "");
    const upi = $("#sUpi").value.trim();
    if(wa && !/^[0-9]{10,15}$/.test(wa))
      return toast("A WhatsApp number is 91 followed by the 10 digits.");
    if(upi && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upi))
      return toast("A UPI id looks like name@bank.");
    await saveSettings({
      whatsapp:  wa || null,
      upi:       upi || null,
      instagram: $("#sIg").value.trim().replace(/^@/, "") || null,
      email:     $("#sMail").value.trim() || null
    }, "Saved — the shop uses these now");
  });

  $("#setCod").addEventListener("submit", async e => {
    e.preventDefault();
    const next = s.cod_enabled === false;      /* false means it is off now */
    await saveSettings({cod_enabled: next},
      next ? "Cash on delivery is back — the shop offers both again"
           : "Cash off — the shop takes UPI only now");
  });

  $("#setCouponNote").addEventListener("submit", async e => {
    e.preventDefault();
    const note = $("#sCpNote").value.trim();
    await saveSettings({coupon_note: note || null},
      note ? "Saved — it is behind the ? on the shop now"
           : "Removed — the ? disappears with it");
  });

  $("#setNotice").addEventListener("submit", async e => {
    e.preventDefault();
    await saveSettings({announcement: $("#sAnn").value.trim() || null},
      $("#sAnn").value.trim() ? "The line is up on the shop" : "Line removed");
  });

  $("#setPause").addEventListener("submit", async e => {
    e.preventDefault();
    const next = !settingsRow.orders_paused;
    await saveSettings({
      orders_paused: next,
      pause_note: $("#sPauseNote").value.trim() || null
    }, next ? "The shop has stopped taking orders" : "Taking orders again");
  });

  $("#copyShop").onclick = async () => {
    try{ await navigator.clipboard.writeText(shopUrl); toast("Shop link copied"); }
    catch(e){ toast(shopUrl); }
  };
}

async function saveSettings(body, msg){
  try{
    await SB.patch("shop_settings?id=eq.1", body);
    Object.assign(settingsRow, body);
    paintSettings();
    toast(msg);
  }catch(err){ toast(err.message); }
}
