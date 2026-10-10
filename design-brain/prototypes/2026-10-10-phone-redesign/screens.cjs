// The phone-app redesign, drawn inside the running app so its own fonts and colour tokens apply.
const ic = (d, s = 20, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  insta: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  msg: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
};
const F = { soft: "var(--ink-soft)", faint: "var(--ink-faint)", line: "var(--line)", card: "var(--card)", card2: "var(--card-2)", ink: "var(--ink)", sage: "var(--sage)", paper: "var(--paper)" };

const top = (right = true) => `<header style="height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 16px">
  <span style="display:flex;align-items:center;gap:7px;font-weight:600;font-size:15.5px;letter-spacing:-0.01em"><img src="/brand/png/followup-symbol-128.png" width="19" height="19" alt="">FollowUp</span>
  ${right ? `<span style="display:flex;gap:6px;color:${F.ink}"><span style="width:40px;height:40px;display:grid;place-items:center;border-radius:999px">${ic(I.help, 19)}</span><span style="width:40px;height:40px;display:grid;place-items:center;border-radius:999px">${ic(I.bell, 19)}</span></span>` : ""}
</header>`;
const tabs = (on) => `<nav style="position:absolute;left:0;right:0;bottom:0;height:70px;padding:7px 8px 18px;background:${F.paper};border-top:1px solid ${F.line};display:grid;grid-template-columns:repeat(4,1fr)">
  ${[["Today", I.sun], ["Customers", I.users], ["Results", I.chart], ["Settings", I.gear]].map(([t, d]) => `<span style="display:grid;justify-items:center;gap:2px;font-size:10.5px;font-weight:${t === on ? 600 : 500};color:${t === on ? F.ink : F.faint}">${ic(d, 20, t === on ? 2.1 : 1.8)}${t}</span>`).join("")}
</nav>`;
const frame = (inner) => `<div id="phone" style="position:relative;width:390px;height:844px;overflow:hidden;background:${F.paper};color:${F.ink};font-family:inherit">${inner}</div>`;
const av = (t, size = 40) => `<span style="flex:none;width:${size}px;height:${size}px;border-radius:999px;background:${F.card2};display:grid;place-items:center;font-size:${size > 36 ? 14 : 12.5}px;font-weight:600;color:${F.soft}">${t}</span>`;
const mono = (t) => `<p style="font-family:var(--font-mono, ui-monospace, monospace);font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${F.faint}">${t}</p>`;
const total = (n, words, extra = "") => `<div style="padding:2px 16px 0"><p style="font-size:12.5px;color:${F.faint}">Saturday, October 10</p>
  <div style="display:flex;align-items:baseline;gap:10px;margin-top:2px"><span style="font-size:34px;font-weight:600;letter-spacing:-0.035em;line-height:1">${n}</span><span style="font-size:17px;font-weight:500;letter-spacing:-0.01em;line-height:1.2">${words}</span></div>${extra}</div>`;

const decisionCard = `<article style="margin:12px 12px 0;background:${F.card};border:1px solid ${F.line};border-radius:18px;padding:14px">
  <div style="display:flex;gap:10px;align-items:center">${av("IS", 32)}<div style="flex:1;min-width:0"><p style="font-size:14.5px;font-weight:600">Ivy Sohal</p><p style="display:flex;align-items:center;gap:5px;font-size:12px;color:${F.faint}">${ic(I.mail, 14)} Email · 18 min ago</p></div></div>
  <p style="margin-top:10px;font-size:15.5px;line-height:1.4">“Hi, I saw the 2-bed on King St. Is parking included with the unit?”</p>
  <div style="margin-top:10px;border-radius:14px;padding:11px 12px;background:var(--wash);border:1px solid var(--wash-edge)">
    ${mono("Your reply, ready")}
    <p style="margin-top:5px;font-size:14px;line-height:1.45">Hi Ivy, yes, one underground spot comes with it. Want to see the unit this week? Pick a time that suits you here: <u>followupbase.io/book/ivy</u></p>
  </div>
  <button style="margin-top:12px;width:100%;height:44px;border-radius:999px;border:0;background:${F.ink};color:var(--on-accent);font:inherit;font-size:15px;font-weight:600">Send</button>
  <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px"><button style="height:44px;border-radius:999px;border:1px solid ${F.line};background:${F.card};font:inherit;font-size:14px;font-weight:500;color:${F.ink}">Edit</button><button style="height:44px;border-radius:999px;border:0;background:transparent;font:inherit;font-size:14px;color:${F.soft}">Later</button></div>
</article>`;
const nextRow = `<a style="margin:10px 12px 0;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:${F.card2}">
  <span style="font-size:12px;color:${F.faint};font-weight:500">Next</span><span style="flex:1;min-width:0;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="font-weight:600">Owen Shah</b> · “Is the house on Elm St still available?”</span><span style="color:${F.faint}">${ic(I.right, 18)}</span></a>`;

const today = frame(`${top()}${total(3, "customers need you")}${decisionCard}${nextRow}${tabs("Today")}`);

const done = frame(`${top()}${total(0, "customers need you")}
  <div style="margin:14px 12px 0;padding:16px;border-radius:18px;background:${F.card};border:1px solid ${F.line}">
    <span style="width:36px;height:36px;border-radius:999px;background:var(--sage-soft);color:${F.sage};display:grid;place-items:center">${ic(I.check, 22, 2.4)}</span>
    <p style="margin-top:10px;font-size:17px;font-weight:600;letter-spacing:-0.01em">You’re all caught up.</p>
    <p style="margin-top:2px;font-size:13.5px;line-height:1.5;color:${F.soft}">Your phone buzzes when someone needs you.</p>
  </div>
  <div style="margin:18px 16px 0">${mono("What FollowUp did today")}
    <ul style="margin-top:10px;display:grid">
      ${[[I.cal, "Ella Das booked a viewing", "Sat 11:00 · from your booking link"], [I.send, "Replied to Mia Gill", "Asked when she wants to move"], [I.clock, "Checked in with Lucas Brar", "Quiet for 3 days"]].map(([d, a, b], i) => `<li style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;${i ? `border-top:1px solid ${F.line};` : ""}"><span style="flex:none;width:30px;height:30px;border-radius:999px;background:${F.card2};display:grid;place-items:center;color:${F.soft}">${ic(d, 15)}</span><span><b style="display:block;font-size:14px;font-weight:600">${a}</b><span style="font-size:12.5px;color:${F.faint}">${b}</span></span></li>`).join("")}
    </ul>
    <p style="margin-top:4px;font-size:13px;color:${F.soft};text-decoration:underline;text-underline-offset:3px">See everything it did</p>
  </div>${tabs("Today")}`);

const ask = frame(`${top()}${total(3, "customers need you")}
  <section style="margin:12px 12px 0;padding:14px;border-radius:18px;background:${F.card};border:1px solid ${F.ink}">
    <p style="font-size:15.5px;font-weight:600;letter-spacing:-0.01em">Let FollowUp reply for you?</p>
    <p style="margin-top:4px;font-size:13.5px;line-height:1.45;color:${F.soft}">It answers new customers right away, and every reply works toward a booking. Prices, dates and anything unsure still wait for you.</p>
    <p style="margin-top:10px;display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45"><span style="color:${F.sage};margin-top:1px">${ic(I.check, 17, 2.4)}</span><span>You sent 11 of your last 13 replies just as it wrote them.</span></p>
    <div style="margin-top:12px;display:grid;gap:2px"><button style="height:44px;border-radius:999px;border:1px solid ${F.ink};background:${F.card};font:inherit;font-size:14.5px;font-weight:600;color:${F.ink}">Yes, reply for me</button><button style="height:44px;border:0;background:transparent;font:inherit;font-size:14px;color:${F.soft}">Not now</button></div>
    <p style="font-size:11.5px;color:${F.faint};text-align:center">You can change this any time in Settings.</p>
  </section>
  <div style="margin:10px 12px 0;padding:11px 12px;border-radius:16px;border:1px solid ${F.line};background:${F.card};display:flex;gap:10px;align-items:center">${av("IS", 30)}<span style="flex:1;font-size:13.5px"><b style="font-weight:600">Ivy Sohal</b><br><span style="color:${F.faint}">Is parking included with the unit?</span></span><span style="color:${F.faint}">${ic(I.right, 18)}</span></div>
  ${tabs("Today")}`);

const row = (initials, name, line, right, hot = false) => `<li style="display:flex;gap:10px;align-items:center;padding:8px 0;min-width:0">${av(initials, 32)}<span style="flex:1;min-width:0"><b style="display:block;font-size:14px;font-weight:600">${name}</b><span style="display:block;font-size:12.5px;color:${F.soft};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${line}</span></span>${hot ? `<span style="flex:none;height:32px;padding:0 12px;border-radius:999px;border:1px solid ${F.ink};display:grid;place-items:center;font-size:12.5px;font-weight:600">${right}</span>` : `<span style="flex:none;font-size:12px;color:${F.faint}">${right}</span>`}</li>`;
const group = (title, count, rows, note = "") => `<section style="margin:0 12px 10px;padding:4px 12px 2px;border-radius:16px;background:${F.card};border:1px solid ${F.line}">
  <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0 0"><p style="font-size:12.5px;font-weight:600;color:${F.soft}">${title}</p><span style="font-size:12.5px;color:${F.soft};font-weight:600;font-variant-numeric:tabular-nums">${count}</span></div>${note}
  <ul style="display:grid;grid-template-columns:minmax(0,1fr)">${rows}</ul></section>`;
const customers = frame(`${top()}
  <div style="padding:0 16px"><h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em">Customers</h1>
  <div style="margin-top:8px;height:40px;border-radius:999px;background:${F.card2};display:flex;align-items:center;gap:8px;padding:0 14px;color:${F.faint};font-size:14px">${ic(I.search, 17)}Search a name, email or phone</div></div>
  <div style="height:12px"></div>
  ${group("Needs you", 3, row("IS", "Ivy Sohal", "Is parking included with the unit?", "18m") + row("OS", "Owen Shah", "Is the house on Elm St still available?", "2h") + row("ED", "Ella Das", "Can I bring my partner to the viewing?", "5h"))}
  ${group(`<span style="display:inline-flex;gap:6px;align-items:center">${ic(I.flame, 16, 2)}Ready to book</span>`, 1, row("MG", "Mia Gill", "2-bed · $2,400/mo · moving this month", "Call", true))}
  <section style="margin:0 12px;padding:0 12px;border-radius:16px;background:${F.card};border:1px solid ${F.line}">
    ${[["Waiting on them", "FollowUp checks in for you", 6], ["Booked", "Viewings and calls coming up", 2], ["Everyone", "", 17]].map(([a, b, n], i) => `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;${i ? `border-top:1px solid ${F.line};` : ""}"><span style="flex:1"><b style="display:block;font-size:14px;font-weight:600">${a}</b>${b ? `<span style="font-size:12.5px;color:${F.faint}">${b}</span>` : ""}</span><span style="font-size:14px;font-weight:600;font-variant-numeric:tabular-nums">${n}</span><span style="color:${F.faint}">${ic(I.right, 18)}</span></div>`).join("")}
  </section>${tabs("Customers")}`);

const bubble = (text, mine, label) => `<div style="display:flex;justify-content:${mine ? "flex-end" : "flex-start"}"><div style="max-width:82%"><p style="padding:9px 12px;border-radius:16px;${mine ? `background:${F.ink};color:var(--on-accent);border-bottom-right-radius:6px` : `background:${F.card};border:1px solid ${F.line};border-bottom-left-radius:6px`};font-size:14px;line-height:1.4">${text}</p>${label ? `<p style="margin-top:3px;font-size:11px;color:${F.faint};text-align:${mine ? "right" : "left"}">${label}</p>` : ""}</div></div>`;
const customer = frame(`<header style="height:50px;display:flex;align-items:center;gap:6px;padding:0 10px"><span style="display:flex;align-items:center;gap:2px;color:${F.ink};font-size:14.5px">${ic(I.left, 20)}Customers</span></header>
  <div style="padding:0 16px;display:flex;gap:10px;align-items:center">${av("MG", 38)}<div><h1 style="font-size:19px;font-weight:600;letter-spacing:-0.015em">Mia Gill</h1><p style="display:flex;align-items:center;gap:5px;font-size:12.5px;color:${F.faint}">${ic(I.insta, 14)} Instagram · first wrote Oct 7</p></div></div>
  <div style="margin:10px 12px 0;padding:9px 12px;border-radius:14px;background:${F.card2};display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:left">
    ${[["Wants", "2-bed"], ["Budget", "$2,400/mo"], ["When", "This month"]].map(([k, v]) => `<span><span style="display:block;font-size:11.5px;color:${F.faint}">${k}</span><b style="font-size:13.5px;font-weight:600">${v}</b></span>`).join("")}
  </div>
  <div style="margin:12px 12px 0;display:grid;gap:8px">
    ${bubble("Hi! Do you have any 2-bed condos downtown under $2,500?", false, "Mia · Oct 7, 9:12")}
    ${bubble("Hi Mia, yes, three right now, all under $2,500. When are you hoping to move? I can line up viewings for you.", true, "Sent by FollowUp · 9:13")}
    ${bubble("This month ideally. Can I see the King St one?", false, "Mia · 9:40")}
  </div>
  <div style="margin:12px 16px 0">${mono("What FollowUp did")}
    <p style="margin-top:6px;font-size:13px;line-height:1.6;color:${F.soft}">Replied in 1 min · Asked when she wants to move · Next check-in Tue, if she goes quiet</p></div>
  <div style="position:absolute;left:10px;right:10px;bottom:80px;padding:4px 4px 4px 14px;border-radius:999px;background:${F.card};border:1px solid ${F.line};box-shadow:0 6px 24px rgba(10,10,10,.06);display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:14px;color:${F.faint}">Reply to Mia…</span><span style="width:36px;height:36px;border-radius:999px;background:${F.ink};color:var(--on-accent);display:grid;place-items:center">${ic(I.up, 19, 2.3)}</span></div>
  ${tabs("Customers")}`);

const setRow = (d, a, b, i) => `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;${i ? `border-top:1px solid ${F.line};` : ""}"><span style="flex:none;width:30px;height:30px;border-radius:8px;background:${F.card2};display:grid;place-items:center;color:${F.ink}">${ic(d, 16)}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:14px;font-weight:600">${a}</b><span style="font-size:12.5px;color:${F.faint}">${b}</span></span><span style="color:${F.faint}">${ic(I.right, 18)}</span></div>`;
const settings = frame(`${top(false)}
  <div style="padding:0 16px"><h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em">Settings</h1></div>
  <section style="margin:10px 12px 0;padding:0 12px;border-radius:16px;background:${F.card};border:1px solid ${F.line}">
    ${[[I.inbox, "Where customers write", "Gmail and Instagram"], [I.send, "How replies go out", "FollowUp replies for you"], [I.bell, "Alerts", "On for this phone"], [I.store, "Your business", "Maple Realty"]].map(([d, a, b], i) => setRow(d, a, b, i)).join("")}
  </section>
  <section style="margin:10px 12px 0;padding:0 12px;border-radius:16px;background:${F.card};border:1px solid ${F.line}">
    ${setRow(I.more, "More", "Team, plan, your data, advanced", 0)}
  </section>
  <div style="margin:18px 16px 0;display:grid;gap:12px;font-size:14px"><span style="display:flex;align-items:center;gap:8px;color:${F.ink}">${ic(I.help, 17)}Help</span><span style="color:${F.soft}">Sign out</span></div>
  ${tabs("Settings")}`);

const stat = (n, a, b, i) => `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;${i ? `border-top:1px solid ${F.line};` : ""}"><span style="flex:1"><b style="display:block;font-size:14px;font-weight:600">${a}</b><span style="font-size:12.5px;color:${F.faint}">${b}</span></span><span style="font-size:18px;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">${n}</span></div>`;
const results = frame(`${top()}
  <div style="padding:2px 16px 0"><p style="font-size:12.5px;color:${F.faint}">This week</p>
  <div style="display:flex;align-items:baseline;gap:10px;margin-top:2px"><span style="font-size:34px;font-weight:600;letter-spacing:-0.035em;line-height:1">14</span><span style="font-size:17px;font-weight:500;line-height:1.2">customers answered</span></div>
  <p style="margin-top:4px;font-size:13px;color:${F.sage};font-weight:500">5 more than last week</p></div>
  <section style="margin:14px 12px 0;padding:0 12px;border-radius:16px;background:${F.card};border:1px solid ${F.line}">
    ${stat(3, "Booked", "Viewings and calls", 0)}${stat("4 min", "First reply", "Half were faster", 1)}${stat(1, "Won", "Marked by you", 2)}
  </section>
  <p style="margin:12px 16px 0;font-size:13px;color:${F.soft};text-decoration:underline;text-underline-offset:3px">See everything FollowUp did</p>
  ${tabs("Results")}`);

module.exports = { today, done, ask, customers, customer, settings, results };
