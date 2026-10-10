// The app in FollowUp's colours, with an interface that leans toward Wispr Flow's calm (A-211).
// Drawn on the real local app: the shell, Today, Customers, Results and Settings, desk 1280 and phone 390.
// usage: node draw2.cjs <scratchpad> <outdir>
const { chromium } = require("playwright"); const fs = require("fs");
const H = require("./helpers.cjs") /* the shared helpers from draw-on-the-app.cjs */;
const S = process.argv[2], OUT = process.argv[3], BASE = "http://localhost:3000";

const SHELL = `
:root { --fx-frame: #F2F1ED; --fx-soft: #F6F5F2; --fx-on: #E7E6E1; --fx-green: #2A5A47 }
/* desk: the sidebar sits on a quiet frame, the page is one white sheet */
@media (min-width: 1024px) {
  .theme-auto { background: var(--fx-frame) !important }
  aside { background: transparent !important; border: 0 !important }
  main.flex-1 { padding: 10px 10px 10px 0 !important }
  main > .app-frame { max-width: none !important; margin: 0 !important; background: #fff; border: 1px solid rgba(14,14,12,.07); border-radius: 18px;
    min-height: calc(100vh - 20px); padding: 44px 64px 56px !important }
  main > .app-frame > * { max-width: 920px }
}
aside a { border-color: transparent !important; box-shadow: none !important; background: transparent !important }
aside a.fx-on { background: var(--fx-on) !important; color: var(--ink) !important }
aside input { background: #fff !important }
.fx-setup { margin: 0 0 12px; padding: 12px 12px 10px; border-radius: 14px; background: #fff; border: 1px solid rgba(14,14,12,.07); font-size: 13px }
.fx-setup-h { display: flex; justify-content: space-between; align-items: baseline }
.fx-setup-h b { font-weight: 600 } .fx-setup-h span { color: var(--ink-faint); font-size: 12px }
.fx-prog { display: block; height: 4px; border-radius: 9px; background: #ECEBE7; margin: 9px 0 8px; overflow: hidden }
.fx-prog em { display: block; height: 100%; border-radius: 9px; background: var(--fx-green) }
.fx-setup ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px }
.fx-setup li { display: flex; gap: 8px; align-items: center; color: var(--ink-soft) }
.fx-setup li::before { content: ""; width: 13px; height: 13px; border-radius: 99px; box-shadow: inset 0 0 0 1.5px #C9C7C1; flex: none }
.fx-setup li.ok { color: var(--ink-faint); text-decoration: line-through; text-decoration-color: rgba(14,14,12,.25) }
.fx-setup li.ok::before { box-shadow: none; background: var(--fx-green) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/11px no-repeat }
/* titles: the homepage's display face */
main h1.fx-h { font-size: 44px !important }
@media (max-width: 700px) { main h1.fx-h { font-size: 34px !important } }
/* text tabs, underlined (they already are); empty ones hidden */
[role=tablist] { border-bottom-color: rgba(14,14,12,.08) !important }
/* Customers: no table chrome; rows grouped by day */
.fx-list { border: 0 !important; background: transparent !important; border-radius: 0 !important; overflow: visible !important }
.fx-list > a { border-color: transparent !important; border-radius: 12px; position: relative }
.fx-list > a:hover, .fx-list > a.fx-hover { background: var(--fx-soft) !important }
.fx-day { font: 500 11px/1 ui-monospace, "IBM Plex Mono", monospace; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-faint); padding: 22px 12px 8px; display: block }
.fx-day.fx-needs::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 9px; background: #c96a1b; margin-right: 8px; vertical-align: 1px }
.fx-acts { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); display: none; gap: 6px; align-items: center }
.fx-list > a:hover .fx-acts, .fx-list > a.fx-hover .fx-acts { display: inline-flex }
.fx-acts b { font-weight: 500; font-size: 13.5px; padding: 6px 12px; border-radius: 99px; background: #fff; box-shadow: inset 0 0 0 1px rgba(14,14,12,.12) }
.fx-acts b:first-child { background: #0E0E0C; color: #fff; box-shadow: none }
/* Results */
.fx-res { display: grid; gap: 26px }
.fx-eye { font: 500 11px/1 ui-monospace, "IBM Plex Mono", monospace; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-faint); margin: 0 }
.fx-res h1 { margin: 10px 0 10px }
.fx-res .fx-sub { margin: 0; color: var(--ink-soft); font-size: 15.5px; max-width: 60ch }
.fx-sun { border-radius: 20px; padding: 14px; background: linear-gradient(180deg, rgba(255,251,244,.42), rgba(255,250,242,.30)), url(/landing/d5dc60f92bca.jpg) center 62% / cover no-repeat;
  box-shadow: 0 0 0 1px rgba(14,14,12,.06), 0 24px 48px -30px rgba(60,40,20,.55) }
.fx-sun .fx-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px }
.fx-sun .fx-cell { border-radius: 14px; padding: 14px 16px 12px; background: rgba(255,255,255,.78); text-align: left; backdrop-filter: none }
.fx-sun .fx-cell b { display: block; font-family: 'FU Display', Georgia, serif; font-weight: 400; font-size: 40px; line-height: 1; letter-spacing: -.02em; color: #0E0E0C }
.fx-sun .fx-cell span { display: block; margin-top: 6px; font-size: 13.5px; color: #3E3D39 }
.fx-sun .fx-cell small { display: block; margin-top: 2px; font-size: 12.5px; color: #6B6A65 }
.fx-sun .fx-cell.won b { color: #1F6B45 }
.fx-two { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 22px; align-items: start }
.fx-card { border-radius: 16px; background: var(--fx-soft); padding: 18px 18px 14px }
.fx-card h2 { margin: 0 0 14px; font-size: 14.5px; font-weight: 600 }
.fx-bars { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; align-items: end; height: 150px }
.fx-bars div { display: grid; justify-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-faint) }
.fx-bars i { display: block; width: 18px; border-radius: 6px 6px 3px 3px; background: #0E0E0C; min-height: 3px }
.fx-bars i.zero { background: #DAD8D2 }
.fx-bars b { font-weight: 500; color: var(--ink-soft) }
.fx-else { list-style: none; margin: 0; padding: 0 }
.fx-else li { display: flex; justify-content: space-between; padding: 10px 2px; border-bottom: 1px solid rgba(14,14,12,.07); font-size: 14.5px; color: var(--ink-soft) }
.fx-else li b { font-weight: 500; color: var(--ink) }
@media (max-width: 700px) { .fx-sun .fx-cells { grid-template-columns: repeat(2, minmax(0, 1fr)) } .fx-two { grid-template-columns: 1fr } .fx-sun .fx-cell b { font-size: 34px } }
/* Settings: soft grouped rows on the white sheet */
.fx-set .fx-box { background: var(--fx-soft) !important; border-color: transparent !important }
.fx-set .fx-box > * { border-color: rgba(14,14,12,.06) !important }
.fx-line { display: block; margin-top: 2px; font-size: 13px; color: var(--ink-faint); font-weight: 400 }
.fx-sw { width: 40px; height: 24px; border-radius: 99px; background: #D8D6D0; position: relative; flex: none; display: inline-block }
.fx-sw::after { content: ""; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 99px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2) }
.fx-change { font-size: 13.5px !important; padding: 5px 13px; border-radius: 99px; text-decoration: none !important; box-shadow: inset 0 0 0 1px rgba(14,14,12,.14); background: #fff }
`;

async function shell(p, desk, path) {
  await p.addStyleTag({ content: SHELL });
  await p.evaluate(({ desk, path }) => {
    const chart = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
    const addResults = (nav, before) => {
      if (!nav || nav.querySelector('a[href="/analytics"].fx-r')) return;
      const src = [...nav.querySelectorAll("a")].find(a => /Customers/.test(a.textContent)); if (!src) return;
      const a = src.cloneNode(true); a.classList.add("fx-r"); a.setAttribute("href", "/analytics"); a.removeAttribute("aria-current");
      const svg = a.querySelector("svg"); if (svg) svg.outerHTML = chart;
      const walk = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); let n; while ((n = walk.nextNode())) { if (/Customers/.test(n.textContent)) n.textContent = n.textContent.replace("Customers", "Results"); else if (/^\s*\d+\s*$/.test(n.textContent)) n.textContent = ""; }
      if (before) nav.insertBefore(a, before); else src.after(a);
    };
    const aside = document.querySelector("aside");
    if (desk && aside) {
      addResults(aside.querySelector("nav"));
      // only Today keeps its count (who needs you); the rest of the counts go
      for (const a of aside.querySelectorAll("nav a")) if (!/Today/.test(a.textContent)) for (const s of a.querySelectorAll("span")) if (/^\d+$/.test(s.textContent.trim())) s.textContent = "";
      for (const a of aside.querySelectorAll("a")) { const h = a.getAttribute("href") || ""; if (h && (h === path || (path === "/dashboard" && h === "/dashboard"))) a.classList.add("fx-on"); else a.classList.remove("fx-on"); }
      const bottom = aside.querySelector("div.mt-auto");
      if (bottom && !aside.querySelector(".fx-setup")) {
        const c = document.createElement("div"); c.className = "fx-setup";
        c.innerHTML = '<div class="fx-setup-h"><b>Finish setting up</b><span>1 of 3</span></div><i class="fx-prog"><em style="width:34%"></em></i><ul><li class="ok">Email</li><li>Instagram, Facebook, WhatsApp</li><li>Your website form</li></ul>';
        bottom.insertBefore(c, bottom.firstChild);
      }
    }
    if (!desk) {
      const tabs = document.querySelector("nav.fixed.bottom-0");
      if (tabs && !tabs.querySelector(".fx-r")) {
        const all = [...tabs.querySelectorAll("a")], set = all.find(a => /Settings/.test(a.textContent));
        const src = all.find(a => !a.getAttribute("aria-current") && !/Today/.test(a.textContent)) || all[1];
        const a = src.cloneNode(true); a.classList.add("fx-r"); a.setAttribute("href", "/analytics"); a.removeAttribute("aria-current");
        const svg = a.querySelector("svg"); if (svg) svg.outerHTML = chart.replace(/width="16" height="16"/, 'width="22" height="22"');
        const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (/Customers|Settings|Today/.test(n.textContent)) n.textContent = "Results"; else if (/^\s*\d+\s*$/.test(n.textContent)) n.textContent = ""; }
        if (path === "/analytics") { a.style.color = "var(--ink)"; a.style.fontWeight = "600"; }
        tabs.insertBefore(a, set || null); tabs.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
        for (const a of tabs.querySelectorAll("a")) for (const s of a.querySelectorAll("span")) if (/^\d+$/.test(s.textContent.trim()) && !/Today/.test(a.textContent)) s.textContent = ""; }
    }
  }, { desk, path });
}

async function customersPage(p, desk) {
  await p.evaluate((desk) => {
    const h = document.querySelector("main h1"); if (h) { h.classList.add("fx-h"); h.textContent = "Customers"; }
    const rows = [...document.querySelectorAll("main a[href^='/leads?p=']")]; if (!rows.length) return;
    const list = rows[0].parentElement; list.classList.add("fx-list");
    if (desk && list.firstElementChild && !list.firstElementChild.matches("a")) list.firstElementChild.style.display = "none"; // the table's header row
    const STATES = ["Needs you", "Checking in", "Going quiet", "Answered", "Waiting", "Up to date", "Qualified", "Ready", "Booked", "Won"];
    const NAME = { "Going quiet": "Checking in", "Waiting": "Answered", "Up to date": "Answered", "Ready": "Qualified" };
    const stateOf = r => { const t = r.innerText; const s = STATES.find(x => t.includes(x)); return s ? (NAME[s] || s) : "Other"; };
    const count = {}; rows.forEach(r => { const st = stateOf(r); count[st] = (count[st] || 0) + 1; });
    let last = null;
    for (const r of rows) {
      const g = stateOf(r);
      if (g !== last) { const l = document.createElement("span"); l.className = "fx-day" + (g === "Needs you" ? " fx-needs" : ""); l.textContent = g + " · " + count[g]; list.insertBefore(l, r); last = g; }
      // the state is said once, by the label: the pill on every row goes; the wait stays
      for (const pill of r.querySelectorAll("span")) if (/rounded-full/.test(pill.className) && STATES.some(x => pill.textContent.trim() === x)) pill.style.display = "none";
      if (desk && !r.querySelector(".fx-acts")) { const x = document.createElement("span"); x.className = "fx-acts"; x.innerHTML = "<b>Reply</b><b>Later</b>"; r.appendChild(x); }
    }
    if (desk && rows[1]) rows[1].classList.add("fx-hover"); // drawn as if the pointer is on it
  }, desk);
}

async function resultsPage(p, desk, data) {
  return p.evaluate(({ desk, data }) => {
    const main = document.querySelector("main"), frame = main.querySelector(".app-frame") || main, t = data ? data.t : main.innerText;
    const pick = (re, d = "0") => { const m = t.match(re); return m ? m[1] : d; };
    const eye = pick(/(THIS WEEK[^\n]*)/i, "This week");
    const head = pick(/Customers heard back in ([^\n.]+)\./, "—");
    const ans = pick(/Answered\s*\n\s*(\d+)/), ansL = pick(/Answered\s*\n\s*\d+\s*\n\s*Last week: (\d+)/);
    const back = pick(/Came back\s*\n\s*(\d+)/), backL = pick(/Came back\s*\n\s*\d+\s*\n\s*Last week: (\d+)/);
    const book = pick(/Booked\s*\n\s*(\d+)/), bookL = pick(/Booked\s*\n\s*\d+\s*\n\s*Last week: (\d+)/);
    const won = pick(/Won\s*\n\s*[^\n]*?(\$[\d,]+)/, "$0");
    const weeks = [...t.matchAll(/\n(\d+)\n((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+)/g)].map(m => [+m[1], m[2]]).slice(-8);
    const max = Math.max(1, ...weeks.map(w => w[0]));
    const elseRows = [["Customers", pick(/Everything else\s*\n\s*Customers\s*\n\s*(\d+)/)], ["On a follow-up plan", pick(/On a follow-up plan\s*\n\s*([^\n]+)/)], ["Plans finished (30 days)", pick(/Plans finished \(30 days\)\s*\n\s*([^\n]+)/)], ["Replied after a follow-up", pick(/Replied after a follow-up\s*\n\s*([^\n]+)/)]];
    const word = head.match(/^(\S+)\s+(.+)$/);
    frame.innerHTML = `<section class="fx-res">
      <div><p class="fx-eye">${eye}</p>
      <h1 class="fx-h">Customers heard back in <em>${head}.</em></h1>
      <p class="fx-sub">The middle time from a customer writing to their first reply, from your own records.</p></div>
      <div class="fx-sun"><div class="fx-cells">
        <div class="fx-cell"><b>${ans}</b><span>answered</span><small>Last week ${ansL}</small></div>
        <div class="fx-cell"><b>${back}</b><span>came back after a follow-up</span><small>Last week ${backL}</small></div>
        <div class="fx-cell"><b>${book}</b><span>booked</span><small>Last week ${bookL}</small></div>
        <div class="fx-cell won"><b>${won}</b><span>won by you</span><small>Marked won, this week</small></div></div></div>
      <div class="fx-two">
        <div class="fx-card"><h2>Customers answered, by week</h2><div class="fx-bars">${weeks.map(([n, d]) => `<div><b>${n}</b><i class="${n ? "" : "zero"}" style="height:${n ? Math.round(110 * n / max) : 3}px"></i>${d}</div>`).join("")}</div></div>
        <div><h2 style="margin:0 0 6px;font-size:14.5px;font-weight:600">Everything else</h2><ul class="fx-else">${elseRows.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join("")}</ul></div>
      </div></section>`;
    if (!desk) frame.style.paddingTop = "76px";
    return { t };
  }, { desk, data });
}

async function settingsPage(p, desk) {
  await p.evaluate((desk) => {
    const main = document.querySelector("main"); main.classList.add("fx-set");
    const h = main.querySelector("h1"); if (h) h.classList.add("fx-h");
    for (const b of main.querySelectorAll("div[class*='rounded-'][class*='border']")) if (b.children.length >= 2 && b.getBoundingClientRect().width > 250 && !b.closest(".fx-box")) b.classList.add("fx-box");
    const LINES = { "Booking hours": "When FollowUp offers customers a time.", "Pause all sending": "Stops every reply and check-in until you turn it back on." };
    for (const btn of main.querySelectorAll("button")) {
      const label = [...btn.querySelectorAll("span, p, div")].find(e => LINES[e.textContent.trim()] && !e.querySelector("span, p, div"));
      if (label && !label.querySelector(".fx-line")) { const l = document.createElement("span"); l.className = "fx-line"; l.textContent = LINES[label.textContent.trim()]; label.appendChild(l); }
      if (label && label.firstChild && /Pause all sending/.test(label.textContent)) { // on/off is a switch, not a word and a chevron
        const off = [...btn.querySelectorAll("span")].find(s => s.textContent.trim() === "Off"); if (off) { off.textContent = ""; off.className = "fx-sw"; off.setAttribute("aria-hidden", "true"); off.style.marginLeft = "auto"; if (off.parentElement !== btn) off.parentElement.style.marginLeft = "auto"; }
        const chev = btn.querySelector("svg:last-of-type"); if (chev) chev.style.display = "none"; }
    }
    const ch = main.querySelector('a[href="/workflows"]'); if (ch) ch.classList.add("fx-change");
    if (!desk && h && !main.querySelector(".fx-setup")) { const c = document.createElement("div"); c.className = "fx-setup"; c.style.margin = "4px 0 18px";
      c.innerHTML = '<div class="fx-setup-h"><b>Finish setting up</b><span>1 of 3</span></div><i class="fx-prog"><em style="width:34%"></em></i><ul><li class="ok">Email</li><li>Instagram, Facebook, WhatsApp</li><li>Your website form</li></ul>'; h.after(c); }
  }, desk);
}

let RES = null;
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }); const log = [];
  for (const [w, hgt, tag] of [[1280, 860, "d"], [390, 844, "m"]]) {
    const desk = w >= 1024;
    const ctx = await b.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: !desk, hasTouch: !desk });
    await ctx.addCookies([{ name: "next-auth.session-token", value: fs.readFileSync(`${S}/session.cookie`, "utf8").trim(), domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    const p = await ctx.newPage(); p.on("pageerror", e => log.push(tag + " " + e.message));
    const go = async (path) => { await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.waitForTimeout(600); };
    const shot = (name) => p.screenshot({ path: `${OUT}/${tag}-${name}.png` });
    // Today: one customer at a time (A-209), our look (A-208), the calm shell (A-211)
    await go("/dashboard"); await shot("today-before");
    await H.theme(p); await H.common(p); await H.today(p); await H.todayOne(p, desk); await shell(p, desk, "/dashboard"); await p.waitForTimeout(300); await shot("today");
    // Customers
    await go("/leads"); await shot("customers-before");
    await H.theme(p); await H.common(p); await H.customers(p); await H.simpler(p, "customers"); await customersPage(p, desk); await shell(p, desk, "/leads"); await p.waitForTimeout(300); await shot("customers");
    // Results
    await go("/analytics"); await shot("results-before");
    await H.theme(p); await H.common(p); RES = await resultsPage(p, desk, desk ? null : RES); await shell(p, desk, "/analytics"); await p.waitForTimeout(500); await shot("results");
    // Settings
    await go("/settings"); await shot("settings-before");
    await H.theme(p); await H.common(p); await settingsPage(p, desk); await shell(p, desk, "/settings"); await p.waitForTimeout(300); await shot("settings");
    await ctx.close();
  }
  console.log(log.length ? log.join("\n") : "drawn, no page errors"); await b.close();
})();
