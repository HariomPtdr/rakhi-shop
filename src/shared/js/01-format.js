/* ══════════════════════════════════════════════════════════
   FORMATTING
   Money, dates and order status, written once so the shop and
   the seller dashboard can never disagree about what an order
   marked "shipped" is called or how ₹1,299 is punctuated.
   ══════════════════════════════════════════════════════════ */
const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");

const esc = s => String(s == null ? "" : s)
  .replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const two = n => String(n).padStart(2, "0");

/* 04 Aug 2026 */
const dayText = iso => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
};

/* 04 Aug, 6:41 pm — for the dashboard, where the hour matters */
const dayTimeText = iso => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("en-IN",
    {day:"2-digit", month:"short", hour:"numeric", minute:"2-digit"});
};

/* "3 days ago" reads faster than a date when you are scanning a list */
const agoText = iso => {
  const d = new Date(iso);
  if(isNaN(d)) return "";
  const s = (Date.now() - d.getTime()) / 1000;
  if(s < 60)     return "just now";
  if(s < 3600)   return Math.floor(s / 60) + " min ago";
  if(s < 86400)  return Math.floor(s / 3600) + " hr ago";
  if(s < 604800) return Math.floor(s / 86400) + (Math.floor(s / 86400) === 1 ? " day ago" : " days ago");
  return dayText(iso);
};

/* The five states an order can be in, in the order they happen.
   Kept in step with the check constraint on orders.status. */
const STATUS = {
  placed:    {label:"Placed",    cls:"",    step:0, hint:"Order received, not confirmed yet"},
  confirmed: {label:"Confirmed", cls:"ok",  step:1, hint:"Confirmed with the customer"},
  shipped:   {label:"Shipped",   cls:"ok",  step:2, hint:"Handed to the courier"},
  delivered: {label:"Delivered", cls:"out", step:3, hint:"Delivered"},
  cancelled: {label:"Cancelled", cls:"no",  step:-1, hint:"Cancelled"}
};
const STATUS_FLOW = ["placed", "confirmed", "shipped", "delivered"];
const statusChip = s => {
  const x = STATUS[s] || {cls:"", label:s || "Placed"};
  return [x.cls, x.label];
};

const plural = (n, one, many) => n === 1 ? one : (many || one + "s");

/* ── stars ──
   Drawn as one <svg> with a clip, not five glyphs, so a half star is a
   half star rather than a rounded lie. size is the height in px. */
function starsHtml(avg, size){
  const v = Math.max(0, Math.min(5, Number(avg) || 0));
  const s = size || 13;
  const star = "M8 .9 10.2 5.6 15.3 6.3 11.6 9.9 12.5 15 8 12.6 3.5 15 4.4 9.9 .7 6.3 5.8 5.6Z";
  return `<span class="stars" style="--s:${s}px" role="img" aria-label="${v.toFixed(1)} out of 5">
    <svg viewBox="0 0 80 16" aria-hidden="true">
      <defs><clipPath id="cs${s}"><rect x="0" y="0" width="${(v / 5 * 80).toFixed(2)}" height="16"/></clipPath></defs>
      <g class="star-bg">${[0,16,32,48,64].map(x =>
        `<path transform="translate(${x},0)" d="${star}"/>`).join("")}</g>
      <g class="star-fg" clip-path="url(#cs${s})">${[0,16,32,48,64].map(x =>
        `<path transform="translate(${x},0)" d="${star}"/>`).join("")}</g>
    </svg></span>`;
}
