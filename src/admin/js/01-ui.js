/* ══════════════════════════════════════════════════════════
   THE PIECES EVERY SCREEN IS BUILT FROM

   Charts are hand-drawn SVG. No library: the whole dashboard
   is one file, it opens instantly on a phone at the counter,
   and there is nothing to keep up to date. Four shapes cover
   every question this shop actually asks — a day-by-day bar,
   a ranked list, a funnel, and a share-of-total split.
   ══════════════════════════════════════════════════════════ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let toastT;
function toast(m){
  const t = $("#toast");
  t.textContent = m; t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), 2400);
}

/* every screen registers itself here; the nav does the rest */
const VIEWS = {};
let currentView = "overview";
let range = 30;                     // days, shared by every screen that has one

const view = () => $("#view");
const loading = () => { view().innerHTML = `<p class="load">Loading…</p>`; };

function failed(err){
  view().innerHTML = `<div class="card"><h2>That did not load</h2>
    <p class="empty">${esc((err && err.message) || "Something went wrong.")}</p>
    <div style="text-align:center"><button class="btn btn-ghost" onclick="render()">Try again</button></div></div>`;
}

/* Signed in, but the database does not consider this account the owner.
   Shown in place of the screen rather than as a bounce back to the sign-in
   box, because the sign-in worked — it is the permission that is missing,
   and being asked to sign in again would never fix it. */
function failedPermission(who){
  view().innerHTML = `<div class="card">
    <h2>Signed in, but not as the shop's owner</h2>
    <p class="empty" style="text-align:left">
      <b>${esc(who)}</b> is signed in, and the database refused the dashboard's
      questions. That means this account's profile does not say
      <span class="mono">role = 'admin'</span> yet — it is not a password
      problem, and signing in again will not change it.</p>
    <p class="empty" style="text-align:left">
      Run this once in Supabase → SQL Editor, with this email in it, then
      reload:</p>
    <pre class="mono" style="white-space:pre-wrap; font-size:11px; line-height:1.65;
         background:rgba(255,255,255,.6); padding:12px; border-radius:var(--r-sm)">insert into public.admin_emails (email)
values (lower('${esc(who)}'))
on conflict (email) do nothing;

update public.profiles p set role = 'admin'
  from auth.users u
 where u.id = p.id and lower(u.email) = lower('${esc(who)}');</pre>
    <div class="acts" style="justify-content:center">
      <button class="btn btn-ghost btn-sm" onclick="render()">Try again</button>
      <button class="btn btn-ghost btn-sm" onclick="SB.signOut(); location.reload()">Sign out</button>
    </div></div>`;
}

/* ── the slide-in panel: one order, one customer, one product ── */
function openPanel(title, html){
  $("#panelT").textContent = title;
  $("#panelB").innerHTML = html;
  $("#panel").classList.add("on");
  $("#panel").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("on");
  document.body.style.overflow = "hidden";
}
function closePanel(){
  $("#panel").classList.remove("on");
  $("#panel").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("on");
  document.body.style.overflow = "";
}

/* ── the range picker every screen shares ── */
function rangePicker(){
  return `<div class="range" id="range">${[7, 30, 90, 365].map(d =>
    `<button type="button" data-days="${d}" aria-pressed="${range === d}">${
      d === 365 ? "1 year" : d + " days"}</button>`).join("")}</div>`;
}

/* ── charts ────────────────────────────────────────────────
   A day-by-day bar chart. Drawn in a 0–100 viewBox and
   stretched, so it fits any width without measuring anything. */
function barsSVG(rows, opts){
  const o = opts || {};
  const H = o.height || 132, W = 700, pad = 16;
  const max = Math.max(1, ...rows.map(r => r.value));
  const n = rows.length || 1;
  const gap = n > 60 ? 0.5 : n > 30 ? 1 : 2;
  const bw = Math.max(1, (W - pad * 2) / n - gap);
  const every = Math.ceil(n / 7);

  const bars = rows.map((r, i) => {
    const h = Math.max(r.value > 0 ? 2 : 0, (r.value / max) * (H - 30));
    const x = pad + i * ((W - pad * 2) / n);
    return `<rect class="bar" x="${x.toFixed(1)}" y="${(H - 18 - h).toFixed(1)}"
      width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"><title>${
      esc(r.title || (r.label + ": " + r.value))}</title></rect>`;
  }).join("");

  const labels = rows.map((r, i) => (i % every === 0 || i === n - 1)
    ? `<text class="lab" x="${(pad + i * ((W - pad * 2) / n) + bw / 2).toFixed(1)}"
         y="${H - 5}" text-anchor="middle">${esc(r.short || r.label)}</text>` : "").join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
     role="img" aria-label="${esc(o.alt || "chart")}" style="height:${H}px">
     <line class="axis" x1="${pad}" y1="${H - 18}" x2="${W - pad}" y2="${H - 18}"/>
     ${bars}</svg>
     <svg class="chart" viewBox="0 0 ${W} 14" style="height:14px" aria-hidden="true">${labels}</svg>`;
}

/* A ranked list. Reads faster than a pie for "which is biggest" —
   which is the only question anyone asks of one. */
function hbars(rows, opts){
  const o = opts || {};
  const max = Math.max(1, ...rows.map(r => r.value));
  if(!rows.length) return `<p class="empty">${esc(o.empty || "Nothing yet.")}</p>`;
  return `<div class="hbars">${rows.map(r => `
    <div class="hbar">
      <span class="hbar-n">${esc(r.label)}</span>
      <span class="hbar-v">${esc(r.text != null ? r.text : r.value)}</span>
      <span class="hbar-t${o.alt ? " alt" : ""}"><i style="width:${(r.value / max * 100).toFixed(1)}%"></i></span>
    </div>`).join("")}</div>`;
}

/* Visitors → looked → added → started a bill → sent it. Each bar is a
   share of the *first* step, so the drop-off is the thing you see. */
function funnelHTML(steps){
  const top = Math.max(1, steps[0].value);
  return `<div class="funnel">${steps.map(s => `
    <div class="fstep">
      <span>${esc(s.label)}</span>
      <i style="width:${Math.max(1, s.value / top * 100).toFixed(1)}%"></i>
      <b>${s.value.toLocaleString("en-IN")}</b>
    </div>`).join("")}</div>`;
}

/* ── small things ── */
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

function kpi(value, label, note, hot){
  return `<div class="kpi${hot ? " hot" : ""}"><b>${value}</b><span>${esc(label)}</span>${
    note ? `<i>${esc(note)}</i>` : ""}</div>`;
}

function statusChipHTML(s){
  const [cls, label] = statusChip(s);
  return `<span class="chip ${cls}">${esc(label)}</span>`;
}

const waLink = (phone, text) =>
  "https://wa.me/91" + String(phone || "").replace(/\D/g, "").slice(-10)
  + "?text=" + encodeURIComponent(text);

/* the product photo, or the drawing the shop shows in its place */
function picHTML(p){
  if(p.image_path) return `<span class="pic"><img src="${esc(SB.photoUrl(p.image_path))}" alt=""></span>`;
  return `<span class="pic"><svg viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="8" fill="none" stroke="#a8842f" stroke-width="1.5"/>
    <circle cx="20" cy="20" r="2.6" fill="#a8842f"/></svg></span>`;
}

/* Export what is on screen. A shop's records should never be locked
   inside someone else's dashboard. */
function downloadCSV(name, rows){
  if(!rows.length) return toast("Nothing to export");
  const cols = Object.keys(rows[0]);
  const cell = v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [cols.join(",")]
    .concat(rows.map(r => cols.map(c => cell(r[c])).join(",")))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Downloaded " + name);
}

$("#panelX").onclick = closePanel;
$("#scrim").onclick  = closePanel;
addEventListener("keydown", e => { if(e.key === "Escape") closePanel(); });
