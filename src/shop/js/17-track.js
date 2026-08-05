/* ══════════════════════════════════════════════════════════
   WHAT HAPPENED ON THE SITE

   Ten kinds of small note — a rakhi looked at, added, hearted,
   a bill started — written to your own database and nowhere
   else. No third party, no advertising id, no name or address:
   a guest is a random string kept in their own browser, and
   that is all they ever are until they sign in.

   They go up in batches every few seconds and once more when
   the tab is hidden, so a customer on 4G is never made to wait
   on a note about a page they have already left. If the send
   fails it is dropped: a missed number on a chart is not worth
   a retry queue.
   ══════════════════════════════════════════════════════════ */
const ANON_KEY = "rag_anon";

const anonId = (() => {
  try{
    let v = localStorage.getItem(ANON_KEY);
    if(!v){
      v = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "g-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, v);
    }
    return v.slice(0, 64);
  }catch(e){ return null; }
})();

let evQueue = [], evTimer = null, evSeen = {};

function track(kind, productId, meta){
  if(!SB.on || !kind) return;
  /* the same rakhi looked at twice while scrolling back is one visit */
  if(kind === "view_product" || kind === "view_shop"){
    const key = kind + ":" + (productId || "");
    const t = Date.now();
    if(evSeen[key] && t - evSeen[key] < 30000) return;
    evSeen[key] = t;
  }
  const u = SB.user();
  evQueue.push({
    user_id:    u ? u.id : null,
    anon_id:    anonId,
    kind:       kind,
    product_id: productId || null,
    meta:       meta || null
  });
  if(evQueue.length >= 12) return flushTrack();
  clearTimeout(evTimer);
  evTimer = setTimeout(flushTrack, 2500);
}

function flushTrack(){
  clearTimeout(evTimer);
  if(!SB.on || !evQueue.length) return;
  const rows = evQueue;
  evQueue = [];
  SB.insert("events", rows).catch(() => {});
}

/* a tab being hidden is the last chance to send what is waiting */
addEventListener("visibilitychange", () => { if(document.hidden) flushTrack(); });
addEventListener("pagehide", flushTrack);

/* the basket, kept where the seller can see what was left behind */
function pushWish(id, on){
  if(!SB.on || !SB.signedIn()) return;
  const u = SB.user();
  const p = on
    ? SB.insert("wishlists", {user_id: u.id, product_id: id},
                {prefer: "resolution=ignore-duplicates,return=minimal"})
    : SB.del("wishlists?user_id=eq." + encodeURIComponent(u.id)
             + "&product_id=eq." + encodeURIComponent(id));
  p.catch(() => {});           /* the phone's copy stands; sign-in merges it */
}

/* on sign-in the two lists become one, and nothing is ever dropped */
async function mergeWish(){
  if(!SB.on || !SB.signedIn()) return;
  try{
    const rows = await SB.rpc("merge_wishlist", {p_ids: wish});
    if(Array.isArray(rows)){
      wish = rows.map(r => r.product_id).filter(id => catalogue(id));
      saveWish();
      paintHearts();
    }
  }catch(e){}
}
