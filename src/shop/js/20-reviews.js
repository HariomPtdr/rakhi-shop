/* ══════════════════════════════════════════════════════════
   REVIEWS

   Only from someone whose own order containing this rakhi
   reached "delivered" — and that is not decided here. The
   database refuses the insert otherwise, and this page asks it
   the same question (has_received) before drawing the form, so
   the button and the rule always agree.

   A rating that anyone can leave is worth nothing to the person
   reading it, and worse than nothing to the shop, which then
   cannot tell which rakhi is actually good.
   ══════════════════════════════════════════════════════════ */
let pvReviews = null;       // for the rakhi currently open
let pvCanReview = null;     // null = not asked yet
let myReview = null;        // theirs, if they have written one
let ratePick = 0;           // the stars they are hovering/have chosen

/* the five tappable stars in the form */
function starPicker(value){
  return `<div class="rate-pick" id="ratePick" role="radiogroup" aria-label="Your rating">
    ${[1,2,3,4,5].map(n => `
      <button type="button" role="radio" data-star="${n}" aria-checked="${n === value}"
        aria-label="${n} out of 5" class="${n <= value ? "on" : ""}">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .9 10.2 5.6 15.3 6.3 11.6 9.9
          12.5 15 8 12.6 3.5 15 4.4 9.9 .7 6.3 5.8 5.6Z"/></svg>
      </button>`).join("")}
  </div>`;
}

function reviewCard(r){
  return `<div class="rev">
    <div class="rev-top">
      ${starsHtml(r.rating, 12)}
      <b>${esc(r.who)}</b>
      <span>${esc(agoText(r.created_at))}</span>
    </div>
    ${r.body ? `<p class="rev-b">${esc(r.body)}</p>` : ""}
    ${r.seller_reply ? `<div class="rev-reply">
      <b>Ray Art Gallery</b>
      <p>${esc(r.seller_reply)}</p></div>` : ""}
  </div>`;
}

function paintReviews(){
  const box = $("#pvReviewBody");
  if(!box) return;
  const p = pvProduct();
  if(!p) return;

  let html = "";

  /* the form, or the reason there is not one */
  if(!SB_ON){
    html += "";
  }else if(!signedIn()){
    html += `<p class="ac-empty rev-note">Sign in and, once an order of yours has
      arrived, you can rate this one.</p>`;
  }else if(pvCanReview === null){
    html += `<p class="ac-empty rev-note">…</p>`;
  }else if(pvCanReview){
    const mine = myReview;
    html += `<form class="rev-form" id="revForm">
      <b>${mine ? "Your review" : "You have this one — how is it?"}</b>
      ${starPicker(ratePick || (mine ? mine.rating : 0))}
      <textarea id="revBody" rows="3" maxlength="1200"
        placeholder="What is it like in the hand? Did it arrive well?">${esc(mine ? (mine.body || "") : "")}</textarea>
      <div class="rev-acts">
        <button class="btn btn-dark" type="submit">${mine ? "Update" : "Post"}</button>
        ${mine ? `<button class="btn btn-ghost" type="button" id="revDel">Remove</button>` : ""}
      </div>
    </form>`;
  }else{
    html += `<p class="ac-empty rev-note">Only people whose order of this rakhi has
      arrived can rate it — which is why these ratings are worth reading.</p>`;
  }

  /* and the reviews themselves */
  if(pvReviews === null){
    html += `<p class="ac-empty">Loading…</p>`;
  }else if(!pvReviews.length){
    html += `<p class="ac-empty">No one has written about this one yet.</p>`;
  }else{
    html += `<div class="rev-list">${pvReviews.map(reviewCard).join("")}</div>`;
  }

  box.innerHTML = html;
}

/* ── loading ── */
async function loadReviews(id){
  pvReviews = null; pvCanReview = null; myReview = null; ratePick = 0;
  paintReviews();
  if(!SB_ON){ pvReviews = []; pvCanReview = false; return paintReviews(); }

  try{
    pvReviews = await SB.rpc("product_reviews", {p_product: id, p_limit: 20}) || [];
  }catch(e){ pvReviews = []; }

  if(signedIn()){
    try{
      pvCanReview = !!(await SB.rpc("has_received", {p_product: id}));
    }catch(e){ pvCanReview = false; }
    if(pvCanReview){
      try{
        const mine = await SB.rest("reviews?select=id,rating,body&product_id=eq."
                                 + encodeURIComponent(id)
                                 + "&user_id=eq." + encodeURIComponent(SB.user().id) + "&limit=1");
        myReview = (Array.isArray(mine) && mine[0]) || null;
        if(myReview) ratePick = myReview.rating;
      }catch(e){}
    }
  }else{
    pvCanReview = false;
  }
  /* the rakhi may have been closed while we were asking */
  if(productOpen() && pvId === id) paintReviews();
}

/* ── writing one ── */
document.addEventListener("click", e => {
  const s = e.target.closest("[data-star]");
  if(s){
    ratePick = parseInt(s.dataset.star, 10);
    $$("#ratePick [data-star]").forEach(b => {
      const on = parseInt(b.dataset.star, 10) <= ratePick;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(parseInt(b.dataset.star, 10) === ratePick));
    });
    return;
  }
  if(e.target.closest("#pvToReviews")){
    const el = $("#pvReviews");
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
  }
  if(e.target.closest("#revDel")) removeReview();
});

document.addEventListener("submit", e => {
  if(e.target.id !== "revForm") return;
  e.preventDefault();
  submitReview();
});

async function submitReview(){
  const p = pvProduct();
  if(!p) return;
  if(!ratePick) return toast("Choose a rating first");
  const body = ($("#revBody") && $("#revBody").value.trim()) || null;
  const u = SB.user();

  try{
    if(myReview){
      await SB.patch("reviews?id=eq." + myReview.id, {rating: ratePick, body});
      toast("Your review is updated");
    }else{
      await SB.insert("reviews",
        {product_id: p.id, user_id: u.id, rating: ratePick, body},
        {prefer: "return=representation"});
      toast("Thank you — that helps the next person");
    }
    await loadReviews(p.id);
    /* the average on the card has moved; the catalogue is the source of it */
    loadCatalogue().catch(() => {});
  }catch(err){
    toast(/row-level security|violates/i.test(err.message)
      ? "Only someone whose order of this rakhi arrived can rate it."
      : (err.message || "Could not post that just now."));
  }
}

async function removeReview(){
  if(!myReview) return;
  const p = pvProduct();
  try{
    await SB.del("reviews?id=eq." + myReview.id);
    toast("Removed");
    await loadReviews(p.id);
    loadCatalogue().catch(() => {});
  }catch(err){ toast(err.message); }
}
