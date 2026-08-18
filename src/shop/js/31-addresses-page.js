/* ══════════════════════════════════════════════════════════
   THE ADDRESS BOOK

   An account used to hold one address, in five columns on
   profiles. That is the right number for somebody buying for
   themselves, and the wrong number for almost anybody buying a
   rakhi: it goes to a brother in another city, and next month
   to a cousin in a third. So every order after the first began
   by deleting somebody's address to type somebody else's, and
   the address on the account was only ever whichever of them
   was typed last.

   This is the book. Add as many as there are people to send to,
   label them, and mark the one the bill should fill itself in
   from. The database keeps exactly one default and copies it
   back onto profiles, so the checkout, the seller's customer
   list and everything else written before this file carry on
   reading the columns they always read.

   An order still snapshots the address it was sent to. Editing
   one here never rewrites where a parcel that has already gone
   out was going — which is what makes editing safe.
   ══════════════════════════════════════════════════════════ */
const abEl = $("#ab");
const addressesOpen = () => abEl && abEl.classList.contains("on");

let abEditing = null;    // the id being edited, "" for a new one, null for none
let abDraft   = null;    // the pin attached to whatever is being edited
let abAsking  = null;    // the id whose "are you sure" is open
let abNote    = null;
let abBusy    = false;

const AB_LABELS = ["Home", "Work", "Other"];

/* One line of reply. While a form is open it is written above the form
   rather than through a repaint: everything on that screen was typed by
   hand, and "a pincode is six digits" must not cost somebody the other four
   fields to be told. */
function abSay(text, good){
  abNote = text ? {text, good: !!good} : null;
  const form = $("#abForm");
  if(!form){ paintAddresses(); return; }

  const old = $("#abIn > .ac-msg");
  if(old) old.remove();
  if(abNote){
    form.insertAdjacentHTML("beforebegin", abNoteHtml());
    const msg = $("#abIn > .ac-msg");
    if(msg) msg.scrollIntoView({block: "nearest", behavior: "smooth"});
  }
  /* the Save button was disabled on the way in and has to come back */
  const btn = $("#abSave");
  if(btn){ btn.disabled = false; btn.textContent = abEditing ? "Save the changes" : "Save this address"; }
}

/* ══════════════════════════════════════════════════════════
   DRAWING IT
   ══════════════════════════════════════════════════════════ */
function abCard(a){
  const asking = abAsking === a.id;
  return `<article class="ab-card${a.is_default ? " def" : ""}">
    <header class="ab-h">
      <span class="ab-lab">${esc(a.label || "Home")}</span>
      ${a.is_default ? `<span class="ab-def">Default</span>` : ""}
    </header>
    <b class="ab-n">${esc(a.full_name)}</b>
    <p class="ab-a">${esc(a.address)}<br>${esc(a.city)} — ${esc(a.pincode)}</p>
    <span class="ab-ph">${esc(a.phone)}</span>
    ${a.note ? `<p class="ab-note">“${esc(a.note)}”</p>` : ""}
    ${a.lat != null ? `<a class="ab-pin" href="${esc(mapsLink(a.lat, a.lng))}"
       target="_blank" rel="noopener">A location is attached — check it</a>` : ""}

    ${asking ? `
      <div class="ab-sure">
        <b>Remove this address?</b>
        <p>Orders already sent to it keep their own copy — nothing about them
           changes. You would just have to type it again next time.</p>
        <div class="ac-c-acts">
          <button class="btn btn-ghost" data-abno="1" type="button">Keep it</button>
          <button class="btn btn-dark" data-abyes="${esc(a.id)}" type="button">Remove it</button>
        </div>
      </div>` : `
      <div class="ab-acts">
        ${a.is_default ? "" : `<button class="ab-act" data-abdef="${esc(a.id)}" type="button"
          >Make default</button>`}
        <button class="ab-act" data-abedit="${esc(a.id)}" type="button">Edit</button>
        <button class="ab-act ab-x" data-abrm="${esc(a.id)}" type="button">Remove</button>
      </div>`}
  </article>`;
}

/* ── the form ──
   The same five fields an order carries, plus the label and the courier
   instruction. The pin sits at the bottom because it is the optional half:
   an address without one is delivered every day, and an address with one is
   delivered to the right gate. */
function abForm(a){
  const isNew = !a.id;
  const lat = abDraft ? abDraft.lat : a.lat;
  const lng = abDraft ? abDraft.lng : a.lng;
  const label = a.label || "Home";

  return `<form class="ab-form" id="abForm" novalidate>
    <div class="ab-form-h">${isNew ? "A new address" : "Change this address"}</div>

    <div class="ab-labs" role="radiogroup" aria-label="What kind of address is it">
      ${AB_LABELS.map(l => `<button type="button" role="radio" data-ablab="${l}"
        aria-checked="${l === label}" class="${l === label ? "on" : ""}">${l}</button>`).join("")}
    </div>

    <div class="fg two">
      <div class="fld"><label for="abName">Name <i>*</i></label>
        <input type="text" id="abName" autocomplete="name" placeholder="Who it is going to"
               value="${esc(a.full_name || "")}"></div>
      <div class="fld"><label for="abPhone">Phone <i>*</i></label>
        <input type="tel" id="abPhone" inputmode="numeric" maxlength="10" autocomplete="tel"
               placeholder="10 digits" value="${esc(a.phone || "")}"></div>
    </div>
    <div class="fg"><div class="fld"><label for="abAddr">Address <i>*</i></label>
      <textarea id="abAddr" autocomplete="street-address"
        placeholder="House or flat, street, area">${esc(a.address || "")}</textarea></div></div>
    <div class="fg two">
      <div class="fld"><label for="abCity">City <i>*</i></label>
        <input type="text" id="abCity" autocomplete="address-level2" value="${esc(a.city || "")}"></div>
      <div class="fld"><label for="abPin">Pincode <i>*</i></label>
        <input type="tel" id="abPin" inputmode="numeric" maxlength="6" autocomplete="postal-code"
               value="${esc(a.pincode || "")}"></div>
    </div>
    <div class="fg"><div class="fld"><label for="abNoteF">Instructions for the courier</label>
      <textarea id="abNoteF" placeholder="Second floor, ring the bell twice. Or: leave it with the shop below."
        >${esc(a.note || "")}</textarea></div></div>

    <label class="ab-check">
      <input type="checkbox" id="abDef"${a.is_default || isNew && !(addrBook || []).length ? " checked" : ""}>
      <span>Fill my bills in from this one</span>
    </label>

    <div class="ac-pin">
      ${lat != null
        ? `<span class="ac-pin-on">A location is attached.
             <a href="${esc(mapsLink(lat, lng))}" target="_blank" rel="noopener">Check it</a></span>`
        : `<span class="dim">No exact location on this address yet.</span>`}
      <div class="ac-pin-acts">
        <button type="button" data-abpin="1">Use my location</button>
        <button type="button" data-abpaste="1">Paste a map link</button>
      </div>
    </div>

    <div class="ac-acts two">
      <button class="btn btn-dark" id="abSave" type="submit">${
        isNew ? "Save this address" : "Save the changes"}</button>
      <button class="btn btn-ghost" data-abcancel="1" type="button">Leave it</button>
    </div>
  </form>`;
}

function abNoteHtml(){
  if(!abNote) return "";
  return `<p class="ac-msg${abNote.good ? " good" : ""}">${esc(abNote.text)}</p>`;
}

function paintAddresses(){
  const box = $("#abIn");
  if(!box) return;

  if(!signedIn()){
    box.innerHTML = `<p class="ac-empty">Sign in to keep your addresses.</p>`;
    return;
  }
  if(!addrBook){
    box.innerHTML = `<p class="ac-empty">Loading…</p>`;
    return;
  }

  /* the form, when one is open, stands where the list would be: an address
     being typed is the whole screen's job until it is saved */
  if(abEditing != null){
    const a = abEditing ? (addrBook.find(x => x.id === abEditing) || {}) : {};
    box.innerHTML = abNoteHtml() + abForm(a);
    return;
  }

  const list = addrBook;
  box.innerHTML = abNoteHtml() + (list.length ? `
    <p class="ab-lead">The one marked default is what a bill fills itself in from.
       Every rakhi you send somewhere else is one more address here, so you
       never type it twice.</p>
    <div class="ab-list">${list.map(abCard).join("")}</div>`
  : `<p class="ac-empty">No addresses saved yet. Add one and every bill you make
       fills itself in — you will not type it again.</p>`) + `
    <button class="btn btn-dark btn-full ab-add" data-abnew="1" type="button">
      Add a new address</button>`;
}

/* ══════════════════════════════════════════════════════════
   SAVING, REMOVING, CHOOSING
   ══════════════════════════════════════════════════════════ */
async function abSubmit(){
  if(abBusy) return;
  const v = id => { const el = $("#" + id); return el ? el.value.trim() : ""; };
  const lab = $(".ab-labs .on");

  const row = {
    id:        abEditing || null,
    label:     lab ? lab.dataset.ablab : "Home",
    full_name: v("abName"),
    phone:     v("abPhone"),
    address:   v("abAddr"),
    city:      v("abCity"),
    pincode:   v("abPin"),
    note:      v("abNoteF"),
    is_default: !!($("#abDef") && $("#abDef").checked),
    lat: abDraft ? abDraft.lat : null,
    lng: abDraft ? abDraft.lng : null
  };

  if(row.full_name.length < 2)                  return abSay("Who is it going to?");
  if(!/^[6-9]\d{9}$/.test(row.phone))           return abSay("That phone number does not look right.");
  if(!row.address || !row.city)                 return abSay("Fill the address and the city.");
  if(!/^\d{6}$/.test(row.pincode))              return abSay("A pincode is six digits.");

  abBusy = true;
  const btn = $("#abSave");
  if(btn){ btn.disabled = true; btn.textContent = "Saving…"; }
  try{
    await saveAddress(row);
    abEditing = null; abDraft = null; abNote = null;
    paintAddresses();
    toast(row.id ? "Address saved" : "Address added");
    /* the checkout's picker reads the same list, so it is redrawn if it is
       standing behind this page */
    if(typeof paintAddrBox === "function") paintAddrBox();
  }catch(err){
    abSay(/function|404|schema cache/i.test(err.message || "")
      ? "This needs supabase/25-addresses.sql to be run first."
      : (err.message || "Could not save that just now."));
  }
  abBusy = false;
}

async function abRemove(id){
  if(abBusy) return;
  abBusy = true;
  try{
    await deleteAddress(id);
    abAsking = null;
    paintAddresses();
    toast("Address removed");
    if(typeof paintAddrBox === "function") paintAddrBox();
  }catch(err){
    abAsking = null;
    abSay(err.message || "Could not remove it just now.");
  }
  abBusy = false;
}

async function abMakeDefault(id){
  if(abBusy) return;
  abBusy = true;
  try{
    await setDefaultAddress(id);
    paintAddresses();
    toast("Your bills will fill in from this one");
    if(typeof paintAddrBox === "function") paintAddrBox();
  }catch(err){
    abSay(err.message || "Could not change that just now.");
  }
  abBusy = false;
}

/* ── the pin, on an address that has not been saved yet ──
   getPin() writes straight to the profile, which is the wrong place for an
   address the person is still typing. So this keeps the two numbers on the
   draft and they go in with the rest of the form.

   And it redraws the one line that changed rather than the form: a repaint
   here rebuilds every <input> from the row as the server has it, which
   throws away the four fields somebody has just typed. Attaching a location
   must not cost them their own address. */
function abPinLine(){
  const box = $(".ab-form .ac-pin > :first-child");
  if(!box || !abDraft) return;
  box.outerHTML = `<span class="ac-pin-on">A location is attached.
    <a href="${esc(mapsLink(abDraft.lat, abDraft.lng))}" target="_blank" rel="noopener">Check it</a></span>`;
}

async function abPinFromDevice(){
  try{
    const at = await askDevice();
    abDraft = {lat: at.lat, lng: at.lng};
    abPinLine();
    toast("Location attached");
  }catch(err){
    toast(err && err.message ? "Could not read it: " + err.message : pinFailure(err));
  }
}

async function abPinFromPaste(){
  let text = "";
  try{ text = await navigator.clipboard.readText(); }catch(e){}
  if(!text) text = prompt("Paste the Google Maps link, or two numbers like 22.7196, 75.8577") || "";
  const at = parseLatLng(text);
  if(!at){
    toast(/maps\.app\.goo\.gl/.test(text)
      ? "Open that short link once, then copy the long one from the address bar."
      : "That did not have a location in it.");
    return;
  }
  abDraft = at;
  abPinLine();
  toast("Location attached");
}

/* ══════════════════════════════════════════════════════════
   OPENING AND LEAVING
   ══════════════════════════════════════════════════════════ */
const AB_TITLE = "Your addresses — Ray Art Gallery";

function openAddresses(fromHash){
  if(!SB_ON) return;
  if(!signedIn()){ openAcct(); return; }

  abEditing = null; abDraft = null; abAsking = null; abNote = null;
  paintAddresses();
  abEl.classList.add("on");
  abEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("ab-on");
  abEl.scrollTop = 0;
  lock();
  if(!fromHash && location.hash !== "#addresses") location.hash = "addresses";
  document.title = AB_TITLE;

  loadAddresses().then(() => { if(addressesOpen()) paintAddresses(); })
    .catch(() => { addrBook = []; if(addressesOpen()) paintAddresses(); });
}

function hideAddresses(){
  if(typeof pfSentTo !== "undefined") pfSentTo = null;
  abEl.classList.remove("on");
  abEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("ab-on");
  if(!sheetOpen()){ $("#scrim").classList.remove("on"); unlock(); }
  document.title = "Ray Art Gallery — Handmade Rakhi";
}

function closeAddresses(fromHash){
  if(!addressesOpen()) return;
  hideAddresses();
  if(!fromHash && location.hash){
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function syncAddressRoute(){
  if(location.hash === "#addresses") openAddresses(true);
  else if(addressesOpen()) hideAddresses();
}
addEventListener("hashchange", syncAddressRoute);

/* ══════════════════════════════════════════════════════════
   WIRING
   ══════════════════════════════════════════════════════════ */
fillBrandMark("#abHome .brand-mk-slot");
$("#abCart").onclick = () => openCart();
$("#abHome").onclick = e => { e.preventDefault(); closeAddresses(); };
/* an open form is what back closes first — leaving the page with something
   half typed on it is how an address gets lost */
$("#abBack").onclick = () => {
  if(abEditing != null){ abEditing = null; abDraft = null; abNote = null; paintAddresses(); return; }
  pfReturn("addresses", closeAddresses);
};

$("#abIn").addEventListener("click", e => {
  if(e.target.closest("[data-abnew]")){
    abEditing = ""; abDraft = null; abNote = null; paintAddresses();
    const first = $("#abName"); if(first) first.focus();
    return;
  }
  const ed = e.target.closest("[data-abedit]");
  if(ed){
    abEditing = ed.dataset.abedit;
    const a = (addrBook || []).find(x => x.id === abEditing);
    abDraft = a && a.lat != null ? {lat: a.lat, lng: a.lng} : null;
    abNote = null;
    paintAddresses();
    return;
  }
  if(e.target.closest("[data-abcancel]")){
    abEditing = null; abDraft = null; abNote = null; paintAddresses(); return;
  }

  const rm = e.target.closest("[data-abrm]");
  if(rm){ abAsking = rm.dataset.abrm; paintAddresses(); return; }
  if(e.target.closest("[data-abno]")){ abAsking = null; paintAddresses(); return; }
  const yes = e.target.closest("[data-abyes]");
  if(yes){ abRemove(yes.dataset.abyes); return; }

  const df = e.target.closest("[data-abdef]");
  if(df){ abMakeDefault(df.dataset.abdef); return; }

  /* picking a label repaints only the row of labels — repainting the form
     would throw away everything typed into it so far */
  const lab = e.target.closest("[data-ablab]");
  if(lab){
    [...lab.parentElement.children].forEach(b => {
      const on = b === lab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    });
    return;
  }

  if(e.target.closest("[data-abpin]")){ abPinFromDevice(); return; }
  if(e.target.closest("[data-abpaste]")){ abPinFromPaste(); return; }
});

$("#abIn").addEventListener("submit", e => {
  e.preventDefault();
  if(e.target.id === "abForm") abSubmit();
});

syncAddressRoute();     /* #addresses on a cold load */
