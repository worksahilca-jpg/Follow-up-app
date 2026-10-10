// The app in FollowUp's colours, with an interface that leans toward Wispr Flow's calm (A-211).
// Drawn on the real local app: the shell, Today, Customers, Results and Settings, desk 1280 and phone 390.
// usage: node draw2.cjs <scratchpad> <outdir>
const { chromium } = require("playwright"); const fs = require("fs");
const H = require("./helpers.cjs");
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

/* round 4 */
aside .fx-word { display: none !important }                       /* "Alerts" is the phone's word only (A-209) */
.fx-acct { display: inline-flex; margin-left: 4px; opacity: .6 }
.fx-menu { position: absolute; left: 10px; top: 52px; z-index: 50; width: 252px; padding: 6px; border-radius: 14px; background: #fff;
  box-shadow: 0 0 0 1px rgba(14,14,12,.08), 0 18px 40px -18px rgba(14,14,12,.35); font-size: 14px }
.fx-menu p { margin: 0; padding: 8px 10px 6px; color: var(--ink-faint); font-size: 12.5px }
.fx-menu a { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: 9px; color: var(--ink); text-decoration: none }
.fx-menu a span { color: var(--ink-faint) } .fx-menu a.on { background: var(--fx-soft) }
.fx-menu hr { border: 0; border-top: 1px solid rgba(14,14,12,.07); margin: 5px 4px }
/* Today: the customer on the left, what helps on the right */
.fx-side { border-radius: 16px; background: var(--fx-soft); padding: 18px 18px 16px; font-size: 14px; align-self: start; position: sticky; top: 24px }
.fx-side h3 { margin: 0 0 12px; font-size: 15px; font-weight: 600 }
.fx-side dl { margin: 0; display: grid; gap: 10px }
.fx-side dt { font-size: 12.5px; color: var(--ink-faint) } .fx-side dd { margin: 1px 0 0; color: var(--ink) }
.fx-gap { margin-top: 14px; padding: 12px; border-radius: 12px; background: #fff; box-shadow: inset 0 0 0 1px rgba(14,14,12,.07) }
.fx-gap b { display: flex; align-items: center; gap: 7px; font-weight: 600 } .fx-gap b::before { content: ""; width: 7px; height: 7px; border-radius: 9px; background: #c96a1b }
.fx-gap span { display: block; margin-top: 4px; color: var(--ink-soft); font-size: 13.5px }
.fx-side a { display: inline-block; margin-top: 14px; font-weight: 500; text-decoration: underline; text-underline-offset: 3px }
/* Customers: two lines per person, like a chat list */
.fx-two-line { grid-template-columns: 48px minmax(0, 1fr) 140px !important }
.fx-two-line .fx-prev { display: block; margin-top: 2px; font-size: 14px; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70ch }
/* Settings: a short list of sections beside the rows */
.fx-setgrid { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 40px; align-items: start; max-width: 1040px !important }
.fx-secs { position: sticky; top: 24px; display: grid; gap: 2px; font-size: 14.5px }
.fx-secs a { padding: 8px 12px; border-radius: 10px; color: var(--ink-soft); text-decoration: none }
.fx-secs a.on { background: var(--fx-soft); color: var(--ink); font-weight: 600 }
.fx-secs p { margin: 14px 12px 4px; font: 500 11px/1 ui-monospace, "IBM Plex Mono", monospace; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-faint) }
/* round 5: windows that open over the page (Settings, Add customer) */
.fx-dim { position: fixed; inset: 0; z-index: 80; background: rgba(14,14,12,.32) }
.fx-win { position: fixed; z-index: 81; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(900px, calc(100vw - 48px)); height: min(620px, calc(100vh - 64px));
  display: grid; grid-template-columns: 224px minmax(0, 1fr); background: #fff; border-radius: 18px; overflow: hidden;
  box-shadow: 0 0 0 1px rgba(14,14,12,.08), 0 40px 90px -36px rgba(0,0,0,.55) }
.fx-win nav { background: var(--fx-soft); padding: 18px 12px; display: flex; flex-direction: column; gap: 2px; font-size: 14.5px }
.fx-win nav p { margin: 14px 10px 6px; font: 500 11px/1 ui-monospace, "IBM Plex Mono", monospace; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-faint) }
.fx-win nav p:first-child { margin-top: 2px }
.fx-win nav a { padding: 8px 10px; border-radius: 9px; color: var(--ink-soft); text-decoration: none }
.fx-win nav a.on { background: #fff; color: var(--ink); font-weight: 600; box-shadow: 0 0 0 1px rgba(14,14,12,.06) }
.fx-win nav .fx-foot { margin-top: auto; padding: 8px 10px; font-size: 13px; color: var(--ink-faint) }
.fx-win .fx-pane { padding: 30px 34px; overflow: auto }
.fx-win .fx-pane h2 { margin: 0 0 4px; font-family: 'FU Display', Georgia, serif; font-weight: 400; font-size: 30px; letter-spacing: -.01em; color: var(--ink) }
.fx-win .fx-pane .fx-why { margin: 0 0 18px; color: var(--ink-faint); font-size: 14px }
.fx-win .fx-pane .fx-boxwrap > div { background: var(--fx-soft) !important; border-color: transparent !important; border-radius: 14px !important }
.fx-win .fx-pane .fx-boxwrap > div > * { border-color: rgba(14,14,12,.06) !important }
.fx-x { position: absolute; right: 14px; top: 14px; width: 34px; height: 34px; border-radius: 99px; display: grid; place-items: center; color: var(--ink-soft); background: #fff; box-shadow: inset 0 0 0 1px rgba(14,14,12,.1) }
.fx-small { width: min(520px, calc(100vw - 32px)); height: auto; grid-template-columns: 1fr }
.fx-small .fx-pane { padding: 28px 30px 24px }
.fx-form { display: grid; gap: 14px }
.fx-form label { display: grid; gap: 6px; font-size: 13.5px; color: var(--ink-soft) }
.fx-form input, .fx-form textarea { font: inherit; font-size: 15px; color: var(--ink); padding: 11px 13px; border-radius: 11px; border: 1px solid rgba(14,14,12,.12); background: #fff }
.fx-form .fx-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
.fx-more { font-size: 14px; color: var(--ink-soft); display: flex; align-items: center; gap: 6px }
.fx-acts2 { display: flex; justify-content: flex-end; align-items: center; gap: 18px; margin-top: 6px }
.fx-acts2 a { color: var(--ink-soft); font-size: 14.5px; text-decoration: none }
.fx-acts2 b { font-weight: 600; font-size: 15px; padding: 11px 20px; border-radius: 11px; background: #0E0E0C; color: #fff }
@media (max-width: 700px) { .fx-small { top: auto; bottom: 0; left: 0; transform: none; width: 100%; border-radius: 20px 20px 0 0 } .fx-form .fx-row2 { grid-template-columns: 1fr } }
/* phone: Settings rises as a sheet */
.fx-sheet { position: fixed; z-index: 81; left: 0; right: 0; bottom: 0; top: 52px; background: #fff; border-radius: 20px 20px 0 0; padding: 10px 16px 24px; overflow: auto;
  box-shadow: 0 -20px 50px -30px rgba(0,0,0,.5) }
.fx-grab { width: 38px; height: 5px; border-radius: 9px; background: #D9D7D1; margin: 0 auto 12px }
.fx-sheet h2 { margin: 6px 0 14px; font-family: 'FU Display', Georgia, serif; font-weight: 400; font-size: 32px; color: var(--ink) }
.fx-list2 { border-radius: 14px; background: var(--fx-soft); overflow: hidden; margin-bottom: 16px }
.fx-list2 a { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; font-size: 16px; color: var(--ink); text-decoration: none; border-top: 1px solid rgba(14,14,12,.06) }
.fx-list2 a:first-child { border-top: 0 } .fx-list2 a span { color: var(--ink-faint); font-size: 14.5px; margin-left: auto }
.fx-list2 a::after { content: "›"; color: var(--ink-faint); margin-left: 10px; font-size: 20px; line-height: 1 }
.fx-done-btn { position: absolute; right: 16px; top: 18px; font-weight: 600; font-size: 15.5px; color: var(--ink) }
/* round 6: everything planned, organised */
.fx-win nav { overflow: auto }
.fx-soon { margin-left: 6px; font: 500 10.5px/1 ui-monospace, "IBM Plex Mono", monospace; letter-spacing: .06em; text-transform: uppercase; color: #8a857e; padding: 2px 6px; border-radius: 99px; box-shadow: inset 0 0 0 1px rgba(14,14,12,.12); vertical-align: 1px }
.fx-rows { border-radius: 14px; background: var(--fx-soft); overflow: hidden }
.fx-rows > div { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-top: 1px solid rgba(14,14,12,.06); font-size: 15px; color: var(--ink) }
.fx-rows > div:first-child { border-top: 0 }
.fx-rows > div span.l { flex: 1; min-width: 0 } .fx-rows > div small { display: block; font-size: 13px; color: var(--ink-faint) }
.fx-sw.on { background: #2A5A47 } .fx-sw.on::after { left: 19px }
.fx-addq { display: inline-block; margin-top: 14px; font-size: 14px; font-weight: 500; padding: 8px 14px; border-radius: 99px; box-shadow: inset 0 0 0 1px rgba(14,14,12,.14) }
/* the customer page: one column of blocks on the right, each the same shape */
.fx-blocks { display: grid; gap: 12px; align-content: start }
.fx-blk { border-radius: 14px; background: var(--fx-soft); padding: 14px 16px; font-size: 14px }
.fx-blk h4 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--ink); display: flex; justify-content: space-between; align-items: center }
.fx-blk p { margin: 0; color: var(--ink-soft); line-height: 1.5 } .fx-blk p + p { margin-top: 4px }
.fx-blk q { quotes: "“" "”"; color: var(--ink) }
.fx-blk .fx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px }
.fx-blk .fx-chips span { font-size: 12.5px; padding: 3px 9px; border-radius: 99px; background: #fff; box-shadow: inset 0 0 0 1px rgba(14,14,12,.1); color: var(--ink-soft) }
.fx-blk .fx-chips span.ok { color: #1F6B45; box-shadow: inset 0 0 0 1px rgba(31,107,69,.3) }
.fx-blk a { font-weight: 500; text-decoration: underline; text-underline-offset: 3px; color: var(--ink) }
.fx-acts3 { display: flex; flex-wrap: wrap; gap: 8px }
.fx-acts3 span { font-size: 13.5px; font-weight: 500; padding: 7px 13px; border-radius: 99px; background: #fff; box-shadow: inset 0 0 0 1px rgba(14,14,12,.14) }
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

async function tidySidebar(p, menuOpen) {
  await p.evaluate((menuOpen) => {
    const aside = document.querySelector("aside"); if (!aside) return;
    const name = aside.querySelector("a span.truncate"); if (name && !aside.querySelector(".fx-acct")) { const c = document.createElement("span"); c.className = "fx-acct";
      c.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'; name.after(c); }
    const bottom = aside.querySelector("div.mt-auto"); if (!bottom) return;
    const set = [...bottom.querySelectorAll("a")].find(a => /Settings/.test(a.textContent));
    for (const el of [...bottom.children]) if (!el.classList.contains("fx-setup") && !(set && el.contains(set))) el.style.display = "none";
    if (set && !bottom.querySelector(".fx-help")) { const h = set.cloneNode(true); h.classList.add("fx-help"); h.classList.remove("fx-on"); h.setAttribute("href", "#help");
      const svg = h.querySelector("svg"); if (svg) svg.outerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.6M12 17h.01"/></svg>';
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/Settings/.test(n.textContent)) n.textContent = n.textContent.replace("Settings", "Help");
      (set.closest("div.mt-auto > *") || set).after(h); }
    if (menuOpen && !aside.querySelector(".fx-menu")) { aside.style.position = "relative"; const m = document.createElement("div"); m.className = "fx-menu";
      m.innerHTML = '<p>owner@local.test</p><a class="on" href="#">Maple Realty (local) <span>✓</span></a><hr><a href="#">Your plan <span>Founding tester</span></a><a href="#">Team <span>Just you</span></a><a href="#">Something broke? Tell us</a><hr><a href="#">Sign out</a>';
      aside.appendChild(m); }
  }, menuOpen);
}

async function todaySide(p) {
  await p.evaluate(() => {
    const grid = [...document.querySelectorAll("main div")].find(e => /grid-cols-\[minmax\(280px/.test(e.className)); if (!grid) return;
    const right = grid.children[1]; grid.style.display = "grid"; grid.style.gridTemplateColumns = "minmax(0, 640px) 300px"; grid.style.gap = "32px"; grid.style.alignItems = "start";
    if (grid.querySelector(".fx-side")) return;
    const side = document.createElement("aside"); side.className = "fx-side";
    side.innerHTML = `<h3>About Ivy</h3><dl>
      <div><dt>Came from</dt><dd>Your website form · x11@example.com</dd></div>
      <div><dt>First wrote</dt><dd>Monday, Sep 21 · 9:01 AM</dd></div>
      <div><dt>What FollowUp did</dt><dd>Held a reply, because it needs your answer</dd></div>
      <div><dt>Follow-up plan</dt><dd>None yet</dd></div></dl>
      <div class="fx-gap"><b>Parking: not known yet</b><span>Add it to this reply. FollowUp learns it from what you send, for the next person who asks.</span></div>
      <a href="/leads/lead_x11">Open Ivy's page</a>`;
    right.after(side);
  });
}

async function customersTwoLine(p) {
  await p.evaluate(() => {
    const rows = [...document.querySelectorAll("main a[href^='/leads?p=']")];
    for (const r of rows) { const c = r.children; if (c.length < 6) continue; r.classList.add("fx-two-line");
      const prev = c[3].textContent.trim(); c[3].style.display = "none";
      if (!c[1].querySelector(".fx-prev")) { const d = document.createElement("span"); d.className = "fx-prev"; d.textContent = prev; c[1].appendChild(d); }
      c[5].style.justifySelf = "end"; }
  });
}

async function settingsSections(p) {
  await p.evaluate(() => {
    const main = document.querySelector("main"), h = main.querySelector("h1"); if (!h || main.querySelector(".fx-setgrid")) return;
    const secs = [...main.querySelectorAll("section.grid")].filter(x => { const t = x.querySelector("h2"); return t && !t.classList.contains("sr-only"); });
    if (!secs.length) return;
    const holder = secs[0].parentElement, top = holder.closest("div.mt-6") || holder;
    const grid = document.createElement("div"); grid.className = "fx-setgrid";
    const nav = document.createElement("nav"); nav.className = "fx-secs"; const body = document.createElement("div");
    const ON = "Where customers write";
    nav.innerHTML = secs.map(x => { const t = x.querySelector("h2").textContent.trim(); return `<a href="#" class="${t === ON ? "on" : ""}">${t.replace(/^Your follow-up plan$/, "Follow-up plan")}</a>`; }).join("");
    top.parentElement.insertBefore(grid, top); grid.appendChild(nav); grid.appendChild(body); body.appendChild(top);
    for (const x of secs) { const t = x.querySelector("h2"); if (t.textContent.trim() !== ON) x.style.display = "none"; else { t.style.cssText = "font-family:'FU Display',Georgia,serif;font-size:28px;color:var(--ink);font-weight:400;letter-spacing:-.01em;margin:0 0 8px"; } }
    for (const d of main.querySelectorAll("div.mt-7")) d.style.display = "none";   // the long detail area below the groups
  });
}

async function harvest(p) {
  return p.evaluate(() => [...document.querySelectorAll("main section.grid")].map(x => { const h = x.querySelector("h2"); const box = [...x.children].find(c => c !== h && !c.contains(h)) || x.lastElementChild;
    return { t: h ? h.textContent.trim() : "", html: box ? box.outerHTML : "" }; }).filter(x => x.t));
}
const WHY = { "Where customers write": "The places FollowUp reads and answers for you.", "How it writes": "How replies are written, and when they go.",
  "Your follow-up plan": "What FollowUp does, and when.", "Your business": "What FollowUp knows about you.", "Account": "How you sign in, and your data." };
const XSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
async function settingsWindow(p, secs, on) {
  await p.evaluate(({ secs, on, WHY, XSVG }) => {
    document.querySelector(".fx-dim")?.remove(); document.querySelector(".fx-win")?.remove();
    const name = t => t === "Your follow-up plan" ? "Follow-up plan" : t === "Account" ? "Account and data" : t;
    const main = secs.filter(x => x.t !== "Account"), cur = secs.find(x => x.t === on) || secs[1];
    const dim = document.createElement("div"); dim.className = "fx-dim";
    const w = document.createElement("div"); w.className = "fx-win"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Settings");
    w.innerHTML = `<nav><p>Settings</p>${main.map(x => `<a href="#" class="${x.t === cur.t ? "on" : ""}">${name(x.t)}</a>`).join("")}
      <p>Account</p><a href="#" class="${cur.t === "Account" ? "on" : ""}">Account and data</a>
      <span class="fx-foot">Something broke? Tell us</span></nav>
      <div class="fx-pane"><h2>${name(cur.t)}</h2><p class="fx-why">${WHY[cur.t] || ""}</p><div class="fx-boxwrap">${cur.html}</div></div>
      <span class="fx-x" aria-label="Close">${XSVG}</span>`;
    document.body.appendChild(dim); document.body.appendChild(w);
    for (const btn of w.querySelectorAll("button")) if (/Pause all sending/.test(btn.textContent)) { const off = [...btn.querySelectorAll("span")].find(s => s.textContent.trim() === "Off");
      if (off) { off.textContent = ""; off.className = "fx-sw"; off.style.marginLeft = "auto"; } const ch = btn.querySelector("svg:last-of-type"); if (ch) ch.style.display = "none"; }
    for (const a of document.querySelectorAll("aside a")) a.classList.toggle("fx-on", /Settings/.test(a.textContent) && !a.classList.contains("fx-help"));
  }, { secs, on, WHY, XSVG });
}
async function addWindow(p) {
  await p.evaluate((XSVG) => {
    const dim = document.createElement("div"); dim.className = "fx-dim";
    const w = document.createElement("div"); w.className = "fx-win fx-small"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Add a customer");
    w.innerHTML = `<div class="fx-pane"><h2>Add a customer</h2><p class="fx-why">Someone who called or walked in. FollowUp takes it from here.</p>
      <div class="fx-form"><label>Name<input placeholder="Their name"></label>
      <div class="fx-row2"><label>Email<input placeholder="name@example.com"></label><label>Phone<input placeholder="Their number"></label></div>
      <label>Notes<textarea rows="3" placeholder="What they asked about"></textarea></label>
      <span class="fx-more">More details: company, deal value, where they came from <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></span>
      <div class="fx-acts2"><a href="#">Cancel</a><b>Add customer</b></div></div></div>
      <span class="fx-x" aria-label="Close">${XSVG}</span>`;
    document.body.appendChild(dim); document.body.appendChild(w);
  }, XSVG);
}
async function settingsSheet(p, secs) {
  await p.evaluate((secs) => {
    const name = t => t === "Your follow-up plan" ? "Follow-up plan" : t;
    const dim = document.createElement("div"); dim.className = "fx-dim";
    const sh = document.createElement("div"); sh.className = "fx-sheet"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", "Settings");
    sh.innerHTML = `<div class="fx-grab"></div><span class="fx-done-btn">Done</span><h2>Settings</h2>
      <div class="fx-setup" style="margin:0 0 16px"><div class="fx-setup-h"><b>Finish setting up</b><span>1 of 3</span></div><i class="fx-prog"><em style="width:34%"></em></i><ul><li class="ok">Email</li><li>Instagram, Facebook, WhatsApp</li><li>Your website form</li></ul></div>
      <div class="fx-list2">${secs.filter(x => x.t !== "Account").map(x => `<a href="#">${name(x.t)}</a>`).join("")}</div>
      <div class="fx-list2"><a href="#">Account and data</a><a href="#">Something broke? Tell us</a></div>
      <div class="fx-list2"><a href="#" style="color:#b32a44">Sign out</a></div>`;
    document.body.appendChild(dim); document.body.appendChild(sh);
  }, secs);
}
async function settingsFull(p) {
  await p.evaluate((XSVG) => {
    document.querySelector(".fx-dim")?.remove(); document.querySelector(".fx-win")?.remove();
    const S = (t) => `<span class="fx-soon">Soon</span>`;
    const G = [
      ["How it works", [["Follow-up plan"], ["How it writes"], ["What you ask", 0, 1], ["Booking and calendar", 1]]],
      ["Where customers write", [["Email and website form"], ["Instagram, Facebook, WhatsApp"], ["Phone and calls", 1]]],
      ["Your business", [["What FollowUp knows"], ["Team"], ["Alerts"]]],
      ["Account", [["Plan and billing"], ["Sign-ins and security"], ["Your data"], ["Advanced"]]]];
    const nav = G.map(([g, items]) => `<p>${g}</p>` + items.map(([n, soon, on]) => `<a href="#" class="${on ? "on" : ""}">${n}${soon ? S() : ""}</a>`).join("")).join("");
    const Q = [["What they want", "The home, the area, the size: from their message, or FollowUp asks", 1], ["When", "When they want to move or see it", 1], ["Budget", "Asked gently, never as the first question", 1],
               ["Viewing", "The goal: a time on your calendar", 1], ["Pre-approved for a mortgage", "", 0, 1], ["Working with another agent", "If yes, FollowUp steps back", 0, 1]];
    const dim = document.createElement("div"); dim.className = "fx-dim";
    const w = document.createElement("div"); w.className = "fx-win"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Settings");
    w.innerHTML = `<nav>${nav}<span class="fx-foot">Something broke? Tell us</span></nav>
      <div class="fx-pane"><h2>What you ask</h2><p class="fx-why">The questions FollowUp asks, one at a time, before it hands a customer to you. The realtor card asks the first four today; changing them here is new.</p>
      <div class="fx-rows">${Q.map(([l, s, on, soon]) => `<div><span class="l">${l}${soon ? '<span class="fx-soon">Soon</span>' : ""}${s ? `<small>${s}</small>` : ""}</span><i class="fx-sw ${on ? "on" : ""}" aria-hidden="true"></i></div>`).join("")}</div>
      <span class="fx-addq">Add a question</span></div>
      <span class="fx-x" aria-label="Close">${XSVG}</span>`;
    document.body.appendChild(dim); document.body.appendChild(w);
    for (const a of document.querySelectorAll("aside a")) a.classList.toggle("fx-on", /Settings/.test(a.textContent) && !a.classList.contains("fx-help"));
  }, XSVG);
}
async function customerBlocks(p) {
  await p.evaluate(() => {
    const aside = document.querySelector("main aside"); if (!aside) return;
    const h = document.querySelector("main h1, main .min-w-0 h1"); 
    aside.className = "fx-blocks"; aside.style.marginTop = "0";
    aside.innerHTML = `
      <div class="fx-blk"><h4>About Ivy</h4><p>Your website form · x11@example.com</p><p>First wrote Monday, Sep 21 · waiting 18 days</p></div>
      <div class="fx-blk"><h4>Qualification</h4><p>Wants: <q>the 2-bed on King St</q></p>
        <div class="fx-chips"><span class="ok">What they want ✓</span><span>When</span><span>Budget</span><span>Viewing</span></div>
        <p style="margin-top:8px">FollowUp asks the rest one at a time, in her words.</p></div>
      <div class="fx-blk"><h4>Booking</h4><p>Not booked yet.</p></div>
      <div class="fx-blk"><h4>What FollowUp did</h4><p>Held a reply on Sep 21: it needs your answer on parking.</p><p>Follow-up plan: none yet.</p></div>
      <div class="fx-acts3"><span>Already spoke</span><span>Copy booking link</span><span>Mark won</span><span>Details</span></div>`;
  });
}
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }); const log = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "next-auth.session-token", value: fs.readFileSync(`${S}/session.cookie`, "utf8").trim(), domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const p = await ctx.newPage(); p.on("pageerror", e => log.push(e.message));
  const go = async (path) => { await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.waitForTimeout(600); };
  const shot = (name) => p.screenshot({ path: `${OUT}/d-${name}.png` });
  await go("/dashboard"); await H.theme(p); await H.common(p); await H.today(p); await H.todayOne(p, true); await shell(p, true, "/dashboard"); await tidySidebar(p, false); await todaySide(p);
  await settingsFull(p); await p.waitForTimeout(300); await shot("win-full");
  await go("/leads/lead_x11"); await H.theme(p); await H.common(p); await H.customerPage(p); await H.simpler(p, "customer"); await shell(p, true, "/leads"); await tidySidebar(p, false); await customerBlocks(p);
  await p.waitForTimeout(300); await shot("customer");
  await ctx.close(); console.log(log.length ? log.join("\n") : "drawn, no page errors"); await b.close();
})();
