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
    </button>`;
}

const mapsLink = (lat, lng) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(lat + "," + lng);

async function getPin(){
  if(!navigator.geolocation){
    return toast("This phone cannot share a location.");
  }
  /* Geolocation is only offered on a secure page. Opened over plain http the
     call fails with a permission error, which reads as "you said no" when
     nobody was ever asked. */
  if(!window.isSecureContext){
    return toast("Locations only work on the secure (https) address.");
  }
  pinBusy = true; paintPinBox();

  const ok = async pos => {
    /* six decimals is about a tenth of a metre — more than a courier
       needs, and all the column stores */
    const lat = Number(pos.coords.latitude.toFixed(6));
    const lng = Number(pos.coords.longitude.toFixed(6));
    try{
      await saveProfile({lat, lng, located_at: new Date().toISOString()});
      toast("Location attached to your address");
    }catch(err){
      /* the real reason, not a shrug — this is the one that used to hide a
         column that did not exist behind "just now" */
      toast(err && err.message ? "Could not save it: " + err.message
                               : "Could not save that just now.");
    }
    pinBusy = false;
    paintPinBox();
  };

  const give = err => {
    pinBusy = false;
    paintPinBox();
    toast(err && err.code === 1
      ? "Location permission was refused — the address alone is fine."
      : "Could not find you just now. The address alone is fine.");
  };

  /* First ask for the accurate fix. Indoors that often just runs out of
     time, so a timeout is answered with the ordinary network-level one
     rather than treated as a refusal — a pin from the phone mast is still
     a better start for a courier than nothing. */
  navigator.geolocation.getCurrentPosition(ok, err => {
    if(err && err.code === 1) return give(err);
    navigator.geolocation.getCurrentPosition(ok, give,
      {enableHighAccuracy: false, timeout: 20000, maximumAge: 300000});
  }, {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000});
}

async function clearPin(){
  try{
    await saveProfile({lat: null, lng: null, located_at: null});
    toast("Location removed");
  }catch(e){}
  paintPinBox();
}

document.addEventListener("click", e => {
  if(e.target.closest("#pinGet")) getPin();
  if(e.target.closest("#pinOff")) clearPin();
});
