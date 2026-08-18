/* ══════════════════════════════════════════════════════════
   THE ADDRESS THEY ALREADY GAVE US

   Someone who ordered last week should not type their house
   number again to order this week. So the bill offers what the
   account already holds as a card, and keeps the five fields
   folded away.

   It used to be able to offer exactly one, because an account
   held exactly one. Now there is an address book, and the thing
   that changes here is the middle option: as well as "this one"
   and "somewhere else", there is "one of my others" — the whole
   point of keeping several is that the second one is a tap
   rather than a retype.

   "Somewhere else" is still the other half of it. A rakhi is very
   often sent to a brother in another city, not to the person
   buying it, so the blank form is one tap away and starts blank
   rather than making them delete what is there.

   The fields are still the source of truth: picking an address
   writes it into them. Nothing downstream — validation, the
   receipt, place_order — has to know this screen exists.
   ══════════════════════════════════════════════════════════ */
let addrMode = "saved";        // "saved" | "pick" | "new"
let addrPicked = null;         // the id of the one chosen from the book

/* The address the bill should offer. The chosen one if somebody has picked
   from the book, otherwise the default — and the default is also what
   profiles carries, so this still answers on a shop where 25-addresses.sql
   has not been run and the book is empty. */
function savedAddr(){
  if(!SB_ON || !signedIn()) return null;

  const book = addrBook || [];
  if(book.length){
    const one = (addrPicked && book.find(a => a.id === addrPicked)) || book.find(a => a.is_default) || book[0];
    if(one) return one;
  }

  const p = profile;
  if(!p) return null;
  const full = p.full_name && p.phone && p.address && p.city && p.pincode;
  return full ? p : null;
}

/* one saved address, as a card — the tick means "this is the one going on
   the bill", which is why the picker's unchosen rows do not wear it */
function addrCardHtml(a, chosen, id){
  return `<div class="addr-card${chosen ? "" : " plain"}"${id ? ` data-addrpick="${esc(id)}"` : ""}>
    ${chosen ? `<span class="addr-tick" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
    </span>` : ""}
    <div>
      ${a.label ? `<span class="addr-lab">${esc(a.label)}</span>` : ""}
      <b>${esc(a.full_name)}</b>
      <p>${esc(a.address)}<br>${esc(a.city)} — ${esc(a.pincode)}</p>
      <span class="addr-ph">${esc(a.phone)}</span>
    </div>
  </div>`;
}

/* whichever address is showing, written into the five fields the bill and
   place_order actually read */
function fillBillFrom(a){
  if(!a) return;
  const map = {bName:"full_name", bPhone:"phone", bAddr:"address", bCity:"city", bPin:"pincode"};
  for(const id in map){
    const el = $("#" + id);
    if(el && a[map[id]]) el.value = a[map[id]];
  }
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

  const book = addrBook || [];

  /* ── choosing from the book ── */
  if(addrMode === "pick"){
    fields.hidden = true;
    box.innerHTML = `
      <div class="addr-k">Which address?</div>
      <div class="addr-pick">
        ${book.map(a => addrCardHtml(a, a.id === saved.id, a.id)).join("")}
      </div>
      <div class="addr-alts">
        <button type="button" id="addrNew">Send it somewhere else</button>
      </div>`;
    return;
  }

  /* ── the one it is going to ── */
  if(addrMode === "saved"){
    fillBillFrom(saved);
    fields.hidden = true;
    box.innerHTML = `
      <div class="addr-k">Deliver to</div>
      ${addrCardHtml(saved, true)}
      <div class="addr-alts">
        ${book.length > 1 ? `<button type="button" id="addrPick"
          >Choose another (${book.length} saved)</button>` : ""}
        <button type="button" id="addrEdit">Change something</button>
        <button type="button" id="addrNew">Send it somewhere else</button>
      </div>`;
    return;
  }

  /* ── typing one in ── */
  fields.hidden = false;
  box.innerHTML = `
    <div class="addr-k">Deliver to</div>
    <div class="addr-alts">
      <button type="button" id="addrSaved">← Back to my saved ${
        book.length > 1 ? "addresses" : "address"}</button>
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
  if(e.target.closest("#addrPick")){ addrMode = "pick"; paintAddrBox(); return; }
  if(e.target.closest("#addrSaved")){
    addrMode = "saved";
    paintAddrBox();
    return;
  }

  /* picking one out of the book: it becomes the one on the bill for this
     order only. Which address the account fills bills in from by default is
     a decision made in the address book, not halfway through a checkout. */
  const pick = e.target.closest("[data-addrpick]");
  if(pick){
    addrPicked = pick.dataset.addrpick;
    addrMode = "saved";
    paintAddrBox();
  }
});
