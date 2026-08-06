/* ══════════════════════════════════════════════════════════
   WHERE TO ACTUALLY DELIVER

   An Indian address is often written for someone who already
   knows the area — "near the water tank, behind the school". A
   courier does not know the area. So this offers, optionally, to
   attach the exact spot.

   It uses the browser's own geolocation, which asks the person
   first and cannot be taken without them agreeing. No map is
   embedded and no key is needed: nothing from Google runs on
   this page, so nobody's address is sent anywhere until the
   shop chooses to open the link on its own screen.

   Entirely optional. The address alone has always been enough
   and still is.
   ══════════════════════════════════════════════════════════ */
let pinBusy = false;

const hasPin = () => !!(profile && profile.lat != null && profile.lng != null);

function paintPinBox(){
  const box = $("#pinBox");
  if(!box) return;
  if(!SB_ON || !signedIn()){ box.innerHTML = ""; return; }

  if(hasPin()){
    const url = mapsLink(profile.lat, profile.lng);
    box.innerHTML = `
      <div class="pin-on">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>
        </svg>
        <div>
          <b>Exact location attached</b>
          <span>The courier gets a pin as well as the address.</span>
        </div>
        <a href="${esc(url)}" target="_blank" rel="noopener">Check</a>
        <button type="button" id="pinOff">Remove</button>
      </div>`;
    return;
  }

  box.innerHTML = `
    <button class="pin-ask" type="button" id="pinGet"${pinBusy ? " disabled" : ""}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>
      </svg>
      <span><b>${pinBusy ? "Finding you…" : "Attach my exact location"}</b>
        <i>Optional. Helps the courier find you in a lane a map cannot name.</i></span>
    </button>
    <button class="pin-paste" type="button" id="pinPaste">or paste a Google Maps link</button>`;
}

const mapsLink = (lat, lng) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(lat + "," + lng);

async function getPin(){
  pinBusy = true; paintPinBox();
  try{
    const at = await askDevice();
    await saveProfile({lat: at.lat, lng: at.lng, located_at: new Date().toISOString()});
    toast("Location attached to your address");
  }catch(err){
    /* the real reason, not a shrug — a refusal, a timeout and an http page
       are three different problems with three different fixes */
    toast(err && err.message ? "Could not save it: " + err.message : pinFailure(err));
  }
  pinBusy = false;
  paintPinBox();
}

/* ── a place, out of whatever they pasted ──
   The browser's own geolocation is refused, blocked or simply times out
   often enough that "attach my location" cannot be the only way to do it.
   Everyone in India already knows how to send a Google Maps link, so this
   reads one — or a bare "22.7196, 75.8577" — and takes the two numbers
   out of it. Short maps.app.goo.gl links cannot be followed from a page
   (the browser is not allowed to read the redirect), so those are turned
   away with the one instruction that fixes it. */
function parseLatLng(text){
  const s = String(text || "").trim();
  if(!s) return null;

  const pairs = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,       // …/@22.7196,75.8577,17z
    /[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,  // ?q=22.7196,75.8577
    /[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?ll=…
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,      // the place-page form
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/   // typed by hand
  ];
  for(const re of pairs){
    const m = s.match(re);
    if(m){
      const lat = Number(m[1]), lng = Number(m[2]);
      if(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return {lat, lng};
    }
  }
  return null;
}

/* one place both journeys end up: ask the phone, and hand back the answer */
function askDevice(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation) return reject({code: 0});
    if(!window.isSecureContext) return reject({code: -1});
    const ok = pos => resolve({
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6))
    });
    /* the accurate fix first; a timeout indoors is answered with the
       network-level one rather than treated as a refusal */
    navigator.geolocation.getCurrentPosition(ok, err => {
      if(err && err.code === 1) return reject(err);
      navigator.geolocation.getCurrentPosition(ok, reject,
        {enableHighAccuracy: false, timeout: 20000, maximumAge: 300000});
    }, {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000});
  });
}

function pinFailure(err){
  const code = err && err.code;
  if(code === -1) return "Locations only work on the secure (https) address.";
  if(code === 0)  return "This browser cannot share a location — paste a map link instead.";
  if(code === 1)  return "Location permission was refused. Paste a map link instead.";
  if(code === 2)  return "Your phone could not fix a position. Paste a map link instead.";
  if(code === 3)  return "That took too long. Paste a map link instead.";
  return "Could not find you just now. Paste a map link instead.";
}

/* ── the pin on one order ──
   The account's saved location is where they live. A rakhi is very often
   sent somewhere else, so an order carries its own. */
async function pinThisOrder(id){
  toast("Finding you…");
  try{
    const at = await askDevice();
    await SB.rpc("set_order_pin", {p_order: id, p_lat: at.lat, p_lng: at.lng});
    acctOrders = null;
    toast("Location attached to this order");
    paintAcct(); loadAcctData();
  }catch(err){
    toast(err && err.message ? err.message : pinFailure(err));
  }
}

async function pastePinFor(id){
  const text = prompt("Open the spot in Google Maps, copy the link from the address bar, "
                    + "and paste it here.\n\nA plain \"22.7196, 75.8577\" works too.");
  if(text === null) return;
  const at = parseLatLng(text);
  if(!at){
    return toast(/goo\.gl|maps\.app/i.test(text)
      ? "Short links cannot be read here — open it, then copy the full link."
      : "No location in that. Paste the full Google Maps link.");
  }
  try{
    await SB.rpc("set_order_pin", {p_order: id, p_lat: at.lat, p_lng: at.lng});
    acctOrders = null;
    toast("Location attached to this order");
    paintAcct(); loadAcctData();
  }catch(err){
    toast(/function|404|schema cache/i.test(err.message || "")
      ? "This needs supabase/14-address.sql to be run first."
      : (err.message || "Could not save that."));
  }
}

async function clearPin(){
  try{
    await saveProfile({lat: null, lng: null, located_at: null});
    toast("Location removed");
  }catch(e){}
  paintPinBox();
}

/* the same paste, for the address on the profile rather than one order */
async function pastePinProfile(){
  const text = prompt("Open the spot in Google Maps, copy the link from the address bar, "
                    + "and paste it here.\n\nA plain \"22.7196, 75.8577\" works too.");
  if(text === null) return;
  const at = parseLatLng(text);
  if(!at){
    return toast(/goo\.gl|maps\.app/i.test(text)
      ? "Short links cannot be read here — open it, then copy the full link."
      : "No location in that. Paste the full Google Maps link.");
  }
  try{
    await saveProfile({lat: at.lat, lng: at.lng, located_at: new Date().toISOString()});
    toast("Location attached to your address");
  }catch(err){
    toast(err && err.message ? "Could not save it: " + err.message : "Could not save that.");
  }
  paintPinBox();
}

document.addEventListener("click", e => {
  if(e.target.closest("#pinGet"))   getPin();
  if(e.target.closest("#pinPaste")) pastePinProfile();
  if(e.target.closest("#pinOff"))   clearPin();
});
