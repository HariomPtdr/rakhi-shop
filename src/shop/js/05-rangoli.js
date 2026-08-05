/* ══════════════════════════════════════════════════════════
   rangoli — concentric rings of petals, the way it is drawn
   on the floor for the festival
   ══════════════════════════════════════════════════════════ */
function rangoli(col){
  const cx=200, cy=200; let g="";
  // [petals in the ring, radius, petal length]
  [[8,24,11],[12,50,12.5],[16,78,13.5],[20,106,13.5],[26,134,12.5],[34,162,11],[42,188,8]]
  .forEach(([n,rad,pl],ri)=>{
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2 + (ri%2 ? Math.PI/n : 0);
      const x=cx+Math.cos(a)*rad, y=cy+Math.sin(a)*rad;
      g+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(pl*.38).toFixed(1)}" ry="${pl}" `
       + `transform="rotate(${(a*180/Math.PI+90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    g+=`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${col}" stroke-width=".9"/>`;
  });
  g+=`<circle cx="${cx}" cy="${cy}" r="11"/>`
   + `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="${col}" stroke-width=".9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="${col}">${g}</svg>`;
}
const asBg  = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
const asSrc = svg => "data:image/svg+xml," + encodeURIComponent(svg);

/* a rangoli strip, used as the rule between sections */
function rangoliStrip(){
  let g="", n=7;
  for(let i=0;i<n;i++){
    const cx=30+i*40, r=i===3?9:(i%2?5:7);
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4;
      g+=`<circle cx="${(cx+Math.cos(a)*r).toFixed(1)}" cy="${(17+Math.sin(a)*r).toFixed(1)}" r="1.5" class="dot"/>`;
    }
    g+=`<circle cx="${cx}" cy="17" r="${r}" style="--len:${(2*Math.PI*r).toFixed(0)}"/>`;
  }
  g+=`<line x1="4" y1="17" x2="18" y2="17" style="--len:14"/><line x1="282" y1="17" x2="296" y2="17" style="--len:14"/>`;
  return `<svg viewBox="0 0 300 34" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

/* the four step icons: a thali with a diya, an address card,
   a bill, and a wrist with the rakhi tied on */
const STEP_ICONS = {
  ico1:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="16" cy="21" rx="13" ry="5.5"/><path d="M3 21c0 3 5.8 5.5 13 5.5S29 24 29 21"/>
    <path d="M12 15.5c0-2 4-3.6 4-6.5 0 2.9 4 4.5 4 6.5a4 4 0 01-8 0z" fill="currentColor" stroke="none" opacity=".85"/>
    <circle cx="8.5" cy="19" r="1.3" fill="currentColor" stroke="none"/><circle cx="23.5" cy="19" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  ico2:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="7" width="25" height="18" rx="2.5"/><path d="M3.5 11.5h25"/>
    <path d="M8 17h7M8 20.5h11"/><circle cx="23" cy="18.5" r="2.4"/></svg>`,
  ico3:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4h18v22l-3-2-3 2-3-2-3 2-3-2-3 2z"/><path d="M11.5 10h9M11.5 14.5h9M11.5 19h5"/></svg>`,
  ico4:`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9c2.8 2.4 5.9 3.6 10 3.6S23.2 11.4 26 9"/><path d="M6 23c2.8-2.4 5.9-3.6 10-3.6s7.2 1.2 10 3.6"/>
    <circle cx="16" cy="16" r="4.6" fill="currentColor" stroke="none" opacity=".9"/>
    <circle cx="16" cy="16" r="7.4"/></svg>`
};

/* a small icon of one charm, for the custom-order vocabulary */
function charmIcon(kind){
  return `<svg viewBox="38 138 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${charmArt(kind,"#FDFCF7")}</svg>`;
}
