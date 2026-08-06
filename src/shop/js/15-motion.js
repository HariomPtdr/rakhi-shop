/* ══════════════════════════════════════════════════════════
   marigold petals — they drift down the page, and a handful
   are thrown whenever something goes into the cart
   ══════════════════════════════════════════════════════════ */
const PETAL = ["#F2A93B","#E8871E","#F6C55B","#D9642A","#EFB04A","#C94F22"];
const cv = $("#petals"), cx2 = cv.getContext("2d", {alpha:true});
let W=0, H=0, DPR=1, drift=[], burst=[], running=false;

function fit(){
  DPR = Math.min(devicePixelRatio||1, 2);
  W = cv.width  = Math.floor(innerWidth  * DPR);
  H = cv.height = Math.floor(innerHeight * DPR);
}
function seedDrift(){
  drift = [];
  const n = innerWidth < 700 ? 5 : 16;
  for(let i=0;i<n;i++) drift.push({
    x:Math.random()*W, y:Math.random()*H,
    r:(4.5+Math.random()*5)*DPR, a:Math.random()*6.283,
    va:(Math.random()-.5)*.018, vy:(.16+Math.random()*.26)*DPR,
    sw:Math.random()*6.283, sws:.006+Math.random()*.008,
    amp:(8+Math.random()*16)*DPR, c:PETAL[i%PETAL.length],
    o:(innerWidth<700 ? .13 : .26)+Math.random()*.22
  });
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
/* On a product page the canvas is lifted above it so the celebration is
   visible, and the decorative drift is left out — over a solid page it
   would read as clutter, not atmosphere. */
const overProduct = () => document.body.classList.contains("pv-on");

function frame(){
  running = true;
  cx2.clearRect(0,0,W,H);

  for(const p of drift){
    if(animateDrift){
      p.y += p.vy; p.sw += p.sws; p.a += p.va;
      p.x += Math.cos(p.sw) * p.amp * .012;
      if(p.y - p.r > H){ p.y = -p.r*2; p.x = Math.random()*W; }
    }
    if(!overProduct()) petal(p);
  }
  for(let i=burst.length-1;i>=0;i--){
    const b = burst[i];
    b.vy += .16*DPR; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.a += b.va; b.o -= .011;
    if(b.o <= 0 || b.y - b.r > H){ burst.splice(i,1); continue; }
    petal(b);
  }
  if(document.hidden){ running = false; return; }
  if(animateDrift || burst.length) requestAnimationFrame(frame);
  else { running = false; paintStill(); }
}
/* thrown petals, from wherever the button was */
function throwPetals(el){
  if(reduced) return;
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
/* A phone should not run an animation loop for decoration — it costs
   battery for nothing. There the petals are painted once and left still;
   the celebration burst still animates, because it is short. */
const animateDrift = !reduced && matchMedia("(min-width:900px) and (hover:hover)").matches;
function paintStill(){
  cx2.clearRect(0,0,W,H);
  if(overProduct()) return;
  for(const p of drift) petal(p);
}

/* Sizing the canvas reads innerWidth, which forces a layout. Doing it during
   the first script run made the browser lay out twice; deferring it past the
   first paint reuses the layout it was going to do anyway. */
function startPetals(){
  fit(); seedDrift();
  if(animateDrift){
    requestAnimationFrame(frame);
    addEventListener("visibilitychange", ()=>{ if(!document.hidden && !running) requestAnimationFrame(frame); });
  }else{
    paintStill();
  }
}
let fitT;
addEventListener("resize", ()=>{
  clearTimeout(fitT);
  fitT = setTimeout(()=>{ fit(); seedDrift(); if(!animateDrift) paintStill(); }, 180);
}, {passive:true});

/* the diya below the page burns brighter as you get into the collection */
const collEl = document.getElementById("collection");
new IntersectionObserver(es=>{
  es.forEach(en=>document.body.classList.toggle("lit", en.isIntersecting || scrollY > 400));
},{rootMargin:"-30% 0px"}).observe(collEl);

/* The scroll-progress bar is gone, and with it a scroll listener, a resize
   listener, a ResizeObserver on the body and a rAF on every scroll frame.
   Nothing on a phone is cheaper than work that is not done. */

/* measure the page after the first paint, not during it */
requestAnimationFrame(()=>requestAnimationFrame(startPetals));

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
