/* ══════════════════════════════════════════════════════════
   WISHLIST

   A heart on every card. It works signed out — the ids sit in
   this phone's storage — and follows the customer to the
   server the moment they sign in, where the shop can see it
   too: a rakhi that is hearted forty times and bought twice is
   telling you something a sales report cannot.

   Nothing here blocks. The heart fills on tap and the network
   call happens behind it; if it fails the phone's copy is
   still right and the next sign-in merges it.
   ══════════════════════════════════════════════════════════ */
const WISH_KEY = "rag_wish";

let wish = (() => {
  try{
    const v = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
    return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 200) : [];
  }catch(e){ return []; }
})();

const wished = id => wish.indexOf(id) !== -1;

function saveWish(){
  try{ localStorage.setItem(WISH_KEY, JSON.stringify(wish)); }catch(e){}
}

/* the same heart everywhere: the grid, the rail, the product page */
function heartBtn(id, big){
  const on = wished(id);
  return `<button class="heart${on ? " on" : ""}${big ? " heart-big" : ""}" data-wish="${esc(id)}"
    type="button" aria-pressed="${on}"
    aria-label="${on ? "Remove from your wishlist" : "Save to your wishlist"}">
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13Z"/>
    </svg></button>`;
}

/* Repaint the hearts in place rather than the whole grid — a card that
   redraws under the finger loses the scroll position on a phone. */
function paintHearts(){
  $$("[data-wish]").forEach(b => {
    const on = wished(b.dataset.wish);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Remove from your wishlist" : "Save to your wishlist");
  });
  const n = $("#wishN");
  if(n){ n.textContent = wish.length; n.hidden = !wish.length; }
}

function toggleWish(id){
  const p = catalogue(id);
  if(!p) return;
  /* A wishlist that only lives on one phone is a wishlist waiting to be
     lost, so this asks for an account the same way the basket does. */
  if(mustSignIn("save this rakhi")) return;
  const on = !wished(id);
  wish = on ? [id].concat(wish.filter(x => x !== id)) : wish.filter(x => x !== id);
  saveWish();
  paintHearts();
  toast(on ? "Saved to your wishlist" : "Removed from your wishlist");
  track(on ? "wish_add" : "wish_remove", id);
  pushWish(id, on);
}

/* delegated once, so every heart on every screen is already wired */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-wish]");
  if(!b) return;
  e.preventDefault();
  e.stopPropagation();          /* never let it also open the product page */
  toggleWish(b.dataset.wish);
});

/* Somebody arriving with three already saved should see three, not a blank
   heart until they press one. */
paintHearts();
