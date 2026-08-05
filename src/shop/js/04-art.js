/* ══════════════════════════════════════════════════════════
   The drawing used where a photo isn't ready yet. Built to
   match the real product: floss thread, two wavy seed-bead
   bands, the charm in the middle, a tassel below.
   ══════════════════════════════════════════════════════════ */
function beadBand(y, col){
  let s = "";
  for(let r=0;r<2;r++) for(let i=0;i<7;i++){
    const x = 56 + i*4.6, dy = y + r*4.8 + (i%2 ? -1 : 1);
    s += `<circle cx="${x.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.4" fill="${col}" stroke="rgba(0,0,0,.22)" stroke-width=".55"/>`;
  }
  return s;
}
function oct(cx,cy,s){
  const c=s*.38;
  return [[cx-s+c,cy-s],[cx+s-c,cy-s],[cx+s,cy-s+c],[cx+s,cy+s-c],
          [cx+s-c,cy+s],[cx-s+c,cy+s],[cx-s,cy+s-c],[cx-s,cy-s+c]]
         .map(p=>p.map(n=>n.toFixed(1)).join(",")).join(" ");
}
function charmArt(kind, bead){
  const cx=70, cy=170, gold="#C9962F", goldD="#9A6E1C";
  if(kind==="nazar") return `
    <polygon points="${oct(cx,cy,29)}" fill="${gold}"/>
    <polygon points="${oct(cx,cy,25.5)}" fill="#FBF8EF"/>
    <ellipse cx="${cx}" cy="${cy}" rx="14.5" ry="9" fill="#fff" stroke="#16232E" stroke-width="1.3"/>
    <circle cx="${cx}" cy="${cy}" r="6.8" fill="#2AA8CE"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="#0F1E28"/>
    <circle cx="${cx-2.1}" cy="${cy-2.3}" r="1" fill="#fff" opacity=".9"/>
    ${[...Array(11)].map((_,i)=>{const a=Math.PI+(i+.5)*Math.PI/12;
      return `<circle cx="${(cx+Math.cos(a)*17).toFixed(1)}" cy="${(cy+Math.sin(a)*13).toFixed(1)}" r="1.15" fill="#16232E"/>`}).join("")}
    ${[...Array(7)].map((_,i)=>`<circle cx="${(cx-10.8+i*3.6).toFixed(1)}" cy="${cy+15}" r="1.05" fill="#C0272D" opacity=".85"/>`).join("")}`;
  if(kind==="moti") return `
    <circle cx="${cx}" cy="${cy}" r="28" fill="${gold}"/>
    <circle cx="${cx}" cy="${cy}" r="24.5" fill="#F6F1E4"/>
    ${[...Array(8)].map((_,i)=>{const a=i*Math.PI/4;
      return `<circle cx="${(cx+Math.cos(a)*14.5).toFixed(1)}" cy="${(cy+Math.sin(a)*14.5).toFixed(1)}" r="6.2" fill="${bead}" stroke="${goldD}" stroke-width=".7"/>`}).join("")}
    <circle cx="${cx}" cy="${cy}" r="8.2" fill="${bead}" stroke="${goldD}" stroke-width=".9"/>
    <circle cx="${cx-2.8}" cy="${cy-3.2}" r="2.2" fill="#fff" opacity=".75"/>`;
  if(kind==="rudraksh") return `
    <circle cx="${cx}" cy="${cy}" r="27" fill="${gold}"/>
    <circle cx="${cx}" cy="${cy}" r="23" fill="#6B3D18"/>
    ${[...Array(5)].map((_,i)=>`<path d="M${cx-19+i*9.5} ${cy-20.5} Q${cx-15+i*9.5} ${cy} ${cx-19+i*9.5} ${cy+20.5}" fill="none" stroke="#3E2109" stroke-width="1.4"/>`).join("")}
    ${[...Array(20)].map((_,i)=>{const a=i*.314, r=7+(i%4)*4.2;
      return `<circle cx="${(cx+Math.cos(a)*r).toFixed(1)}" cy="${(cy+Math.sin(a)*r).toFixed(1)}" r="1.4" fill="#40210A"/>`}).join("")}
    <circle cx="${cx}" cy="${cy}" r="23" fill="none" stroke="#3E2109" stroke-width="1.1"/>`;
  if(kind==="om") return `
    <circle cx="${cx}" cy="${cy}" r="27" fill="${gold}"/>
    <circle cx="${cx}" cy="${cy}" r="23" fill="#FBF3DF"/>
    <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="31" fill="${goldD}"
      font-family="Noto Sans Devanagari,Nirmala UI,Kohinoor Devanagari,system-ui">ॐ</text>`;
  if(kind==="swastik") return `
    <circle cx="${cx}" cy="${cy}" r="27" fill="${gold}"/>
    <circle cx="${cx}" cy="${cy}" r="23" fill="#FBF3DF"/>
    <g stroke="#C0272D" stroke-width="4.2" stroke-linecap="square" fill="none">
      <path d="M${cx-13} ${cy} H${cx+13} M${cx} ${cy-13} V${cy+13}"/>
      <path d="M${cx-13} ${cy} V${cy-9} M${cx+13} ${cy} V${cy+9} M${cx} ${cy-13} H${cx+9} M${cx} ${cy+13} H${cx-9}"/>
    </g>`;
  if(kind==="ful") return `
    ${[...Array(8)].map((_,i)=>{const a=i*Math.PI/4, px=cx+Math.cos(a)*14.5, py=cy+Math.sin(a)*14.5;
      return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="10.5" ry="7"
        transform="rotate(${i*45} ${px.toFixed(1)} ${py.toFixed(1)})" fill="${bead}" stroke="${goldD}" stroke-width=".8"/>`}).join("")}
    <circle cx="${cx}" cy="${cy}" r="10.5" fill="${gold}"/>
    <circle cx="${cx}" cy="${cy}" r="5.6" fill="#C0272D"/>`;
  if(kind==="star"){
    const p=[...Array(10)].map((_,i)=>{const a=-Math.PI/2+i*Math.PI/5, r=i%2?10.5:26;
      return `${(cx+Math.cos(a)*r).toFixed(1)},${(cy+Math.sin(a)*r).toFixed(1)}`}).join(" ");
    const q=[...Array(10)].map((_,i)=>{const a=-Math.PI/2+i*Math.PI/5, r=i%2?8:20;
      return `${(cx+Math.cos(a)*r).toFixed(1)},${(cy+Math.sin(a)*r).toFixed(1)}`}).join(" ");
    return `<polygon points="${p}" fill="${gold}"/><polygon points="${q}" fill="${bead}"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="#C0272D"/>`;
  }
  if(kind==="dil") return `
    <path d="M${cx} ${cy+21} C${cx-32} ${cy+2} ${cx-23} ${cy-25} ${cx-8.5} ${cy-18}
             C${cx-3} ${cy-15.5} ${cx} ${cy-10.5} ${cx} ${cy-10.5}
             C${cx} ${cy-10.5} ${cx+3} ${cy-15.5} ${cx+8.5} ${cy-18}
             C${cx+23} ${cy-25} ${cx+32} ${cy+2} ${cx} ${cy+21} Z" fill="${gold}"/>
    <path d="M${cx} ${cy+15} C${cx-24} ${cy} ${cx-18} ${cy-19} ${cx-6.5} ${cy-13.5}
             C${cx-2} ${cy-11.5} ${cx} ${cy-7.5} ${cx} ${cy-7.5}
             C${cx} ${cy-7.5} ${cx+2} ${cy-11.5} ${cx+6.5} ${cy-13.5}
             C${cx+18} ${cy-19} ${cx+24} ${cy} ${cx} ${cy+15} Z" fill="#C0272D"/>`;
  return "";
}
/* full=true shows the whole rakhi; otherwise it is framed on the charm */
function art(o, full){
  const t=o.thread, b=o.bead;
  const floss=(x,bow,w,op)=>
    `<path d="M${x} 16 C${x-bow} 62 ${x+bow} 98 ${x} 126" stroke="${t}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}"/>
     <path d="M${x} 214 C${x+bow} 248 ${x-bow} 280 ${x} 304" stroke="${t}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}"/>`;
  return `<svg viewBox="${full ? "0 0 140 340" : "28 104 84 142"}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${floss(70,5,11,1)}${floss(66,4,2.2,.45)}${floss(74,4,2.2,.45)}${floss(70,6,1.6,.3)}
    <path d="M70 16 C65 62 75 98 70 126" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/>
    <ellipse cx="70" cy="121" rx="8.5" ry="5" fill="${t}" stroke="rgba(0,0,0,.2)" stroke-width=".7"/>
    <ellipse cx="70" cy="219" rx="8.5" ry="5" fill="${t}" stroke="rgba(0,0,0,.2)" stroke-width=".7"/>
    ${beadBand(130,b)}${beadBand(205,b)}${charmArt(o.charm,b)}
    <g stroke="${t}" stroke-width="2.6" stroke-linecap="round" opacity=".92">
      <path d="M70 303 L60 331"/><path d="M70 303 L65.5 334"/><path d="M70 303 L71 335"/>
      <path d="M70 303 L76.5 333"/><path d="M70 303 L82 329"/>
    </g></svg>`;
}
