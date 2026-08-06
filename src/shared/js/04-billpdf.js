/* ══════════════════════════════════════════════════════════
   THE BILL, AS A PDF

   Written by hand, using only the fonts every PDF reader
   already has built in — so there is nothing to load and both
   pages still make zero network requests. Those fonts have no
   rupee glyph, so the PDF says "Rs."; the WhatsApp text still
   uses ₹.

   Shared, because the seller needs the same piece of paper the
   customer got. Two builders would drift, and the first anyone
   would hear of it is a customer holding a bill that does not
   match the one in the dashboard.

   It takes a plain object and knows nothing about carts, forms
   or database rows:

     {billNo, date, lines:[{name, qty, price, note}],
      subtotal, discount, discountCode, shipping, total,
      to:{name, addr, city, pin, phone, note}, footer:[…]}
   ══════════════════════════════════════════════════════════ */
const PDF = {
  W: 420, H: 595, M: 34,          // A5 portrait, in points
  cw: 0.6,                        // Courier: every glyph is 0.6em wide
  /* the built-in fonts are WinAnsi — keep to characters they have */
  safe(t){
    return String(t)
      .replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"').replace(/·/g, "-").replace(/№/g, "No.")
      .replace(/[^\x20-\x7E]/g, "");
  },
  esc(t){ return t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); },
  wrap(t, chars){
    const words = this.safe(t).split(/\s+/), lines = []; let cur = "";
    for(const w of words){
      if(!cur.length) cur = w;
      else if((cur + " " + w).length <= chars) cur += " " + w;
      else { lines.push(cur); cur = w; }
    }
    if(cur.length) lines.push(cur);
    return lines.length ? lines : [""];
  }
};

function billPdfDoc(bill){
  const { W, H, M, cw } = PDF;
  const ops = [];
  let y = H - M - 6;

  const put = (t, x, size, bold) => {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${PDF.esc(PDF.safe(t))}) Tj ET`);
  };
  const wide   = (t, size, bold) => (bold ? 0.58 : cw) * size * PDF.safe(t).length;
  const right  = (t, xr, size, bold) => put(t, xr - wide(t, size, bold), size, bold);
  const centre = (t, size, bold) => put(t, (W - wide(t, size, bold)) / 2, size, bold);
  const rule   = dashed => ops.push(`${dashed ? "[2 2] 0 d" : "[] 0 d"} 0.7 w ${M} ${y.toFixed(1)} m ${W - M} ${y.toFixed(1)} l S`);
  const gap    = n => { y -= n; };

  /* columns, measured from the right edge */
  const xAmt = W - M, xRate = W - M - 58, xQty = W - M - 104, itemChars = 34;

  centre("RAY ART GALLERY", 17, true);           gap(13);
  centre("HANDMADE RAKHI - ORDER SUMMARY", 7);   gap(11);
  rule(true);                                    gap(14);
  put(`Bill No: ${bill.billNo}`, M, 8.5);
  right(`Date: ${bill.date}`, xAmt, 8.5);        gap(18);

  put("ITEM", M, 7);
  right("QTY", xQty, 7); right("RATE", xRate, 7); right("AMOUNT", xAmt, 7);
  gap(5); rule(false); gap(12);

  (bill.lines || []).forEach((r, i) => {
    const lines = PDF.wrap(`${two(i + 1)}. ${r.name}`, itemChars);
    put(lines[0], M, 8.5);
    right(String(r.qty), xQty, 8.5);
    right(inr(r.price), xRate, 8.5);
    right(inr(r.price * r.qty), xAmt, 8.5);
    for(let k = 1; k < lines.length; k++){ gap(10); put("    " + lines[k], M, 8.5); }
    if(r.note) PDF.wrap(r.note, itemChars + 4).forEach(l => { gap(10); put("    " + l, M, 7.5); });
    gap(13);
  });

  gap(1); rule(true); gap(14);
  put("Subtotal", M, 8.5);       right(inr(bill.subtotal), xAmt, 8.5);   gap(12);
  if(bill.discount){
    put(`Discount${bill.discountCode ? " (" + bill.discountCode + ")" : ""}`, M, 8.5);
    right("-" + inr(bill.discount), xAmt, 8.5);                          gap(12);
  }
  put("Delivery", M, 8.5);
  right(bill.shipping ? inr(bill.shipping) : "FREE", xAmt, 8.5);         gap(6);
  rule(false); gap(15);
  put("TOTAL PAYABLE", M, 11, true);
  right(inr(bill.total), xAmt, 11, true);                                gap(20);
  rule(true); gap(15);

  const b = bill.to || {};
  put("DELIVER TO", M, 7);                                               gap(13);
  [b.name, ...PDF.wrap(b.addr || "", 46), `${b.city || ""} ${b.pin || ""}`.trim(),
   b.phone ? `Phone: ${b.phone}` : ""]
    .filter(Boolean).forEach(l => { put(l, M, 8.5); gap(11); });
  if(b.note){ gap(4); PDF.wrap("Note: " + b.note, 46).forEach(l => { put(l, M, 8.5); gap(11); }); }

  gap(6); rule(true); gap(12);
  (bill.footer || []).forEach(l => { put(l, M, 7); gap(9); });

  /* assemble the file; everything above is ASCII, so length == bytes */
  const stream = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  ];
  let pdf = "%PDF-1.4\n";
  const at = [];
  objs.forEach((o, i) => { at.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  at.forEach(off => { pdf += String(off).padStart(10, "0") + " 00000 n \n"; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

/* the document as a File, ready to download or hand to a share sheet */
function billPdfFile(bill, name){
  const src = billPdfDoc(bill);
  const bytes = new Uint8Array(src.length);
  for(let i = 0; i < src.length; i++) bytes[i] = src.charCodeAt(i) & 0xFF;
  return new File([bytes], name, {type: "application/pdf"});
}

function savePdfFile(file){
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
