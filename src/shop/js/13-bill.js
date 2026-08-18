/* ══════════════════════════════════════════════════════════
   bill
   ══════════════════════════════════════════════════════════ */
let billNo="";
function makeBillNo(){
  const d=new Date();
  const ymd=String(d.getFullYear()).slice(2)+two(d.getMonth()+1)+two(d.getDate());
  let seq=1;
  try{
    const k="rag_seq_"+ymd;
    seq=(parseInt(localStorage.getItem(k)||"0",10)||0)+1;
    localStorage.setItem(k,String(seq));
  }catch(e){}
  /* The counter lives on the customer's own phone, so on its own it would
     hand the same number to every customer ordering that day. A short
     random tail keeps each bill unique in your WhatsApp. */
  const tail = Math.floor(Math.random()*1296).toString(36).toUpperCase().padStart(2,"0");
  return `${SHOP.billPrefix}-${ymd}-${two(seq)}${tail}`;
}
let billAsText = "";     // the bill in words, for a question about it
const today=()=>new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

const F={
  bName: v=>v.trim().length>1,
  bPhone:v=>/^[6-9]\d{9}$/.test(v.trim()),
  bAddr: v=>v.trim().length>7,
  bCity: v=>v.trim().length>1,
  bPin:  v=>/^\d{6}$/.test(v.trim())
};
function ok(id, mark){
  const el=$("#"+id), good=F[id](el.value);
  if(mark) el.closest(".fld").classList.toggle("bad", !good);
  return good;
}
Object.keys(F).forEach(id=>{
  const el=$("#"+id);
  el.addEventListener("input",()=>{
    if(el.closest(".fld").classList.contains("bad")) ok(id,true);
    paintBill();
  });
});
$("#bNote").addEventListener("input", paintBill);

function paintBill(){
  /* settled before anything is drawn: the receipt line says how it is being
     paid for, and it was being written before the choice had been checked
     against what the shop actually offers */
  settlePayWith();
  const b={ name:$("#bName").value.trim(), phone:$("#bPhone").value.trim(),
            addr:$("#bAddr").value.trim(), city:$("#bCity").value.trim(),
            pin:$("#bPin").value.trim(),   note:$("#bNote").value.trim() };
  const s = shipNow();
  const d = couponDiscount();
  const rows=cart.map((r,i)=>`
    <tr><td>${two(i+1)}. ${esc(r.name)}${r.note?`<br><span style="color:#8f8b82">${esc(r.note)}</span>`:""}</td>
    <td>${r.qty}</td><td>${inr(r.price)}</td><td>${inr(r.price*r.qty)}</td></tr>`).join("");

  $("#bill").innerHTML=`
    <div class="bill-h"><b>Ray Art Gallery</b><span>Handmade Rakhi · Order Summary</span></div>
    <div class="bill-meta"><div>Bill No: ${billNo}</div><div>Date: ${today()}</div></div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3">Subtotal</td><td>${inr(sub())}</td></tr>
        ${d ? `<tr><td colspan="3">Discount (${esc(coupon.code)})</td><td>− ${inr(d)}</td></tr>` : ""}
        <tr><td colspan="3">Delivery${s===0?" (free)":""}</td><td>${s===0?"₹0":inr(s)}</td></tr>
        <tr class="gt"><td colspan="3">Total payable</td><td>${inr(billTotal())}</td></tr>
      </tfoot>
    </table>
    <div class="bill-to"><b>Deliver to</b>${esc(b.name||"—")}
${esc(b.addr||"—")}
${esc(b.city||"—")} ${esc(b.pin||"")}
Phone: ${esc(b.phone||"—")}${b.note?`\n\nNote: ${esc(b.note)}`:""}</div>
    <div class="bill-note">${payIsCod()
        ? "Payment — cash on delivery, to the courier."
        : "Payment — online: UPI, card, wallet or netbanking."}<br>
      An order summary, not a tax invoice. Amounts in INR.</div>`;

  $("#shTot").textContent = inr(billTotal());
  paintCouponBox();
  paintAddrBox();
  /* The book is what the picker is made of, and the bill is often the first
     screen of the visit to want it. Fetched once and kept, so this costs
     nothing on the second opening — and the box is redrawn when it lands
     rather than made to wait for it. */
  if(typeof loadAddresses === "function"){
    loadAddresses().then(() => { if(isOn("#billModal")) paintAddrBox(); }).catch(() => {});
  }
  paintPinBox();
  paintPayBox();
  paintPayAction();

  /* Not a wa.me link any more — the button places the order and opens the
     payment sheet. The message is kept for the "message us" link on the
     confirmation, where a question is the point rather than a payment. */
  const lines = cart.map((r, i) =>
    `${two(i + 1)}. ${r.name}${r.note ? ` (${r.note})` : ""}\n    ${r.qty} x ${inr(r.price)} = ${inr(r.price * r.qty)}`).join("\n");
  billAsText =
`*RAY ART GALLERY — ORDER*
Bill No: ${billNo}
Date: ${today()}
--------------------------------
${lines}
--------------------------------
Subtotal: ${inr(sub())}${d ? `\nDiscount (${coupon.code}): -${inr(d)}` : ""}
Delivery: ${s === 0 ? "FREE" : inr(s)}
*TOTAL: ${inr(billTotal())}*${payIsCod() ? "\nPayment: CASH ON DELIVERY" : "\nPayment: PAID ONLINE"}
--------------------------------
*DELIVER TO*
Name: ${b.name || "-"}
Phone: ${b.phone || "-"}
Address: ${b.addr || "-"}
City: ${b.city || "-"}
Pincode: ${b.pin || "-"}${b.note ? `\nNote: ${b.note}` : ""}`;
}
