/* ══════════════════════════════════════════════════════════
   Days left.

   The old version did Math.ceil() on the raw millisecond gap to a
   6am festival time. Any part-day rounded up, so the number only
   dropped at 6am instead of midnight — for the first six hours of
   every day it read one day too many.

   Counting calendar days means comparing local midnights and
   ignoring the clock entirely, which is what "days left" means to
   a person. Math.round absorbs any hour shift.
   ══════════════════════════════════════════════════════════ */
const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function dayOf(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const daysUntil = iso => Math.round((dayOf(iso) - midnight(new Date())) / 86400000);
const showDay = iso =>
  dayOf(iso).toLocaleDateString("en-IN", {day:"numeric", month:"short"});

/* the display strings every other bit of copy reads */
SHOP.festival = showDay(SHOP.festivalDate);
SHOP.orderBy  = showDay(SHOP.orderByDate);

/* ── the little pills of fact ──
   Free-delivery threshold and the days to the festival appear in the hero
   and again on every product page. They were written into the HTML twice,
   with ₹499 typed out — so changing the threshold in Settings changed the
   bill and left both pills lying. One renderer now, called from one place
   whenever anything it reads has changed. */
function trustPills(){
  const days = daysUntil(SHOP.festivalDate);
  const out = [
    /* the easier of the two ways to earn free delivery, since this pill has
       room for one — a shop that advertises the harder rule beside a banner
       advertising the easier one has told you two different things */
    SHOP.freeShipMinQty > 0
      ? `<span class="tc" role="listitem">Free on <b>${SHOP.freeShipMinQty}+ rakhis</b></span>`
      : SHOP.freeShipAbove > 0
        ? `<span class="tc" role="listitem">Free over <b>${inr(SHOP.freeShipAbove)}</b></span>`
        : `<span class="tc" role="listitem">Free delivery <b>on everything</b></span>`,
    `<span class="tc" role="listitem">Ships <b>all India</b></span>`
  ];
  if(days > 1)        out.push(`<span class="tc" role="listitem"><b>${days} days</b> to Raksha Bandhan</span>`);
  else if(days === 1) out.push(`<span class="tc" role="listitem">Raksha Bandhan is <b>tomorrow</b></span>`);
  else if(days === 0) out.push(`<span class="tc" role="listitem">Raksha Bandhan is <b>today</b></span>`);
  return out.join("");
}
function paintTrust(){
  $$(".trust").forEach(el => { el.innerHTML = trustPills(); });
  paintPromo();
}

/* ── the offer banner ──
   The line under FREE DELIVERY is the shop's actual rule, read from the
   same number the cart adds the charge from and the same one place_order()
   checks again on the way in. A banner promising delivery the checkout then
   charges for is the one kind of copy that costs money to be wrong, so it
   is not typed into the page — and if a banner cannot be written from the
   rule, the rule is what has to change first. */
function paintPromo(){
  const line = $("#promoLine");
  if(!line) return;
  const q = SHOP.freeShipMinQty;
  if(q > 0){
    /* the rule people can actually act on from the front page: it is a
       number of rakhis, not a number they have to add up */
    line.innerHTML = `on any <b>${q} ${plural(q, "rakhi")}</b> or more`;
  }else if(SHOP.freeShipAbove > 0){
    line.innerHTML = `on every order over <b>${inr(SHOP.freeShipAbove)}</b>`;
  }else{
    /* free on everything: there is no threshold left to announce, and a
       banner saying "over ₹0" reads as a shop that cannot count */
    line.innerHTML = `on <b>everything</b> in the shop`;
  }
}

$("#yr").textContent = new Date().getFullYear();
$("#qCut").textContent =
  `Yes, if you order by ${SHOP.orderBy}. Delivery takes three to six days to most pincodes. ` +
  `We still take late orders, but express courier costs extra.`;
/* only show Instagram once a handle is set — a dead link is worse than none */
if(SHOP.instagram && SHOP.instagram.trim()){
  const handle = SHOP.instagram.trim().replace(/^@/, "");
  const ig = $("#footIg");
  ig.href = "https://instagram.com/" + encodeURIComponent(handle);
  ig.setAttribute("aria-label", "Ray Art Gallery on Instagram, @" + handle);
  ig.title = "@" + handle;
  ig.hidden = false;
}
/* icon only, like the other two — the address itself is not printed */
if(SHOP.email && SHOP.email.trim()){
  const mail = SHOP.email.trim(), ml = $("#footMail");
  ml.href = "mailto:" + mail + "?subject=" + encodeURIComponent("Rakhi enquiry — Ray Art Gallery");
  ml.title = mail;
  ml.setAttribute("aria-label", "Email Ray Art Gallery at " + mail);
  ml.hidden = false;
}

const ASK = "Hello Ray Art Gallery, I have a question about your rakhis.";
["#fab","#faqWa","#footWa"].forEach(s=>$(s).href = wa(ASK));
$("#madeWa").href = wa(
`Hello Ray Art Gallery, I want a CUSTOM rakhi.

Thread colour:
Centre piece:
Bead colour:
Size:
Name to print on the card:
Quantity:

(or I will send a photo of the design I want)

Please tell me the price and how many days it will take.`);
$("#bulkWa").href = wa(
`Hello Ray Art Gallery, I want a BULK order.

Quantity:
For (office / school / shop / society):
City and pincode:
Needed by:

Please share your bulk rate.`);

/* marquee — the strip is duplicated so the loop has no seam */
const MQ = PRODUCTS.map(p=>p.name).concat(["Handmade in India","A symbol of the eternal love between brother and sister","Made to order"]);
const mqHTML = MQ.map((t,i)=>
  i%3===1 ? `<b>${t}</b>` : `<span>${t}</span>`).join('<span>·</span>');
$("#mqA").innerHTML = mqHTML; $("#mqB").innerHTML = mqHTML;
