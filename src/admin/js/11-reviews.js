/* ══════════════════════════════════════════════════════════
   REVIEWS

   Every rating left on the shop, newest first. Two things can
   be done with one: reply to it, or hide it.

   Not edit it, and not delete it — the database refuses both,
   for the seller as much as for anyone. A shop that can rewrite
   its own reviews has no reviews, and a rating nobody trusts is
   worth less than no rating at all.

   Hiding is for what should not be on a page at all — abuse, a
   phone number, a review of the wrong thing. It takes the row
   out of the average as well as off the shop, so it is a real
   hiding, not a cosmetic one.
   ══════════════════════════════════════════════════════════ */
let reviewRows = [], revFilter = "all";

VIEWS.reviews = async function(){
  reviewRows = await SB.rpc("admin_reviews", {p_limit: 120}) || [];
  paintReviewsAdmin();
};

function paintReviewsAdmin(){
  const rows = reviewRows.filter(r =>
      revFilter === "all"      ? true
    : revFilter === "hidden"   ? r.status === "hidden"
    : revFilter === "unreplied"? !r.seller_reply && r.status === "published"
    : revFilter === "low"      ? r.rating <= 3
    : true);

  const published = reviewRows.filter(r => r.status === "published");
  const avg = published.length
    ? (published.reduce((s, r) => s + r.rating, 0) / published.length).toFixed(1) : "—";
  const unreplied = reviewRows.filter(r => !r.seller_reply && r.status === "published").length;

  const tabs = [["all","All"],["unreplied","Not replied to"],["low","3 stars or fewer"],["hidden","Hidden"]];

  view().innerHTML = `
    <div class="head">
      <h1>Reviews</h1>
      <span class="sub">${published.length} on the shop${
        avg !== "—" ? ` · ${avg} average` : ""}</span>
    </div>

    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
      ${kpi(avg, "average rating", published.length + " published")}
      ${kpi(String(unreplied), "waiting for a reply",
            unreplied ? "a reply is read by everyone after" : "all answered", unreplied > 0)}
      ${kpi(String(reviewRows.filter(r => r.rating <= 3).length), "3 stars or fewer",
            "the ones worth reading closely")}
    </div>

    <div class="range" style="margin-bottom:14px; width:max-content; max-width:100%; overflow-x:auto">
      ${tabs.map(([k, label]) =>
        `<button type="button" data-revf="${k}" aria-pressed="${revFilter === k}">${label}</button>`).join("")}
    </div>

    ${rows.length ? `<div class="grid" style="gap:10px">${rows.map(adminReviewCard).join("")}</div>`
      : `<div class="card"><p class="empty">${
          reviewRows.length ? "Nothing in this list." :
          "No reviews yet. One can only be written by someone whose order of that "
          + "rakhi reached delivered — so they start arriving once you mark orders delivered."
        }</p></div>`}`;

  view().querySelectorAll("[data-revf]").forEach(b => {
    b.onclick = () => { revFilter = b.dataset.revf; paintReviewsAdmin(); };
  });
  view().querySelectorAll("[data-revhide]").forEach(b => {
    b.onclick = () => toggleReviewHidden(Number(b.dataset.revhide));
  });
  view().querySelectorAll("[data-revreply]").forEach(f => {
    f.addEventListener("submit", e => {
      e.preventDefault();
      saveReply(Number(f.dataset.revreply), f.querySelector("textarea").value);
    });
  });
}

function adminReviewCard(r){
  return `<div class="card${r.status === "hidden" ? " rev-hidden" : ""}">
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
      ${starsHtml(r.rating, 14)}
      <b class="strong">${esc(r.who)}</b>
      <span class="dim" style="font-size:12px">on ${esc(r.product_name)}</span>
      <span class="spacer"></span>
      <span class="dim" style="font-size:11.5px">${esc(dayTimeText(r.created_at))}</span>
      ${r.status === "hidden" ? `<span class="chip no">Hidden</span>` : ""}
    </div>

    ${r.body ? `<p style="margin-top:9px; font-size:13.5px; line-height:1.6">${esc(r.body)}</p>`
             : `<p class="dim" style="margin-top:9px; font-size:13px">Rating only, no words.</p>`}

    <form data-revreply="${r.id}" style="margin-top:12px">
      <label class="lab" for="rr${r.id}">Your reply ${
        r.replied_at ? `<span class="dim">— sent ${esc(agoText(r.replied_at))}</span>` : ""}</label>
      <textarea class="inp" id="rr${r.id}" rows="2"
        placeholder="Answered publicly, under their review.">${esc(r.seller_reply || "")}</textarea>
      <div class="acts">
        <button class="btn btn-sm" type="submit">${r.seller_reply ? "Update reply" : "Reply"}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-revhide="${r.id}">${
          r.status === "hidden" ? "Put it back" : "Hide it"}</button>
      </div>
    </form>
  </div>`;
}

async function saveReply(id, text){
  const body = text.trim() || null;
  try{
    await SB.patch("reviews?id=eq." + id, {seller_reply: body});
    const row = reviewRows.find(r => r.id === id);
    if(row){ row.seller_reply = body; row.replied_at = body ? new Date().toISOString() : null; }
    paintReviewsAdmin();
    toast(body ? "Replied — it shows under their review" : "Reply removed");
  }catch(err){ toast(err.message); }
}

async function toggleReviewHidden(id){
  const row = reviewRows.find(r => r.id === id);
  if(!row) return;
  const next = row.status === "hidden" ? "published" : "hidden";
  try{
    await SB.patch("reviews?id=eq." + id, {status: next});
    row.status = next;
    paintReviewsAdmin();
    toast(next === "hidden"
      ? "Hidden — and taken out of the average"
      : "Back on the shop, and back in the average");
  }catch(err){ toast(err.message); }
}
