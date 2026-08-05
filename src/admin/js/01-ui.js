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
   Bars are HTML, not SVG.

   They used to be two SVGs — one stretched with
   preserveAspectRatio="none" so it would fill any width, and a
   second one underneath holding the labels, because stretching
   the first one squashed the text into ribbons. The label SVG
   then escaped its card and drew over the one below it. That is
   the misalignment you could see on the Insights screen.

   Divs in a grid have none of those problems: they fill the
   width by themselves, the text is real text at a real size,
   and nothing can leave the box. */
function barChart(rows, opts){
  const o = opts || {};
  const n = rows.length;
  if(!n) return `<p class="empty">${esc(o.empty || "Nothing yet.")}</p>`;

  const peak = Math.max(...rows.map(r => r.value));
  /* Round the top of the scale up to something a person would say — 40,
     not 37 — so the gridlines land on readable numbers. */
  const nice = v => {
    if(v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const step = [1, 2, 2.5, 5, 10].find(s => v <= s * mag) || 10;
    return step * mag;
  };
  const top = nice(peak);
  const fmt = o.fmt || (v => String(v));

  /* three gridlines: the top, the middle and the baseline */
  const ticks = [top, top / 2, 0];

  /* Labels every bar when they fit, otherwise roughly six across. Always
     the first and the last, so the range is readable at a glance. */
  const every = n <= 12 ? 1 : Math.ceil(n / 6);
  const showValues = n <= 12 && o.values !== false;

  return `<div class="plot">
    <div class="plot-y" aria-hidden="true">
      ${ticks.map(v => `<span>${esc(fmt(v))}</span>`).join("")}
    </div>
    <div class="plot-area">
      <div class="plot-grid" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="bars" style="--n:${n}" role="img" aria-label="${esc(o.alt || "chart")}">
        ${rows.map((r, i) => {
          const h = r.value > 0 ? Math.max(1.5, r.value / top * 100) : 0;
          return `<div class="bar-col" title="${esc(r.title || (r.label + ": " + fmt(r.value)))}">
            <div class="bar-track">
              ${showValues && r.value > 0
                ? `<span class="bar-val">${esc(fmt(r.value))}</span>` : ""}
              <div class="bar-fill${r.value > 0 ? "" : " nil"}" style="height:${h}%"></div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
    <div class="plot-x" style="--n:${n}" aria-hidden="true">
      ${rows.map((r, i) => `<span>${
        (i % every === 0 || i === n - 1) ? esc(r.short != null ? r.short : r.label) : ""
      }</span>`).join("")}
    </div>
  </div>
  ${o.peak === false || peak <= 0 ? "" : (() => {
      const best = rows.reduce((a, b) => b.value > a.value ? b : a, rows[0]);
      return `<p class="chart-note">Busiest: <b>${esc(best.label)}</b> — ${esc(fmt(best.value))}</p>`;
    })()}`;
}

/* how this number compares with the one before it */
function delta(now, before, opts){
  const o = opts || {};
  if(before === 0 && now === 0) return "";
  if(before === 0) return `<i class="up">new</i>`;
  const pct = Math.round((now - before) / before * 100);
  if(pct === 0) return `<i class="flat">same as before</i>`;
  const good = o.lowerIsBetter ? pct < 0 : pct > 0;
  return `<i class="${good ? "up" : "down"}">${pct > 0 ? "▲" : "▼"} ${
    Math.abs(pct)}% ${o.label || "vs the period before"}</i>`;
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

/* Visitors → looked → added → started a bill → sent it.

   Scaled against the widest step, not the first. "Looked" counts rakhis
   looked at, and one visitor looks at several — so views routinely exceed
   visitors, and scaling against visitors sent that bar straight out of the
   card. Each row also carries what share of the step above it survived,
   which is the number the shape is there to show. */
function funnelHTML(steps){
  const widest = Math.max(1, ...steps.map(s => s.value));
  return `<div class="funnel">${steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].value : 0;
    /* A share only means something when this step is part of the one above.
       Rakhis looked at is not — one visitor looks at several — so above
       100% it is shown as a rate per visitor instead of a nonsense 273%. */
    let note = "";
    if(i > 0 && prev > 0){
      note = s.value > prev
        ? (s.value / prev).toFixed(1).replace(/\.0$/, "") + " each"
        : pct(s.value, prev) + "%";
    }
    return `<div class="fstep">
      <span>${esc(s.label)}</span>
      <i style="width:${Math.max(1, s.value / widest * 100).toFixed(1)}%"></i>
      <b>${s.value.toLocaleString("en-IN")}${note ? `<em>${note}</em>` : ""}</b>
    </div>`;
  }).join("")}</div>`;
}

/* ── small things ── */
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

function kpi(value, label, note, hot, extra){
  return `<div class="kpi${hot ? " hot" : ""}"><b>${value}</b><span>${esc(label)}</span>${
    note ? `<i>${esc(note)}</i>` : ""}${extra || ""}</div>`;
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
