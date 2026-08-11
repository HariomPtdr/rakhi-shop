/* ══════════════════════════════════════════════════════════
   ACCOUNTS · BASKETS · WISHLISTS · ORDERS   (Supabase)

   Why this exists: a basket in the phone's own storage is lost
   the moment someone switches phone, clears their browser or
   opens the shop in a private window. Signing in moves the
   basket, the hearts and the order history onto the server,
   where they survive all three.

   Nothing here is required. With the environment empty the
   page is exactly what it was: no account button, no network
   calls, the basket kept on the device.

   The talking to Supabase is in src/shared/js/02-sb.js, shared
   with the seller dashboard. This file is only the shop's half:
   what to load, what to keep in step, and what to do when
   somebody signs in.
   ══════════════════════════════════════════════════════════ */
const SB_ON = SB.on;

let profile = null;          // the saved delivery details
let placedBill = "";         // set once an order has been recorded this visit
let cartFromServer = false;  // true while the merge is writing into `cart`
let shopPaused = false;      // the seller has stopped taking orders
let shopPauseNote = "";
let couponNote = "";   // the seller's answer to "where do I get a code?"

const signedIn = () => SB.signedIn();

/* ── the shop is for people with an account ──
   Adding to the basket and saving a rakhi both ask for a sign-in first. One
   function decides it so the grid, the rail, the product page and the heart
   can never disagree, and so that turning it off later is one line.

   With no database configured there is nothing to sign in to, and the shop
   behaves as it always did — the basket lives on the phone. */
function mustSignIn(action){
  if(!SB_ON || signedIn()) return false;
  acctView = "in";
  /* openAcct() clears any note on the way in — so the reason goes on
     afterwards, or the sheet appears with no explanation of why it did */
  openAcct();
  /* the calm variant, not the red one — nothing has gone wrong here */
  note("Sign in to " + action + ". It takes a moment, and everything you pick "
     + "then follows you to any phone.", true);
  return true;
}

/* ── the catalogue, if the database has one ─────────────────
   Falls back to the list written into 03-catalogue.js, so a
   Supabase outage shows a full shop rather than an empty one. */
function applyCatalogue(rows){
  if(!Array.isArray(rows) || !rows.length) return false;
  const rakhis = rows.filter(r => r.kind !== "set");
  const sets   = rows.filter(r => r.kind === "set");
  if(!rakhis.length) return false;

  PRODUCTS.length = 0;
  rakhis.sort((a,b) => (a.feat||999) - (b.feat||999)).forEach(r => PRODUCTS.push({
    id:    r.id,
    name:  r.name,
    price: r.price,
    cat:   r.cat || "traditional",
    feat:  r.feat || 999,
    img:   r.image_path ? SB.photoUrl(r.image_path) : null,
    /* filled in by loadGallery() when this rakhi is opened */
    imgs:  [],
    desc:  r.descr || "",
    stock: (r.stock === null || r.stock === undefined) ? null : r.stock,
    rating: r.rating_avg == null ? null : Number(r.rating_avg),
    ratings: r.rating_count || 0,
    /* Absent until 22-tags.sql has been run, and absent on any rakhi
       nobody has labelled yet — an empty list either way, so nothing
       downstream has to ask which of the two it is looking at. */
    tags:  Array.isArray(r.tags) ? r.tags.filter(Boolean) : [],
    mrp:   r.mrp == null ? null : Number(r.mrp),
    /* the seller's own answer to "which of these are the good ones" — the
       tick in the dashboard, and what the Bestsellers page is made of */
    best:  !!r.best,
    art:   (r.art && r.art.thread) ? r.art : {thread:"#C0272D", bead:"#FDFCF7", charm:"moti"}
  }));

  if(sets.length){
    SETS.length = 0;
    sets.sort((a,b) => (a.feat||999) - (b.feat||999)).forEach(r => SETS.push({
      id:r.id, name:r.name, price:r.price, was:r.mrp || 0,
      best:!!r.best, items:Array.isArray(r.includes) ? r.includes : []
    }));
  }
  return true;
}
function repaintCatalogue(){
  numberCatalogue();
  paintRail(); buildDots();
  paintGrid();
  paintHearts();
  cart = cleanCart(cart);        /* drop anything the shop has stopped selling */
  save(); paintCart();
  if(typeof productOpen === "function" && productOpen()){
    if(pvProduct()) paintProduct(); else closeProduct();
  }
}
/* The catalogue is asked for twice if it has to be.

   The full request wants ratings and the photo gallery, which only exist
   once 05-reviews.sql and 07-images.sql have been run. Until then that
   request fails as a whole — and a failed catalogue means the shop quietly
   falls back to the sample list written into this file, showing sample
   prices. That is a worse outcome than having no stars.

   So a failure falls back to the columns that have always existed, and the
   shop shows the real catalogue without the extras. */
const CAT_CORE = "id,kind,name,price,mrp,cat,feat,descr,image_path,art,includes,best,stock";
/* The gallery is deliberately not joined in here any more. Every product
   carrying every one of its photo rows made the first request of the visit
   grow with the shop — and the grid only ever draws the cover. The rest are
   fetched for the one rakhi somebody actually opens. */
const CAT_RATED = CAT_CORE + ",rating_avg,rating_count";
/* Tags arrive with 22-tags.sql, so they get a step of their own. Asked for
   in the same breath as the ratings, one missing column would take the
   stars down with it — a migration not yet run costing the shop something
   that was already working. */
const CAT_FULL = CAT_RATED + ",tags";

/* 300 was a cap nobody would notice passing: product 301 simply would not
   be in the shop, with no error to say so. Raised well past what this shop
   plans to hold, and it says something if it is ever reached. */
const CAT_MAX = 2000;

async function loadCatalogue(){
  const ask = cols => SB.rest("products?select=" + cols
                            + "&active=eq.true&order=feat.asc&limit=" + CAT_MAX);
  let rows;
  /* widest first, then narrower, rather than straight to the core columns:
     one missing migration should cost only what that migration adds */
  try{ rows = await ask(CAT_FULL); }
  catch(err){
    try{ rows = await ask(CAT_RATED); }
    catch(err2){ rows = await ask(CAT_CORE); }
  }
  if(Array.isArray(rows) && rows.length >= CAT_MAX){
    console.warn("The catalogue hit the " + CAT_MAX + " row ceiling — "
               + "anything past it is not in the shop. Time to page this query.");
  }
  if(applyCatalogue(rows)) repaintCatalogue();
}

/* ── the photos of one rakhi, fetched when it is opened ──
   Cached on the product itself, so going back and forth between the grid
   and a product does not ask again. */
async function loadGallery(p){
  if(!p || p.imgsLoaded || p.imgsLoading) return false;
  p.imgsLoading = true;
  try{
    const rows = await SB.rest("product_images?select=path,sort&product_id=eq."
                             + encodeURIComponent(p.id) + "&order=sort.asc");
    p.imgs = (rows || []).map(r => SB.photoUrl(r.path));
    p.imgsLoaded = true;
  }catch(e){
    /* the cover is already on screen; a failed gallery is not worth a message */
  }
  p.imgsLoading = false;
  return p.imgsLoaded;
}
async function loadSettings(){
  /* same reasoning as the catalogue: the contact columns arrive with
     10-shop.sql, and until then asking for them fails the whole row */
  /* Asked for in three widening steps rather than two. Dropping straight
     from "everything" to "the four original columns" on one missing column
     would take the WhatsApp number, the UPI id and the announcement down
     with it — so a column added but not yet run would quietly cost the shop
     things that were working. */
  const CORE = "free_ship_above,ship_flat,festival_date,order_by_date";
  const SHOP_COLS = CORE + ",whatsapp,upi,instagram,email,announcement,orders_paused,pause_note";
  const NEWEST = SHOP_COLS + ",coupon_note,cod_enabled";
  /* free_ship_min_qty arrives with 23-free-ship-qty.sql, so it gets a step
     of its own ahead of the rest — asked for alongside them, one missing
     column would take the WhatsApp number down with it */
  const NEWEST_QTY = NEWEST + ",free_ship_min_qty";
  let rows;
  try{
    rows = await SB.rest("shop_settings?select=" + NEWEST_QTY + "&id=eq.1&limit=1");
  }catch(err0){
  try{
    rows = await SB.rest("shop_settings?select=" + NEWEST + "&id=eq.1&limit=1");
  }catch(err){
    try{
      rows = await SB.rest("shop_settings?select=" + SHOP_COLS + ",coupon_note&id=eq.1&limit=1");
    }catch(err2){
      try{
        rows = await SB.rest("shop_settings?select=" + SHOP_COLS + "&id=eq.1&limit=1");
      }catch(err3){
        rows = await SB.rest("shop_settings?select=" + CORE + "&id=eq.1&limit=1");
      }
    }
  }
  }
  const s = Array.isArray(rows) && rows[0];
  if(!s) return;
  if(Number.isFinite(s.free_ship_above)) SHOP.freeShipAbove = s.free_ship_above;
  /* absent until 23-free-ship-qty.sql is run — the fallback in 01-shop.js
     stands until then, and place_order() is the one that decides anyway */
  if(Number.isFinite(s.free_ship_min_qty)) SHOP.freeShipMinQty = s.free_ship_min_qty;
  if(Number.isFinite(s.ship_flat))       SHOP.shipFlat      = s.ship_flat;
  if(s.festival_date) SHOP.festivalDate = s.festival_date;
  if(s.order_by_date) SHOP.orderByDate  = s.order_by_date;

  /* the contact details, which used to need a deploy to correct */
  if(s.whatsapp)  SHOP.whatsapp  = s.whatsapp;
  if(s.upi)       SHOP.upi       = s.upi;
  if(s.instagram !== undefined && s.instagram !== null) SHOP.instagram = s.instagram;
  if(s.email     !== undefined && s.email     !== null) SHOP.email     = s.email;
  paintContact();

  couponNote = s.coupon_note || "";
  /* undefined until 16-payment-mode.sql is run, and cash stays on until then */
  if(s.cod_enabled !== undefined && s.cod_enabled !== null) SHOP.codEnabled = !!s.cod_enabled;
  if(!SHOP.codEnabled && payIsCod()) payWith = "upi";
  shopPaused = !!s.orders_paused;
  shopPauseNote = s.pause_note || "";
  paintAnnouncement(s.announcement, shopPaused, shopPauseNote);
  paintCart();
  SHOP.festival = showDay(SHOP.festivalDate);
  SHOP.orderBy  = showDay(SHOP.orderByDate);
  $("#qCut").textContent =
    `Yes, if you order by ${SHOP.orderBy}. Delivery takes three to six days to most pincodes. ` +
    `We still take late orders, but express courier costs extra.`;
  countdown(); paintCart();
}

/* ── the basket on the server ──────────────────────────────
   One call replaces the lot: fewer round trips than patching
   rows, and it cannot leave half a basket behind. */
const cartRows = () => cart.map(r => ({product_id:r.id, qty:r.qty, note:r.note || ""}));
let pushTimer = null, pushing = false;
function pushCart(){
  if(!SB_ON || !signedIn() || cartFromServer) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if(pushing) return;
    pushing = true;
    try{ await SB.rpc("sync_cart", {p_items: cartRows()}); }
    catch(e){ /* the phone's copy is still right; try again on the next change */ }
    pushing = false;
  }, 700);
}
async function mergeCart(){
  cartFromServer = true;
  try{
    const rows = await SB.rpc("merge_cart", {p_items: cartRows()});
    if(Array.isArray(rows)){
      const merged = [];
      for(const r of rows){
        const src = catalogue(r.product_id);
        if(!src) continue;
        merged.push({
          id:src.id, name:src.name, price:src.price,
          qty:Math.max(1, Math.min(MAX_QTY, r.qty)),
          note:SETS.some(x => x.id === src.id) ? "designs to be picked on WhatsApp" : (r.note || "")
        });
      }
      cart = merged;
    }
  }catch(e){
  }finally{
    cartFromServer = false;
  }
  save(); paintCart();
}

/* ── profile ── */
async function loadProfile(){
  if(!signedIn()) return;
  const rows = await SB.rest("profiles?select=full_name,phone,address,city,pincode,role,created_at,lat,lng&id=eq."
                           + encodeURIComponent(SB.user().id) + "&limit=1");
  profile = (Array.isArray(rows) && rows[0]) || null;
  fillBillFromProfile();
}
async function saveProfile(p){
  if(!signedIn()) return;
  const id = SB.user().id;
  const rows = await SB.patch("profiles?id=eq." + encodeURIComponent(id), p);
  /* A profile row appears by trigger when the account is made — but an
     account made before that trigger existed has none, and PATCH matching
     no rows is not an error. Without this the save looked like it worked
     and nothing was written, which is how a location could be "attached"
     on the phone and missing from the order. */
  if(Array.isArray(rows) && rows.length === 0){
    await SB.insert("profiles", Object.assign({id, email: SB.user().email}, p),
                    {prefer: "resolution=merge-duplicates,return=minimal"});
  }
  profile = Object.assign({}, profile, p);
}
/* the bill asks for exactly what the profile already knows.
   force: put the saved values back even over something typed — used when
   they pick the saved address after starting to write a different one. */
function fillBillFromProfile(force){
  if(!profile) return;
  const map = {bName:"full_name", bPhone:"phone", bAddr:"address", bCity:"city", bPin:"pincode"};
  for(const id in map){
    const el = $("#" + id), v = profile[map[id]];
    if(el && v && (force || !el.value.trim())) el.value = v;
  }
}
/* "last seen" is what turns a customer list into something worth reading.
   One write per visit, and never in the way of anything else. */
function touchSeen(){
  if(!SB_ON || !signedIn()) return;
  SB.patch("profiles?id=eq." + encodeURIComponent(SB.user().id),
           {last_seen_at: new Date().toISOString()}).catch(() => {});
}

/* ── orders ── */
/* ── what has happened to their orders ──
   Written by a trigger when the seller moves an order along, so it is there
   whether or not the customer had the shop open at the time. */
async function loadNotifs(){
  if(!signedIn()) return [];
  return SB.rest("notifications?select=id,kind,title,body,order_id,read_at,created_at"
               + "&order=created_at.desc&limit=40");
}
/* just the count, for the dot on the account button */
let unreadCount = 0;
async function pollUnread(){
  if(!SB_ON || !signedIn()) return;
  try{
    const rows = await SB.rest("notifications?select=id&read_at=is.null&limit=30");
    unreadCount = Array.isArray(rows) ? rows.length : 0;
    paintAcctBtn();
  }catch(e){}
}

async function loadOrders(){
  return SB.rest("orders?select=id,bill_no,total,subtotal,shipping,status,created_at,status_at,"
               + "courier,tracking_id,name,phone,address,city,pincode,note,lat,lng,payment,paid_at,"
               + "order_items(name,qty,price,product_id)"
               + "&order=created_at.desc&limit=25");
}
/* Best effort, always after the WhatsApp message is on its way: the message
   is the order, this is the copy the customer can look up later. */
async function recordOrder(b, payment){
  if(!SB_ON || !signedIn() || !cart.length) return null;
  try{
    /* The second argument was being dropped on the floor: place_order
       defaults to cash, so every order — including every one sent to
       WhatsApp to be paid by UPI — was stored as cash on delivery. The
       dashboard then showed a COD chip against orders nobody was ever
       going to hand cash to. */
    const row = await SB.rpc("place_order", {
      p_bill_no: billNo,
      p_name:    b.name,
      p_phone:   b.phone,
      p_address: b.addr,
      p_city:    b.city,
      p_pincode: b.pin,
      p_note:    b.note || null,
      p_items:   cartRows(),
      p_coupon:  coupon.ok ? coupon.code : null,
      p_payment: payment === "upi" ? "upi" : "cod"
    });
    placedBill = billNo;
    $("#shHint").textContent = "Saved to your account · " + billNo;
    saveProfile({full_name:b.name, phone:b.phone, address:b.addr, city:b.city, pincode:b.pin})
      .catch(() => {});
    /* the row itself, so a payment can be started against it */
    return Array.isArray(row) ? row[0] : row;
  }catch(e){
    if(!/duplicate|unique/i.test(e.message || "")) toast("Sent. Could not save a copy to your account.");
    return null;
  }
}

/* ── signing in, and out ── */
async function afterSignIn(){
  await mergeCart();                   /* the basket first — it is why they signed in */
  await mergeWish();
  try{ await loadProfile(); }catch(e){}
  touchSeen();
  paintAcctBtn();
}
async function signOut(){
  SB.signOut();
  profile = null;
  acctView = "in"; acctNote = null; acctTab = "orders";
  paintAcct();
  paintAcctBtn();
  toast("Signed out");
  /* the basket and the hearts stay on this phone — losing them would be
     worse than keeping them */
}

/* ── boot ──
   Everything here is optional decoration on a page that already works, so
   each part fails on its own without taking the shop down with it. */
if(SB_ON){
  /* Wrapped, not passed by name. paintAcctBtn lives in the next file along, so
     the name does not exist yet at this line — only by the time the session
     actually changes, which is what the arrow waits for. Load order is the
     dependency order here; see docs/STRUCTURE.md. */
  SB.onChange(() => paintAcctBtn());
  sbPush = pushCart;
  (async () => {
    /* Two unrelated reads — one asks what the shop costs to post from, the
       other what is in it — and neither needs the other's answer. Asked one
       after the other, the sample prices written into this file stayed on
       screen for both round trips; asked together, for one. */
    await Promise.all([
      loadSettings().catch(() => {}),
      loadCatalogue().catch(() => {})
    ]);
    if(signedIn()){
      /* an older session that predates the profile picture — ask once */
      const s = SB.session();
      if(s && s.stale){ try{ await SB.whoAmI(); }catch(e){} }
      await mergeCart();
      await mergeWish();
      try{ await loadProfile(); }catch(e){}
      touchSeen();
      paintAcctBtn();
      pollUnread();
    }
    track("view_shop");
  })();

  /* ── keeping up with the dashboard ──
     A price, a stock count or a new rakhi changed in the dashboard should
     reach whoever is looking at the shop, not wait for them to reload. The
     catalogue is re-read when the tab comes back to the front, and every
     five minutes while it stays there.

     Not a websocket: this is a catalogue of a dozen rows that changes a few
     times a day. One small GET when someone returns to the tab costs less
     than holding a socket open on a phone all afternoon. */
  let lastPull = Date.now();
  const REFRESH_AFTER = 5 * 60 * 1000;

  async function refresh(){
    lastPull = Date.now();
    await Promise.all([
      loadSettings().catch(() => {}),
      loadCatalogue().catch(() => {})
    ]);
    pollUnread();
  }
  addEventListener("visibilitychange", () => {
    if(!document.hidden && Date.now() - lastPull > 30000) refresh();
  });
  setInterval(() => { if(!document.hidden) refresh(); }, REFRESH_AFTER);
}
