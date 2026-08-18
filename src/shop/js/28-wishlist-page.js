/* ══════════════════════════════════════════════════════════
   THE WISHLIST, AS A PAGE

   The hearts had nowhere to go but a pane inside the account
   sheet: a scrolling list of 40px thumbnails, three buttons per
   row, one rakhi at a time. A wishlist is not a receipt. It is
   a shopping list somebody comes back to with a decision to
   make, and the decision is made from the photographs — so it
   is the shop's own card, at the shop's own size, in a grid.

   Several at once is the other half of it. Six saved rakhis and
   a brother to send four of them to is six presses of Add and
   six trips through the drawer. Tick the four, press once.

   Built as a view over the shop rather than a second HTML file,
   the same way the collection, a rakhi's own page and an order
   are. The cart, the hearts, the card and the sign-in are all
   already here; a page of its own would be a second copy of
   every one of them to keep in step.
   ══════════════════════════════════════════════════════════ */
const wlEl = $("#wl");
const wishOpen = () => wlEl.classList.contains("on");

/* ── what is ticked ──
   A set of ids rather than a flag on the card, so it survives the repaint
   that follows every add, every removal and every heart pressed anywhere
   else on the page. Ids that have since left the list are dropped on the
   way in, not left to accumulate. */
let wlPick = new Set();
/* read by railCard() while it is drawing a card — declared as a function so
   the card can ask without knowing whether this file has run yet */
function wlPicked(id){ return wlPick.has(id); }

/* Everything hearted that the shop still sells, in the order it was saved —
   newest first, because toggleWish() puts the newest at the front. A rakhi
   the seller has since deleted is not drawn: there is nothing to show and
   nothing to add. */
const wlItems = () => wish.map(id => catalogue(id)).filter(Boolean);

/* The ones the buttons act on: the ticked ones, or all of them when nothing
   is ticked. "Nothing ticked" means the whole list on purpose — a bar whose
   buttons are dead until something is chosen makes somebody tick six boxes
   to say "all of them", which is what the list already said. */
function wlTargets(){
  const all = wlItems();
  const some = all.filter(p => wlPick.has(p.id));
  return some.length ? some : all;
}

/* ══════════════════════════════════════════════════════════
   DRAWING IT
   ══════════════════════════════════════════════════════════ */
function paintWish(){
  if(!wlEl) return;
  const list = wlItems();
  /* ticks belonging to rakhis that have gone */
  wlPick.forEach(id => { if(!list.some(p => p.id === id)) wlPick.delete(id); });

  const n = list.length, k = wlPick.size;

  const count = $("#wlCount");
  if(count) count.textContent = n
    ? `${n} ${n === 1 ? "item" : "items"}${k ? ` · ${k} selected` : ""}`
    : "Nothing saved yet";

  const tools = $("#wlTools");
  if(tools) tools.hidden = !n;

  /* The tick-all box has three states and all three are true statements:
     none, some (indeterminate), all. */
  const all = $("#wlAll");
  if(all){
    all.checked = !!n && k === n;
    all.indeterminate = k > 0 && k < n;
  }
  const allT = $("#wlAllT");
  if(allT) allT.textContent = k && k === n ? "Clear selection" : "Select all";

  /* Each button says what it will actually do to how many. "Add all to bag"
     while four of nine are ticked is a button lying about its own scope. */
  const bagT = $("#wlBagT"), clearT = $("#wlClearT"), shareT = $("#wlShareT");
  if(bagT)   bagT.textContent   = k ? `Add ${k} to bag` : "Add all to bag";
  if(clearT) clearT.textContent = k ? `Remove ${k}` : "Clear wishlist";
  if(shareT) shareT.textContent = k ? `Share ${k}` : "Share wishlist";

  const box = $("#wlGrid");
  if(box){
    box.innerHTML = n
      ? list.map(p => railCard(p, {pick:true, mark:true})).join("")
      /* Not "empty". Somebody who has saved nothing has not made a mistake —
         they have not been shown where the heart is yet. */
      : `<div class="wl-none">
           <span class="wl-none-i" aria-hidden="true">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
                  stroke-linecap="round" stroke-linejoin="round">
               <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z"/>
             </svg>
           </span>
           <b>Nothing saved yet</b>
           <p>Tap the heart on any rakhi and it waits for you here — on this
              phone, and on any other you sign in from.</p>
         </div>`;
  }
  if(typeof paintHearts === "function") paintHearts();
  if(typeof paintActs === "function") paintActs();
}

/* ══════════════════════════════════════════════════════════
   OPENING AND LEAVING

   The hash is what decides which view is showing — the same
   rule the collection and a rakhi's own page keep, so no two of
   them can ever both think they are open.
   ══════════════════════════════════════════════════════════ */
const WL_TITLE = "Your wishlist — Ray Art Gallery";

function openWish(fromHash){
  /* a fresh page starts with nothing ticked: a selection made ten minutes
     ago is a selection nobody can remember making */
  wlPick.clear();
  paintWish();
  wlEl.classList.add("on");
  wlEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("wl-on");
  wlEl.scrollTop = 0;
  lock();
  if(!fromHash && location.hash !== "#wishlist") location.hash = "wishlist";
  document.title = WL_TITLE;
  if(typeof track === "function") track("view_wishlist");
}

function hideWish(){
  if(typeof pfSentTo !== "undefined") pfSentTo = null;
  wlEl.classList.remove("on");
  wlEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("wl-on");
  /* leaving must never strand a dim layer belonging to a sheet opened over
     this page — the same care a rakhi's own page takes */
  if(!sheetOpen()){ $("#scrim").classList.remove("on"); unlock(); }
  document.title = "Ray Art Gallery — Handmade Rakhi";
}

function closeWish(fromHash){
  if(!wishOpen()) return;
  hideWish();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function syncWishRoute(){
  if(location.hash === "#wishlist") openWish(true);
  else if(wishOpen()) hideWish();
}
addEventListener("hashchange", syncWishRoute);

/* ══════════════════════════════════════════════════════════
   THE THINGS THE PAGE DOES
   ══════════════════════════════════════════════════════════ */

/* ── several into the basket at once ──
   Not addItem() in a loop: that toasts once per rakhi, opens the drawer once
   per rakhi and asks for a sign-in once per rakhi. This is the same rules —
   sold out, the pause, the ceiling on a line — applied in one pass, with one
   sentence at the end saying what happened. */
function wishToBag(){
  const list = wlTargets();
  if(!list.length) return;
  if(typeof ordersPaused === "function" && ordersPaused()){
    toast(shopPauseNote || "Not taking orders right now.");
    return;
  }
  if(mustSignIn("add these to your basket")) return;

  let added = 0, out = 0;
  list.forEach(p => {
    /* the seller may have marked it sold out while this page stood open */
    const live = catalogue(p.id) || p;
    if(live.stock === 0){ out++; return; }
    const row = cart.find(r => r.id === p.id);
    if(row) row.qty = Math.min(MAX_QTY, row.qty + 1);
    else cart.push({id:p.id, name:p.name, price:p.price, qty:1, note:p.note || ""});
    added++;
    track("add_cart", p.id, {qty: (cart.find(r => r.id === p.id) || {}).qty || 1});
  });

  save();
  paintCart(true);
  paintWish();

  if(!added){ toast(out === 1 ? "That one is sold out" : "Those are all sold out"); return; }
  toast(`${added} ${added === 1 ? "rakhi" : "rakhis"} in your bag`
        + (out ? ` · ${out} sold out` : ""));
  /* No drawer. A single Add does not open one either — the count on the bag,
     the bar along the bottom and this sentence have already said it, and a
     panel over the list is a panel to close before carrying on. */
}

/* ── sending it to somebody ──
   A link to this page would open the reader's *own* wishlist, which is
   empty, so what goes out is the rakhis themselves: name, price, and a link
   that opens that rakhi in the shop. One saved rakhi shares as one link,
   which is what the share sheet on a phone expects. */
function wishShare(){
  const list = wlTargets();
  if(!list.length) return;
  const base = location.origin + location.pathname;
  const line = p => `${p.name} — ${inr(p.price)}\n${base}#p/${p.id}`;
  /* Ten at most. A share sheet handed forty rakhis is a wall of text nobody
     reads, and WhatsApp truncates the URL it is pasted into. */
  const some = list.slice(0, 10);
  const rest = list.length - some.length;
  const text = list.length === 1
    ? `${line(list[0])}`
    : `My wishlist at Ray Art Gallery\n\n${some.map(line).join("\n\n")}`
      + (rest ? `\n\n…and ${rest} more: ${base}` : "");

  if(navigator.share){
    navigator.share({title:"My wishlist — Ray Art Gallery", text}).catch(() => {});
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

/* ── emptying it ──
   The one action here that cannot be undone with the button beside it, so
   it asks first. It asks once, in the browser's own words, rather than in a
   dialog of its own: a confirm over a full-screen view is the one place a
   native prompt is genuinely the clearer of the two. */
function wishClear(){
  const list = wlTargets();
  if(!list.length) return;
  const k = wlPick.size;
  const what = k ? `${k} ${k === 1 ? "rakhi" : "rakhis"}` : "everything";
  if(!confirm(`Remove ${what} from your wishlist?`)) return;
  const drop = new Set(list.map(p => p.id));
  wish = wish.filter(id => !drop.has(id));
  saveWish();
  wlPick.clear();
  drop.forEach(id => { track("wish_remove", id); pushWish(id, false); });
  paintWish();
  toast(k ? `Removed ${what}` : "Wishlist cleared");
}

/* ══════════════════════════════════════════════════════════
   WIRING
   ══════════════════════════════════════════════════════════ */
/* Opened from the profile it goes back to the profile; opened from the
   heart in the header it goes back to the shop. pfReturn is declared in
   29-profile-page.js, one file later, so this asks whether it is there —
   the wishlist works with or without an account page. */
$("#wlBack").onclick  = () => {
  if(typeof pfReturn === "function") pfReturn("wishlist", closeWish);
  else closeWish();
};
$("#wlHome").onclick  = e => { e.preventDefault(); closeWish(); };
$("#wlCart").onclick  = () => openCart();
$("#wlShare").onclick = wishShare;
$("#wlBag").onclick   = wishToBag;
$("#wlClear").onclick = wishClear;
/* Browse the collection: leave this view first, or two full-screen pages
   are on top of each other with the hash naming only one of them. */
$("#wlBrowse").onclick = e => { e.preventDefault(); hideWish(); openAll(); };

$("#wlAll").onchange = () => {
  const list = wlItems();
  if(wlPick.size === list.length) wlPick.clear();
  else list.forEach(p => wlPick.add(p.id));
  paintWish();
};

/* the ticks, delegated: the cards under them are rebuilt on
   every change, and a listener bound to a card that no longer exists is a
   button that silently stops working */
$("#wlGrid").addEventListener("change", e => {
  const box = e.target.closest("[data-wpick]");
  if(!box) return;
  const id = box.dataset.wpick;
  if(box.checked) wlPick.add(id); else wlPick.delete(id);
  /* the whole grid is not redrawn for a tick — that would throw away the
     checkbox under the finger. Only the card's own state and the bar above. */
  const card = box.closest(".rc");
  if(card) card.classList.toggle("rc-sel", box.checked);
  paintWishTools();
});
/* a tick is not a trip into the rakhi.

   Taking one off the list has no button here: the heart in the corner of the
   card is already filled, and pressing it is what put the rakhi on this page
   in the first place. 08-wishlist.js redraws the grid behind it. */
$("#wlGrid").addEventListener("click", e => {
  if(e.target.closest(".rc-pick")) e.stopPropagation();
});

/* The counts and the button words on their own, without rebuilding the
   grid. Everything paintWish() does above the cards. */
function paintWishTools(){
  const n = wlItems().length, k = wlPick.size;
  const count = $("#wlCount");
  if(count) count.textContent = `${n} ${n === 1 ? "item" : "items"}${k ? ` · ${k} selected` : ""}`;
  const all = $("#wlAll");
  if(all){ all.checked = !!n && k === n; all.indeterminate = k > 0 && k < n; }
  const allT = $("#wlAllT");
  if(allT) allT.textContent = k && k === n ? "Clear selection" : "Select all";
  const bagT = $("#wlBagT"), clearT = $("#wlClearT"), shareT = $("#wlShareT");
  if(bagT)   bagT.textContent   = k ? `Add ${k} to bag` : "Add all to bag";
  if(clearT) clearT.textContent = k ? `Remove ${k}` : "Clear wishlist";
  if(shareT) shareT.textContent = k ? `Share ${k}` : "Share wishlist";
}

/* Escape leaves, the same as everywhere else — but never while a sheet is
   standing over this page, which has its own way out. */
addEventListener("keydown", e => {
  if(e.key === "Escape" && wishOpen() && !sheetOpen()) closeWish();
});

/* the mandala, borrowed rather than written out again — see fillBrandMark */
fillBrandMark("#wlHome .brand-mk-slot");

/* Somebody may arrive on #wishlist directly — a link they sent themselves,
   or a reload with the view open. */
syncWishRoute();
