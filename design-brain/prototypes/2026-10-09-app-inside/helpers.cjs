const { chromium } = require("playwright"); const fs = require("fs");

const THEME = `
@font-face{font-family:'FU Display';src:url(/landing/7234ed860a9c.woff2) format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'FU Display';src:url(/landing/066710ce7ed2.woff2) format('woff2');font-weight:100 900;font-style:italic}
main h1.fx-h{font-family:'FU Display',Georgia,serif!important;font-weight:400!important;letter-spacing:-0.022em!important;color:#0E0E0C!important;line-height:1.04!important}
main h1.fx-h em{font-style:italic;color:#2A5A47}
.fx-reply{background:#F3F8F4!important;background-image:none!important;border:1px solid #DCEBE1!important;box-shadow:none!important}
.fx-reply::before,.fx-reply::after{display:none!important}
.fx-reply .fx-lbl{color:#2A5A47!important}
.fx-word{font-size:13px;font-weight:500;margin-left:6px;color:var(--ink-soft)}
.fx-done{display:flex;flex-direction:column;gap:18px;max-width:880px}
.fx-date{font-size:14px;color:var(--ink-faint);margin:0}
.fx-done h1{font-size:44px;margin:0}
.fx-sub{font-size:16px;color:var(--ink-soft);margin:0;max-width:52ch}
.fx-bar{position:relative;border-radius:22px;padding:16px 14px 14px;color:#fff;overflow:hidden;
  background:radial-gradient(60% 120% at 8% 0%,rgba(205,240,170,.28),transparent 60%),linear-gradient(160deg,#6B7B74,#56665F 55%,#4E5D57);
  box-shadow:0 18px 40px -26px rgba(14,30,22,.55)}
.fx-tag{display:inline-block;margin:0 0 12px 6px;font-size:12.5px;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.fx-cells{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.fx-cell{border-radius:16px;padding:12px 12px 10px;text-align:center;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);backdrop-filter:blur(16px)}
.fx-cell b{display:block;font-family:'FU Display',Georgia,serif;font-weight:400;font-size:34px;line-height:1.05;letter-spacing:-.02em}
.fx-cell span{display:block;margin-top:4px;font-size:13px;color:rgba(255,255,255,.9)}
.fx-cell.won b{color:#DDF8C4}
.fx-foot{font-size:14px;color:var(--ink-soft);margin:0}
.fx-ex{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint)}
.fx-line{font-size:15px;line-height:1.45;color:#fff;margin:0}
@media (max-width:700px){.fx-done h1{font-size:34px}}
`;
async function theme(p) { await p.addStyleTag({ content: THEME }); await p.evaluate(() => document.fonts.ready); }
async function common(p) {
  await p.evaluate(() => {
    const h = document.querySelector("main h1"); if (h) h.classList.add("fx-h");
    // the reply: the wash becomes the soft green R-058 asked for
    for (const e of document.querySelectorAll("main div")) { const bg = getComputedStyle(e).backgroundImage; if (bg.includes("radial-gradient") && /written by followup|edited by you/i.test(e.textContent)) { e.classList.add("fx-reply"); const l = [...e.querySelectorAll("span")].find(s => /written by followup/i.test(s.textContent)); if (l) l.classList.add("fx-lbl"); } }
    // icons get their word
    for (const bell of document.querySelectorAll('[aria-label="Notifications"]')) if (!bell.querySelector(".fx-word")) { const w = document.createElement("span"); w.className = "fx-word"; w.textContent = "Alerts"; bell.appendChild(w); bell.style.width = "auto"; bell.style.flex = "none"; bell.style.alignItems = "center"; bell.style.paddingInline = "8px"; if (getComputedStyle(bell).display !== "none") bell.style.display = "inline-flex"; }
  });
}
async function today(p) {
  await p.evaluate(() => { const h = document.querySelector("main h1"); if (h) { const n = (h.textContent.match(/\d+/) || ["15"])[0]; h.innerHTML = n + " customers <em>need you.</em>"; } });
}
async function customers(p) {
  await p.evaluate(() => {
    const REL = { "Going quiet": "Checking in", "Waiting": "Answered", "Up to date": "Answered" };
    for (const t of document.querySelectorAll('[role=tab]')) { const m = t.textContent.match(/^(.*?)\s*(\d+)$/); if (m && m[2] === "0") t.style.display = "none"; for (const [a, b] of Object.entries(REL)) if (t.textContent.startsWith(a)) t.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.includes(a)) n.textContent = n.textContent.replace(a, b); }); }
    const walk = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT); let n; while ((n = walk.nextNode())) { const t = n.textContent.trim(); if (REL[t] && n.parentElement.closest("a")) n.textContent = n.textContent.replace(t, REL[t]); }
    // desk: four columns, the channel's icon beside the name, the wait inside the state
    const isDesk = innerWidth >= 768; if (!isDesk) {
      for (const b of document.querySelectorAll('main button[aria-label="More"], main button[aria-label="Add customer"], main a[aria-label="Add customer"]')) { if (!b.querySelector(".fx-word")) { const w = document.createElement("span"); w.className = "fx-word"; w.style.color = "inherit"; w.textContent = b.getAttribute("aria-label") === "More" ? "More" : "Add"; b.appendChild(w); b.style.width = "auto"; b.style.paddingInline = "12px"; b.style.borderRadius = "99px"; } }
      return; }
    const rows = [...document.querySelectorAll("main a[href^='/leads?p=']")]; const head = rows.length ? rows[0].parentElement.firstElementChild : null;
    const cols = "44px 230px minmax(0,1fr) 190px";
    if (head) { head.style.gridTemplateColumns = cols; const c = head.children; c[2].style.display = "none"; c[4].style.display = "none"; c[1].textContent = "Customer"; }
    for (const r of rows) { r.style.gridTemplateColumns = cols; const c = r.children; const icon = c[2].querySelector("svg"); const nm = c[1].querySelector("span"); if (icon && nm && !nm.querySelector("svg")) { const ic = icon.cloneNode(true); ic.style.cssText = "display:inline-block;vertical-align:-2px;margin-left:7px;opacity:.75"; nm.appendChild(ic); } const wait = c[4].textContent.trim(); c[2].style.display = "none"; c[4].style.display = "none";
      const st = c[5]; if (st && /Needs you/.test(st.textContent) && wait && wait !== "—" && !st.querySelector(".fx-w")) { const w = document.createElement("span"); w.className = "fx-w"; w.style.cssText = "margin-left:8px;font-size:13px;color:var(--ink-faint)"; w.textContent = wait; st.appendChild(w); } }
  });
}
async function customerPage(p) {
  await p.evaluate(() => { const h = document.querySelector("main h1"); if (h) { h.style.fontSize = "26px"; } });
}
async function done(p, desk) {
  await p.evaluate((desk) => {
    const main = document.querySelector("main"); const box = main.querySelector("h1").closest("div").parentElement;
    const host = main.firstElementChild || main; const wrap = document.createElement("section"); wrap.className = "fx-done";
    wrap.innerHTML = desk ? `<p class="fx-date">Friday, October 9</p>
      <h1 class="fx-h">All done for <em>today.</em></h1>
      <p class="fx-sub">Nobody is waiting on you. FollowUp keeps following up, and tells you the moment someone needs you.</p>
      <div class="fx-bar"><span class="fx-tag">Your week with FollowUp</span>
        <div class="fx-cells"><div class="fx-cell"><b>11</b><span>answered</span></div><div class="fx-cell"><b>2</b><span>qualified</span></div><div class="fx-cell"><b>1</b><span>booked</span></div><div class="fx-cell won"><b>$9,800</b><span>won by you</span></div></div></div>
      <p class="fx-foot">Customers heard back in 12 min · 2 came back after a follow-up</p>
      <p class="fx-foot">Booked call · Priya Sharma, Sat 10:30 AM</p>
      <p class="fx-ex">Example numbers · real ones only, from this account</p>`
    : `<p class="fx-date">Friday, October 9</p><h1 class="fx-h">All done for <em>today.</em></h1>
      <div class="fx-bar" style="padding:16px 18px"><p class="fx-line">This week: <b>11 answered · 1 booked · $9,800 won by you.</b></p></div>
      <p class="fx-foot">Booked call · Priya Sharma, Sat 10:30 AM</p><p class="fx-ex">Example numbers</p>`;
    for (const a of document.querySelectorAll("nav a")) { const c = [...a.querySelectorAll("span")].pop(); if (c && /^\d+$/.test(c.textContent.trim())) c.textContent = ""; }
    main.innerHTML = ""; const pad = document.createElement("div"); pad.style.cssText = desk ? "padding:32px 40px" : "padding:84px 16px 20px"; pad.appendChild(wrap); main.appendChild(pad);
  }, desk);
}

async function simpler(p, page) {
  await p.evaluate((page) => {
    const main = document.querySelector("main"); const hide = (e) => { if (e) e.style.display = "none"; };
    const own = (sel, re) => [...main.querySelectorAll(sel)].filter(e => re.test(e.textContent.trim()) && ![...e.children].some(c => re.test(c.textContent.trim()) && c.tagName === e.tagName));
    if (page === "today") {
      own("p", /handled today/).forEach(hide);                         // the count, said again (rule 2)
      own("p", /^Based on .* message/).forEach(hide);                  // machinery (rule 5)
      own("p", /\d+ more need your OK/).forEach(hide);                // "Show 7 more" says it
    }
    if (page === "customers") {
      own("p", /^\d+ customers\.$/).forEach(hide);                     // the 4th "17" on the screen
      own("p", /\d+ of \d+ customers/).forEach(hide);
      main.querySelectorAll('button[aria-label="More"]').forEach(hide); // import, clean-up live in Settings
    }
    if (page === "customer") {
      own("p", /^Based on .* message/).forEach(hide);
      const w = [...main.querySelectorAll("p")].find(e => e.textContent.trim() === "Waiting"); if (w) hide(w.parentElement); // repeats "16 days ago"
      const h = main.querySelector("h1"); const pill = h && h.parentElement && [...h.parentElement.querySelectorAll("span")].find(s => /^Needs you$/.test(s.textContent.trim())); if (pill && document.querySelector(".fx-reply")) hide(pill.closest("span[class*='rounded-full']") || pill);
    }
  }, page);
}

async function todayOne(p, desk) {
  await p.evaluate((desk) => {
    const reply = document.querySelector(".fx-reply"); if (!reply) return;
    const grid = [...document.querySelectorAll("main div")].find(e => /grid-cols-\[minmax\(280px/.test(e.className));
    const next = document.createElement("div");
    next.style.cssText = "margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--card);font-size:14.5px";
    next.innerHTML = '<span style="color:var(--ink-soft)">Next: <b style="color:var(--ink);font-weight:600">Owen Shah</b> · 17 days</span><a style="font-weight:500;text-decoration:underline;text-underline-offset:3px" href="#">See all 15</a>';
    if (desk && grid) {
      grid.children[0].style.display = "none"; grid.style.display = "block";
      const right = grid.children[1]; right.style.display = "block"; right.style.position = "static"; right.style.maxWidth = "660px"; right.style.maxHeight = "none"; right.style.overflow = "visible";
      right.appendChild(next);
    } else {
      // phone: the open card, then one "Next" line; the other rows wait behind "See all"
      let row = reply; while (row.parentElement && row.parentElement.children.length < 3) row = row.parentElement;
      const list = row.parentElement; let after = false;
      for (const c of [...list.children]) { if (after) c.style.display = "none"; if (c === row || c.contains(reply)) after = true; }
      const col = list.closest("div.min-w-0") || list.parentElement;
      for (const e of [...col.querySelectorAll("p, button")]) if (/more need your OK|^Show \d+ more$/.test(e.textContent.trim())) e.style.display = "none";
      row.after(next);
    }
    for (const e of document.querySelectorAll("main p")) if (/handled today|^Based on .* message/.test(e.textContent.trim())) e.style.display = "none";
  }, desk);
}
async function measure(p) {
  return p.evaluate(() => { const main = document.querySelector("main"); const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const words = main.innerText.split(/\s+/).filter(Boolean).length;
    const ctl = [...main.querySelectorAll("a, button, input, select, textarea, [role=switch]")].filter(vis).length; return { words, ctl }; });
}

module.exports = { THEME, theme, common, today, customers, customerPage, done, simpler, todayOne, measure };
