/* ══════════════════════════════════════════════════════════
   COUPON CODES

   The page never works out what a code is worth. It asks the
   database (check_coupon), shows that answer, and sends the
   code — not the discount — with the order. place_order()
   then works it out again from the coupon row and stores its
   own number.

   So the worst a tampered browser can do is show itself a
   discount it will not get.
   ══════════════════════════════════════════════════════════ */
let coupon = {ok:false, code:"", discount:0, freeShip:false, label:"", reason:"", busy:false};

const couponDiscount = () => coupon.ok ? Math.min(coupon.discount, sub()) : 0;

/* delivery, after a free-delivery code has had its say */
function shipNow(){
  if(coupon.ok && coupon.freeShip) return 0;
  return ship();
}
const billTotal = () => Math.max(0, sub() - couponDiscount() + shipNow());

function clearCoupon(){
  coupon = {ok:false, code:"", discount:0, freeShip:false, label:"", reason:"", busy:false};
}

/* ── the box on the bill ── */
function paintCouponBox(){
  const box = $("#couponBox");
  if(!box) return;
  if(!SB_ON){ box.innerHTML = ""; return; }

  if(coupon.ok){
    box.innerHTML = `
      <div class="cp-on">
        <div>
          <b>${esc(coupon.code)}</b>
          <span>${esc(coupon.label)}${coupon.freeShip ? "" : " — you save " + inr(couponDiscount())}</span>
        </div>
        <button type="button" id="cpRemove">Remove</button>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="cp-row">
      <input type="text" id="cpInput" placeholder="Discount code" autocomplete="off"
             spellcheck="false" maxlength="24" value="${esc(coupon.code)}">
      <button class="btn btn-ghost" type="button" id="cpApply"${coupon.busy ? " disabled" : ""}>${
        coupon.busy ? "Checking…" : "Apply"}</button>
    </div>
    ${coupon.reason ? `<p class="cp-no">${esc(coupon.reason)}</p>` : ""}`;
}

async function applyCoupon(){
  const el = $("#cpInput");
  const code = ((el && el.value) || "").trim().toUpperCase();
  if(!code){ coupon.reason = "Enter a code."; return paintCouponBox(); }
  if(!signedIn()){
    coupon.reason = "Sign in first — a code is tied to your account.";
    return paintCouponBox();
  }

  coupon.busy = true; coupon.code = code; coupon.reason = "";
  paintCouponBox();

  try{
    const r = await SB.rpc("check_coupon", {p_code: code, p_subtotal: sub()});
    if(r && r.ok){
      coupon = {ok:true, code:r.code, discount:r.discount || 0,
                freeShip:!!r.free_ship, label:r.label || "", reason:"", busy:false};
      toast("Code applied");
    }else{
      coupon = {ok:false, code, discount:0, freeShip:false, label:"",
                reason:(r && r.reason) || "That code is not valid.", busy:false};
    }
  }catch(err){
    coupon = {ok:false, code, discount:0, freeShip:false, label:"",
              reason:"Could not check that code just now.", busy:false};
  }
  paintBill();
}

/* The basket can change after a code is applied — a code needing ₹300 must
   not survive the basket dropping to ₹200. Re-asked whenever the bill is
   redrawn, and only when it would change the answer. */
let lastCheckedSub = -1;
async function recheckCoupon(){
  if(!coupon.ok || coupon.busy) return;
  if(sub() === lastCheckedSub) return;
  lastCheckedSub = sub();
  try{
    const r = await SB.rpc("check_coupon", {p_code: coupon.code, p_subtotal: sub()});
    if(r && r.ok){
      if(r.discount !== coupon.discount){ coupon.discount = r.discount; paintBill(); }
    }else{
      const why = (r && r.reason) || "That code no longer applies.";
      clearCoupon();
      coupon.reason = why;
      paintBill();
      toast(why);
    }
  }catch(e){}
}

document.addEventListener("click", e => {
  if(e.target.closest("#cpApply")){ applyCoupon(); return; }
  if(e.target.closest("#cpRemove")){
    clearCoupon(); lastCheckedSub = -1;
    paintBill();
    toast("Code removed");
  }
});
document.addEventListener("keydown", e => {
  if(e.key === "Enter" && e.target && e.target.id === "cpInput"){
    e.preventDefault();
    applyCoupon();
  }
});
