/* ══════════════════════════════════════════════════════════
   THE ADDRESS THEY ALREADY GAVE US

   Someone who ordered last week should not type their house
   number again to order this week. If the account already has
   a full delivery address, the bill offers it as a card and
   keeps the five fields folded away.

   "Somewhere else" is the other half of it — a rakhi is very
   often sent to a brother in another city, not to the person
   buying it. So the alternative is one tap away and starts
   blank rather than making them delete what is there.

   The fields are still the source of truth: picking the saved
   address writes it into them. Nothing downstream — validation,
   the receipt, place_order — has to know this screen exists.
   ══════════════════════════════════════════════════════════ */
let addrMode = "saved";        // "saved" | "new"

/* a saved address is only worth offering if it is complete enough to send by */
function savedAddr(){
  if(!SB_ON || !signedIn() || !profile) return null;
  const p = profile;
  const full = p.full_name && p.phone && p.address && p.city && p.pincode;
  return full ? p : null;
}

function paintAddrBox(){
  const box = $("#addrBox"), fields = $("#addrFields");
  if(!box || !fields) return;

  const saved = savedAddr();
  if(!saved){                      /* nothing to offer — the plain form */
    box.innerHTML = "";
    fields.hidden = false;
    return;
  }

  if(addrMode === "saved"){
    fillBillFromProfile(true);
    fields.hidden = true;
    box.innerHTML = `
      <div class="addr-k">Deliver to</div>
      <div class="addr-card">
        <span class="addr-tick" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
        </span>
        <div>
          <b>${esc(saved.full_name)}</b>
          <p>${esc(saved.address)}<br>${esc(saved.city)} — ${esc(saved.pincode)}</p>
          <span class="addr-ph">${esc(saved.phone)}</span>
        </div>
      </div>
      <div class="addr-alts">
        <button type="button" id="addrEdit">Change something</button>
        <button type="button" id="addrNew">Send it somewhere else</button>
      </div>`;
    return;
  }

  fields.hidden = false;
  box.innerHTML = `
    <div class="addr-k">Deliver to</div>
    <div class="addr-alts">
      <button type="button" id="addrSaved">← Back to my saved address</button>
    </div>`;
}

/* ── switching ──
   "Change something" keeps what is saved and lets them correct a line of it.
   "Somewhere else" empties the fields, because a different person's address
   with someone else's pincode still in the box is how parcels go missing. */
function useNewAddress(blank){
  addrMode = "new";
  if(blank) ["bName","bPhone","bAddr","bCity","bPin"].forEach(id => {
    const el = $("#" + id);
    if(el){ el.value = ""; el.closest(".fld").classList.remove("bad"); }
  });
  paintAddrBox();
  const first = $("#bName");
  if(first) first.focus();
}

document.addEventListener("click", e => {
  if(e.target.closest("#addrNew"))   return useNewAddress(true);
  if(e.target.closest("#addrEdit"))  return useNewAddress(false);
  if(e.target.closest("#addrSaved")){
    addrMode = "saved";
    paintAddrBox();
  }
});
