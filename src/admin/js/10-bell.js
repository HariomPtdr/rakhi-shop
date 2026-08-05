/* ══════════════════════════════════════════════════════════
   WHAT HAS HAPPENED

   An order arriving is the one thing in this shop that needs
   answering the same day, and it arrives while nobody is
   looking at the dashboard. So the bell counts what has
   happened since it was last opened, and checks again every
   half minute while the tab is in front.

   The rows are written by a database trigger, not by the shop
   page, so an order placed while this dashboard was closed is
   waiting here all the same.
   ══════════════════════════════════════════════════════════ */
let notifs = [], bellOpen = false, bellTimer = null;

const KIND_LABEL = {
  order_placed:    ["New order", "ok"],
  order_cancelled: ["Cancelled", "no"],
  order_status:    ["Update", ""]
};

async function loadBell(){
  if(!me) return;
  try{
    notifs = await SB.rest("notifications?select=id,kind,title,body,order_id,read_at,created_at"
                         + "&audience=eq.seller&order=created_at.desc&limit=40") || [];
  }catch(e){ return; }
  paintBell();
}

function paintBell(){
  const unread = notifs.filter(n => !n.read_at).length;
  const n = $("#bellN");
  n.textContent = unread > 99 ? "99+" : unread;
  n.hidden = unread === 0;
  $("#bell").classList.toggle("ring", unread > 0);
  if(bellOpen) paintBellPanel();
}

function paintBellPanel(){
  const box = $("#bellPanel");
  if(!box) return;
  box.innerHTML = !notifs.length
    ? `<p class="empty">Nothing yet. New orders and cancellations appear here the
         moment they happen, whether or not this page is open.</p>`
    : notifs.map(x => {
        const [label, cls] = KIND_LABEL[x.kind] || ["Update", ""];
        return `<button class="bell-row${x.read_at ? "" : " unread"}"
            ${x.order_id ? `data-bellorder="${esc(x.order_id)}"` : ""} type="button">
          <span class="chip ${cls}">${esc(label)}</span>
          <span class="bell-body">
            <b>${esc(x.title)}</b>
            ${x.body ? `<span>${esc(x.body)}</span>` : ""}
          </span>
          <span class="bell-when">${esc(agoText(x.created_at))}</span>
        </button>`;
      }).join("");

  box.querySelectorAll("[data-bellorder]").forEach(b => {
    b.onclick = () => { closeBell(); showOrder(b.dataset.bellorder); };
  });
}

function openBell(){
  bellOpen = true;
  $("#bellWrap").classList.add("on");
  paintBellPanel();
  /* opening it is reading it */
  const unread = notifs.filter(x => !x.read_at).map(x => x.id);
  if(unread.length){
    SB.rpc("mark_notifications_read", {p_ids: unread}).then(() => {
      const now = new Date().toISOString();
      notifs.forEach(x => { x.read_at = x.read_at || now; });
      paintBell();
    }).catch(() => {});
  }
}
function closeBell(){
  bellOpen = false;
  $("#bellWrap").classList.remove("on");
}

$("#bell").onclick = e => { e.stopPropagation(); bellOpen ? closeBell() : openBell(); };
document.addEventListener("click", e => {
  if(bellOpen && !e.target.closest("#bellWrap") && !e.target.closest("#bell")) closeBell();
});
addEventListener("keydown", e => { if(e.key === "Escape" && bellOpen) closeBell(); });

/* start once someone is actually signed in as the seller */
function startBell(){
  clearInterval(bellTimer);
  loadBell();
  bellTimer = setInterval(() => { if(!document.hidden && me) loadBell(); }, 30000);
  addEventListener("visibilitychange", () => { if(!document.hidden && me) loadBell(); });
}
