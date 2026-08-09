/* ══════════════════════════════════════════════════════════
   marigold petals — thrown when something goes into the cart

   They used to drift down the page as well: sixteen of them
   turning and swaying behind everything, all the time. That is
   gone. Ambient movement behind a shop competes with the shop,
   and the whole of it was decoration nobody came for.

   What is left is the handful thrown when something is added,
   which is not background — it answers a press, it lasts a
   second, and then the canvas is empty again.
   ══════════════════════════════════════════════════════════ */
const PETAL = ["#F2A93B","#E8871E","#F6C55B","#D9642A","#EFB04A","#C94F22"];
const cv = $("#petals"), cx2 = cv.getContext("2d", {alpha:true});
let W=0, H=0, DPR=1, burst=[], running=false;

function fit(){
  DPR = Math.min(devicePixelRatio||1, 2);
  W = cv.width  = Math.floor(innerWidth  * DPR);
  H = cv.height = Math.floor(innerHeight * DPR);
}
function petal(p){
  cx2.save();
  cx2.translate(p.x, p.y); cx2.rotate(p.a);
  cx2.globalAlpha = p.o;
  cx2.fillStyle = p.c;
  cx2.beginPath();
  cx2.ellipse(0, 0, p.r*.52, p.r, 0, 0, 6.283);
  cx2.fill();
  // the pale crease down the middle of a marigold petal
  cx2.globalAlpha = p.o*.5; cx2.fillStyle = "#FFF3D6";
  cx2.beginPath(); cx2.ellipse(0, 0, p.r*.16, p.r*.72, 0, 0, 6.283); cx2.fill();
  cx2.restore();
}

/* Runs only while there is something in the air, and stops dead when there
   is not — no loop is left turning over behind an idle page. */
function frame(){
  running = true;
  cx2.clearRect(0,0,W,H);
  for(let i=burst.length-1;i>=0;i--){
    const b = burst[i];
    b.vy += .16*DPR; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.a += b.va; b.o -= .011;
    if(b.o <= 0 || b.y - b.r > H){ burst.splice(i,1); continue; }
    petal(b);
  }
  if(document.hidden || !burst.length){ running = false; cx2.clearRect(0,0,W,H); return; }
  requestAnimationFrame(frame);
}

/* thrown petals, from wherever the button was */
function throwPetals(el){
  if(reduced) return;
  if(!W) fit();
  const r = el.getBoundingClientRect();
  const ox = (r.left + r.width/2)*DPR, oy = (r.top + r.height/2)*DPR;
  for(let i=0;i<22;i++){
    const ang = -Math.PI/2 + (Math.random()-.5)*2.5, sp = (3.2+Math.random()*6.4)*DPR;
    burst.push({
      x:ox, y:oy, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp - 2.4*DPR,
      r:(4+Math.random()*5)*DPR, a:Math.random()*6.283, va:(Math.random()-.5)*.22,
      c:PETAL[(Math.random()*PETAL.length)|0], o:.95
    });
  }
  if(!running) requestAnimationFrame(frame);
}

let fitT;
addEventListener("resize", ()=>{
  clearTimeout(fitT);
  fitT = setTimeout(fit, 180);
}, {passive:true});

/* measure the page after the first paint, not during it */
requestAnimationFrame(()=>requestAnimationFrame(fit));

/* gold glow follows the pointer across a card (pointer devices only) */
if(matchMedia("(hover:hover)").matches)
document.addEventListener("pointermove", e=>{
  const c=e.target.closest(".panel"); if(!c) return;
  const r=c.getBoundingClientRect();
  c.style.setProperty("--mx", (e.clientX-r.left)+"px");
  c.style.setProperty("--my", (e.clientY-r.top)+"px");
}, {passive:true});

/* days left until Raksha Bandhan, next to the date in the hero */
function countdown(){
  const days = daysUntil(SHOP.festivalDate);
  const shut = daysUntil(SHOP.orderByDate);      // < 0 once the cutoff passes
  let txt;
  if(days > 1)       txt = shut >= 0
                            ? `${days} days left · order by ${SHOP.orderBy}`
                            : `${days} days left · express delivery only`;
  else if(days === 1) txt = "Raksha Bandhan is tomorrow";
  else if(days === 0) txt = "Raksha Bandhan is today";
  else                txt = `Raksha Bandhan · ${SHOP.festival}`;
  $("#mFest").textContent = txt;
  paintTrust();          /* the same day count, in the pills */
}
countdown();
setInterval(countdown, 60000);
/* Phones throttle timers in background tabs, so a page left open
   overnight can miss the tick. Recheck whenever it comes back. */
addEventListener("visibilitychange", ()=>{ if(!document.hidden) countdown(); });
addEventListener("focus", countdown);
